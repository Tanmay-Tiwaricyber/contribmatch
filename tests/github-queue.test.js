/**
 * GitHub request gate + rate-limit tests.
 *
 * Every rate-limit scenario here is mocked: no real GitHub quota is used.
 * Tests create isolated gates (and trackers) so they never touch the
 * browser's shared singleton state.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiGate, defaultGate, QueueFullError } from '../js/github/queue.js';
import { createGitHubClient, GitHubError } from '../js/github/api.js';
import { createRateLimitTracker } from '../js/github/rate-limit.js';
import { createCache } from '../js/github/cache.js';
import { fetchProfile, fetchRepoMeta } from '../js/github/profile.js';
import { searchIssues } from '../js/github/issues.js';
import { createOrchestrator } from '../js/core/orchestrator.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Minimal Response-like object. */
function res(data, { status = 200, headers = {} } = {}) {
  const body = status === 204 ? '' : JSON.stringify(data ?? {});
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => body,
    json: async () => JSON.parse(body || '{}'),
  };
}

/** Storage-like Map-backed cache for tests. */
function mapStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

/** Wait spy: records every requested wait and resolves immediately. */
function instantWait() {
  const waits = [];
  const wait = async (ms) => {
    waits.push(ms);
  };
  return { waits, wait };
}

/** A client wired to an isolated gate + tracker (+ optional cache storage). */
function makeClient({ handler, gate, tracker = createRateLimitTracker(), token, storage, fast = true } = {}) {
  const calls = [];
  const callsView = { list: calls };
  const fetchImpl = async (url, init = {}) => {
    const headers = init.headers || {};
    const entry = { url, authorization: headers.Authorization || null, at: Date.now() };
    calls.push(entry);
    const out = await handler(entry, callsView);
    // Handlers may return either a Response-like object or plain data.
    if (out && typeof out.ok === 'boolean' && out.headers && typeof out.text === 'function') return out;
    return res(out);
  };
  let waits = null;
  let resolvedGate = gate;
  if (!resolvedGate) {
    const spy = fast ? instantWait() : { waits: null, wait: (ms) => sleep(ms) };
    waits = spy.waits;
    resolvedGate = createApiGate({ pacingMs: 0, wait: spy.wait });
  }
  const client = createGitHubClient({ token, fetchImpl, gate: resolvedGate, tracker });
  const cache = storage ? createCache({ storage }) : undefined;
  return { client, calls: callsView, cache, tracker, gate: resolvedGate, waits };
}

test('1 — two concurrent requests execute sequentially, never in parallel', async () => {
  let inFlight = 0;
  let overlaps = 0;
  const { client } = makeClient({
    fast: false,
    async handler(entry) {
      if (inFlight > 0) overlaps += 1;
      inFlight += 1;
      await sleep(15);
      inFlight -= 1;
      const login = decodeURIComponent(entry.url.split('/users/')[1] || 'x');
      return { login };
    },
  });

  const [a, b] = await Promise.all([client.getUser('octocat'), client.getUser('other')]);

  assert.equal(overlaps, 0, 'no two requests overlap');
  assert.equal(a.login, 'octocat');
  assert.equal(b.login, 'other');
});

test('2 — identical simultaneous GET requests are deduplicated', async () => {
  const { client, calls } = makeClient({
    async handler() {
      await sleep(15);
      return { login: 'octocat', id: 1 };
    },
  });

  const [a, b, c] = await Promise.all([
    client.getUser('octocat'),
    client.getUser('octocat'),
    client.getUser('octocat'),
  ]);

  assert.equal(calls.list.length, 1, 'only one network call');
  assert.equal(a.login, 'octocat');
  assert.equal(b.login, 'octocat');
  assert.equal(c.login, 'octocat');
});

test('3 — cached requests do not trigger extra network calls', async () => {
  const storage = mapStorage();
  const { client, calls, cache } = makeClient({
    handler: async () => ({ login: 'octo', open_issues_count: 8 }),
    storage,
  });

  const first = await fetchRepoMeta(client, 'octo/hello', { cache });
  const second = await fetchRepoMeta(client, 'octo/hello', { cache });

  assert.equal(calls.list.length, 1, 'second read comes from cache');
  assert.deepEqual(second, first);
  assert.equal(cache.stats().entries, 1);
});

test('4 — a 401 does not trigger repeated retries and never looks like a rate limit', async () => {
  const { client, calls } = makeClient({
    handler: async () => res({}, { status: 401 }),
  });

  await assert.rejects(client.getUser('octocat'), (err) => {
    assert.ok(err instanceof GitHubError);
    assert.equal(err.kind, 'bad-token');
    assert.equal(err.status, 401);
    return true;
  });
  assert.equal(calls.list.length, 1, 'no retry for auth errors');
});

