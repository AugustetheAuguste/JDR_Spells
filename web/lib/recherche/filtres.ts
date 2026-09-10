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
  /** Range codes, as in `index.portees`. A spell matches if it carries any. */
  readonly portees?: readonly number[]
  /** Casting-time codes, as in `index.temps_incantation`. A spell matches if it
   * carries any. */
  readonly tempsIncantation?: readonly number[]
  /** Damage-type codes from the optional LLM layer, as in `index.types_degats`.
   * A spell matches if its single value is any of these. */
  readonly typesDegats?: readonly number[]
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
  /**
   * Tag codes a spell must carry ALL of.
   *
   * The AND counterpart of `tags`' any-of: « only spells that are both area AND
   * persistent » is a different question from « area or persistent », and the
   * closed taxonomy is small enough that asking for a conjunction of several tags
   * at once is a real thing to want at the table.
   */
  readonly tagsObliges?: readonly number[]
  /** Condition codes from the optional LLM layer, as in `index.conditions_infligees`.
   * A spell matches if it carries at least one of these (OR) — the AND/NOT
   * counterparts below mirror the tag filter's three-state cycle. */
  readonly conditionsInfligees?: readonly number[]
  /** Condition codes a spell must carry NONE of. See `tagsExclus`. */
  readonly conditionsInfligeesExclues?: readonly number[]
  /** Condition codes a spell must carry ALL of. See `tagsObliges`. */
  readonly conditionsInfligeesObligees?: readonly number[]
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
    !vide(filtres.portees) ||
    !vide(filtres.tempsIncantation) ||
    !vide(filtres.typesDegats) ||
    !vide(filtres.tags) ||
    !vide(filtres.tagsExclus) ||
    !vide(filtres.tagsObliges) ||
    !vide(filtres.conditionsInfligees) ||
    !vide(filtres.conditionsInfligeesExclues) ||
    !vide(filtres.conditionsInfligeesObligees) ||
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
  if (!vide(filtres.portees) && (sort.p === null || !filtres.portees!.includes(sort.p))) {
    return false
  }
  if (
    !vide(filtres.tempsIncantation) &&
    (sort.ti === null || !filtres.tempsIncantation!.includes(sort.ti))
  ) {
    return false
  }
  if (!vide(filtres.composantes) && !filtres.composantes!.every((c) => sort.c.includes(c))) {
    return false
  }
  if (
    !vide(filtres.typesDegats) &&
    (sort.td === null || !filtres.typesDegats!.includes(sort.td))
  ) {
    return false
  }
  if (!vide(filtres.tags) && !filtres.tags!.some((t) => sort.t.includes(t))) return false
  if (!vide(filtres.tagsExclus) && filtres.tagsExclus!.some((t) => sort.t.includes(t))) {
    return false
  }
  if (!vide(filtres.tagsObliges) && !filtres.tagsObliges!.every((t) => sort.t.includes(t))) {
    return false
  }
  if (
    !vide(filtres.conditionsInfligees) &&
    !filtres.conditionsInfligees!.some((c) => sort.ci.includes(c))
  ) {
    return false
  }
  if (
    !vide(filtres.conditionsInfligeesExclues) &&
    filtres.conditionsInfligeesExclues!.some((c) => sort.ci.includes(c))
  ) {
    return false
  }
  if (
    !vide(filtres.conditionsInfligeesObligees) &&
    !filtres.conditionsInfligeesObligees!.every((c) => sort.ci.includes(c))
  ) {
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

/*
 * ---------------------------------------------------------------------------
 * Dons (Pathfinder feats) — a second, disjoint filter domain.
 *
 * This is deliberately NOT layered onto `Filtres`/`EntreeSort` above: a don has
 * nothing to do with a spell's level-per-class or its saving throw, and forcing
 * one interface to describe both would only produce optional fields nobody
 * fills. The one name the two vocabularies share, `bonus_chiffre` (present in
 * both `effet_principal` for spells' tags and dons' `effet_principal`), stays
 * harmless here precisely because it never has to cross into the same object —
 * see `etat-url.ts` for why the URL keys carry a `dons_` prefix for the same
 * reason.
 * ---------------------------------------------------------------------------
 */

/** The eligibility verdict computed by the pf1_dons engine for one character.
 * `manual_check` must always stay selectable: filtering it out by default would
 * hide, from the player, exactly the feats the engine could not decide — the
 * under-attribution the source repository's whole gating design fights. */
export const STATUTS_DONS = ['eligible', 'manual_check', 'ineligible'] as const
export type StatutDon = (typeof STATUTS_DONS)[number]

/** The seven facet names carried in the URL (see `etat-url.ts`), independent of
 * whether the underlying field on a `EntreeDon` is single- or multi-valued. */
export type FacetteDon =
  | 'effet'
  | 'effet2'
  | 'cible'
  | 'contexte'
  | 'activation'
  | 'polyvalence'
  | 'categorie'

export const FACETTES_DONS: readonly FacetteDon[] = [
  'effet',
  'effet2',
  'cible',
  'contexte',
  'activation',
  'polyvalence',
  'categorie',
]

/**
 * Which facets carry more than one value per don.
 *
 * This is the one table whose omission produced the source repository's actual
 * bug (`OUTPUT_defauts_du_graphe.md`): forgetting to mark `categorie_officielle`
 * as multi-valued made a two-category don only ever match its first category,
 * so a filter on its second category silently dropped it — the option looked
 * empty when it was not. Declaring it here, and reading every facet through
 * `champFacette` below rather than a bespoke scalar accessor, is what keeps that
 * mistake from recurring.
 */
export const MULTIVALUEES: ReadonlySet<FacetteDon> = new Set(['effet2', 'cible', 'contexte', 'categorie'])

/**
 * One don's facet values, all read as plain names (never the index's integer
 * codes — resolving those to names is the caller's job, at the boundary with
 * the real `IndexDons`, exactly as `versFiltres` does for spells above).
 */
export interface EntreeDon {
  readonly id: string
  /** `effet_principal` — single-valued on a don. */
  readonly effet: string | null
  /** `effets_secondaires` — multi-valued. */
  readonly effets2: readonly string[]
  /** `cible_du_bonus` — multi-valued. */
  readonly cibles: readonly string[]
  /** `contexte` — multi-valued. */
  readonly contextes: readonly string[]
  /** `activation` — single-valued. */
  readonly activation: string | null
  /** `polyvalence` — single-valued; weak facet, 61% of dons are `conditionnel`. */
  readonly polyvalence: string | null
  /** `categorie_officielle` — multi-valued (e.g. « Blessant » is combat+sociale). */
  readonly categories: readonly string[]
  /** Slots to unlock, prerequisites included, or null if not computed for this
   * character. */
  readonly cout: number | null
  readonly statut: StatutDon
  /** Free text searched by `dons_q` — name plus short summary, typically. */
  readonly texte: string
}

function champFacette(entree: EntreeDon, facette: FacetteDon): readonly string[] {
  switch (facette) {
    case 'effet':
      return entree.effet === null ? [] : [entree.effet]
    case 'effet2':
      return entree.effets2
    case 'cible':
      return entree.cibles
    case 'contexte':
      return entree.contextes
    case 'activation':
      return entree.activation === null ? [] : [entree.activation]
    case 'polyvalence':
      return entree.polyvalence === null ? [] : [entree.polyvalence]
    case 'categorie':
      return entree.categories
  }
}

/** The maximum cost accepted by `dons_cout` (`COUTS_MAX` in the source repository). */
export const COUT_DONS_MAX = 5

/**
 * The three-state selection for every facet, plus cost and status.
 *
 * Each facet gets the same trio as spell tags (`Filtres.tags`/`tagsExclus`/
 * `tagsObliges`): OR within `…`, NOT in `…Exclu(e)s`, AND in `…Obligé(e)s`.
 */
export interface FiltresDons {
  readonly effets: readonly string[]
  readonly effetsExclus: readonly string[]
  readonly effetsObliges: readonly string[]
  readonly effets2: readonly string[]
  readonly effets2Exclus: readonly string[]
  readonly effets2Obliges: readonly string[]
  readonly cibles: readonly string[]
  readonly ciblesExclues: readonly string[]
  readonly ciblesObligees: readonly string[]
  readonly contextes: readonly string[]
  readonly contextesExclus: readonly string[]
  readonly contextesObliges: readonly string[]
  readonly activations: readonly string[]
  readonly activationsExclues: readonly string[]
  readonly activationsObligees: readonly string[]
  readonly polyvalences: readonly string[]
  readonly polyvalencesExclues: readonly string[]
  readonly polyvalencesObligees: readonly string[]
  readonly categories: readonly string[]
  readonly categoriesExclues: readonly string[]
  readonly categoriesObligees: readonly string[]
  /** Maximum cost in slots, inclusive; null means unconstrained. */
  readonly coutMax: number | null
  readonly statuts: readonly StatutDon[]
  readonly q: string
}

export const FILTRES_DONS_VIDES: FiltresDons = {
  effets: [],
  effetsExclus: [],
  effetsObliges: [],
  effets2: [],
  effets2Exclus: [],
  effets2Obliges: [],
  cibles: [],
  ciblesExclues: [],
  ciblesObligees: [],
  contextes: [],
  contextesExclus: [],
  contextesObliges: [],
  activations: [],
  activationsExclues: [],
  activationsObligees: [],
  polyvalences: [],
  polyvalencesExclues: [],
  polyvalencesObligees: [],
  categories: [],
  categoriesExclues: [],
  categoriesObligees: [],
  coutMax: null,
  statuts: [],
  q: '',
}

interface SelectionFacette {
  readonly inclus: readonly string[]
  readonly exclus: readonly string[]
  readonly obliges: readonly string[]
}

function selectionFacette(filtres: FiltresDons, facette: FacetteDon): SelectionFacette {
  switch (facette) {
    case 'effet':
      return { inclus: filtres.effets, exclus: filtres.effetsExclus, obliges: filtres.effetsObliges }
    case 'effet2':
      return {
        inclus: filtres.effets2,
        exclus: filtres.effets2Exclus,
        obliges: filtres.effets2Obliges,
      }
    case 'cible':
      return { inclus: filtres.cibles, exclus: filtres.ciblesExclues, obliges: filtres.ciblesObligees }
    case 'contexte':
      return {
        inclus: filtres.contextes,
        exclus: filtres.contextesExclus,
        obliges: filtres.contextesObliges,
      }
    case 'activation':
      return {
        inclus: filtres.activations,
        exclus: filtres.activationsExclues,
        obliges: filtres.activationsObligees,
      }
    case 'polyvalence':
      return {
        inclus: filtres.polyvalences,
        exclus: filtres.polyvalencesExclues,
        obliges: filtres.polyvalencesObligees,
      }
    case 'categorie':
      return {
        inclus: filtres.categories,
        exclus: filtres.categoriesExclues,
        obliges: filtres.categoriesObligees,
      }
  }
}

/** Clear one facet's three-state selection, keeping the rest — used by
 * `compterOptions` to apply every OTHER facet before counting this one's
 * options, so a count always predicts exactly what clicking it would do. */
function sansFacetteDon(filtres: FiltresDons, facette: FacetteDon): FiltresDons {
  switch (facette) {
    case 'effet':
      return { ...filtres, effets: [], effetsExclus: [], effetsObliges: [] }
    case 'effet2':
      return { ...filtres, effets2: [], effets2Exclus: [], effets2Obliges: [] }
    case 'cible':
      return { ...filtres, cibles: [], ciblesExclues: [], ciblesObligees: [] }
    case 'contexte':
      return { ...filtres, contextes: [], contextesExclus: [], contextesObliges: [] }
    case 'activation':
      return { ...filtres, activations: [], activationsExclues: [], activationsObligees: [] }
    case 'polyvalence':
      return { ...filtres, polyvalences: [], polyvalencesExclues: [], polyvalencesObligees: [] }
    case 'categorie':
      return { ...filtres, categories: [], categoriesExclues: [], categoriesObligees: [] }
  }
}

function correspondFacette(entree: EntreeDon, filtres: FiltresDons, facette: FacetteDon): boolean {
  const valeurs = champFacette(entree, facette)
  const { inclus, exclus, obliges } = selectionFacette(filtres, facette)
  if (exclus.some((v) => valeurs.includes(v))) return false
  if (obliges.length > 0 && !obliges.every((v) => valeurs.includes(v))) return false
  if (inclus.length > 0 && !inclus.some((v) => valeurs.includes(v))) return false
  return true
}

function retenirDon(entree: EntreeDon, filtres: FiltresDons): boolean {
  for (const facette of FACETTES_DONS) {
    if (!correspondFacette(entree, filtres, facette)) return false
  }
  if (filtres.coutMax !== null && (entree.cout === null || entree.cout > filtres.coutMax)) {
    return false
  }
  if (filtres.statuts.length > 0 && !filtres.statuts.includes(entree.statut)) return false
  const q = filtres.q.trim().toLowerCase()
  if (q !== '' && !entree.texte.toLowerCase().includes(q)) return false
  return true
}

/** Keep the dons matching `filtres`, in the order they came in. */
export function filtrerDons(entrees: readonly EntreeDon[], filtres: FiltresDons): EntreeDon[] {
  return entrees.filter((entree) => retenirDon(entree, filtres))
}

/**
 * Count, for every value a don carries under `saufFacette`, how many dons would
 * remain if that value were also selected — applying every OTHER facet exactly
 * as it stands, never `saufFacette`'s own current selection.
 *
 * This is the invariant the source repository's `web/test_explorateur.js`
 * guards and the one this step's tests must prove directly: a zero count is
 * never returned (the option is simply absent from the map), and
 * `compterOptions(...).get(v)` must equal the length of `filtrerDons` after
 * adding `v` to `saufFacette`'s OR selection.
 */
export function compterOptions(
  entrees: readonly EntreeDon[],
  filtres: FiltresDons,
  saufFacette: FacetteDon,
): Map<string, number> {
  const retenues = filtrerDons(entrees, sansFacetteDon(filtres, saufFacette))
  const compte = new Map<string, number>()
  for (const entree of retenues) {
    for (const valeur of champFacette(entree, saufFacette)) {
      compte.set(valeur, (compte.get(valeur) ?? 0) + 1)
    }
  }
  return compte
}
