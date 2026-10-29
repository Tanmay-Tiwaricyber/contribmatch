/**
 * The 3D contribution scene behind the hero.
 *
 * It is built from the same contribution data the activity panel shows, so
 * the picture on the wall is the contributor's real activity rather than a
 * decorative loop. The scene is decorative: it is hidden from assistive
 * technology and never takes pointer events.
 */

import { el } from './dom.js';
import { heatLevel } from '../github/normalize.js';

const ROWS = 7;

/**
 * How many weeks the wall shows.
 *
 * The wall never shows more history than the data actually covers: an
 * events-only graph covers about three months, so the wall does too, while
 * a year-layered approximation (public issues and pull requests) shows a
 * full year.
 */
function weeksFor(source, dayCount) {
  if (source === 'events') return Math.max(4, Math.min(13, Math.ceil(dayCount / 7)));
  return Math.max(4, Math.min(53, Math.ceil(dayCount / 7)));
}

/**
 * @param {{days?: Array, source?: string, sourceLabel?: string}} contributions
 * @returns {HTMLElement}
 */
export function createHeroScene(contributions = {}) {
  const days = contributions.days || [];
  const totals = contributions.totals || {};
  const source = contributions.source || 'sample';

  const scene = el('div', { class: 'scene', 'aria-hidden': 'true' });
  const stage = el('div', { class: 'scene__stage' });

  // --- The wall ------------------------------------------------------------
  const wall = el('div', { class: 'scene__wall' });
  const weeks = chunkWeeks(days).slice(-weeksFor(source, days.length));

  for (const week of weeks) {
    for (let row = 0; row < ROWS; row++) {
      const day = week[row];
      const cell = el('div', { class: 'scene__cell' });
      cell.dataset.level = String(day ? heatLevel(day.count) : 0);
      wall.append(cell);
    }
  }
  const label = contributions.sourceLabel || 'Sample';
  wall.append(
    el('span', {
      class: 'scene__wall-label',
      text: `${label} · ${weeks.length} weeks`,
    })
  );
  stage.append(wall);

  // --- Panel A: the headline number ---------------------------------------
  const panelA = el('div', { class: 'scene__panel scene__panel--a' });
  panelA.append(el('p', { class: 'scene__panel-label', text: 'Commits' }));
  panelA.append(
    el('p', { class: 'scene__panel-value' }, [
      document.createTextNode(String(totals.commits ?? 0)),
      el('span', { text: source === 'events' ? 'recent' : 'this year' }),
    ])
  );
  stage.append(panelA);

  // --- Panel B: the type breakdown ----------------------------------------
  const panelB = el('div', { class: 'scene__panel scene__panel--b' });
  panelB.append(el('p', { class: 'scene__panel-label', text: 'Pull requests' }));
  panelB.append(
    el('p', { class: 'scene__panel-value' }, [
      document.createTextNode(String(totals.pullRequests ?? 0)),
    ])
  );
  panelB.append(
    el('div', { class: 'scene__panel-bars' }, [
      bar('Commits', totals.commits, totals.total),
      bar('Pull requests', totals.pullRequests, totals.total),
      bar('Issues', totals.issues, totals.total, true),
    ])
  );
  stage.append(panelB);

  // --- Panel C: the level --------------------------------------------------
  const panelC = el('div', { class: 'scene__panel scene__panel--c' });
  panelC.append(el('p', { class: 'scene__panel-label', text: 'Reviews' }));
  panelC.append(
    el('p', { class: 'scene__panel-value' }, [
      document.createTextNode(String(totals.reviews ?? 0)),
    ])
  );
  stage.append(panelC);

  scene.append(stage);
  return scene;
}

/**
 * @param {number} value
 * @param {number} total
 * @param {boolean} muted
 */
function bar(label, value, total, muted = false) {
  const share = total ? Math.round(((value || 0) / total) * 100) : 0;
  const track = el('div', { class: 'scene__panel-bar' });
  if (muted) track.dataset.tone = 'muted';
  const fill = el('i');
  fill.style.width = `${Math.max(share, value ? 4 : 0)}%`;
  track.append(fill);
  track.setAttribute('role', 'img');
  track.setAttribute('aria-label', `${label}: ${value || 0}`);
  return track;
}

/**
 * Group a flat day list into week columns, Sunday first.
 * @param {Array<{date:string,count:number}>} days
 */
function chunkWeeks(days) {
  const weeks = [];
  let current = [];
  for (const day of days) {
    const dow = new Date(`${day.date}T00:00:00Z`).getUTCDay();
    if (dow === 0 && current.length) {
      weeks.push(current);
      current = [];
    }
    current.push(day);
  }
  if (current.length) weeks.push(current);
  return weeks;
}