test('5 — a primary rate-limit response pauses requests until reset', async () => {
  const { client, calls } = makeClient({
    gate: createApiGate({ pacingMs: 0, pauseWakeMs: 20 }),
    handler: async (entry) =>
      calls.list.length === 1
        ? res(
            { message: 'API rate limit exceeded' },
            {
              status: 403,
              headers: {
                'x-ratelimit-remaining': '0',
                'x-ratelimit-limit': '60',
                // ~300ms (rounded to whole seconds) from now — a short fake window.
                'x-ratelimit-reset': String(Math.ceil((Date.now() + 300) / 1000)),
              },
            }
          )
        : res({ login: 'octocat' }),
  });

  const firstError = await client.getUser('octocat').then(
    () => {
      throw new Error('should have failed');
    },
    (err) => err
  );
  assert.equal(firstError.kind, 'rate-limit');
  assert.equal(firstError.limitType, 'primary');

  // The next request must wait for the (short, mocked) reset window.
  const start = Date.now();
  const out = await client.getUser('octocat');
  const elapsed = Date.now() - start;
  assert.ok(elapsed >= 250, `queued request waited for reset (took ${elapsed}ms)`);
  assert.equal(out.login, 'octocat');
  assert.equal(calls.list.length, 2);
});

test('6 — a secondary rate-limit response respects Retry-After', async () => {
  const { client, calls, waits } = makeClient({
    handler: async () =>
      calls.list.length === 1
        ? res(
            { message: 'You have exceeded a secondary rate limit' },
            { status: 429, headers: { 'retry-after': '1' } }
          )
        : res({ login: 'octocat' }),
  });

  const out = await client.getUser('octocat');
  assert.equal(out.login, 'octocat', 'the retried request succeeded');
  assert.equal(calls.list.length, 2, 'one retry after the limit');
  assert.ok(
    (waits || []).some((ms) => ms >= 900 && ms <= 1100),
    `retry waited about one second, saw waits=${JSON.stringify(waits)}`
  );
});

test('7 — failed requests never freeze the queue', async () => {
  const { client, calls } = makeClient({
    handler: async () => {
      throw Object.assign(new Error('offline'), { name: 'TypeError' });
    },
  });

  const results = await Promise.allSettled([client.getUser('a'), client.getUser('b'), client.getUser('c')]);

  for (const outcome of results) {
    assert.equal(outcome.status, 'rejected', 'every request settles');
    assert.equal(outcome.reason.kind, 'network');
  }
  // Bounded retries per request (initial + 2), so 3 * 3 = 9 attempts.
  assert.equal(calls.list.length, 9, 'every request retried only its bounded count');
});

test('8 — the configured token is attached and anonymous stays anonymous', async () => {
  const authed = makeClient({
    token: 'ghp_test_token',
    handler: async () => ({ login: 'octocat' }),
  });
  await authed.client.getUser('octocat');
  assert.equal(authed.calls.list[0].authorization, 'Bearer ghp_test_token');

  const anon = makeClient({ handler: async () => ({ login: 'octocat' }) });
  await anon.client.getUser('octocat');
  assert.equal(anon.calls.list[0].authorization, null);
});

test('9 — search and core API limits are tracked separately', async () => {
  const tracker = createRateLimitTracker();
  const gate = createApiGate({ pacingMs: 0 });
  const { client } = makeClient({
    gate,
    tracker,
    handler: async (entry) =>
      entry.url.includes('/search/')
        ? res({ items: [] }, { headers: { 'x-ratelimit-limit': '10', 'x-ratelimit-remaining': '9' } })
        : res({}, { headers: { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '4999' } }),
  });

  await client.searchIssues('is:issue is:open label:"good first issue"');
  await client.getUser('octocat');

  const snap = tracker.snapshot();
  assert.equal(snap.search.limit, 10);
  assert.equal(snap.search.remaining, 9);
  assert.equal(snap.core.limit, 5000);
  assert.equal(snap.core.remaining, 4999);
});

test('9b — GraphQL limits are tracked in their own bucket', async () => {
  const tracker = createRateLimitTracker();
  const gate = createApiGate({ pacingMs: 0 });
  const { client } = makeClient({
    gate,
    tracker,
    handler: async () => res({ data: { user: { login: 'octocat' } } }, { headers: { 'x-ratelimit-limit': '5000' } }),
  });
  await client.graphql('query { user { login } }', {});
  assert.equal(tracker.snapshot().graphql.limit, 5000);
});

