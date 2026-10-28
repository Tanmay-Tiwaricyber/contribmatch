/**
 * Issue page — the coaching plan for one issue.
 *
 * The issue comes from the shortlist or from the last matcher run, both of
 * which are local. Nothing is fetched from the server.
 */

import { el, qs, render, relativeDate } from './dom.js';
import { t } from './i18n.js';
import { showToast } from './toast.js';
import { createState } from './match-card.js';
import { createCopyButton } from './copy.js';
import { createSettings } from '../core/settings.js';
import { createShortlist } from '../core/shortlist.js';
import { findLastRunIssue } from '../core/last-run.js';
import { createOrchestrator } from '../core/orchestrator.js';
import { createMockProvider } from '../core/mock/mock-provider.js';
import { buildProvider } from './app-page.js';

const settings = createSettings();
const shortlist = createShortlist();

/**
 * Find the issue behind a deep link: first in the shortlist, then in the
 * last matcher run.
 * @param {string|number} id
 * @returns {object|null}
 */
function findIssue(id) {
  const list = shortlist.list();
  const hit = list.find((item) => String(item.id) === String(id));
  if (hit) return hit;
  return findLastRunIssue(id);
}

export function initIssuePage() {
  const host = qs('#issue-content');
  if (!host) return;

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const issue = id ? findIssue(id) : null;

  if (!issue) {
    render(host, [
      createState({
        mood: 'oops',
        title: id ? t('issue.notFound') : t('issue.missing'),
        body: t('issue.missingBody'),
        action: el('a', { class: 'btn btn--primary', href: 'app.html', text: t('app.run') }),
      }),
    ]);
    return;
  }

  render(host, [
    el('p', { class: 'eyebrow', text: `${issue.repo || ''} · #${issue.number ?? '—'}` }),
    el('h1', { class: 'page__title' }, [
      el('a', {
        href: issue.url || '#',
        target: '_blank',
        rel: 'noopener noreferrer',
        text: issue.title,
      }),
    ]),
    el('div', { class: 'cluster' }, [
      el('span', { class: 'badge badge--accent', text: issue.language || '—' }),
      ...(issue.labels || []).map((label) => el('span', { class: 'badge', text: label })),
      el('span', { class: 'badge', text: `updated ${relativeDate(issue.updatedAt)}` }),
    ]),
    el('div', { id: 'plan-host' }),
  ]);

  const planHost = qs('#plan-host');
  const current = settings.get();
  const mock = current.mockMode || current.provider === 'mock';

  let provider = null;
  try {
    provider = buildProvider(current);
  } catch {
    provider = mock ? createMockProvider() : null;
  }

  const orchestrator = createOrchestrator({ provider, mock });

  render(planHost, [
    el('div', { class: 'skeleton skeleton--title' }),
    el('div', { class: 'skeleton skeleton--line' }),
    el('div', { class: 'skeleton skeleton--line short' }),
  ]);

  orchestrator
    .coach(issue, { skills: [], languages: [issue.language], level: 1 })
    .then((plan) => {
      renderPlan(planHost, plan, issue);
    })
    .catch((err) => {
      render(planHost, [
        createState({
          mood: 'oops',
          title: t('common.error'),
          body: err.message,
        }),
      ]);
    });
}

function renderPlan(host, plan, issue) {
  const guard = plan.guard || { verdict: 'ok', warnings: [] };

  const explanation = el('section', { class: 'card' }, [
    el('h2', { class: 'card__title', text: t('issue.explanation') }),
    el('p', { class: 'card__body', text: plan.explanation }),
  ]);

  const files = el('section', { class: 'card' }, [
    el('h2', { class: 'card__title', text: t('issue.files') }),
    el('ul', { class: 'card__body' }, (plan.files || []).map((file) => el('li', { class: 'mono', text: file }))),
  ]);

  const planList = el('section', { class: 'card' }, [
    el('h2', { class: 'card__title', text: t('issue.plan') }),
    el('ol', { class: 'card__body' }, (plan.plan || []).map((step) => el('li', { text: step }))),
  ]);

  const commentBox = el('pre', { text: plan.comment || '' });
  const comment = el('section', { class: 'code' }, [
    el('div', { class: 'code__head' }, [
      el('span', { class: 'code__lang', text: 'github issue comment' }),
      createCopyButton(() => plan.comment || '', {
        label: t('issue.copy'),
        doneLabel: t('issue.copied'),
      }),
    ]),
    commentBox,
  ]);

  const commentNote = el('p', { class: 'activity__note', text: t('issue.commentNote') });

  const checklist = el('section', { class: 'card' }, [
    el('h2', { class: 'card__title', text: t('issue.checklist') }),
    el('ul', { class: 'card__body' }, (plan.checklist || []).map((item) => el('li', { text: item }))),
  ]);

  const guardTitle =
    guard.verdict === 'block'
      ? t('issue.quality.block')
      : guard.verdict === 'warn'
        ? t('issue.quality.warn')
        : t('issue.quality.ok');

  const quality = el('section', { class: `notice notice--${guard.verdict === 'ok' ? 'info' : 'warning'}` }, [
    el('div', {}, [
      el('h2', { class: 'card__title', text: t('issue.quality') }),
      el('p', { text: guardTitle }),
      el(
        'ul',
        {},
        (guard.warnings || []).map((warning) => el('li', { text: warning }))
      ),
    ]),
  ]);

  render(host, [
    explanation,
    el('div', { class: 'grid grid--2' }, [files, planList]),
    el('section', {}, [
      el('h2', { class: 'card__title', text: t('issue.comment') }),
      comment,
      commentNote,
    ]),
    checklist,
    quality,
    el('p', {}, [
      el('a', { class: 'btn btn--secondary', href: 'app.html', text: t('issue.back') }),
    ]),
  ]);

  if (guard.verdict !== 'ok') {
    showToast(guardTitle, { type: 'error' });
  }
}

export { findIssue };
