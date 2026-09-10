# 02 — Options

Three scopes. The smallest is included on purpose. Each says what it does **not** do.

---

## A — Surgical

**Fix the two blockers at the token layer. Change nothing else.**

| Finding | Change |
|---|---|
| C1 | Rename `--text-base` → `--text-corps` (and `--text-base--line-height` → `--text-corps--line-height`) in `theme.css`, `ECHELLE.base` → `ECHELLE.corps` in `tokens.ts`, and sweep `text-base` → `text-corps` at all 38 call sites. `--color-base` keeps its name and its meaning: a background. |
| C1 | Add to `tokens.test.ts`: parse `theme.css`, intersect the `--color-*` and `--text-*` name sets, fail if it is non-empty. The bug class becomes unshippable, not merely fixed. |
| C2 | Darken the two border tokens to clear 3:1 on every surface they are used on: `--color-bord` `#E4E2DE` → a value ≥ 3:1 on `#FFFFFF`, `--color-bord-fort` likewise. Two values, swept everywhere by definition. |

Renaming the *size* rather than the *colour* is the cheaper half of the collision: 38 call
sites move, but `--color-base`/`bg-base` keeps a name that says what it is, and the ink
tokens stay untouched.

**Does not touch:** C3, C4, C5, C6, C7, T1–T4, all of hierarchy, layout, navigation,
states, responsive, copy. The tag panel stays a flat list of 35 — the reported hierarchy
complaint is **not addressed**. Hover stays at 1.13:1, the phone still shows 60 controls
before the first spell, the favourite toggle stays a 22 × 16px target, and a dark theme
stays a rewrite.

**Cost:** three token edits, one test, one mechanical sweep. Half a day. Zero visual
change anyone would notice, except that text becomes visible.

---

## B — Consolidate  ★ recommended

**A, plus: one real token layer, complete primitive states, and the tags in families.
Same identity — same green, same three faces, same density.**

### B.1 Tokens *(C1–C7, T1–T4, L2, L3, S1, S3, S4)*

- **Roles, not appearances.** The palette is re-expressed as roles — `fond`, `panneau`,
  `survol`, `ink-fort`, `ink-moyen`, `ink-faible`, `filet`, `filet-fort`, `accent`,
  `accent-ink`, `accent-voile`, `signal`, `signal-voile`, `focus`, `desactive` — each
  bound to one of the existing hex values wherever the existing value already passes.
  `text-surface` disappears: white-on-accent becomes `accent-ink`, which *names* a
  foreground. That is C4 closed structurally, and it is the change that makes a dark theme
  a second value set rather than a rewrite (C5).
- **The floors are applied to the tokens, not to occurrences.** `filet`/`filet-fort` ≥ 3:1
  on `panneau`, `fond` *and* `survol` (C2). `ink-faible` ≥ 4.5:1 on all five surfaces it is
  used on, which means it moves off `#736F67` (C3). `survol` becomes a state you can see
  (S4). `focus` becomes its own token with an on-accent variant, so the ring never depends
  on `outline-offset` to be visible (S1). `desactive` exists (S3).
- **Print is a theme**, not an afterthought: the school pastilles and accent buttons get a
  print value set so a printed spell sheet is not white-on-white (C7).
- Dead tokens removed or wired up; the three container widths become `mesure-texte`,
  `mesure-panneau`, `mesure-page` and stop being literals (T4, L3). Cell padding and row
  height reconciled (L2).
- **`03_DESIGN_SYSTEM.md` is written as the rule**, so the next contributor cannot
  reintroduce the class: no literal hex in a component, no `--color-x`/`--text-x` name
  pair, the focus ring is `--focus`, no gradients.

### B.2 Primitives *(C6, R2, R3, S2, S3)*

