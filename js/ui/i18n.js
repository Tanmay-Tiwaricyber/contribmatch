/**
 * Interface language.
 *
 * English, Hindi and Hinglish. The chosen language is remembered in
 * localStorage; it is not sent anywhere.
 *
 * Markup hooks:
 *   <span data-i18n="nav.home"></span>
 *   <input data-i18n-attr="placeholder:hero.inputPlaceholder">
 *   <p data-i18n-html="hero.title"></p>   (dictionary values only, never user text)
 */

import en from '../i18n/en.js';
import hi from '../i18n/hi.js';
import hinglish from '../i18n/hinglish.js';

export const LANGUAGES = {
  en: { code: 'en', label: 'English', htmlLang: 'en', dict: en },
  hi: { code: 'hi', label: 'हिन्दी', htmlLang: 'hi', dict: hi },
  hinglish: { code: 'hinglish', label: 'Hinglish', htmlLang: 'en-Latn', dict: hinglish },
};

const KEY = 'contribmatch:v1:lang';
let current = 'en';

function read() {
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    if (stored && LANGUAGES[stored]) return stored;
  } catch {
    /* ignore */
  }
  return 'en';
}

function persist(code) {
  try {
    globalThis.localStorage?.setItem(KEY, code);
  } catch {
    /* ignore */
  }
}

/** Current language code. */
export function getLanguage() {
  return current;
}

/** The dictionary for a language (defaults to the current one). */
export function dict(code = current) {
  return (LANGUAGES[code] || LANGUAGES.en).dict;
}

/**
 * Translate a key.
 * @param {string} key
 * @param {Record<string, string|number>} [vars] values for {placeholders}
 */
export function t(key, vars = {}) {
  const table = dict();
  let value = table[key];
  if (value === undefined) value = en[key];
  if (value === undefined) return key;
  return String(value).replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] === undefined ? match : String(vars[name])
  );
}

/**
 * Apply translations to a subtree.
 * @param {ParentNode} [root]
 */
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    node.textContent = t(key);
  });

  root.querySelectorAll('[data-i18n-html]').forEach((node) => {
    const key = node.getAttribute('data-i18n-html');
    const value = dict()[key] ?? en[key];
    if (value === undefined) return;
    // Dictionary values only — they are authored here, never user supplied.
    node.innerHTML = String(value);
  });

  root.querySelectorAll('[data-i18n-attr]').forEach((node) => {
    const spec = node.getAttribute('data-i18n-attr');
    for (const pair of spec.split(',')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (!attr || !key) continue;
      node.setAttribute(attr, t(key));
    }
  });
}

/**
 * Set the interface language.
 * @param {'en'|'hi'|'hinglish'} code
 */
export function setLanguage(code) {
  if (!LANGUAGES[code]) return current;
  current = code;
  persist(code);
  document.documentElement.lang = LANGUAGES[code].htmlLang;
  document.documentElement.setAttribute('data-lang', code);
  applyTranslations(document);
  document.dispatchEvent(new CustomEvent('languagechange', { detail: { code } }));
  return current;
}

/** Initialise from storage. Call once per page, as early as possible. */
export function initLanguage() {
  current = read();
  document.documentElement.lang = LANGUAGES[current].htmlLang;
  document.documentElement.setAttribute('data-lang', current);
  applyTranslations(document);
  return current;
}
