/**
 * Match card, score ring and result states.
 */

import { el, relativeDate, formatNumber } from './dom.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { createMascot } from './mascot.js';

/**
 * The band a score falls in. The colours are checked in
 * tools/contrast.mjs; each one clears 3:1 against the card surface.
 * @param {number} score
 * @returns {'low'|'mid'|'high'}
 */
export function scoreBand(score = 0) {
  const value = Number(score) || 0;
  if (value < 40) return 'low';
  if (value < 70) return 'mid';
  return 'high';
}

/**
 * A score ring drawn as SVG.
 * The track is stroked with the control-border token so it stays at least
 * 3:1 against the card background.
 */
export function createScoreRing(score = 0, { size = 48 } = {}) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, Number(score) || 0));

  const wrap = el('div', { class: 'score', style: { width: `${size}px`, height: `${size}px` } });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');

  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('class', 'score__track');
  track.setAttribute('cx', '24');
  track.setAttribute('cy', '24');
  track.setAttribute('r', String(radius));

  const progress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progress.setAttribute('class', 'score__value');
  // The ring is restroked by band, so a low score is legible as well as
  // merely different. Every band colour clears 3:1 on the card.
  progress.dataset.band = scoreBand(value);
  progress.setAttribute('cx', '24');
  progress.setAttribute('cy', '24');
  progress.setAttribute('r', String(radius));
  progress.setAttribute('stroke-dasharray', String(circumference));
  progress.setAttribute('stroke-dashoffset', String(circumference * (1 - value / 100)));

  svg.append(track, progress);
  wrap.append(svg, el('span', { class: 'score__label', text: String(value) }));
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `${t('app.score')}: ${value} of 100`);
  return wrap;
}

/**
 * A match card.
 * @param {object} issue a ranked issue
 * @param {{saved?: boolean, onSave?: Function, onCoach?: Function}} [opts]
 */
export function createMatchCard(issue, { saved = false, onSave, onCoach } = {}) {
  const card = el('article', { class: 'match' });

  const head = el('div', { class: 'match__head' }, [
    createScoreRing(issue.score ?? issue.ruleScore ?? 0),
    el('div', {}, [
      el('h3', { class: 'match__title' }, [
        el('a', {
          href: issue.htmlUrl || '#',
          target: '_blank',
          rel: 'noopener noreferrer',
          text: issue.title,
        }),
      ]),
      el('p', { class: 'match__repo', text: `${issue.repo || ''} · #${issue.number ?? '—'}` }),
    ]),
  ]);

  const why = el('div', {});
  why.append(el('p', { class: 'eyebrow', text: t('app.whyFits') }));
  if (issue.reasons?.length) {
    const list = el('ul', { class: 'match__reasons' });
    for (const reason of issue.reasons.slice(0, 4)) {
      list.append(el('li', { text: reason }));
    }
    why.append(list);
  } else {
    why.append(el('p', { class: 'match__why muted', text: '—' }));
  }
  if (issue.modelNote) {
    why.append(
      el('p', { class: 'match__why' }, [
        el('strong', { class: 'mono', text: `${t('app.modelNote')}: ` }),
        issue.modelNote,
      ])
    );
  }

  const labels = el('div', { class: 'cluster' });
  for (const label of issue.labels || []) {
    labels.append(el('span', { class: 'badge', text: label }));
  }
  if (!issue.labels?.length) {
    labels.append(el('span', { class: 'badge badge--warning', text: 'No labels' }));
  }

  const health = issue.repoHealth || {};
  const healthText = health.archived
    ? t('app.repoHealth.archived')
    : health.hasContributing
      ? t('app.repoHealth.healthy')
      : t('app.repoHealth.quiet');

  const facts = el('div', { class: 'match__facts' }, [
    el('span', { text: `${issue.language || '—'}` }),
    el('span', { text: `${issue.comments ?? 0} comments` }),
    el('span', { text: `updated ${relativeDate(issue.updatedAt)}` }),
    el('span', { text: `${formatNumber(health.stars || 0)} stars` }),
    el('span', { text: healthText }),
    el('span', {
      text: issue.rated ? t('app.rated') : t('app.ruleOnly'),
    }),
  ]);

  const saveBtn = el('button', {
    type: 'button',
    class: `btn btn--sm ${saved ? 'btn--secondary' : 'btn--primary'}`,
    'aria-pressed': String(saved),
  });
  saveBtn.append(icon('check', { size: 14 }), el('span', { text: saved ? t('app.saved') : t('app.save') }));
  saveBtn.addEventListener('click', () => {
    onSave?.(issue);
  });

  const coachBtn = el('a', {
    class: 'btn btn--sm btn--secondary',
    href: `issue.html?id=${encodeURIComponent(issue.id)}`,
    text: t('app.coach'),
  });

  const foot = el('div', { class: 'match__foot' }, [
    el('div', { class: 'cluster' }, [facts]),
    el('div', { class: 'cluster' }, [
      coachBtn,
      saveBtn,
      el('a', {
        class: 'btn btn--sm btn--ghost',
        href: issue.htmlUrl || '#',
        target: '_blank',
        rel: 'noopener noreferrer',
        text: t('app.open'),
      }),
    ]),
  ]);

  card.append(head, why, labels, foot);
  return card;
}

/**
 * An empty or error state with the mascot.
 * @param {{mood?: string, title: string, body?: string, action?: HTMLElement}} opts
 */
export function createState({ mood = 'idle', title, body, action }) {
  const wrapper = el('div', { class: 'state' });
  wrapper.append(createMascot({ mood, size: 'md' }));
  wrapper.append(el('h2', { class: 'state__title', text: title }));
  if (body) wrapper.append(el('p', { class: 'state__body', text: body }));
  if (action) wrapper.append(action);
  return wrapper;
}
