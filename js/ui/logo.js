/**
 * Logo helpers.
 *
 * The mark is the "overlap lens": a large ink disc and a smaller charcoal
 * disc, with the intersection filled in the accent colour. Flat fills only.
 */

const NS = 'http://www.w3.org/2000/svg';

const GEOMETRY = {
  cxA: 11.5,
  cyA: 11.5,
  rA: 9.0,
  cxB: 20.5,
  cyB: 20.5,
  rB: 7.5,
};

const LENS_PATH =
  'M 13.001 20.374 A 7.5 7.5 0 0 1 20.374 13.001 A 9.0 9.0 0 0 1 13.001 20.374 Z';

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/**
 * Build the mark.
 * @param {{variant?: 'color'|'mono'|'dark', size?: number, className?: string}} [opts]
 */
export function createLogoMark({ variant = 'color', size = 32, className = '' } = {}) {
  const svg = svgEl('svg', {
    viewBox: '0 0 32 32',
    width: size,
    height: size,
    role: 'img',
    'aria-label': 'ContribMatch',
    focusable: 'false',
  });
  if (className) svg.setAttribute('class', className);

  const title = svgEl('title');
  title.textContent = 'ContribMatch';
  svg.append(title);

  const colors = {
    color: { a: 'var(--ink)', b: '#4b525c', lens: 'var(--accent)' },
    mono: { a: 'currentColor', b: 'currentColor', lens: 'var(--paper)' },
    dark: { a: 'var(--paper)', b: '#6e7684', lens: 'var(--accent)' },
  }[variant];

  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id: `cm-clip-${variant}` });
  clip.append(svgEl('circle', { cx: GEOMETRY.cxB, cy: GEOMETRY.cyB, r: GEOMETRY.rB }));
  defs.append(clip);
  svg.append(defs);

  svg.append(
    svgEl('circle', { cx: GEOMETRY.cxA, cy: GEOMETRY.cyA, r: GEOMETRY.rA, fill: colors.a })
  );
  svg.append(
    svgEl('circle', { cx: GEOMETRY.cxB, cy: GEOMETRY.cyB, r: GEOMETRY.rB, fill: colors.b })
  );
  svg.append(
    svgEl('circle', {
      cx: GEOMETRY.cxA,
      cy: GEOMETRY.cyA,
      r: GEOMETRY.rA,
      fill: colors.lens,
      'clip-path': `url(#cm-clip-${variant})`,
    })
  );

  return svg;
}

/**
 * The horizontal lockup: mark + "Contrib" (Archivo ExtraBold) + "Match"
 * (Instrument Serif italic). The wordmark uses live fonts so it stays crisp;
 * the outlined SVG version lives in assets/logo/wordmark.svg.
 */
export function createLogoLockup({ size = 26, className = '' } = {}) {
  const wrap = document.createElement('a');
  wrap.className = `brand ${className}`.trim();
  wrap.href = 'index.html';
  wrap.setAttribute('aria-label', 'ContribMatch — home');

  const mark = createLogoMark({ size });
  mark.setAttribute('class', 'brand__mark');
  mark.setAttribute('aria-hidden', 'true');
  mark.removeAttribute('role');
  mark.removeAttribute('aria-label');
  const title = mark.querySelector('title');
  if (title) title.remove();

  const word = document.createElement('span');
  word.className = 'brand__word';
  const contrib = document.createElement('span');
  contrib.className = 'brand__contrib';
  contrib.textContent = 'Contrib';
  const match = document.createElement('span');
  match.className = 'brand__match';
  match.textContent = 'Match';
  word.append(contrib, match);

  wrap.append(mark, word);
  return wrap;
}

export { LENS_PATH };
