# UI audit

**Scope:** every HTML page, every CSS file, every JavaScript module, and the
shared component library.
**Method:** source read, then a Puppeteer pass at 360 / 768 / 1280 / 1920 in
light and dark, then axe-core plus a set of hand-written checks.

This audit was written **before** the visual restyle and before the
accessibility repairs, and it is kept in the repository as the record of what
was found. Nothing in Section 1 of the original brief — the locked design
decisions — was changed as a result of it. The repairs listed under *Fixes
applied* were all either accessibility failures or outright bugs.

**Summary:** the site was functionally complete and honest about its data, but
it had a warm paper-and-ink look that did not match the reference, four
contrast failures, one broken ARIA structure, one missing `h1`, one heading
level jump, a touch-target problem across most interactive elements, two
horizontal-overflow bugs on small screens, five console errors on every page,
and a handful of copy-rule breaches.

---

## 1. Structure and semantics

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 1.1 | `issue.html` had no `h1`. The page opened on an `h2`, so it had no accessible name and skipped the top of the heading outline. | High | Fixed — a real `h1` plus a lede. |
| 1.2 | `404.html` went from `h1` straight to `h3` in the footer columns. | Medium | Fixed — footer column headings are now `h2`. |
| 1.3 | The contribution heatmap used `role="grid"` on a flat container with no row children, which axe-core reports as `aria-required-children`. The cells were focusable but had no row to belong to. | High | Fixed — a real `role="grid"` with seven `role="row"` wrappers and `role="gridcell"` cells carrying explicit `gridColumn` / `gridRow`. |
| 1.4 | Landmark regions were present but not consistently labelled. | Low | Fixed — `aria-labelledby` on the activity, steps and source panels. |
| 1.5 | The mobile menu was a disclosure, not a dialog: focus could tab out of it into the page behind. | Medium | Fixed — the open menu traps focus and restores it to the toggle on close. |

## 2. Contrast

Measured with `tools/contrast.mjs`, which parses the token file and computes
the WCAG 2.1 relative-luminance ratio for every pair in both themes.

| # | Finding | Before | Required | Status |
| --- | --- | --- | --- | --- |
| 2.1 | Faint helper text on paper was below 4.5:1. | 4.12:1 | 4.5:1 | Fixed |
| 2.2 | Form control borders were below 3:1 against the field surface, so inputs had no visible boundary for low-vision users. | 2.58:1 | 3:1 | Fixed |
| 2.3 | The low-score ring on a match card was drawn in a tint that disappeared against the card. | 2.11:1 | 3:1 | Fixed |
| 2.4 | The dark error toast used a dark red on a dark surface for its text, and its icon and border failed the 3:1 non-text requirement. | 3.94:1 text / 1.8:1 icon | 4.5:1 / 3:1 | Fixed |

Decorative hairlines and card borders were **not** darkened. They are
decoration, they are reported as decorative, and they stay quiet. The exact
before-and-after numbers are in [`DESIGN_CHANGES.md`](DESIGN_CHANGES.md).

Two further contrast failures were found later and fixed in the same pass:

- The accent link colour on a recessed code chip was 4.21:1. The accent text
  token was darkened to `#1460d6`, which gives 4.93:1 on the chip and 5.27:1
  on paper.
- Section-index numbers used the accent graphic colour (`#2d81ff`, 3.26:1 on
  paper). They are text, so they moved to the accent text token, and inside
  an inverted block they use a new `--accent-on-invert` token.

## 3. Layout and responsiveness

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 3.1 | `app.html` overflowed to 599px at a 360px viewport. Grid items default to `min-width: auto`, and the longest option in the sort `<select>` set the minimum content width. | High | Fixed — `min-width: 0` on grid children, `overflow-wrap: anywhere` on code and long titles, and the input group stacks below 480px. |
| 3.2 | `design-system.html` overflowed to 368px at 360px. The 48px "ContribMatch" type specimen was 319px wide inside a 262px card. | Medium | Fixed — a `.type-sample` class with `clamp()` sizing. |
| 3.3 | The header overflowed to 490px at 360px because the language switch was always visible. | Medium | Fixed — the switch moves into the mobile menu. |
| 3.4 | The app page showed an empty "Filters" panel when there were no results, because the filter options are derived from the results. | Low | Fixed — the panel is hidden until there is something to filter. |
| 3.5 | The heatmap was clipped at the panel edge with no way to tell that it scrolled. | Low | Fixed — the graph now shows the window the data actually covers, so it fits. |

## 4. Interaction and target size

