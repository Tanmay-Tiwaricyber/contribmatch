/**
 * Small DOM helpers.
 *
 * Every helper that inserts text uses textContent, so untrusted values
 * (issue titles, repository names, model output) are never parsed as HTML.
 */

/**
 * Create an element.
 * @param {string} tag
 * @param {object} [props] attributes, dataset, style, and `text`
 * @param {Array<Node|string>} [children]
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value; // only ever used with literal markup
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Remove every child of a node. */
export function clear(node) {
  if (!node) return node;
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Replace the children of a node. */
export function render(node, children = []) {
  if (!node) return node;
  clear(node);
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** querySelector shorthand. */
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Escape a string for safe insertion into innerHTML (rare, for literals). */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A short, readable relative date. */
export function relativeDate(iso, now = Date.now()) {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'unknown';
  const diff = Math.round((now - ts) / 86400000);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 30) return `${diff} days ago`;
  if (diff < 365) return `${Math.round(diff / 30)} months ago`;
  return `${Math.round(diff / 365)} years ago`;
}

/** Format a number with thin separators. */
export function formatNumber(n) {
  return new Intl.NumberFormat('en').format(Number(n) || 0);
}

/** Copy text to the clipboard, with a fallback for insecure contexts. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea method */
  }
  try {
    const area = el('textarea', { value: text, 'aria-hidden': 'true' });
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Debounce. */
export function debounce(fn, wait = 200) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
