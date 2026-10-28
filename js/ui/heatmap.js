/**
 * Contribution heatmap.
 *
 * A CSS grid of 7 rows (days of the week) by up to 53 columns (weeks).
 * Colours run from a paper-tinted empty cell to the accent blue — never
 * GitHub green.
 *
 * Accessibility:
 *  - roving tabindex: one cell is in the tab order, arrow keys move around it
 *  - every cell has a text label, so colour is never the only signal
 *  - a visually hidden table carries the same data
 *  - a live region announces the hovered or focused day
 */

import { el, clear } from './dom.js';
import { heatLevel } from '../github/normalize.js';

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Group a flat day list into week columns (Sunday first).
 * @param {Array<{date:string,count:number,byType:object}>} days
 */
export function groupIntoWeeks(days = []) {
  if (!days.length) return [];
  const weeks = [];
  let current = [];

  for (const day of days) {
    const date = new Date(`${day.date}T00:00:00Z`);
    const dow = date.getUTCDay();
    if (dow === 0 && current.length) {
      weeks.push(current);
      current = [];
    }
    current.push(day);
  }
  if (current.length) weeks.push(current);
  return weeks;
}

/**
 * @param {{days: Array, source: string, maxWeeks?: number, animate?: boolean, labels?: object}} opts
 */
