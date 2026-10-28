# Design system

Everything in ContribMatch is token-driven. This file is the reference; the
live version is on [`/design-system.html`](../design-system.html), which pulls
the same tokens and measures the contrast pairs in the browser.

The live page is the source of truth for the contrast numbers. This file
explains the intent.

---

## 1. The idea

A neutral studio system: one paper colour, one ink, hairline rules, and a
single interactive accent.

- **Flat.** No gradients anywhere in the project, including textures. The
  scanline is a flat SVG data-URI tile, not a gradient.
- **Square.** Every radius token is `0`. A test enforces this.
- **Physical.** Depth is a hard offset shadow in the ink colour, the way a
  printed card sits on a table. Never a glow, never a blur, never glass.
- **One accent.** `--accent` is `#2d81ff` and it is the only interactive
  colour. Everything else is ink on paper.

## 2. Colour

### Light

| Token | Value | Use | Measured |
| --- | --- | --- | --- |
| `--paper` | `#f2f1ee` | the page | — |
| `--paper-raised` | `#faf9f7` | cards, panels | — |
| `--paper-sunken` | `#e9e8e4` | code chips, wells, table heads | — |
| `--paper-overlay` | `#ffffff` | modals | — |
| `--ink` | `#101014` | body text | 16.81:1 on `--paper` |
| `--ink-2` | `#666667` | secondary text | 5.08:1 on `--paper` |
| `--ink-3` | `#6d6d6f` | labels and captions | 4.57:1 on `--paper` |
| `--faint` | `#939392` | decoration only, never text | 2.72:1 (decorative) |
| `--line` | `#e3e2df` | hairlines | 1.15:1 (decorative) |
| `--line-strong` | `#c3c2be` | edges that must read as a boundary | 1.58:1 (decorative) |
| `--accent` | `#2d81ff` | the one interactive colour | 3.26:1 (graphics) |
| `--accent-solid` | `#1659c4` | solid button fill | 6.30:1 with white text |
| `--accent-text` | `#1659c4` | accent-coloured text | 5.70:1 on `--paper` |
| `--control-border` | `#6d6d6f` | input borders | 4.91:1 on `--paper-raised` |
| `--focus-ring` | `#2d81ff` | focus outline | 3.26:1 on `--paper` |

### Dark

| Token | Value | Measured |
| --- | --- | --- |
| `--paper` | `#121316` | — |
| `--paper-raised` | `#101014` | — |
| `--paper-sunken` | `#060607` | — |
| `--paper-overlay` | `#1a1d22` | — |
| `--ink` | `#f2f1ee` | 16.45:1 on `--paper` |
| `--ink-2` | `#989898` | 6.44:1 on `--paper` |
| `--ink-3` | `#7e7e80` | 4.59:1 on `--paper` |
| `--accent` | `#2d81ff` | — |
| `--accent-text` | `#74aaff` | 7.82:1 on `--paper` |
| `--control-border` | `#7e7e80` | 4.69:1 on `--paper-raised` |

### Inverted blocks

The final call to action inverts the page. The block is dark in the light
theme and light in the dark theme, so it carries its own palette and its own
accent.

| Token | Light | Dark |
| --- | --- | --- |
| `--invert-bg` | `#101014` | `#ffffff` |
| `--invert-fg` | `#f2f1ee` | `#0b0b0c` |
| `--invert-muted` | `#a3a3a2` | `#5c5c5e` |
| `--invert-line` | `#3a3a3e` | `#d7d6d2` |
| `--accent-on-invert` | `#74aaff` | `#1659c4` |

### Semantic

`--success`, `--warning`, `--danger` and `--info` each come with a `-wash`
background and a `-border`. The text colour is the one that has to pass
4.5:1; the wash and border are decoration.

### Contribution heatmap

Never GitHub green. Five levels, paper-tinted to accent blue, in both themes.

| Level | Light | Dark |
| --- | --- | --- |
| `--heat-0` | `#e4e3e0` | `#1c1d20` |
| `--heat-1` | `#d3e1ff` | `#16294a` |
| `--heat-2` | `#a9c8ff` | `#1d4689` |
| `--heat-3` | `#5a95ff` | `#2f6bd0` |
| `--heat-4` | `#2d81ff` | `#5a95ff` |

### The 3D scene

The wall sits behind the hero headline, so its cells are muted further than
the heatmap. The darkest cell still gives 5.27:1 against `--ink`, which is
what makes it safe to read text on top of it.

| Level | Light | Dark |
| --- | --- | --- |
| `--scene-0` | `#faf9f7` | `#101014` |
| `--scene-1` | `#dbe7ff` | `#16294a` |
| `--scene-2` | `#b9d0ff` | `#1d4689` |
| `--scene-3` | `#8fb4ff` | `#2f6bd0` |
| `--scene-4` | `#4b86f0` | `#5a95ff` |

---

## 3. Typography

Four families, all self-hosted under the SIL Open Font License 1.1, in
`assets/fonts/`.

| Role | Family | Axis | Token |
| --- | --- | --- | --- |
| Display | Archivo | weight 100–900, width 62–125% | `--font-display` |
| Emphasis | Instrument Serif | regular + italic | `--font-serif` |
| Body | Inter | variable | `--font-body` |
| Labels | Geist Mono | variable | `--font-mono` |

