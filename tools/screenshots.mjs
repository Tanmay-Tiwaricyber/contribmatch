#!/usr/bin/env node
/**
 * Dev-only screenshot and console-error harness.
 *
 *   node tools/screenshots.mjs            # every page, every breakpoint
 *   node tools/screenshots.mjs --quick    # 360 and 1280 only
 *   node tools/screenshots.mjs --page=app # one page
 *
 * Screenshots land in docs/screenshots/. Console errors and page errors are
 * printed, so a broken page cannot pass silently.
 */
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { startStaticServer, isServing } from './static-server.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'docs/screenshots');
const BASE = process.env.BASE_URL || 'http://localhost:8080';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const only = args.find((a) => a.startsWith('--page='))?.split('=')[1];

const PAGES = [
  { name: 'index', url: '/index.html' },
  { name: 'app', url: '/app.html?user=octocat' },
  { name: 'issue', url: '/issue.html' },
  { name: 'shortlist', url: '/shortlist.html' },
  { name: 'packs', url: '/packs.html' },
  { name: 'docs', url: '/docs.html' },
  { name: 'open-innovation', url: '/open-innovation.html' },
  { name: 'contribute', url: '/contribute.html' },
  { name: 'privacy', url: '/privacy.html' },
  { name: '404', url: '/404.html' },
  { name: 'design-system', url: '/design-system.html' },
];

const VIEWPORTS = quick
  ? [
      { name: '360', width: 360, height: 740, dsf: 2 },
      { name: '1280', width: 1280, height: 900, dsf: 1 },
    ]
  : [
      { name: '360', width: 360, height: 740, dsf: 2 },
      { name: '768', width: 768, height: 1024, dsf: 1 },
      { name: '1280', width: 1280, height: 900, dsf: 1 },
      { name: '1920', width: 1920, height: 1080, dsf: 1 },
    ];

const THEMES = ['light', 'dark'];

mkdirSync(OUT, { recursive: true });

// Use a server that is already running, or start one for the run.
const server = (await isServing(BASE))
  ? { url: BASE, close: async () => {} }
  : await startStaticServer({ root: ROOT, port: Number(new URL(BASE).port) || 8080 });

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
});

const problems = [];

for (const page of PAGES) {
  if (only && page.name !== only) continue;
  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      const tab = await browser.newPage();
      const messages = [];
      tab.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        // A failed HTTP response is reported separately; the application
        // handles those states (rate limit, offline) on purpose.
        if (/Failed to load resource/i.test(text)) return;
        messages.push(`console: ${text}`);
      });
      tab.on('pageerror', (err) => messages.push(`pageerror: ${err.message}`));
      tab.on('requestfailed', (req) =>
        messages.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`)
      );

      await tab.setViewport({
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.dsf,
      });
      await tab.evaluateOnNewDocument((t) => {
        try {
          localStorage.setItem('contribmatch:v1:theme', t);
        } catch (e) {
          /* ignore */
        }
      }, theme);

      try {
        await tab.goto(`${server.url}${page.url}`, { waitUntil: 'networkidle2', timeout: 30000 });
        // Let fonts settle and any entrance animation finish.
        await tab.evaluate(() => document.fonts?.ready);

        // The matcher page talks to GitHub; wait for it to settle.
        if (page.name === 'app') {
          await tab
            .waitForFunction(
              () => {
                const results = document.querySelector('#results');
                if (!results) return false;
                return (
                  results.querySelector('.match') ||
                  results.querySelector('.state') ||
                  results.querySelector('.skeleton') === null
                );
              },
              { timeout: 45000 }
            )
            .catch(() => {});
          await new Promise((r) => setTimeout(r, 1200));
        } else {
          await new Promise((r) => setTimeout(r, 700));
        }

        // Detect horizontal overflow — the page itself must never scroll sideways.
        const overflow = await tab.evaluate(() => {
          const doc = document.documentElement;
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            offenders: Array.from(document.querySelectorAll('body *'))
              .filter((node) => node.getBoundingClientRect().right > doc.clientWidth + 1)
              .slice(0, 5)
              .map((node) => `${node.tagName}.${node.className}`.slice(0, 80)),
          };
        });

        const file = resolve(OUT, `${page.name}-${viewport.name}-${theme}.png`);
        await tab.screenshot({ path: file, fullPage: viewport.name === '360' ? false : true });

        if (overflow.scrollWidth > overflow.clientWidth + 1) {
          problems.push(
            `${page.name} @${viewport.name}/${theme}: horizontal overflow ${overflow.scrollWidth} > ${overflow.clientWidth} — ${overflow.offenders.join(', ')}`
          );
        }
        if (messages.length) {
          problems.push(`${page.name} @${viewport.name}/${theme}: ${messages.join(' | ')}`);
        }
      } catch (err) {
        problems.push(`${page.name} @${viewport.name}/${theme}: ${err.message}`);
      } finally {
        await tab.close();
      }
    }
  }
  process.stdout.write(`captured ${page.name}\n`);
}

await browser.close();
await server.close();

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  problems.forEach((p) => console.log(`  - ${p}`));
  process.exitCode = 1;
} else {
  console.log('\nNo console errors and no horizontal overflow.');
}
