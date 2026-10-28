/**
 * Browser smoke tests.
 *
 * These are the tests that catch the bugs the unit tests cannot see: a
 * variable that is used but never declared, a module that throws on import,
 * a page that renders an empty shell. They need a real browser, so they
 * skip themselves when one is not available rather than failing the suite.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let browser = null;
let server = null;
let puppeteer = null;

before(async () => {
  try {
    puppeteer = (await import('puppeteer')).default;
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  } catch {
    browser = null;
    return;
  }
  const { startStaticServer } = await import('../tools/static-server.mjs');
  server = await startStaticServer({ root: ROOT, port: 0 });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await server.close();
});

/** @param {string} url */
async function openPage(url) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err.message || err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) {
      errors.push(msg.text());
    }
  });
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${server.url}${url}`, { waitUntil: 'networkidle2' });
  return { page, errors };
}

test('the home page renders the hero, the scene and the activity panel', async (t) => {
  if (!browser) return t.skip('no browser available');
  const { page, errors } = await openPage('/index.html');
  await new Promise((r) => setTimeout(r, 1200));

  const state = await page.evaluate(() => ({
    title: document.querySelector('.hero__title')?.textContent?.trim(),
    sceneCells: document.querySelectorAll('.scene__cell').length,
    panels: document.querySelectorAll('.scene__panel').length,
    heatCells: document.querySelectorAll('.heat__cell').length,
    marquee: document.querySelectorAll('.marquee__item').length,
    hasRawMarkup: /<em class=/.test(document.body.innerText),
  }));

  assert.match(state.title || '', /Find an issue/);
  assert.ok(state.sceneCells > 50, `the 3D wall should have cells, found ${state.sceneCells}`);
  assert.equal(state.panels, 3, 'the scene should have three floating panels');
  assert.ok(state.heatCells > 20, `the heatmap should have cells, found ${state.heatCells}`);
  assert.ok(state.marquee > 0, 'the marquee band should have items');
  assert.ok(!state.hasRawMarkup, 'no page should show raw markup as text');

  assert.deepEqual(errors, []);
  await page.close();
});

test('the matcher runs end to end in mock mode', async (t) => {
  if (!browser) return t.skip('no browser available');
  const { page, errors } = await openPage('/app.html');

  await page.evaluate(() => {
    localStorage.setItem(
      'contribmatch:v1:settings',
      JSON.stringify({ mockMode: true, provider: 'mock', useToken: false, theme: 'light', language: 'en' })
    );
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));

  await page.type('#matcher-username', 'octocat');
  await page.click('#run-button');
  await new Promise((r) => setTimeout(r, 4000));

  const state = await page.evaluate(() => ({
    matches: document.querySelectorAll('#results .match').length,
    rings: document.querySelectorAll('#results .score__value').length,
    bands: Array.from(document.querySelectorAll('#results .score__value')).map((n) => n.dataset.band),
    steps: (document.querySelector('.steps') || {}).innerText || '',
  }));

  assert.ok(state.matches > 0, 'the matcher should return matches in mock mode');
  assert.equal(state.rings, state.matches, 'every match should have a score ring');
  for (const band of state.bands) {
    assert.ok(['low', 'mid', 'high'].includes(band), `unexpected score band: ${band}`);
  }
  assert.ok(state.steps.length > 0, 'the steps panel should report the run');

  assert.deepEqual(errors, []);
  await page.close();
});

test('a coached issue shows the plan, the comment and the checklist', async (t) => {
  if (!browser) return t.skip('no browser available');
  const { page, errors } = await openPage('/app.html');

  await page.evaluate(() => {
    localStorage.setItem(
      'contribmatch:v1:settings',
      JSON.stringify({ mockMode: true, provider: 'mock', useToken: false, theme: 'light', language: 'en' })
    );
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  await page.type('#matcher-username', 'octocat');
  await page.click('#run-button');
  await new Promise((r) => setTimeout(r, 4000));

  const href = await page.evaluate(
    () => document.querySelector('#results a[href*="issue.html"]')?.getAttribute('href') || ''
  );
  assert.ok(href, 'the matcher should link to the issue page');

  const { page: issuePage, errors: issueErrors } = await openPage(new URL(href, server.url).pathname + new URL(href, server.url).search);
  await new Promise((r) => setTimeout(r, 2500));

  const state = await issuePage.evaluate(() => ({
    title: document.querySelector('#issue-title')?.textContent?.trim(),
    lede: document.querySelector('#issue-lede')?.textContent?.trim(),
    cards: Array.from(document.querySelectorAll('#issue-content .card__title')).map((n) =>
      n.textContent.trim()
    ),
    comment: (document.querySelector('#issue-content .code pre') || {}).textContent || '',
    checklist: document.querySelectorAll('#issue-content input[type="checkbox"]').length,
    hasRawMarkup: /<em class=/.test(document.body.innerText),
  }));

  assert.match(state.title || '', /Your plan/);
  assert.ok(state.lede && state.lede.length > 20, 'the lede should be translated, not a key');
  for (const expected of [
    'What this issue is asking',
    'Likely files',
    'Step-by-step plan',
    'Comment you can post',
    'Pull request checklist',
  ]) {
    assert.ok(state.cards.includes(expected), `the issue page is missing "${expected}"`);
  }
  assert.ok(state.comment.length > 40, 'the drafted comment should have content');
  assert.ok(state.checklist > 0, 'the pull request checklist should have items');
  assert.ok(!state.hasRawMarkup, 'no page should show raw markup as text');

  assert.deepEqual(errors, []);
  assert.deepEqual(issueErrors, []);
  await issuePage.close();
  await page.close();
});

test('the packs page opens the source of a pack in a dialog', async (t) => {
  if (!browser) return t.skip('no browser available');
  const { page, errors } = await openPage('/packs.html');
  await new Promise((r) => setTimeout(r, 1200));

  const buttons = await page.$$('#packs-list button');
  assert.ok(buttons.length > 0, 'the packs page should list the packs');

  await buttons[0].click();
  await new Promise((r) => setTimeout(r, 600));

  const state = await page.evaluate(() => ({
    open: !!document.querySelector('.modal__dialog'),
    role: document.querySelector('.modal__dialog')?.getAttribute('role'),
    modal: document.querySelector('.modal__dialog')?.getAttribute('aria-modal'),
    focusInside: !!document.querySelector('.modal__dialog')?.contains(document.activeElement),
    source: (document.querySelector('.modal__body pre') || {}).textContent || '',
  }));

  assert.ok(state.open, 'the dialog should open');
  assert.equal(state.role, 'dialog');
  assert.equal(state.modal, 'true');
  assert.ok(state.focusInside, 'focus should move into the dialog');
  assert.ok(state.source.includes('"id"'), 'the dialog should show the raw pack file');

  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 400));
  const closed = await page.evaluate(() => !document.querySelector('.modal__dialog'));
  assert.ok(closed, 'Escape should close the dialog');

  assert.deepEqual(errors, []);
  await page.close();
});

test('every page has one h1, a skip link and a main landmark', async (t) => {
  if (!browser) return t.skip('no browser available');
  const pages = [
    '/index.html',
    '/app.html',
    '/issue.html',
    '/shortlist.html',
    '/packs.html',
    '/docs.html',
    '/contribute.html',
    '/privacy.html',
    '/open-innovation.html',
    '/404.html',
    '/design-system.html',
  ];

  for (const url of pages) {
    const { page, errors } = await openPage(url);
    await new Promise((r) => setTimeout(r, 500));
    const state = await page.evaluate(() => ({
      h1: document.querySelectorAll('h1').length,
      main: document.querySelectorAll('main').length,
      skip: !!document.querySelector('a.skip-link'),
      header: !!document.querySelector('header'),
      footer: !!document.querySelector('footer'),
    }));

    assert.equal(state.h1, 1, `${url} should have exactly one h1`);
    assert.equal(state.main, 1, `${url} should have exactly one main landmark`);
    assert.ok(state.skip, `${url} should have a skip link`);
    assert.ok(state.header, `${url} should have a banner`);
    assert.ok(state.footer, `${url} should have a contentinfo`);
    assert.deepEqual(errors, [], `${url} logged errors`);

    await page.close();
  }
});
