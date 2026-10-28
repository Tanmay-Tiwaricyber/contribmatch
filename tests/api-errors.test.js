/**
 * GitHub client error kinds: a rejected token must not look like a rate limit.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createGitHubClient, GitHubError } from '../js/github/api.js';

function fakeFetch(status, headers = {}) {
  return async () => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => ({}),
  });
}

test('401 is reported as a rejected token, not a rate limit', async () => {
  const client = createGitHubClient({ token: 'bad', fetchImpl: fakeFetch(401) });
  await assert.rejects(client.getUser('octocat'), (err) => {
    assert.ok(err instanceof GitHubError);
    assert.equal(err.kind, 'bad-token');
    return true;
  });
});

test('403 with no quota left is a rate limit with a reset time', async () => {
  const reset = String(Math.floor(Date.now() / 1000) + 600);
  const client = createGitHubClient({
    fetchImpl: fakeFetch(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset }),
  });
  await assert.rejects(client.getUser('octocat'), (err) => {
    assert.equal(err.kind, 'rate-limit');
    assert.match(err.message, /resets in about/);
    return true;
  });
});

test('hasToken reflects whether a token was supplied', () => {
  assert.equal(createGitHubClient({ token: 'x', fetchImpl: fakeFetch(200) }).hasToken, true);
  assert.equal(createGitHubClient({ fetchImpl: fakeFetch(200) }).hasToken, false);
});
