# Good first issues

A list of starter issues for anyone picking up ContribMatch. Each one is
scoped to a few hours, names the files it touches, and says what "done"
looks like.

**Before you start:** read [`CONTRIBUTING.md`](../CONTRIBUTING.md) and
[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). Run `npm test` and make sure it
passes. If it does not pass on a clean checkout, that is issue 1.

Label them with `good first issue` and `hacktoberfest` when you open them.

---

## Design and UI

### 1. Add a pack for a language the project does not cover yet
**Difficulty:** easy · **Files:** `packs/`, `js/core/packs.js`, `docs/`

Write a pack for an ecosystem ContribMatch does not have one for yet. Rust,
Java, PHP, Elixir, Ruby, Kotlin — pick one that you know. A pack is a plain
JSON or YAML file with an `id`, a `name`, a `type`, a `version`, a
`description`, a `languages` list, a `skills` list, a `tone`, an optional
`level`, and optional `ecosystems`, `vocabulary` and `guidance`.

Then add the file to `PACK_FILES` in `js/core/packs.js` and run
`npm run validate:packs`.

**Done when:** the pack validates, it shows up on the packs page, and the
validator passes in CI.

---

### 2. Add a new mascot mood
**Difficulty:** easy · **Files:** `js/ui/mascot.js`, `css/mascot.css`, `design-system.html`

The mascot has one base drawing with seven moods, set through `data-mood`:
`idle`, `thinking`, `found`, `celebrate`, `oops`, `reading`, `waiting`.

Add an eighth — `cheering`, `confused`, `sleeping`, whatever fits the
product. Draw it with the same flat fills and the same cut-out construction
as the others. No gradients, no glow.

**Done when:** the new mood renders, it appears in the mascot grid on
`design-system.html`, and it is listed in `docs/DESIGN_SYSTEM.md`.

---

### 3. Add a heatmap level or a second heatmap palette
**Difficulty:** easy · **Files:** `css/tokens.css`, `css/heatmap.css`, `design-system.html`

The heatmap has five levels, `--heat-0` through `--heat-4`, and it is
deliberately **not** GitHub green. The 3D scene has a second, more muted ramp
(`--scene-0` through `--scene-4`) because its wall sits behind the hero
headline.

Add an alternative palette — high contrast, monochrome, deuteranopia-safe —
and let the user pick it in Settings.

**Done when:** the new palette is token-driven, it appears on the
design-system page, and `npm run contrast` passes for every new pair.

---

### 4. Give the contribution graph a month-label layout that fits 53 columns
**Difficulty:** medium · **Files:** `js/ui/heatmap.js`, `css/heatmap.css`

The graph scrolls horizontally when the panel is narrow, which works but does
not look deliberate. Make the month labels adapt: show fewer months when
there is not room, or let the graph shrink its cell size to fit.

**Done when:** at 360px the graph fits without a horizontal scroll, and the
labels are still readable. Keyboard navigation and the roving tabindex must
keep working.

---

### 5. Add a "reduce motion" toggle that overrides the system setting
**Difficulty:** easy · **Files:** `js/ui/theme.js`, `js/core/settings.js`, `css/base.css`

The site respects `prefers-reduced-motion`. Add an explicit setting so
somebody can turn motion off for this site only, regardless of the system
preference, and so they can turn it back on.

**Done when:** the setting persists, it overrides the media query in both
directions, and every animation checks it.

---

### 6. Draw the mascot's seven moods in a single contact sheet
**Difficulty:** easy · **Files:** `tools/`, `docs/screenshots/`

`tools/screenshots.mjs` captures pages. Add a small tool that captures every
mood at every size in one image, so a change to the mascot is reviewable at
a glance.

**Done when:** `npm run shots` also writes `docs/screenshots/_mascot-sheet.png`.

---

## Functionality

### 7. Sort the shortlist by repository health
**Difficulty:** easy · **Files:** `js/ui/shortlist-page.js`, `js/core/shortlist.js`

The shortlist exports as Markdown and can be removed from. Add a sort
control: score, freshness, effort, and repository health.

