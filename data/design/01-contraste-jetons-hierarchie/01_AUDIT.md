# 01 — Audit

28 findings. Severity is what it costs the person holding a phone at a table mid-game.

- **blocker** — makes stated content unreadable, or fails the accessibility floor on every
  screen of a route.
- **major** — a real defect a user meets on a normal path.
- **minor** — a defect that is real but survivable, or a token-layer risk not yet visible.

Every proposed fix names a **layer**: `tokens` · `primitive` · `shell` · `route` · `test`.
Nothing below proposes a literal value on a single element.

---

## 1. Reproduction of the reported defect

### 1.1 What happens

`class="text-base"` compiles to a colour *and* a font size:

```
font-size: 14.5px ; line-height: 22px ; color: rgb(250, 250, 249)
```

Verified by compiling the repo's own `@theme` block with Tailwind 4 in a browser and
reading `getComputedStyle` on the exact class strings from
`components/primitives/TableDense.tsx`, `components/fiche/BlocTechnique.tsx` and
`components/fiche/Description.tsx`.

| Element | Route | Computed colour | Computed background | Ratio |
|---|---|---|---:|---:|
| `<td>` Portée / Sauvegarde in `TableDense` | `/` | `#FAFAF9` | `#FFFFFF` | **1.04:1** |
| `<dd>` — all seven stat-block values | `/sorts/[slug]/` | `#FAFAF9` | `#FFFFFF` | **1.04:1** |
| `Description` paragraphs | `/sorts/[slug]/` | `#FAFAF9` | `#FFFFFF` | **1.04:1** |
| `<th scope="row">` class name in `NiveauxParClasse` | `/sorts/[slug]/` | `#FAFAF9` | `#FFFFFF` | **1.04:1** |
| level + `Écart` cells in `TableComparaison` | `/comparaison` | `#FAFAF9` | `#FFFFFF` | **1.04:1** |
| class names in `SelecteurClasses` | `/comparaison` | `#FAFAF9` | `#FFFFFF` | **1.04:1** |
| `<td>` in the favourites table | `/favoris` | `#FAFAF9` | `#FFFFFF` | **1.04:1** |

The three routes named in the report are exactly the three routes where the affected
element carries the page's *primary content*. Nothing about the defect is specific to
them.

### 1.2 Mechanism

Tailwind 4 resolves the `text-*` utility against two theme namespaces: `--color-*` for
`color`, `--text-*` for `font-size`. When one name exists in both, the utility carries
both meanings. `styles/theme.css` defines:

```css
--color-base: #fafaf9;   /* intended as a page background */
--text-base: 14.5px;     /* intended as the body size */
```

so `text-base` means *both* « body size » and « paint it the page-background colour ».
It is not a specificity accident and no cascade order changes it: both declarations are
in the same rule. (Upstream: tailwindlabs/tailwindcss#16797 — defining `--color-x` and
`--text-x` together produces a colliding utility.)

Two facts make this survive review:

- `body { font-size: var(--text-base) }` in `@layer base` sets the body size directly, so
  the *size* half of the collision is invisible — nothing looks the wrong size.
- `lib/design/tokens.test.ts` parses `theme.css` and asserts every **value** matches
  `tokens.ts`. Both values are correct. The test cannot see that two correct values share
  one utility name.

### 1.3 Class size

`text-base` appears **38 times** across 11 components and 2 routes.
**22 of those set no colour of their own** and therefore paint `#FAFAF9`:

| File:line | Element |
|---|---|
| `primitives/TableDense.tsx:47` | `<table>` — every cell that sets no colour |
| `fiche/BlocTechnique.tsx:50` | `<dd>` — all seven stat-block values |
| `fiche/Description.tsx:45` | `<div>` — the whole description |
| `fiche/NiveauxParClasse.tsx:49` | `<table>` — the class-name column |
| `fiche/CoucheEnrichissement.tsx:63, :95` | `<dd>`, the short summary |
| `primitives/MarqueurDesaccord.tsx:53` | `<ul>` — the disagreement detail |
| `comparaison/TableComparaison.tsx:35` | `<table>` — level and spread columns |
| `comparaison/SelecteurClasses.tsx:56` | `<label>` — all 19 class names |
| `favoris/VueFavoris.tsx:133, :146, :153, :176, :179, :251, :255, :282, :315, :407, :416` | incident notices, list picker, rename field, both confirmation dialogs, the table |
| `app/sorts/[slug]/page.tsx:157` | `<ul>` — the source books |
| `app/layout.tsx:42` | `<nav>` — harmless in practice, the links set `text-encre` |

