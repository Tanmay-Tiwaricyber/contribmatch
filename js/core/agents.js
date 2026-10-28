/**
 * Agents.
 *
 * Every agent follows the same contract:
 *
 *   await agent.run(input, ctx) -> schema-validated JSON
 *
 * `ctx.onStep(message)` reports progress to the live steps panel. `ctx.signal`
 * lets the UI cancel a run. Agents never touch the DOM and never throw at the
 * caller: if the model fails, the agent falls back to a deterministic,
 * rule-based answer and says so in its output.
 */

import { buildPrompt, systemPrompt } from './prompt.js';
import { validate } from './schema.js';
import { levelLabel, bucketLevel, explainLevel, activityPoints } from './level.js';
import { rankIssues, mergeRatings } from './ranker.js';

/** Emit a step, tolerating both string and object messages. */
function step(ctx, agent, message, state = 'active') {
  if (typeof ctx?.onStep === 'function') {
    ctx.onStep(typeof message === 'string' ? { agent, message, state } : { agent, state, ...message });
  }
}

/**
 * Run the provider and validate the result, falling back when needed.
 * @returns {Promise<{data:object, source:'model'|'fallback', error?:string}>}
 */
async function ask(provider, { system, prompt, schema, fallback }) {
  if (!provider) {
    return { data: fallback(), source: 'fallback', error: 'no provider' };
  }
  try {
    const raw = await provider.generate({ system, prompt, schema });
    const errors = validate(raw, schema);
    if (errors.length) {
      return { data: fallback(), source: 'fallback', error: errors.join('; ') };
    }
    return { data: raw, source: 'model' };
  } catch (err) {
    return { data: fallback(), source: 'fallback', error: err.message };
  }
}

/* -------------------------------------------------------------------------
   Profile agent
   ------------------------------------------------------------------------- */

export const PROFILE_SCHEMA = {
  type: 'object',
  required: ['level', 'skills', 'languages', 'summary'],
  properties: {
    level: { type: 'integer', minimum: 0, maximum: 4 },
    skills: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: ['name', 'level', 'evidence'],
        properties: {
          name: { type: 'string', maxLength: 40 },
          level: { type: 'integer', minimum: 0, maximum: 4 },
          evidence: { type: 'string', maxLength: 160 },
        },
      },
    },
    languages: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 30 } },
    interests: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 40 } },
    activity: { type: 'string', maxLength: 40 },
    summary: { type: 'string', maxLength: 400 },
  },
};

/** Rule-based profile inference — used when the model is unavailable. */
export function inferProfileFallback(profile = {}) {
  const languages = Object.keys(profile.languages || {});
  const repos = profile.repos || [];
  const totals = profile.activityTotals || {};
  const level = bucketLevel(totals, {
    repoCount: repos.length,
    accountYears: profile.accountYears,
  });

  const skills = [];
  for (const lang of languages) {
    const share = profile.languages[lang] || 0;
    skills.push({
      name: lang,
      level: share > 60 ? 3 : share > 25 ? 2 : 1,
      evidence: `${Math.round(share)}% of your public code`,
    });
  }
  for (const repo of repos.slice(0, 4)) {
    for (const topic of repo.topics || []) {
      if (!skills.some((s) => s.name.toLowerCase() === topic.toLowerCase())) {
        skills.push({ name: topic, level: 1, evidence: `topic on ${repo.name}` });
      }
    }
  }
  if (skills.length === 0) {
    skills.push({ name: 'Git', level: 1, evidence: 'no public repositories found yet' });
  }

  return {
    level,
    skills: skills.slice(0, 8),
    languages: languages.slice(0, 6),
    interests: (profile.topics || []).slice(0, 6),
    activity: explainLevel(level, totals).toLowerCase(),
    summary: `Mostly ${languages.slice(0, 2).join(' and ') || 'JavaScript'} across ${repos.length} public repositories.`,
  };
}

export function createProfileAgent({ provider } = {}) {
  return {
    name: 'profile-agent',
    async run(input, ctx = {}) {
      const profile = input.profile || {};
      step(ctx, this.name, 'Reading public repositories, languages and topics');
      const result = await ask(provider, {
        system: systemPrompt('profile-agent', {
          extra: 'Infer skills and an experience level (0-4) from the profile data. Base every skill on evidence that is present in the data.',
        }),
        prompt: buildPrompt({
          task: 'Profile the contributor below.',
          data: { profile },
          instructions:
            'Return JSON: {level, skills:[{name,level,evidence}], languages:[], interests:[], activity, summary}. level is 0-4. skills must cite evidence from the data.',
        }),
        schema: PROFILE_SCHEMA,
        fallback: () => inferProfileFallback(profile),
      });

      step(ctx, this.name, 'Skills and level inferred', 'done');
      return {
        ...result.data,
        source: result.source,
        error: result.error || null,
        levelLabel: levelLabel(result.data.level),
      };
    },
  };
}

