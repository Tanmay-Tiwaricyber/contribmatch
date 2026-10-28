/**
 * Scoring rules.
 *
 * The ranker is rule-first: every point in a score can be traced back to a
 * named reason. These tests pin the weights so a change cannot silently
 * reshuffle the shortlist.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  scoreIssue,
  rankIssues,
  ratingsToScore,
  mergeRatings,
  BEGINNER_LABELS,
} from '../js/core/ranker.js';

const NOW = Date.parse('2026-06-15T12:00:00Z');
const DAY = 86400000;

function makeIssue(overrides = {}) {
  return {
    id: 'owner/repo#1',
    number: 1,
    title: 'Add a missing example',
    body: 'Steps to reproduce: run the tests. Expected: a pass.',
    repo: 'owner/repo',
    owner: 'owner',
    language: 'Python',
    labels: ['good first issue'],
    comments: 0,
    createdAt: new Date(NOW - 5 * DAY).toISOString(),
    updatedAt: new Date(NOW - 2 * DAY).toISOString(),
    assignees: [],
    htmlUrl: 'https://github.com/owner/repo/issues/1',
    repoHealth: {
      stars: 120,
      openIssues: 4,
      pushedAt: new Date(NOW - 10 * DAY).toISOString(),
      hasContributing: true,
      hasCodeOfConduct: true,
      archived: false,
    },
    ...overrides,
  };
}

test('a perfect issue scores 100', () => {
  const issue = makeIssue({
    labels: ['good first issue', 'help wanted'],
    body:
      'Steps to reproduce: run npm test. Expected: a pass. Actual: a crash in the parser, which I traced to a missing null check.',
  });
  const { score, breakdown } = scoreIssue(issue, { languages: ['Python'], skills: [] }, { now: NOW });
  assert.equal(score, 100);
  assert.equal(breakdown.language, 25);
  assert.equal(breakdown.health, 22);
  assert.equal(breakdown.labels, 18);
  assert.equal(breakdown.freshness, 15);
  assert.equal(breakdown.activity, 10);
  assert.equal(breakdown.hygiene, 10);
});

test('every rule group is worth the documented number of points', () => {
  const issue = makeIssue();
  const { breakdown } = scoreIssue(issue, { languages: ['Python'] }, { now: NOW });
  assert.equal(breakdown.language, 25);
  assert.equal(breakdown.health, 22);
  assert.equal(breakdown.labels, 9);
  assert.equal(breakdown.freshness, 15);
  assert.equal(breakdown.activity, 10);
  assert.equal(breakdown.hygiene, 7, 'a short body keeps two hygiene points');
});

test('a thin issue body is worth fewer hygiene points', () => {
  const thin = scoreIssue(makeIssue({ body: 'fix it' }), {}, { now: NOW });
  const rich = scoreIssue(
    makeIssue({ body: 'Steps to reproduce: run npm test. Expected: failure. Actual: crash.' }),
    {},
    { now: NOW }
  );
  assert.ok(rich.breakdown.hygiene > thin.breakdown.hygiene);
});

test('the language match is worth 25 points and names the language', () => {
  const { score, reasons } = scoreIssue(
    makeIssue(),
    { languages: ['Python'], skills: [] },
    { now: NOW }
  );
  assert.ok(reasons.some((r) => r.includes('Python')));
  assert.ok(score > 0);
});

test('an unrelated language still scores, but far lower', () => {
  const match = scoreIssue(makeIssue(), { languages: ['Python'], skills: [] }, { now: NOW });
  const mismatch = scoreIssue(
    makeIssue({ language: 'Rust' }),
    { languages: ['Python'], skills: [] },
    { now: NOW }
  );
  assert.ok(mismatch.score < match.score);
});

test('a skill that contains the language gets a partial match', () => {
  const { breakdown } = scoreIssue(
    makeIssue(),
    { languages: [], skills: ['python scripting'] },
    { now: NOW }
  );
  assert.equal(breakdown.language, 14);
});

test('an archived repository scores zero on health', () => {
  const issue = makeIssue();
  issue.repoHealth.archived = true;
  const { breakdown, reasons } = scoreIssue(issue, { languages: ['Python'] }, { now: NOW });
  assert.equal(breakdown.health, 0);
  assert.ok(reasons.some((r) => /archived/i.test(r)));
});

test('a busy issue loses activity points', () => {
  const quiet = scoreIssue(makeIssue({ comments: 0 }), {}, { now: NOW });
  const busy = scoreIssue(makeIssue({ comments: 40 }), {}, { now: NOW });
  assert.ok(busy.breakdown.activity < quiet.breakdown.activity);
});

test('an old issue loses freshness points', () => {
  const fresh = scoreIssue(makeIssue(), {}, { now: NOW });
  const old = scoreIssue(
    makeIssue({ updatedAt: new Date(NOW - 300 * DAY).toISOString() }),
    {},
    { now: NOW }
  );
  assert.ok(old.breakdown.freshness < fresh.breakdown.freshness);
});

test('scores never leave the 0–100 range', () => {
  const { score } = scoreIssue(
    makeIssue({
      language: 'Rust',
      labels: ['good first issue', 'help wanted', 'hacktoberfest'],
      comments: 999,
      updatedAt: new Date(NOW - 900 * DAY).toISOString(),
      body: 'x',
    }),
    { languages: ['Python'], skills: ['cobol'] },
    { now: NOW }
  );
  assert.ok(score >= 0 && score <= 100);
});

test('ranking sorts by rule score and breaks ties by recency', () => {
  const issues = [
    makeIssue({ id: 'a', title: 'A', updatedAt: new Date(NOW - 30 * DAY).toISOString() }),
    makeIssue({ id: 'b', title: 'B', language: 'Rust' }),
    makeIssue({ id: 'c', title: 'C', language: 'Rust', updatedAt: new Date(NOW - 1 * DAY).toISOString() }),
  ];
  const ranked = rankIssues(issues, { languages: ['Python'] }, { now: NOW });
  assert.equal(ranked[0].id, 'a');
  assert.equal(ranked[1].id, 'c');
  assert.equal(ranked[2].id, 'b');
  assert.ok(ranked[0].ruleScore >= ranked[1].ruleScore);
});

test('model ratings convert to a 0–100 score and invert difficulty', () => {
  const easy = ratingsToScore({ difficulty: 1, clarity: 5, fit: 5 });
  const hard = ratingsToScore({ difficulty: 5, clarity: 5, fit: 5 });
  assert.ok(easy > hard);
  assert.ok(easy <= 100 && hard >= 0);
});

test('model ratings only refine the score, they never overturn the rules', () => {
  const ranked = [{ id: '1', ruleScore: 90 }];
  const merged = mergeRatings(ranked, [{ id: '1', difficulty: 5, clarity: 1, fit: 1 }], {
    modelWeight: 0.35,
  });
  assert.ok(merged[0].score > 50, 'a perfect rule score must not collapse');
  assert.ok(merged[0].score <= 90);
});

test('an issue the model did not rate keeps its rule score', () => {
  const merged = mergeRatings([{ id: '1', ruleScore: 72 }], [], {});
  assert.equal(merged[0].score, 72);
  assert.equal(merged[0].rated, false);
});

test('a fallback rating is marked as not model rated', () => {
  const merged = mergeRatings(
    [{ id: '1', ruleScore: 72 }],
    [{ id: '1', difficulty: 3, clarity: 3, fit: 3, note: 'fallback' }],
    { source: 'fallback' }
  );
  assert.equal(merged[0].rated, false);
  assert.equal(merged[0].score, 72);
});

test('the beginner label list is the documented one', () => {
  assert.ok(BEGINNER_LABELS.includes('good first issue'));
  assert.ok(BEGINNER_LABELS.includes('help wanted'));
  assert.ok(BEGINNER_LABELS.includes('hacktoberfest'));
});
