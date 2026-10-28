/**
 * Theme.
 *
 * Three states: system, light, dark. The resolved theme is written to
 * `data-theme` on <html> so CSS can react. The choice is remembered in
 * localStorage.
 */

const KEY = 'contribmatch:v1:theme';
const MODES = ['system', 'light', 'dark'];

let mode = 'system';
const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');

function read() {
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    if (stored && MODES.includes(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'system';
}

function persist() {
  try {
    globalThis.localStorage?.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
}

/** The mode the user chose: system, light or dark. */
export function getThemeMode() {
  return mode;
}

/** The theme that is actually in effect: light or dark. */
export function resolvedTheme() {
  if (mode === 'system') {
    return media?.matches ? 'dark' : 'light';
  }
  return mode;
}

function apply() {
  const resolved = resolvedTheme();
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute('data-theme-mode', mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#101216' : '#faf8f4');
  }
  document.dispatchEvent(new CustomEvent('themechange', { detail: { mode, resolved } }));
}

/**
 * Set the theme mode.
 * @param {'system'|'light'|'dark'} next
 */
export function setTheme(next) {
  if (!MODES.includes(next)) return mode;
  mode = next;
  persist();
  apply();
  return mode;
}

/** Flip between light and dark, leaving system mode behind. */
export function toggleTheme() {
  const next = resolvedTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Initialise. */
export function initTheme() {
  mode = read();
  apply();
  media?.addEventListener?.('change', () => {
    if (mode === 'system') apply();
  });
  return mode;
}
