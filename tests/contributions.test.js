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
} from '../js/github/normalize.js';
import {
  fetchApproximateContributions,
  sampleContributions,
  sourceLabel,
  sourceNote,
  CONTRIBUTION_SOURCES,
  MAX_EVENT_PAGES,
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
