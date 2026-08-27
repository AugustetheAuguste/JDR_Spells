/**
 * Who shares what, and at what cost in levels.
 *
 * The whole point of this view is the level spread. Two classes both getting a
 * spell at level 2 is unremarkable; the bard getting at 2 what the wizard waits
 * until 5 for is a fact that changes a character choice, and it exists nowhere
 * on the web because it requires cross-referencing nineteen class lists. The
 * pipeline already computed it once (`data/index/carte_doublons.json` lists 678
 * spells with divergent levels), which is what `verifierCartes` cross-checks
 * against — a check, never a source.
 *
 * Pure functions over the index, no React and no URL: the sets are what this
 * module owns, the view and the query string are elsewhere.
 */

import type { EntreeSort, IndexWeb } from '@/lib/donnees/index-web'

/**
 * Three classes, not more.
 *
 * A readability limit and not a computational one — the partial intersections of
 * four sets are eleven cells and the table stops being readable long before the
 * maths gets hard. The interface states the limit in words rather than silently
 * dropping the fourth pick, because a selector that ignores a click looks broken.
 */
export const MAX_CLASSES = 3
export const MIN_CLASSES = 2

export interface SortCompare {
  readonly sort: EntreeSort
  /** Level per selected class that gets it. A class absent from the map does not
   * get the spell — never rendered as 0, which is a real level. */
  readonly niveaux: Readonly<Record<string, number>>
  /** `max - min` over `niveaux`. 0 when every selected class gets it at the same
   * level, and null when only one selected class gets it, because a spread needs
   * two numbers and inventing a 0 there would rank it as "no divergence". */
  readonly ecart: number | null
}

export interface Comparaison {
  readonly classes: readonly string[]
  /** Held by EVERY selected class. */
  readonly partages: readonly SortCompare[]
  /** Per class slug: held by that class and by none of the other SELECTED ones.
   * Relative to the selection, not to the whole corpus — see `exclusifsAbsolus`. */
  readonly exclusifs: Readonly<Record<string, readonly SortCompare[]>>
  /** Held by at least two but not all selected classes. Empty for a two-class
   * comparison, where "at least two" and "all" are the same thing. */
  readonly partiels: readonly SortCompare[]
  /** Held by at least one selected class. `partages + Σexclusifs + partiels`
   * partitions exactly this set, which is what `ensembles.test.ts` asserts. */
  readonly union: readonly SortCompare[]
}

function decrire(sort: EntreeSort, classes: readonly string[]): SortCompare {
  const niveaux: Record<string, number> = {}
  for (const classe of classes) {
    const niveau = sort.niv[classe]
    if (niveau !== undefined) niveaux[classe] = niveau
  }
  const valeurs = Object.values(niveaux)
  return {
    sort,
    niveaux,
    ecart: valeurs.length < 2 ? null : Math.max(...valeurs) - Math.min(...valeurs),
  }
}

/**
 * Compare two or three classes.
 *
 * Selection order is preserved rather than sorted: it is the order the user
 * picked and the order the columns appear in, and re-sorting it would make the
 * URL and the table disagree about which class is first.
 */
export function comparer(index: IndexWeb, classes: readonly string[]): Comparaison {
  const union: SortCompare[] = []
  const partages: SortCompare[] = []
  const partiels: SortCompare[] = []
  const exclusifs: Record<string, SortCompare[]> = {}
  for (const classe of classes) exclusifs[classe] = []

  for (const sort of index.sorts) {
    const detenteurs = classes.filter((classe) => sort.niv[classe] !== undefined)
    if (detenteurs.length === 0) continue

    const decrit = decrire(sort, classes)
    union.push(decrit)

    if (detenteurs.length === classes.length) partages.push(decrit)
    else if (detenteurs.length === 1) exclusifs[detenteurs[0] as string]!.push(decrit)
    else partiels.push(decrit)
  }

  return { classes, partages, exclusifs, partiels, union }
}

/**
 * Sort by level spread, widest first.
 *
 * The default order, because « which spells does the bard get much earlier than
 * the wizard » is the question this view answers. Ties break on the name, French
 * collated — otherwise the 600-odd zero-spread rows shuffle between renders.
 * A null spread sorts last: it is an absence of information, not a spread of 0.
 */
export function trierParEcart(sorts: readonly SortCompare[]): SortCompare[] {
  return [...sorts].sort((a, b) => {
    const ea = a.ecart ?? -1
    const eb = b.ecart ?? -1
    return eb - ea || a.sort.n.localeCompare(b.sort.n, 'fr')
  })
}

