# Architecture

ContribMatch is a static site with no build step. It is plain HTML, CSS and
vanilla ES modules, and it has to stay that way: the whole point of the
project is that a community can fork it, host it and change it without a
toolchain.

That constraint shapes everything below.

---

## 1. The one rule that shapes the code

> **Business logic never touches the DOM. Only `js/ui/*` does.**

`js/core` and `js/github` are pure functions over plain data. They can be
imported into a test, a script, a worker or a server without a DOM. The UI
layer renders their output.

This is not a style preference. It is what makes the Next.js migration in
section 7 a port rather than a rewrite, and it is what lets the test suite run
in Node with no browser at all.

```js
// js/core/ranker.js — pure
export function rankIssues(issues, profile, opts) { /* returns scored issues */ }

// js/ui/match-card.js — the only place that knows what a card looks like
import { rankIssues } from '../core/ranker.js';
```

## 2. The layers

```
┌──────────────────────────────────────────────────────────────┐
│  js/ui/          the only layer that touches the DOM          │
│  dom · icons · i18n · theme · chrome · mascot · heatmap      │
│  toast · copy · steps · match-card · modal · home · app-page  │
│  issue-page · shortlist-page · packs-page · docs-page        │
│  design-system-page · accordion · logo · hero-scene           │
└───────────────▲──────────────────────────────────────────────┘
                │  plain objects in, plain objects out
┌───────────────┴──────────────────────────────────────────────┐
│  js/core/        business logic, DOM-free                     │
│  schema · provider · prompt · level · ranker · agents        │
│  settings · shortlist · orchestrator · packs · yaml          │
│  contrast · mock/                                               │
└───────────────▲──────────────────────────────────────────────┘
                │
┌───────────────┴──────────────────────────────────────────────┐
│  js/github/      the outside world                           │
│  queue · rate-limit · api · cache · catalogue · normalize     │
│  profile · issues · contributions                             │
└──────────────────────────────────────────────────────────────┘
```

### `js/core`

| Module | What it does |
| --- | --- |
| `schema.js` | A hand-written validator. Every agent output is checked against a schema before it is used. |
| `provider.js` | One interface, `generate({system, prompt, schema})`. Four implementations: Ollama, AI Studio, OpenRouter and Groq (the last two share one OpenAI-compatible class). Exactly one retry on a parse or validation failure; a network or configuration error throws immediately. |
| `prompt.js` | Builds prompts. Untrusted text is wrapped in `===BEGIN_UNTRUSTED_DATA===` markers and is never treated as an instruction. |
| `level.js` | Buckets a contributor into 0–4 from commit, pull request, issue and review counts. |
| `ranker.js` | The 100-point score. Rules first; only the top eight go to the model. |
| `agents.js` | The six agents. Each is `async run(input, ctx)` and returns schema-validated JSON. |
| `orchestrator.js` | Runs the agents in order and reports each step through `ctx.onStep`. |
| `settings.js` | Preferences in `localStorage`, secrets in `sessionStorage`. |
| `shortlist.js` | The shortlist in `localStorage`, with Markdown export. |
| `packs.js` | Loads and validates community packs. |
| `yaml.js` | A small YAML parser, so a pack can be written in YAML without a dependency. |
| `mock/` | Sample data and a mock provider, so the whole flow runs offline. |

### `js/github`

| Module | What it does |
| --- | --- |
| `queue.js` | The one request gate: a single GitHub request in flight, paced (~600 ms default, configurable 500–1000 ms band), identical in-flight GETs deduplicated by normalized URL, bounded queue with `QueueFullError`, pause support for rate-limit resets, injectable clock/wait for tests. Browsers share the `defaultGate` singleton; tests make isolated gates. |
| `rate-limit.js` | Parses `X-RateLimit-*` / `Retry-After` headers, tracks core / search / graphql quotas separately, classifies 403/429 into primary limit, secondary limit or plain permission error. |
| `api.js` | The typed GitHub client on top of the queue: retry policy (transient network/5xx retry ≤2 with jitter, secondary limit ≤2, primary limit pauses and fails fast), bearer token from settings when `useToken` is on, status helpers for the UI (`getGateStatus`, `getRateLimitStatus`). |
| `cache.js` | Two-level TTL cache: in-memory session layer + `localStorage` under the `contribmatch:v1:` prefix. Adds `stale(key)` (expired-but-usable copies), `invalidate(prefix)` and `stats()`. Instances with an explicit `storage` (tests) bypass the shared memory layer. |
| `catalogue.js` | Layer A: loads and validates the static `data/issues.json` catalogue, maps entries to the ranker's issue shape, dedupes by id, filters languages, marks staleness. Session-cached in memory. |
| `profile.js` / `issues.js` / `contributions.js` / `normalize.js` | Domain fetchers and normalisers. The scout now tries the fresh catalogue first, then the live (queued, cached) search, then the stale catalogue as a last resort. |
| `normalize.js` | Turns raw GitHub shapes into the internal shape. Also the level thresholds and the heat buckets. |
| `profile.js` | Reads the public profile and infers skills and level. |
| `issues.js` | The Scout: per-language searches, dedupe, batched repository lookups. |
| `contributions.js` | The exact → approximate (events + a year of public issues and pull requests) → sample chain. |

