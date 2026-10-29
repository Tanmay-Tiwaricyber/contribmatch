# Demo

Two parts: a **90-second script** for the live demo, and a **slide outline**
for the deck.

---

## 1. The 90-second script

Read the times as a guide, not a rule. The demo is worth more if it is a
little fast than if it is a little slow.

### 0:00 — The problem (15 seconds)

> "Every open source project has thousands of issues and hundreds of good
> first issues. The bottleneck is not finding them. It is the moment after
> you find one, when you have to work out whether it is still open, still
> unclaimed, still alive, and what on earth you are supposed to do first.
> Most people bounce off that moment and never come back."

Show the home page. The 3D contribution wall is behind the headline. Do not
explain it yet.

### 0:15 — The promise (10 seconds)

> "ContribMatch answers that moment. Type a GitHub username."

Type `octocat` into the field. Press **Find my issues**.

### 0:25 — The activity panel (10 seconds)

> "First, it reads your public activity and works out what you already
> know. Without a token this is an approximation of your last three months,
> and it says so. Add a token in Settings and it becomes your exact year."

Point at the label on the activity panel. **Sample** before a name is entered,
**Approximate** after, **Exact** with a token. Say it plainly: the app never
draws an approximation as a full year.

### 0:35 — The match (25 seconds)

The matcher runs. The steps panel fills in live: profile, scout, rank, coach.

> "The Scout searches for open, unassigned issues labelled good first
> issue, help wanted or hacktoberfest, in the languages you actually use.
> The Ranker scores them out of a hundred with rules you can read:
> language match, repository health, labels, freshness, activity, and
> whether the issue body actually says what is expected."

Open a match card.

> "Every score comes with its reasons, an effort estimate, the labels, and
> the health of the repository. If Ollama is not running, you get a
> rule-based fallback banner and a shortlist anyway."

### 1:00 — The coaching (20 seconds)

Open a match.

> "The Coach turns the issue into a plan. What it is really asking for, the
> files you are probably going to open, a step-by-step first plan, a
> polite comment you can copy, and the checklist a good pull request has to
> pass. There is a Quality Guard on top: typo-only changes, mass pull
> requests, and contributions that ignore CONTRIBUTING.md all get flagged."

Switch the language to **हिंदी** or **Hinglish**. The whole interface and the
generated notes follow.

### 1:20 — The guardrails (10 seconds)

> "Three things it will never do. It never posts anything. It never asks
> for a credential it does not need. And it never stores your data on a
> server, because there is no server. Everything is in your browser."

### 1:30 — Close (10 seconds)

> "The shortlist exports as Markdown. The packs are community-owned JSON and
> YAML files. The whole thing is MIT licensed and it is a static site, so you
> can fork it this afternoon and run it for your own community. It is
> open source because the contribution pipeline is the product, and the
> product should belong to the people building it."

---

## 2. Fallbacks

| If | Then |
| --- | --- |
| GitHub is rate limited | Say it. The app shows a friendly state and a link to add a token. This is a feature, not a failure — show it. |
| Ollama is not running | The rule-based fallback banner appears. Say: "The model is not up, so the ranking is pure rules and the coaching is template-based. Everything still works." |
| No key for AI Studio | Mock mode. Open Settings, turn on mock mode, and show the full flow on sample data. |
| The network is down | Mock mode again. |
| Someone asks about the "AI" | The rules do the ranking. The model refines the shortlist and writes the notes. The model is never the only path to an answer. |

**Never fake a live model call.** If the model is not available, say so.

---

## 3. Slide outline

Thirteen slides. About 40 seconds each, so roughly nine minutes, and the
first three are the only ones that matter if the time is short.

---

**1 — Title**

> ContribMatch
> Find an issue you can actually finish.
> *A name, an issue, a first pull request.*
>
> [the 3D contribution wall, still]
> Name · team · hackathon · date

---

**2 — The bottleneck**

> Open source does not have an issue shortage. It has a first-step shortage.
>
> - Is this issue still open?
> - Is it still unclaimed?
> - Is the project still alive?
> - Is it a first contribution for *me*, in a language I use?
> - What is the first pull request supposed to look like?
>
> *(none of these are code questions, and all of them stop people)*

---

**3 — The product**

> One screen. Four answers.
>
> 1. Match: the issues a beginner can actually finish
> 2. Score: 0–100, every point traceable to a rule
> 3. Plan: the files, the steps, the checklist
> 4. Guard: the quality checks a maintainer would run
>
> *[screenshot: the home page with the wall and the activity panel]*

---

**4 — Why open innovation matters**