**Done when:** the sort is applied in the UI and in the Markdown export, and
the choice is remembered.

---

### 8. Remember the last filters on the matcher page
**Difficulty:** easy · **Files:** `js/core/settings.js`, `js/ui/app-page.js`

The language, label and sort filters reset every time. Keep them in the
settings store so a returning user gets the same view.

**Done when:** the filters survive a reload, and there is a way to clear
them.

---

### 9. Add a second contribution data source: the commits API
**Difficulty:** medium · **Files:** `js/github/api.js`, `js/github/contributions.js`

The contribution chain is exact (GraphQL) → approximate (public events) →
sample. The approximate mode is limited to about 90 days because the events
feed is limited.

Add a `/repos` and `/commits` based fallback that covers a longer window,
still approximate, still labelled as such.

**Done when:** the new mode is labelled honestly, it never claims to be a
full year, and `tests/contributions.test.js` covers the mapping.

---

### 10. Export the shortlist as a GitHub-flavoured markdown checklist
**Difficulty:** easy · **Files:** `js/core/shortlist.js`

The Markdown export is a list. Make it a checklist that can be pasted into
an issue comment, with the score, the reasons, the effort estimate and a
placeholder for the PR link.

**Done when:** the export is valid Markdown, renders as a task list, and
the round trip is covered by a test.

---

### 11. Warn when a matched repository has not been touched in a year
**Difficulty:** easy · **Files:** `js/core/ranker.js`, `js/ui/match-card.js`

The ranker already weighs repository health. Surface it on the card, with a
plain explanation: "no commits in 14 months". A stale repository is the
single most common reason a first pull request goes nowhere.

**Done when:** the badge appears, the wording is specific rather than
alarming, and the ranker test still passes.

---

### 12. Add a "why not this issue" note to the shortlist
**Difficulty:** medium · **Files:** `js/core/ranker.js`, `js/ui/match-card.js`

For an issue that was considered and dropped, record the reason. Not
required, but it makes the ranking auditable, which is the whole point of a
rule-based score.

**Done when:** the reason is stored with the candidate and can be shown.

---

## Documentation and community

### 13. Write a walkthrough for a language you know
**Difficulty:** easy · **Files:** `docs/`

Pick a language and write a short guide: which labels mean "a good first
issue" there, what a maintainer usually wants in a first pull request, and
how the Contributor Covenant should be followed in practice.

Put it in `docs/guides/<language>.md` and link it from the docs page.

---

### 14. Translate the interface into one more language
**Difficulty:** medium · **Files:** `js/i18n/`

The three dictionaries are mirrored, and a test checks that. Add a fourth.
Copy `js/i18n/en.js`, translate the values, and register the language in
`js/ui/i18n.js` and the language switch.

**Done when:** `npm test` passes with the new dictionary in place, and the
new language appears in the switch.

---

### 15. Add a pack validator rule
**Difficulty:** medium · **Files:** `js/core/packs.js`, `tools/validate-packs.mjs`, `tests/packs.test.js`

The validator checks the schema. Add a semantic rule — for example, that a
pack of type `tone` has a `vocabulary` object, or that the `skills` list has
no duplicates, or that the `description` is at least 40 characters, because
a short description produces a useless coaching note.

**Done when:** the rule is enforced, it is covered by a test, and the error
message tells the author how to fix it.

---

### 16. Write the "why this issue was picked" explainer
**Difficulty:** medium · **Files:** `docs/`, `js/core/ranker.js`

A page that explains the ranking, rule by rule, with the weights, and shows
a worked example. It should be readable by somebody who has never seen the
code.

**Done when:** the page exists, it links to the design system, and the
numbers on it match `js/core/ranker.js`.

---

## Not good first issues

These are real needs, but they are not two-hour tasks. Please ask before
you start one.

- Moving the provider to a server route. It changes the trust model.
- Rewriting the YAML parser.
- Adding a search backend.
- Replacing the vanilla ES modules with a framework.
- The i18n extraction tooling.