### `js/ui`

Every module that creates or changes a node. They all build elements with the
`el()` helper in `js/ui/dom.js`, which sets `textContent`. `innerHTML` is used
in exactly one place, with a literal string.

## 3. The data flow

```
username
   │
   ├─ Profile Agent ──► profile { languages, topics, skills, level, repos }
   │                     from public repos, languages, topics and activity
   │
   ├─ Scout Agent ────► issues[]
   │                     1. fresh static catalogue (data/issues.json) — no API call
   │                     2. live search, queued + cached:
   │                        search: is:issue is:open no:assignee
   │                              label:"good first issue" language:<X>
   │                        per language, then per remaining label, then dedupe
   │                     3. fallback: stale catalogue, clearly labelled
   │
   ├─ Ranker ──────────► rule score 0–100 + the reasons
   │                     language 25 · health 22 · labels 18 · freshness 15
   │                     activity 10 · hygiene 10
   │
   ├─ Gemma ───────────► ease, clarity, fit for the top 8 only
   │                     final = 65% rules + 35% model
   │
   ├─ Match cards ─────► the shortlist, sorted and filterable
   │
   └─ Coach Agent ─────► explanation · likely files · first plan
                         comment · PR checklist
                              │
                              └─ Quality Guard ──► typo-only · mass PR · CONTRIBUTING ignored
```

Every step reports through `ctx.onStep(message)`, which is what drives the
live steps panel on the matcher page.

## 4. The provider contract

One interface, four implementations, one mock. OpenRouter and Groq share an
OpenAI-compatible base class — same ask, same retry rules, different endpoints.

```js
const provider = createProvider({ kind: 'ollama', model: 'gemma3:12b' });
const result = await provider.generate({ system, prompt, schema });
// result is validated against the schema, or it throws
```

- **Ollama.** A local server. `OLLAMA_ORIGINS` has to allow the page's
  origin, or the browser blocks the request before it is made. The setting
  screen says so.
- **AI Studio.** A key in `sessionStorage`. The key is only ever sent to
  Google's endpoint. The app warns, in the interface, that a real key must
  never be committed.
- **OpenRouter.** Same key-in-`sessionStorage` rule. Hosts Gemma directly
  (`google/gemma-3-27b-it`, with `:free` variants), plus many other open
  models — so the open-weights story ships without an install.
- **Groq.** Same key rule, ultra-fast inference. Groq retired its Gemma
  models, so a current open model (`openai/gpt-oss-120b`) is the default there;
  Gemma stays first through Ollama, AI Studio and OpenRouter.
- **Mock.** Runs the whole flow offline on realistic sample data, with
  simulated steps, so a judge who has no GPU and no key still sees the product
  work.

### Failure behaviour

| Failure | What happens |
| --- | --- |
| The model returns invalid JSON | One retry, then the agent falls back to a rule-based result. |
| The model returns valid JSON that fails the schema | The same. |
| The network is down, or the key is wrong | The error surfaces in the steps panel, and the flow continues with rules only. |
| No Ollama installed | A "rule-based fallback" banner. The shortlist is still produced. |

The rule is simple: **the app is never blocked by the model.** A missing or
broken model degrades the writing, not the function.

## 5. Prompt safety

Issue titles, issue bodies, README text and repository descriptions are
untrusted. They come from repositories that anyone can create.

- Every prompt wraps untrusted content in `===BEGIN_UNTRUSTED_DATA===` and
  `===END_UNTRUSTED_DATA===` markers, with an instruction above the markers
  saying the enclosed text is data, not instructions.
