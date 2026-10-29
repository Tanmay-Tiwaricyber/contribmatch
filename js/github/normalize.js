/**
 * Normalisation helpers for GitHub payloads.
 *
 * Pure functions, no network, no DOM — unit tested directly.
 */

export const CONTRIBUTION_TYPES = ['commits', 'pullRequests', 'issues', 'reviews'];

/**
 * Map a GitHub event type to a contribution bucket.
 *
 * PushEvent                       -> commits
 * PullRequestEvent                -> pullRequests
 * IssuesEvent, IssueCommentEvent  -> issues
 * PullRequestReviewEvent,
 * PullRequestReviewCommentEvent   -> reviews
 *
 * @param {string} type
 * @returns {'commits'|'pullRequests'|'issues'|'reviews'|null}
 */
export function eventTypeToBucket(type) {
  switch (type) {
    case 'PushEvent':
      return 'commits';
    case 'PullRequestEvent':
      return 'pullRequests';
    case 'IssuesEvent':
    case 'IssueCommentEvent':
      return 'issues';
    case 'PullRequestReviewEvent':
    case 'PullRequestReviewCommentEvent':
      return 'reviews';
    default:
      return null;
  }
}

/**
 * How many contributions one event represents.
 * A PushEvent carries the number of commits in `payload.size`.
 */
export function eventWeight(event) {
  const bucket = eventTypeToBucket(event?.type);
  if (!bucket) return 0;
  if (bucket === 'commits') {
    const size = Number(event?.payload?.size);
    return Number.isFinite(size) && size > 0 ? size : 1;
  }
  return 1;
}

/** @param {string} dateISO */
export function toDayKey(dateISO) {
  return String(dateISO).slice(0, 10);
}

/**
 * Build a normalised day series from a list of GitHub events.
 * @param {object[]} events
 * @param {{days?: number, now?: Date}} [opts]
 * @returns {{days: Array<{date:string,count:number,byType:object}>, totals: object}}
 */
export function normalizeEvents(events = [], { days = 91, now = new Date() } = {}) {
  const buckets = new Map();
  const totals = { commits: 0, pullRequests: 0, issues: 0, reviews: 0, total: 0 };

  const start = new Date(now.getTime() - (days - 1) * 86400000);
  const startKey = start.toISOString().slice(0, 10);
  const endKey = now.toISOString().slice(0, 10);

  for (const event of events) {
    const bucket = eventTypeToBucket(event?.type);
    if (!bucket) continue;
    if (!event?.created_at) continue;
    const date = toDayKey(event.created_at);
    // Events outside the window are not counted at all, so the totals always
    // describe the same period the day series shows.
    if (date < startKey || date > endKey) continue;
    const weight = eventWeight(event);
    if (!buckets.has(date)) {
      buckets.set(date, { date, count: 0, byType: { commits: 0, pullRequests: 0, issues: 0, reviews: 0 } });
    }
    const entry = buckets.get(date);
    entry.count += weight;
    entry.byType[bucket] += weight;
    totals[bucket] += weight;
    totals.total += weight;
  }

  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    out.push(buckets.get(key) || { date: key, count: 0, byType: { commits: 0, pullRequests: 0, issues: 0, reviews: 0 } });
  }
  return { days: out, totals };
}

/**
 * Merge a year of authored public issues and pull requests (from the search
 * API) into an events-based day series. Each item counts as one open on its
 * `created_at` day — as a pull request when GitHub reports `pull_request` on
 * the item, otherwise as an issue.
 *
 * Items created at or after `beforeKey` are skipped: the events feed already
 * covers that window in detail, and counting both sources would double the
 * recent days.
 *
 * Mutates the given day entries and returns what was merged, so the caller
 * can update its totals.
 *
 * @param {Array<{date:string,count:number,byType:object}>} days a series wide enough to hold every item
 * @param {object[]} items raw /search/issues results
 * @param {{beforeKey?: string|null}} [opts] only items strictly before this day key merge
 * @returns {{pullRequests: number, issues: number}}
 */
