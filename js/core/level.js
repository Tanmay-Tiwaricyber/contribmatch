/**
 * Level buckets (0–4) inferred from public activity.
 *
 * Buckets are deliberately coarse and explainable: a newcomer should be able
 * to see why the app thinks they are a beginner.
 *
 *   0 — new to public GitHub
 *   1 — learning (commits, no pull requests yet)
 *   2 — comfortable (commits and pull requests)
 *   3 — experienced (regular pull requests and reviews)
 *   4 — maintainer-level (sustained review and merge activity)
 */

export const LEVELS = [
  { value: 0, key: 'new', label: 'New to public GitHub' },
  { value: 1, key: 'learning', label: 'Learning' },
  { value: 2, key: 'comfortable', label: 'Comfortable' },
  { value: 3, key: 'experienced', label: 'Experienced' },
  { value: 4, key: 'maintainer', label: 'Maintainer level' },
];

/** @param {number} value */
export function levelLabel(value) {
  const found = LEVELS.find((l) => l.value === value);
  return found ? found.label : LEVELS[1].label;
}

/**
 * Weighted activity points.
 * Pull requests and reviews count double because they show collaboration,
 * not just typing.
 */
export function activityPoints(totals = {}) {
  const commits = Number(totals.commits) || 0;
  const pullRequests = Number(totals.pullRequests) || 0;
  const issues = Number(totals.issues) || 0;
  const reviews = Number(totals.reviews) || 0;
  return commits + pullRequests * 2 + issues + reviews * 2;
}

/**
 * Bucket a contributor into a level.
 * @param {object} totals {commits, pullRequests, issues, reviews}
 * @param {{repoCount?: number, accountYears?: number}} [extra]
 * @returns {number} 0–4
 */
export function bucketLevel(totals = {}, extra = {}) {
  const points = activityPoints(totals);
  const repoCount = Number(extra.repoCount) || 0;
  const years = Number(extra.accountYears) || 0;

  if (points === 0 && repoCount === 0) return 0;
  if (points < 10 && repoCount < 3) return 1;
  if (points < 40) return 2;
  if (points < 120) return 3;
  return 4;
}

/**
 * Explain a level decision in one line.
 * @param {number} level
 * @param {object} totals
 */
export function explainLevel(level, totals = {}) {
  const points = activityPoints(totals);
  const commits = Number(totals.commits) || 0;
  const prs = Number(totals.pullRequests) || 0;
  switch (level) {
    case 0:
      return 'No public commits or repositories found yet.';
    case 1:
      return `${commits} public commit${commits === 1 ? '' : 's'} and no pull requests yet.`;
    case 2:
      return `${commits} commits and ${prs} pull request${prs === 1 ? '' : 's'} — enough to start opening issues you own.`;
    case 3:
      return `${points} activity points: you already work in a pull request workflow.`;
    case 4:
      return `${points} activity points including reviews — you are comfortable maintaining code.`;
    default:
      return 'Activity level could not be determined.';
  }
}