test('10 — the queue is bounded and explains itself when full', async () => {
  const gate = createApiGate({ pacingMs: 0, maxQueue: 1 });
  const slow = async () => {
    await sleep(40);
    return 'ok';
  };
  const p1 = gate.run('a', slow);
  const p2 = gate.run('b', slow); // queued behind the running one
  assert.throws(() => gate.run('c', async () => 'x'), QueueFullError);
  assert.throws(
    () => gate.run('d', async () => 'x'),
    (err) => err.message.includes('Too many GitHub requests are queued')
  );
  assert.equal(await p1, 'ok');
  assert.equal(await p2, 'ok');
});

test('10b — the shared default gate uses 500–1000ms pacing', async () => {
  const snap = defaultGate.status();
  assert.equal(snap.maxQueue > 0, true);
  assert.ok(snap.pacingMs >= 500 && snap.pacingMs <= 1000, `pacing=${snap.pacingMs}`);
});

test('11 — the full search flow works through the gate (fake GitHub)', async () => {
  const storage = mapStorage();
  const gate = createApiGate({ pacingMs: 0 });
  const tracker = createRateLimitTracker();
  const lim = { 'x-ratelimit-limit': '10', 'x-ratelimit-remaining': '8' };
  const { client, calls, cache } = makeClient({
    gate,
    tracker,
    storage,
    handler: async (entry) =>
      entry.url.includes('/search/')
        ? res(
            {
              items: [
                {
                  id: 1,
                  number: 1,
                  title: 'Fix README typo',
                  repository_url: 'https://api.github.com/repos/octo/hello',
                  labels: [{ name: 'good first issue' }],
                  html_url: 'https://github.com/octo/hello/issues/1',
                  updated_at: '2026-01-01T00:00:00Z',
                },
              ],
            },
            { headers: lim }
          )
        : res({ login: 'octo', open_issues_count: 3, archived: false }, { headers: lim }),
  });

  const issues = await searchIssues(client, { languages: [], limit: 5, cache, maxRepoLookups: 1 });
  assert.ok(Array.isArray(issues));
  assert.ok(issues.length >= 1, 'normalised issues came back');
  assert.equal(issues[0].repo, 'octo/hello');
  assert.ok(tracker.snapshot().search, 'the search bucket was observed');
  assert.equal(calls.list.length > 1, true, 'only bounded, queued calls were made');
});

test('12 — cache is reused, invalidated, and stale copies are flagged', async () => {
  const storage = mapStorage();
  let failing = false;
  const { client, calls, cache } = makeClient({
    storage,
    handler: async () =>
      failing
        ? Promise.reject(Object.assign(new Error('offline'), { name: 'TypeError' }))
        : { login: 'octo' },
  });

  // 1. fresh fetch, cached for 15 minutes
  const first = await fetchProfile(client, 'octo', { cache });
  assert.equal(first.login, 'octo');
  assert.equal(calls.list.length, 2, 'user + repos requests');

  // 2. cached copy is reused without any new request
  await fetchProfile(client, 'octo', { cache });
  assert.equal(calls.list.length, 2, 'no extra network calls while cached');

  // 3. invalidation drops the entry
  cache.invalidate('profile:octo');
  assert.equal(cache.get('profile:octo'), null);

  // 4. network failure + an expired copy => stale data, clearly flagged
  failing = true;
  cache.set('profile:octo', { login: 'stale-octo', languages: {} }, -1); // already expired
  const stale = await fetchProfile(client, 'octo', { cache });
  assert.equal(stale.login, 'stale-octo');
  assert.equal(stale.stale, true, 'stale copy is flagged, never presented as fresh');
});

test('13 — pacing separates two requests', async () => {
  const { client, calls } = makeClient({
    fast: false,
    gate: createApiGate({ pacingMs: 40 }),
    handler: async () => ({}),
  });
  await Promise.all([client.getUser('a'), client.getUser('b')]);
  const gap = calls.list[1].at - calls.list[0].at;
  assert.ok(gap >= 35, `second request started after pacing (gap ${gap}ms)`);
});

test('14 — a plain 403 permission failure is not reported as a rate limit', async () => {
  const { client, calls } = makeClient({
    handler: async () =>
      res({ message: 'Resource not accessible by personal access token' }, { status: 403 }),
  });
  await assert.rejects(client.getUser('octocat'), (err) => {
    assert.equal(err.kind, 'forbidden');
    assert.notEqual(err.kind, 'rate-limit');
    return true;
  });
  assert.equal(calls.list.length, 1, 'permission errors are not retried');
});

test('15 — transient 5xx responses retry a limited number of times', async () => {
  const { client, calls } = makeClient({
    handler: async () =>
      calls.list.length < 3
        ? res({}, { status: 502 })
        : res({ login: 'octocat' }),
  });
  const out = await client.getUser('octocat');
  assert.equal(out.login, 'octocat');
  assert.equal(calls.list.length, 3, '502, 502, then success — and it stops there');
});
