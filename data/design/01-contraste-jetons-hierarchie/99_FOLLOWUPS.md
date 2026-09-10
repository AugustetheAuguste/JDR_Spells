# 99 — Follow-ups

Open findings from `01_AUDIT.md`. Nothing here was dropped from the table; each entry says
why it is still open.

---

## Next commit

### C2 — no border in the system meets the 3:1 non-text floor · **blocker**

| pair | ratio | |
|---|---:|---|
| `--color-bord` / `surface` | 1.29 | FAIL |
| `--color-bord` / `base` | 1.24 | FAIL |
| `--color-bord` / `survol` | 1.15 | FAIL |
| `--color-bord` / `accent-voile` | 1.12 | FAIL |
| `--color-bord-fort` / `surface` | 1.70 | FAIL |
| `--color-bord-fort` / `base` | 1.63 | FAIL |
| `--color-bord-fort` / `survol` | 1.51 | FAIL |

Every row rule, panel edge, input outline, chip border and table wrapper in the product.
Two token values; swept everywhere by definition.

**Why still open:** the request was the white text and the tags. Moving the border palette
in the same pass would have changed every edge in the product under cover of a contrast
fix — the « while I was in there » case (ADR-005). It is the next commit, not a deferral.

### C3 — `--color-encre-faible` below AA on three tinted surfaces · **major**

`#736F67` is AA on the two plain surfaces (4.79 on `base`, 5.00 on `surface`) and **below
it everywhere else**: 4.43 on `survol`, **4.34** on `accent-voile`, 4.43 on
`desaccord-voile`. Every em-dash cell, placeholder and help string drops below AA when a
row is hovered or selected. The token has to move; the floor must be checked against all
five surfaces it is used on, not the two it was tested against.

---

## Token layer

| id | sev | what is open |
|---|---|---|
| **C4** | major | `--color-surface` (`#FFFFFF`) is still used as an ink token (`text-surface`) in 8 places. Latent while there is one theme; guaranteed white-on-white the day there are two. Rule 3 of `03_DESIGN_SYSTEM.md` states the intent; the rename to `--color-accent-ink` has not been done. |
| **C5** | major | there is no theme layer. `color-scheme: light` is hardcoded and `tokens.test.ts:308-310` asserts the compiled CSS contains no `prefers-color-scheme` rule. The stated goal — « light only, but the token layer must make a dark theme possible without a rewrite » — needs the palette re-expressed as roles first (B.1), and C4 is a prerequisite. |
| **C6** | minor | `Badge ton="neutre"` is `bg-base` inside `CoucheEnrichissement`'s `bg-base` panel: 1.00:1 fill, 1.24:1 border. Invisible except for its text. Needs `Badge` to stop assuming it sits on `surface`. |
| **C7** | minor | no print styles. Browsers drop background fills when printing, so the school pastilles and every accent button print as white ink on white paper. A table reference tool gets printed. |
| **T1** | blocker→open | two files still hold the palette (`tokens.ts`, `theme.css`). The duplication is forced by Tailwind 4 and the value-drift test stays; ADR-003 closed the *name* half of the gap. Recorded as open because the structural duplication remains. |
| **T2** | major | `--color-*` and `--text-*` still share the `text-` utility prefix. The ADR-003 test makes a collision fail CI, which is the guard; a naming convention that keeps the two namespaces lexically distinct would remove the possibility rather than catch it. |
| **T3** | minor | the nine school hexes reach the DOM as inline `style={{backgroundColor}}`. Deliberate and sanctioned (rule 1), and the reason they survived C1 — but nine of 22 palette values sit outside every utility-level guarantee. |
| **T4** | minor | dead tokens: `--spacing-gouttiere`, `--spacing-ligne-dense` declared and unused. `DENSITE.padCellule`, `.filet`, `.largeurMaxTexte`, `.lignesVisiblesCible` never reach CSS — `px-2.5 py-1.5`, `border`, `max-w-[68ch]` are literals at 14 call sites. |

---

## Hierarchy, layout, navigation