`Badge`, `PastilleEcole`, `TableDense`, `ChampRecherche`, `EtatVide`, `BoutonFavori`, the
filter chip, the focus ring — each with hover, focus, active, disabled, loading, empty and
zero-results, on every surface it is legitimately placed on. Two concrete outcomes:
`Badge` stops assuming it sits on `panneau` (C6), and the favourite toggle reaches 44px
without growing the 32px row — it becomes the full-height leading cell, which is target
area the row already owns (R3).

### B.3 Shell *(L1, R1, N3)*

An intermediate breakpoint, and below it the filter region collapses to a sticky summary
bar — « Barde · niveau 1-3 · 2 filtres » — that opens the full panel. The panel loses
nothing and hides nothing: it is one tap away instead of 60 scroll-lines away, and the
results are the first thing on the screen. Header gets a favourites count.

### B.4 Routes, highest-traffic first — `/`, then the spell sheet, then `/comparaison`

**H2, the reported complaint.** The 35 tags become groups, taken from the corpus's own
taxonomy rather than invented:

```
Effet          dégâts directs · soin ou guérison · amélioration de capacité ·
               affaiblissement de capacité · transformation du sujet ·
               entrave ou immobilisation · confusion ou désorientation
Cible          cible unique* · plusieurs cibles · zone d'effet ·
               rayon ou projectile · attaque de contact
Esprit         effet mental · charme ou coercition · peur ou terreur*
Défense        protection défensive · immunité ou résistance élémentaire ·
               dissipation ou contresort · résistance à la magie
Information    détection ou révélation · divination information ·
               perception améliorée · communication ou langage
Invocation     invocation ou création · illusion visuelle ou sonore ·
               invisibilité ou dissimulation
Durée          durée instantanée · durée prolongée
Chiffres       bonus chiffré · malus chiffré · jet de sauvegarde
Divers         arme ou munition · objet ou équipement · terrain ou environnement ·
               déplacement ou téléportation · alignement ou divin ·
               métamagie ou sort ciblé
```

Nine named groups, 35 tags, **nothing hidden and nothing renamed** — the French tag ids
stay verbatim, each group is collapsed to its heading only when the user collapses it, and
the mapping is derived from `conventions/taxo_groupes.json` so it stays true if the
taxonomy is regenerated. `*` marks a group slot the closed list does not currently fill.

Also on `/`: the result count becomes the second-most prominent thing on the page after
the table (H3, N2); `Comp.` becomes `Composantes` (H4, P1); the level legend gets a label
and keeps the sentence as help text (P2). On the spell sheet: the crumb carries the query
string back (N1).

**Does not touch:** the visual identity. Same `#116B4F`, same Fraunces / Inter / IBM Plex
Mono, same 14.5px body, same 32px rows, same six columns, same 200-row page, same layout
concept. Someone who knows the site would not call it redesigned.

**Cost:** the token layer and the primitives are most of it; the routes are then small.
Several days. Every finding above closed or explicitly deferred.

---

## C — Direction

A stated aesthetic direction. **Read the critique first — it changed the proposal.**

### C.0 Critique against the AI-default clusters

The three clusters to check against are: *cream + high-contrast serif + terracotta
accent*; *near-black + one acid accent*; *broadsheet hairline columns*.

**The site already is cluster 1.** `#FAFAF9` is cream-white; Fraunces is a
high-contrast display serif; `#116B4F` is a single muted accent, and `#8A3A12` — the
disagreement colour — is terracotta. My first direction was warmer paper, a heavier serif
and a deeper green: that is cluster 1 with the contrast turned up, arrived at by inertia
because it is what the existing palette suggests. It would have been presented as a
direction and delivered as a re-skin.

Two things changed after that critique:

1. **The paper moved off cream and the display face off the serif.** Not for novelty —
   because neither is doing work. Fraunces appears at 34px on four page titles that never
   change (H3) and nowhere in the 2070 rows anyone actually reads. A high-contrast serif
   spends its quality on the one text on the page that carries no information.
