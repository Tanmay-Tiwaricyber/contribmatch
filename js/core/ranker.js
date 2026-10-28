/**
 * Rule-based scoring.
 *
 * The rules decide the order. The model only ever rates the issues the rules
 * already liked, so a hallucinated rating can never promote a bad match.
 *
 * Weights add up to 100:
 *   language match 25 · repo health 22 · labels 18 · freshness 15 ·
 *   issue activity 10 · docs/community hygiene 10
 */

const DAY = 86400000;

/** Labels that mean "a newcomer can take this on". */
export const BEGINNER_LABELS = [
  'good first issue',
  'first-timers-only',
  'help wanted',
  'hacktoberfest',
  'easy',
  'starter',
  'beginner',
];

/**
 * Score one issue for one contributor.
 * @param {object} issue normalised issue
 * @param {object} profile {languages:[], skills:[], level:number}
 * @param {{now?: number}} [opts]
 * @returns {{score:number, reasons:string[], breakdown:object}}
 */
export function scoreIssue(issue, profile = {}, opts = {}) {
  const now = opts.now ?? Date.now();
  const reasons = [];
  const breakdown = {};

  const lang = (issue.language || '').toLowerCase();
  const skills = (profile.skills || []).map((s) =>
    String(typeof s === 'string' ? s : s.name || '').toLowerCase()
  );
  const languages = (profile.languages || []).map((l) => String(l).toLowerCase());

  // 1. Language match — 25
  let languageScore = 0;
  if (lang && languages.includes(lang)) {
    languageScore = 25;
    reasons.push(`Matches your ${issue.language} experience`);
  } else if (lang && skills.some((s) => s && (s.includes(lang) || lang.includes(s)))) {
    languageScore = 14;
    reasons.push(`Close to your ${issue.language} experience`);
  } else if (!lang) {
    languageScore = 10;
  } else {
    // A repository whose language you use may still be a good match.
    languageScore = 3;
  }
  breakdown.language = languageScore;

  // 2. Repository health — 22
  const health = issue.repoHealth || {};
  let healthScore = 0;
  if (health.archived) {
    healthScore = 0;
    reasons.push('Repository is archived');
  } else {
    if (health.hasContributing) {
      healthScore += 8;
      reasons.push('Has a CONTRIBUTING guide');
    }
    if (health.hasCodeOfConduct) {
      healthScore += 4;
    }
    const pushedAt = health.pushedAt ? Date.parse(health.pushedAt) : NaN;
    const daysSincePush = Number.isNaN(pushedAt) ? 999 : (now - pushedAt) / DAY;
    if (daysSincePush < 30) {
      healthScore += 6;
      reasons.push('Repository was updated this month');
    } else if (daysSincePush < 120) {
      healthScore += 3;
    }
    const stars = Number(health.stars) || 0;
    if (stars >= 100) healthScore += 4;
    else if (stars >= 20) healthScore += 2;
  }
  healthScore = Math.min(22, healthScore);
  breakdown.health = healthScore;

  // 3. Labels — 18
  const labels = (issue.labels || []).map((l) => String(l).toLowerCase());
  const matchedLabels = labels.filter((l) => BEGINNER_LABELS.includes(l));
  let labelScore = matchedLabels.length * 9;
  if (matchedLabels.length) {
    reasons.push(`Labelled ${matchedLabels.join(', ')}`);
  } else {
    labelScore = 2;
  }
  if (labels.includes('hacktoberfest')) labelScore += 2;
  labelScore = Math.min(18, labelScore);
  breakdown.labels = labelScore;

  // 4. Freshness — 15 (recent issues are easier to get merged)
  const updatedAt = issue.updatedAt ? Date.parse(issue.updatedAt) : NaN;
  const ageDays = Number.isNaN(updatedAt) ? 999 : (now - updatedAt) / DAY;
  let freshnessScore;
  if (ageDays <= 7) {
    freshnessScore = 15;
    reasons.push('Updated within the last week');
  } else if (ageDays <= 30) {
    freshnessScore = 12;
  } else if (ageDays <= 90) {
    freshnessScore = 8;
  } else if (ageDays <= 180) {
    freshnessScore = 4;
  } else {
    freshnessScore = 1;
  }
  breakdown.freshness = freshnessScore;

  // 5. Issue activity — 10 (a quiet issue is easier to own)
  const comments = Number(issue.comments) || 0;
  let activityScore;
  if (comments === 0) activityScore = 10;
  else if (comments <= 2) activityScore = 8;
  else if (comments <= 5) activityScore = 5;
  else if (comments <= 10) activityScore = 3;
  else activityScore = 1;
  breakdown.activity = activityScore;

  // 6. Contributor hygiene — 10
  let hygieneScore = 5;
  const body = String(issue.body || '');
  if (body.length > 120) hygieneScore += 3;
  if (/acceptance criteria|steps to reproduce|expected|actual/i.test(body)) hygieneScore += 2;
  hygieneScore = Math.min(10, hygieneScore);
  breakdown.hygiene = hygieneScore;

  const score = Math.round(
    breakdown.language +
      breakdown.health +
      breakdown.labels +
      breakdown.freshness +
      breakdown.activity +
      breakdown.hygiene
  );

  return { score: Math.max(0, Math.min(100, score)), reasons, breakdown };
}

