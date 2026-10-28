/**
 * Offline provider.
 *
 * Implements the same `generate({system, prompt, schema})` contract as the
 * real providers, but computes its answers from the data block in the prompt
 * instead of calling a model. It is what powers the "Sample" mode, so the whole
 * product can be demonstrated with no network, no key and no daemon.
 *
 * The output is schema-shaped and deterministic.
 */

import { BaseProvider } from '../provider.js';
import { agentName, extractData } from '../prompt.js';

/** Words that indicate a language, used by the offline profile inference. */
const LANG_HINTS = [
  'python', 'javascript', 'typescript', 'go', 'rust', 'java', 'ruby', 'php',
  'c++', 'c#', 'swift', 'kotlin', 'html', 'css', 'sass', 'shell', 'markdown',
  'sql', 'vue', 'react', 'node', 'django', 'flask', 'pandas', 'numpy',
];

/**
 * @param {{delayMs?: number}} [opts]
 */
export function createMockProvider(opts = {}) {
  const delayMs = opts.delayMs ?? 0;
  const provider = new BaseProvider({ logger: opts.logger });
  provider.label = 'mock';

  provider._call = async ({ system, prompt }) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const agent = agentName(system);
    const data = extractData(prompt) || {};
    const handler = handlers[agent];
    if (!handler) {
      throw new Error(`Mock provider has no handler for agent "${agent}"`);
    }
    return JSON.stringify(handler(data, prompt));
  };

  return provider;
}

/** Score an issue against a profile using simple keyword overlap. */
function overlapScore(issue, skills) {
  const haystack = `${issue.title || ''} ${issue.body || ''} ${(issue.labels || []).join(' ')}`
    .toLowerCase();
  let hits = 0;
  for (const skill of skills) {
    const s = String(skill).toLowerCase();
    if (s && haystack.includes(s)) hits++;
  }
  return hits;
}

const handlers = {
  'profile-agent': (data) => {
    const profile = data.profile || {};
    const repos = profile.repos || [];
    const languages = Object.keys(profile.languages || {});
    const skills = [];

    for (const lang of languages) {
      skills.push({
        name: lang,
        level: (profile.languages?.[lang] ?? 0) > 50 ? 2 : 1,
        evidence: `${lang} appears in ${repos.filter((r) => r.language === lang).length} of ${repos.length} public repositories`,
      });
    }
    for (const repo of repos.slice(0, 3)) {
      for (const topic of repo.topics || []) {
        if (!skills.some((s) => s.name.toLowerCase() === topic.toLowerCase())) {
          skills.push({
            name: topic,
            level: 1,
            evidence: `topic "${topic}" in ${repo.name}`,
          });
        }
      }
    }

    const level = Math.min(4, Math.max(0, profile.level ?? 1));
    return {
      level,
      skills: skills.slice(0, 8),
      languages: languages.slice(0, 6),
      interests: (profile.topics || []).slice(0, 6),
      activity: 'steady',
      summary: `Mostly ${languages.slice(0, 2).join(' and ') || 'JavaScript'}, with ${repos.length} public repositories.`,
    };
  },

  'scout-agent': (data) => {
    const issues = data.issues || [];
    return {
      issues: issues.map((issue) => ({
        id: issue.id,
        triage: 'ready',
        note: 'Open, unassigned, and labelled for newcomers.',
      })),
    };
  },

  'ranker-agent': (data) => {
    const candidates = data.candidates || [];
    const skills = data.skills || [];
    return {
      ratings: candidates.map((cand) => {
        const issue = cand.issue || {};
        const hits = overlapScore(issue, skills);
        const labelCount = (issue.labels || []).length;
        const difficulty = Math.max(1, Math.min(5, 5 - Math.min(4, Math.floor(labelCount / 1.5))));
        const clarity = Math.max(1, Math.min(5, 3 + Math.min(2, Math.floor((issue.body || '').length / 400))));
        const fit = Math.max(1, Math.min(5, 1 + hits * 2));
        return {
          id: issue.id,
          difficulty,
          clarity,
          fit,
          note:
            hits > 0
              ? `Matches ${hits} skill${hits > 1 ? 's' : ''} from your profile.`
              : 'Nothing in your profile matches this issue directly.',
        };
      }),
    };
  },

  'coach-agent': (data) => {
    const issue = data.issue || {};
    const skills = data.skills || [];
    const repo = issue.repo || 'the repository';
    const labels = issue.labels || [];
    const language = issue.language || 'the project language';
    const files = [];

    if (labels.includes('documentation')) {
      files.push('README.md', 'docs/');
    } else if (labels.includes('tests')) {
      files.push(`tests/test_${language.toLowerCase()}_lib.py`);
    } else if (labels.includes('design') || labels.includes('accessibility')) {
      files.push('src/styles/tokens.css', 'src/components/');
    } else {
      files.push(`src/${language.toLowerCase()}/`, 'tests/');
    }

    const steps = [];
    steps.push(`Read CONTRIBUTING.md in ${repo} and check the labels this project expects on a pull request.`);
    if (files[0]) steps.push(`Reproduce the current behaviour, then look at ${files[0]} for the code that needs to change.`);
    steps.push('Make the smallest change that satisfies the issue and run the project test suite locally.');
    steps.push('Open a pull request that explains what changed, why, and how you checked it.');

    const comment = [
      `Hi, I'd like to work on this.`,
      ``,
      `Here's my plan:`,
      ...steps.map((s, i) => `${i + 1}. ${s}`),
      ``,
      `I haven't started a branch yet — let me know if you'd prefer a different approach.`,
    ].join('\n');

    return {
      explanation: `This issue asks for a change to ${repo} in ${language}. It is labelled ${labels.join(', ') || 'general'}, which usually means the maintainers have already scoped the work.`,
      files,
      plan: steps,
      comment,
      checklist: [
        'Read CONTRIBUTING.md',
        'Branch from the default branch',
        'Tests pass locally',
        'Pull request describes what changed and why',
        'No unrelated formatting changes',
      ],
      effort: 'About 2 to 4 hours',
      warnings: [],
    };
  },

  'quality-guard': (data) => {
    const comment = String(data.comment || '');
    const plan = data.plan || [];
    const warnings = [];
    if (comment.length < 40) {
      warnings.push('The comment is very short. Say which files you plan to touch and how you will test the change.');
    }
    if (!/test/i.test(comment)) {
      warnings.push('Mention how you will verify the change. Maintainers ask for this most often.');
    }
    if (!/contributing/i.test(comment)) {
      warnings.push('Reference the project\'s CONTRIBUTING.md so the maintainer knows you followed it.');
    }
    if (plan.length < 3) {
      warnings.push('The plan has fewer than three steps. Break the work down a little more.');
    }
    return {
      verdict: warnings.length >= 2 ? 'warn' : 'ok',
      warnings,
      notes: [],
    };
  },

  'activity-takeaway': (data) => {
    const totals = data.totals || {};
    const commits = totals.commits || 0;
    const prs = totals.pullRequests || 0;
    if (commits + prs === 0) {
      return { takeaway: 'No public commits in this window yet. Any first issue counts — start with a documentation task.' };
    }
    const ratio = prs / Math.max(1, commits);
    let text;
    if (ratio > 0.5) {
      text = 'You open pull requests as often as you commit, which usually means you already work in a team workflow.';
    } else if (commits > 40) {
      text = 'You commit steadily. The next step is turning one of those commits into a pull request on someone else\'s project.';
    } else {
      text = 'A light but steady activity pattern. Short documentation and test issues will fit your pace.';
    }
    return { takeaway: text };
  },
};

export default createMockProvider;