2. **The boldness moved to one structural element and everything else went quiet.** The
   material world here is not the grimoire — grimoire ornament *is* how this lands back in
   cluster 1. It is the **tabletop reference sheet**: the GM screen insert, the tabbed
   binder, the thumb-indexed rules book. Printed, ruled, cut for one-handed use.

### C.1 Palette — 6 named flat values

| name | hex | role | check |
|---|---|---|---|
| `encre` | `#17181A` | all body text | 17.4:1 on `papier` |
| `papier` | `#FFFFFF` | panels, table, sheet | — |
| `bureau` | `#E7E4DC` | the page field the panels sit on | 1.13:1 to `papier` — deliberate, they are two planes |
| `filet` | `#A8A398` | every rule, border and input outline | **3.1:1 on `papier`** — the first border in this product to meet the floor |
| `index` | `#1F4E46` | the tab rail, active state, links | 8.9:1 on `papier`; hue 168°, still ≥ 25° clear of the nearest school hue |
| `signal` | `#7A2E12` | level disagreement, and nothing else | 8.5:1 on `papier` |

Six flat values. No gradients. The nine school hues are unchanged — they pass, they are
load-bearing, and they are the one thing a player already recognises.

### C.2 Type

Display and body both change; data does not. `IBM Plex Mono` stays for levels,
components and spreads — it is the only face in the product doing real work, and monospaced
digits are why a 200-row level column is scannable.

The requirement the type has to meet is stated, not felt: fit
`Prêtre/Prêtre combattant/Oracle` in a column header, and 2070 accented French names in a
32px row at ≥ 14px. That argues for a condensed grotesque for display and a humanist sans
with tight sidebearings for body. Two candidates, both to be built and compared rather
than chosen from a specimen — that is a file-options question, not a paragraph.

Scale: keep the fixed 1.2 ratio and the 14.5px body. It is the right call and the reason
the density target is reachable; the audit found no fault with it.

### C.3 Signature element — the level thumb index

A cut-tab rail, 0–9, down the leading edge of the results — the thumb index of a rules
book. It is the level filter. Current level filled `index`, the rest outlined `filet`.

It earns its place three times over: it is the level filter, so it removes ten chips from
the panel (H1); each tab is a 44px target (R3); and on a phone it rotates to a horizontal
tab strip pinned above the table, so the results are the first thing on screen and the
remaining filters go behind the summary bar (L1, R1). Boldness spent once, on the control
that is used most.

### C.4 Layout — `/`

```
 ┌───────────────────────────────────────────────────────────────────────┐
 │ Sorts Pathfinder 1e        Sorts  Comparer  Favoris ·  pathfinder-fr  │
 ├───────────────────────────────────────────────────────────────────────┤
 │ ┌────┐                                                               │
 │ │ 0  │  Barde ▾    [ chercher un sort ................... / ]         │
 │ ├────┤                                                                │
 │ │ 1 ▉│  1 284 sorts        École ▾  Composantes ▾  Tags (9) ▾  ⌫      │
 │ ├────┤ ┌────────────────────────────────────────────────────────────┐ │
 │ │ 2 ▉│ │ Sort              Niveau Barde  École      Composantes  …  │ │
 │ ├────┤ ├────────────────────────────────────────────────────────────┤ │
 │ │ 3  │ │ ☆ Abondance de m…            1  Invocation  F FD G V       │ │
 │ ├────┤ │ ☆ Accorder une i…            2  Divination  G V           │ │
 │ │ 4  │ │ ☆ Adaptation cul…            1  Divination  F G V         │ │
 │ ├────┤ │  … 200 rows, 32px, Ctrl+F works                           │ │
 │ │ …  │ └────────────────────────────────────────────────────────────┘ │
 │ └────┘                                                                │
 └───────────────────────────────────────────────────────────────────────┘
   ▲ thumb index = level filter        ▲ count is the second-loudest thing
```

The filter panel becomes a row of grouped menus instead of a 272px column of ~60 chips.
**Nothing is hidden that was visible**: each menu shows its count, opens to the full list
of chips, and the posed filters stay listed under the bar. The level filter — the one
filter used on almost every visit — becomes permanently visible instead of one of eight
equal groups.

