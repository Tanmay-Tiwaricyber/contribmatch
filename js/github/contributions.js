/**
 * Contribution data.
 *
 * Three providers, in order of accuracy:
 *
 *   1. exact        — GitHub GraphQL contribution calendar. Needs a token.
 *   2. approximate — public REST events for the last 90 days / 300 events,
 *                    widened to a year of the user's public issues and pull
 *                    requests from the search API (still no token).
 *   3. sample      — synthetic data, clearly labelled.
 *
 * Every provider returns the same shape:
 *   { days: [{date, count, byType}], totals, source }
 *
 * No scraping. No third-party contribution proxies.
 */

import { normalizeEvents, normalizeGraphQL, mergeAuthoredDays, toDayKey } from './normalize.js';

export const CONTRIBUTION_SOURCES = {
  GRAPHQL: 'graphql',
  EVENTS: 'events',
  EVENTS_YEAR: 'events-year',
  SAMPLE: 'sample',
};

/** Maximum search pages fetched per type (issues, pull requests). */
export const MAX_AUTHOR_PAGES = 2;

const GRAPHQL_QUERY = `query ContributionCalendar($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
    }
  }
}`;

/** Maximum public event pages fetched (300 events). */
export const MAX_EVENT_PAGES = 3;

/**
 * Provider 1 — exact calendar (GraphQL).
 * @param {object} client
 * @param {string} login
 */
export async function fetchExactContributions(client, login, { signal } = {}) {
  const data = await client.graphql(
    GRAPHQL_QUERY,
    { login },
    { signal }
  );
  const collection = data?.user?.contributionsCollection;
  if (!collection?.contributionCalendar) {
    throw new Error('GitHub did not return a contribution calendar for that user.');
  }
  const { contributionCalendar, ...totals } = collection;
  const normalized = normalizeGraphQL(contributionCalendar, {
    totals: {
      commits: totals.totalCommitContributions ?? 0,
      pullRequests: totals.totalPullRequestContributions ?? 0,
      issues: totals.totalIssueContributions ?? 0,
      reviews: totals.totalPullRequestReviewContributions ?? 0,
      total: contributionCalendar.totalContributions ?? 0,
    },
  });
  return { ...normalized, source: CONTRIBUTION_SOURCES.GRAPHQL };
}

/**
 * The search query for one year of the user's own public issues or pull
 * requests, starting at `sinceKey` (YYYY-MM-DD).
 * @param {string} login
 * @param {'pr'|'issue'} type
 * @param {string} sinceKey
 */
export function authoredSearchQuery(login, type, sinceKey) {
  return `author:${login} type:${type} created:>=${sinceKey}`;
}

/**
 * The year layer: the user's own public issues and pull requests for the
 * last year, from the search API. Same origin and rules as every other
 * GitHub call — queued, cached, no token needed.
 *
 * @param {object} client
 * @param {string} login
 * @param {{sinceKey?: string, signal?: AbortSignal}} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchAuthoredYear(client, login, { sinceKey, signal } = {}) {
  const items = [];
  for (const type of ['pr', 'issue']) {
    for (let page = 1; page <= MAX_AUTHOR_PAGES; page++) {
      const res = await client.searchIssues(
        authoredSearchQuery(login, type, sinceKey),
        { perPage: 100, page },
        { signal }
      );
      const batch = Array.isArray(res?.items) ? res.items : [];
      items.push(...batch);
      if (batch.length < 100) break;
    }
  }
  return items;
}

/**
 * Provider 2 — approximate calendar from public events, widened to a year of
 * the user's public issues and pull requests when the search API cooperates.
 *
 * The event detail (commits, reviews, comments) covers roughly the last 90
 * days; the year layer fills the older months with opens only. The recent
 * days are never doubled: search items inside the events window are skipped.
 *
 * @param {object} client
 * @param {string} login
 * @param {{signal?: AbortSignal, now?: Date}} [opts]
 */
