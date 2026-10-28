/**
 * Design system page.
 *
 * The contrast table is measured live in the browser from the computed token
 * values, so it always reflects the theme you are looking at.
 */

import { el, qs, render } from './dom.js';
import { t } from './i18n.js';
import { contrast, ratio } from '../core/contrast.js';
import { createMascot, MOODS, MOOD_MEANING } from './mascot.js';
import { createLogoMark } from './logo.js';
import { setTheme, getThemeMode } from './theme.js';

/** Pairs that must hold, mirrored from tools/contrast.mjs. */
const PAIRS = [
  ['--ink', '--paper', 4.5, 'Body text on paper'],
  ['--ink', '--paper-raised', 4.5, 'Body text on a card'],
  ['--ink-2', '--paper', 4.5, 'Secondary text on paper'],
  ['--ink-3', '--paper', 4.5, 'Muted text on paper'],
  ['--accent-text', '--paper', 4.5, 'Link text on paper'],
  ['--accent-text', '--paper-raised', 4.5, 'Link text on a card'],
  ['--ink-inverse', '--accent-solid', 4.5, 'Text on a solid accent button'],
  ['--success', '--success-wash', 4.5, 'Success text'],
  ['--warning', '--warning-wash', 4.5, 'Warning text'],
  ['--danger', '--danger-wash', 4.5, 'Danger text'],
  ['--danger-ink', '--danger-solid', 4.5, 'Text on a solid danger button'],
  ['--info', '--info-wash', 4.5, 'Info text'],
  ['--control-border', '--paper-raised', 3, 'Form control border'],
  ['--control-border', '--paper', 3, 'Form control border on the page'],
  ['--accent', '--paper', 3, 'Accent graphic on paper'],
  ['--focus-ring', '--paper', 3, 'Focus ring on paper'],
  ['--mascot-body', '--paper', 3, 'Mascot body on paper'],
  ['--mascot-cut', '--mascot-body', 3, 'Mascot cut-out on the body'],
  ['--mascot-mark', '--mascot-body', 3, 'Mascot accent mark on the body'],
];

function token(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value;
}

export function initDesignSystemPage() {
  renderContrast();
  renderTokens();
  renderMoods();
  renderLogos();
  renderHeatLevels();
  initThemeToggle();
}

function initThemeToggle() {
  const toggle = qs('#design-theme-toggle');
  if (!toggle) return;
  const update = () => {
    const mode = getThemeMode();
    toggle.textContent = mode === 'dark' ? 'Light theme' : 'Dark theme';
  };
  update();
  toggle.addEventListener('click', () => {
    setTheme(getThemeMode() === 'dark' ? 'light' : 'dark');
    update();
    renderContrast();
    renderTokens();
  });
  document.addEventListener('themechange', update);
}

function renderContrast() {
  const host = qs('#contrast-table');
  if (!host) return;

  const body = el('tbody');
  let failures = 0;

  for (const [fg, bg, min, description] of PAIRS) {
    const fgValue = token(fg);
    const bgValue = token(bg);
    const value = contrast(fgValue, bgValue);
    const pass = value >= min;
    if (!pass) failures++;

    body.append(
      el('tr', {}, [
        el('th', { scope: 'row' }, [
          el('code', { text: fg }),
          el('span', { class: 'muted', text: ` on ${bg}` }),
        ]),
        el('td', { class: 'mono tnum', text: `${ratio(value).toFixed(2)}:1` }),
        el('td', { class: 'mono', text: `${min}:1` }),
        el('td', {}, [
          el('span', {
            class: `badge ${pass ? 'badge--success' : 'badge--danger'}`,
            text: pass ? (value >= 7 ? 'AAA' : 'AA') : 'Fail',
          }),
        ]),
        el('td', { class: 'small muted', text: description }),
      ])
    );
  }

  render(host, [
    el('div', { class: 'table-wrap' }, [
      el('table', { class: 'table' }, [
        el('caption', { class: 'sr-only', text: 'Measured contrast ratios' }),
        el('thead', {}, [
          el('tr', {}, [
            el('th', { scope: 'col', text: 'Pair' }),
            el('th', { scope: 'col', text: 'Measured' }),
            el('th', { scope: 'col', text: 'Minimum' }),
            el('th', { scope: 'col', text: 'Result' }),
            el('th', { scope: 'col', text: 'Used for' }),
          ]),
        ]),
        body,
      ]),
    ]),
    el('p', {
      class: 'activity__note',
      text: failures
        ? `${failures} pair${failures === 1 ? '' : 's'} below the minimum in this theme.`
        : 'Every pair meets its minimum in this theme.',
    }),
  ]);
}

