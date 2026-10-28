/**
 * Shortlist page — saved issues, stored in this browser only.
 */

import { el, qs, render, relativeDate, copyText } from './dom.js';
import { t } from './i18n.js';
import { showToast } from './toast.js';
import { createState } from './match-card.js';
import { createShortlist } from '../core/shortlist.js';

const shortlist = createShortlist();

export function initShortlistPage() {
  const host = qs('#shortlist-items');
  const countHost = qs('#shortlist-count');
  const exportBtn = qs('#export-shortlist');
  const clearBtn = qs('#clear-shortlist');
  if (!host) return;

  function renderList() {
    const items = shortlist.list();

    if (countHost) countHost.textContent = t('shortlist.count', { count: items.length });

    if (!items.length) {
      render(host, [
        createState({
          mood: 'sleepy',
          title: t('shortlist.empty.title'),
          body: t('shortlist.empty.body'),
          action: el('a', { class: 'btn btn--primary', href: 'app.html', text: t('app.run') }),
        }),
      ]);
      return;
    }

    render(
      host,
      items.map((item) =>
        el('div', { class: 'shortlist-item' }, [
          el('div', {}, [
            el('h2', { class: 'shortlist-item__title' }, [
              el('a', {
                href: item.url || '#',
                target: '_blank',
                rel: 'noopener noreferrer',
                text: item.title,
              }),
            ]),
            el('p', {
              class: 'shortlist-item__meta',
              text: `${item.repo || ''} · #${item.number ?? '—'} · ${
                item.language || '—'
              } · saved ${relativeDate(item.addedAt)}`,
            }),
            el('div', { class: 'cluster' }, [
              ...(item.labels || []).map((label) => el('span', { class: 'badge', text: label })),
            ]),
          ]),
          el('div', { class: 'cluster' }, [
            el('a', {
              class: 'btn btn--sm btn--secondary',
              href: `issue.html?id=${encodeURIComponent(item.id)}`,
              text: t('app.coach'),
            }),
            el('button', {
              type: 'button',
              class: 'btn btn--sm btn--ghost',
              'aria-label': `${t('shortlist.remove')}: ${item.title}`,
              text: t('shortlist.remove'),
              onClick: () => {
                shortlist.remove(item.id);
                renderList();
              },
            }),
          ]),
        ])
      )
    );
  }

  exportBtn?.addEventListener('click', async () => {
    const markdown = shortlist.toMarkdown();
    const ok = await copyText(markdown);
    if (ok) showToast(t('shortlist.exported'), { type: 'success' });
    else {
      // Fall back to a download so the export is never lost.
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = el('a', { href: url, download: 'contribmatch-shortlist.md' });
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  });

  clearBtn?.addEventListener('click', () => {
    shortlist.clear();
    renderList();
  });

  renderList();
}
