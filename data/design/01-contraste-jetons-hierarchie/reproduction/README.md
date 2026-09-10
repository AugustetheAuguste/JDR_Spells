# Reproduction

Two instruments. Neither is a design proposal; both exist to make the audit's claims
checkable rather than asserted.

## `sonde-tailwind.html` — the token-collision probe

Loads Tailwind 4 in the browser, feeds it the `@theme` block copied **verbatim** from
`web/styles/theme.css`, and renders the exact class strings taken from
`components/primitives/TableDense.tsx`, `components/fiche/BlocTechnique.tsx` and
`components/fiche/Description.tsx`. Open it and read the computed styles.

What it returns:

| class | `font-size` | `color` |
|---|---|---|
| `text-base` | `14.5px` | **`rgb(250, 250, 249)`** |
| `text-petit` | `12.5px` | inherited |
| `text-micro` | `11px` | inherited |
| `text-grand` | `17px` | inherited |
| `text-titre1` | `34px` | inherited |
| `bg-base` | — | `background: rgb(250, 250, 249)` |

`text-base` is the only member of the type scale that also sets a colour, because `base`
is the only name that exists in both the `--text-*` and `--color-*` namespaces. Everything
else in the scale behaves. This is finding **C1**, and it is why the fix belongs to the
token layer.

The probe also confirms the tokens that are *not* broken, so the audit is not overstated:
`h-ligne` = 32px, `rounded-jeton` = 4px, `rounded-panneau` = 6px, `border-bord` =
`rgb(228,226,222)`, `border-desaccord/25` resolves, `accent-[var(--color-accent)]` =
`rgb(17,107,79)`.

## `../../../../recreation-sorts-pf1.dc.html` — the four routes, rebuilt

A faithful recreation of `/`, `/sorts/[slug]/`, `/comparaison` and `/favoris`, built from
the source files and run against the **real** `web/public/data/index.json` (2070 spells,
19 classes, 35 tags) and a real spell props file. Every colour, size, radius, padding and
row height is the literal value the Tailwind class compiles to — including
`color: #FAFAF9` where `text-base` puts it.

It lives at the project root rather than in this folder because it loads the fonts and the
index by relative path.

Controls in the black bar at the top are scaffolding, not part of the product:

- **route** — the four screens.
- **largeur** — 360 / 768 / 1440, which walks the two breakpoints in the code
  (`sm` 640, `lg` 1024) without a device.
- **`jeton text-base tel que livré (#FAFAF9)`** — on by default, and this is the defect.
  Untick it and the same 22 elements inherit `--color-encre` instead. Nothing else about
  the recreation changes: it is a one-value demonstration that C1 is a token-layer bug and
  not 22 component bugs.

Known differences from production, all non-visual:

- Search is a substring match on the folded name; production uses MiniSearch. This changes
  result *order* under a query, never any styling.
- Favourites are not wired to `localStorage`, so `/favoris` shows the empty state a fresh
  browser gets — which is the state the audit needed.
- Routing is local state, not the URL. The URL-as-state contract is a correctness property
  of the real app and is out of scope for a visual reproduction (finding **N1** was read
  from `app/sorts/[slug]/page.tsx`, not from the recreation).