function renderTokens() {
  const host = qs('#token-table');
  if (!host) return;

  const groups = {
    Surface: ['--paper', '--paper-raised', '--paper-sunken', '--paper-overlay'],
    Ink: ['--ink', '--ink-2', '--ink-3', '--ink-inverse'],
    Crust: ['--crust-50', '--crust-100', '--crust-200', '--crust-300'],
    Accent: [
      '--accent',
      '--accent-solid',
      '--accent-ink',
      '--accent-text',
      '--accent-wash',
      '--accent-wash-2',
      '--accent-border',
    ],
    Semantic: [
      '--success',
      '--success-wash',
      '--success-border',
      '--warning',
      '--warning-wash',
      '--warning-border',
      '--danger',
      '--danger-wash',
      '--danger-border',
      '--danger-solid',
      '--danger-ink',
      '--info',
      '--info-wash',
      '--info-border',
    ],
    Interaction: ['--control-border', '--control-border-hover', '--focus-ring', '--focus-offset'],
    Heatmap: ['--heat-0', '--heat-1', '--heat-2', '--heat-3', '--heat-4', '--heat-0-border'],
    Mascot: ['--mascot-body', '--mascot-band', '--mascot-cut', '--mascot-mark'],
  };

  const body = el('tbody');
  for (const [group, names] of Object.entries(groups)) {
    body.append(
      el('tr', {}, [
        el('th', { scope: 'row', class: 'mono', text: group }),
        el('td', { colspan: '3' }, [
          el('div', { class: 'cluster' },
            names.map((name) => {
              const value = token(name);
              const swatch = el('span', { class: 'token__swatch' });
              swatch.style.background = value;
              swatch.setAttribute('aria-hidden', 'true');
              return el('span', { class: 'token' }, [
                swatch,
                el('code', { text: name }),
                el('span', { class: 'muted small', text: value }),
              ]);
            })
          ),
        ]),
      ])
    );
  }

  render(host, [
    el('div', { class: 'table-wrap' }, [
      el('table', { class: 'table' }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { scope: 'col', text: 'Group' }),
            el('th', { scope: 'col', colspan: '3', text: 'Tokens' }),
          ]),
        ]),
        body,
      ]),
    ]),
  ]);
}

function renderMoods() {
  const host = qs('#mascot-moods');
  if (!host) return;
  render(
    host,
    MOODS.map((mood) =>
      el('div', { class: 'card mood-card' }, [
        createMascot({ mood, size: 'md' }),
        el('p', { class: 'mono small', text: mood }),
        el('p', { class: 'small muted', text: MOOD_MEANING[mood] }),
      ])
    )
  );
}

function renderLogos() {
  const host = qs('#logo-versions');
  if (!host) return;

  const versions = [
    { variant: 'color', label: 'Colour (light background)' },
    { variant: 'mono', label: 'Mono (knockout lens)' },
    { variant: 'dark', label: 'Dark background' },
  ];

  render(
    host,
    versions.map((version) =>
      el('div', { class: 'card' }, [
        el('div', { class: `logo-swatch logo-swatch--${version.variant}` }, [
          createLogoMark({ variant: version.variant, size: 96 }),
        ]),
        el('p', { class: 'small muted', text: version.label }),
      ])
    )
  );
}

function renderHeatLevels() {
  const host = qs('#heat-levels');
  if (!host) return;
  const levels = [0, 1, 2, 3, 4];
  render(
    host,
    el(
      'div',
      { class: 'cluster' },
      levels.map((level) => {
        const swatch = el('span', { class: 'heat__legend-cell' });
        swatch.dataset.level = String(level);
        swatch.style.width = '28px';
        swatch.style.height = '28px';
        return el('span', { class: 'token' }, [
          swatch,
          el('code', { text: `--heat-${level}` }),
        ]);
      })
    )
  );
}

export { t };