/* -------------------------------------------------------------------------
   Scout agent — finds candidate issues
   ------------------------------------------------------------------------- */

export const SCOUT_SCHEMA = {
  type: 'object',
  required: ['issues'],
  properties: {
    issues: {
      type: 'array',
      maxItems: 60,
      items: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: ['number', 'string'] },
          triage: { type: 'string', maxLength: 40 },
          note: { type: 'string', maxLength: 200 },
        },
      },
    },
  },
};

export function createScoutAgent({ provider, search }) {
  return {
    name: 'scout-agent',
    async run(input, ctx = {}) {
      const languages = input.languages || [];
      const limit = input.limit || 40;

      step(ctx, this.name, `Searching GitHub for open ${languages.length ? languages.join(', ') : ''} issues labelled good first issue, help wanted or hacktoberfest`);

      let issues = [];
      try {
        issues = await search({
          languages,
          limit,
          signal: ctx.signal,
          token: input.token,
        });
      } catch (err) {
        step(ctx, this.name, `Search failed: ${err.message}`, 'error');
        throw err;
      }

      step(ctx, this.name, `${issues.length} candidate issues found, unassigned and recently active`, 'done');
      return { issues, source: 'rules' };
    },
  };
}

/* -------------------------------------------------------------------------
   Ranker agent — rules first, model on the shortlist
   ------------------------------------------------------------------------- */

export const RANK_SCHEMA = {
  type: 'object',
  required: ['ratings'],
  properties: {
    ratings: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        required: ['id', 'difficulty', 'clarity', 'fit'],
        properties: {
          id: { type: ['number', 'string'] },
          difficulty: { type: 'integer', minimum: 1, maximum: 5 },
          clarity: { type: 'integer', minimum: 1, maximum: 5 },
          fit: { type: 'integer', minimum: 1, maximum: 5 },
          note: { type: 'string', maxLength: 240 },
        },
      },
    },
  },
};

/** How many candidates are sent to the model. */
export const MODEL_SHORTLIST_SIZE = 8;

export function createRankerAgent({ provider, shortlistSize = MODEL_SHORTLIST_SIZE } = {}) {
  return {
    name: 'ranker-agent',
    async run(input, ctx = {}) {
      const issues = input.issues || [];
      const profile = input.profile || {};

      step(ctx, this.name, 'Scoring every issue against the rules');
      const ranked = rankIssues(issues, profile, { now: input.now });

      const shortlist = ranked.slice(0, shortlistSize);
      step(ctx, this.name, `Rating the top ${shortlist.length} with the model`);

      const result = await ask(provider, {
        system: systemPrompt('ranker-agent', {
          extra: 'Rate difficulty (1 easiest, 5 hardest), clarity of the description (1-5) and fit for this contributor (1-5). Use integer numbers 1-5 only — never words like "Easy" or "High". Only rate issues that appear in the data.',
        }),
        prompt: buildPrompt({
          task: 'Rate the shortlisted issues for this contributor.',
          data: {
            skills: profile.skills,
            languages: profile.languages,
            level: profile.level,
            candidates: shortlist.map((c) => ({
              id: c.id,
              title: c.title,
              labels: c.labels,
              body: String(c.body || '').slice(0, 800),
              language: c.language,
              ruleScore: c.ruleScore,
            })),
          },
          instructions:
            'Return JSON: {ratings:[{id, difficulty, clarity, fit, note}]}. One rating per candidate, same ids.',
        }),
        schema: RANK_SCHEMA,
        fallback: () => ({
          ratings: shortlist.map((c) => ({
            id: c.id,
            difficulty: 3,
            clarity: 3,
            fit: Math.max(1, Math.min(5, Math.round(c.ruleScore / 20))),
            note: 'Rule-based estimate (the model was unavailable).',
          })),
        }),
      });

      step(ctx, this.name, 'Ranking finalised', 'done');
      const merged = mergeRatings(ranked, result.data.ratings || [], { source: result.source });
      return {
        issues: merged,
        ratedCount: (result.data.ratings || []).length,
        source: result.source,
        error: result.error || null,
      };
    },
  };
}

