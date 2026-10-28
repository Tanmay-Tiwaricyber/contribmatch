// Dev-only: render logo assets to a PNG contact sheet for visual review.
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const mark = read('assets/logo/mark.svg');
const mono = read('assets/logo/mark-mono.svg');
const dark = read('assets/logo/mark-dark.svg');
const word = read('assets/logo/wordmark.svg');

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;font:13px/1.4 system-ui;background:#FAF8F4;color:#15171B}
.row{display:flex;gap:28px;align-items:flex-end;padding:20px;border-bottom:1px solid #E7E3DA}
.dark{background:#101216;color:#F2F0EA}
.dark .cell{background:#171A20}
.cell{background:#fff;border:1px solid #E7E3DA;padding:12px;display:flex;flex-direction:column;gap:8px;align-items:center}
h3{font:600 11px/1 ui-monospace,monospace;margin:0 0 4px;opacity:.7}
.big svg{width:160px;height:160px}
.mid svg{width:64px;height:64px}
.sm svg{width:16px;height:16px}
.wordpath svg{width:340px;height:auto}
.wordpath{background:#fff;padding:8px;border:1px solid #E7E3DA}
</style>
<div class="row">
  <div class="cell big"><h3>MARK 160</h3>${mark}</div>
  <div class="cell mid"><h3>64</h3>${mark}</div>
  <div class="cell sm"><h3>16</h3>${mark}</div>
  <div class="cell"><h3>MONO</h3>${mono}</div>
  <div class="cell"><h3>DARK</h3>${dark}</div>
</div>
<div class="row dark">
  <div class="cell"><h3>DARK MODE</h3>${dark}</div>
  <div class="cell"><h3>MONO ON DARK</h3>${mono}</div>
</div>
<div class="row">
  <div class="cell wordpath"><h3>WORDMARK (outlined paths)</h3>${word}</div>
</div>`;

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 700, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: resolve(ROOT, 'docs/screenshots/_logo-review.png'), fullPage: true });
await browser.close();
console.log('wrote docs/screenshots/_logo-review.png');
