/**
 * The live agent steps panel.
 *
 * Every agent reports through `ctx.onStep(message)`. The panel renders those
 * messages as they arrive so the user can see what is happening.
 */

import { el, clear } from './dom.js';
import { t } from './i18n.js';
import { icon } from './icons.js';

/**
 * @param {{title?: string}} [opts]
 */
export function createStepsPanel({ title } = {}) {
  const root = el('section', { class: 'steps', 'aria-label': title || t('app.steps') });

  const head = el('div', { class: 'steps__head' }, [
    icon('bolt', { className: 'steps__icon' }),
    el('h2', { class: 'steps__title', text: title || t('app.steps') }),
  ]);

  const list = el('ol', { class: 'steps__list' });
  const status = el('p', {
    class: 'activity__note',
    'aria-live': 'polite',
    text: t('app.stepsIdle'),
  });

  root.append(head, list, status);

  const rows = new Map();

  function upsert(agent, message, state = 'active') {
    let row = rows.get(agent);
    if (!row) {
      const text = el('span', { class: 'step__text' });
      const meta = el('span', { class: 'step__meta' });
      const item = el('li', { class: 'step', dataset: { state } }, [
        el('span', { class: 'step__dot', 'aria-hidden': 'true' }),
        text,
        meta,
      ]);
      rows.set(agent, { item, text, meta });
      list.append(item);
      row = rows.get(agent);
    }
    row.text.textContent = message;
    row.item.dataset.state = state;
    if (state === 'done') row.meta.textContent = 'done';
    else if (state === 'active') row.meta.textContent = 'running';
    else row.meta.textContent = state;
  }

  return {
    element: root,

    /** Reset the panel. */
    reset() {
      clear(list);
      rows.clear();
      status.textContent = t('app.stepsIdle');
    },

    /**
     * Handle a step message from an agent.
     * @param {string|{agent?:string,message:string,state?:string}} message
     */
    onStep(message) {
      const agent = typeof message === 'string' ? 'agent' : message.agent || 'agent';
      const text = typeof message === 'string' ? message : message.message || '';
      const state = typeof message === 'string' ? 'active' : message.state || 'active';
      upsert(agent, text, state);
      status.textContent = t('app.stepsRunning');
    },

    /** Mark the run as finished. */
    finish() {
      for (const row of rows.values()) {
        if (row.item.dataset.state === 'active') row.item.dataset.state = 'done';
      }
      status.textContent = t('app.stepsIdle');
    },

    /** Report an error on the panel. */
    fail(message) {
      status.textContent = message;
      status.style.color = 'var(--danger)';
    },
  };
}
