/**
 * GitHub rate-limit tracking and classification.
 *
 * GitHub meters three separate buckets that the app touches:
 *
 *   core     — REST calls (users, repos, languages, events)   60/h anonymous, 5,000/h with a token
 *   search   — /search/* REST calls                            10/min anonymous, 30/min with a token
 *   graphql  — POST /graphql (contribution calendar)        5,000 points/h, separate from REST
 *
 * The tracker watches response headers on every request; nothing here makes
 * extra network calls or logs the token.
 */

export const GITHUB_BUCKETS = { CORE: 'core', SEARCH: 'search', GRAPHQL: 'graphql' };

/**
 * Which rate-limit bucket a request path belongs to.
 * @param {string} path
 */
export function bucketForPath(path) {
  if (path === '/graphql') return GITHUB_BUCKETS.GRAPHQL;
  if (path.startsWith('/search/')) return GITHUB_BUCKETS.SEARCH;
  return GITHUB_BUCKETS.CORE;
}

/** @param {object} headersLike object exposing `.get(name)` */
function num(headersLike, name) {
  try {
    const raw = headersLike?.get?.(name);
    return raw == null ? null : Number(raw);
  } catch {
    return null;
  }
}

export function createRateLimitTracker() {
  const buckets = {};
  const listeners = new Set();

  return {
    /**
     * Record rate-limit headers from a response.
     * @param {string} bucket 'core' | 'search' | 'graphql'
     * @param {object} headersLike
     */
    observe(bucket, headersLike) {
      const limit = num(headersLike, 'x-ratelimit-limit');
      const remaining = num(headersLike, 'x-ratelimit-remaining');
      const resetSec = num(headersLike, 'x-ratelimit-reset');
      if (limit == null && remaining == null && resetSec == null) return false;
      const next = {
        bucket,
        limit: limit ?? null,
        remaining: remaining ?? null,
        reset: resetSec != null ? resetSec * 1000 : null, // ms epoch
        updatedAt: Date.now(),
      };
      if (
        !buckets[bucket] ||
        buckets[bucket].remaining !== next.remaining ||
        buckets[bucket].reset !== next.reset ||
        buckets[bucket].limit !== next.limit
      ) {
        buckets[bucket] = next;
        const snap = this.snapshot();
        for (const listener of listeners) {
          try {
            listener(snap);
          } catch {
            /* ignore broken listeners */
          }
        }
      }
      return true;
    },

    /** @returns {Record<string, object>} copy of per-bucket state */
    snapshot() {
      return { ...buckets };
    },

    /** @returns {() => void} unsubscribe */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** The tracker shared by the default gate's clients in the browser. */
export const sharedTracker = createRateLimitTracker();

/**
 * Decide what a 403/429 actually means. GitHub returns 403 for both "quota
 * exhausted" and plain permission errors, so the body message is checked too.
 *
 * @param {number} status
 * @param {object} headersLike
 * @param {object|null} [body] parsed JSON body when available
 * @returns {{type: 'primary'|'secondary'|'forbidden'|'none', resetAt: number|null, retryAfterMs: number|null}}
 */
export function classifyLimit(status, headersLike, body = null) {
  const remaining = num(headersLike, 'x-ratelimit-remaining');
  const resetSec = num(headersLike, 'x-ratelimit-reset');
  let retryAfterMs = null;
  const retryAfterRaw = headersLike?.get?.('retry-after');
  if (retryAfterRaw != null) {
    const secs = Number(retryAfterRaw);
    if (Number.isFinite(secs) && secs >= 0) retryAfterMs = secs * 1000;
  }
  const resetAt = resetSec != null ? resetSec * 1000 : null;
  const message = String(body?.message || '').toLowerCase();

  if (status === 429) {
    // 429 is always a limit; remaining === 0 says which meter ran out.
    return { type: remaining === 0 ? 'primary' : 'secondary', resetAt, retryAfterMs };
  }
  if (status !== 403) return { type: 'none', resetAt, retryAfterMs };
  if (remaining === 0) return { type: 'primary', resetAt, retryAfterMs };
  if (message.includes('secondary rate limit')) return { type: 'secondary', resetAt, retryAfterMs };
  if (message.includes('rate limit') || message.includes('abuse')) {
    return { type: 'primary', resetAt: resetAt ?? retryAfterMs, retryAfterMs };
  }
  // e.g. "Resource not accessible by personal access token" — a permission
  // problem, not throttling.
  return { type: 'forbidden', resetAt, retryAfterMs };
}

/** Transient server errors worth one more try. */
export function isTransientStatus(status) {
  return status === 500 || status === 502 || status === 503 || status === 504;
}
