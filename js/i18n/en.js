/**
 * English strings.
 *
 * Keys are used by data-i18n attributes in the HTML and by the UI modules.
 * The Hindi and Hinglish dictionaries mirror this file exactly.
 */
export default {
  // --- Chrome -------------------------------------------------------------
  'brand.name': 'ContribMatch',
  'nav.home': 'Home',
  'nav.how': 'How it works',
  'nav.features': 'Features',
  'nav.packs': 'Community packs',
  'nav.docs': 'Docs',
  'nav.contribute': 'Contribute',
  'nav.privacy': 'Privacy',
  'nav.design': 'Design system',
  'nav.openApp': 'Open the matcher',
  'nav.menu': 'Menu',
  'nav.menuOpen': 'Open menu',
  'nav.menuClose': 'Close menu',
  'theme.toggle': 'Switch theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'lang.label': 'Language',
  'lang.en': 'English',
  'lang.hi': 'हिन्दी',
  'lang.hinglish': 'Hinglish',
  'skip.link': 'Skip to main content',
  'footer.product': 'Product',
  'footer.community': 'Community',
  'footer.resources': 'Resources',
  'footer.about':
    'ContribMatch matches developers with beginner-friendly GitHub issues and coaches them toward a quality first pull request.',
  'footer.license': 'MIT licensed',
  'footer.hackdays': 'Built for Hacktoberfest HackDays',
  'footer.repo': 'GitHub repository',
  'footer.rights': 'Open source, no backend, public data only.',
  'footer.shortlist': 'Your saved issues',

  // --- Hero ----------------------------------------------------------------
  'hero.title': 'Find an issue <em class="serif">you can actually finish</em>',
  'hero.titleEm': 'you can actually finish',
  'hero.eyebrow': 'One issue at a time',
  'home.marquee': 'Good first issue | Help wanted | Hacktoberfest | Unassigned | Recently active | CONTRIBUTING.md | Pull request checklist | Public repositories | Language match | Repository health | First pull request | Open source',
  'hero.promise':
    'Type your GitHub username. ContribMatch reads your public activity, finds open issues labelled for newcomers, and explains what a first pull request would look like.',
  'hero.inputLabel': 'GitHub username',
  'hero.inputPlaceholder': 'e.g. octocat',
  'hero.submit': 'Find my issues',
  'hero.submitting': 'Working…',
  'hero.trust':
    'Public GitHub data only. Nothing stored on a server. Powered by open-weight Gemma.',
  'hero.sampleNote': 'No username yet? The graph below shows sample data.',
  'hero.errorEmpty': 'Enter a GitHub username to continue.',
  'hero.errorInvalid':
    'A GitHub username can use letters, numbers and single hyphens, and cannot start or end with a hyphen.',

  // --- Activity panel ------------------------------------------------------
  'activity.title': 'Your activity',
  'activity.source.exact': 'Exact',
  'activity.source.approximate': 'Approximate',
  'activity.source.sample': 'Sample',
  'activity.note.exact': 'Full contribution calendar from the GitHub GraphQL API.',
  'activity.note.approximate':
    'A full year of your public issues and pull requests, with commit and review detail from the last 90 days (approximate). Add a token for the exact calendar.',
  'activity.note.sample': 'Sample data. Enter a GitHub username to see your own activity.',
  'activity.takeaway': 'Takeaway',
  'activity.commits': 'Commits',
  'activity.pullRequests': 'Pull requests',
  'activity.issues': 'Issues',
  'activity.reviews': 'Reviews',
  'activity.less': 'Less',
  'activity.more': 'More',
  'activity.loading': 'Loading activity…',
  'activity.summary': 'Contribution summary',
  'activity.tableCaption': 'Daily contributions',

  // --- How it works --------------------------------------------------------
  'how.eyebrow': 'How it works',
  'how.title': 'Four agents, <em class="serif">one shortlist</em>',
  'how.lead':
    'Each step runs as a separate agent with a clear job. Every step shows its progress, and every answer comes back as checked data.',
  'how.1.title': 'Profile agent',
  'how.1.body':
    'Reads your public repositories, languages, topics and activity, then infers your skills and level.',
  'how.2.title': 'Scout agent',
  'how.2.body':
    'Searches open issues labelled good first issue, help wanted or hacktoberfest, and drops the ones that are already assigned.',
  'how.3.title': 'Ranker agent',
  'how.3.body':
    'Scores every issue with clear rules, then asks the model to rate difficulty, clarity and fit for the shortlist.',
  'how.4.title': 'Coach agent',
  'how.4.body':
    'Explains the issue in plain language, lists the likely files, and drafts a comment you can post yourself.',

  // --- Features ------------------------------------------------------------
  'features.eyebrow': 'What you get',
  'features.title': 'Built for <em class="serif">the first pull request</em>',
  'features.lead':
    'Everything here runs in your browser against public data. There is no account, no server and nothing stored about you.',
  'features.1.title': 'Matches, not a feed',
  'features.1.body':
    'A ranked shortlist with the reason behind every score, not an endless list of issues.',
  'features.2.title': 'A plan before you code',
  'features.2.body':
    'Likely files, a step-by-step plan and a pull request checklist for the issue you picked.',
  'features.3.title': 'Quality guard',
  'features.2.note': '',
  'features.3.body':
    'Checks your plan against the things that make maintainers close a pull request without reading it twice.',
  'features.4.title': 'Open weights, local-first',
  'features.4.body':
    'Run Gemma on your own machine with Ollama. Your token and key stay in the tab.',
  'features.5.title': 'Your language',
  'features.5.body':
    'English, Hindi and Hinglish across the whole matching flow.',
  'features.6.title': 'Community packs',
  'features.6.body':
    'Open JSON and YAML packs that describe skills, tone and ecosystems. Add your own.',

  // --- Open innovation -----------------------------------------------------
  'open.eyebrow': 'Why open innovation matters',
  'open.title': 'Open weights, open data, <em class="serif">open contribution</em>',
  'open.lead':
    'A tool that helps people contribute should not need a company to work, and should not need your data to do it.',
  'open.1.title': 'Open weights',
  'open.1.body':
    'Gemma runs locally on your machine. No request leaves the house for an issue you are reading.',
  'open.2.title': 'Local-first privacy',
  'open.2.body':
    'There is no backend. Your token and key live in the tab, and your shortlist lives in your browser.',
  'open.3.title': 'Community packs',
  'open.3.body':
    'Skill taxonomies and packs are plain files in the repository. Anyone can add one in a pull request.',
  'open.4.title': 'Local languages',
  'open.4.body':
    'English, Hindi and Hinglish are part of the product, not a stretch goal for later.',

  // --- Community packs section --------------------------------------------
  'packs.eyebrow': 'Community packs',
  'packs.title': 'Packs written <em class="serif">by the community</em>',
  'packs.lead':
    'A pack describes the skills, tone and ecosystems a project works in. The matcher uses it to explain issues in the right words.',
  'packs.browse': 'Browse packs',
  'packs.add': 'Add a pack',
  'packs.example': 'Example pack',

  // --- FAQ -----------------------------------------------------------------
  'faq.eyebrow': 'Questions',
  'faq.title': 'Common <em class="serif">questions</em>',
  'faq.1.q': 'Does ContribMatch post anything on my behalf?',
  'faq.1.a':
    'No. It never posts a comment, a branch or a pull request. You get text to review and paste yourself.',
  'faq.2.q': 'What does it send to the model?',
  'faq.2.a':
    'Only the issue title, body and labels of the shortlist, plus your inferred skills. If you use Ollama, that request never leaves your machine.',
  'faq.3.q': 'Do I need an API key?',
  'faq.3.a':
    'For Ollama, no — the model runs locally. For Google AI Studio, OpenRouter or Groq you paste a key into the browser; it stays in the tab and is never sent anywhere else.',
  'faq.4.q': 'Is the contribution graph the real GitHub calendar?',
  'faq.4.a':
    'With a token, yes — it uses the GraphQL contribution calendar. Without one it falls back to counting public events, which covers roughly the last 90 days. The label under the graph always says which one you are looking at.',
  'faq.5.q': 'Will my shortlist sync between devices?',
  'faq.5.a':
    'No. The shortlist is stored in your browser only. You can export it as Markdown and check it in.',

  // --- Final CTA -----------------------------------------------------------
  'cta.title': 'Pick one issue. <em class="serif">That is the whole job.</em>',
  'cta.body':
    'Start with the matcher, get a plan you understand, and open one pull request. Everything is free and nothing is stored.',
  'cta.button': 'Find my issue',
  'cta.eyebrow': 'Start here',
  'cta.secondary': 'Read the docs',

  // --- Matcher page --------------------------------------------------------
  'app.eyebrow': 'Matcher',
  'app.title': 'Your issue <em class="serif">shortlist</em>',
  'app.lede':
    'Every score below comes from rules you can check, with the model refining the shortlist.',
  'app.usernameLabel': 'GitHub username',
  'app.run': 'Run the matcher',
  'app.running': 'Matching…',
  'app.again': 'Run again',
  'app.steps': 'Agent steps',
  'app.stepsIdle': 'The agents have not run yet.',
  'app.stepsRunning': 'Working…',
  'app.results': 'Matches',
  'app.resultCount': '{count} issues',
  'app.filters': 'Filters',
  'app.filterLanguage': 'Language',
  'app.filterLabel': 'Label',
  'app.filterAll': 'All',
  'app.sort': 'Sort by',
  'app.sort.score': 'Highest score',
  'app.sort.fresh': 'Recently updated',
  'app.sort.effort': 'Smallest effort',
  'app.empty.title': 'No issues matched those filters',
  'app.empty.body':
    'Try clearing a filter, or widen the languages. The scout searches public issues labelled for newcomers.',
  'app.error.title': 'GitHub could not be reached',
  'app.error.body':
    'Check your connection and try again. Nothing was sent anywhere except GitHub.',
  'app.rateLimit.title': 'GitHub rate limit reached',
  'app.rateLimit.body':
    'Unauthenticated requests are limited. Add a read-only token in the docs page and the matcher will use it.',
  'app.rateLimit.addToken': 'Add a token',
  'app.badToken.title': 'GitHub rejected the token',
  'app.badToken.body':
    'The token is expired or mistyped. Create a new read-only token, paste it in the docs page and save.',
  'app.sampleBanner':
    'Sample mode: this shortlist uses local sample data, so it works with no network and no key.',
  'app.score': 'Score',
  'app.whyFits': 'Why this fits you',
  'app.effort': 'Effort',
  'app.effortUnknown': 'Not estimated yet',
  'app.labels': 'Labels',
  'app.repoHealth': 'Repository',
  'app.repoHealth.healthy': 'Active and welcoming',
  'app.repoHealth.quiet': 'Quiet, no guide found',
  'app.repoHealth.archived': 'Archived',
  'app.save': 'Save to shortlist',
  'app.saved': 'Saved',
  'app.open': 'Open on GitHub',
  'app.coach': 'Get a plan',
  'app.rated': 'Rated by the model',
  'app.ruleOnly': 'Rule score only',
  'app.modelNote': 'Model note',
  'app.source.model': 'Model',
  'app.source.fallback': 'Scored by the built-in rule engine — the AI model was unavailable. Scores and reasons are still complete; for model-refined ratings of the top matches, start Ollama (gemma3:4b) or add an AI Studio, OpenRouter or Groq key in the docs page.',
  'app.retry': 'Try again',
  'app.api.title': 'GitHub API',
  'app.api.paused': 'Paused — resumes in about {seconds}s ({reason})',
  'app.api.paused.rate-limit': 'rate limit',
  'app.api.paused.network': 'network wait',
  'app.api.queued': '{count} queued',
  'app.api.ready': 'requests are paced and rate limits are tracked',
  'app.api.stale':
    'GitHub was throttling requests, so parts of these results come from an older cached copy and may be a few minutes old.',
  'app.api.retry': 'Try again',
  'app.errorDialog.howToFix': 'What you can do:',
  'app.errorDialog.close': 'Close',
  'app.errorDialog.hint.wait': 'The request queue keeps itself healthy — waiting a minute is enough; nothing is stuck.',
  'app.errorDialog.hint.details': 'The exact reason is shown in red above.',
  'app.errorDialog.hint.mock': 'You can also run the matcher in mock mode from the docs page to see the flow with no network at all.',
  'app.errorDialog.bucket.core': 'GitHub REST core quota',
  'app.errorDialog.bucket.search': 'GitHub Search quota',
  'app.errorDialog.rateLimitCause': 'GitHub refused the request: your {bucket} ran out. It resets in about {minutes} min.',
  'app.errorDialog.rateLimitGeneric': 'GitHub refused the request: your {bucket} ran out.',
  'app.errorDialog.notFound.title': 'That GitHub user was not found',
  'app.errorDialog.notFound.cause': 'GitHub returned 404 for the username in the box.',
  'app.errorDialog.notFound.hint': 'Check the spelling — usernames are case-insensitive but must exist.',
  'app.errorDialog.config.title': 'The AI model is not set up',
  'app.errorDialog.config.hint.ollama': 'Rule-based scores still work. For model-refined ratings, start Ollama —',
  'app.errorDialog.config.link.ollama': 'see the Ollama guide',
  'app.errorDialog.config.hint.key': 'Or connect Google AI Studio, OpenRouter or Groq:',
  'app.errorDialog.config.link.aiStudio': 'add a key in the docs page',
  'app.errorDialog.action.setup': 'Set up the model',
  'app.errorDialog.queueFull.title': 'Too many requests at once',
  'app.errorDialog.queueFull.cause': 'The GitHub request queue is full right now.',
  'app.errorDialog.server.title': 'GitHub had a server problem',
  'app.errorDialog.server.cause': 'GitHub responded with a 5xx error. This is on GitHub\'s side, not yours.',
  'app.errorDialog.something.title': 'The run stopped early',
  'app.errorDialog.something.cause': 'The matcher hit an unexpected error.',
  'app.errorDialog.action.trouble': 'Open troubleshooting',
  'app.catalogue.title': 'issue catalogue',
  'app.catalogue.refreshed': '{count} issues, refreshed {minutes} min ago',
  'app.catalogue.justNow': 'refreshed just now',
  'app.catalogue.stale': 'data may be out of date',
  'app.catalogue.absent': 'no issue catalogue; live GitHub search will be used',
  'app.profile.title': 'GitHub profile',
  'app.profile.repos': 'public repos',
  'app.profile.followers': 'followers',
  'app.profile.stars': 'stars earned',
  'app.profile.since': 'On GitHub since',
  'app.profile.languages': 'Top languages',
  'app.profile.recentRepos': 'Recently pushed repositories',

  // --- Issue page ----------------------------------------------------------
  'issue.title': 'Your plan <em class="serif">for this issue</em>',
  'issue.explanation': 'What this issue is asking',
  'issue.lede': 'Pick an issue from the matcher and this page explains it, plans the work and drafts a comment you can review.',
  'issue.files': 'Likely files',
  'issue.plan': 'Step-by-step plan',
  'issue.comment': 'Comment you can post',
  'issue.commentNote':
    'Review this, edit it in your own words, then post it on the issue. ContribMatch never posts for you.',
  'issue.copy': 'Copy comment',
  'issue.copied': 'Copied',
  'issue.checklist': 'Pull request checklist',
  'issue.quality': 'Quality guard',
  'issue.quality.ok': 'No concerns found',
  'issue.quality.warn': 'A few things to fix before you post',
  'issue.quality.block': 'Do not post this yet',
  'issue.back': 'Back to the shortlist',
  'issue.notFound': 'That issue is not in your shortlist.',
  'issue.missing': 'No issue selected',
  'issue.missingBody': 'Open an issue from the matcher, or pick one from the shortlist.',

  // --- Shortlist -----------------------------------------------------------
  'shortlist.eyebrow': 'Shortlist',
  'shortlist.title': 'Your saved <em class="serif">issues</em>',
  'shortlist.lede': 'Stored in this browser only. Export it as Markdown and check it in.',
  'shortlist.empty.title': 'Nothing saved yet',
  'shortlist.empty.body':
    'Save an issue from the matcher and it will show up here. Nothing leaves your browser.',
  'shortlist.remove': 'Remove',
  'shortlist.export': 'Export as Markdown',
  'shortlist.exported': 'Markdown copied to the clipboard',
  'shortlist.clear': 'Clear shortlist',
  'shortlist.count': '{count} saved',

  // --- Packs ---------------------------------------------------------------
  'packsPage.eyebrow': 'Community packs',
  'packsPage.title': 'Community <em class="serif">packs</em>',
  'packsPage.lede':
    'A pack is a plain file that describes skills, language and tone. The matcher uses it to explain an issue in the right words.',
  'packsPage.filterType': 'Type',
  'packsPage.type.skill': 'Skill taxonomy',
  'packsPage.type.ecosystem': 'Ecosystem',
  'packsPage.type.tone': 'Language and tone',
  'packsPage.viewJson': 'View JSON',
  'packsPage.viewYaml': 'View YAML',
  'packsPage.empty': 'No packs match this filter.',
  'packsPage.addTitle': 'Add a pack',
  'packsPage.addBody':
    'Create a JSON or YAML file in packs/, run npm run validate:packs, and open a pull request. The schema is documented below.',
  'packsPage.schema': 'Pack schema',

  // --- Docs ----------------------------------------------------------------
  'docs.eyebrow': 'Documentation',
  'docs.title': 'Setup, settings and the <em class="serif">privacy model</em>',
  'docs.lede':
    'Everything you need to run ContribMatch locally, connect a model, and understand what it does with your data.',
  'docs.toc': 'On this page',

  // --- Contribute ----------------------------------------------------------
  'contribute.eyebrow': 'Contribute',
  'contribute.title': 'Help make ContribMatch <em class="serif">better</em>',
  'contribute.lede':
    'Good first issues are listed in docs/GOOD_FIRST_ISSUES.md. Pick one, comment on it, and open a pull request.',

  // --- Privacy -------------------------------------------------------------
  'privacy.eyebrow': 'Privacy',
  'privacy.title': 'What ContribMatch <em class="serif">stores</em>',
  'privacy.lede':
    'ContribMatch has no backend and no server-side storage. This page lists everything that is kept, and where.',

  // --- 404 -----------------------------------------------------------------
  'notFound.eyebrow': '404',
  'notFound.title': 'This page <em class="serif">does not exist</em>',
  'notFound.body':
    'The link may be out of date. The matcher and the documentation are both a click away.',
  'notFound.home': 'Go to the home page',

  // --- Design system -------------------------------------------------------
  'design.eyebrow': 'Design system',
  'design.title': 'Living <em class="serif">style guide</em>',
  'design.lede':
    'Tokens, type, spacing and every component in every state. Contrast ratios below are measured in the browser as you read this page.',

  // --- Generic -------------------------------------------------------------
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong',
  'common.retry': 'Try again',
  'common.close': 'Close',
  'packsPage.viewSource': 'View source',
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.back': 'Back',
  'common.newcomerLabel': 'Newcomer friendly',
  'common.language': 'Language',
  'common.docs': 'Documentation',
  'common.source': 'Source',
  'common.issue': 'issue',
  'common.issues': 'issues',
};
