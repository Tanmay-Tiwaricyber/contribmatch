/**
 * Icon set.
 *
 * Inline SVG, stroke-based, 16x16 by default. Icons are decorative: every
 * icon in the app sits next to text or inside a labelled control.
 *
 * Each icon is a list of elements: ['circle', {cx: 8, cy: 8, r: 3.2}, {fill: 'none'}]
 */

const ICONS = {
  sun: [
    ['circle', { cx: 8, cy: 8, r: 3.2 }],
    ['path', { d: 'M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13M12.95 12.95l-1.13-1.13M4.18 4.18L3.05 3.05' }],
  ],
  moon: [['path', { d: 'M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.9 5.9 0 1 0 7.1 7.1Z' }]],
  menu: [['path', { d: 'M2 4h12M2 8h12M2 12h12' }]],
  close: [['path', { d: 'M4 4l8 8M12 4l-8 8' }]],
  check: [['path', { d: 'M3 8.5l3.2 3.2L13 5' }]],
  copy: [
    ['rect', { x: 5.5, y: 5.5, width: 8, height: 8, rx: 1.5 }],
    ['path', { d: 'M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5V9A1.5 1.5 0 0 0 4 10.5h2' }],
  ],
  plus: [['path', { d: 'M8 3.5v9M3.5 8h9' }]],
  arrowRight: [['path', { d: 'M3 8h10M9 4l4 4-4 4' }]],
  arrowLeft: [['path', { d: 'M13 8H3M7 4L3 8l4 4' }]],
  external: [['path', { d: 'M9 3h4v4M13 3L7.5 8.5M12 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5' }]],
  search: [
    ['circle', { cx: 7, cy: 7, r: 4.5 }],
    ['path', { d: 'M10.5 10.5 14 14' }],
  ],
  shield: [['path', { d: 'M8 1.5 13 3.5v4c0 3.2-2.1 5.6-5 7-2.9-1.4-5-3.8-5-7v-4Z' }]],
  lock: [
    ['rect', { x: 3, y: 7, width: 10, height: 7, rx: 1.5 }],
    ['path', { d: 'M5.5 7V5a2.5 2.5 0 0 1 5 0v2' }],
  ],
  info: [
    ['circle', { cx: 8, cy: 8, r: 6.5 }],
    ['path', { d: 'M8 7.2v4M8 4.8h.01' }],
  ],
  warning: [
    ['path', { d: 'M8 1.8 15 14H1L8 1.8Z' }],
    ['path', { d: 'M8 6.2v3.4M8 11.6h.01' }],
  ],
  error: [
    ['circle', { cx: 8, cy: 8, r: 6.5 }],
    ['path', { d: 'M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4' }],
  ],
  sparkle: [['path', { d: 'M8 2l1.3 3.7L13 7l-3.7 1.3L8 12l-1.3-3.7L3 7l3.7-1.3L8 2Z' }]],
  book: [
    ['path', { d: 'M3 3.5A1.5 1.5 0 0 1 4.5 2H12v10H4.5A1.5 1.5 0 0 0 3 13.5Z' }],
    ['path', { d: 'M3 13.5A1.5 1.5 0 0 1 4.5 12H12v2H4.5A1.5 1.5 0 0 1 3 13.5Z' }],
  ],
  users: [
    ['circle', { cx: 6, cy: 5.5, r: 2.5 }],
    ['path', { d: 'M1.8 13.5a4.2 4.2 0 0 1 8.4 0' }],
    ['path', { d: 'M11 3.4a2.5 2.5 0 0 1 0 4.6M12.4 13.5a4.2 4.2 0 0 0-1.4-3.2' }],
  ],
  code: [['path', { d: 'M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5' }]],
  clock: [
    ['circle', { cx: 8, cy: 8, r: 6.5 }],
    ['path', { d: 'M8 4.5V8l2.4 1.6' }],
  ],
  comment: [['path', { d: 'M14 9.5A2.5 2.5 0 0 1 11.5 12H6l-3 2.5V4.5A2.5 2.5 0 0 1 5.5 2h6A2.5 2.5 0 0 1 14 4.5Z' }]],
  download: [['path', { d: 'M8 2v8M5 7.5 8 10.5l3-3M3 13h10' }]],
  trash: [['path', { d: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5 5 14h6l.5-9.5' }]],
  link: [
    ['path', { d: 'M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.6.6' }],
    ['path', { d: 'M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5l.6-.6' }],
  ],
  chart: [['path', { d: 'M2 13.5h12M4.5 13.5V7M8 13.5V3.5M11.5 13.5v-4' }]],
  filter: [['path', { d: 'M2 3.5h12L9 9v4l-2 1.5V9Z' }]],
  sort: [['path', { d: 'M4 3v10M4 13l-2-2M4 13l2-2M12 13V3M12 3l-2 2M12 3l2 2' }]],
  star: [['path', { d: 'M8 2.2 9.8 6l4.2.4-3.2 2.8 1 4.1L8 11.2 4.2 13.3l1-4.1L2 6.4 6.2 6Z' }]],
  fork: [
    ['circle', { cx: 4.5, cy: 3.5, r: 1.8 }],
    ['circle', { cx: 11.5, cy: 3.5, r: 1.8 }],
    ['circle', { cx: 8, cy: 12.5, r: 1.8 }],
    ['path', { d: 'M4.5 5.3v1.4c0 1.3 1.6 1.6 3.5 1.6s3.5-.3 3.5-1.6V5.3M8 8.3v2.4' }],
  ],
  globe: [
    ['circle', { cx: 8, cy: 8, r: 6.5 }],
    ['path', { d: 'M1.5 8h13M8 1.5c1.8 2 2.7 4.1 2.7 6.5S9.8 12.5 8 14.5C6.2 12.5 5.3 10.4 5.3 8S6.2 3.5 8 1.5Z' }],
  ],
  bolt: [['path', { d: 'M9 1.5 3.5 9H8l-1 5.5L12.5 7H8Z' }]],
  list: [['path', { d: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01' }]],
  eye: [
    ['path', { d: 'M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8Z' }],
    ['circle', { cx: 8, cy: 8, r: 2 }],
  ],
  target: [
    ['circle', { cx: 8, cy: 8, r: 6.5 }],
    ['circle', { cx: 8, cy: 8, r: 3 }],
    ['circle', { cx: 8, cy: 8, r: 0.6 }],
  ],
  wrench: [['path', { d: 'M10.5 2.2a3.6 3.6 0 0 0 3.3 4.6l-8 8a1.8 1.8 0 0 1-2.6-2.6l8-8a3.6 3.6 0 0 0-.7-2Z' }]],
  bookOpen: [
    ['path', { d: 'M8 4.2C6.6 3 4.8 2.5 2.5 2.5v9c2.3 0 4.1.5 5.5 1.7 1.4-1.2 3.2-1.7 5.5-1.7v-9c-2.3 0-4.1.5-5.5 1.7Z' }],
    ['path', { d: 'M8 4.2v9' }],
  ],
  server: [
    ['rect', { x: 2, y: 2.5, width: 12, height: 4.5, rx: 1.2 }],
    ['rect', { x: 2, y: 9, width: 12, height: 4.5, rx: 1.2 }],
    ['path', { d: 'M4.5 4.75h.01M4.5 11.25h.01' }],
  ],
};

const NS = 'http://www.w3.org/2000/svg';

/**
 * Build an inline SVG icon.
 * @param {string} name
 * @param {{size?: number, className?: string, title?: string}} [opts]
 */
export function icon(name, { size = 16, className = '', title = '' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (className) svg.setAttribute('class', className);

  if (title) {
    const t = document.createElementNS(NS, 'title');
    t.textContent = title;
    svg.append(t);
  }

  const parts = ICONS[name] || ICONS.info;
  for (const [tag, attrs] of parts) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
      node.setAttribute(key, String(value));
    }
    svg.append(node);
  }
  return svg;
}

/** Names available in the set (used by the design system page). */
export const iconNames = Object.keys(ICONS);
