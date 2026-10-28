/**
 * Settings.
 *
 * Two kinds of state:
 *
 *   - Preferences (provider choice, model name, mock mode) live in
 *     localStorage so the app remembers your setup.
 *   - Secrets (GitHub token, AI Studio key) live in sessionStorage only, so
 *     they disappear when the tab closes. They are never written to
 *     localStorage, never logged and never committed.
 */

const PREF_KEY = 'contribmatch:v1:settings';
const SECRET_KEY = 'contribmatch:v1:secrets';

export const DEFAULT_SETTINGS = {
  provider: 'ollama', // 'ollama' | 'google' | 'mock'
  model: 'gemma3:4b',
  endpoint: 'http://localhost:11434',
  theme: 'system', // 'system' | 'light' | 'dark'
  mockMode: false,
  useToken: false,
  // The interface language is owned by js/ui/i18n.js — it persists under its
  // own key so the core layer stays free of UI concerns.
};

export const SECRET_FIELDS = ['apiKey', 'token'];

function safeGet(store, key) {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(store, key, value) {
  try {
    if (value === null || value === undefined) store?.removeItem(key);
    else store?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/**
 * @param {{localStorage?: Storage, sessionStorage?: Storage}} [deps]
 */
export function createSettings(deps = {}) {
  const local = deps.localStorage ?? (() => {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  })();
  const session = deps.sessionStorage ?? (() => {
    try {
      return globalThis.sessionStorage;
    } catch {
      return null;
    }
  })();

  function loadPrefs() {
    const raw = safeGet(local, PREF_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function loadSecrets() {
    const raw = safeGet(session, SECRET_KEY);
    if (!raw) return { apiKey: '', token: '' };
    try {
      const parsed = JSON.parse(raw);
      return { apiKey: parsed.apiKey || '', token: parsed.token || '' };
    } catch {
      return { apiKey: '', token: '' };
    }
  }

  return {
    get() {
      return { ...loadPrefs(), ...loadSecrets() };
    },

    /**
     * @param {Partial<ReturnType<typeof loadPrefs> & {apiKey?: string, token?: string}>} patch
     */
    set(patch = {}) {
      const prefs = loadPrefs();
      const secrets = loadSecrets();
      const nextPrefs = { ...prefs };
      const nextSecrets = { ...secrets };

      for (const [key, value] of Object.entries(patch)) {
        if (SECRET_FIELDS.includes(key)) nextSecrets[key] = value || '';
        else nextPrefs[key] = value;
      }

      safeSet(local, PREF_KEY, JSON.stringify(nextPrefs));
      safeSet(session, SECRET_KEY, JSON.stringify(nextSecrets));
      return { ...nextPrefs, ...nextSecrets };
    },

    /** Forget the secrets but keep the preferences. */
    clearSecrets() {
      safeSet(session, SECRET_KEY, null);
    },

    /** True when a secret is present, without revealing it. */
    hasSecret(name) {
      return Boolean(loadSecrets()[name]);
    },
  };
}
