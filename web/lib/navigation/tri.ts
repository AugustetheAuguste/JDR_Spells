/**
 * Column sorting for the results table.
 *
 * The default order is not "unsorted": it is level then name, which is how a
 * prepared caster's list is read. So `null` is a real, named state here — « the
 * order this table has always had » — and clicking a header leaves it rather than
 * turning sorting on.
 *
 * Two rules hold across every column:
 *
 * 1. A missing value always sorts LAST, in both directions. The corpus has gaps
 *    (a spell with no school, no range, no saving throw), and a gap is not a
 *    small value: floating em dashes to the top of an ascending list would read as
 *    "these are the lowest", which is a claim the corpus does not make.
 * 2. The name, collated in French, is the final tie-break. Without it the order
 *    of equal rows depends on the input array, so the same filter could produce
 *    two different tables — and a table that reshuffles on re-render cannot be
 *    read.
 *
 * The level column is class-relative like everywhere else (B4): it sorts on what
 * `niveauAffiche` shows, which is the per-class level when a class is chosen and
 * the cross-class floor when none is. Sorting on `niv` directly would order the
 * table by a number the reader cannot see.
 */

import type { EntreeSort, IndexWeb } from '@/lib/donnees/index-web'
import { niveauAffiche } from '@/lib/navigation/niveaux'

/** The sortable columns. These strings appear in the URL, so they are names and
 * not indices — a reordered column list must not change what a shared link means. */
export const COLONNES_TRIABLES = [
  'nom',
  'niveau',
  'ecole',
  'composantes',
  'portee',
  'jet',
] as const

export type ColonneTri = (typeof COLONNES_TRIABLES)[number]
export type SensTri = 'asc' | 'desc'

/**
 * Every column starts ascending on its first click.
 *
 * There is no column here whose first useful reading is descending — a spell list
 * is read from the low levels up and a name list from A — so the table never
 * surprises with a reversed first click.
 */
export const SENS_INITIAL: SensTri = 'asc'

export function estColonneTri(valeur: string): valeur is ColonneTri {
  return (COLONNES_TRIABLES as readonly string[]).includes(valeur)
}

/**
 * The value a column sorts on: a number, a string, or null for a gap.
 *
 * Strings are the *displayed* labels, not the index codes. Sorting « Portée » by
 * its integer code would order the column by the export's table order, which is
 * arbitrary and invisible — the reader would see a jumble and conclude the
 * feature is broken.
 */
function valeurDeTri(
  index: IndexWeb,
  sort: EntreeSort,
  colonne: ColonneTri,
  classe: string | null,
): string | number | null {
  switch (colonne) {
    case 'nom':
      return sort.n
    case 'niveau':
      return niveauAffiche(index, sort, classe).valeur
    case 'ecole':
      return sort.e === null ? null : (index.ecoles[sort.e] ?? null)
    case 'composantes':
      // Fewest components first, then alphabetically among equals: "how simple is
      // this to cast" is the question the column answers, and that is a count.
      return sort.c.length === 0
        ? null
        : sort.c.length * 1000 + (sort.c[0] ?? 0)
    case 'portee':
      return sort.p === null ? null : (index.portees[sort.p] ?? null)
    case 'jet':
      return sort.j === null ? null : (index.jets[sort.j] ?? null)
  }
}

function comparer(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  // French collation: « Éclair » sorts after « Eau », not before it as code points
  // would have it.
  return String(a).localeCompare(String(b), 'fr')
}

/**
 * Sort a result list by a column, or return the caller's order untouched.
 *
 * `colonne === null` returns a copy of the input rather than the default level
 * order: the caller already decided what "no sort" means — level-then-name when
 * browsing, relevance when there is a query — and re-sorting here would throw
 * the search ranking away.
 */
export function trierParColonne(
  index: IndexWeb,
  sorts: readonly EntreeSort[],
  colonne: ColonneTri | null,
  sens: SensTri,
  classe: string | null,
): EntreeSort[] {
  if (colonne === null) return [...sorts]
  const facteur = sens === 'desc' ? -1 : 1
  return [...sorts].sort((a, b) => {
    const va = valeurDeTri(index, a, colonne, classe)
    const vb = valeurDeTri(index, b, colonne, classe)
    // Gaps last in BOTH directions, so reversing the sort never promotes an em
    // dash to the top as if it were an extreme value.
    if (va === null && vb === null) return a.n.localeCompare(b.n, 'fr')
    if (va === null) return 1
    if (vb === null) return -1
    const ordre = comparer(va, vb)
    return ordre === 0 ? a.n.localeCompare(b.n, 'fr') : ordre * facteur
  })
}

/**
 * What clicking a header does.
 *
 * Clicking the active column flips it; clicking a third time returns to the
 * table's own order rather than flipping again. That third state is the way back:
 * without it, once you have sorted by « Portée » there is no click that restores
 * the level order, and « Tout effacer » — which also drops the filters — becomes
 * the only escape.
 */
export function prochainTri<C extends string>(
  actuelle: C | null,
  sensActuel: SensTri,
  cliquee: C,
): { readonly colonne: C | null; readonly sens: SensTri } {
  if (actuelle !== cliquee) return { colonne: cliquee, sens: SENS_INITIAL }
  if (sensActuel === SENS_INITIAL) {
    return { colonne: cliquee, sens: 'desc' }
  }
  return { colonne: null, sens: SENS_INITIAL }
}
