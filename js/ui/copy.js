/**
 * Copy-to-clipboard buttons.
 */

import { el, copyText } from './dom.js';
import { icon } from './icons.js';
import { t } from './i18n.js';

/**
 * Create a copy button.
 * @param {() => string} getText
 * @param {{label?: string, doneLabel?: string, className?: string}} [opts]
 */
export function createCopyButton(getText, { label, doneLabel, className = 'copy-btn' } = {}) {
  const button = el('button', {
    type: 'button',
    class: className,
    'aria-label': label || t('common.copy'),
  });
  const iconWrap = el('span', { 'aria-hidden': 'true' });
  iconWrap.append(icon('copy', { size: 14 }));
  const text = el('span', { text: label || t('common.copy') });
  button.append(iconWrap, text);

  button.addEventListener('click', async () => {
    const ok = await copyText(getText());
    if (!ok) return;
    button.dataset.copied = 'true';
    text.textContent = doneLabel || t('common.copied');
    iconWrap.replaceChildren(icon('check', { size: 14 }));
    setTimeout(() => {
      button.dataset.copied = 'false';
      text.textContent = label || t('common.copy');
      iconWrap.replaceChildren(icon('copy', { size: 14 }));
    }, 2000);
  });

  return button;
}

/**
 * Attach copy buttons to every code block inside a root element.
 * Blocks are marked with `data-copy` and may carry a `data-copy-label`.
 * @param {ParentNode} [root]
 */
export function attachCopyButtons(root = document) {
  root.querySelectorAll('.code[data-copy]').forEach((block) => {
    if (block.dataset.copyReady === 'true') return;
    block.dataset.copyReady = 'true';
    const pre = block.querySelector('pre');
    if (!pre) return;
    const head = block.querySelector('.code__head');
    if (!head) return;
    head.append(
      createCopyButton(() => pre.textContent, {
        label: block.dataset.copyLabel || t('common.copy'),
        doneLabel: t('common.copied'),
      })
    );
  });
}
