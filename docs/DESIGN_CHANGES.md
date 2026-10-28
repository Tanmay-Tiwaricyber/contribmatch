# Design changes

This file records every visual and accessibility change made after the UI
audit, with the measured contrast ratios before and after. Every "after" number
is produced by `npm run contrast`, which parses `css/tokens.css` and computes
the WCAG 2.1 relative-luminance ratio for each pair. Nothing here is
estimated.

Section 1 of the brief — the locked design decisions — was not touched. The
accent colour, the typography families, the logo, the mascot, the contrast
repairs listed below and the anti-slop rules all survive the restyle.

---

## 1. The four contrast repairs

These are the repairs the brief calls out specifically. Each one was a real
failure at the time of the audit.

### 1.1 Faint helper text — target 4.5:1

| | Before | After |
| --- | --- | --- |
| Token | `--faint` | `--ink-3` |
| Light theme | 4.12:1 | **4.57:1** on `--paper` |
| Dark theme | 4.12:1 | **4.59:1** on `--paper` |
| Where it shows | field hints, table captions, the meta row under a card | the same places |

`--ink-3` is `#6d6d6f` in light and `#7e7e80` in dark. Both are above 4.5:1 on
their own page background, and 4.91:1 / 4.69:1 on the raised surface where
most of it sits.

### 1.2 Form control borders — target 3:1

| | Before | After |
| --- | --- | --- |
| Token | `--control-border` (warm grey) | `--control-border` (neutral) |
| Light theme | 2.58:1 | **4.91:1** on `--paper-raised` |
| Dark theme | 2.58:1 | **4.69:1** on `--paper-raised` |
| Where it shows | every input, select and textarea border | the same |

The border is the only thing that tells a low-vision user where the field
ends, so it is held to the 3:1 non-text requirement rather than being treated
as decoration.

### 1.3 The low-score ring restroke — target 3:1

The score ring is now restroked by band, so a weak match reads as weak rather
than merely as a different colour.

| Band | Colour | Before | After (light) | After (dark) |
| --- | --- | --- | --- | --- |
| Low, under 40 | `--danger` | 2.11:1 | **6.21:1** | **6.46:1** |
| Mid, 40 to 69 | `--warning` | not banded | **6.36:1** | **8.71:1** |
| High, 70 and up | `--accent` | 3.50:1 | **3.50:1** | **5.15:1** |

The band thresholds live in `scoreBand()` in `js/ui/match-card.js`.

### 1.4 The dark error toast — target 4.5:1 for text, 3:1 for icon and border

| | Before | After (light) | After (dark) |
| --- | --- | --- | --- |
| Text | 3.94:1 | **6.54:1** | **6.16:1** |
| Icon and border | 1.80:1 | **6.21:1** | **6.46:1** |

`--danger-ink` on `--danger-solid` for the text, and `--danger-solid` against
the page behind it for the icon and the border.

### What was deliberately not changed

Decorative hairlines and card borders were **not** darkened. They are
decoration, they are reported by the contrast tool as decorative rather than
as required pairs, and they are meant to stay quiet:

| Pair | Measured | Treated as |
| --- | --- | --- |
| `--line` on `--paper` | 1.15:1 | decorative |
| `--line-strong` on `--paper` | 1.58:1 | decorative |
| `--faint` on `--paper` | 2.72:1 | decorative |

---

## 2. The restyle

The brief asks for the interface to match `getartcraft.com` closely, to use
that site's font, to avoid anything that reads as generated filler, and to
show the contribution graphics in 3D behind the hero text.

### 2.1 Type

The reference site uses Archivo (display and UI), Instrument Serif (a single
italic phrase per heading), Inter (body) and Geist Mono (labels). ContribMatch
already self-hosted exactly those four families, all under the SIL Open Font
License, so the font was already in place and the work was in the
**treatment**, not the files.

| Change | Before | After |
| --- | --- | --- |
| Display weight | 700 | **620** (`--weight-display`) |
| Display width | 100% | **118%** (`--stretch-display`) |
| Headings | 2.5rem to 3rem | `clamp()` from 2rem to 2.5rem, tighter tracking |
| Body | 1rem / 1.65 | 1rem / 1.6, Inter |
| Labels | 12px, 600, sentence case | 11px, 600, uppercase, 0.15em tracking, Geist Mono |
| Emphasised phrase | italic, colour change only | italic, one phrase per heading, in the secondary ink |

Noto Sans Devanagari was added to **every** font stack. The four Latin faces
carry no Devanagari, so the Hindi build was rendering tofu inside the mono
stack until the fallback chain was fixed.

### 2.2 Colour

The warm paper-and-ink palette was replaced with the reference's neutral
system. The accent did not change.

