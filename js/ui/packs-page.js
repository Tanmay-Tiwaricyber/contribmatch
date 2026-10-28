/**
 * Community packs page.
 */

import { el, qs, render, copyText } from './dom.js';
import { t } from './i18n.js';
import { showToast } from './toast.js';
import { loadPacks } from '../core/packs.js';
import { createCopyButton } from './copy.js';
import { openModal } from './modal.js';
import { icon } from './icons.js';

export function initPacksPage() {
  const host = qs('#packs-list');
  const filterHost = qs('#packs-filter');
  const errorHost = qs('#packs-error');
  if (!host) return;

  const state = { packs: [], type: 'all' };

  const TYPES = [
    { value: 'all', label: t('app.filterAll') },
    { value: 'skill', label: t('packsPage.type.skill') },
    { value: 'ecosystem', label: t('packsPage.type.ecosystem') },
    { value: 'tone', label: t('packsPage.type.tone') },
  ];

  function renderFilter() {
    if (!filterHost) return;
    const buttons = TYPES.map((type) => {
      const btn = el('button', {
        type: 'button',
        class: 'chip',
        'aria-pressed': String(state.type === type.value),
        text: type.label,
      });
      btn.addEventListener('click', () => {
        state.type = type.value;
        renderFilter();
        renderList();
      });
      return btn;
    });
    render(filterHost, buttons);
  }

  function renderList() {
    const list = state.packs.filter((pack) => state.type === 'all' || pack.type === state.type);

    if (!list.length) {
      render(host, [el('p', { class: 'muted', text: t('packsPage.empty') })]);
      return;
    }

    render(
      host,
      list.map((pack) => {
        const card = el('article', { class: 'card' });
        card.append(
          el('h2', { class: 'card__title' }, [
            el('span', { text: pack.name }),
            el('span', { class: 'badge badge--accent', text: pack.type }),
          ])
        );
        card.append(el('p', { class: 'card__body', text: pack.description }));

        const meta = el('div', { class: 'cluster' }, [
          el('span', { class: 'badge', text: `v${pack.version}` }),
          el('span', { class: 'badge', text: pack.level }),
          ...pack.languages.map((lang) => el('span', { class: 'badge', text: lang })),
        ]);
        card.append(meta);

        const skills = el('div', { class: 'cluster' });
        for (const skill of pack.skills) {
          skills.append(el('span', { class: 'badge', text: skill }));
        }
        card.append(skills);

        // The raw file is fetched once and shown in a dialog, so the list
        // stays short and the source is easy to read at full size.
        const viewButton = el('button', {
          type: 'button',
          class: 'btn btn--ghost btn--sm',
          text: t('packsPage.viewSource'),
        });
        viewButton.addEventListener('click', () => showSource(pack));

        card.append(
          el('div', { class: 'cluster pack__actions' }, [
            viewButton,
            el('span', { class: 'muted', text: `${pack.__file}` }),
          ])
        );

        return card;
      })
    );
  }

  /**
   * Show the raw JSON or YAML of a pack in a dialog.
   * @param {object} pack
   */
  async function showSource(pack) {
    let source = '';
    try {
      const res = await fetch(pack.__file);
      source = res.ok ? await res.text() : '';
    } catch {
      source = '';
    }
    if (!source) source = JSON.stringify(pack, null, 2);

    const raw = el('pre', { text: source });
    const code = el('div', { class: 'code' }, [
      el('div', { class: 'code__head' }, [
        el('span', { class: 'code__lang', text: pack.__format.toUpperCase() }),
        createCopyButton(() => source, {
          label: t('common.copy'),
          doneLabel: t('common.copied'),
        }),
      ]),
      raw,
    ]);

    openModal({
      title: pack.name,
      body: code,
      size: 'lg',
      labelClose: t('common.close'),
    });
  }

  renderFilter();
  render(host, [el('p', { class: 'muted', text: t('common.loading') })]);

  loadPacks()
    .then(({ packs, errors }) => {
      state.packs = packs;
      if (errorHost) {
        render(errorHost, errors.length ? [el('p', { class: 'muted', text: errors.join(' · ') })] : []);
      }
      renderList();
    })
    .catch((err) => {
      render(host, [
        el('div', { class: 'notice notice--danger' }, [
          el('span', { class: 'notice__icon', text: '!' }),
          el('p', { text: err.message }),
        ]),
      ]);
    });
}

export { copyText, icon };