The other 16 occurrences pair `text-base` with an explicit `text-encre` /
`text-encre-douce` / `text-surface` / `text-desaccord`, which overrides the colour half.
That is why the product looks *mostly* fine: the defect is masked wherever someone
happened to also name a colour.

**The fix is a rename in the token layer, and a test that makes the collision
impossible.** Any fix applied to the 22 sites instead of to the two token names is the
auto-fail case.

---

## 2. Findings

### Contrast & theming

| id | route / component | what's wrong | sev | root cause | fix layer |
|---|---|---|---|---|---|
| **C1** | all 4 routes, 22 sites | body text at **1.04:1** — `text-base` also sets `color: #FAFAF9` | blocker | `--color-base` and `--text-base` collide on one utility name | `tokens` + `test` |
| **C2** | every panel, table rule, input, chip | **no border in the system meets 3:1.** `--color-bord` 1.29:1 on `surface`, 1.24:1 on `base`; `--color-bord-fort` 1.70:1 / 1.63:1 | blocker | both border tokens were picked for quietness against white; the 3:1 non-text floor was never applied to them | `tokens` |
| **C3** | every `—` cell, every placeholder, row hover, selected row | `--color-encre-faible` is AA only on the two plain surfaces: 4.43:1 on `survol`, **4.34:1** on `accent-voile`, 4.43:1 on `desaccord-voile` | major | the floor was verified against `base`/`surface` only; the token is then used on three tinted surfaces | `tokens` |
| **C4** | 8 sites | `--color-surface` (`#FFFFFF`) is used as an **ink** token (`text-surface`) on accent fills and school pastilles | major | a background-role name used as a foreground role; latent today, guaranteed white-on-white the day a second theme exists | `tokens` |
| **C5** | whole product | there is no theme layer. `color-scheme: light` is hardcoded and `tokens.test.ts:308-310` asserts no `prefers-color-scheme` exists | major | the palette is 13 flat values with no light/dark indirection, so « make dark possible » is a rewrite, not a value set | `tokens` |
| **C6** | `CoucheEnrichissement` | `Badge ton="neutre"` is `bg-base` **inside** a `bg-base` panel: 1.00:1 fill, 1.24:1 border. The badge is invisible except for its text | minor | `Badge` assumes it sits on `surface`; nothing enforces that | `primitive` |
| **C7** | `PastilleEcole`, every accent button | no print styles anywhere. Browsers drop background fills when printing, leaving `text-surface` white on white paper | minor | print was never a target; a table reference tool gets printed | `tokens` + `shell` |

**Measured ratios — text on surfaces** (body floor 4.5, large-text floor 3.0):

| ink ↓ / surface → | `base` #FAFAF9 | `surface` #FFFFFF | `survol` #F2F1EF | `accent-voile` #E8F1ED | `desaccord-voile` #FBEFE6 |
|---|---:|---:|---:|---:|---:|
| `encre` #1C1B19 | 16.48 | 17.21 | 15.25 | 14.95 | 15.24 |
| `encre-douce` #57544E | 7.22 | 7.54 | 6.68 | 6.55 | 6.68 |
| `encre-faible` #736F67 | 4.79 | 5.00 | **4.43** | **4.34** | **4.43** |
| `accent` #116B4F | 6.21 | 6.48 | 5.74 | 5.63 | 5.74 |
| `desaccord` #8A3A12 | 7.46 | 7.79 | 6.90 | 6.77 | 6.90 |
| `surface` #FFFFFF | **1.04** | **1.00** | **1.13** | **1.15** | **1.13** |

**Measured ratios — borders and UI boundaries** (floor 3.0):

| pair | ratio | |
|---|---:|---|
| `bord` / `surface` | 1.29 | FAIL |
| `bord` / `base` | 1.24 | FAIL |
| `bord` / `survol` | 1.15 | FAIL |
| `bord` / `accent-voile` | 1.12 | FAIL |
| `bord-fort` / `surface` | 1.70 | FAIL |
| `bord-fort` / `base` | 1.63 | FAIL |
| `bord-fort` / `survol` | 1.51 | FAIL |
| `accent` / `surface` | 6.48 | ok |
| `desaccord` / `surface` | 7.79 | ok |
| `survol` / `surface` (hover state) | 1.13 | FAIL |
| `accent-voile` / `surface` (selected row) | 1.15 | FAIL |