export function mergeAuthoredDays(days, items = [], { beforeKey = null } = {}) {
  const index = new Map(days.map((day) => [day.date, day]));
  let pullRequests = 0;
  let issues = 0;
  for (const item of items) {
    if (!item?.created_at) continue;
    const date = toDayKey(item.created_at);
    const entry = index.get(date);
    if (!entry) continue;
    if (beforeKey && date >= beforeKey) continue;
    const bucket = item.pull_request ? 'pullRequests' : 'issues';
    entry.count += 1;
    entry.byType[bucket] += 1;
    if (bucket === 'pullRequests') pullRequests += 1;
    else issues += 1;
  }
  return { pullRequests, issues };
}

/**
 * Normalise a GraphQL contribution calendar.
 * @param {{weeks: Array<{contributionDays: Array<{date:string, contributionCount:number}>}>}} calendar
 * @param {{totals?: object}} [extra]
 */
export function normalizeGraphQL(calendar, extra = {}) {
  const totals = {
    commits: extra.totals?.commits ?? 0,
    pullRequests: extra.totals?.pullRequests ?? 0,
    issues: extra.totals?.issues ?? 0,
    reviews: extra.totals?.reviews ?? 0,
    total: extra.totals?.total ?? 0,
  };
  const days = [];
  for (const week of calendar?.weeks || []) {
    for (const day of week.contributionDays || []) {
      const count = Number(day.contributionCount) || 0;
      days.push({
        date: day.date,
        count,
        byType: { commits: 0, pullRequests: 0, issues: 0, reviews: 0 },
      });
    }
  }
  return { days, totals };
}

/**
 * Bucket a day count into one of five heat levels (0–4).
 * The thresholds are fixed so the graph is comparable across users.
 */
export function heatLevel(count) {
  const n = Number(count) || 0;
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 9) return 3;
  return 4;
}

/**
 * Normalise a raw GitHub issue into the shape the app uses.
 * @param {object} raw
 * @param {object} [repoMeta]
 */
export function normalizeIssue(raw, repoMeta = {}) {
  const repoUrl = raw.repository_url || '';
  const parts = repoUrl.split('/');
  const owner = parts[parts.length - 2] || repoMeta.owner || '';
  const repo = parts[parts.length - 1] || repoMeta.name || '';
  return {
    id: raw.id ?? `${owner}/${repo}#${raw.number}`,
    number: raw.number,
    title: raw.title || '',
    body: raw.body || '',
    repo: repo ? `${owner}/${repo}` : '',
    owner,
    language: repoMeta.language || '',
    labels: (raw.labels || []).map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean),
    comments: raw.comments ?? 0,
    createdAt: raw.created_at || '',
    updatedAt: raw.updated_at || '',
    assignees: (raw.assignees || []).map((a) => a.login).filter(Boolean),
    htmlUrl: raw.html_url || '',
    repoHealth: {
      stars: repoMeta.stargazers_count ?? 0,
      openIssues: repoMeta.open_issues_count ?? 0,
      pushedAt: repoMeta.pushed_at || '',
      hasContributing: Boolean(repoMeta.has_contributing),
      hasCodeOfConduct: Boolean(repoMeta.code_of_conduct),
      archived: Boolean(repoMeta.archived),
    },
  };
}

/**
 * GitHub login rules: 1–39 characters, alphanumeric or single hyphens, no
 * leading or trailing hyphen, no consecutive hyphens.
 */
export const LOGIN_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

/**
 * @param {string} login
 * @returns {{valid:boolean, error?:string}}
 */
export function validateLogin(login) {
  const value = String(login || '').trim();
  if (!value) return { valid: false, error: 'Enter a GitHub username.' };
  if (value.length > 39) return { valid: false, error: 'GitHub usernames are at most 39 characters.' };
  if (!LOGIN_RE.test(value)) {
    return {
      valid: false,
      error: 'A GitHub username can use letters, numbers and single hyphens, and cannot start or end with a hyphen.',
    };
  }
  return { valid: true };
}