/* -------------------------------------------------------------------------
   Coach agent — prepares the first pull request
   ------------------------------------------------------------------------- */

export const COACH_SCHEMA = {
  type: 'object',
  required: ['explanation', 'files', 'plan', 'comment', 'checklist', 'effort'],
  properties: {
    explanation: { type: 'string', maxLength: 700 },
    files: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 160 } },
    plan: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 240 } },
    comment: { type: 'string', maxLength: 1600 },
    checklist: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 160 } },
    effort: { type: 'string', maxLength: 120 },
    warnings: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 200 } },
  },
};

/** Rule-based coaching plan — always available, even with no model. */
export function coachFallback(issue = {}, profile = {}) {
  const repo = issue.repo || 'the repository';
  const language = issue.language || 'the project language';
  const labels = (issue.labels || []).map((l) => String(l).toLowerCase());
  const files = [];

  if (labels.includes('documentation')) files.push('README.md', 'docs/');
  else if (labels.includes('translation')) files.push('docs/', 'README.md');
  else if (labels.includes('tests')) files.push('tests/');
  else if (labels.includes('design') || labels.includes('accessibility')) {
    files.push('src/styles/tokens.css', 'src/components/');
  } else files.push(`src/`, 'tests/');

  const plan = [
    `Read CONTRIBUTING.md in ${repo} — it sets the branch, commit and pull request conventions.`,
    `Find the code that owns this behaviour${files[0] ? ` (likely ${files[0]})` : ''} and reproduce the current result.`,
    `Make the smallest change that satisfies the issue, then run the project's test suite.`,
    `Open a pull request that says what changed, why, and how you checked it.`,
  ];

  const comment = [
    'Hi, I would like to work on this.',
    '',
    'My plan:',
    ...plan.map((p, i) => `${i + 1}. ${p}`),
    '',
    'I have not opened a branch yet. Let me know if you would prefer a different approach.',
  ].join('\n');

  return {
    explanation: `This is a ${labels.join(', ') || 'general'} issue in ${repo}, written in ${language}. The acceptance criteria in the issue body tell you when you are done.`,
    files,
    plan,
    comment,
    checklist: [
      'Read CONTRIBUTING.md',
      'Branch from the default branch',
      'Tests pass locally',
      'Pull request explains what changed and why',
      'No unrelated formatting changes',
    ],
    effort: 'About 2 to 4 hours',
    warnings: [],
  };
}

export function createCoachAgent({ provider } = {}) {
  return {
    name: 'coach-agent',
    async run(input, ctx = {}) {
      const issue = input.issue || {};
      const profile = input.profile || {};
      step(ctx, this.name, `Reading the issue and the ${issue.language || 'project'} conventions`);

      const result = await ask(provider, {
        system: systemPrompt('coach-agent', {
          extra: 'Coach a newcomer on this specific issue. Use only files and links that appear in the data. Never claim to have opened a branch or pull request.',
        }),
        prompt: buildPrompt({
          task: 'Prepare a first-pull-request plan for this issue.',
          data: {
            issue: {
              id: issue.id,
              title: issue.title,
              body: String(issue.body || '').slice(0, 2500),
              labels: issue.labels,
              language: issue.language,
              repo: issue.repo,
              url: issue.htmlUrl,
            },
            contributor: { skills: profile.skills, languages: profile.languages, level: profile.level },
          },
          instructions:
            'Return JSON: {explanation, files:[], plan:[], comment, checklist:[], effort, warnings:[]}. The comment must be a polite "may I work on this?" message that a person would post, in plain language.',
        }),
        schema: COACH_SCHEMA,
        fallback: () => coachFallback(issue, profile),
      });

      step(ctx, this.name, 'Plan and comment ready', 'done');
      return { ...result.data, source: result.source, error: result.error || null };
    },
  };
}

/* -------------------------------------------------------------------------
   Quality guard — nudges against low-value pull requests
   ------------------------------------------------------------------------- */

export const GUARD_SCHEMA = {
  type: 'object',
  required: ['verdict'],
  properties: {
    verdict: { type: 'string', enum: ['ok', 'warn', 'block'] },
    warnings: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 220 } },
    notes: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 220 } },
  },
};

const TYPOS_ONLY = /^(fix|typo|correct)\s+(a\s+)?(typo|spelling|grammar)\b/i;

