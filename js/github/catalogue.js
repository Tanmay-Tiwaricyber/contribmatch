/**
 * Static issue catalogue ("Layer A").
 *
 * A versioned `data/issues.json` file is generated periodically by
 * `node tools/refresh-catalogue.mjs` (locally or by the scheduled GitHub
 * Actions workflow). It lets the matcher start from a list of already
 * verified, open, beginner-labelled issues without making GitHub API
 * requests for every visitor.
 *
 * THE CATALOGUE NEVER CONTAINS FABRICATED DATA: what is in the file came
 * from real GitHub search responses at refresh time. When the catalogue is
 * missing, empty or older than the configured freshness window, the app
 * falls back to the live search API — cached and queued as usual.
 */

/** How old the catalogue may be before live search is preferred. */
export const CATALOGUE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** How long a successfully loaded catalogue stays in the session cache. */
export const CATALOGUE_LOAD_TTL_MS = 10 * 60 * 1000;

function isoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : '';
}

/**
 * Validate + normalise a loaded catalogue manifest. Never invents fields and
 * never reports success for a file that is not readable as a catalogue.
 *
 * @param {any} manifest parsed JSON of data/issues.json
 * @param {{maxAgeMs?: number, now?: number}} [opts]
 * @returns {{ok: boolean, error: string|null, stale: boolean, fetchedAt: string|null, ageMs: number|null, issues: object[]}}
 */
export function readCatalogue(manifest, { maxAgeMs = CATALOGUE_MAX_AGE_MS, now = Date.now() } = {}) {
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, error: 'The catalogue file could not be read.', stale: false, fetchedAt: null, ageMs: null, issues: [] };
  }
  if (!Array.isArray(manifest.issues)) {
    return { ok: false, error: 'The catalogue file has no issue list.', stale: false, fetchedAt: null, ageMs: null, issues: [] };
  }

  const fetchedAt = isoDate(manifest.fetchedAt);
  const issuedAt = fetchedAt ? Date.parse(fetchedAt) : null;
  const ageMs = issuedAt != null ? Math.max(0, now - issuedAt) : null;
  const neverRefreshed = fetchedAt === '';
  const stale = neverRefreshed || (ageMs != null && ageMs > maxAgeMs);

  // Keep only entries that are genuinely usable: a stable id, a title, a
  // GitHub URL and a repository. Everything else is descriptive.
  const issues = manifest.issues.filter(
    (e) =>
      e && typeof e === 'object' &&
      (typeof e.id === 'number' || typeof e.id === 'string') &&
      e.title && e.url && e.repo && String(e.repo).includes('/')
  );

  return {
    ok: true,
    error: neverRefreshed ? 'The catalogue has never been refreshed.' : null,
    stale,
    fetchedAt: fetchedAt || null,
    ageMs,
    issues,
  };
}

/**
 * Turn validated catalogue entries into the issue shape the ranker, match
 * cards and coach consume (same field names `normalizeIssue` produces).
 *
 * @param {object[]} entries validated catalogue entries
 * @param {{languages?: string[], onlyOpen?: boolean}} [opts]
 */
export function issuesFromCatalogue(entries, { languages = [], onlyOpen = true } = {}) {
  const wanted = languages.map((l) => String(l).toLowerCase());
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    const key = String(entry.id);
    if (!key || seen.has(key)) continue; // dedupe across overlapping searches
    seen.add(key);
    if (onlyOpen && entry.state && entry.state !== 'open') continue;

    const [owner, name] = String(entry.repo).split('/');
    const language = entry.language || '';
    if (wanted.length && language && !wanted.includes(language.toLowerCase())) continue;

    out.push({
      id: entry.id,
      number: entry.number ?? null,
      title: String(entry.title || ''),
      body: String(entry.body || ''),
      repo: `${owner}/${name}`,
      owner,
      language,
      labels: (Array.isArray(entry.labels) ? entry.labels : []).map(String).filter(Boolean),
      comments: 0,
      createdAt: isoDate(entry.createdAt),
      updatedAt: isoDate(entry.updatedAt),
      assignees: [],
      htmlUrl: String(entry.url || ''),
      repoHealth: { stars: 0, openIssues: 0, pushedAt: '', hasContributing: false, hasCodeOfConduct: false, archived: false },
      fromCatalogue: true,
    });
  }
  return out;
}

/**
 * Pick the catalogue issues that fit the wanted languages. When no language
 * filter applies, or nothing matches, a wider cut is better than an empty
 * page — same policy the live search uses.
 *
 * @param {object[]} issues
 * @param {{languages?: string[], limit?: number}} [opts]
 */
export function eligibleFromCatalogue(issues, { languages = [], limit = 40 } = {}) {
  const wanted = languages.map((l) => String(l).toLowerCase()).filter(Boolean);
  let list = issues;
  if (wanted.length) {
    const matching = issues.filter(
      (issue) => issue.language && wanted.includes(issue.language.toLowerCase())
    );
    if (matching.length) list = matching;
  }
  // Older refreshes first at the bottom; newest activity first.
  return list
    .slice()
    .sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0))
    .slice(0, limit);
}

/** In-session catalogue store (survives a re-render, not a page reload). */
const sessionCache = new Map();

/**
 * Load and validate the catalogue. In-memory caching keeps repeated search
 * runs from re-parsing the file; the browser's HTTP cache handles the rest.
 *
 * @param {{url?: string, fetchImpl?: typeof fetch, maxAgeMs?: number, now?: number}} [opts]
 * @returns {Promise<{ok:boolean, error:string|null, stale:boolean, fetchedAt:string|null, ageMs:number|null, issues:object[]}>}
 */
export async function fetchCatalogue({ url = 'data/issues.json', fetchImpl, maxAgeMs = CATALOGUE_MAX_AGE_MS, now = Date.now() } = {}) {
  const doFetch = fetchImpl || globalThis.fetch.bind(globalThis);
  const cached = sessionCache.get(url);
  if (cached && now - cached.at < CATALOGUE_LOAD_TTL_MS) return cached.value;

  let result;
  try {
    const res = await doFetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      result = { ok: false, error: `The catalogue request responded ${res.status}.`, stale: false, fetchedAt: null, ageMs: null, issues: [] };
    } else {
      const manifest = await res.json();
      result = readCatalogue(manifest, { maxAgeMs, now });
    }
  } catch (err) {
    result = { ok: false, error: `The catalogue file could not be loaded: ${err.message}`, stale: false, fetchedAt: null, ageMs: null, issues: [] };
  }

  sessionCache.set(url, { at: now, value: result });
  return result;
}

/** Forget the session cache (after a refresh or a test). */
export function clearCatalogueCache() {
  sessionCache.clear();
}
