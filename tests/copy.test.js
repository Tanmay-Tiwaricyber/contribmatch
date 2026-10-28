/**
 * Copy and i18n rules.
 *
 * These are not style preferences. The banned words are a hard rule from the
 * brief, the serif phrase is what gives every heading its one moment of
 * emphasis, and the three dictionaries have to stay mirrored or the Hindi
 * build silently falls back to English.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N_DIR = path.join(ROOT, 'js', 'i18n');

const BANNED = ['revolutionize', 'supercharge', 'seamless', 'unlock'];

/** Read the key/value pairs out of a dictionary module without running it. */
async function readDictionary(file) {
  const source = await readFile(path.join(I18N_DIR, file), 'utf8');
  const entries = new Map();
  const pattern = /'([\w.]+)':\s*'((?:[^'\\]|\\.)*)'/g;
  let match = pattern.exec(source);
  while (match) {
    if (!entries.has(match[1])) entries.set(match[1], match[2]);
    match = pattern.exec(source);
  }
  return { source, entries };
}

const FILES = ['en.js', 'hi.js', 'hinglish.js'];

test('the banned words appear nowhere in the dictionaries', async () => {
  for (const file of FILES) {
    const { source } = await readDictionary(file);
    const lower = source.toLowerCase();
    for (const word of BANNED) {
      assert.ok(
        !lower.includes(word),
        `"${word}" appears in ${file}. Banned copy words: ${BANNED.join(', ')}.`
      );
    }
  }
});

test('the banned words appear nowhere in the page copy', async () => {
  const pages = (await readdir(ROOT)).filter((f) => f.endsWith('.html'));
  for (const page of pages) {
    const source = (await readFile(path.join(ROOT, page), 'utf8')).toLowerCase();
    // The contributing guide lists the banned words so contributors know them.
    // That list is not usage of them.
    const lines = source.split('\n').filter((line) => !line.includes('banned words'));
    const body = lines.join('\n');
    for (const word of BANNED) {
      assert.ok(!body.includes(word), `"${word}" appears in ${page}.`);
    }
  }
});

test('every dictionary has the same keys', async () => {
  const en = await readDictionary('en.js');
  for (const file of FILES.filter((f) => f !== 'en.js')) {
    const other = await readDictionary(file);
    const missing = [...en.entries.keys()].filter((key) => !other.entries.has(key));
    assert.deepEqual(missing, [], `${file} is missing: ${missing.join(', ')}`);
    const extra = [...other.entries.keys()].filter((key) => !en.entries.has(key));
    assert.deepEqual(extra, [], `${file} has keys English does not: ${extra.join(', ')}`);
  }
});

/**
 * The page and section headings. Each one gets exactly one italic phrase,
 * which is the single moment of emphasis in the heading.
 */
const SECTION_TITLES = [
  'hero.title',
  'how.title',
  'features.title',
  'open.title',
  'packs.title',
  'faq.title',
  'cta.title',
  'app.title',
  'issue.title',
  'shortlist.title',
  'packsPage.title',
  'docs.title',
  'contribute.title',
  'privacy.title',
  'notFound.title',
  'design.title',
];

test('every section heading carries exactly one serif phrase', async () => {
  for (const file of FILES) {
    const { entries } = await readDictionary(file);
    for (const key of SECTION_TITLES) {
      const value = entries.get(key);
      assert.ok(value !== undefined, `${file} is missing "${key}".`);
      const matches = value.match(/<em class="serif">/g) || [];
      assert.equal(
        matches.length,
        1,
        `${file} "${key}" should have exactly one <em class="serif"> phrase, found ${matches.length}.`
      );
    }
  }
});

test('no string carries more than one serif phrase', async () => {
  for (const file of FILES) {
    const { entries } = await readDictionary(file);
    for (const [key, value] of entries) {
      const matches = value.match(/<em class="serif">/g) || [];
      assert.ok(
        matches.length <= 1,
        `${file} "${key}" has ${matches.length} serif phrases. One is the limit.`
      );
    }
  }
});

test('every key used in the page markup exists in every dictionary', async () => {
  const dicts = {};
  for (const file of FILES) {
    const { entries } = await readDictionary(file);
    dicts[file] = new Set(entries.keys());
  }
  const pages = (await readdir(ROOT)).filter((f) => f.endsWith('.html'));
  for (const page of pages) {
    const source = await readFile(path.join(ROOT, page), 'utf8');
    const keys = source.match(/data-i18n(?:-html)?="([^"]+)"/g) || [];
    for (const raw of keys) {
      const key = raw.match(/"([^"]+)"/)[1];
      for (const file of FILES) {
        assert.ok(
          dicts[file].has(key),
          `${page} uses "${key}", which is missing from ${file}.`
        );
      }
    }
  }
});

test('markup in a string is applied as HTML, never as text', async () => {
  const { entries } = await readDictionary('en.js');
  const markup = new Set(
    [...entries.entries()].filter(([, value]) => value.includes('<')).map(([key]) => key)
  );
  const pages = (await readdir(ROOT)).filter((f) => f.endsWith('.html'));
  for (const page of pages) {
    const source = await readFile(path.join(ROOT, page), 'utf8');
    for (const m of source.matchAll(/data-i18n="([^"]+)"/g)) {
      assert.ok(
        !markup.has(m[1]),
        `${page} uses data-i18n for "${m[1]}", which contains markup. It needs data-i18n-html.`
      );
    }
  }
});

test('the accent colour is the one the brief locked', async () => {
  const tokens = await readFile(path.join(ROOT, 'css', 'tokens.css'), 'utf8');
  assert.match(tokens, /--accent:\s*#2d81ff;/, 'The accent colour must stay #2d81ff.');
});

test('there are no gradients anywhere in the stylesheets', async () => {
  const cssDir = path.join(ROOT, 'css');
  const files = (await readdir(cssDir)).filter((f) => f.endsWith('.css'));
  for (const file of files) {
    const source = await readFile(path.join(cssDir, file), 'utf8');
    assert.ok(
      !/linear-gradient|radial-gradient|conic-gradient/i.test(source),
      `${file} contains a gradient. Depth comes from perspective, flat fills and hard shadows.`
    );
  }
});

test('every radius token is zero', async () => {
  const tokens = await readFile(path.join(ROOT, 'css', 'tokens.css'), 'utf8');
  const radii = [...tokens.matchAll(/--r-[\w-]+:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(radii.length > 0, 'No radius tokens found.');
  for (const value of radii) {
    assert.equal(value, '0', `Radius tokens must be 0, found ${value}.`);
  }
});
