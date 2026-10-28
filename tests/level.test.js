/**
 * Level buckets 0–4.
 *
 * The buckets must stay monotonic: more public activity never lowers the
 * level, and every bucket has a label a newcomer can read.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { LEVELS, levelLabel, activityPoints, bucketLevel, explainLevel } from '../js/core/level.js';

test('there are exactly five levels', () => {
  assert.equal(LEVELS.length, 5);
  assert.deepEqual(
    LEVELS.map((l) => l.value),
    [0, 1, 2, 3, 4]
  );
});

test('every level has a readable label', () => {
  for (const level of LEVELS) {
    assert.equal(typeof level.label, 'string');
    assert.ok(level.label.length > 0);
    assert.equal(levelLabel(level.value), level.label);
  }
});

test('an unknown level falls back to a safe label', () => {
  assert.equal(levelLabel(99), LEVELS[1].label);
  assert.equal(levelLabel(undefined), LEVELS[1].label);
});

test('pull requests and reviews count double', () => {
  assert.equal(activityPoints({ commits: 10, pullRequests: 0, issues: 0, reviews: 0 }), 10);
  assert.equal(activityPoints({ commits: 0, pullRequests: 5, issues: 0, reviews: 0 }), 10);
  assert.equal(activityPoints({ commits: 0, pullRequests: 0, issues: 0, reviews: 5 }), 10);
  assert.equal(activityPoints({}), 0);
  assert.equal(activityPoints({ commits: '4' }), 4);
});

test('a brand new account is level 0', () => {
  assert.equal(bucketLevel({}, { repoCount: 0 }), 0);
  assert.equal(bucketLevel({ commits: 0, pullRequests: 0, issues: 0, reviews: 0 }, {}), 0);
});

test('a little activity is level 1', () => {
  assert.equal(bucketLevel({ commits: 3 }, { repoCount: 1 }), 1);
  assert.equal(bucketLevel({ commits: 9, pullRequests: 0 }, { repoCount: 2 }), 1);
});

test('commits and pull requests together are level 2', () => {
  assert.equal(bucketLevel({ commits: 20, pullRequests: 2 }, { repoCount: 4 }), 2);
  assert.equal(bucketLevel({ commits: 35 }, { repoCount: 4 }), 2);
});

test('regular pull request work is level 3', () => {
  assert.equal(bucketLevel({ commits: 40, pullRequests: 15 }, { repoCount: 8 }), 3);
  assert.equal(bucketLevel({ commits: 100 }, { repoCount: 8 }), 3);
});

test('sustained review and merge activity is level 4', () => {
  assert.equal(bucketLevel({ commits: 200, pullRequests: 80, reviews: 60 }, { repoCount: 20 }), 4);
});

test('more activity never lowers the bucket', () => {
  const steps = [
    {},
    { commits: 3 },
    { commits: 12, pullRequests: 1 },
    { commits: 45, pullRequests: 8 },
    { commits: 120, pullRequests: 40, reviews: 20 },
    { commits: 400, pullRequests: 200, reviews: 150 },
  ];
  let previous = -1;
  for (const totals of steps) {
    const level = bucketLevel(totals, { repoCount: 5, accountYears: 3 });
    assert.ok(level >= previous, `level dropped at ${JSON.stringify(totals)}`);
    previous = level;
  }
});

test('a level always lands in 0–4', () => {
  const samples = [{}, { commits: 1 }, { commits: 1000 }, { reviews: 9999 }];
  for (const totals of samples) {
    const level = bucketLevel(totals, { repoCount: 0 });
    assert.ok(level >= 0 && level <= 4, `level ${level} out of range`);
  }
});

test('every level can explain itself in one line', () => {
  for (const level of LEVELS) {
    const text = explainLevel(level.value, { commits: 4, pullRequests: 2, reviews: 1 });
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
    assert.ok(!text.includes('\n'));
  }
});

test('the explanation for level 1 uses the singular for one commit', () => {
  assert.match(explainLevel(1, { commits: 1 }), /1 public commit[^s]/);
  assert.match(explainLevel(1, { commits: 2 }), /2 public commits/);
});
