/**
 * GitHub payload parsing and normalisation.
 *
 * These functions turn raw GitHub responses into the shapes the app works
 * with, so they are pure and directly testable.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  eventTypeToBucket,
  eventWeight,
  toDayKey,
  normalizeEvents,
  normalizeGraphQL,
  normalizeIssue,
  heatLevel,
  validateLogin,
  CONTRIBUTION_TYPES,
} from '../js/github/normalize.js';

test('each event type maps to the right contribution bucket', () => {
  assert.equal(eventTypeToBucket('PushEvent'), 'commits');
  assert.equal(eventTypeToBucket('PullRequestEvent'), 'pullRequests');
  assert.equal(eventTypeToBucket('IssuesEvent'), 'issues');
  assert.equal(eventTypeToBucket('IssueCommentEvent'), 'issues');
  assert.equal(eventTypeToBucket('PullRequestReviewEvent'), 'reviews');
  assert.equal(eventTypeToBucket('PullRequestReviewCommentEvent'), 'reviews');
});

test('an unknown event type is ignored', () => {
  assert.equal(eventTypeToBucket('WatchEvent'), null);
  assert.equal(eventTypeToBucket('ForkEvent'), null);
  assert.equal(eventTypeToBucket(''), null);
});

test('a push event counts every commit it carries', () => {
  assert.equal(eventWeight({ type: 'PushEvent', payload: { size: 7 } }), 7);
  assert.equal(eventWeight({ type: 'PushEvent', payload: {} }), 1);
  assert.equal(eventWeight({ type: 'PullRequestEvent' }), 1);
  assert.equal(eventWeight({ type: 'WatchEvent' }), 0);
});

test('a day key is the ISO date', () => {
  assert.equal(toDayKey('2026-06-15T10:22:33Z'), '2026-06-15');
});

test('events normalise into one entry per day with type totals', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const events = [
    { type: 'PushEvent', created_at: '2026-06-14T10:00:00Z', payload: { size: 3 } },
    { type: 'PushEvent', created_at: '2026-06-14T18:00:00Z', payload: { size: 2 } },
    { type: 'PullRequestEvent', created_at: '2026-06-14T19:00:00Z' },
    { type: 'PullRequestReviewEvent', created_at: '2026-06-13T09:00:00Z' },
    { type: 'IssuesEvent', created_at: '2026-06-13T09:30:00Z' },
    { type: 'WatchEvent', created_at: '2026-06-13T09:45:00Z' },
  ];
  const result = normalizeEvents(events, { days: 7, now });

  assert.equal(result.days.length, 7);
  assert.equal(result.totals.commits, 5);
  assert.equal(result.totals.pullRequests, 1);
  assert.equal(result.totals.reviews, 1);
  assert.equal(result.totals.issues, 1);
  assert.equal(result.totals.total, 8);

  const day = result.days.find((d) => d.date === '2026-06-14');
  assert.equal(day.count, 6);
  assert.equal(day.byType.commits, 5);
  assert.equal(day.byType.pullRequests, 1);
});

test('the normalised series always covers the requested window', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const result = normalizeEvents([], { days: 91, now });
  assert.equal(result.days.length, 91);
  assert.equal(result.days[0].date, '2026-03-17');
  assert.equal(result.days.at(-1).date, '2026-06-15');
  assert.ok(result.days.every((d) => d.count === 0));
});

test('a GraphQL calendar normalises into days', () => {
  const calendar = {
    weeks: [
      {
        contributionDays: [
          { date: '2026-06-14', contributionCount: 4 },
          { date: '2026-06-15', contributionCount: 0 },
        ],
      },
    ],
  };
  const result = normalizeGraphQL(calendar, {
    totals: { commits: 4, total: 4 },
  });
  assert.equal(result.days.length, 2);
  assert.equal(result.days[0].count, 4);
  assert.equal(result.totals.commits, 4);
  for (const type of CONTRIBUTION_TYPES) {
    assert.equal(result.days[0].byType[type], 0);
  }
});

test('heat levels use five fixed buckets', () => {
  assert.equal(heatLevel(0), 0);
  assert.equal(heatLevel(-3), 0);
  assert.equal(heatLevel(1), 1);
  assert.equal(heatLevel(2), 1);
  assert.equal(heatLevel(3), 2);
  assert.equal(heatLevel(5), 2);
  assert.equal(heatLevel(6), 3);
  assert.equal(heatLevel(9), 3);
  assert.equal(heatLevel(10), 4);
  assert.equal(heatLevel('7'), 3);
});

test('an issue normalises into the shape the app uses', () => {
  const issue = normalizeIssue(
    {
      id: 42,
      number: 7,
      title: 'Fix the typo',
      body: 'Body text',
      repository_url: 'https://api.github.com/repos/octo/hello',
      labels: [{ name: 'good first issue' }, { name: 'docs' }],
      comments: 3,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
      assignees: [{ login: 'octo' }],
      html_url: 'https://github.com/octo/hello/issues/7',
    },
    {
      language: 'JavaScript',
      stargazers_count: 1200,
      open_issues_count: 8,
      pushed_at: '2026-06-01T00:00:00Z',
      has_contributing: true,
      code_of_conduct: { key: 'contributors' },
      archived: false,
    }
  );

  assert.equal(issue.id, 42);
  assert.equal(issue.repo, 'octo/hello');
  assert.equal(issue.owner, 'octo');
  assert.equal(issue.language, 'JavaScript');
  assert.deepEqual(issue.labels, ['good first issue', 'docs']);
  assert.deepEqual(issue.assignees, ['octo']);
  assert.equal(issue.repoHealth.stars, 1200);
  assert.equal(issue.repoHealth.hasContributing, true);
  assert.equal(issue.repoHealth.hasCodeOfConduct, true);
  assert.equal(issue.repoHealth.archived, false);
});

test('an issue without repository metadata still normalises', () => {
  const issue = normalizeIssue({
    number: 1,
    title: 'x',
    repository_url: 'https://api.github.com/repos/a/b',
  });
  assert.equal(issue.repo, 'a/b');
  assert.equal(issue.language, '');
  assert.equal(issue.repoHealth.stars, 0);
  assert.equal(issue.repoHealth.archived, false);
});

test('usernames are validated before they reach the API', () => {
  assert.equal(validateLogin('octocat').valid, true);
  assert.equal(validateLogin('a-b-c').valid, true);
  assert.equal(validateLogin('A1').valid, true);
  assert.equal(validateLogin('').valid, false);
  assert.equal(validateLogin('   ').valid, false);
  assert.equal(validateLogin('-leading').valid, false);
  assert.equal(validateLogin('trailing-').valid, false);
  assert.equal(validateLogin('double--hyphen').valid, false);
  assert.equal(validateLogin('has space').valid, false);
  assert.equal(validateLogin('has/slash').valid, false);
  assert.equal(validateLogin('a'.repeat(40)).valid, false);
  assert.ok(validateLogin('has space').error.length > 0);
});
