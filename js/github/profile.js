/**
 * Public profile reader.
 *
 * Reads only public data: the user, their public repositories, and the
 * language byte counts for the most recently pushed repositories.
 *
 * All requests share the app's GitHub request gate, so the two "parallel"
 * calls below actually run one after the other.
 */

import { normalizeIssue } from './normalize.js';

/** How many repositories are inspected for language statistics. */
const LANGUAGE_REPO_BUDGET = 3;

/** Profile and repo metadata are cached for 15 minutes. */
export const PROFILE_TTL = 15 * 60 * 1000;

/** Kinds of failure worth falling back to a stale cached copy. */
function canUseStale(err) {
  return ['rate-limit', 'network', 'server', 'queue-full'].includes(err?.kind);
}

/**
 * @param {object} client github client
 * @param {string} login
 * @param {{signal?: AbortSignal, cache?: object}} [opts]
 */
export async function fetchProfile(client, login, { signal, cache } = {}) {
  const cacheKey = `profile:${login.toLowerCase()}`;
  if (cache) {
    const hit = cache.get(cacheKey);
    if (hit) return hit;
  }

  let user;
  let repos;
  try {
    [user, repos] = await Promise.all([
      client.getUser(login, { signal }),
      client.getRepos(login, { perPage: 100, sort: 'pushed' }, { signal }),
    ]);
  } catch (err) {
    if (cache && canUseStale(err)) {
      const stale = cache.stale(cacheKey);
      if (stale) return { ...stale, stale: true, staleNotice: 'This profile comes from an older cached copy; GitHub limited the fresh request.' };
    }
    throw err;
  }

  const owned = Array.isArray(repos) ? repos : [];
  const reposToInspect = owned.slice(0, LANGUAGE_REPO_BUDGET);

  const languageBytes = {};

  // One request per inspected repository. The repository list already
  // carries the primary language, stars and topics, so no extra metadata
  // request is needed here.
  for (const repo of reposToInspect) {
    try {
      const langs = await client.getLanguages(repo.owner.login, repo.name, { signal });
      for (const [lang, bytes] of Object.entries(langs || {})) {
        languageBytes[lang] = (languageBytes[lang] || 0) + bytes;
      }
    } catch {
      // A repository that cannot be read is skipped; the rest still work.
    }
  }

  const totalBytes = Object.values(languageBytes).reduce((a, b) => a + b, 0) || 1;
  const languages = {};
  for (const [lang, bytes] of Object.entries(languageBytes)) {
    languages[lang] = Math.round((bytes / totalBytes) * 100);
  }

  const profile = {
    login: user.login,
    name: user.name || user.login,
    avatarUrl: user.avatar_url || '',
    bio: user.bio || '',
    followers: user.followers ?? 0,
    publicRepos: user.public_repos ?? owned.length,
    totalStars: owned.reduce((sum, r) => sum + (r.stargazers_count || 0), 0),
    createdAt: user.created_at || '',
    accountYears: user.created_at
      ? (Date.now() - Date.parse(user.created_at)) / (365.25 * 86400000)
      : 0,
    repos: owned.slice(0, 12).map((r) => ({
      name: r.name,
      language: r.language || '',
      stars: r.stargazers_count || 0,
      forks: r.forks_count || 0,
      pushedAt: r.pushed_at || '',
      topics: r.topics || [],
    })),
    languages,
    topics: Array.from(new Set(owned.flatMap((r) => r.topics || []))).slice(0, 10),
  };

  if (cache) cache.set(cacheKey, profile, PROFILE_TTL);
  return profile;
}

/**
 * Fetch a repository's metadata (language, stars, health signals).
 * @param {object} client
 * @param {string} fullName "owner/repo"
 */
export async function fetchRepoMeta(client, fullName, { signal, cache } = {}) {
  const cacheKey = `repo:${fullName.toLowerCase()}`;
  if (cache) {
    const hit = cache.get(cacheKey);
    if (hit) return hit;
  }
  const [owner, name] = fullName.split('/');
  let meta;
  try {
    meta = await client.getRepo(owner, name, { signal });
  } catch (err) {
    if (cache && canUseStale(err)) {
      const stale = cache.stale(cacheKey);
      // A stale metadata copy keeps the issue usable; it is flagged so the
      // caller knows it may be minutes old.
      if (stale) return { ...stale, stale: true };
    }
    throw err;
  }
  const info = {
    owner,
    name,
    language: meta.language || '',
    stargazers_count: meta.stargazers_count ?? 0,
    open_issues_count: meta.open_issues_count ?? 0,
    pushed_at: meta.pushed_at || '',
    has_contributing: Boolean(meta.has_contributing),
    code_of_conduct: Boolean(meta.code_of_conduct),
    archived: Boolean(meta.archived),
  };
  if (cache) cache.set(cacheKey, info, PROFILE_TTL);
  return info;
}

export { normalizeIssue };
