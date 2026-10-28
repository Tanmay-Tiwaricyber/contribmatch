/**
 * GitHub REST / GraphQL client.
 *
 * Every request — from any page, any agent, any client instance — is routed
 * through the shared request gate (js/github/queue.js), so:
 *
 *   - one request in flight at a time, paced apart (default 600 ms);
 *   - identical in-flight GETs are deduplicated;
 *   - primary limits pause the whole gate until the reset time;
 *   - secondary limits honour Retry-After, else back off with jitter (bounded);
 *   - transient network failures / 5xx retry a limited number of times;
 *   - 401 / 403-permission / 404 / 400 never retry.
 *
 * The optional user token is read from settings by the pages and passed in
 * here; memory / sessionStorage only — never logged, never committed.
 * Rate-limit budget is tracked per bucket (core / search / graphql).
 */

import { createApiGate, defaultGate, DEFAULT_PACING_MS, QueueFullError } from './queue.js';
import {
  bucketForPath,
  classifyLimit,
  isTransientStatus,
  sharedTracker,
} from './rate-limit.js';

export { QueueFullError };

export class GitHubError extends Error {
  constructor(
    message,
    { status = 0, kind = 'unknown', retryAfter = null, resetAt = null, limitType = null } = {}
  ) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.kind = kind;
    // 'rate-limit' | 'secondary-limit' | 'bad-token' | 'forbidden' |
    // 'not-found' | 'bad-request' | 'server' | 'network' | 'aborted' | 'unknown'
    this.retryAfter = retryAfter;
    this.resetAt = resetAt;
    this.limitType = limitType; // when kind === 'rate-limit': 'primary' | 'secondary'
  }
}

const MAX_TRANSIENT_RETRIES = 2; // extra attempts after the first
const MAX_SECONDARY_RETRIES = 2; // extra attempts after the first
const TRANSIENT_BASE_MS = 500;
const SECONDARY_BASE_MS = 2000;
const SECONDARY_MAX_WAIT_MS = 30000;

/** Small random jitter so several tabs do not step on each other. */
function jitter(rand = Math.random, range = 1000) {
  return rand() * range;
}

/**
 * @param {{token?: string|null, fetchImpl?: typeof fetch, base?: string, gate?: object, tracker?: object}} [opts]
 */
