#!/usr/bin/env node
/**
 * Refresh the static issue catalogue: data/issues.json.
 *
 *   node tools/refresh-catalogue.mjs
 *
 * Environment:
 *   CATALOGUE_TOKEN        — optional GitHub token (read-only public data).
 *                            Anonymous runs share the 10 searches/minute
 *                            Search quota; 3 queries are made.
 *   CATALOGUE_LANGUAGES    — comma-separated language filter, e.g. "python".
 *   CATALOGUE_MAX_ISSUES   — catalogue size cap (default 120).
 *   CATALOGUE_PER_PAGE     — page size per search (default 30, max 100).
 *
 * The tool writes the file only when the refresh fully succeeds; on failure
 * the previous valid catalogue is left untouched. It never logs or stores
 * the token.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildQueries } from '../js/github/issues.js';

const API = 'https://api.github.com';
const FILE = new URL('../data/issues.json', import.meta.url);

/** Flatten a GitHub search item into a small catalogue entry. */
export function normalizeEntry(item, { language = '' } = {}) {
  const repoUrl = String(item.repository_url || '');
  const parts = repoUrl.split('/');
  const repo = parts.slice(-2).join('/') || item.repo || '';
  return {
    id: item.id,
    number: item.number,
    title: String(item.title || '').trim().slice(0, 200),
    url: item.html_url || '',
    repo,
    labels: (Array.isArray(item.labels) ? item.labels : [])
      .map((l) => (typeof l === 'object' ? l.name : l))
      .filter(Boolean)
      .slice(0, 12),
    state: item.state === 'closed' ? 'closed' : 'open',
    createdAt: item.created_at || '',
    updatedAt: item.updated_at || '',
    body: excerpt(item.body),
    language: language || '',
  };
}

/** Short, plain-text excerpt of an issue body (no invented data). */
function excerpt(text, max = 400) {
  const raw = String(text || '');
  if (!raw) return '';
  const flat = raw.replace(/\r/g, ' ').replace(/\n+/g, ' ');
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Pure core of the refresh: merge search pages into a catalogue manifest.
 * @param {Array<{items: object[], language: string, query: string}>} pages
 * @param {{now?: Date}} [opts]
 * @returns {{manifest: object, duplicateCount: number}}
 */
export function buildCatalogue(pages, { now = new Date() } = {}) {
  const byId = new Map();
  let duplicateCount = 0;
  for (const page of pages) {
    for (const item of page.items || []) {
      if (!item || typeof item !== 'object') continue;
      if (item.state === 'closed') continue; // only open, actionable issues
      const entry = normalizeEntry(item, { language: page.language });
      if (!entry.id || !entry.url || !entry.repo || !entry.title) continue;
      if (byId.has(entry.id)) {
        duplicateCount += 1;
        continue;
      }
      byId.set(entry.id, entry);
    }
  }
  const manifest = {
    version: 1,
    fetchedAt: now.toISOString(),
    source: 'github-search-api',
    queries: pages.map((p) => p.query),
    count: byId.size,
    duplicateCount,
    issues: Array.from(byId.values()),
  };
  return { manifest, duplicateCount };
}

/**
 * @param {object[]} pages raw {items} per query
 */
async function fetchQueries(queries, { token, perPage }) {
  const baseHeaders = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  // Header-only construction; the token is never logged or persisted.
  const headers = token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders;
  const pages = [];
  for (const spec of queries) {
    const url = `${API}/search/issues?q=${encodeURIComponent(spec.query)}&per_page=${perPage}&page=1`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Search failed: HTTP ${res.status} for "${spec.label}"`);
    }
    const data = await res.json();
    pages.push({ items: data.items || [], language: spec.language, query: spec.query, label: spec.label });
  }
  return pages;
}

async function main() {
  const token = String(process.env.CATALOGUE_TOKEN || '').trim();
  const languages = String(process.env.CATALOGUE_LANGUAGES || '')
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);
  const maxIssues = Math.max(1, Number(process.env.CATALOGUE_MAX_ISSUES || 120));
  const perPage = Math.min(100, Math.max(1, Number(process.env.CATALOGUE_PER_PAGE || 30)));

  // Keep the count bounded: the scout's own three-shape query plan.
  const queries = [
    ...buildQueries(languages).slice(0, 3),
    { query: 'is:issue is:open no:assignee label:"good first issue"', label: 'good first issue', language: '' },
  ].slice(0, 4);

  const previous = await readFile(FILE, 'utf8')
    .then((raw) => JSON.parse(raw))
    .catch(() => null);
  const previousCount = Array.isArray(previous?.issues) ? previous.issues.length : 0;

  console.log(`Refreshing catalogue (${queries.length} searches, ${maxIssues} issue cap)…`);
  const pages = await fetchQueries(queries, { token, perPage });
  const { manifest, duplicateCount } = buildCatalogue(pages);
  if (manifest.issues.length === 0) {
    throw new Error('No usable issues were collected; keeping the previous catalogue.');
  }

  const issues = manifest.issues.slice(0, maxIssues);
  const out = { ...manifest, count: issues.length, issues, requested: manifest.count };
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(FILE, `${JSON.stringify(out, null, 2)}\n`);

  console.log(
    `Catalogue refreshed: ${issues.length} issues (was ${previousCount}, dropped ${duplicateCount} duplicates).`
  );
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(`Catalogue refresh FAILED: ${err.message}`);
    // A non-zero exit keeps the previous catalogue as the published one.
    process.exit(1);
  });
}
