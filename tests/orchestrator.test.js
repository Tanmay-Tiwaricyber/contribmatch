/**
 * The whole flow, offline.
 *
 * The orchestrator is DOM-free, so it can be driven from Node exactly as the
 * browser drives it. This is the end-to-end test: profile -> scout -> rank ->
 * coach -> quality guard, with the mock provider and mock data.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createOrchestrator, mockContributions } from '../js/core/orchestrator.js';
import { createMockProvider } from '../js/core/mock/mock-provider.js';
import { MOCK_ISSUES, MOCK_PROFILE } from '../js/core/mock/mock-data.js';
import { getContributions, sourceLabel, sourceNote, CONTRIBUTION_SOURCES } from '../js/github/contributions.js';
import { bucketLevel } from '../js/core/level.js';
import { ruleChecks } from '../js/core/agents.js';

function makeOrchestrator(overrides = {}) {
  return createOrchestrator({
    mock: true,
    provider: createMockProvider(),
    ...overrides,
  });
}

test('the mock data set is large enough to be a convincing demo', () => {
  assert.ok(MOCK_ISSUES.length >= 12, 'at least twelve sample issues');
  const languages = new Set(MOCK_ISSUES.map((i) => i.language).filter(Boolean));
  assert.ok(languages.size >= 3, 'several languages are represented');
});

test('the full match runs offline and returns ranked issues', async () => {
  const orchestrator = makeOrchestrator();
  const steps = [];
  const result = await orchestrator.match({ limit: 20 }, { onStep: (s) => steps.push(s) });

  assert.ok(Array.isArray(result.issues));
  assert.ok(result.issues.length > 0, 'issues were found');
  assert.ok(steps.length > 0, 'the flow reported steps');
  assert.ok(
    steps.some((s) => s.message && /profile|repositories/i.test(s.message)),
    'the profile step ran'
  );
});

test('ranked issues are sorted by score and carry reasons', async () => {
  const orchestrator = makeOrchestrator();
  const result = await orchestrator.match({ limit: 20 });
  const scores = result.issues.map((i) => i.score);
  const sorted = [...scores].sort((a, b) => b - a);
  assert.deepEqual(scores, sorted);
  assert.ok(result.issues[0].reasons.length > 0, 'the top issue explains itself');
});

test('every issue carries a score between 0 and 100', async () => {
  const orchestrator = makeOrchestrator();
  const result = await orchestrator.match({ limit: 20 });
  for (const issue of result.issues) {
    assert.ok(issue.score >= 0 && issue.score <= 100, `score ${issue.score}`);
  }
});

test('the profile agent infers a level and skills from the mock profile', async () => {
  const orchestrator = makeOrchestrator();
  const result = await orchestrator.readProfile({ login: 'sample' });
  assert.ok(result.level >= 0 && result.level <= 4);
  assert.ok(Array.isArray(result.skills));
  assert.ok(result.summary.length > 0);
});

test('the flow still works when the provider fails completely', async () => {
  class BrokenProvider {
    label = 'broken';
    async generate() {
      throw new Error('model unavailable');
    }
  }
  const orchestrator = createOrchestrator({ mock: true, provider: new BrokenProvider() });
  const result = await orchestrator.match({ limit: 10 });
  assert.ok(result.issues.length > 0, 'the rule-based path still returns matches');
  assert.ok(result.issues.every((i) => typeof i.score === 'number'));
});

test('the coach produces a plan, a comment and a quality guard result', async () => {
  const orchestrator = makeOrchestrator();
  const result = await orchestrator.match({ limit: 5 });
  const issue = result.issues[0];
  const coached = await orchestrator.coach(issue, result.profileResult);

  assert.ok(Array.isArray(coached.plan));
  assert.ok(coached.plan.length > 0, 'the plan has steps');
  assert.equal(typeof coached.comment, 'string');
  assert.ok(coached.comment.length > 0, 'the comment is not empty');
  assert.ok(coached.guard, 'the quality guard ran');
  assert.ok(Array.isArray(coached.guard.warnings), 'the guard reports warnings');
});

test('the rule checks catch a thin comment and an ignored contributing guide', () => {
  const warnings = ruleChecks({
    comment: '   ',
    plan: [],
    issue: { repoHealth: { hasContributing: false } },
  });
  assert.ok(Array.isArray(warnings));
  assert.ok(warnings.length >= 3, 'a one word comment is flagged several ways');
  const text = warnings.join(' | ').toLowerCase();
  assert.match(text, /short/);
  assert.match(text, /test/);
  assert.match(text, /contributing/);
});

test('a careful comment with a real plan passes the rule checks', () => {
  const warnings = ruleChecks({
    comment:
      'I read the CONTRIBUTING.md guide and will follow it. My plan is to add a regression test in the existing test file, update the documentation, and run the test suite locally before opening the pull request.',
    plan: ['Read the code', 'Write the test', 'Update the docs', 'Run the tests'],
    issue: { labels: ['good first issue'] },
  });
  assert.deepEqual(warnings, []);
});

test('the mock contribution graph is labelled as a sample', () => {
  const contributions = mockContributions(120);
  assert.equal(contributions.source, CONTRIBUTION_SOURCES.SAMPLE);
  assert.equal(contributions.days.length, 120);
  assert.equal(sourceLabel(contributions.source), 'Sample');
  assert.match(sourceNote(contributions.source), /sample/i);
});

test('the contribution chain prefers exact data when a token is present', async () => {
  const calls = [];
  const client = {
    async graphql(query) {
      calls.push({ query });
      return {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              weeks: [
                { contributionDays: [{ date: new Date().toISOString().slice(0, 10), contributionCount: 3 }] },
              ],
            },
            totalCommitContributions: 3,
            totalPullRequestContributions: 0,
            totalIssueContributions: 0,
            totalPullRequestReviewContributions: 0,
          },
        },
      };
    },
    async getPublicEvents() {
      throw new Error('the events endpoint should not be used');
    },
  };
  const result = await getContributions({ client, login: 'octocat', token: 'test-token' });
  assert.equal(result.source, CONTRIBUTION_SOURCES.GRAPHQL);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].query.includes('contributionsCollection'));
});

test('without a token the chain falls back to approximate data and says so', async () => {
  const client = {
    async graphql() {
      throw new Error('graphql needs a token');
    },
    async getPublicEvents() {
      return [
        {
          type: 'PushEvent',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          payload: { size: 2 },
          repo: { name: 'octo/hello' },
        },
      ];
    },
  };
  const result = await getContributions({ client, login: 'octocat' });
  assert.equal(result.source, CONTRIBUTION_SOURCES.EVENTS);
  assert.equal(sourceLabel(result.source), 'Approximate');
  assert.match(sourceNote(result.source), /approximate/i);
  assert.equal(result.totals.commits, 2);
});

test('the approximate label never claims the graph is the full year', () => {
  const note = sourceNote(CONTRIBUTION_SOURCES.EVENTS);
  assert.match(note, /recent/i);
  assert.match(note, /approximate/i);
  // The full year is what a token unlocks, not what this graph shows.
  assert.match(note, /add a token for the full year/i);
});

test('the level of the mock profile matches the activity totals', () => {
  const totals = mockContributions(365).totals;
  const level = bucketLevel(totals, { repoCount: MOCK_PROFILE.repos?.length || 0 });
  assert.ok(level >= 0 && level <= 4);
});
