/**
 * Accordion behaviour.
 *
 * A small, dependency-free accordion: one panel open at a time per group,
 * with the trigger wired to `aria-expanded` and `aria-controls`.
 */

import { qsa } from './dom.js';

function initGroup(group) {
  const triggers = qsa('.accordion__trigger', group);
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      triggers.forEach((other) => {
        other.setAttribute('aria-expanded', 'false');
        const panel = document.getElementById(other.getAttribute('aria-controls'));
        if (panel) panel.hidden = true;
      });
      if (!expanded) {
        trigger.setAttribute('aria-expanded', 'true');
        const panel = document.getElementById(trigger.getAttribute('aria-controls'));
        if (panel) panel.hidden = false;
      }
    });
  });
}

export function initAccordions() {
  qsa('.accordion').forEach(initGroup);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAccordions, { once: true });
} else {
  initAccordions();
}