export function trierParNom(sorts: readonly SortCompare[]): SortCompare[] {
  return [...sorts].sort((a, b) => a.sort.n.localeCompare(b.sort.n, 'fr'))
}

/**
 * The sortable columns of the comparison table.
 *
 * A per-class level column is named `niveau:<slug>` rather than by position: the
 * columns ARE the selection, so a positional key would point at a different class
 * the moment the selection changed, and a shared link would silently sort by the
 * wrong one. `ecart` is the fourth, and the default.
 */
export const PREFIXE_COLONNE_NIVEAU = 'niveau:'

export type ColonneComparaison = 'nom' | 'ecole' | 'ecart' | `${typeof PREFIXE_COLONNE_NIVEAU}${string}`

export function colonneNiveauDe(classe: string): ColonneComparaison {
  return `${PREFIXE_COLONNE_NIVEAU}${classe}`
}

/** The class a level column belongs to, or null for the other columns. */
export function classeDeColonne(colonne: string): string | null {
  return colonne.startsWith(PREFIXE_COLONNE_NIVEAU)
    ? colonne.slice(PREFIXE_COLONNE_NIVEAU.length)
    : null
}

/**
 * True when `colonne` is sortable given the classes currently compared.
 *
 * The selection is part of the validation, not an afterthought:
 * `tri=niveau:barde` on a comparison that does not include the bard names a column
 * that is not on screen, and sorting by an invisible number looks like a bug.
 */
export function estColonneComparaison(
  colonne: string,
  classes: readonly string[],
): colonne is ColonneComparaison {
  if (colonne === 'nom' || colonne === 'ecole' || colonne === 'ecart') return true
  const classe = classeDeColonne(colonne)
  return classe !== null && classes.includes(classe)
}

/**
 * Sort the comparison rows by one column.
 *
 * Same two rules as the browse table: a missing value sorts last in both
 * directions — a class that does not get the spell is an absence, not a low level
 * — and the name in French collation is the final tie-break, without which the
 * 600-odd equal rows reshuffle between renders.
 */
export function trierComparaisonParColonne(
  index: IndexWeb,
  sorts: readonly SortCompare[],
  colonne: ColonneComparaison,
  sens: 'asc' | 'desc',
): SortCompare[] {
  const facteur = sens === 'desc' ? -1 : 1
  const valeur = (ligne: SortCompare): string | number | null => {
    if (colonne === 'nom') return ligne.sort.n
    if (colonne === 'ecole') {
      return ligne.sort.e === null ? null : (index.ecoles[ligne.sort.e] ?? null)
    }
    if (colonne === 'ecart') return ligne.ecart
    const classe = classeDeColonne(colonne)
    return classe === null ? null : (ligne.niveaux[classe] ?? null)
  }
  return [...sorts].sort((a, b) => {
    const va = valeur(a)
    const vb = valeur(b)
    if (va === null && vb === null) return a.sort.n.localeCompare(b.sort.n, 'fr')
    if (va === null) return 1
    if (vb === null) return -1
    const ordre =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'fr')
    return ordre === 0 ? a.sort.n.localeCompare(b.sort.n, 'fr') : ordre * facteur
  })
}

/** Keep only the rows whose spell satisfies the tag filter. Same any-of to
 * include / none-of to exclude asymmetry as the browse view, for the same
 * reason: « hide mind-affecting » has to hide all of them. */
export function filtrerParTags(
  sorts: readonly SortCompare[],
  tags: readonly number[],
  tagsExclus: readonly number[],
  tagsObliges: readonly number[] = [],
): SortCompare[] {
  if (tags.length === 0 && tagsExclus.length === 0 && tagsObliges.length === 0) return [...sorts]
  return sorts.filter(({ sort }) => {
    if (tags.length > 0 && !tags.some((code) => sort.t.includes(code))) return false
    if (tagsExclus.some((code) => sort.t.includes(code))) return false
    if (!tagsObliges.every((code) => sort.t.includes(code))) return false
    return true
  })
}

/**
 * Spells a class gets that NO other class in the corpus gets.
 *
 * Different from `exclusifs`, which is relative to the selection, and it exists
 * for one reason: it is the quantity `data/index/sorts_exclusifs.json` holds, so
 * it is what the pipeline's own numbers can be checked against.
 */
export function exclusifsAbsolus(index: IndexWeb, classe: string): EntreeSort[] {
  return index.sorts.filter((sort) => {
    const classes = Object.keys(sort.niv)
    return classes.length === 1 && classes[0] === classe
  })
}
