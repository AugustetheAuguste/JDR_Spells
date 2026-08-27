/**
 * The exploration state, read from and written to the query string.
 *
 * The exploration route poses the same filters as the table route and shares
 * `etat-url.ts` for them, on purpose: a link copied out of one view opens in the
 * other with the same spells showing. `?classe=barde&niveau=2` means one thing on
 * this site, in one place — tags included, posed straight on `base.tags` /
 * `base.tagsExclus` / `base.tagsObliges` by the standing `FiltreTags` panel
 * (`axes.ts` § tags, decided 2026-08-27).
 *
 * Two keys are its own:
 *
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
  versQueryString,
  type EtatUrl,
} from '@/lib/navigation/etat-url'
import type { Filtres } from '@/lib/recherche/filtres'
import { CLES_AXES, type CleAxe } from '@/lib/exploration/axes'
import { classesChoisies } from '@/lib/exploration/classes-choisies'

export interface EtatExploration {
  /** The filters, shared verbatim with the table route. `base.classe` is the
   * *primary* class when several are chosen — see `classesSupplementaires`. */
  readonly base: EtatUrl
  /** Extra classes chosen alongside `base.classe`, widening step one from "this
   * class" to "any of these classes" — an OR the table route has no notion of,
   * so it lives only here rather than in `EtatUrl`. */
  readonly classesSupplementaires: readonly string[]
  /** The axes drilled, in order. Drives « Remonter d'un cran ». */
  readonly parcours: readonly CleAxe[]
  /** The axis on display, or null for the suggested one. */
  readonly axe: CleAxe | null
}

export const EXPLORATION_VIDE: EtatExploration = {
  base: ETAT_VIDE,
  classesSupplementaires: [],
  parcours: [],
  axe: null,
}

/** The keys this module adds. Kept apart from `CLES` so that the table route
 * cannot start emitting them by accident. */
export const CLES_EXPLORATION = {
  classes: 'classes',
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
 * Tags need nothing added here any more: they are posed straight on `base.tags` /
 * `base.tagsExclus` / `base.tagsObliges` by `FiltreTags`, so `versFiltres` alone
 * already carries them — same as the table route.
 */
export function versFiltresExploration(etat: EtatExploration, index: IndexWeb): Filtres {
  const filtres = versFiltres(etat.base, index)
  // Several classes: a spell matches if AT LEAST ONE of them grants it (and, if
  // a level is posed, grants it at one of the chosen levels) — the OR the
  // recommended widening asks for. `classes` on `Filtres` takes over from the
  // singular `classe` at that point; `versFiltres` already set `classe` too,
  // but `appliquerFiltres` prefers `classes` when it is non-empty.
  return etat.classesSupplementaires.length > 0 && etat.base.classe !== null
    ? { ...filtres, classes: classesChoisies(etat) }
    : filtres
}

/** The query string of the equivalent table view — the « voir en tableau » link.
 * Just `base`, unchanged: tags already live there, and the parcours/axe keys this
 * route adds are not part of `EtatUrl` in the first place. */
export function versQueryTableau(etat: EtatExploration): string {
  return versQueryString(etat.base)
}

/** True when any criterion at all is posed. */
export function explorationActive(etat: EtatExploration): boolean {
  return ecrireExploration(etat).toString() !== ''
}

/** The keys of `CLES` that the exploration route can pose, for prose about them. */
export type CleFiltre = keyof typeof CLES
