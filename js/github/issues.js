/**
 * Issue search — the Scout agent's data source.
 *
 * Uses the public GitHub search API. The `language:` qualifier works on issue
 * searches, so the language filter runs on GitHub's side and needs no extra
 * request per repository.
 *
 * Requests stay low on purpose and every one of them goes through the shared
 * request gate (one at a time, paced, rate-limit aware):
 *   - one search per (label, language) pair, each cached for 5 minutes
 *   - repository metadata for a bounded number of unique repositories,
 *     fetched in small batches (the gate serialises them) and cached 15 min
 */

import { normalizeIssue } from './normalize.js';
import { fetchRepoMeta } from './profile.js';

/** Labels that mark an issue as open to newcomers. */
export const SCOUT_LABELS = ['good first issue', 'help wanted', 'hacktoberfest'];

/** Maximum repository lookups per search (each one is a GitHub request). */
export const MAX_REPO_LOOKUPS = 10;

/** How many languages are searched separately. */
export const MAX_LANGUAGES = 3;

/** Cache lifetime for search results. */
export const SEARCH_TTL = 5 * 60 * 1000;

/** Cache lifetime for repository metadata. */
export const REPO_TTL = 15 * 60 * 1000;

/**
 * Build the list of search queries for a set of languages.
 *
 * For each language, the most useful label is searched with the language
 * qualifier. The remaining labels are searched once without a language, so a
 * contributor always sees more than one kind of issue.
 *
 * @param {string[]} languages
 * @returns {Array<{query: string, label: string, language: string}>}
 */
export function buildQueries(languages = []) {
  const queries = [];
  const wanted = languages.filter(Boolean).slice(0, MAX_LANGUAGES);

  const [primary, ...rest] = SCOUT_LABELS;

  for (const language of wanted) {
    queries.push({
      query: `is:issue is:open no:assignee label:"${primary}" language:${language}`,
      label: primary,
      language,
    });
  }

  for (const label of rest) {
    queries.push({
      query: `is:issue is:open no:assignee label:"${label}"`,
      label,
      language: '',
    });
  }

  if (!wanted.length) {
    queries.push({ query: `is:issue is:open no:assignee label:"${primary}"`, label: primary, language: '' });
  }

  return queries;
}

/**
 * @param {object} client
 * @param {{languages?: string[], limit?: number, signal?: AbortSignal, cache?: object, maxRepoLookups?: number}} opts
 * @returns {Promise<object[]>} normalised issues
 */
export async function searchIssues(client, opts = {}) {
  const {
    languages = [],
    limit = 40,
    signal,
    cache,
    maxRepoLookups = MAX_REPO_LOOKUPS,
  } = opts;

  const queries = buildQueries(languages);
  const raw = [];
  let usedStale = false;

  /** Kinds of failure where a slightly old search result beats an empty page. */
  const canUseStale = (err) =>
    ['rate-limit', 'network', 'server', 'queue-full'].includes(err?.kind);

  for (const spec of queries) {
    const cacheKey = `search:${spec.query}`;
    let page = null;
    if (cache) {
      const hit = cache.get(cacheKey);
      if (hit) page = hit;
    }
    if (!page) {
      try {
        const data = await client.searchIssues(spec.query, { perPage: 50 }, { signal });
        page = data?.items || [];
        if (cache) cache.set(cacheKey, page, SEARCH_TTL);
      } catch (err) {
        if (cache && canUseStale(err)) {
          const stale = cache.stale(cacheKey);
          if (stale) {
            page = stale;
            usedStale = true;
          }
        }
        if (!page) throw err;
      }
    }
    for (const item of page) {
      raw.push({ item, language: spec.language, label: spec.label });
    }
  }

  // De-duplicate by issue id, keeping the first occurrence and its language.
  const seen = new Set();
  const unique = raw.filter(({ item }) => {
    const key = item.id ?? `${item.repository_url}#${item.number}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Repository metadata for health signals, bounded and cached.
  const repoNames = Array.from(
    new Set(
      unique
        .map(({ item }) => String(item.repository_url || '').split('/').slice(-2).join('/'))
        .filter(Boolean)
    )
  );
  const metaByRepo = new Map();
  const toFetch = repoNames.slice(0, maxRepoLookups);
  const BATCH = 4;
  for (let i = 0; i < toFetch.length; i += BATCH) {
    const batch = toFetch.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (fullName) => {
        try {
          return [fullName, await fetchRepoMeta(client, fullName, { signal, cache })];
        } catch {
          // A repository we cannot read is skipped; the issue stays usable.
          return [fullName, null];
        }
      })
    );
    for (const [fullName, meta] of results) {
      if (meta) metaByRepo.set(fullName, meta);
    }
  }

  let issues = unique.map(({ item, language }) => {
    const fullName = String(item.repository_url || '').split('/').slice(-2).join('/');
    const meta = metaByRepo.get(fullName) || {};
    return normalizeIssue(item, { ...meta, language: meta.language || language });
  });

  issues = issues.filter((issue) => !issue.repoHealth.archived);

  if (usedStale) {
    // Flag every issue that came from an older cached search so the UI can
    // say it may be a few minutes old instead of silently presenting it.
    for (const issue of issues) issue.stale = true;
  }

  return issues.slice(0, limit);
}

/**
 * Offline variant used by sample mode.
 * @param {{languages?: string[], limit?: number}} opts
 */
export function mockSearchIssues({ languages = [], limit = 40 } = {}, allIssues = []) {
  let issues = allIssues;
  if (languages.length) {
    const wanted = languages.map((l) => l.toLowerCase());
    const matching = issues.filter(
      (issue) => issue.language && wanted.includes(issue.language.toLowerCase())
    );
    // Keep the sample list useful: if no language matches, show everything.
    if (matching.length) issues = matching;
  }
  return issues.slice(0, limit);
}
