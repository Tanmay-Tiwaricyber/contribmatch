/**
 * The contribution graph: event mapping, normalisation and the honesty rules.
 *
 * The graph must never claim to be more complete than it is, so the source
 * labels and notes are part of the contract.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  eventTypeToBucket,
  eventWeight,
  normalizeEvents,
  mergeAuthoredDays,
} from '../js/github/normalize.js';
import {
  fetchApproximateContributions,
  fetchAuthoredYear,
  authoredSearchQuery,
  sampleContributions,
  sourceLabel,
  sourceNote,
  CONTRIBUTION_SOURCES,
  MAX_EVENT_PAGES,
  MAX_AUTHOR_PAGES,
} from '../js/github/contributions.js';

const NOW = new Date('2026-06-15T12:00:00Z');

/** An ISO timestamp `daysAgo` days before now. */
function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

test('the event mapping covers the four contribution types', () => {
  const map = {
    PushEvent: 'commits',
    PullRequestEvent: 'pullRequests',
    IssuesEvent: 'issues',
    IssueCommentEvent: 'issues',
    PullRequestReviewEvent: 'reviews',
    PullRequestReviewCommentEvent: 'reviews',
  };
  for (const [type, bucket] of Object.entries(map)) {
    assert.equal(eventTypeToBucket(type), bucket);
  }
});

test('a push counts its commits, everything else counts as one', () => {
  assert.equal(eventWeight({ type: 'PushEvent', payload: { size: 4 } }), 4);
  assert.equal(eventWeight({ type: 'IssueCommentEvent' }), 1);
});

test('events outside the window are dropped by the normaliser', () => {
  const events = [
    { type: 'PushEvent', created_at: '2026-06-14T10:00:00Z', payload: { size: 1 } },
    { type: 'PushEvent', created_at: '2020-01-01T10:00:00Z', payload: { size: 99 } },
  ];
  const result = normalizeEvents(events, { days: 30, now: NOW });
  assert.equal(result.totals.commits, 1);
});

test('an event without a date is ignored', () => {
  const result = normalizeEvents([{ type: 'PushEvent', payload: { size: 3 } }], { days: 7, now: NOW });
  assert.equal(result.totals.commits, 0);
  assert.equal(result.days.length, 7);
});

test('the approximate provider reads the public events endpoint', async () => {
  const calls = [];
  const client = {
    async getPublicEvents(login, { perPage } = {}) {
      calls.push({ login, perPage });
      return [
        { type: 'PushEvent', created_at: daysAgo(1), payload: { size: 2 } },
        { type: 'PullRequestEvent', created_at: daysAgo(2) },
        { type: 'WatchEvent', created_at: daysAgo(2) },
      ];
    },
  };
  const result = await fetchApproximateContributions(client, 'octocat');
  assert.equal(result.source, CONTRIBUTION_SOURCES.EVENTS);
  assert.equal(result.totals.commits, 2);
  assert.equal(result.totals.pullRequests, 1);
  assert.equal(result.totals.total, 3);
  assert.equal(calls[0].login, 'octocat');
  assert.ok(calls[0].perPage <= 100);
});

test('the approximate provider asks for a bounded number of pages', () => {
  assert.ok(MAX_EVENT_PAGES <= 5, 'the event walk stays small');
  assert.ok(MAX_EVENT_PAGES * 100 <= 300, 'at most 300 events are read');
});

test('sample data is clearly labelled as sample', () => {
  const result = sampleContributions([
    { date: '2026-06-14', count: 3, byType: { commits: 2, pullRequests: 1 } },
  ]);
  assert.equal(result.source, CONTRIBUTION_SOURCES.SAMPLE);
  assert.equal(result.totals.commits, 2);
  assert.equal(result.totals.pullRequests, 1);
  assert.equal(result.totals.total, 3);
  assert.equal(sourceLabel(result.source), 'Sample');
});

test('each source has its own label and its own honest note', () => {
  assert.equal(sourceLabel(CONTRIBUTION_SOURCES.GRAPHQL), 'Exact');
  assert.equal(sourceLabel(CONTRIBUTION_SOURCES.EVENTS), 'Approximate');
  assert.equal(sourceLabel(CONTRIBUTION_SOURCES.SAMPLE), 'Sample');
  assert.equal(sourceLabel('something-else'), 'Sample');

  assert.match(sourceNote(CONTRIBUTION_SOURCES.GRAPHQL), /full contribution calendar/i);
  assert.match(sourceNote(CONTRIBUTION_SOURCES.EVENTS), /approximate/i);
  assert.match(sourceNote(CONTRIBUTION_SOURCES.SAMPLE), /sample/i);
});

test('the approximate note tells the reader how to get exact data', () => {
  assert.match(sourceNote(CONTRIBUTION_SOURCES.EVENTS), /add a token/i);
});

/* ------------------------------------------------------------------ *
 * The year layer.
 *
 * Without a token the graph now covers a full year of the user's public
 * issues and pull requests, merged behind the recent 90 days of event
 * detail. The contract: every open counts once, the recent window is never
 * doubled, and any failure degrades to the plain events approximation.
 * ------------------------------------------------------------------ */

