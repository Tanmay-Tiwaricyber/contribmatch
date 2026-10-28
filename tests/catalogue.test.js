/**
 * Static catalogue (Layer A) + refresh tool (Layer D) tests.
 *
 * All network access is mocked or replaced with fixture data. The refresh
 * tool's pure core (buildCatalogue/normalizeEntry) is exercised without
 * touching the live Search API.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readCatalogue,
  issuesFromCatalogue,
  eligibleFromCatalogue,
  fetchCatalogue,
  clearCatalogueCache,
  CATALOGUE_MAX_AGE_MS,
} from '../js/github/catalogue.js';
import { normalizeEntry, buildCatalogue } from '../tools/refresh-catalogue.mjs';
import { createOrchestrator } from '../js/core/orchestrator.js';

const NOW = Date.parse('2026-10-27T12:00:00Z');

/** A handful of entries shaped exactly like the committed catalogue. */
const ENTRIES = [
  {
    id: 1,
    number: 7,
    title: 'Fix README typo',
    url: 'https://github.com/octo/hello/issues/7',
    repo: 'octo/hello',
    labels: ['good first issue'],
    state: 'open',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-20T00:00:00Z',
    body: 'One-line description.',
    language: 'JavaScript',
  },
  {
    id: 2,
    number: 3,
    title: 'Add Hindi strings',
    url: 'https://github.com/octo/hello/issues/3',
    repo: 'octo/hello',
    labels: ['help wanted', 'translation'],
    state: 'open',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    body: '',
    language: 'Python',
  },
  {
    id: 1, // duplicate id from an overlapping search — must be dropped
    number: 7,
    title: 'Fix README typo',
    url: 'https://github.com/octo/hello/issues/7',
    repo: 'octo/hello',
    labels: ['hacktoberfest'],
    state: 'open',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-20T00:00:00Z',
    body: '',
    language: 'JavaScript',
  },
  {
    id: 4,
    number: 9,
    title: 'Migrate output',
    url: 'https://github.com/octo/old/issues/9',
    repo: 'octo/old',
    labels: ['good first issue'],
    state: 'closed', // closed issues never reach the UI
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    body: '',
    language: 'Go',
  },
];

const MANIFEST = {
  version: 1,
  fetchedAt: '2026-10-27T10:00:00Z', // 2h old — inside the default window
  issues: ENTRIES,
};

test('readCatalogue accepts a valid manifest and computes age', () => {
  const out = readCatalogue(MANIFEST, { now: NOW });
  assert.equal(out.ok, true);
  assert.equal(out.stale, false);
  assert.equal(out.fetchedAt, '2026-10-27T10:00:00Z');
  assert.equal(out.issues.length, 4);
  assert.equal(out.error, null);
});

test('readCatalogue flags a stale catalogue and never fakes freshness', () => {
  const out = readCatalogue(MANIFEST, {
    now: NOW + CATALOGUE_MAX_AGE_MS + 1000,
  });
  assert.equal(out.ok, true);
  assert.equal(out.stale, true);
});

test('readCatalogue reports missing or malformed files as unusable', () => {
  assert.equal(readCatalogue(null).ok, false);
  assert.equal(readCatalogue({}).ok, false);
  assert.equal(readCatalogue({ issues: 'nope' }).ok, false);
  // A missing fetchedAt is honest: usable entries, but marked stale.
  const noStamp = readCatalogue({ issues: ENTRIES }, { now: NOW });
  assert.equal(noStamp.ok, true);
  assert.equal(noStamp.stale, true);
  assert.match(noStamp.error, /never been refreshed/i);
});

test('issuesFromCatalogue dedupes and drops closed issues', () => {
  const issues = issuesFromCatalogue(ENTRIES);
  assert.equal(issues.length, 2, 'duplicate id and closed issue removed');
  const ids = issues.map((i) => i.id);
  assert.ok(ids.includes(1) && ids.includes(2));
  const first = issues.find((i) => i.id === 1);
  assert.equal(first.repo, 'octo/hello');
  assert.equal(first.htmlUrl, 'https://github.com/octo/hello/issues/7');
  assert.equal(first.fromCatalogue, true);
  assert.equal(first.repoHealth.archived, false);
});

test('catalogue language filtering falls back to a wider cut, not zero', () => {
  const issues = issuesFromCatalogue(ENTRIES);
  const python = eligibleFromCatalogue(issues, { languages: ['python'] });
  assert.equal(python.length, 1);
  assert.equal(python[0].id, 2);

  const nothing = eligibleFromCatalogue(issues, { languages: ['rust'] });
  assert.equal(nothing.length, 2, 'no match keeps the broader list rather than hiding issues');
});

test('fetchCatalogue reads the fixture, reports count and caches the session read', async () => {
  clearCatalogueCache();
  let reads = 0;
  const fetchImpl = async () => {
    reads += 1;
    return { ok: true, status: 200, json: async () => MANIFEST };
  };

  const first = await fetchCatalogue({ url: 'test:catalogue', fetchImpl, now: NOW });
  assert.equal(first.ok, true);
  assert.equal(first.issues.length, 4);

  const second = await fetchCatalogue({ url: 'test:catalogue', fetchImpl, now: NOW });
  assert.equal(reads, 1, 'session cache prevents re-parsing');
  clearCatalogueCache();
});