export function createGitHubClient({
  token = null,
  fetchImpl,
  base = 'https://api.github.com',
  gate = defaultGate,
  tracker = sharedTracker,
} = {}) {
  const doFetch = fetchImpl || globalThis.fetch.bind(globalThis);
  const clock = () => Date.now();

  function wrapNetworkError(err) {
    if (err?.name === 'AbortError') {
      return new GitHubError('Request cancelled.', { kind: 'aborted' });
    }
    return new GitHubError(`Cannot reach GitHub. ${err.message}`, { kind: 'network' });
  }

  /**
   * One HTTP attempt. Returns the Response on the wire; network failures
   * become GitHubError('network'|'aborted').
   */
  async function attempt(url, { method, headers, body, signal }) {
    try {
      return await doFetch(url, { method, headers, body, signal });
    } catch (err) {
      if (err instanceof GitHubError) throw err;
      throw wrapNetworkError(err);
    }
  }

  /** Parse the body as JSON without ever throwing. */
  async function readBody(res) {
    try {
      const text = await res.text();
      if (!text) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * @returns error describing a non-OK status; may have already recorded a
   * gate pause for genuine rate limits.
   */
  async function errorFromResponse(res, spec) {
    const body = await readBody(res);
    tracker.observe(bucketForPath(spec.path), res.headers);

    if (res.status === 401) {
      return new GitHubError(
        'The GitHub token was rejected. It may be expired or mistyped. Create a new one and save it again.',
        { status: 401, kind: 'bad-token' }
      );
    }

    if (res.status === 404) {
      return new GitHubError('That GitHub username or repository was not found.', {
        status: 404,
        kind: 'not-found',
      });
    }

    if (res.status === 400 || res.status === 422) {
      const detail = body?.message || 'The request was not valid.';
      return new GitHubError(`GitHub refused the request: ${detail}`, {
        status: res.status,
        kind: 'bad-request',
      });
    }

    if (res.status === 403 || res.status === 429) {
      const info = classifyLimit(res.status, res.headers, body);
      const retryAfter = res.headers.get('retry-after');

      if (info.type === 'primary') {
        const resetAt = info.resetAt ?? (info.retryAfterMs ? clock() + info.retryAfterMs : null);
        if (resetAt) {
          gate.pauseUntil(resetAt, 'primary-rate-limit');
          const minutes = Math.max(1, Math.round((resetAt - clock()) / 60000));
          return new GitHubError(
            `GitHub rate limit reached. It resets in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
            { status: res.status, kind: 'rate-limit', retryAfter: null, resetAt, limitType: 'primary' }
          );
        }
        return new GitHubError('GitHub rate limit reached. Try again in a minute.', {
          status: res.status,
          kind: 'rate-limit',
          limitType: 'primary',
        });
      }

      if (info.type === 'secondary') {
        const waitMs =
          info.retryAfterMs ??
          Math.min(
            SECONDARY_MAX_WAIT_MS,
            SECONDARY_BASE_MS * Math.pow(2, spec.retry ?? 0) + jitter()
          );
        if (retryAfter || (spec.retry ?? 0) < MAX_SECONDARY_RETRIES) {
          gate.pauseUntil(clock() + waitMs, 'secondary-rate-limit');
          // Tell the caller to try again once the pause lifts.
          return new GitHubError('GitHub is throttling requests. Retrying shortly.', {
            status: res.status,
            kind: 'rate-limit',
            retryAfter: retryAfter ? Number(retryAfter) : null,
            resetAt: clock() + waitMs,
            limitType: 'secondary',
          });
        }
        return new GitHubError(
          'GitHub is asking for slower requests. Wait a little and try again.',
          { status: res.status, kind: 'rate-limit', limitType: 'secondary', resetAt: clock() + waitMs }
        );
      }

      // Plain permission error — never looks like throttling.
      const detail = body?.message || 'GitHub refused the request.';
      return new GitHubError(detail, { status: res.status, kind: 'forbidden' });
    }

    if (isTransientStatus(res.status)) {
      return new GitHubError(`GitHub responded ${res.status}.`, {
        status: res.status,
        kind: 'server',
      });
    }

    return new GitHubError(`GitHub responded ${res.status}.`, { status: res.status });
  }

  /**
   * The retry loop that runs inside a single queue slot.
   * @param {{path, url, method, headers, body, signal}} spec
   */
  async function execute(spec) {
    let transientRetries = 0;
    let secondaryRetries = 0;

    for (;;) {
      let res;
      try {
        res = await attempt(spec.url, spec);
      } catch (err) {
        // Network failure (+ optionally a retried attempt) — bounded.
        if (err.kind === 'aborted') throw err;
        if (err.kind === 'network' && transientRetries < MAX_TRANSIENT_RETRIES) {
          transientRetries += 1;
          await gate.delay(TRANSIENT_BASE_MS * transientRetries + jitter(undefined, 250));
          continue;
        }
        throw err;
      }

      if (res.ok) {
        tracker.observe(bucketForPath(spec.path), res.headers);
        if (res.status === 204) return null;
        const body = await readBody(res);
        return body;
      }

      const err = await errorFromResponse(res, spec);

      if (err.kind === 'aborted') throw err;

      if (err.kind === 'network') {
        if (transientRetries < MAX_TRANSIENT_RETRIES) {
          transientRetries += 1;
          await gate.delay(TRANSIENT_BASE_MS * transientRetries + jitter(undefined, 250));
          continue;
        }
        throw err;
      }

      // Wait for the pause to lift and try once more — bounded.
      if (err.kind === 'rate-limit' && err.limitType === 'secondary') {
        if (secondaryRetries < MAX_SECONDARY_RETRIES) {
          secondaryRetries += 1;
          const waitMs =
            err.retryAfter != null
              ? err.retryAfter * 1000
              : Math.min(
                  SECONDARY_MAX_WAIT_MS,
                  SECONDARY_BASE_MS * Math.pow(2, secondaryRetries - 1) + jitter()
                );
          await gate.delay(waitMs);
          continue;
        }
        throw err;
      }

      if (err.kind === 'server' && transientRetries < MAX_TRANSIENT_RETRIES) {
        transientRetries += 1;
        await gate.delay(TRANSIENT_BASE_MS * transientRetries + jitter(undefined, 250));
        continue;
      }

      // 401 / 403-forbidden / 404 / 400 / exhausted primary limit: fail fast.
      throw err;
    }
  }

  async function request(path, { signal, accept = 'application/vnd.github+json', method = 'GET' } = {}) {
    const headers = {
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const spec = { path, url: `${base}${path}`, method, headers, signal };
    // Only GETs are deduplicated; the queue itself applies to all methods.
    const key = method === 'GET' ? `GET ${spec.url}` : null;
    return gate.run(key, () => execute(spec));
  }

  return {
    request,
    hasToken: Boolean(token),

    /** @param {string} login */
    getUser(login, opts = {}) {
      return request(`/users/${encodeURIComponent(login)}`, opts);
    },

    /** @param {string} login */
    getRepos(login, { perPage = 100, sort = 'pushed' } = {}, opts = {}) {
      return request(
        `/users/${encodeURIComponent(login)}/repos?per_page=${perPage}&sort=${sort}&type=owner`,
        opts
      );
    },

    /** @param {string} owner @param {string} repo */
    getRepo(owner, repo, opts = {}) {
      return request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, opts);
    },

    /** Byte counts per language for one repository. */
    getLanguages(owner, repo, opts = {}) {
      return request(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`,
        opts
      );
    },

    /** Public events for a user (max 300 entries, roughly the last 90 days). */
    getPublicEvents(login, { perPage = 100, page = 1 } = {}, opts = {}) {
      return request(
        `/users/${encodeURIComponent(login)}/events/public?per_page=${perPage}&page=${page}`,
        opts
      );
    },

    /**
     * Search open issues.
     * @param {string} query
     */
    searchIssues(query, { perPage = 50, page = 1 } = {}, opts = {}) {
      const q = encodeURIComponent(query);
      return request(
        `/search/issues?q=${q}&per_page=${perPage}&page=${page}&sort=updated&order=desc`,
        opts
      );
    },

    /** GraphQL — only used for the exact contribution calendar. */
    async graphql(query, variables = {}, opts = {}) {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const spec = {
        path: '/graphql',
        url: `${base}/graphql`,
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
        signal: opts.signal,
      };

      const data = await gate.run(null, async () => {
        let res;
        let graphqlRetries = 0;
        for (;;) {
          res = await attempt(spec.url, spec);
          tracker.observe('graphql', res.headers);
          if (res.ok) break;
          const err = await errorFromResponse(res, spec);
          tracker.observe('graphql', res.headers);
          if (err.kind === 'rate-limit' && err.limitType === 'secondary' && graphqlRetries < MAX_SECONDARY_RETRIES) {
            graphqlRetries += 1;
            await gate.delay(err.retryAfter != null ? err.retryAfter * 1000 : SECONDARY_BASE_MS);
            continue;
          }
          // Never surface a successful-looking result after an error.
          throw err;
        }
        const body = await readBody(res);
        if (body?.errors?.length) {
          throw new GitHubError(body.errors[0].message || 'GitHub GraphQL error.', {});
        }
        return body?.data ?? null;
      });

      return data;
    },
  };
}

/* --- Shared status, for the UI's API panel (no secrets involved) --------- */

export function getGateStatus() {
  return defaultGate.status();
}

export function subscribeGateStatus(fn) {
  return defaultGate.subscribe(fn);
}

export function getRateLimitStatus() {
  return sharedTracker.snapshot();
}

export function subscribeRateLimit(fn) {
  return sharedTracker.subscribe(fn);
}

/** Pacing between requests, in the 500–1000 ms band by default. */
export function setGitHubPacing(ms) {
  defaultGate.setPacing(ms);
}

export { DEFAULT_PACING_MS };
