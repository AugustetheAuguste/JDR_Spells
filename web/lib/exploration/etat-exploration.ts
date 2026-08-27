/**
 * The exploration state, read from and written to the query string.
 *
 * The exploration route poses the same filters as the table route and shares
 * `etat-url.ts` for them, on purpose: a link copied out of one view opens in the
 * other with the same spells showing. `?classe=barde&niveau=2` means one thing on
 * this site, in one place.
 *
 * Three keys are its own:
 *
 *   - `categorie`, the tag family being explored. It is *not* the same as a posed
 *     tag filter: choosing « Esprit » means "any of the mind tags", and choosing
 *     `effet_mental` inside it means that one tag. Two states, two keys, because
 *     folding them into `tags` would make the breadcrumb unable to say which of
 *     the two the reader picked.
 *   - `parcours`, the axes in the order they were drilled. This is the one thing
 *     the filters cannot express: `classe=barde&niveau=2` does not record whether
 *     the level or the class was chosen first, and « remonter d'un cran » has to
 *     know. Without it, zooming out would have to guess.
 *   - `axe`, the slice being shown. Absent means "the next one the parcours
 *     suggests", so a shared link stays short and keeps working when the
 *     suggestion order changes.
 *
 * As in `etat-url.ts`: values are names and never index codes, unknown values are
 * dropped rather than fatal, and the serializer omits empty keys so that
 * `ecrire(lire(s))` reaches a fixed point.
 */

import type { IndexWeb } from '@/lib/donnees/index-web'
import {
  CLES,
  ecrireEtat,
  ETAT_VIDE,
  lireEtat,
  versFiltres,
  type EtatUrl,
} from '@/lib/navigation/etat-url'
import type { Filtres } from '@/lib/recherche/filtres'
import { CLES_AXES, type CleAxe } from '@/lib/exploration/axes'
import { classesChoisies } from '@/lib/exploration/classes-choisies'
import { familleDe } from '@/lib/exploration/familles'

export interface EtatExploration {
  /** The filters, shared verbatim with the table route. `base.classe` is the
   * *primary* class when several are chosen — see `classesSupplementaires`. */
  readonly base: EtatUrl
  /** Extra classes chosen alongside `base.classe`, widening step one from "this
   * class" to "any of these classes" — an OR the table route has no notion of,
   * so it lives only here rather than in `EtatUrl`. */
  readonly classesSupplementaires: readonly string[]
  /** Slug of the tag family being explored, or null. */
  readonly categorie: string | null
  /** The axes drilled, in order. Drives « Remonter d'un cran ». */
  readonly parcours: readonly CleAxe[]
  /** The axis on display, or null for the suggested one. */
  readonly axe: CleAxe | null
}

export const EXPLORATION_VIDE: EtatExploration = {
  base: ETAT_VIDE,
  classesSupplementaires: [],
  categorie: null,
  parcours: [],
  axe: null,
}

/** The keys this module adds. Kept apart from `CLES` so that the table route
 * cannot start emitting them by accident. */
export const CLES_EXPLORATION = {
  classes: 'classes',
  categorie: 'categorie',
  parcours: 'parcours',
  axe: 'axe',
} as const

function lireParcours(valeur: string | null): CleAxe[] {
  if (valeur === null) return []
  const vus: CleAxe[] = []
  for (const brut of valeur.split(',')) {
    const propre = brut.trim().toLowerCase()
    // An axis named twice keeps its first position: the parcours is a path, and a
    // path that visits the same axis twice is a path the interface cannot draw.
    if ((CLES_AXES as readonly string[]).includes(propre) && !vus.includes(propre as CleAxe)) {
      vus.push(propre as CleAxe)
    }
  }
  return vus
}

/** Read the exploration state out of a query string, validated against the index. */
function lireClassesSupplementaires(
  valeur: string | null,
  index: IndexWeb,
  primaire: string | null,
): string[] {
  if (valeur === null) return []
  const vues = new Set<string>()
  for (const brut of valeur.split(',')) {
    const propre = brut.trim().toLowerCase()
    if (propre === primaire) continue
    if (index.classes.some((entree) => entree.slug === propre)) vues.add(propre)
  }
  return [...vues]
}