export function createHeatmap({ days = [], source = 'sample', maxWeeks = null, animate = true, labels = {} } = {}) {
  const weeks = groupIntoWeeks(days);
  // Small screens show the last 26 weeks; wider screens scroll the full year.
  const narrow = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches;
  const limit = maxWeeks ?? (narrow ? 26 : 53);
  const visibleWeeks = weeks.slice(-limit);
  const flat = visibleWeeks.flat();

  const L = {
    less: labels.less || 'Less',
    more: labels.more || 'More',
    mon: 'Mon',
    wed: 'Wed',
    fri: 'Fri',
  };

  const root = el('div', { class: 'heat' });

  // --- Month labels --------------------------------------------------------
  const monthGrid = el('div', { class: 'heat__months' });
  let lastMonth = -1;
  visibleWeeks.forEach((week, index) => {
    const first = week[0];
    if (!first) return;
    const month = new Date(`${first.date}T00:00:00Z`).getUTCMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      const label = el('span', { class: 'heat__month', text: MONTHS[month] });
      label.style.gridColumn = `${index + 1} / span 4`;
      monthGrid.append(label);
    }
  });

  // --- Cells ---------------------------------------------------------------
  // The visual grid is seven weekday rows by up to 53 week columns, which is
  // exactly the shape of an ARIA grid, so the rows are real elements.
  const grid = el('div', {
    class: 'heat__grid',
    role: 'grid',
    'aria-label': labels.summary || 'Contribution activity',
    'aria-rowcount': '7',
    'aria-colcount': String(visibleWeeks.length),
  });
  grid.style.setProperty('--cols', String(visibleWeeks.length));
  if (animate) grid.dataset.animate = 'true';

  const cells = [];
  const rowElements = [];
  for (let row = 0; row < 7; row++) {
    const rowEl = el('div', { class: 'heat__row', role: 'row' });
    rowElements.push(rowEl);
    grid.append(rowEl);
  }

  visibleWeeks.forEach((week, colIndex) => {
    for (let row = 0; row < 7; row++) {
      const day = week[row];
      const cell = el('button', {
        type: 'button',
        class: 'heat__cell',
        role: 'gridcell',
        tabindex: '-1',
      });
      cell.style.gridColumn = String(colIndex + 1);
      cell.style.gridRow = String(row + 1);
      if (!day) {
        cell.dataset.empty = 'true';
        cell.setAttribute('aria-hidden', 'true');
        cell.disabled = true;
        rowElements[row].append(cell);
        cells.push(null);
        continue;
      }
      const level = heatLevel(day.count);
      cell.dataset.level = String(level);
      cell.dataset.date = day.date;
      cell.dataset.count = String(day.count);
      cell.dataset.index = String(cells.length);
      cell.dataset.col = String(colIndex);
      cell.dataset.row = String(row);
      // Fade in by column; the whole sequence stays under 600ms.
      if (animate) cell.style.animationDelay = `${Math.min(colIndex * 6, 320)}ms`;
      const parts = [];
      if (day.byType?.commits) parts.push(`${day.byType.commits} commits`);
      if (day.byType?.pullRequests) parts.push(`${day.byType.pullRequests} pull requests`);
      if (day.byType?.issues) parts.push(`${day.byType.issues} issues`);
      if (day.byType?.reviews) parts.push(`${day.byType.reviews} reviews`);
      cell.setAttribute(
        'aria-label',
        `${day.date}: ${day.count} contribution${day.count === 1 ? '' : 's'}${
          parts.length ? ` (${parts.join(', ')})` : ''
        }`
      );
      rowElements[row].append(cell);
      cells.push(cell);
    }
  });

  // Roving tabindex: the first real cell is the entry point.
  const focusable = cells.filter(Boolean);
  if (focusable.length) focusable[0].tabIndex = 0;

  const weekdayColumn = el('div', { class: 'heat__weekdays', 'aria-hidden': 'true' });
  WEEKDAY_LABELS.forEach((label) => {
    weekdayColumn.append(el('span', { class: 'heat__weekday', text: label }));
  });

  const columns = el('div', { class: 'heat__cols' }, [monthGrid, grid]);
  const body = el('div', { class: 'heat__body' }, [weekdayColumn, columns]);

  const scroll = el('div', { class: 'heat__scroll' }, [body]);

  // --- Tooltip -------------------------------------------------------------
  const tip = el('div', { class: 'heat__tip', role: 'status', 'aria-live': 'polite' });

  function showTip(cell) {
    if (!cell || !cell.dataset.date) return;
    const count = Number(cell.dataset.count || 0);
    tip.textContent = `${cell.dataset.date} — ${count} contribution${count === 1 ? '' : 's'}`;
    tip.dataset.open = 'true';
    const rect = cell.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - tipRect.width / 2),
      window.innerWidth - tipRect.width - 8
    );
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, rect.top - tipRect.height - 8)}px`;
  }

  function hideTip() {
    tip.dataset.open = 'false';
  }

  grid.addEventListener('mouseover', (event) => {
    const cell = event.target.closest('.heat__cell');
    if (cell && cell.dataset.date) showTip(cell);
  });
  grid.addEventListener('mouseleave', hideTip);
  grid.addEventListener('focusin', (event) => {
    const cell = event.target.closest('.heat__cell');
    if (cell && cell.dataset.date) showTip(cell);
  });
  grid.addEventListener('focusout', hideTip);

  // --- Keyboard navigation --------------------------------------------------
  grid.addEventListener('keydown', (event) => {
    const cell = event.target.closest('.heat__cell');
    if (!cell || !cell.dataset.date) return;
    const col = Number(cell.dataset.col);
    const row = Number(cell.dataset.row);
    let target = null;

    switch (event.key) {
      case 'ArrowLeft':
        target = cellAt(col - 1, row);
        break;
      case 'ArrowRight':
        target = cellAt(col + 1, row);
        break;
      case 'ArrowUp':
        target = cellAt(col, row - 1);
        break;
      case 'ArrowDown':
        target = cellAt(col, row + 1);
        break;
      case 'Home':
        target = cellAt(0, row);
        break;
      case 'End':
        target = cellAt(visibleWeeks.length - 1, row);
        break;
      case 'PageUp':
        target = cellAt(col - 4, row);
        break;
      case 'PageDown':
        target = cellAt(col + 4, row);
        break;
      default:
        return;
    }

    event.preventDefault();
    if (!target) return;
    focusable.forEach((c) => {
      c.tabIndex = -1;
    });
    target.tabIndex = 0;
    target.focus();
  });

  function cellAt(col, row) {
    if (col < 0 || col >= visibleWeeks.length || row < 0 || row > 6) return null;
    const week = visibleWeeks[col];
    const day = week[row];
    if (!day) return null;
    return grid.querySelector(`.heat__cell[data-date="${day.date}"]`);
  }

  // --- Legend ---------------------------------------------------------------
  const legendScale = el('div', { class: 'heat__legend-scale', 'aria-hidden': 'true' });
  for (let level = 0; level <= 4; level++) {
    legendScale.append(el('span', { class: 'heat__legend-cell', dataset: { level: String(level) } }));
  }
  const legend = el('div', { class: 'heat__legend' }, [
    el('span', { text: L.less }),
    legendScale,
    el('span', { text: L.more }),
  ]);

  // --- Hidden data table ----------------------------------------------------
  const table = buildDataTable(flat, labels.tableCaption || 'Daily contributions');

  root.append(scroll, legend, tip, table);
  return root;
}

/**
 * A visually hidden table carrying the same data as the grid.
 */
function buildDataTable(days, caption) {
  const wrap = el('div', { class: 'sr-only' });
  const table = el('table');
  const captionEl = el('caption', { text: caption });
  const head = el('tr', {}, [
    el('th', { scope: 'col', text: 'Date' }),
    el('th', { scope: 'col', text: 'Contributions' }),
  ]);
  table.append(captionEl, el('thead', {}, [head]));
  const body = el('tbody');
  for (const day of days) {
    body.append(
      el('tr', {}, [
        el('th', { scope: 'row', text: day.date }),
        el('td', { text: String(day.count) }),
      ])
    );
  }
  table.append(body);
  wrap.append(table);
  return wrap;
}

/**
 * Render the type breakdown bars.
 * @param {{byType: object, labels: object}} opts
 */
export function createBreakdown({ byType = {}, labels = {} }) {
  const rows = [
    ['commits', labels.commits || 'Commits'],
    ['pullRequests', labels.pullRequests || 'Pull requests'],
    ['issues', labels.issues || 'Issues'],
    ['reviews', labels.reviews || 'Reviews'],
  ];
  const total = rows.reduce((sum, [key]) => sum + (Number(byType[key]) || 0), 0) || 1;

  const root = el('div', { class: 'breakdown' });
  for (const [key, label] of rows) {
    const value = Number(byType[key]) || 0;
    const pct = Math.round((value / total) * 100);
    const fill = el('div', { class: 'breakdown__fill' });
    fill.style.width = `${value === 0 ? 0 : Math.max(2, pct)}%`;
    root.append(
      el('div', { class: 'breakdown__row' }, [
        el('span', { class: 'breakdown__label', text: label }),
        el('div', {
          class: 'breakdown__track',
          role: 'img',
          'aria-label': `${label}: ${value}`,
        }, [fill]),
        el('span', { class: 'breakdown__value tnum', text: String(value) }),
      ])
    );
  }
  return root;
}

export { clear };
