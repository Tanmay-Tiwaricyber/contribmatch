#!/usr/bin/env node
/**
 * Dev-only contrast auditor.
 *
 * Parses css/tokens.css for both themes and reports the measured ratio of
 * every pair the design system relies on. Fails (exit 1) when a required pair
 * drops below its threshold.
 *
 *   node tools/contrast.mjs            # report
 *   node tools/contrast.mjs --strict   # exit 1 on any failure
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrast, ratio } from '../js/core/contrast.js';

const ROOT = resolve(import.meta.dirname, '..');
const css = readFileSync(resolve(ROOT, 'css/tokens.css'), 'utf8');

/** Escape a literal for use inside a RegExp (function form avoids `$&` pitfalls). */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);

/** Pull the `:root { ... }` and `[data-theme="dark"] { ... }` blocks. */
function themeVars(selector) {
  const re = new RegExp(`${escapeRe(selector)}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = css.match(re);
  if (!m) throw new Error(`theme block not found: ${selector}`);
  const vars = {};
  for (const line of m[1].split('\n')) {
    const v = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/i);
    if (v) vars[v[1]] = v[2].trim();
  }
  return vars;
}

const light = themeVars(':root');
const dark = themeVars('[data-theme="dark"]');

// Pairs that must hold, per theme.
// [foreground, background, threshold, description]
const PAIRS = [
  ['--ink', '--paper', 4.5, 'body text on paper'],
  ['--ink', '--paper-raised', 4.5, 'body text on raised surface'],
  ['--ink', '--paper-sunken', 4.5, 'body text on sunken surface'],
  ['--ink', '--paper-overlay', 4.5, 'body text on overlay'],
  ['--ink-2', '--paper', 4.5, 'secondary text on paper'],
  ['--ink-2', '--paper-raised', 4.5, 'secondary text on raised surface'],
  ['--ink-2', '--paper-sunken', 4.5, 'secondary text on sunken surface'],
  ['--ink-3', '--paper', 4.5, 'muted text on paper'],
  ['--ink-3', '--paper-raised', 4.5, 'muted text on raised surface'],
  ['--ink-2', '--paper-overlay', 4.5, 'secondary text on overlay'],
  ['--ink-inverse', '--invert-bg', 4.5, 'text on an inverted block'],
  ['--ink-inverse', '--accent-solid', 4.5, 'text on solid accent button'],
  ['--accent-ink', '--accent-solid', 4.5, 'text on solid accent button'],
  ['--accent-text', '--paper', 4.5, 'accent link text on paper'],
  ['--accent-text', '--paper-raised', 4.5, 'accent link text on raised surface'],
  ['--accent-text', '--accent-wash', 4.5, 'accent link text on accent wash'],
  ['--accent-text', '--paper-sunken', 4.5, 'accent link text on a recessed code chip'],
  ['--success', '--paper', 4.5, 'success text on paper'],
  ['--success', '--success-wash', 4.5, 'success text on success wash'],
  ['--warning', '--paper', 4.5, 'warning text on paper'],
  ['--warning', '--warning-wash', 4.5, 'warning text on warning wash'],
  ['--danger', '--paper', 4.5, 'danger text on paper'],
  ['--danger', '--danger-wash', 4.5, 'danger text on danger wash'],
  ['--danger-ink', '--danger-solid', 4.5, 'text on solid danger button'],
  ['--info', '--paper', 4.5, 'info text on paper'],
  ['--info', '--info-wash', 4.5, 'info text on info wash'],
  ['--control-border', '--paper-raised', 3, 'form control border vs field'],
  ['--danger', '--paper-raised', 3, 'low score ring restroke vs card'],
  ['--warning', '--paper-raised', 3, 'mid score ring restroke vs card'],
  ['--accent', '--paper-raised', 3, 'high score ring restroke vs card'],
  ['--danger-ink', '--danger-solid', 4.5, 'error toast text'],
  ['--danger-solid', '--paper-raised', 3, 'error toast icon and border vs card'],
  ['--control-border', '--paper', 3, 'form control border vs page'],
  ['--control-border', '--paper-sunken', 3, 'form control border vs sunken field'],
  ['--accent', '--paper', 3, 'accent graphic vs paper'],
  ['--accent', '--paper-raised', 3, 'accent graphic vs raised surface'],
  ['--focus-ring', '--paper', 3, 'focus ring vs paper'],
  ['--focus-ring', '--paper-raised', 3, 'focus ring vs raised surface'],
  ['--ink', '--heat-0', 3, 'mascot body vs heatmap empty cell'],
  ['--mascot-cut', '--mascot-body', 3, 'mascot cut-out vs body'],
  ['--mascot-mark', '--mascot-body', 3, 'mascot lens vs body'],
  ['--mascot-body', '--paper', 3, 'mascot body vs paper'],
  ['--mascot-body', '--paper-raised', 3, 'mascot body vs raised surface'],
  ['--invert-fg', '--invert-bg', 4.5, 'inverted block text'],
  ['--invert-muted', '--invert-bg', 4.5, 'inverted block secondary text'],
];

/**
 * Decorative hairlines. They are reported for the record but never fail the
 * audit: a divider is structure, not a control boundary, and the design
 * system deliberately keeps them quiet.
 */
const DECORATIVE = [
  ['--line-strong', '--paper', 'strong hairline vs page'],
  ['--line-strong', '--paper-raised', 'strong hairline vs raised surface'],
  ['--line', '--paper', 'hairline vs page'],
  ['--faint', '--paper', 'decorative faint mark vs page'],
];

function run(name, vars) {
  console.log(`\n=== ${name} ===`);
  const failures = [];
  for (const [fg, bg, min, desc] of PAIRS) {
    const f = vars[fg];
    const b = vars[bg];
    if (!f || !b) {
      console.log(`  ??  ${fg} on ${bg} — token missing`);
      failures.push(`${fg} on ${bg} (token missing)`);
      continue;
    }
    const r = contrast(f, b);
    const ok = r >= min;
    if (!ok) failures.push(`${fg} on ${bg} = ${ratio(r)} (needs ${min})`);
    console.log(
      `  ${ok ? 'ok ' : 'FAIL'}  ${ratio(r).toFixed(2).padStart(6)}:1  ` +
      `(min ${min})  ${fg} on ${bg}  — ${desc}`
    );
  }
  for (const [fg, bg, desc] of DECORATIVE) {
    const f = vars[fg];
    const b = vars[bg];
    if (!f || !b) continue;
    const r = contrast(f, b);
    console.log(
      `  --   ${ratio(r).toFixed(2).padStart(6)}:1  (decorative)  ${fg} on ${bg}  — ${desc}`
    );
  }
  return failures;
}

const failures = [
  ...run('Light theme', light),
  ...run('Dark theme', dark),
];

console.log('');
if (failures.length) {
  console.log(`${failures.length} contrast failure(s):`);
  failures.forEach((f) => console.log(`  - ${f}`));
  if (process.argv.includes('--strict')) process.exit(1);
} else {
  console.log('All contrast requirements met.');
}
