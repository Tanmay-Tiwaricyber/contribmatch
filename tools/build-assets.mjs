#!/usr/bin/env node
/**
 * Build the PNG icon set and the Open Graph image.
 *
 *   node tools/build-assets.mjs
 *
 * Both are rendered with Puppeteer so they use the real self-hosted fonts and
 * the real palette, rather than a second set of values that can drift.
 */

import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ICON_DIR = resolve(ROOT, 'assets/icons');
const LOGO_DIR = resolve(ROOT, 'assets/logo');
const OG_PATH = resolve(ROOT, 'assets/og-image.png');

mkdirSync(ICON_DIR, { recursive: true });

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
});

/* -------------------------------------------------------------------------- */
/* Icons                                                                       */
/* -------------------------------------------------------------------------- */

const markSvg = readFileSync(resolve(LOGO_DIR, 'mark.svg'), 'utf8');
const markDarkSvg = readFileSync(resolve(LOGO_DIR, 'mark-dark.svg'), 'utf8');

/**
 * Render the logo mark on a square canvas.
 * @param {number} size
 * @param {{dark?: boolean, maskable?: boolean}} options
 */
async function renderIcon(size, options = {}) {
  const { dark = false, maskable = false } = options;
  const padding = maskable ? Math.round(size * 0.18) : Math.round(size * 0.1);
  const inner = size - padding * 2;
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; }
  body {
    width: ${size}px; height: ${size}px;
    display: flex; align-items: center; justify-content: center;
    background: ${dark ? '#101014' : '#f2f1ee'};
  }
  .box { width: ${inner}px; height: ${inner}px; }
  .box svg { width: 100%; height: 100%; display: block; }
</style></head>
<body><div class="box">${dark ? markDarkSvg : markSvg}</div></body></html>`);
  const buffer = await page.screenshot({ type: 'png', omitBackground: false });
  await page.close();
  return buffer;
}

const icons = [
  { file: 'icon-16.png', size: 16 },
  { file: 'icon-32.png', size: 32 },
  { file: 'icon-48.png', size: 48 },
  { file: 'icon-180.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-192.png', size: 192, maskable: true },
  { file: 'maskable-512.png', size: 512, maskable: true },
];

for (const icon of icons) {
  const buffer = await renderIcon(icon.size, { maskable: icon.maskable });
  writeFileSync(resolve(ICON_DIR, icon.file), buffer);
  console.log(`  assets/icons/${icon.file}  ${icon.size}×${icon.size}`);
}

// A dark-background variant, for the maskable icon on a dark home screen.
writeFileSync(resolve(ICON_DIR, 'icon-dark-512.png'), await renderIcon(512, { dark: true }));
console.log('  assets/icons/icon-dark-512.png  512×512');

/* -------------------------------------------------------------------------- */
/* Open Graph image                                                            */
/* -------------------------------------------------------------------------- */

const fontsCss = readFileSync(resolve(ROOT, 'assets/fonts/fonts.css'), 'utf8');
const wordmarkSvg = readFileSync(resolve(LOGO_DIR, 'wordmark.svg'), 'utf8');

/**
 * A deterministic contribution wall, drawn as flat SVG cells.
 * The pattern is fixed so the image is the same every time it is built.
 */
function wallSvg() {
  const cells = [];
  const levels = [0, 0, 1, 0, 2, 0, 0, 3, 1, 0, 0, 2, 0, 4, 0, 0, 1, 0, 2, 3, 0, 0, 1, 0,
    0, 2, 0, 0, 0, 3, 1, 0, 0, 4, 0, 0, 2, 0, 1, 0, 0, 2, 0, 0, 1, 3, 0, 0, 0, 2];
  const fill = ['#faf9f7', '#dbe7ff', '#b9d0ff', '#8fb4ff', '#4b86f0'];
  const stroke = ['#e3e2df', 'none', 'none', 'none', 'none'];
  const size = 22;
  const gap = 5;

  // 12 weeks of 7 days, repeated with a shift so it looks like real history.
  for (let week = 0; week < 16; week++) {
    for (let day = 0; day < 7; day++) {
      const index = (week * 5 + day * 3) % levels.length;
      const level = levels[index];
      const x = week * (size + gap);
      const y = day * (size + gap);
      cells.push(
        `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${fill[level]}" stroke="${stroke[level]}"/>`
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${16 * (size + gap)}" height="${7 * (size + gap)}" viewBox="0 0 ${16 * (size + gap)} ${7 * (size + gap)}">${cells.join('')}</svg>`;
}

