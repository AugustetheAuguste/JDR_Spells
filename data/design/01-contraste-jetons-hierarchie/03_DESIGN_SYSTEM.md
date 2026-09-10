# 03 — Design system

**This document is normative.** Where it and the code disagree, this document states the
intent and the code is corrected. Where it and
`.claude/skills/pf-web-design-system` disagree, the Skill wins and this document is
corrected.

---

## 1. Rules

These exist so the bug class documented in `01_AUDIT.md` cannot come back.

1. **No literal colour in a component.** A hex may be written in `web/lib/design/tokens.ts`
   and nowhere else. `tokens.test.ts` greps for it.
   *One sanctioned exception:* `PastilleEcole` applies a school colour as an inline
   `style={{backgroundColor}}` read **from `tokens.ts`**, because nine dynamic fills cannot
   be nine static utilities. It reads the token; it does not restate the value.
2. **A token name may not exist in two `@theme` namespaces.** Tailwind 4 resolves `text-*`
   against both `--color-*` (colour) and `--text-*` (font size); a name in both compiles to
   both. This produced 1.04:1 body text on all four routes (finding C1).
   Enforced by `tokens.test.ts` — it intersects the declared `--color-*` and `--text-*`
   name sets and fails on any overlap. **Do not remove that test.**
3. **An ink token is named as ink.** `--color-surface` is a background. Using it as a
   foreground (`text-surface`) is what makes a theme change produce white-on-white by
   construction. Foregrounds are `--color-encre*`, and on a coloured fill,
   `--color-accent-ink`.
4. **The focus ring is `--color-accent` via `:focus-visible` in `@layer base`,** with
   `outline-offset: 2px`. No rule in this repository may set `outline: none` without
   providing a replacement in the same declaration.
5. **No gradients.** Anywhere, for any reason. The palette is flat aplats.
6. **Contrast floors are properties of the tokens, not of occurrences.** A token used as
   body text clears 4.5:1 against **every** surface it is used on; a token used as a border
   or a UI boundary clears 3:1 against every surface it is drawn on. A failure is repaired
   in the token, then swept.
7. **Two files, one source.** `tokens.ts` is the source. `styles/theme.css` mirrors it into
   `@theme` because Tailwind 4 is CSS-first and reads no JS config. The duplication is
   forced by the framework; `tokens.test.ts` asserts the two never drift.

---

## 2. Palette

Flat values, four groups. Names as declared in `styles/theme.css`.

### 2.1 Surfaces and ink

| token | hex | role |
|---|---|---|
| `--color-base` | `#FAFAF9` | the page field |
| `--color-surface` | `#FFFFFF` | panels, tables, cards |
| `--color-survol` | `#F2F1EF` | row and control hover |
| `--color-encre` | `#1C1B19` | **body text** |
| `--color-encre-douce` | `#57544E` | labels, captions, column headers |
| `--color-encre-faible` | `#736F67` | em dashes, placeholders, help text |
| `--color-bord` | `#E4E2DE` | rules between rows, panel edges |
| `--color-bord-fort` | `#C9C6C0` | input and control outlines |

### 2.2 Accent — one, and it means one thing

| token | hex | role |
|---|---|---|
| `--color-accent` | `#116B4F` | active, chosen by the user, focus ring, links |
| `--color-accent-survol` | `#0D5741` | accent hover |
| `--color-accent-voile` | `#E8F1ED` | selected row wash, checked chip fill |

Hue 161°, at least 25° clear of the nearest school hue. Placed closer, it would read as a
school rather than as « active ». Spending it on decoration is what would leave nothing to
signal state.

### 2.3 Level disagreement — and nothing else

| token | hex | role |
|---|---|---|
| `--color-desaccord` | `#8A3A12` | the level-disagreement marker |
| `--color-desaccord-voile` | `#FBEFE6` | its wash |

Not an error colour. A divergence between a class list and a spell page is a recorded fact
of the corpus, never corrected (`CLAUDE.md` §9). The marker informs; it does not accuse.

### 2.4 The nine schools

