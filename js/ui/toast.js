/**
 * Toasts.
 *
 * A single polite live region at the bottom of the page. Errors use an
 * assertive region so a failure is not missed.
 */

import { el } from './dom.js';
import { icon } from './icons.js';

let region = null;

function ensureRegion() {
  if (region && document.body.contains(region)) return region;
  region = el('div', {
    class: 'toast-region',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'false',
  });
  document.body.append(region);
  return region;
}

/**
 * Show a message.
 * @param {string} message
 * @param {{type?: 'info'|'success'|'error', duration?: number}} [opts]
 */
export function showToast(message, { type = 'info', duration = 5000 } = {}) {
  const host = ensureRegion();
  const toast = el('div', {
    class: `toast${type === 'error' ? ' toast--error' : type === 'success' ? ' toast--success' : ''}`,
    role: type === 'error' ? 'alert' : 'status',
  });
  toast.append(
    icon(type === 'error' ? 'error' : type === 'success' ? 'check' : 'info', { className: 'toast__icon' })
  );
  toast.append(el('span', { text: message }));
  host.append(toast);

  const remove = () => {
    toast.remove();
    if (!host.children.length) host.remove();
  };
  setTimeout(remove, duration);
  toast.addEventListener('click', remove);
  return remove;
}