**The nine school pastilles pass, and are the only thing that does.** White on
`transmutation` #8A6412 is 5.37:1, the floor of the nine; the fill contrast against
`surface` runs 5.37–11.57:1. They pass *because* `PastilleEcole` writes the hex as an
inline `style={{backgroundColor}}` from `tokens.ts` instead of going through a Tailwind
utility — the one component that bypassed the token→utility path is the one the
collision could not reach (see **T3**).

### Design tokens

| id | what's wrong | sev | root cause | fix layer |
|---|---|---|---|---|
| **T1** | two sources of truth by construction — `tokens.ts` and `theme.css` — reconciled by a test that compares **values** | blocker | Tailwind 4 is CSS-first, so the duplication is forced; but the guard only checks the half that was never at risk | `test` |
| **T2** | `--color-*` and `--text-*` share the `text-` utility prefix. `base` is the only collision today; any future size named after a colour repeats C1 exactly | major | no naming rule separates the two namespaces | `tokens` + `test` |
| **T3** | the nine school hexes are applied as inline `style={{backgroundColor}}` in `PastilleEcole` — a hex reaching the DOM outside the utility layer | minor | deliberate, and it is why they survived C1; but it means nine of the palette's 22 values are exempt from every utility-level guarantee | `primitive` |
| **T4** | dead tokens: `--spacing-gouttiere` (12px) and `--spacing-ligne-dense` (28px) are never used. `DENSITE.padCellule`, `.filet`, `.largeurMaxTexte`, `.lignesVisiblesCible` never reach CSS — the call sites write `px-2.5 py-1.5`, `border`, `max-w-[68ch]` as literals | minor | the TS token file documents intent the CSS layer does not implement | `tokens` |

### Hierarchy

| id | route | what's wrong | sev | root cause | fix layer |
|---|---|---|---|---|---|
| **H1** | `/` | the most important element is the results table; the visual weight is on the filter panel. The class `<select>` is the only `bord-fort` bordered panel on the page and sits above ~60 filter chips | major | the panel is ordered and weighted by *data dependency* (level needs a class — correct) but nothing re-weights it against the results | `route` |
| **H2** | `/` | **the reported hierarchy defect.** 35 tags render as one flat wrap of 35 identical chips, alphabetical, no grouping | major | `index.tags` is a flat closed list, and `PanneauFiltres` maps it 1:1. The corpus's own taxonomy already names the families — `conventions/taxo_groupes.json` groups by `degats_*`, `duree_*`, `effet_mental`, `plusieurs_cibles`, `zone_d_effet`… — and the UI discards that structure | `route` |
| **H3** | all | `h1` is 34px Fraunces on every route, including routes whose title never changes. The result count — the one number that moves — is 12.5px `encre-douce`, smaller than the help text above it | minor | the type scale is applied by nesting depth, not by importance | `route` |
| **H4** | `/` | `Comp.` is the only abbreviated column header, in a product whose stated rule is that domain vocabulary is never abbreviated for visual balance | minor | column width pressure at 7rem | `route` + copy |

### Layout & rhythm

| id | what's wrong | sev | root cause | fix layer |
|---|---|---|---|---|
| **L1** | below 1024px the filter panel stacks **above** the results: a phone user scrolls past ~60 controls to reach the first spell | major | `lg:grid-cols-[17rem_1fr]` with no intermediate step and no reordering | `shell` |
| **L2** | rows are `--spacing-ligne` 32px, but content is 22px line-height + 12px padding = 34px, so the row height is a floor the content already exceeds | minor | the density budget was set on the token and never checked against the cell padding | `tokens` + `primitive` |
| **L3** | three container widths coexist unrelated: `max-w-[1180px]` shell, `max-w-[68ch]` prose, `max-w-[52ch]` empty state — all three written as literals at 14 call sites | minor | `DENSITE.largeurMaxTexte` exists and is unused (T4) | `tokens` |

### Navigation & wayfinding

| id | what's wrong | sev | root cause | fix layer |
|---|---|---|---|---|
| **N1** | a spell sheet's only way back is `Tous les sorts` → `/`, which **drops the query string**. The filter the user built to find the spell is lost on return | major | the crumb is a literal route, while all list state lives in the URL | `route` |
| **N2** | the result count exists but is 12.5px `encre-douce` (H3), and `Afficher 200 sorts de plus` sits centred below a 200-row table | minor | count and paging are treated as captions | `route` |
| **N3** | `Favoris` in the header never carries a count, so nothing signals that the list is non-empty | minor | the header is static and the store is client-only | `shell` |

