/**
 * Bridge from `public/data/dons/moteur.json`'s precomputed graph fields
 * (`aretes`, `prerequis_dons`, `levier_catalogue`) to the `CatalogueDons`
 * shape `graphe.ts`'s `construireGraphe`/`calculerCouts` operate on.
 *
 * Those three fields are already keyed by SLUG (`a-terre-a-cheval`, not
 * `À terre à cheval*`) and already encode every feat-name prerequisite the
 * step-06 parser found — `aretes` is the flat edge list (`de` unlocks
 * `vers`), `prerequis_dons` singles out the handful of entries where two or
 * more of those edges are ALTERNATIVES (an OR-group) rather than all
 * required. Synthesizing a `DonConditions` per slug here — instead of
 * hand-rolling a second edge-walking algorithm in `VueArbre` — means the
 * tree view calls the SAME `construireGraphe`/`calculerCouts` the rest of
 * the engine does, with the same invariants already proved by
 * `graphe.test.ts`.
 */

import { calculerCouts } from './graphe'
import type { CatalogueDons } from './moteur.js'
import type { DonConditions, Exigence, ExigenceOuGroupe } from './types.js'

export interface AreteMoteur {
  readonly de: string
  readonly vers: string
}

/** The subset of `moteur.json` this module reads. Slug-keyed throughout. */
export interface DonneesGrapheMoteur {
  readonly aretes: readonly AreteMoteur[]
  readonly prerequis_dons: Readonly<Record<string, readonly (readonly string[])[]>>
  readonly levier_catalogue: Readonly<Record<string, number>>
}

function exigenceDeSlug(slug: string): Exigence {
  return { type: 'feat', charge: { feat_name: slug }, verif_manuelle: false, segment: slug }
}

/**
 * One synthetic `DonConditions` per slug, keyed by slug (not by display
 * name — the graph derivations never read anything but `.exigences`, so a
 * name/slug mismatch here would be invisible until a component tried to
 * print a label, which is `VueArbre`'s job, not this module's).
 */
export function catalogueDepuisMoteur(donnees: DonneesGrapheMoteur): CatalogueDons {
  const parentsDe = new Map<string, string[]>()
  for (const { de, vers } of donnees.aretes) {
    const liste = parentsDe.get(vers)
    if (liste === undefined) parentsDe.set(vers, [de])
    else liste.push(de)
  }

  const catalogue = new Map<string, DonConditions>()
  for (const slug of Object.keys(donnees.levier_catalogue)) {
    const groupesOu = donnees.prerequis_dons[slug] ?? []
    const couverts = new Set(groupesOu.flat())
    const exigences: ExigenceOuGroupe[] = groupesOu.map((options) => ({
      options: options.map(exigenceDeSlug),
    }))
    for (const parent of parentsDe.get(slug) ?? []) {
      if (!couverts.has(parent)) exigences.push(exigenceDeSlug(parent))
    }
    catalogue.set(slug, { brut: '', effectif: '', exigences })
  }
  return catalogue
}

/**
 * Structural cost (slots to unlock, prerequisites included) over the WHOLE
 * catalogue, with no character and no gating — every slug is treated as
 * reachable, so the only thing `calculerCouts` measures here is the shape
 * of the feat-prerequisite graph itself. This is deliberately NOT the same
 * `cout` a character-bound view would show (step 16): without a character
 * there is no "vague" to be a lower bound of, only the graph's structure.
 */
export function couterCatalogue(catalogue: CatalogueDons): ReadonlyMap<string, number> {
  const vagueDe = new Map<string, number>()
  for (const slug of catalogue.keys()) vagueDe.set(slug, 1)
  return calculerCouts(catalogue, vagueDe, new Set())
}
