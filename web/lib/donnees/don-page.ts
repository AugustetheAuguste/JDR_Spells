/**
 * The per-don props: the shape of `public/data/dons/<slug>.json`.
 *
 * The index (`index-web-dons.ts`) carries everything codeable — the semantic
 * facets, coded against head tables. This file carries what is NOT codeable:
 * verbatim free text, read once per sheet rather than downloaded by every
 * visitor. `05_WEB_INDEX_CONTRACT`'s own note says as much: "les libellés
 * verbatim et non normalisés vivent dans les props par entité".
 *
 * The two fields this whole step exists for are `raw_conditions` and
 * `conditions_ajoutees`, and they are deliberately two separate fields, never
 * concatenated here or anywhere upstream:
 *
 * - `raw_conditions` is the CSV `Conditions` column, verbatim. It is what an
 *   audit cites as source of truth, and `null` for the (rare) don with no
 *   prerequisite at all — e.g. "Endurance" — rather than an empty string, so a
 *   reader can tell "no conditions" apart from "not scraped".
 * - `conditions_ajoutees` is the hand-curated supplement from
 *   `Data/dons/feat_prereq_supplements.json`: prerequisites read off the don's
 *   detail page that the CSV's `Conditions` column omits (47 dons, 68
 *   fragments). `null` for the other 1370 — including the 39 the curation
 *   pass explicitly excluded (`self_reference`, `proficiency`,
 *   `prose_permissive`, `variante_de_source`…): merging those into
 *   `raw_conditions` would fabricate a condition the CSV never stated, and for
 *   `variante_de_source` specifically the page text *contradicts* the CSV
 *   ("homme-lézard" vs "homme-serpent"), so summing the two would produce an
 *   impossible, universally-`ineligible` condition.
 *
 * Reading lives here too, and like `sort-page.ts` this module must never be
 * imported by a client component.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface PropsDon {
  readonly id: string
  /** Display name, accented verbatim, repeatable-feat asterisk included. Never
   * normalised — the asterisk is part of the name, not of the slug. */
  readonly nom: string
  readonly slug: string
  /** The CSV name ends with `*`. Mirrors `EntreeDon.r`, carried again here so
   * this module's type is self-contained for a component that only imports
   * props (not the index). */
  readonly repetable: boolean
  /** The `Src` column, resolved to its verbatim label. `null` when the CSV
   * gives none. */
  readonly source: string | null
  /** CSV `Conditions`, verbatim. `null` for a don with no prerequisite at all
   * (e.g. "Endurance") — distinct from an empty string, which would claim the
   * source stated an empty value. */
  readonly raw_conditions: string | null
  /** Hand-curated supplement, `Data/dons/feat_prereq_supplements.json`. `null`
   * for the 1370 dons the curation pass did not augment — including the 39 it
   * explicitly excluded. Never merged into `raw_conditions` (see module doc). */
  readonly conditions_ajoutees: string | null
  /** CSV `Avantages`, verbatim (after `repair_benefits`, Python side). `null`
   * only for a row a future export could not repair — in practice the catalogue
   * carries one for every don, but the type stays optional rather than assert
   * a guarantee this module cannot itself enforce. */
  readonly avantages: string | null
  /** The wiki page's "Spécial" section, when it has one. */
  readonly special: string | null
  /** The wiki page's "Normal" section, when it has one. */
  readonly normal: string | null
  /** Absolute link to the don's page on pathfinder-fr.org. `null` when the don
   * has no scraped detail page (`feat_links.json` does not cover the whole
   * catalogue). */
  readonly url_source: string | null
}

/** The real export — once step 08 (exporter) lands on this branch. */
export const DOSSIER_DONS_REEL = join(process.cwd(), 'public', 'data', 'dons')

/** The hand-written fixture props, one file per fixture don, used until then
 * and by every test. */
export const DOSSIER_DONS_FIXTURE = join(process.cwd(), 'fixtures', 'dons')

/** Same real-else-fixture choice as `lire-index-dons.ts`, and for the same
 * reason: this route is developed ahead of its own data producer. */
export function dossierDonsActif(): string {
  return existsSync(DOSSIER_DONS_REEL) ? DOSSIER_DONS_REEL : DOSSIER_DONS_FIXTURE
}

/**
 * Read one don's props, or `null` if the file is absent.
 *
 * `null` rather than a throw, so the page can answer `notFound()`. A slug that
 * is in the index but has no props file is a different failure — a broken
 * export — and would need its own contract check, symmetrical to
 * `verifier-props.test.ts` on the spells side; not built here since the real
 * export does not exist yet on this branch.
 */
export function lirePropsDon(slug: string, dossier: string = dossierDonsActif()): PropsDon | null {
  try {
    return JSON.parse(readFileSync(join(dossier, `${slug}.json`), 'utf8')) as PropsDon
  } catch {
    return null
  }
}
