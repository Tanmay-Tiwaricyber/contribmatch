/**
 * Contrast maths. DOM-free so it can run in Node (tooling, tests) and in the
 * browser (design-system.html renders live measured ratios).
 *
 * WCAG 2.1 relative luminance and contrast ratio.
 */

/** @param {string} hex e.g. "#2d81ff" or "2d81ff" */
export function parseColor(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** @param {string} hex @returns {number} relative luminance 0..1 */
export function luminance(hex) {
  const c = parseColor(hex);
  if (!c) return NaN;
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/**
 * Contrast ratio between two colours, 1..21.
 * @param {string} a @param {string} b
 */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (Number.isNaN(la) || Number.isNaN(lb)) return NaN;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG label for a measured ratio. */
export function wcagLevel(ratio, { large = false } = {}) {
  const body = large ? 3 : 4.5;
  const largeOnly = 3;
  if (ratio >= 7) return 'AAA';
  if (ratio >= body) return 'AA';
  if (ratio >= largeOnly) return large ? 'AA' : 'AA (large text only)';
  return 'Fail';
}

/** Round to 2 decimals for display. */
export function ratio(r) {
  return Math.round(r * 100) / 100;
}

/**
 * Check a foreground/background pair.
 * @returns {{ratio:number, passAA:boolean, passAAA:boolean, passLarge:boolean}}
 */
export function check(fg, bg) {
  const r = contrast(fg, bg);
  return {
    ratio: r,
    passAA: r >= 4.5,
    passLarge: r >= 3,
    passAAA: r >= 7,
  };
}