export function lireExploration(
  parametres: URLSearchParams,
  index: IndexWeb,
): EtatExploration {
  const base = lireEtat(parametres, index)
  const categorieBrute = parametres.get(CLES_EXPLORATION.categorie)?.trim().toLowerCase() ?? null
  const categorie = familleDe(index, categorieBrute) === null ? null : categorieBrute
  const axeBrut = parametres.get(CLES_EXPLORATION.axe)?.trim().toLowerCase() ?? ''
  return {
    base,
    // Extra classes mean nothing without a primary one: `?classes=…` alone,
    // with no `?classe=`, is dropped rather than promoting the first extra to
    // primary — that would make the URL's own field order silently significant.
    classesSupplementaires:
      base.classe === null
        ? []
        : lireClassesSupplementaires(parametres.get(CLES_EXPLORATION.classes), index, base.classe),
    categorie,
    parcours: lireParcours(parametres.get(CLES_EXPLORATION.parcours)),
    axe: (CLES_AXES as readonly string[]).includes(axeBrut) ? (axeBrut as CleAxe) : null,
  }
}

/** Serialize back to a query string. Filter keys first, in `CLES` order. */
export function ecrireExploration(etat: EtatExploration): URLSearchParams {
  const parametres = ecrireEtat(etat.base)
  if (etat.base.classe !== null && etat.classesSupplementaires.length > 0) {
    parametres.set(CLES_EXPLORATION.classes, etat.classesSupplementaires.join(','))
  }
  if (etat.categorie !== null) parametres.set(CLES_EXPLORATION.categorie, etat.categorie)
  if (etat.parcours.length > 0) {
    parametres.set(CLES_EXPLORATION.parcours, etat.parcours.join(','))
  }
  if (etat.axe !== null) parametres.set(CLES_EXPLORATION.axe, etat.axe)
  return parametres
}

/** The query string, `?` included, or `''` for the bare route. */
export function versQueryExploration(etat: EtatExploration): string {
  const rendu = ecrireExploration(etat).toString()
  return rendu === '' ? '' : `?${rendu}`
}

/**
 * The filters this state means, codes resolved against the index.
 *
 * The one thing added to `versFiltres` is the family: with a family chosen and no
 * individual tag posed, the filter is "carries any tag of the family". Once a tag
 * *is* posed the family adds nothing — a spell carrying the tag necessarily
 * carries one of the family's tags — so the tag alone is used, and the family
 * stays in the URL only to keep the breadcrumb able to say where the reader is.
 */
export function versFiltresExploration(etat: EtatExploration, index: IndexWeb): Filtres {
  const filtres = versFiltres(etat.base, index)
  // Several classes: a spell matches if AT LEAST ONE of them grants it (and, if
  // a level is posed, grants it at one of the chosen levels) — the OR the
  // recommended widening asks for. `classes` on `Filtres` takes over from the
  // singular `classe` at that point; `versFiltres` already set `classe` too,
  // but `appliquerFiltres` prefers `classes` when it is non-empty.
  const avecClasses =
    etat.classesSupplementaires.length > 0 && etat.base.classe !== null
      ? { ...filtres, classes: classesChoisies(etat) }
      : filtres
  if (etat.base.tags.length > 0) return avecClasses
  const famille = familleDe(index, etat.categorie)
  if (famille === null) return avecClasses
  return {
    ...avecClasses,
    tags: famille.tags.map((tag) => index.tags.indexOf(tag)).filter((code) => code >= 0),
  }
}

/** The query string of the equivalent table view — the « voir en tableau » link.
 * The family is expanded into its tags there, because the table route has no
 * notion of a family and would otherwise show a wider list than the chart did. */
export function versQueryTableau(etat: EtatExploration, index: IndexWeb): string {
  const famille = familleDe(index, etat.categorie)
  const base: EtatUrl =
    famille === null || etat.base.tags.length > 0
      ? etat.base
      : { ...etat.base, tags: index.tags.filter((tag) => famille.tags.includes(tag)) }
  const rendu = ecrireEtat(base).toString()
  return rendu === '' ? '' : `?${rendu}`
}

/** True when any criterion at all is posed. */
export function explorationActive(etat: EtatExploration): boolean {
  return ecrireExploration(etat).toString() !== ''
}

/** The keys of `CLES` that the exploration route can pose, for prose about them. */
export type CleFiltre = keyof typeof CLES