/** Deterministic checks — these are precise, so they run first. */
export function ruleChecks({ comment = '', plan = [], issue = {} } = {}) {
  const warnings = [];
  const text = String(comment);

  if (text.trim().length < 40) {
    warnings.push('The comment is very short. Say which files you plan to touch and how you will test the change.');
  }
  if (!/\btest/i.test(text)) {
    warnings.push('Say how you will verify the change. Maintainers ask for this most often.');
  }
  if (!/contributing/i.test(text)) {
    warnings.push('Reference the project\'s CONTRIBUTING.md so the maintainer knows you followed it.');
  }
  if (TYPOS_ONLY.test(text.trim()) && !/\btest/i.test(text)) {
    warnings.push('This reads like a typo-only change. Confirm the issue really asks for that, and that it is more than a one-character fix.');
  }
  if (Array.isArray(plan) && plan.length < 3) {
    warnings.push('The plan has fewer than three steps. Break the work down a little more.');
  }
  if (issue.labels && issue.labels.length === 0) {
    warnings.push('This issue has no labels, so nobody has confirmed it is beginner-sized. Ask the maintainer before you start.');
  }
  if (/\b(guaranteed|definitely 100%|will fix all)\b/i.test(text)) {
    warnings.push('Avoid absolute promises about the outcome. Describe what you will try instead.');
  }
  return warnings;
}

export function createQualityGuardAgent({ provider } = {}) {
  return {
    name: 'quality-guard',
    async run(input, ctx = {}) {
      const comment = input.comment || '';
      const plan = input.plan || [];
      const issue = input.issue || {};

      step(ctx, this.name, 'Checking the plan against the quality guard');
      const ruleWarnings = ruleChecks({ comment, plan, issue });

      const result = await ask(provider, {
        system: systemPrompt('quality-guard', {
          extra: 'You check whether a proposed contribution is worth the maintainer\'s time. Be practical, not harsh.',
        }),
        prompt: buildPrompt({
          task: 'Review this proposed first contribution.',
          data: { comment, plan, issueTitle: issue.title, labels: issue.labels },
          instructions:
            'Return JSON: {verdict:"ok"|"warn"|"block", warnings:[], notes:[]}. Warn about low-effort, spam-like or badly described contributions. Do not invent problems.',
        }),
        schema: GUARD_SCHEMA,
        fallback: () => ({ verdict: ruleWarnings.length >= 2 ? 'warn' : 'ok', warnings: [], notes: [] }),
      });

      const merged = [...new Set([...ruleWarnings, ...(result.data.warnings || [])])];
      const verdict = merged.length >= 2 ? 'warn' : result.data.verdict;
      step(ctx, this.name, merged.length ? `${merged.length} suggestion${merged.length > 1 ? 's' : ''} to review` : 'No concerns found', 'done');

      return {
        verdict,
        warnings: merged,
        notes: result.data.notes || [],
        source: result.source,
      };
    },
  };
}

/* -------------------------------------------------------------------------
   Activity takeaway — one line about the contributor's activity
   ------------------------------------------------------------------------- */

export const TAKEAWAY_SCHEMA = {
  type: 'object',
  required: ['takeaway'],
  properties: { takeaway: { type: 'string', maxLength: 240 } },
};

export function takeawayFallback(totals = {}) {
  const points = activityPoints(totals);
  const commits = Number(totals.commits) || 0;
  const prs = Number(totals.pullRequests) || 0;
  if (points === 0) {
    return 'No public commits in this window yet. Any first issue counts — start with a documentation task.';
  }
  if (prs > commits) {
    return 'You open pull requests as often as you commit, which usually means you already work in a team workflow.';
  }
  if (commits > 40) {
    return 'You commit steadily. The next step is turning one of those commits into a pull request on someone else\'s project.';
  }
  return 'A light but steady activity pattern. Short documentation and test issues will fit your pace.';
}

export function createActivityTakeawayAgent({ provider } = {}) {
  return {
    name: 'activity-takeaway',
    async run(input, ctx = {}) {
      const totals = input.totals || {};
      const result = await ask(provider, {
        system: systemPrompt('activity-takeaway', {
          extra: 'Write one plain sentence (max 240 characters) about what this activity means for a first contribution.',
        }),
        prompt: buildPrompt({
          task: 'Summarise this contributor activity.',
          data: { totals, source: input.source },
          instructions: 'Return JSON: {takeaway}. One sentence. No preamble.',
        }),
        schema: TAKEAWAY_SCHEMA,
        fallback: () => ({ takeaway: takeawayFallback(totals) }),
      });
      return { ...result.data, source: result.source };
    },
  };
}