**Noto Sans Devanagari** is the fallback in every stack. None of the four
Latin faces carries Devanagari, so without it the Hindi build renders tofu.

### The rules

- **Display type is 620 weight at 118% width.** `--weight-display` and
  `--stretch-display`. The narrow-but-heavy combination is what makes a
  heading look set rather than defaulted.
- **One italic phrase per heading.** Instrument Serif, italic, inside
  `<em class="serif">`. A test enforces that no string carries more than one,
  and that every page and section heading carries exactly one.
- **Labels are 11px, uppercase, 0.15em tracking, in Geist Mono.** They are
  called HUD labels. They mark a region, a field, a step.
- **Body is 15px Inter at 1.6.** Prose is capped at 68 characters.

### Scale

| Token | Size | Used for |
| --- | --- | --- |
| `--fs-xs` | 11 | HUD labels, badges, table heads |
| `--fs-sm` | 13 | secondary text, code |
| `--fs-base` | 15 | body |
| `--fs-md` | 16 | input text, lede |
| `--fs-lg` | 18 | card titles, modal titles |
| `--fs-xl` | 22 | section sub-headings |
| `--fs-2xl` | 30 | page titles |
| `--fs-3xl` | 36 | the hero headline |
| `--fs-4xl` | 48 | display specimens |
| `--fs-5xl` | 72 | the design-system specimen |

---

## 4. Space

An 8px rhythm, with 4px for fine tuning.

```
--sp-1  4px     --sp-7   40px
--sp-2  8px     --sp-8   48px
--sp-3  12px    --sp-9   64px
--sp-4  16px    --sp-10  80px
--sp-5  24px    --sp-11  96px
--sp-6  32px    --sp-12  128px
```

Layout: a 1200px container with a 12-column grid, a 68ch prose measure, a
58px sticky header, and a 44px minimum touch target.

---

## 5. Shape, shadow and motion

- **Radius: zero.** `--r-xs` through `--r-pill` are all `0`.
- **Shadows are physical.** `--shadow-sm` is `1px 1px 0`, `--shadow-md` is
  two hard offsets, `--shadow-lg` is two larger ones. No blur radius.
- **Motion is short.** 120ms for a hover, 180ms for a state change, 240ms for
  something that enters. Nothing is longer.
- **The easing is one curve.** `cubic-bezier(0.2, 0.7, 0.3, 1)`.
- **No scroll-jacking, no parallax.**
- `prefers-reduced-motion` stops the marquee, the float animations, the
  heatmap cell fade-in and every transition.

---

## 6. Components

Every component is token-driven and has states: default, hover, focus-visible,
active, disabled, loading, error.

| Component | Notes |
| --- | --- |
| Button | 11px mono, uppercase, 0.12em tracking, square. Primary inverts the surface. `--accent`, `--invert` and `--invert-outline` variants. |
| Input, select, textarea | 1px `--control-border`, 4px radius-free padding, a visible label, a hint and an error line. |
| Field | label, control, hint, error, all wired with `for` and `aria-describedby`. |
| Tabs | used by the docs page for the settings panels. |
| Accordion | one open at a time, `aria-expanded` on the trigger. |
| Tooltip | on heatmap cells, shown on hover and on focus. |
| Toast | flat, square, top-right, `role="status"`, auto-dismiss. |
| Modal and drawer | `role="dialog"`, `aria-modal`, focus trapped, Escape closes, focus returns to the trigger. |
| Code block | a language tag, a copy button, horizontal scroll, wrapped inside a dialog. |
| Badge and chip | 11px mono, square, with `--accent`, `--warning` and neutral variants. |
| Table | a mono uppercase header on `--paper-sunken`, hairline rows. |
| Breadcrumbs | a mono list with a hairline separator. |
| Match card | a score ring, the title, the reasons, the effort estimate, the labels, the repository health badges. |
| Agent steps panel | a live list of steps with a spinner, a running state and a done state. |
| Skeleton | no layout shift: the skeleton has the same box as the content. |
| Shortlist item | a card with remove and copy actions. |
| Theme toggle | three states: light, dark, system. |
| Language switch | three states, mono, 11px. |
| Empty and error states | with the mascot in the right mood. |
| Score ring | banded: under 40 is `--danger`, 40 to 69 is `--warning`, 70 and up is `--accent`. Each clears 3:1. |

### The mascot

One base drawing with seven moods, set through `data-mood`: `idle`,
`thinking`, `found`, `celebrate`, `oops`, `reading`, `waiting`. It is used for
the empty state, the error state, the rate-limit state, the loading state and
the hero.

---

## 7. Writing copy

- Every page and section heading has exactly one italic phrase.
- Card titles and state titles are plain.
- The banned words are **revolutionize**, **supercharge**, **seamless** and
  **unlock**. A test checks the dictionaries and the page copy.
- No invented statistics, no testimonials, no fake logos, no decorative
  emoji, no lorem ipsum.
- The three dictionaries are mirrored. A test checks that.

---

## 8. Checking a change

```bash
npm run contrast   # every token pair, both themes
npm run a11y       # axe-core plus the custom checks, 11 pages, both themes
npm test           # includes the token, gradient and radius rules
```

If you add a colour, add it to `css/tokens.css` **and** to the pair list in
`tools/contrast.mjs`. A colour that is not measured is a colour nobody has
checked.
