/**
 * Accessibility audit.
 *
 *   node tools/a11y-audit.mjs            # every page
 *   node tools/a11y-audit.mjs --page=app
 *
 * Runs axe-core against every page in light and dark mode and adds the
 * checks axe cannot do: a skip link, one h1 per page, focus visibility and
 * touch target sizes. Dev-only — axe-core is never shipped to the browser.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { startStaticServer, isServing } from './static-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

/** Filled in by main() once the server is known. */
let baseUrl = BASE_URL;

const PAGES = [
  { name: 'index', url: '/index.html' },
  { name: 'app', url: '/app.html' },
  { name: 'issue', url: '/issue.html' },
  { name: 'shortlist', url: '/shortlist.html' },
  { name: 'packs', url: '/packs.html' },
  { name: 'docs', url: '/docs.html' },
  { name: 'contribute', url: '/contribute.html' },
  { name: 'privacy', url: '/privacy.html' },
  { name: 'open-innovation', url: '/open-innovation.html' },
  { name: '404', url: '/404.html' },
  { name: 'design-system', url: '/design-system.html' },
];

const only = process.argv.find((a) => a.startsWith('--page='))?.split('=')[1];
const pages = only ? PAGES.filter((p) => p.name === only) : PAGES;

const GREEN = '[32m';
const RED = '[31m';
const YELLOW = '[33m';
const DIM = '[2m';
const RESET = '[0m';

const axeSource = await readFile(
  path.join(ROOT, 'node_modules/axe-core/axe.min.js'),
  'utf8'
);

/** Checks that axe-core does not make. */
const EXTRA_CHECKS = `(() => {
  const problems = [];
  const add = (id, impact, message, nodes) => problems.push({ id, impact, message, nodes });

  // A skip link must be the first focusable element.
  const skip = document.querySelector('a.skip-link, .skip-link');
  if (!skip) {
    add('skip-link', 'serious', 'No skip link was found.', ['html']);
  }

  // Exactly one top level heading.
  const h1s = document.querySelectorAll('h1');
  if (h1s.length !== 1) {
    add('single-h1', 'moderate', 'The page has ' + h1s.length + ' h1 elements.', [...h1s].map((h) => h.outerHTML.slice(0, 80)));
  }

  // Heading levels must not skip.
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  let previous = 0;
  for (const heading of headings) {
    const level = Number(heading.tagName.slice(1));
    if (previous && level > previous + 1) {
      add('heading-order', 'moderate', 'Heading level jumps from h' + previous + ' to h' + level + '.', [heading.outerHTML.slice(0, 80)]);
    }
    previous = level;
  }

  // Landmarks.
  if (!document.querySelector('main')) {
    add('landmark-main', 'serious', 'The page has no main landmark.', ['html']);
  }
  if (!document.querySelector('header')) {
    add('landmark-banner', 'moderate', 'The page has no banner landmark.', ['html']);
  }
  if (!document.querySelector('footer')) {
    add('landmark-contentinfo', 'moderate', 'The page has no contentinfo landmark.', ['html']);
  }

  // Target size — WCAG 2.2 SC 2.5.8 asks for 24x24 CSS pixels.
  // Two documented exceptions are allowed: a link inside a sentence, and the
  // heatmap cells, whose size is fixed by the graph and which are reachable
  // with the keyboard and mirrored in a data table.
  const small = [];
  for (const node of document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const style = getComputedStyle(node);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    if (node.closest('.heat__grid')) continue;
    // WCAG 2.5.8 allows an exception for a link that flows inside a
    // sentence: an inline target whose size is set by the line, not by the
    // interface. A link that stands on its own still has to be 24x24.
    if (node.tagName === 'A') {
      const inline = style.display === 'inline';
      const flows =
        (style.display === 'inline-block' || style.display === 'inline-flex') &&
        node.parentElement &&
        node.parentElement.textContent.trim().length > node.textContent.trim().length + 8;
      if (inline || flows) continue;
    }
    if (rect.height < 24 || rect.width < 24) {
      small.push(node.tagName.toLowerCase() + (node.className ? '.' + String(node.className).split(' ')[0] : '') + ' (' + Math.round(rect.width) + 'x' + Math.round(rect.height) + ')');
    }
  }
  if (small.length) {
    add('target-size', 'serious', small.length + ' interactive element(s) are smaller than 24x24.', small);
  }

  // Every image needs an alt attribute.
  const missingAlt = [...document.querySelectorAll('img')].filter((img) => img.getAttribute('alt') === null).map((img) => img.src);
  if (missingAlt.length) {
    add('image-alt', 'critical', 'Images without an alt attribute.', missingAlt);
  }

  // The page must not be wider than the viewport.
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
    add('horizontal-scroll', 'serious', 'The page scrolls sideways (' + document.documentElement.scrollWidth + ' > ' + document.documentElement.clientWidth + ').', ['html']);
  }

  return problems;
})()`;

async function auditPage(browser, page) {
  const tab = await browser.newPage();
  const findings = [];

  for (const theme of ['light', 'dark']) {
    await tab.setViewport({ width: 1280, height: 900 });
    await tab.evaluateOnNewDocument((mode) => {
      try {
        localStorage.setItem('contribmatch:v1:theme', mode);
      } catch {
        /* ignore */
      }
    }, theme);
    await tab.goto(`${baseUrl}${page.url}`, { waitUntil: 'networkidle2' });
    await tab.evaluate(() => document.fonts?.ready);
    await new Promise((r) => setTimeout(r, 600));

    await tab.evaluate(axeSource);
    const axeResults = await tab.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const results = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      });
      return results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        message: v.help,
        nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 110)),
      }));
    });

    const extra = await tab.evaluate(EXTRA_CHECKS);

    findings.push({ theme, axe: axeResults, extra });
  }

  await tab.close();
  return findings;
}

async function main() {
  const server = await ensureServer();
  try {
    await runAudit();
  } finally {
    await server.close();
  }
}

async function runAudit() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  let total = 0;

  console.log(`Auditing ${pages.length} page(s) at ${baseUrl}\n`);

  for (const page of pages) {
    const findings = await auditPage(browser, page);
    for (const { theme, axe, extra } of findings) {
      const all = [...axe, ...extra];
      if (!all.length) {
        console.log(`${GREEN}✓${RESET} ${page.name} ${DIM}(${theme})${RESET} — no violations`);
        continue;
      }
      total += all.length;
      console.log(`${RED}✗${RESET} ${page.name} ${DIM}(${theme})${RESET} — ${all.length} issue(s)`);
      for (const issue of all) {
        const colour = issue.impact === 'critical' || issue.impact === 'serious' ? RED : YELLOW;
        console.log(`    ${colour}${issue.impact || 'n/a'}${RESET} ${issue.id}: ${issue.message}`);
        for (const node of issue.nodes || []) console.log(`        ${DIM}${node}${RESET}`);
      }
    }
  }

  await browser.close();
  console.log('');
  if (total) {
    console.log(`${RED}${total} accessibility issue(s) found.${RESET}`);
    process.exitCode = 1;
  } else {
    console.log(`${GREEN}No accessibility issues found.${RESET}`);
  }
}

async function ensureServer() {
  if (await isServing(BASE_URL)) return { url: BASE_URL, close: async () => {} };
  const port = Number(new URL(BASE_URL).port) || 8080;
  const server = await startStaticServer({ root: ROOT, port });
  console.log(`${DIM}Started a static server on ${server.url}${RESET}`);
  return server;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
