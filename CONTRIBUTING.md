# Contributing to ContribMatch

Thanks for being here. ContribMatch is a small, friendly project and the bar
for a good contribution is low: read the code, run the tests, open a pull
request that explains what you changed.

## The short version

1. Fork and clone.
2. `npm install`
3. `npm test` — this must pass before you open a pull request.
4. Make your change.
5. `npm test` again, and `npm run a11y` if you touched markup or CSS.
6. Open a pull request.

There is no build step and no framework. The site is plain HTML, CSS and
vanilla ES modules, and it has to stay that way.

## Getting set up

```bash
git clone https://github.com/<you>/contribmatch.git
cd contribmatch
npm install
npm run serve      # http://localhost:8080
```

`npm install` is only needed for the development tools (Puppeteer for
screenshots, axe-core for the accessibility audit). The site itself has no
runtime dependencies.

## How the code is arranged

```
js/core/     business logic. No DOM, no globals, portable to Next.js later.
js/github/   the GitHub client, cache, normalisation and contribution chain.
js/ui/       every module that touches the DOM.
js/i18n/     en / hi / hinglish dictionaries. All three must stay mirrored.
css/         tokens, base, components, layout, pages, mascot, heatmap, scene.
packs/       community packs in JSON and YAML.
tools/       validation, audits, screenshot harness.
tests/       node:test suites. No test framework, no build.
```

Two rules matter more than the rest:

- **Business logic never touches the DOM.** If you are writing logic, it goes
  in `js/core/`. If you are writing UI, it goes in `js/ui/`. The split is what
  makes the Next.js port feasible.
- **Never put untrusted text through `innerHTML`.** Issue titles, repository
  names and model output all come from outside. Use the `el()` helper in
  `js/ui/dom.js`, which sets `textContent`.

## Writing copy

- Every heading contains exactly one `<em class="serif">` phrase. There is a
  script that checks this.
- The banned words are **revolutionize**, **supercharge**, **seamless** and
  **unlock**. Say what the thing does instead.
- If you add a string, add it to all three dictionaries in `js/i18n/`. The
  pages fall back to English if a key is missing, but that is a bug, not a
  feature.
- No invented statistics, no testimonials, no fake logos, no decorative
  emoji.

## Adding a community pack

See the [Community packs](packs.html#add) page, or the steps in the README. A
pack is a plain file. `npm run validate:packs` checks it against the schema
before you open the pull request.

## Design changes

The design system lives in `css/tokens.css` and is documented in
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md). If you change a token, run:

```bash
npm run contrast    # every token pair, both themes
npm run a11y        # axe-core plus the custom checks
```

Both must pass. If you introduce a new colour, add it to the token set and to
the pair list in `tools/contrast.mjs` — a colour that is not measured is a
colour nobody has checked.

## Before you open a pull request

- [ ] `npm test` passes.
- [ ] `npm run a11y` passes, if you touched markup, CSS or copy.
- [ ] `npm run contrast` passes, if you touched a token.
- [ ] The page still works at 360px wide and in both themes.
- [ ] Keyboard only: you can reach everything and you can see where you are.
- [ ] Your commit message says what changed and why.

## Commit messages

Short and plain. `Add a Hebrew pack`, `Fix the heatmap arrow keys`,
`Explain the approximate graph in the panel`. No "fixed stuff".

## Reporting a bug

Open an issue with the page, what you did, what you expected, and what
happened. A screenshot helps. If the bug involves a secret, do not paste the
secret — read [`SECURITY.md`](SECURITY.md) first.

## Code of Conduct

[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) applies in every space this project
has: the repository, the issue tracker, and any discussion about the project.

## License

By contributing you agree that your contribution is licensed under the MIT
License, the same as the rest of the project.