axe-core's target-size rule (WCAG 2.2 SC 2.5.8, 24 × 24 CSS pixels) reported
**397 interactive elements** below the minimum across the eleven pages.

- The bulk were heatmap cells, which are 11px by design: a contribution graph
  cannot have 24px cells and still read as a year. They are inside a
  `role="grid"` with arrow-key navigation, a roving tabindex, and a
  screen-reader summary and data table, which is the pattern the rule points
  to. Documented as a deliberate exception in `tools/a11y-audit.mjs`.
- Breadcrumb links, footer links and table-of-contents links were genuinely
  too small, and are now given real hit areas rather than being excluded.
- Links that flow inside a sentence are exempt under SC 2.5.8, and the audit
  now recognises that case instead of flagging every inline link.

## 5. Console and runtime

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 5.1 | Five SVG console errors on every page. The icon module put a whole icon into a single `<path d>`, which is invalid. | High | Fixed — icons are built as element arrays with `createElementNS`. |
| 5.2 | The error message under a form field showed a stray red icon with no text. The rule used `display: flex`, which overrode the user agent's `[hidden]`. | Medium | Fixed — a global `[hidden] { display: none !important; }`. |
| 5.3 | The footer printed the raw markup `<em class="serif">` because a heading string was applied as text instead of HTML. | Medium | Fixed — a plain `footer.shortlist` key. |
| 5.4 | The ranker multiplied a 0–1 rating by 100 inside a function that already returned 0–100, so a perfect model rating scored as 10,000. | High | Fixed. |
| 5.5 | A fallback rule rating could move the final score, so a "model unavailable" run still produced a model-flavored number. | Medium | Fixed — fallback ratings are marked and the rule score is kept. |
| 5.6 | `normalizeEvents` counted events outside the day window into the totals, so the totals did not match the series. | Medium | Fixed. |

## 6. Visual system

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 6.1 | The palette was a warm paper-and-ink scheme with rounded corners, which did not match the reference site the brief asks for. | High | Restyled to a neutral system: square corners, hairline rules, an invert block, a marquee band, HUD labels and a scanline texture. |
| 6.2 | The hero had no depth. | High | A 3D contribution wall built from the user's real activity now sits behind the headline, with floating statistic panels. Depth comes from perspective, flat fills and hard offset shadows only. |
| 6.3 | Buttons were rounded, filled and soft. | Medium | Now mono, uppercase, 11px, square, with an inverted primary. |
| 6.4 | The field error style used a `transparent` `linear-gradient` to fake a fade. | Low | Removed — there are no gradients anywhere in the project, including the scanline texture, which is a flat SVG tile. |
| 6.5 | Devanagari rendered as tofu in the mono stack. The Latin faces carry no Devanagari, and the fallback chain did not include a face that does. | High | Fixed — Noto Sans Devanagari is in every font stack. |

## 7. Copy and content

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 7.1 | Headings did not consistently carry exactly one serif italic phrase. | Medium | Fixed, and checked mechanically by `tools/apply-serif.py`. |
| 7.2 | The banned words — revolutionize, supercharge, seamless, unlock — appeared in marketing copy. | Medium | Removed. A check is part of the test suite. |
| 7.3 | The contribution panel did not say clearly enough when the graph was approximate. | High | The label is now fixed copy, and the 3D wall covers the same window as the panel, so an approximation is never drawn as a full year. |
| 7.4 | The packs page collapsed each pack into an accordion, hiding the description and the source. | Low | The list now shows every pack in full, with the raw JSON or YAML in a dialog. |

---

## What the audit did not flag

- **The DOM / logic split.** `js/core` and `js/github` are already free of
  DOM access, and only `js/ui` touches the document. No change needed.
- **Escaping.** Every untrusted value is inserted with `textContent` through
  the `el()` helper. `innerHTML` is used in exactly one place, with a literal
  string.
- **The provider contract.** The one-retry-then-fail behaviour and the strict
  JSON validation were already in place and are covered by tests.
- **The contribution data chain.** Exact → approximate → sample, with the
  right label on each, was already correct.
- **Keyboard support in the heatmap.** Arrow keys, roving tabindex, and
  focus-visible tooltips were already in place.

## Reproducing the audit

```bash
npm run serve     # in one terminal
npm run a11y      # axe-core plus the custom checks, 11 pages, both themes
npm run contrast  # every token pair, both themes
npm run shots     # captures at 360 / 768 / 1280 / 1920, light and dark
```

The accessibility harness exits non-zero when it finds a violation, so it can
be used in CI.