> - The contribution pipeline is the product, and the product should be owned
>   by the people building it.
> - The friction is not technical. It is informational. Information is
>   something a tool can carry.
> - No backend, no account, no data collection: the trust argument is the
>   architecture, not a promise.
> - MIT licensed and forkable in an afternoon, so a community can run their
>   own version.
>
> *This is the honest answer. The alternative answer is a pitch about
> productivity, and that is not what open source is for.*

---

**5 — Architecture**

> *[the Mermaid diagram]*
>
> - Static site, vanilla ES modules, no build step, no framework
> - Business logic is DOM-free; only `js/ui` touches the document
> - One provider interface, two implementations, one mock
> - Rules first: the model only ever sees the top eight

---

**6 — The agents**

> | Agent | Reads | Writes |
> | --- | --- | --- |
> | Profile | public repos, languages, topics, activity | skills, level |
> | Scout | GitHub search | a candidate list |
> | Ranker | rules, then the model on the top 8 | 0–100 and the reasons |
> | Coach | one issue | the plan, the comment, the checklist |
> | Quality Guard | the plan and the draft | the flags |
>
> Every agent is `async run(input, ctx)` and returns schema-validated JSON.

---

**7 — Open-weight Gemma**

> - Ollama, running locally, for the model that is on your machine
> - Google AI Studio, for a shared key
> - `OLLAMA_ORIGINS` is the setting people get wrong. It is in the docs.
> - The model is never the only path. Rules carry the ranking; the model
>   carries the wording.
> - A key is never committed and never sent anywhere but the API it belongs
>   to.

---

**8 — Exact versus approximate data**

> | Mode | When | What you get |
> | --- | --- | --- |
> | Exact | a token is set | the full calendar from GraphQL |
> | Approximate | no token | about 90 days of public events, mapped |
> | Sample | no name yet | clearly labelled sample data |
>
> The 3D wall always covers the same window as the panel. An approximation is
> never drawn as a full year.
>
> *[screenshot: the activity panel with the sample label]*

---

**9 — The interface**

> *[screenshot: the design system page]*
>
> - Neutral, square, hairlines, one accent
> - Depth from perspective and flat offset shadows, never from glow
> - English, Hindi, Hinglish, including the generated notes
> - Every control has six states and a 24px minimum target
> - WCAG AA throughout; the audit runs on every page, in both themes

---

**10 — Community packs**

> A pack is a plain JSON or YAML file describing skills, tone and vocabulary
> for an ecosystem.
>
> ```json
> { "id": "web-basics", "type": "skill", "skills": ["html", "css"] }
> ```
>
> - Five ship with the project
> - `npm run validate:packs` checks them
> - Adding one is a pull request, not a ticket
> - This is the collaboration model, not a feature list

---

**11 — Try it**

> ```bash
> git clone https://github.com/Tanmay-Tiwaricyber/contribmatch
> cd contribmatch && npm install && npm run serve
> ```
>
> - `npm test` runs everything: the packs, the rules, the providers, the
>   orchestrator, and the copy rules
> - No key needed. Mock mode runs the whole flow offline.
> - Live: *[deployment URL]*

---

**12 — What is honest about its limits**

> - The ranking is a rubric, not a prediction of success.
> - The model writes the notes; it does not decide the match.
> - Without a token the graph is three months, not a year.
> - The search only sees what GitHub's search index sees.
> - It is a static site, which means it cannot do anything on your behalf,
>   and that is on purpose.
>
> The deck presents these as **"By design, not by accident"** — the same five
> facts, framed as deliberate decisions rather than shortcomings. Say them
> either way; never drop them.

---

**13 — Close**

> Find an issue you can actually finish.
>
> - [live URL]
> - [repository]
> - [demo video]
>
> MIT licensed. Built for Hacktoberfest HackDays.
> *Built by [name], [name] and [name].*

---

## 4. Questions to expect

**"Is this just ChatGPT with a GitHub API?"**
No. The ranking is a transparent rubric, and the rules do the work. The model
only refines the shortlist of eight and writes the notes. Turn the model off
and you still get a shortlist, a score and a plan.

**"What if GitHub changes its API?"**
The client is one module, `js/github/api.js`, and the cache means a rate
limit degrades rather than breaks. The contribution chain has three
fallbacks.

**"How do you keep it from posting spam?"**
It cannot post. There is no write path. The comment it drafts is a text you
copy, and the app says so.

**"What happens to my data?"**
Nothing leaves your browser except the GitHub calls and the model call you
asked for. There is no backend, so there is nothing to collect. The privacy
page says this in plain words.

**"Why is the UI so plain?"**
Because the reference for this work is a studio system, not a landing page:
one paper, one ink, hairline rules, one accent, and depth from geometry
rather than glow. It is also fast, and it passes WCAG AA without an
argument.

**"What is next?"**
A server-side route for the model, so keys never reach the client; more
packs; and the start of the issue-level analytics that would tell a
maintainer which good first issues are actually working.
