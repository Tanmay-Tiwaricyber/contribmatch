/**
 * A modal dialog.
 *
 * It traps focus while it is open, closes on Escape or a click on the
 * backdrop, and hands focus back to whatever opened it. Everything it shows
 * is built with DOM helpers, so untrusted text is never parsed as HTML.
 */

import { el, qs, render } from './dom.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;

/**
 * @typedef {object} ModalOptions
 * @property {string} title            the dialog heading
 * @property {Node|Node[]} body        the content
 * @property {Node[]} [actions]        buttons in the footer
 * @property {string} [size]           'sm' | 'md' | 'lg'
 * @property {string} [labelClose]     the close button label
 * @property {boolean} [dismissible]   allow Escape and backdrop close
 * @property {string} [variant]        'drawer' slides in from the right
 */

/**
 * Open a modal.
 * @param {ModalOptions} options
 * @returns {{close: () => void, element: HTMLElement}}
 */
export function openModal(options = {}) {
  const {
    title = '',
    body = [],
    actions = [],
    size = 'md',
    labelClose = 'Close',
    dismissible = true,
    variant = 'dialog',
  } = options;

  const previous = document.activeElement;

  const titleId = `modal-title-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const bodyId = `modal-body-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

  const closeButton = el('button', {
    type: 'button',
    class: 'modal__close',
    'aria-label': labelClose,
  });

  const dialog = el(
    'div',
    {
      class: 'modal__dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      'aria-describedby': bodyId,
      tabindex: '-1',
    },
    [
      el('div', { class: 'modal__head' }, [
        el('h2', { class: 'modal__title', id: titleId, text: title }),
        closeButton,
      ]),
      el('div', { class: 'modal__body', id: bodyId }, [body]),
      actions.length ? el('div', { class: 'modal__foot' }, actions) : null,
    ]
  );

  const overlay = el(
    'div',
    {
      class: `modal modal--${variant} modal--${size}`,
      hidden: true,
    },
    [
      el('div', { class: 'modal__backdrop' }),
      dialog,
    ]
  );

  document.body.append(overlay);
  document.body.classList.add('has-modal');

  function close() {
    if (!overlay.isConnected) return;
    overlay.hidden = true;
    overlay.remove();
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) document.body.classList.remove('has-modal');
    if (previous && typeof previous.focus === 'function') previous.focus();
    document.removeEventListener('keydown', onKeydown, true);
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && dismissible) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE)).filter(
      (node) => node.offsetParent !== null || node === document.activeElement
    );
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  closeButton.addEventListener('click', close);
  const backdrop = qs('.modal__backdrop', overlay);
  if (backdrop && dismissible) backdrop.addEventListener('click', close);

  document.addEventListener('keydown', onKeydown, true);

  // Show it, then move focus into the dialog.
  overlay.hidden = false;
  openCount += 1;
  const target = qs('.modal__close', dialog);
  if (target) target.focus();
  else dialog.focus();

  return { close, element: overlay };
}

/**
 * Replace the body of an open modal without closing it.
 * @param {HTMLElement} overlay
 * @param {Node|Node[]} body
 */
export function setModalBody(overlay, body) {
  const host = qs('.modal__body', overlay);
  render(host, [body]);
}

export { FOCUSABLE };