### Component states

| id | what's wrong | sev | root cause | fix layer |
|---|---|---|---|---|
| **S1** | the focus ring is `outline: 2px solid var(--color-accent)`. On an `bg-accent` button it is the same colour as the fill — readable only because `outline-offset: 2px` puts it outside. One offset change and every primary button loses its ring | major | one ring colour for all surfaces | `tokens` |
| **S2** | no loading state beyond one line of text; the filter panel does not exist until `index.json` (553 kB) lands, so the whole left column pops in | major | the view returns a text-only branch while `index === null` | `route` |
| **S3** | `disabled` is expressed two different ways — `opacity-60` on `BoutonFavori`, `text-encre-faible` on `SelecteurClasses` — and neither is a token | minor | no disabled token; each component invents one | `tokens` + `primitive` |
| **S4** | hover is `bg-survol`, **1.13:1** against `surface`. A real state carried by a change most people cannot see | minor | the hover token was chosen for quietness | `tokens` |

### Responsive

| id | what's wrong | sev | root cause | fix layer |
|---|---|---|---|---|
| **R1** | = L1. At 360px the results are below ~60 controls | major | one breakpoint | `shell` |
| **R2** | `Comp. / Portée / Sauvegarde` drop below 640px as designed, but nothing tells the reader three columns are missing | minor | `hidden sm:table-cell` is silent by nature | `primitive` |
| **R3** | the compact favourite toggle is `px-1.5 py-0.5 text-micro leading-none` ≈ **22 × 16px** — the primary save action on a phone, at a third of the 44px floor | major | it was sized to fit inside a 32px row | `primitive` |
| **R4** | at 200% zoom the 1180px shell and the `11rem` / `9rem` / `8rem` fixed column widths force horizontal scroll inside the table wrapper before the layout reflows | minor | column widths are absolute, not proportional | `primitive` |

### Copy

| id | what's wrong | sev | fix layer |
|---|---|---|---|
| **P1** | `Comp.` — the only abbreviation (= H4) | minor | copy |
| **P2** | the level filter's legend is `Niveau le plus bas, toutes classes` — a description of a computation used as a control label. Correct, and unreadable as a label | minor | copy + `route` |
| **P3** | *not a finding — leave alone.* `EtatVide` names what was searched, why it is empty, and which filter is the most restrictive, with a button that removes exactly that one. It is the best-designed thing in the product | — | — |

### Data semantics

| id | what's wrong | sev | root cause | fix layer |
|---|---|---|---|---|
| **D1** | `desaccords` is **0 for all 2070 spells**. The `Seulement les désaccords` filter can only ever return the empty state; the list badge and the sheet panel never render; `--color-desaccord` and `--color-desaccord-voile` are two of 13 palette values spent on it | major | the feature is a *probe* for a divergence the corpus does not currently contain — by design (`CLAUDE.md` §9), and correct. But it occupies a filter slot, a badge tone and 2 palette values on every screen | decision needed — see `02_OPTIONS.md` |

**D1 is not a bug and must not be « cleaned up ».** A divergence between a class list and
a spell page is a recorded fact of the corpus, and the component exists so the first real
one is visible. The finding is that it currently costs screen space and palette in
exchange for zero rows, and that trade should be made deliberately rather than by
default.

---

## 3. What is deliberately not a finding

- **Density.** 32px rows, 200 per page, six columns, ~60 filter controls. This is correct
  and the brief protects it. Nothing below proposes hiding a level, a class, a range, a
  duration or a tag behind a click.
- **French domain vocabulary.** `Prêtre/Prêtre combattant/Oracle`, `Nécromancie`,
  `jet de sauvegarde`, the 21 corpus keys, the 35 tag ids. Untouched, unabbreviated,
  untranslated. H4/P1 ask for *less* abbreviation, not more.
- **The attribution link.** `LienSource` is a full-width block with a button-weight link
  on every spell sheet. Fenced off by the user and correct as built.
- **Paging over virtualisation.** `TableDense` renders 200 real rows so Ctrl+F works. That
  is the right call for a reference tool and the reason R4 is minor rather than major.
- **`niveauAffiche` everywhere.** No bare « Niveau 3 » is printed anywhere in the product;
  every level carries its class or says it is a cross-class floor. This is the product's
  best modelling decision and every option below preserves it.
- **`EtatVide`** (P3).
