/**
 * The prerequisite-tree view's own derived data — everything `VueArbre.tsx`
 * needs that is NOT Cytoscape/React: which nodes are isolated, which "voie"
 * (hub family) each retained don belongs to, and each node's `cout` /
 * `levier` / `levierCatalogue` / `debloque`.
 *
 * Kept apart from the component so the invariant this whole step exists to
 * fix — see `15_UI_GRAPH.md`'s "le bug d'origine" — is provable with plain
 * data assertions, no DOM, no Cytoscape.
 */

import { calculerLeviers, calculerVoies, construireGraphe } from './graphe'
import { couterCatalogue } from './graphe-catalogue'
import type { CatalogueDons } from './moteur.js'

/** Below this many members a "voie" is collapsed by default — the source
 * repository's `VOIE_MINIMALE`. */
export const VOIE_MINIMALE = 3

/** Below this zoom level node labels stop being legible and are hidden. */
export const ZOOM_LISIBLE = 0.8

export interface NoeudArbre {
  readonly id: string
  /** Structural cost (slots, prerequisites included) over the whole
   * catalogue — see `graphe-catalogue.ts::couterCatalogue`'s doc for why this
   * is not gated by any character. */
  readonly cout: number | null
  /** Transitive unlock count, computed on the VIEW's own graph. */
  readonly levier: number
  /** The same count, computed on the FULL catalogue's graph. Only ever
   * shown as a number next to `levier`, NAMED as the catalogue-wide figure —
   * never substituted for `levier`. */
  readonly levierCatalogue: number
  /** Direct children in the view's graph — the list the detail panel shows
   * to back up whatever count it announces. */
  readonly debloque: readonly string[]
  /** The hub this don's voie descends from, or `null` if it has neither
   * ancestors nor descendants in the view (i.e. it is isolated). */
  readonly voie: string | null
}

export interface VueArbreDonnees {
  readonly noeuds: ReadonlyMap<string, NoeudArbre>
  /** The view's own edge map — what `VueArbre` actually draws. */
  readonly enfantsVue: ReadonlyMap<string, ReadonlySet<string>>
  /** Retained dons with no edge at all in the view's graph — excluded from
   * the drawing, listed in the banner instead. */
  readonly isoles: readonly string[]
  /** Hub -> member ids, sorted by member count descending — `VOIE_MINIMALE`
   * is a rendering decision (`VueArbre` collapses these), not filtered out
   * here. */
  readonly voies: ReadonlyMap<string, readonly string[]>
}

/**
 * Build the tree view's data for one `retenus` (the current filtered view).
 *
 * `construireGraphe` is called TWICE — once on the whole `catalogue`, once
 * on `retenus` — and this is NOT a duplicate call to be "optimised" away.
 * That was the source repository's actual bug: `levier` (and the hub a don's
 * "voie" was named after) were computed on the 1417-feat catalogue and then
 * shown next to a graph drawing only the reachable subset, so 94 nodes
 * announced leverage the view could not show, 13 nodes had no edge to
 * justify a positive leverage figure, and 2 voies were named after a feat
 * absent from the view. Computing `levier` and `voie` from `grapheVue`
 * (never from `grapheCatalogue`) and keeping `levierCatalogue` as an
 * explicitly separate, explicitly named field is the fix — collapsing this
 * back to one call reintroduces the exact defect `graphe-vue.test.ts`'s
 * "94/13/2 → 0/0/0" cases exist to catch.
 */
export function construireVueArbre(
  catalogue: CatalogueDons,
  retenus: ReadonlySet<string>,
): VueArbreDonnees {
  const grapheCatalogue = construireGraphe(catalogue) // 1er appel : le catalogue entier
  const grapheVue = construireGraphe(catalogue, retenus) // 2e appel : la vue restreinte

  const leviersCatalogue = calculerLeviers(new Set(catalogue.keys()), grapheCatalogue.enfants)
  const leviersVue = calculerLeviers(retenus, grapheVue.enfants)
  const voieDe = calculerVoies(retenus, leviersVue, grapheVue.parents)
  const couts = couterCatalogue(catalogue)

  const noeuds = new Map<string, NoeudArbre>()
  const isoles: string[] = []
  for (const id of retenus) {
    const enfants = grapheVue.enfants.get(id)
    const parents = grapheVue.parents.get(id)
    const sansArete = (enfants === undefined || enfants.size === 0) && (parents === undefined || parents.size === 0)
    if (sansArete) isoles.push(id)
    noeuds.set(id, {
      id,
      cout: couts.get(id) ?? null,
      levier: leviersVue.get(id) ?? 0,
      levierCatalogue: leviersCatalogue.get(id) ?? 0,
      debloque: [...(enfants ?? [])].sort((a, b) => a.localeCompare(b)),
      voie: voieDe.get(id) ?? null,
    })
  }

  const membresParHub = new Map<string, string[]>()
  for (const [id, hub] of voieDe) {
    const liste = membresParHub.get(hub)
    if (liste === undefined) membresParHub.set(hub, [id])
    else liste.push(id)
  }
  const voies = new Map(
    [...membresParHub.entries()].sort(([, a], [, b]) => b.length - a.length),
  )

  return { noeuds, enfantsVue: grapheVue.enfants, isoles: isoles.sort((a, b) => a.localeCompare(b)), voies }
}

/** Pure zoom threshold, kept separate from Cytoscape's own zoom event so it
 * is testable without a canvas. */
export function labelLisibleAuZoom(zoom: number): boolean {
  return zoom >= ZOOM_LISIBLE
}
