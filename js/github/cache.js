/**
 * Tiny TTL cache on localStorage.
 *
 * Used for GitHub responses so a page reload does not burn the rate limit.
 * Nothing sensitive is cached: only public GitHub data and the user's own
 * shortlist. Tokens are never written here.
 */

const PREFIX = 'contribmatch:v1:';

/**
 * First-level in-memory cache, shared by every default instance in the page.
 * Instances given an explicit `storage` (tests) stay isolated from it.
 */
const SESSION_MEMORY = new Map();

/** @param {Storage|null} store */
function safeStore(store) {
  if (store) return store;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

/**
 * @param {{storage?: Storage, now?: () => number, ttlMs?: number}} [opts]
 */
export function createCache({ storage, now = () => Date.now(), ttlMs = 5 * 60 * 1000 } = {}) {
  const store = safeStore(storage);
  const memory = storage ? null : SESSION_MEMORY;
  const clock = () => now();

  function readMemory(key) {
    if (!memory) return null;
    const entry = memory.get(key);
    if (!entry) return null;
    if (entry.expires < clock()) return { ...entry, expired: true };
    return entry;
  }

  return {
    /**
     * @param {string} key
     * @returns {any|null}
     */
    get(key) {
      const fromMemory = readMemory(key);
      if (fromMemory && !fromMemory.expired) return fromMemory.value;
      if (!store) return null;
      try {
        const raw = store.getItem(PREFIX + key);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (!entry || typeof entry.expires !== 'number') return null;
        if (entry.expires < now()) return null;
        if (memory) memory.set(key, entry); // warm the session layer
        return entry.value;
      } catch {
        return null;
      }
    },

    /**
     * A stale copy: the entry exists but has expired. Used as a fallback when
     * GitHub cannot be reached — callers must flag the result as stale.
     * @param {string} key
     * @returns {any|null}
     */
    stale(key) {
      const fromMemory = readMemory(key);
      if (fromMemory) return fromMemory.value;
      if (!store) return null;
      try {
        const raw = store.getItem(PREFIX + key);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (!entry || typeof entry.value === 'undefined') return null;
        return entry.value;
      } catch {
        return null;
      }
    },

    /**
     * Invalidate every entry whose key starts with `prefix`.
     * @param {string} [prefix] empty string clears every GitHub cache entry
     * @returns {number} entries removed
     */
    invalidate(prefix = '') {
      let removed = 0;
      if (memory) {
        for (const key of Array.from(memory.keys())) {
          if (key.startsWith(prefix)) {
            memory.delete(key);
            removed += 1;
          }
        }
      }
      if (!store) return removed;
      const keys = [];
      try {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && k.startsWith(PREFIX) && k.slice(PREFIX.length).startsWith(prefix)) {
            keys.push(k);
          }
        }
      } catch {
        return removed;
      }
      keys.forEach((k) => {
        try {
          store.removeItem(k);
          removed += 1;
        } catch {
          /* ignore */
        }
      });
      return removed;
    },

    /** Count of cached entries, for a debugging panel (no values exposed). */
    stats() {
      let entries = memory ? memory.size : 0;
      let staleCount = 0;
      if (memory) {
        for (const entry of memory.values()) {
          if (entry.expires < clock()) staleCount += 1;
        }
      }
      if (!store) return { entries, stale: staleCount };
      try {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (!k || !k.startsWith(PREFIX)) continue;
          entries += 1;
          try {
            const entry = JSON.parse(store.getItem(k));
            if (!entry || typeof entry.expires !== 'number' || entry.expires < now()) staleCount += 1;
          } catch {
            staleCount += 1;
          }
        }
      } catch {
        /* ignore */
      }
      return { entries, stale: staleCount };
    },

    /**
     * @param {string} key
     * @param {any} value
     * @param {number} [ttl]
     */
    set(key, value, ttl = ttlMs) {
      const entry = { value, expires: now() + ttl };
      if (memory) memory.set(key, entry);
      if (!store) return true;
      try {
        store.setItem(PREFIX + key, JSON.stringify(entry));
        return true;
      } catch {
        return false;
      }
    },

    remove(key) {
      if (memory) memory.delete(key);
      if (!store) return;
      try {
        store.removeItem(PREFIX + key);
      } catch {
        /* ignore */
      }
    },

    /** Remove every ContribMatch entry (used by the "clear data" action). */
    clearAll() {
      if (memory) memory.clear();
      if (!store) return;
      try {
        const keys = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && k.startsWith(PREFIX)) keys.push(k);
        }
        keys.forEach((k) => store.removeItem(k));
      } catch {
        /* ignore */
      }
    },
  };
}

export const CACHE_PREFIX = PREFIX;
