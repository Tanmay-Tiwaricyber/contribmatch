/**
 * The last matcher run.
 *
 * The issue page is deep-linkable: `issue.html?id=…` has to work even when
 * the link is opened in a new tab, so the shortlist of the last run is kept
 * locally rather than only for the session.
 *
 * It is public GitHub data, it is capped, and it expires.
 */

const KEY = 'contribmatch:v1:last-results';
const TTL_MS = 60 * 60 * 1000; // one hour
const MAX_ITEMS = 30;

/**
 * Save the issues from a run.
 * @param {Array<object>} issues
 */
export function saveLastRun(issues) {
  if (!Array.isArray(issues) || !issues.length) return;
  try {
    const payload = {
      savedAt: Date.now(),
      issues: issues.slice(0, MAX_ITEMS),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* localStorage may be unavailable or full */
  }
}

/**
 * The issues from the last run, or an empty list.
 * @returns {Array<object>}
 */
export function loadLastRun() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    if (!parsed.savedAt || Date.now() - Number(parsed.savedAt) > TTL_MS) {
      localStorage.removeItem(KEY);
      return [];
    }
    return Array.isArray(parsed.issues) ? parsed.issues : [];
  } catch {
    return [];
  }
}

/**
 * Find one issue from the last run.
 * @param {string|number} id
 * @returns {object|null}
 */
export function findLastRunIssue(id) {
  const list = loadLastRun();
  return list.find((item) => String(item.id) === String(id)) || null;
}

/**
 * Forget the last run.
 */
export function clearLastRun() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export { KEY as LAST_RUN_KEY, TTL_MS as LAST_RUN_TTL };