const ogPage = await browser.newPage();
await ogPage.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await ogPage.setContent(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
${fontsCss}
  :root { --paper: #f2f1ee; --ink: #101014; --ink-2: #666667; --ink-3: #6d6d6f;
          --line: #e3e2df; --accent: #2d81ff; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background: var(--paper);
    color: var(--ink);
    font-family: 'Inter', 'Noto Sans Devanagari', system-ui, sans-serif;
    position: relative;
    overflow: hidden;
  }
  .scan {
    position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='1' fill='%23101014' fill-opacity='0.03'/%3E%3C/svg%3E");
  }
  .frame {
    position: absolute; inset: 0;
    border: 1px solid var(--line);
    margin: 28px;
  }
  .inner { position: relative; height: 100%; padding: 64px 72px; display: flex; flex-direction: column; }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .mark { width: 208px; height: 34px; }
  .mark svg { width: 100%; height: 100%; display: block; }
  .hud {
    font-family: 'Geist Mono', monospace; font-size: 12px; font-weight: 600;
    letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink-3);
    display: flex; align-items: center; gap: 10px;
  }
  .hud::before { content: ''; width: 9px; height: 9px; background: var(--accent); }
  h1 {
    font-family: 'Archivo', sans-serif; font-weight: 620; font-stretch: 118%;
    font-size: 76px; line-height: 1.02; letter-spacing: -0.03em;
    margin-top: 54px; max-width: 15ch; position: relative; z-index: 2;
  }
  h1 em { font-family: 'Instrument Serif', serif; font-weight: 400; font-style: italic; }
  .sub {
    margin-top: 26px; font-size: 21px; line-height: 1.45; color: var(--ink-2);
    max-width: 30ch; position: relative; z-index: 2;
  }
  .wall {
    position: absolute; right: -96px; top: 168px; width: 700px;
    transform: rotateX(54deg) rotateZ(-9deg) scale(0.92);
    transform-origin: 88% 10%;
    opacity: 0.96;
  }
  .wall svg { width: 100%; height: auto; display: block; }
  .panel {
    position: absolute; right: 104px; top: 78px;
    background: #faf9f7; border: 1px solid var(--line);
    box-shadow: 4px 4px 0 rgba(16,16,20,0.10), 12px 12px 0 rgba(16,16,20,0.05);
    padding: 18px 22px; transform: rotateY(18deg) rotateX(6deg);
  }
  .panel b { display: block; font-size: 40px; font-family: 'Archivo', sans-serif; font-weight: 620; }
  .panel span { font-family: 'Geist Mono', monospace; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink-3); }
  .foot {
    margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between;
    position: relative; z-index: 2;
  }
  .foot p { font-family: 'Geist Mono', monospace; font-size: 13px; letter-spacing: 0.06em; color: var(--ink-2); }
</style></head>
<body>
  <div class="scan"></div>
  <div class="frame"></div>
  <div class="inner">
    <div class="top">
      <div class="mark">${wordmarkSvg}</div>
      <div class="hud">Open source · MIT licensed</div>
    </div>
    <h1>Find an issue you can <em>actually finish</em>.</h1>
    <p class="sub">Beginner-friendly GitHub issues, scored by rules you can read, and a plan for the pull request.</p>
    <div class="wall">${wallSvg()}</div>
    <div class="panel"><span>Commits</span><b>354</b></div>
    <div class="foot">
      <p>contribmatch · powered by open-weight Gemma</p>
    </div>
  </div>
</body></html>`, { waitUntil: 'networkidle0' });

await ogPage.evaluate(() => document.fonts.ready);
const ogBuffer = await ogPage.screenshot({ type: 'png' });
writeFileSync(OG_PATH, ogBuffer);
console.log('  assets/og-image.png  1200×630');
await ogPage.close();

await browser.close();
console.log('\nAssets built.');