### C.5 Layout — the spell sheet

```
 ┌───────────────────────────────────────────────────────────────────────┐
 │ ‹ Barde · niveau 0-2 · Divination   (back to the list, filters kept)   │
 ├───────────────────────────────────────────────────────────────────────┤
 │ Détection de la magie                                        ☆ Favori │
 │ Divination · 18 m (12 c) · 3 classes                                  │
 ├──────────────────────────────┬────────────────────────────────────────┤
 │ Temps d'incantation          │ Barde        0                         │
 │   1 action simple            │ Druide       0                         │
 │ Composantes  V, G            │ Occultiste   0                         │
 │ Portée       18 m (12 c)     ├────────────────────────────────────────┤
 │ Cible        émanation…      │ Description                            │
 │ Durée        concentration…  │ Grâce à ce sort, le personnage peut    │
 │ Jet de sauv. aucun           │ repérer les auras magiques…            │
 │ Résistance   non             │                                        │
 ├──────────────────────────────┴────────────────────────────────────────┤
 │ ┄┄ Classement automatique (modèle, non relu) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
 ├───────────────────────────────────────────────────────────────────────┤
 │ Source · pathfinder-fr.org fait foi            [ Voir sur le wiki ]   │
 └───────────────────────────────────────────────────────────────────────┘
```

The stat block and the per-class levels sit side by side, because at the table they are
read together and one is currently 400px below the other. The crumb carries the filter
back (N1). The dashed LLM fence and the attribution block are unchanged — both are
load-bearing honesty and neither is a style decision.

### C.6 Layout — `/comparaison`

Unchanged in structure; the counters gain the type weight they already deserve, and the
`Écart` column becomes the sorted-by column visibly rather than only in the caption.

**Does not touch:** density, the French vocabulary, the 21 corpus keys, `niveauAffiche`,
`EtatVide`, the attribution link, the nine school colours, the URL-as-state contract, or
`IBM Plex Mono`.

**Cost:** B, plus a type decision and a new primitive. C **contains** B — the token layer
is the same work, and doing C without it would be restyling before the token layer exists.

---

## Recommendation — B

**A is not enough to close the report.** It fixes the sentence the user wrote
(« white text on white ») and leaves the sentence they wrote next (« organize it better »,
35 flat tags) untouched, along with every border in the product at 1.29:1. It is the right
*first commit* and the wrong *scope*.

**C is a real direction and I would not start with it.** Its strongest argument — the thumb
index — is an answer to H1/L1/R3, which B also answers, less boldly and without a type
decision. Its second argument is that Fraunces spends quality on the only text that
carries no information: true, and still not urgent enough to move two faces mid-audit. And
C cannot be built before B, because C's whole first phase *is* B's token layer.

**So: B, with A shipped first inside it** — C1 and C2 as the first two commits, referenced
by finding id, so the unreadable text and the invisible borders are gone within the day
rather than at the end of the consolidation.

Then, after B is in and you have used it at a table: if finding one spell fast still is not
fast, C's thumb index is the next move and B is what makes it cheap.

## The one decision I cannot make for you

**D1 — the disagreement feature renders for 0 of 2070 spells.** Three defensible answers,
and it is a product call:

1. **Keep it exactly as is.** It is a probe; the day the corpus disagrees, it shows. Cost:
   a filter slot, a badge tone and 2 of 13 palette values, permanently.
2. **Keep the sheet panel and the list badge, drop the filter chip.** The probe still
   fires; the control that can only ever return the empty state goes away.
3. **Keep everything, and say the number.** `Signalements — 0 sur 2070` next to the chip.
   The filter becomes self-explaining instead of looking broken, and the honesty is
   stated rather than implied.

I would take **3**. It costs one line of copy, keeps the probe intact, and turns the
feature's zero into information — which is what the rest of this product does with its
gaps.