| id | sev | what is open |
|---|---|---|
| **H1** | major | on `/` the visual weight is on the filter panel, not the results table. Grouping the tags (H2) reduced the panel's uniformity but did not re-weight it against the table. |
| **H3** | minor | `h1` is 34px Fraunces on routes whose title never changes; the result count — the one number that moves — is 12.5px. Partially addressed: the `Tags` legend now carries its own count. |
| **H4 / P1** | minor | `Comp.` is still the only abbreviated column header, in a product whose rule is that domain vocabulary is not abbreviated. Fixing it means finding 7rem of column width. |
| **L1 / R1** | major | below 1024px the filter panel still stacks above the results: a phone user scrolls past ~60 controls to reach the first spell. Needs the intermediate breakpoint and the sticky filter summary bar (B.3). |
| **L2** | minor | rows are 32px but content is 22px line-height + 12px padding = 34px. The row height is a floor the content already exceeds. |
| **L3** | minor | 1180px / 68ch / 52ch coexist as literals; `DENSITE.largeurMaxTexte` exists and is unread (= T4). |
| **N1** | major | a spell sheet's only way back is `Tous les sorts` → `/`, which drops the query string. The filter the user built to find the spell is lost on return — the most expensive open finding for someone mid-game. |
| **N2** | minor | the result count and `Afficher 200 sorts de plus` are still styled as captions. |
| **N3** | minor | `Favoris` in the header carries no count. |
| **P2** | minor | the level filter's legend is still `Niveau le plus bas, toutes classes` — a description of a computation used as a control label. |

---

## Component states and responsive

| id | sev | what is open |
|---|---|---|
| **S1** | major | the focus ring is `--color-accent` on every surface, including `bg-accent` buttons where it is the same colour as the fill. It is readable today only because `outline-offset: 2px` puts it outside the button. Needs an on-accent ring token. |
| **S2** | major | no loading state beyond one line of text; the filter panel does not exist until the 553 kB `index.json` lands, so the whole left column pops in. |
| **S3** | minor | `disabled` is `opacity-60` in one component and `text-encre-faible` in another. Neither is a token. |
| **S4** | minor | hover is 1.13:1 against `surface` — a real state carried by a change most people cannot see. Same commit as C2. |
| **R2** | minor | three columns drop below 640px as designed, and nothing tells the reader they are missing. |
| **R3** | major | the compact favourite toggle is ≈ 22 × 16px — the primary save action on a phone, at a third of the 44px floor. |
| **R4** | minor | at 200% zoom the 1180px shell and the fixed `11rem`/`9rem`/`8rem` column widths force horizontal scroll inside the table wrapper before the layout reflows. |

---

## Open questions — for the user, not for the next commit

### D1 — the disagreement feature renders for 0 of 2070 spells · **decision needed**

`desaccords` is empty for every spell in the committed corpus. The
`Seulement les désaccords` filter can only return the empty state; the list badge and the
sheet panel never render; `--color-desaccord` and `--color-desaccord-voile` are 2 of 22
palette values reserved for it.

This is **not** a bug. The component is a probe so the first real divergence is visible,
and the corpus records divergences rather than correcting them (`CLAUDE.md` §9). The
finding is that it currently costs a filter slot, a badge tone and two palette values for
zero rows.

Three defensible answers, unchanged from `02_OPTIONS.md`; my recommendation is **3**:

1. keep it exactly as is;
2. keep the sheet panel and the list badge, drop the filter chip;
3. keep everything and **say the number** — `Signalements — 0 sur 2070` next to the chip,
   which turns the zero into information instead of something that looks broken.

### Tag families — two slots the closed vocabulary does not fill

The family map has no `cible unique` and no `peur ou terreur`, because
`conventions/vocabulaires/tags.json` does not contain them — both are candidate groups in
`taxo_groupes.json` that failed `seuil_couverture: 10`. If they matter at the table, the
fix is upstream (lower the threshold, regenerate) and is a paid pipeline run, not a UI
change.

### Not audited

The deployed build's own CSS bundle (no URL supplied), MiniSearch ranking, screen-reader
announcement order, and `/favoris` states that need existing `localStorage` data.
