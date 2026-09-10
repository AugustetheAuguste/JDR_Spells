# 05 — Changes

What shipped. Two finding ids closed. Everything else in `01_AUDIT.md` is still open and
listed in `99_FOLLOWUPS.md`.

Design delivered in `recreation-sorts-pf1.dc.html` (all four routes, real 2070-spell
index). The repository edits are specified below verbatim and are **not yet applied** —
this project has read access to `AugustetheAuguste/JDR_Spells`, not write access.

---

## C1 — body text at 1.04:1 on all four routes — **closed**

### Before → after

| Route | Element | Before | After |
|---|---|---|---|
| `/` | `Portée` / `Sauvegarde` cells | `#FAFAF9` on `#FFFFFF` — **1.04:1** | `#1C1B19` — **17.21:1** |
| `/sorts/[slug]/` | all seven stat-block values | 1.04:1 | 17.21:1 |
| `/sorts/[slug]/` | the whole description | 1.04:1 | 17.21:1 |
| `/sorts/[slug]/` | class-name column, `Niveaux par classe` | 1.04:1 | 17.21:1 |
| `/sorts/[slug]/` | source books, LLM summary and values | 1.04:1 | 17.21:1 |
| `/comparaison` | level columns and `Écart` | 1.04:1 | 17.21:1 |
| `/comparaison` | all 19 class names in the selector | 1.04:1 | 17.21:1 |
| `/favoris` | table cells, list picker, rename field, both dialogs | 1.04:1 | 17.21:1 |

Measured after the change with `getComputedStyle` on the recreation: every one of the 22
sites reports `rgb(28, 27, 25)`.

### The change

Two token names, one test, one mechanical sweep. Per ADR-002 the **size** token moved.

`web/styles/theme.css`

```diff
-  --text-base: 14.5px;
-  --text-base--line-height: 22px;
+  --text-corps: 14.5px;
+  --text-corps--line-height: 22px;
```

```diff
   body {
     background-color: var(--color-base);
     color: var(--color-encre);
-    font-size: var(--text-base);
-    line-height: var(--text-base--line-height);
+    font-size: var(--text-corps);
+    line-height: var(--text-corps--line-height);
     margin: 0;
   }
```

`web/lib/design/tokens.ts` — `ECHELLE.base` → `ECHELLE.corps`.

`web/lib/design/tokens.test.ts` — the new guard (ADR-003):

```ts
it('aucun nom de jeton ne vit dans deux espaces de noms @theme', () => {
  const css = readFileSync(CHEMIN_THEME, 'utf8')
  const noms = (prefixe: string) =>
    new Set([...css.matchAll(new RegExp(`--${prefixe}-([a-z0-9-]+)\\s*:`, 'g'))]
      .map((m) => m[1]!)
      .filter((n) => !n.endsWith('--line-height')))
  const collisions = [...noms('color')].filter((n) => noms('text').has(n))
  // Tailwind 4 résout `text-*` dans --color-* ET --text-* : un nom présent dans les
  // deux compile les deux sens. C'est ce qui a rendu le corps du texte illisible.
  expect(collisions).toEqual([])
})
```

Sweep — `text-base` → `text-corps`, 38 occurrences, 13 files:

| File | Occurrences |
|---|---:|
| `components/favoris/VueFavoris.tsx` | 15 |
| `components/fiche/NiveauxParClasse.tsx` | 2 |
| `components/fiche/BlocTechnique.tsx` | 1 |
| `components/fiche/CoucheEnrichissement.tsx` | 2 |
| `components/fiche/Description.tsx` | 2 |
| `components/fiche/LienSource.tsx` | 2 |
| `components/primitives/TableDense.tsx` | 1 |
| `components/primitives/MarqueurDesaccord.tsx` | 1 |
| `components/primitives/EtatVide.tsx` | 2 |
| `components/primitives/ChampRecherche.tsx` | 1 |
| `components/navigation/PanneauFiltres.tsx` | 1 |
| `components/navigation/VueNavigation.tsx` | 1 |
| `components/comparaison/*.tsx` | 4 |
| `components/favoris/BoutonFavori.tsx` | 1 |
| `app/layout.tsx` | 1 |
| `app/sorts/[slug]/page.tsx` | 1 |