/**
 * Score and sort a list of issues.
 * @param {object[]} issues
 * @param {object} profile
 * @param {{now?: number}} [opts]
 */
export function rankIssues(issues = [], profile = {}, opts = {}) {
  return issues
    .map((issue) => {
      const { score, reasons, breakdown } = scoreIssue(issue, profile, opts);
      return { ...issue, ruleScore: score, reasons, breakdown };
    })
    .sort((a, b) => {
      if (b.ruleScore !== a.ruleScore) return b.ruleScore - a.ruleScore;
      const aT = Date.parse(a.updatedAt || '') || 0;
      const bT = Date.parse(b.updatedAt || '') || 0;
      return bT - aT;
    });
}

/**
 * Convert model ratings (1–5 each) into a 0–100 score.
 * Difficulty is inverted: an easier issue is a better match for a newcomer.
 */
export function ratingsToScore(rating = {}) {
  const difficulty = clamp5(rating.difficulty);
  const clarity = clamp5(rating.clarity);
  const fit = clamp5(rating.fit);
  const ease = 6 - difficulty; // 1..5, higher is easier
  // Ease carries 40 points, clarity 25 and fit 35 — 100 in total.
  return Math.round((ease / 5) * 40 + (clarity / 5) * 25 + (fit / 5) * 35);
}

/**
 * Merge rule scores with model ratings.
 * Rules keep the majority of the weight; the model can refine, not overturn.
 * @param {object[]} ranked issues ranked by rules, each with `ruleScore`
 * @param {object[]} ratings [{id, difficulty, clarity, fit, note}]
 * @param {{modelWeight?: number, source?: 'model'|'fallback'}} [opts]
 */
export function mergeRatings(ranked = [], ratings = [], opts = {}) {
  const modelWeight = opts.modelWeight ?? 0.35;
  const fromModel = opts.source !== 'fallback';
  const byId = new Map(ratings.map((r) => [String(r.id), r]));

  return ranked
    .map((item) => {
      const rating = byId.get(String(item.id));
      if (!rating) {
        return { ...item, score: item.ruleScore, modelNote: null, rated: false };
      }
      const modelScore = ratingsToScore(rating);
      // A fallback rating is a rule-based guess, not a model opinion, so it
      // never moves the score. Only a real model rating refines it.
      const score = fromModel
        ? Math.round(item.ruleScore * (1 - modelWeight) + modelScore * modelWeight)
        : item.ruleScore;
      return {
        ...item,
        score: Math.max(0, Math.min(100, score)),
        ruleScore: item.ruleScore,
        modelScore,
        rating,
        modelNote: fromModel ? rating.note || null : null,
        rated: fromModel,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.ruleScore - a.ruleScore;
    });
}

function clamp5(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, v));
}
