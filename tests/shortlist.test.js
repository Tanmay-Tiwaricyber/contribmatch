/**
 * The shortlist — local storage only.
 *
 * The shortlist never leaves the browser, so the only thing to test is that
 * it behaves: add, remove, toggle, and export as Markdown.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createShortlist } from '../js/core/shortlist.js';

/** A minimal in-memory Storage. */
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    get size() {
      return map.size;
    },
  };
}

const ISSUE = {
  id: 'octo/hello#7',
  number: 7,
  title: 'Fix the typo in the readme',
  repo: 'octo/hello',
  owner: 'octo',
  language: 'Markdown',
  labels: ['good first issue', 'docs'],
  htmlUrl: 'https://github.com/octo/hello/issues/7',
  score: 82,
};

test('a new shortlist is empty', () => {
  const list = createShortlist({ storage: memoryStorage() });
  assert.deepEqual(list.list(), []);
  assert.equal(list.has(ISSUE.id), false);
});

test('an issue can be added and read back', () => {
  const list = createShortlist({ storage: memoryStorage() });
  list.add(ISSUE);
  assert.equal(list.list().length, 1);
  assert.equal(list.has(ISSUE.id), true);
  assert.equal(list.list()[0].title, ISSUE.title);
  assert.equal(list.list()[0].score, 82);
});

test('the same issue is never added twice', () => {
  const list = createShortlist({ storage: memoryStorage() });
  list.add(ISSUE);
  list.add(ISSUE);
  assert.equal(list.list().length, 1);
});

test('an issue can be removed', () => {
  const list = createShortlist({ storage: memoryStorage() });
  list.add(ISSUE);
  list.remove(ISSUE.id);
  assert.equal(list.list().length, 0);
});

test('toggle adds then removes', () => {
  const list = createShortlist({ storage: memoryStorage() });
  const first = list.toggle(ISSUE);
  assert.equal(first.added, true);
  const second = list.toggle(ISSUE);
  assert.equal(second.added, false);
  assert.equal(list.list().length, 0);
});

test('the shortlist survives a reload because it is in storage', () => {
  const storage = memoryStorage();
  createShortlist({ storage }).add(ISSUE);
  const reopened = createShortlist({ storage });
  assert.equal(reopened.list().length, 1);
});

test('the export is a Markdown checklist', () => {
  const list = createShortlist({ storage: memoryStorage() });
  list.add(ISSUE);
  const markdown = list.toMarkdown();
  assert.match(markdown, /^# ContribMatch shortlist/m);
  assert.match(markdown, /- \[ \] \[Fix the typo in the readme\]\(https:\/\/github\.com\/octo\/hello\/issues\/7\)/);
  assert.match(markdown, /`good first issue`/);
  assert.match(markdown, /octo\/hello/);
});

test('an empty export says so', () => {
  const list = createShortlist({ storage: memoryStorage() });
  const markdown = list.toMarkdown();
  assert.match(markdown, /No issues saved yet/);
});

test('the export counts the issues with correct pluralisation', () => {
  const list = createShortlist({ storage: memoryStorage() });
  list.add(ISSUE);
  assert.match(list.toMarkdown(), /1 issue —/);
  list.add({ ...ISSUE, id: 'octo/hello#8' });
  assert.match(list.toMarkdown(), /2 issues —/);
});

test('corrupt storage does not break the shortlist', () => {
  const storage = memoryStorage();
  storage.setItem('contribmatch:v1:shortlist', '{not json');
  const list = createShortlist({ storage });
  assert.deepEqual(list.list(), []);
});

test('a stored value that is not an array is ignored', () => {
  const storage = memoryStorage();
  storage.setItem('contribmatch:v1:shortlist', '{"a":1}');
  assert.deepEqual(createShortlist({ storage }).list(), []);
});