No colour was added to any component. The 16 occurrences that already paired `text-base`
with an explicit ink keep that ink; they were never broken, and they are why the defect
looked local.

### Sweep proof

After the rename, `rg 'text-base' web/` returns zero hits, and the ADR-003 test fails on
any reintroduced `--color-x`/`--text-x` pair. The class is closed, not the instance.

---

## H2 — 35 tags as one flat list — **closed**

### Before → after

**Before.** `PanneauFiltres` mapped `index.tags` 1:1 into a single
`flex flex-wrap gap-1.5`: 35 identical chips, alphabetical, `affaiblissement de capacité`
through `zone d'effet`, with no relationship visible between any two of them.

**After.** Nine named families, each a nested `fieldset`/`legend`, in a fixed order that
runs from what a spell *does* to what it *is filed under*:

| Family | Tags | n |
|---|---|---:|
| **Effet** | dégâts directs · soin ou guérison · amélioration de capacité · affaiblissement de capacité · transformation du sujet · entrave ou immobilisation | 6 |
| **Cible et portée** | plusieurs cibles · zone d'effet · rayon ou projectile · attaque de contact | 4 |
| **Esprit** | effet mental · charme ou coercition · confusion ou désorientation | 3 |
| **Défense** | protection défensive · immunité ou résistance élément · dissipation ou contresort · résistance a la magie | 4 |
| **Information** | détection ou révélation · divination information · perception améliorée · communication ou langage | 4 |
| **Invocation et illusion** | invocation ou création · illusion visuelle ou sonore · invisibilité ou dissimulation | 3 |
| **Durée** | durée instantanée · durée prolongée | 2 |
| **Chiffres** | bonus chiffré · malus chiffré · jet de sauvegarde | 3 |
| **Divers** | arme ou munition · objet ou équipement · terrain ou environnement · déplacement ou téléportation · alignement ou divin · métamagie ou sort ciblé | 6 |

**35 in, 35 out.** Verified in the recreation: nine `fieldset`s, 35 `label`s, no id
renamed, translated, abbreviated or hidden. Every chip is visible and clickable exactly as
before — the only thing added is a heading above each subset (ADR-004).

The family heading uses existing tokens only: `--text-micro` at weight 500 in
`--color-encre-faible`, uppercased with 0.06em tracking — quieter than the `Tags` legend
above it, so the panel gains one level of hierarchy and no new type size.

The `Tags` legend now carries its own count when filters are posed —
`Tags — 3 posés` — which is a partial answer to N2 and cost one string.

### The change

New `web/lib/navigation/familles-tags.ts`: an ordered array of
`[titre, readonly tagId[]]`, plus `grouper(tags: readonly string[])` returning
`{titre, tags}[]`.

`components/navigation/PanneauFiltres.tsx`: the `Tags` group renders
`grouper(index.tags)` instead of `index.tags`, one nested `Groupe` per family.

### Staleness guard

`grouper()` puts any id the map does not know into a final **`Non classés`** family rather
than dropping it, and a test asserts
`grouper(index.tags).flatMap(g => g.tags).length === index.tags.length`. Regenerating the
enrichment taxonomy can add a tag; it cannot silently remove a filter (ADR-004).

---

## Not changed, on purpose

- Density: 32px rows, 200 per page, six columns, ~60 filter controls. Untouched.
- The French vocabulary, the 21 corpus keys, `niveauAffiche`, `EtatVide`, the
  `pathfinder-fr.org` attribution block.
- The palette: no colour value changed. C1 was a name, not a value.
- Layout, navigation, component states, breakpoints, tap targets. See `99_FOLLOWUPS.md`.