| token | hex | white-on-fill |
|---|---|---:|
| `--color-ecole-abjuration` | `#3A5A9B` | 6.74:1 |
| `--color-ecole-divination` | `#6B4FA8` | 6.35:1 |
| `--color-ecole-enchantement` | `#A8377F` | 5.97:1 |
| `--color-ecole-evocation` | `#B3421F` | 5.65:1 |
| `--color-ecole-illusion` | `#176E77` | 5.94:1 |
| `--color-ecole-invocation` | `#2F6B2A` | 6.45:1 |
| `--color-ecole-necromancie` | `#3D3646` | 11.57:1 |
| `--color-ecole-transmutation` | `#8A6412` | **5.37:1 — the floor** |
| `--color-ecole-universel` | `#5F5D55` | 6.60:1 |

Lightening any of these breaks the floor. Colour is never the sole carrier: the pastille
always shows the school name, because nine hues are not memorable and two of them read as
one dark violet to a colourblind reader.

---

## 3. Type

| token | family | used for |
|---|---|---|
| `--font-affichage` | `'Fraunces', 'Iowan Old Style', Georgia, serif` | page titles, section headings |
| `--font-corps` | `'Inter', 'Segoe UI', system-ui, sans-serif` | everything read as prose |
| `--font-donnees` | `'IBM Plex Mono', ui-monospace, monospace` | levels, components, spreads, ids |

Served from `public/fonts/`, latin subset, `font-display: swap`. No CDN: the site is a pure
function of the repository.

### 3.1 Scale — fixed, ratio 1.2, anchored at 16px

| token | size / line-height | weight |
|---|---|---|
| `--text-micro` | 11 / 16 | 500 |
| `--text-petit` | 12.5 / 18 | 400 |
| **`--text-corps`** | **14.5 / 22** | 400 |
| `--text-grand` | 17 / 24 | 400 |
| `--text-titre3` | 20 / 26 | 600 |
| `--text-titre2` | 25 / 30 | 600 |
| `--text-titre1` | 34 / 38 | 600 |

> **`--text-corps` was `--text-base` until 2026-08-26.** It was renamed because
> `--color-base` existed, and a name in both namespaces compiles to both meanings
> (finding C1, ADR-002). Body size is `text-corps`. There is no `--color-corps` and there
> must never be one. Rule 2 enforces it.

Body sits at 14.5px rather than 16px: the explicit price of the density the product
requires. Below 14px this scale does not go.

---

## 4. Density and geometry

| token | value | role |
|---|---|---|
| `--spacing-ligne` | 32px | results row height. 40 rows readable on a 1366×768 laptop |
| `--spacing-ligne-dense` | 28px | *declared, unused — see 99_FOLLOWUPS T4* |
| `--spacing-gouttiere` | 12px | *declared, unused — see 99_FOLLOWUPS T4* |
| `--radius-jeton` | 4px | chips, badges, inputs, buttons, pastilles |
| `--radius-panneau` | 6px | panels, table wrappers, cards |

Cell padding is `6px 10px`, rules are 1px, prose measure is 68ch, empty-state measure is
52ch, page measure is 1180px. **These five are still literals at their call sites** —
`DENSITE` in `tokens.ts` declares them and nothing reads it. Open as finding T4.

---

## 5. Vocabulary

Frozen. One word, one meaning, throughout — and French, verbatim from the corpus.

`sort` · `sorts` · `niveau` · `classe` · `école` · `jet de sauvegarde` ·
`résistance à la magie` · `désaccord de niveau` · `favoris` · `filtre posé` ·
`source : pathfinder-fr.org` · `Voir sur pathfinder-fr.org`

Two standing rules:

- **« Niveau » never appears alone.** A spell is level 2 *for the bard*. Every level on
  screen either names its class or says it is the cross-class floor
  (`Niveau le plus bas, toutes classes`). A bare « Niveau 2 » is a modelling defect.
- **The 35 tag ids, the 19 class names and the 9 school names are never renamed,
  translated or abbreviated** for visual balance. `Prêtre/Prêtre combattant/Oracle` is the
  label. Families group ids; they never replace them.
