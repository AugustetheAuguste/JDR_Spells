/**
 * Filtering, kept apart from searching.
 *
 * The search knows nothing about filters and the filters know nothing about
 * scores: the caller decides whether to filter the whole corpus (no query) or
 * the result list (a query). That separation is the reason both can be tested in
 * isolation, and the reason a filter change never has to re-run the index.
 *
 * The level filter is class-relative (B4). `niveaux` alone is meaningless — a
 * spell is level 2 *for the bard*, and "the" level of a spell does not exist. So
 * a level filter without a class is refused, not silently applied against some
 * minimum: the minimum across classes is a number nobody asked for, and it would
 * show a bard a "level 1" list containing spells the bard gets at 4.
 */

import type { EntreeSort } from '@/lib/donnees/index-web'

export interface Filtres {
  /** Class slug. Required for `niveaux`, and on its own it means "spells this
   * class gets". */
  readonly classe?: string | null
  /** Several classes at once — the exploration route's widened step one. Takes
   * over from `classe` when non-empty: a spell matches if AT LEAST ONE of these
   * classes grants it, and if `niveaux` is posed, at the level of that same
   * matching class. This is an OR, not `classe` repeated — a spell need not be
   * on every listed class's list, only on one of them. */
  readonly classes?: readonly string[]
  /** Levels, relative to `classe`. Without a class, see `niveauSansClasse`. */
  readonly niveaux?: readonly number[]
  /**
   * What a level filter means when no class is selected.
   *
   * `'refuser'` (the default) ignores the filter: no class, no level, because the
   * level of a spell in the abstract does not exist. `'minimum'` filters on the
   * lowest level across all classes — legitimate ONLY because the view labels it
   * « Niveau le plus bas, toutes classes » in so many words. It is opt-in and
   * named so that nobody can reach the minimum by accident; a silent fallback is
   * precisely how a bard ends up shown a "level 1" list of level-4 spells.
   */
  readonly niveauSansClasse?: 'refuser' | 'minimum'
  /** School codes, as in `index.ecoles`. */
  readonly ecoles?: readonly number[]
  /** Component codes, ALL of which must be present — someone excluding material
   * components wants spells with none of it, not spells with some other. */
  readonly composantes?: readonly number[]
  /** Saving-throw codes, as in `index.jets`. */
  readonly jets?: readonly number[]
  /** Tag codes from the optional LLM layer. A spell matches if it carries any. */
  readonly tags?: readonly number[]
  /**
   * Tag codes a spell must carry NONE of.
   *
   * Any-of to include, none-of to exclude — and deliberately not symmetric. « Show
   * me area spells or ranged spells » is one question, but « hide mind-affecting »
   * means hide every one of them; an exclusion that only fired when a spell
   * carried *all* the excluded tags would let most of what you asked to hide
   * through, which is the failure you would notice last.
   */
  readonly tagsExclus?: readonly number[]
  /** True keeps only spells whose corpus records a level disagreement. */
  readonly desaccord?: boolean
}

/** The empty filter set: `appliquer` returns its input untouched. */
export const FILTRES_VIDES: Filtres = {}

function vide(valeurs: readonly number[] | undefined): boolean {
  return valeurs === undefined || valeurs.length === 0
}

/** True when `filtres` would keep everything — lets a caller skip the pass and
 * lets the UI know whether to offer "clear filters". */
export function filtresActifs(filtres: Filtres): boolean {
  return (
    (filtres.classe ?? null) !== null ||
    (filtres.classes ?? []).length > 0 ||
    (!vide(filtres.niveaux) && filtres.niveauSansClasse === 'minimum') ||
    !vide(filtres.ecoles) ||
    !vide(filtres.composantes) ||
    !vide(filtres.jets) ||
    !vide(filtres.tags) ||
    !vide(filtres.tagsExclus) ||
    filtres.desaccord === true
  )
}

/**
 * The lowest level across every class granting the spell, or null.
 *
 * null and not 0: 0 is a real level (orisons), and returning it for a spell no
 * class grants would sort that spell to the top of a level-ordered list.
 */
export function niveauMinimum(sort: EntreeSort): number | null {
  const niveaux = Object.values(sort.niv)
  return niveaux.length === 0 ? null : Math.min(...niveaux)
}

function retenir(sort: EntreeSort, filtres: Filtres): boolean {
  const classes = filtres.classes ?? []
  const classe = filtres.classe ?? null
  if (classes.length > 0) {
    const correspond = classes.some((c) => {
      const niveau = sort.niv[c]
      if (niveau === undefined) return false
      return vide(filtres.niveaux) || filtres.niveaux!.includes(niveau)
    })
    if (!correspond) return false
  } else if (classe !== null) {
    const niveau = sort.niv[classe]
    if (niveau === undefined) return false
    if (!vide(filtres.niveaux) && !filtres.niveaux!.includes(niveau)) return false
  } else if (!vide(filtres.niveaux) && filtres.niveauSansClasse === 'minimum') {
    const niveau = niveauMinimum(sort)
    if (niveau === null || !filtres.niveaux!.includes(niveau)) return false
  }
  if (!vide(filtres.ecoles) && (sort.e === null || !filtres.ecoles!.includes(sort.e))) return false
  if (!vide(filtres.jets) && (sort.j === null || !filtres.jets!.includes(sort.j))) return false
  if (!vide(filtres.composantes) && !filtres.composantes!.every((c) => sort.c.includes(c))) {
    return false
  }
  if (!vide(filtres.tags) && !filtres.tags!.some((t) => sort.t.includes(t))) return false
  if (!vide(filtres.tagsExclus) && filtres.tagsExclus!.some((t) => sort.t.includes(t))) {
    return false
  }
  if (filtres.desaccord === true && !sort.d) return false
  return true
}

/**
 * Keep the entries matching `filtres`, in the order they came in.
 *
 * Order is preserved rather than re-sorted, because for a filtered search result
 * the incoming order IS the relevance ranking; re-sorting here would throw away
 * what the engine computed.
 */
export function appliquerFiltres<T extends EntreeSort>(
  entrees: readonly T[],
  filtres: Filtres,
): T[] {
  if (!filtresActifs(filtres)) return [...entrees]
  return entrees.filter((entree) => retenir(entree, filtres))
}

/**
 * Filter search results by resolving each back to its index entry.
 *
 * Results carry `i`/`id`/`s`/`n` only — enough to render a row, not enough to
 * filter on — so the index entry is the authority here.
 */
export function appliquerFiltresAuxResultats<R extends { readonly id: string }>(
  resultats: readonly R[],
  parId: ReadonlyMap<string, EntreeSort>,
  filtres: Filtres,
): R[] {
  if (!filtresActifs(filtres)) return [...resultats]
  return resultats.filter((resultat) => {
    const sort = parId.get(resultat.id)
    return sort !== undefined && retenir(sort, filtres)
  })
}