export async function fetchApproximateContributions(client, login, { signal, now = new Date() } = {}) {
  const events = [];
  for (let page = 1; page <= MAX_EVENT_PAGES; page++) {
    const batch = await client.getPublicEvents(login, { perPage: 100, page }, { signal });
    if (!Array.isArray(batch) || batch.length === 0) break;
    events.push(...batch);
    if (batch.length < 100) break;
  }

  const recent = normalizeEvents(events, { days: 91, now });
  const base = { ...recent, source: CONTRIBUTION_SOURCES.EVENTS, eventCount: events.length };

  // The year layer is best effort: if search is rate limited or offline, the
  // 90-day approximation is what gets shown — degraded, clearly labelled,
  // never wrong.
  const windowStartKey = recent.days[0]?.date ?? '';
  if (!windowStartKey) return base;
  let items;
  try {
    const sinceKey = new Date(now.getTime() - 364 * 86400000).toISOString().slice(0, 10);
    items = await fetchAuthoredYear(client, login, { sinceKey, signal });
  } catch {
    return base;
  }

  const days = normalizeEvents(events, { days: 365, now });
  const merged = mergeAuthoredDays(days.days, items, { beforeKey: windowStartKey });
  const totals = { ...days.totals, total: 0 };
  let total = 0;
  for (const day of days.days) {
    day.count = day.byType.commits + day.byType.pullRequests + day.byType.issues + day.byType.reviews;
    for (const key of Object.keys(day.byType)) totals[key] += day.byType[key];
    total += day.count;
  }
  totals.total = total;
  return {
    days: days.days,
    totals,
    source: CONTRIBUTION_SOURCES.EVENTS_YEAR,
    eventCount: events.length,
    yearItems: items.length,
    merged,
  };
}

/**
 * Provider 3 — sample data.
 * @param {Array} sampleDays days produced by the mock generator
 */
export function sampleContributions(sampleDays = []) {
  const totals = { commits: 0, pullRequests: 0, issues: 0, reviews: 0, total: 0 };
  const days = sampleDays.map((day) => {
    const byType = {
      commits: day.byType?.commits ?? 0,
      pullRequests: day.byType?.pullRequests ?? 0,
      issues: day.byType?.issues ?? 0,
      reviews: day.byType?.reviews ?? 0,
    };
    const count =
      byType.commits + byType.pullRequests + byType.issues + byType.reviews ||
      day.count ||
      0;
    totals.commits += byType.commits;
    totals.pullRequests += byType.pullRequests;
    totals.issues += byType.issues;
    totals.reviews += byType.reviews;
    totals.total += count;
    return { date: day.date, count, byType };
  });
  return { days, totals, source: CONTRIBUTION_SOURCES.SAMPLE };
}

/**
 * The provider chain: exact when a token is available, otherwise approximate,
 * otherwise sample.
 *
 * @param {{client: object, login?: string, token?: string|null, sampleDays?: Array, cache?: object, signal?: AbortSignal}} opts
 * @returns {Promise<{days:Array, totals:object, source:string, notice?:string}>}
 */
export async function getContributions({
  client,
  login,
  token = null,
  sampleDays = [],
  cache,
  signal,
} = {}) {
  if (login && token) {
    const cacheKey = `contrib:exact:${login.toLowerCase()}`;
    const hit = cache?.get(cacheKey);
    if (hit) return { ...hit, cached: true };
    try {
      const result = await fetchExactContributions(client, login, { signal });
      cache?.set(cacheKey, result, 60 * 60 * 1000);
      return result;
    } catch (err) {
      // Fall through to the approximate provider rather than failing outright.
      const approx = await getContributions({
        client,
        login,
        token: null,
        sampleDays,
        cache,
        signal,
      });
      return {
        ...approx,
        notice:
          err.kind === 'bad-token' || err.kind === 'rate-limit'
            ? 'The token was rejected or limited, so the graph fell back to recent public activity.'
            : 'The exact calendar could not be read, so the graph fell back to recent public activity.',
      };
    }
  }

  if (login) {
    const cacheKey = `contrib:events:${login.toLowerCase()}`;
    const hit = cache?.get(cacheKey);
    if (hit) return { ...hit, cached: true };
    const result = await fetchApproximateContributions(client, login, { signal });
    cache?.set(cacheKey, result, 30 * 60 * 1000);
    return result;
  }

  return sampleContributions(sampleDays);
}

/**
 * Build a label for the source, used next to the graph.
 * @param {string} source
 */
export function sourceLabel(source) {
  switch (source) {
    case CONTRIBUTION_SOURCES.GRAPHQL:
      return 'Exact';
    case CONTRIBUTION_SOURCES.EVENTS:
    case CONTRIBUTION_SOURCES.EVENTS_YEAR:
      return 'Approximate';
    default:
      return 'Sample';
  }
}

/**
 * A truthful sentence about what the graph covers.
 * @param {string} source
 */
export function sourceNote(source) {
  switch (source) {
    case CONTRIBUTION_SOURCES.GRAPHQL:
      return 'Full contribution calendar from the GitHub GraphQL API.';
    case CONTRIBUTION_SOURCES.EVENTS_YEAR:
      return 'A full year of your public issues and pull requests, with commit and review detail from the last 90 days (approximate). Add a token for the exact calendar.';
    case CONTRIBUTION_SOURCES.EVENTS:
      return 'Based on recent public activity (approximate). Add a token for the full year.';
    default:
      return 'Sample data. Enter a GitHub username to see your own activity.';
  }
}

export { toDayKey };