- The system prompt always starts with `Agent: <name>`.
- The model output is parsed and validated. It is never rendered as HTML.
- The model never sees a token, a key or a personal email address.

## 6. Storage

| Key | Store | What |
| --- | --- | --- |
| `contribmatch:v1:settings` | `localStorage` | Theme, language, mock mode, whether a token is used. |
| `contribmatch:v1:secrets` | `sessionStorage` | The GitHub token and the AI Studio key. Cleared when the tab closes. |
| `contribmatch:v1:shortlist` | `localStorage` | The saved issues. |
| `contribmatch:v1:lang` | `localStorage` | The language. |
| `contribmatch:v1:theme` | `localStorage` | The theme. |
| `contribmatch:v1:last-results` | `sessionStorage` | The last matcher run, so the matcher page can be deep-linked. |
| `contribmatch:v1:<key>` | `localStorage` | The GitHub response cache, with a TTL. |

There is no server, so there is no server-side storage, and nothing is
collected. The privacy page says the same thing in the product's own words.

## 7. The Next.js migration plan

ContribMatch does not need Next.js today. This is the plan for when it does,
so the migration is mechanical.

### Phase 1 — keep the core, swap the shell

1. `git mv js/core src/core` and `git mv js/github src/github`. Nothing
   changes: both are DOM-free ES modules and they import each other with
   relative paths.
2. Add `app/` with one route per page. Each route is the current HTML with
   the shared header and footer replaced by a React layout.
3. The layout renders the same header and footer components, ported from
   `js/ui/chrome.js`. The theme, language and focus-trap behaviour become
   React state and hooks.
4. The pages become server components that render static content, and
   client components for the parts that need the browser: the hero activity
   panel, the matcher, the heatmap, the packs browser.

### Phase 2 — move the UI layer

5. Each `js/ui/*` module becomes a React component. The `el()` helper
   becomes JSX; the modules that already return a node and an event map
   translate directly.
6. `js/core/agents.js` keeps its `async run(input, ctx)` signature. The
   `ctx.onStep` callback becomes a server-sent-event or a streamed React
   update.
7. The provider moves to a route handler, so a key never reaches the client.
   This is the one real architectural gain, and it is worth doing on its own
   if the project ever needs server-side model calls.

### Phase 3 — the parts that need a server

8. The GitHub token and the AI Studio key move from `sessionStorage` to the
   server side, with the user's own key, encrypted at rest, if a deployment
   ever needs it. The current design deliberately avoids this.
9. The shortlist moves from `localStorage` to a database, if a deployment
   wants cross-device shortlists.

### What does not change

- The ranking rules and their weights.
- The provider contract.
- The schema validation.
- The pack format and the pack validator.
- The prompt-safety rules.
- The tests, except that they move from `node --test` to the same runner
  under the same assertions.

### What would break

- `js/ui/dom.js` and the `el()` helper. They are replaced by JSX.
- The CSS. It is already plain CSS with custom properties, so it ports as
  is. Only the class names that were tied to the DOM structure would need a
  look.
- The screenshot and accessibility harnesses. They would need to point at the
  dev server instead of a static one.

**Estimated effort:** Phase 1 is a day. Phase 2 is two days. Phase 3 depends
on whether a server is wanted at all.

## 8. Testing

`node:test`, no framework, no build.

| Suite | What it covers |
| --- | --- |
| `tests/ranker.test.js` | The weights, the score bands, the model blend, the fallback behaviour. |
| `tests/github.test.js` | The query builder, the search parsing, the dedupe, the batching. |
| `tests/contributions.test.js` | The event mapping, the window filter, the GraphQL normalisation, the totals. |
| `tests/level.test.js` | The 0–4 bucketing. |
| `tests/packs.test.js` | The pack schema, the JSON and YAML parsers. |
| `tests/provider.test.js` | The JSON extraction, the one retry, the schema validation. |
| `tests/orchestrator.test.js` | The whole flow, end to end, in mock mode. |
| `tests/shortlist.test.js` | The shortlist store and the Markdown export. |
| `tests/copy.test.js` | The banned words, the mirrored dictionaries, the serif rule, the accent colour, no gradients, no radii. |

```bash
npm test
```

Also:

```bash
npm run contrast   # every token pair, both themes
npm run a11y       # axe-core plus the custom checks
npm run shots      # captures at 360 / 768 / 1280 / 1920, light and dark
```

The accessibility and screenshot tools start their own static server if one is
not already running, so they work in CI without a second terminal.
