/**
 * Global GitHub API request gate.
 *
 * Every GitHub request in the app goes through ONE gate with ONE slot:
 *
 *   - No more than a single request is in flight at any moment.
 *   - The next request starts at least `pacingMs` after the previous start.
 *   - Identical in-flight GET requests are deduplicated: callers share one
 *     promise instead of causing a second request.
 *   - The queue is bounded: when it fills up callers get a QueueFullError
 *     with a readable message instead of silently growing forever.
 *   - Failures can never wedge the queue: every job settles (resolves or
 *     rejects) and the pump keeps going.
 *
 * Rate-limit pauses are expressed as `pauseUntil`: the pump simply waits and
 * re-checks, so later pauses that lengthen the window are honoured too.
 *
 * Tests create isolated gates (no shared state); the browser shares the
 * `defaultGate` singleton so pages and agents can never bypass the queue.
 */

export class QueueFullError extends Error {
  constructor(maxQueue) {
    super(
      `Too many GitHub requests are queued (${maxQueue}). Let the current step finish, then run another match.`
    );
    this.name = 'QueueFullError';
    this.status = 429;
    this.kind = 'queue-full';
    this.maxQueue = maxQueue;
  }
}

/**
 * @param {{
 *   pacingMs?: number,
 *   maxQueue?: number,
 *   pauseWakeMs?: number,
 *   now?: () => number,
 *   wait?: (ms: number) => Promise<void>,
 * }} [opts]
 */
export function createApiGate({
  pacingMs = 600,
  maxQueue = 32,
  pauseWakeMs = 5000,
  now = () => Date.now(),
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const queue = []; // FIFO: {key, fn, resolve, reject}
  const inflight = new Map(); // dedup key -> promise
  const listeners = new Set();
  let pacing = pacingMs;
  let pausedUntil = 0;
  let pauseReason = null;
  let active = false;
  let lastStart = 0;
  let pumper = null;

  function status() {
    const left = pausedUntil > now() ? pausedUntil - now() : 0;
    return {
      pending: queue.length,
      active,
      paused: left > 0,
      pausedUntilMsLeft: left > 0 ? left : null,
      pauseReason: left > 0 ? pauseReason : null,
      pacingMs: pacing,
      maxQueue,
    };
  }

  function emit() {
    const snap = status();
    for (const listener of listeners) {
      try {
        listener(snap);
      } catch {
        /* a broken listener must not break the queue */
      }
    }
  }

  async function pump() {
    if (pumper || !queue.length) return;
    pumper = true;
    try {
      for (;;) {
        const at = now();
        if (pausedUntil > at) {
          // Wake periodically so a shortened pause is honoured and the UI
          // can keep a countdown alive.
          await wait(Math.min(pausedUntil - at, pauseWakeMs));
          continue;
        }
        const sinceLast = at - lastStart;
        if (pacing > sinceLast) {
          await wait(pacing - sinceLast);
          continue;
        }
        const job = queue.shift();
        if (!job) break;
        active = true;
        emit();
        lastStart = now();
        try {
          job.resolve(await job.fn());
        } catch (err) {
          job.reject(err);
        } finally {
          active = false;
          emit();
        }
        if (!queue.length) break;
      }
    } finally {
      pumper = null;
      active = false;
      if (queue.length) pump();
      emit();
    }
  }

  return {
    /**
     * Run `fn` through the gate. When `key` is non-null and an identical
     * request is already queued or running, its promise is returned instead.
     * @param {string|null} key
     * @param {() => Promise<any>} fn
     */
    run(key, fn) {
      if (key) {
        const existing = inflight.get(key);
        if (existing) return existing;
      }
      if (queue.length >= maxQueue) throw new QueueFullError(maxQueue);
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
        queue.push({ key, fn, resolve, reject });
      });
      emit();
      pump();
      if (key) {
        inflight.set(key, promise);
        // Stored promise stays raw; the caller gets a wrapper that forgets
        // the key once settled so short-lived gaps do not re-combine.
        return promise.finally(() => {
          if (inflight.get(key) === promise) inflight.delete(key);
        });
      }
      return promise;
    },

    /** Wait helper shared with the client for retry back-off. */
    delay(ms) {
      return wait(Math.max(0, ms));
    },

    /** Fresh separation between two requests' starts. */
    setPacing(ms) {
      pacing = Math.max(0, Number(ms) || 0);
    },

    /** Pause starts of queued jobs until `untilMs`. Longer pauses win. */
    pauseUntil(untilMs, reason = null) {
      if (untilMs > pausedUntil) {
        pausedUntil = untilMs;
        pauseReason = reason;
        emit();
        pump();
      }
    },

    clearPause() {
      if (pausedUntil) {
        pausedUntil = 0;
        pauseReason = null;
        emit();
        pump();
      }
    },

    status,

    /** @param {(status: object) => void} fn @returns {() => void} unsubscribe */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Test/diagnostic helper: what is queued but not started. */
    debugQueue() {
      return queue.map((job) => ({ key: job.key }));
    },
  };
}

/** The one gate every browser-created client shares. */
export const defaultGate = createApiGate();
export const DEFAULT_PACING_MS = 600;