| Token | Before | After (light) | After (dark) |
| --- | --- | --- | --- |
| Page | warm cream | `#f2f1ee` | `#121316` |
| Raised surface | warm white | `#faf9f7` | `#101014` |
| Recessed surface | warm sand | `#e9e8e4` | `#060607` |
| Ink | near black | `#101014` | `#f2f1ee` |
| Secondary ink | warm grey | `#666667` | `#989898` |
| Muted ink | warm grey | `#6d6d6f` | `#7e7e80` |
| Hairline | warm | `#e3e2df` | `#26262b` |
| Strong hairline | warm | `#c3c2be` | `#3d3d42` |
| Accent | `#2d81ff` | `#2d81ff` | `#2d81ff` |
| Accent text | `#1659c4` | `#1659c4` | `#74aaff` |

Two new tokens were added: `--accent-on-invert`, because the inverted block is
dark in the light theme and light in the dark theme, and `--accent-text`
darkened to `#1460d6` so an accent link inside a recessed code chip clears
4.5:1 (4.93:1 on the chip, 5.27:1 on paper).

### 2.3 Shape, rule and surface

| Change | Before | After |
| --- | --- | --- |
| Corner radius | 4px to 12px | **0** everywhere |
| Shadow | soft, blurred, multi-layer | flat offset, hard edge, no blur |
| Rules | 1px warm borders | 1px hairlines, with a `gap-px` rhythm |
| Texture | none | a flat SVG scanline tile, 8% ink |
| Buttons | rounded, filled, soft | 11px mono, uppercase, square, inverted primary |
| Inverted block | none | a full-bleed section with an inverted palette |
| Marquee | none | a 36-second linear band of monospace labels |
| Section markers | none | a numbered `01`–`06` index with a hairline |

### 2.4 The 3D hero

The brief asks for the contribution graphics in 3D behind the hero text.

- The wall is a real 3D plane: 53 columns by 7 rows of cells taken from the
  same contribution data the panel next to it shows, tilted with `rotateX` and
  `rotateZ`, and given a hard offset shadow.
- Three statistic panels float in the same space with their own rotations and
  shadows.
- **Depth never comes from glow or gradient.** Every surface is a flat fill.
  There is not a single `linear-gradient` or `radial-gradient` in the project,
  including the scanline texture, which is a flat SVG data-URI tile.
- The wall always covers the same window as the panel. An approximate graph
  draws about thirteen weeks, not fifty-three, and says so in the label.
- On a phone the graphic gets its own band above the headline instead of
  running behind it, and the panels thin down to one.
- `prefers-reduced-motion` stops the float animations and the marquee.

### 2.5 The header and footer

| Change | Before | After |
| --- | --- | --- |
| Header background | translucent with a backdrop blur | solid `--paper` with a hairline |
| Nav item | rounded pill on hover | colour change only, with an accent underline for the current page |
| Footer headings | `h3` | `h2` (also an accessibility fix) |
| Footer links | text only | given a real hit area |

---

## 3. Bug fixes found while restyling

These were not design changes, but they were found during the same work.

| # | Bug | Fix |
| --- | --- | --- |
| 3.1 | `ratingsToScore` multiplied a 0–1 rating by 100 inside a function that already returned 0–100, so a perfect rating scored 10,000. | Removed the stray `×100`. |
| 3.2 | `mergeRatings` let a fallback rule rating move the final score, so a run with no model still produced a model-flavoured number. | A fallback rating is marked and the rule score is kept. |
| 3.3 | `normalizeEvents` counted events outside the day window into the totals, so the totals did not match the series. | Events outside the window are skipped. |
| 3.4 | The heatmap's `role="grid"` had no row children, which axe-core reports as `aria-required-children`. | Seven `role="row"` wrappers, `role="gridcell"` cells, explicit `gridColumn` and `gridRow`. |
| 3.5 | `issue.html` had no `h1`. | Added a real `h1` and a lede. |
| 3.6 | The footer printed raw `<em class="serif">` markup, because a heading string was applied as text. | A plain `footer.shortlist` key. |
| 3.7 | The field error rule showed an empty red icon, because `display: flex` overrode the user agent's `[hidden]`. | A global `[hidden] { display: none !important; }`. |
| 3.8 | Five SVG console errors on every page: the icon module put a whole icon into one `<path d>`. | Icons are built as element arrays with `createElementNS`. |
| 3.9 | The app page overflowed to 599px at 360px, and the design-system page to 368px. | `min-width: 0` on grid children, `overflow-wrap: anywhere` on long text, `clamp()` on the type specimen. |
| 3.10 | The app page showed an empty Filters panel when there were no results. | The panel is hidden until there is something to filter. |

---

## 4. Verifying the numbers

```bash
npm run contrast   # every required pair, both themes
npm run a11y       # axe-core plus the custom checks, 11 pages, both themes
```

The contrast tool prints the measured ratio for every pair, marks the
decorative ones, and exits non-zero if a required pair fails. The
accessibility harness does the same. Both are part of `npm test`.