test('mergeAuthoredDays buckets a search item as a pull request or an issue', () => {
  const days =[
    { date: '2026-01-01', count: 0, byType: { commits: 0, pullRequests: 0, issues: 0, reviews: 0 } },
    { date: '2026-01-02', count: 0, byType: { commits: 0, pullRequests: 0, issues: 0, reviews: 0 } },
    { date: '2026-01-03', count: 0, byType: { commits: 0, pullRequests: 0, issues: 0, reviews: 0 } },
  ];
  const merged = mergeAuthoredDays(days, [
    { created_at: '2026-01-01T10:00:00Z', pull_request: {} },
    { created_at: '2026-01-01T11:00:00Z', pull_request: {} },
    { created_at: '2026-01-02T11:00:00Z' },
    { created_at: '2026-01-02T11:00:00Z' },
  ]);
  assert.equal(merged.pullRequests, 2);
  assert.equal(merged.issues, 2);
  assert.equal(days[0].count, 2);
  assert.equal(days[0].byType.pullRequests, 2);
  assert.equal(days[1].count, 2);
  assert.equal(days[1].byType.issues, 2);
  assert.equal(days[2].count, 0);
});

test('mergeAuthoredDays skips the events window and unseen days', () => {
  const days = [
    { date: '2026-01-20', count: 0, byType: { commits: 0, pullRequests: 0, issues: 0, reviews: 0 } },
    { date: '2026-02-01', count: 0, byType: { commits: 0, pullRequests: 0, issues: 0, reviews: 0 } },
  ];
  // beforeKey is the start of the events window: items on or after it must
  // not merge, or recent PR opens would count twice.
  const merged = mergeAuthoredDays(
    days,
    [
      { created_at: '2026-02-01T10:00:00Z', pull_request: {} }, // on the boundary — skipped
      { created_at: '2026-01-19T00:00:00Z' },                   // before the series — no matching day
      { created_at: '2026-01-20T09:00:00Z' },                   // inside the series, before the window — merged
    ],
    { beforeKey: '2026-02-01' }
  );
  assert.equal(merged.pullRequests, 0);
  assert.equal(merged.issues, 1);
  assert.equal(days[0].count, 1);
  assert.equal(days[0].byType.issues, 1);
  assert.equal(days[1].count, 0);
});

test('the year layer asks the search API for a bounded number of pages', () => {
  assert.ok(MAX_AUTHOR_PAGES <= 5, 'the search walk stays small');
  assert.ok(MAX_AUTHOR_PAGES * 4 * 100 <= 1000, 'at most a handful of search results are read');
});

test('authoredSearchQuery scopes to the user, the type and the window', () => {
  const q = authoredSearchQuery('octocat', 'pr', '2025-10-29');
  assert.match(q, /author:octocat/);
  assert.match(q, /type:pr/);
  assert.match(q, /created:>=2025-10-29/);
});

test('the approximate provider widens to a year of opens, never doubling the recent window', async () => {
  const client = {
    async getPublicEvents() {
      return [
        { type: 'PushEvent', created_at: daysAgo(1), payload: { size: 2 } },
        { type: 'PullRequestEvent', created_at: daysAgo(2) },
      ];
    },
    async searchIssues(query) {
      assert.match(query, /created:>=/);
      if (query.includes('type:pr')) {
        return {
          items: [
            // Inside the events window — must be skipped (events already count it).
            { created_at: daysAgo(2), pull_request: {} },
            // Older than 90 days — the year layer's real payload.
            { created_at: daysAgo(120), pull_request: {} },
          ],
        };
      }
      return {
        items: [
          { created_at: daysAgo(200) },
          { created_at: daysAgo(340) },
        ],
      };
    },
  };
  const result = await fetchApproximateContributions(client, 'octocat');
  assert.equal(result.source, CONTRIBUTION_SOURCES.EVENTS_YEAR);
  assert.equal(result.days.length, 365);
  // 3 from recent events (2 commits + 1 PR open) + 3 year-layer opens,
  // the recent PR open skipped.
  assert.equal(result.totals.total, 6);
  assert.equal(result.yearItems, 4);
  assert.equal(result.merged.pullRequests, 1);
  assert.equal(result.merged.issues, 2);
  assert.equal(sourceLabel(result.source), 'Approximate');
  assert.match(sourceNote(result.source), /full year/i);
});

test('a failing year layer degrades to the plain events approximation', async () => {
  const client = {
    async getPublicEvents() {
      return [{ type: 'PushEvent', created_at: daysAgo(1), payload: { size: 1 } }];
    },
    async searchIssues() {
      const err = new Error('stopped');
      err.kind = 'rate-limit';
      err.limitType = 'primary';
      throw err;
    },
  };
  const result = await fetchApproximateContributions(client, 'octocat');
  assert.equal(result.source, CONTRIBUTION_SOURCES.EVENTS);
  assert.equal(result.days.length, 91);
  assert.equal(result.totals.commits, 1);
  assert.match(sourceNote(result.source), /approximate/i);
});

test('fetchAuthoredYear stops paging a type once a short page arrives', async () => {
  const queries = [];
  const client = {
    async searchIssues(query, { page } = {}) {
      queries.push({ query, page });
      if (query.includes('type:pr')) {
        // Page 1 fills the batch (so page 2 happens); page 2 is short (so it stops).
        return {
          items:
            page === 1
              ? Array.from({ length: 100 }, (_, i) => ({ created_at: '2026-01-05T00:00:00Z', number: i }))
              : Array.from({ length: 3 }, (_, i) => ({ created_at: '2026-01-06T00:00:00Z', number: i })),
        };
      }
      // The issue query is empty on page 1, so it never asks for page 2.
      return { items: [] };
    },
  };
  const items = await fetchAuthoredYear(client, 'octocat', { sinceKey: '2025-10-29' });
  assert.ok(queries.some((q) => q.query.includes('type:pr') && q.page === 2));
  assert.ok(queries.every((q) => !(q.query.includes('type:issue') && q.page === 2)));
  assert.equal(items.length, 103);
});