test('a failing catalogue fetch is reported, never invented', async () => {
  clearCatalogueCache();
  const result = await fetchCatalogue({
    url: 'test:missing',
    fetchImpl: async () => ({ ok: false, status: 404 }),
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /404/);
  clearCatalogueCache();
});

test('refresh tool: normalizeEntry keeps only real fields and truncates', () => {
  const entry = normalizeEntry({
    id: 42,
    number: 5,
    title: 'x'.repeat(500),
    html_url: 'https://github.com/a/b/issues/5',
    repository_url: 'https://api.github.com/repos/a/b',
    labels: [{ name: 'good first issue' }, 'docs'],
    state: 'open',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    body: 'line1\nline2\nline3',
  }, { language: 'Rust' });
  assert.equal(entry.repo, 'a/b');
  assert.deepEqual(entry.labels, ['good first issue', 'docs']);
  assert.ok(entry.title.length <= 200);
  assert.ok(!entry.body.includes('\n'));
  assert.equal(entry.language, 'Rust');
});

test('refresh tool: buildCatalogue dedupes by issue id and counts overlaps', () => {
  const a = { id: 10, title: 'one', html_url: 'https://github.com/a/x/issues/1', repository_url: 'https://api.github.com/repos/a/x' };
  const again = { ...a };
  const b = { id: 11, title: 'two', html_url: 'https://github.com/a/x/issues/2', repository_url: 'https://api.github.com/repos/a/x', state: 'closed' };
  const { manifest, duplicateCount } = buildCatalogue(
    [{ items: [a], language: 'JS' }, { items: [again], language: '' }, { items: [b], language: 'JS' }],
    { now: new Date(NOW) }
  );
  assert.equal(duplicateCount, 1, 'the repeated issue is recorded, not silently lost');
  assert.equal(manifest.issues.length, 1, 'closed issues are not catalogued');
  assert.equal(manifest.fetchedAt, new Date(NOW).toISOString());
  assert.equal(manifest.issues[0].language, 'JS');
});

test('17 — a complete offline run with a fresh catalogue needs no token and no Search call', async () => {
  clearCatalogueCache();
  let searchCalls = 0;
  const client = {
    hasToken: false,
    getUser: async () => ({ login: 'octo', public_repos: 0 }),
    getRepos: async () => [],
    searchIssues: async () => {
      searchCalls += 1;
      throw new Error('live search must not run with a fresh catalogue');
    },
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => MANIFEST });
  try {
    // The fixture has fixed timestamps, so its real age grows every day.
    // Declare it fresh relative to the actual clock — this test measures the
    // "fresh catalogue" path, not the freshness window itself.
    const fixtureMaxAgeMs = Date.now() - Date.parse(MANIFEST.fetchedAt) + 60_000;
    assert.ok(fixtureMaxAgeMs > 0, 'the fixture is not from the future');
    const orchestrator = createOrchestrator({
      client,
      catalogue: { url: 'test:fresh', maxAgeMs: fixtureMaxAgeMs },
    });
    const result = await orchestrator.match({ login: 'octo', languages: ['javascript'], limit: 10 });
    assert.equal(searchCalls, 0, 'no Search API call for a fresh catalogue');
    assert.ok(result.issues.length > 0, 'catalogue issues were ranked');
    assert.equal(result.issues.some((i) => i.id === 1), true);
    assert.equal(
      result.issues.every((i) => !i.stale),
      true,
      'fresh catalogue results are not presented as stale'
    );
  } finally {
    globalThis.fetch = realFetch;
    clearCatalogueCache();
  }
});

test('stale catalogue is used as a fallback when GitHub refuses, and is labelled', async () => {
  clearCatalogueCache();
  const client = {
    hasToken: false,
    getUser: async () => ({ login: 'octo', public_repos: 0 }),
    getRepos: async () => [],
    searchIssues: async () => {
      const err = new Error('stopped');
      err.kind = 'rate-limit';
      err.limitType = 'primary';
      throw err;
    },
  };
  // A stale manifest: fetched three days ago.
  const staleManifest = {
    version: 1,
    fetchedAt: new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString(),
    issues: ENTRIES,
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => staleManifest,
  });
  try {
    const orchestrator = createOrchestrator({
      client,
      cache: null,
      catalogue: { url: 'test:stale' },
    });
    const result = await orchestrator.match({ login: 'octo', languages: ['javascript'], limit: 10 });
    assert.ok(result.issues.length > 0);
    assert.equal(
      result.issues.every((i) => i.stale && i.dataSource === 'catalogue-stale'),
      true,
      'fallback data is clearly labelled as stale catalogue data'
    );
  } finally {
    globalThis.fetch = realFetch;
    clearCatalogueCache();
  }
});
