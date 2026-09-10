# 00 — Context

## The report, verbatim

Two things were reported together:

1. « white text on white background »
2. « organize it better »

Answers given before the audit began (verbatim, French):

| Question | Answer |
|---|---|
| Where did you see the white-on-white? | Liste des sorts — la page d'accueil · Fiche d'un sort — /sorts/… · Comparer des classes — /comparaison |
| Under what conditions? | Éclairage normal, réglages par défaut |
| Which themes must the site serve? | « Clair seulement — mais la couche de jetons doit rendre un thème sombre possible sans réécriture » |
| Which route do you look at most? | Liste des sorts |
| What is untouchable? | « Le lien vers pathfinder-fr.org sur chaque fiche » ; otherwise « Rien — tout est discutable » |
| What could you not find fast enough? | « Je trouve que les Tags devraient être mieux organiser il y en a trop pour pas qu'ils soient en famille comme : cible, effet etc... » |
| Deliverable form | Markdown only, in `docs/design/` |
| Document language | French for the UI, English for technical documents |

Read as scope: the reported defect is the entry point, not the assignment. Only the
attribution link is fenced off. The tag panel is a named hierarchy complaint with a
named shape — families, not a flat list.

## Source under audit

| | |
|---|---|
| Repository | `AugustetheAuguste/JDR_Spells`, branch `main` |
| Subtree | `web/` — Next.js 16, `output: 'export'`, Tailwind 4, React 19 |
| Token source | `web/lib/design/tokens.ts` (authoritative) mirrored into `web/styles/theme.css` (`@theme`) |
| Data | `web/public/data/index.json` — 2070 spells, 19 classes, 9 schools, 35 tags, 0 recorded level disagreements |

## Routes in scope

| Route | Component tree read |
|---|---|
| `/` | `app/page.tsx` → `VueNavigation` → `PanneauFiltres`, `ChampRecherche`, `TableSorts` → `TableDense`, `Badge`, `PastilleEcole`, `BoutonFavori`, `EtatVide` |
| `/sorts/[slug]/` | `app/sorts/[slug]/page.tsx` → `MarqueurDesaccord`, `NiveauxParClasse`, `BlocTechnique`, `Description`, `CoucheEnrichissement`, `LienSource`, `Badge`, `PastilleEcole`, `BoutonFavori` |
| `/comparaison` | `app/comparaison/page.tsx` → `VueComparaison` → `SelecteurClasses`, `TableComparaison`, `EtatVide` |
| `/favoris` | `app/favoris/page.tsx` → `VueFavoris` → `EtatVide`, `Badge`, `PastilleEcole` |
| shell | `app/layout.tsx`, `styles/theme.css` |
| `/_design` | `app/%5Fdesign/page.tsx` → `DemoPrimitives` — the primitive workbench, `robots: noindex` |

## Themes covered

One. `theme.css` hardcodes `color-scheme: light` and
`lib/design/tokens.test.ts:308-310` asserts the compiled CSS contains no
`prefers-color-scheme` rule — dark mode is refused by test, not merely absent. That is
finding **C5**: the requested outcome (« light only, but the token layer must make a dark
theme possible without a rewrite ») is not reachable from the current layer, because the
palette has no theme indirection at all.

## Widths and zoom covered

360 / 768 / 1440 px, and 200% zoom. The recreation in `reproduction/` switches width so
the two breakpoints in the code (`sm` 640, `lg` 1024) can be walked without a device.

## Method, and its limits

- Every colour pair was computed from the hex values in `tokens.ts` with the WCAG
  relative-luminance formula, not eyeballed. Ratios are in `01_AUDIT.md`.
- The `text-base` collision was reproduced by compiling the repo's own `@theme` block
  with Tailwind 4 in a browser and reading `getComputedStyle`, so the claim rests on the
  real compiler rather than on a reading of the source.
- The four routes were rebuilt from the source files and run against the real
  `index.json`, so density, wrapping and the 200-row page are the product's own, not a
  mock-up.
- **Not covered:** the deployed build's own CSS bundle (no URL was supplied), the search
  engine's ranking (`MiniSearch` is stood in for by a substring match in the recreation —
  it changes result *order*, never any styling), screen-reader announcement order, and
  `favoris` states that require existing `localStorage` data.
