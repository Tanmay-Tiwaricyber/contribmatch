/**
 * Sample data for offline demo mode.
 *
 * Everything in this file is synthetic. Repository names are real open-source
 * projects so the demo reads honestly, but issue numbers, bodies, comments and
 * activity figures are written for this demo and are not fetched from GitHub.
 * The UI labels this mode as "Sample" everywhere it appears.
 */

/** @typedef {Object} MockIssue */
export const MOCK_ISSUES = [
  {
    id: 1201,
    number: 1201,
    title: 'Add keyboard navigation to the results list',
    body: 'The results list can only be traversed with a mouse. Please add arrow-key navigation and a visible focus ring so keyboard users can move between results.\n\nAcceptance criteria:\n- Up/Down arrows move focus between items\n- Home/End jump to first/last\n- Focus is visible on every item',
    repo: 'contribmatch/sample-web',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-web/issues/1201',
    labels: ['good first issue', 'accessibility', 'frontend'],
    language: 'JavaScript',
    comments: 3,
    createdAt: '2026-10-02T09:00:00Z',
    updatedAt: '2026-10-21T11:30:00Z',
    assignees: [],
    repoHealth: { stars: 4820, openIssues: 34, pushedAt: '2026-10-24T08:00:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1202,
    number: 42,
    title: 'Document the retry helper with a usage example',
    body: 'The `retry` helper in `src/http/retry.js` has no JSDoc and no example. Add a short JSDoc block, one usage example and a note about the default backoff.',
    repo: 'contribmatch/sample-node-lib',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-node-lib/issues/42',
    labels: ['good first issue', 'documentation'],
    language: 'JavaScript',
    comments: 1,
    createdAt: '2026-09-28T13:20:00Z',
    updatedAt: '2026-10-19T16:45:00Z',
    assignees: [],
    repoHealth: { stars: 2310, openIssues: 12, pushedAt: '2026-10-23T12:00:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1203,
    number: 77,
    title: 'Fix typo in the installation section of the README',
    body: 'The installation section says "instal" instead of "install" and references `npm i -g` where `npm install -g` is meant.',
    repo: 'contribmatch/sample-cli',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-cli/issues/77',
    labels: ['good first issue', 'documentation'],
    language: 'JavaScript',
    comments: 2,
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-10-15T09:10:00Z',
    assignees: [],
    repoHealth: { stars: 940, openIssues: 8, pushedAt: '2026-10-20T07:30:00Z', hasContributing: true, hasCodeOfConduct: false, archived: false },
  },
  {
    id: 1204,
    number: 318,
    title: 'Add a test for the date-range parser edge case',
    body: '`parseDateRange` returns `null` for a range where the end date is before the start date. Add a unit test covering that case and the inclusive/exclusive boundary.',
    repo: 'contribmatch/sample-python-lib',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-python-lib/issues/318',
    labels: ['good first issue', 'tests', 'help wanted'],
    language: 'Python',
    comments: 5,
    createdAt: '2026-09-12T08:00:00Z',
    updatedAt: '2026-10-22T10:05:00Z',
    assignees: [],
    repoHealth: { stars: 7420, openIssues: 51, pushedAt: '2026-10-24T06:00:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1205,
    number: 190,
    title: 'Support reading config files from a custom directory',
    body: 'Currently the config loader only looks in `~/.config`. Add an optional `--config-dir` flag so the directory can be overridden, with a matching environment variable.',
    repo: 'contribmatch/sample-python-lib',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-python-lib/issues/190',
    labels: ['help wanted', 'enhancement'],
    language: 'Python',
    comments: 7,
    createdAt: '2026-08-30T14:00:00Z',
    updatedAt: '2026-10-18T13:40:00Z',
    assignees: [],
    repoHealth: { stars: 7420, openIssues: 51, pushedAt: '2026-10-24T06:00:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1206,
    number: 55,
    title: 'Add type hints to the public functions of the package',
    body: 'Add PEP 484 type hints to the functions exported from `sample_python_lib/__init__.py` and run mypy in CI.',
    repo: 'contribmatch/sample-python-lib',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-python-lib/issues/55',
    labels: ['good first issue', 'typing'],
    language: 'Python',
    comments: 4,
    createdAt: '2026-09-05T11:00:00Z',
    updatedAt: '2026-10-20T15:25:00Z',
    assignees: [],
    repoHealth: { stars: 7420, openIssues: 51, pushedAt: '2026-10-24T06:00:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1207,
    number: 88,
    title: 'Improve the contrast of the secondary button state',
    body: 'The secondary button border is only 2.58:1 against the card background. Raise it to at least 3:1 and add a focus-visible style.',
    repo: 'contribmatch/sample-design-tokens',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-design-tokens/issues/88',
    labels: ['good first issue', 'design', 'accessibility'],
    language: 'CSS',
    comments: 6,
    createdAt: '2026-09-18T09:30:00Z',
    updatedAt: '2026-10-23T09:00:00Z',
    assignees: [],
    repoHealth: { stars: 1180, openIssues: 19, pushedAt: '2026-10-25T08:20:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1208,
    number: 91,
    title: 'Add a dark-mode variant for the badge component',
    body: 'Badges currently hard-code a light palette. Add tokens so the badge renders correctly in dark mode.',
    repo: 'contribmatch/sample-design-tokens',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-design-tokens/issues/91',
    labels: ['good first issue', 'design'],
    language: 'CSS',
    comments: 3,
    createdAt: '2026-09-22T15:00:00Z',
    updatedAt: '2026-10-21T11:00:00Z',
    assignees: [],
    repoHealth: { stars: 1180, openIssues: 19, pushedAt: '2026-10-25T08:20:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1209,
    number: 12,
    title: 'Explain the caching behaviour in the architecture doc',
    body: 'The architecture document does not mention the TTL used by the response cache. Add a short section describing what is cached and for how long.',
    repo: 'contribmatch/sample-docs',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-docs/issues/12',
    labels: ['documentation', 'good first issue'],
    language: 'Markdown',
    comments: 0,
    createdAt: '2026-10-06T12:00:00Z',
    updatedAt: '2026-10-24T07:45:00Z',
    assignees: [],
    repoHealth: { stars: 640, openIssues: 5, pushedAt: '2026-10-24T07:45:00Z', hasContributing: true, hasCodeOfConduct: false, archived: false },
  },
  {
    id: 1210,
    number: 34,
    title: 'Translate the quickstart guide into Hindi',
    body: 'Translate `docs/quickstart.md` into Hindi and keep the code blocks unchanged.',
    repo: 'contribmatch/sample-i18n',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-i18n/issues/34',
    labels: ['good first issue', 'translation', 'hacktoberfest'],
    language: 'Markdown',
    comments: 8,
    createdAt: '2026-09-14T09:00:00Z',
    updatedAt: '2026-10-22T14:20:00Z',
    assignees: [],
    repoHealth: { stars: 890, openIssues: 22, pushedAt: '2026-10-23T17:00:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1211,
    number: 61,
    title: 'Add a CLI flag to print the resolved config as JSON',
    body: 'Add `--print-config` that writes the resolved configuration as JSON to stdout. Useful for debugging and for issue reports.',
    repo: 'contribmatch/sample-go-tool',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-go-tool/issues/61',
    labels: ['good first issue', 'hacktoberfest'],
    language: 'Go',
    comments: 2,
    createdAt: '2026-09-25T10:00:00Z',
    updatedAt: '2026-10-19T08:30:00Z',
    assignees: [],
    repoHealth: { stars: 3340, openIssues: 27, pushedAt: '2026-10-22T19:10:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1212,
    number: 143,
    title: 'Reduce allocations in the JSON parser hot path',
    body: 'The parser allocates a new slice for every nested object. Reuse a buffer where it is safe to do so and show the allocation numbers in the benchmark output.',
    repo: 'contribmatch/sample-go-tool',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-go-tool/issues/143',
    labels: ['help wanted', 'performance'],
    language: 'Go',
    comments: 11,
    createdAt: '2026-08-11T09:00:00Z',
    updatedAt: '2026-10-17T18:00:00Z',
    assignees: [],
    repoHealth: { stars: 3340, openIssues: 27, pushedAt: '2026-10-22T19:10:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1213,
    number: 205,
    title: 'Implement Iterator for the iterator adaptor',
    body: 'The `Iter` adaptor is missing its `Iterator` implementation, so it cannot be used in a `for` loop. Implement `next()` and the size hint.',
    repo: 'contribmatch/sample-rust-lib',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-rust-lib/issues/205',
    labels: ['good first issue', 'hacktoberfest'],
    language: 'Rust',
    comments: 5,
    createdAt: '2026-09-08T16:00:00Z',
    updatedAt: '2026-10-20T20:15:00Z',
    assignees: [],
    repoHealth: { stars: 5210, openIssues: 41, pushedAt: '2026-10-25T05:40:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1214,
    number: 96,
    title: 'Add a Property test for the string escaping helper',
    body: 'The `escape_quotes` helper should handle arbitrary unicode. Add a property test that round-trips random strings.',
    repo: 'contribmatch/sample-rust-lib',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-rust-lib/issues/96',
    labels: ['good first issue', 'tests'],
    language: 'Rust',
    comments: 3,
    createdAt: '2026-09-19T13:00:00Z',
    updatedAt: '2026-10-18T09:50:00Z',
    assignees: [],
    repoHealth: { stars: 5210, openIssues: 41, pushedAt: '2026-10-25T05:40:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1215,
    number: 404,
    title: 'Expose a typed option for the request timeout',
    body: 'The timeout is read from the environment as a string and parsed at call time. Add a typed option, keep the environment variable working, and document the precedence.',
    repo: 'contribmatch/sample-typescript-sdk',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-typescript-sdk/issues/404',
    labels: ['good first issue', 'help wanted'],
    language: 'TypeScript',
    comments: 6,
    createdAt: '2026-09-27T11:00:00Z',
    updatedAt: '2026-10-21T17:30:00Z',
    assignees: [],
    repoHealth: { stars: 2870, openIssues: 33, pushedAt: '2026-10-24T09:15:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
  {
    id: 1216,
    number: 451,
    title: 'Return a discriminated union from the parse function',
    body: '`parseResponse` currently returns `any`. Change the return type to a discriminated union so callers can narrow on the result.',
    repo: 'contribmatch/sample-typescript-sdk',
    owner: 'contribmatch',
    htmlUrl: 'https://github.com/contribmatch/sample-typescript-sdk/issues/451',
    labels: ['good first issue', 'types', 'hacktoberfest'],
    language: 'TypeScript',
    comments: 9,
    createdAt: '2026-09-02T08:00:00Z',
    updatedAt: '2026-10-19T12:00:00Z',
    assignees: [],
    repoHealth: { stars: 2870, openIssues: 33, pushedAt: '2026-10-24T09:15:00Z', hasContributing: true, hasCodeOfConduct: true, archived: false },
  },
];

/** Mock GitHub profile used by the demo flow. */
export const MOCK_PROFILE = {
  login: 'sample-contributor',
  name: 'Sample Contributor',
  avatarUrl: '',
  bio: 'Learning in public. Mostly Python and JavaScript.',
  followers: 24,
  publicRepos: 18,
  totalStars: 41,
  createdAt: '2021-03-11T00:00:00Z',
  repos: [
    { name: 'weather-notifier', language: 'Python', stars: 12, forks: 2, pushedAt: '2026-10-22T10:00:00Z', topics: ['python', 'cli'] },
    { name: 'dotfiles', language: 'Shell', stars: 3, forks: 0, pushedAt: '2026-08-02T10:00:00Z', topics: ['dotfiles'] },
    { name: 'markdown-notes', language: 'JavaScript', stars: 9, forks: 1, pushedAt: '2026-09-30T10:00:00Z', topics: ['markdown', 'notes'] },
    { name: 'tiny-api', language: 'TypeScript', stars: 17, forks: 4, pushedAt: '2026-10-18T10:00:00Z', topics: ['typescript', 'api'] },
    { name: 'learning-go', language: 'Go', stars: 5, forks: 0, pushedAt: '2026-07-14T10:00:00Z', topics: ['go', 'learning'] },
  ],
  languages: { Python: 62, JavaScript: 24, TypeScript: 9, Shell: 5 },
  topics: ['python', 'cli', 'markdown', 'typescript'],
  level: 1,
  skills: ['Python', 'JavaScript', 'TypeScript', 'Markdown', 'Git'],
};

/**
 * Build a deterministic sample contribution calendar.
 * @param {number} days number of days ending today
 */
export function buildSampleContributions(days = 371) {
  const out = [];
  const today = new Date('2026-10-26T00:00:00Z');
  // Fixed pseudo-random sequence so the sample is stable between renders.
  let seed = 20261026;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const dow = d.getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const roll = rand();
    const base = weekend ? 0.12 : 0.42;
    let count = roll < base ? Math.floor(rand() * 9) : 0;
    if (roll > 0.97) count += 6;
    const byType = { commits: 0, pullRequests: 0, issues: 0, reviews: 0 };
    if (count > 0) {
      byType.commits = Math.max(1, Math.round(count * 0.6));
      byType.pullRequests = Math.round(count * 0.2);
      byType.issues = Math.round(count * 0.1);
      byType.reviews = count - byType.commits - byType.pullRequests - byType.issues;
      if (byType.reviews < 0) byType.reviews = 0;
    }
    out.push({
      date: d.toISOString().slice(0, 10),
      count,
      byType,
    });
  }
  return out;
}

/** Sample pack data for the packs page in offline mode. */
export const MOCK_PACKS = [
  {
    id: 'web-basics',
    name: 'Web basics',
    type: 'skill',
    description: 'HTML, CSS and accessible JavaScript — the first stop for most newcomers.',
    languages: ['en', 'hi', 'hinglish'],
    skills: ['html', 'css', 'javascript', 'accessibility'],
    tone: 'plain',
    level: 'beginner',
  },
  {
    id: 'python-data',
    name: 'Python and data',
    type: 'skill',
    description: 'Python projects, typing, tests and small data tooling.',
    languages: ['en'],
    skills: ['python', 'pytest', 'typing', 'pandas'],
    tone: 'plain',
    level: 'beginner',
  },
  {
    id: 'docs-writer',
    name: 'Docs and translation',
    type: 'skill',
    description: 'Writing, translating and reviewing documentation.',
    languages: ['en', 'hi', 'hinglish'],
    skills: ['documentation', 'translation', 'markdown'],
    tone: 'plain',
    level: 'beginner',
  },
];
