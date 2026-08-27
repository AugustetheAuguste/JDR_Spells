/**
 * The types of the web index, and how it is read.
 *
 * These mirror `schemas/web_index.schema.json` — the schema is the contract, this
 * is its TypeScript face. Fields are one or two letters because the index is
 * downloaded by every visitor and the integer coding is what holds the size
 * budget; `EntreeSort` documents each so nobody has to guess.
 *
 * This module carries the types and the pure code-resolution helpers ONLY, so
 * that a client component can import it. Reading the file lives in
 * `lire-index.ts`: `node:fs` in this module put `node:fs` in the browser bundle
 * and the build failed outright — which is the good outcome, but the split is
 * what makes the boundary explicit rather than incidental.
 */

import { ECOLES, type Ecole } from '@/lib/design/tokens'

export interface EntreeSort {
  /** Dense index, 0..n-1. Short identifier used by the views. */
  readonly i: number
  readonly id: string
  /** The slug, which IS the public URL. */
  readonly s: string
  /** Display name, accented verbatim. */
  readonly n: string
  /** Folded name: the search key. Must equal `plier(n)`. */
  readonly nf: string
  /** School code, indexing into `ecoles`. `null` when the source gives none. */
  readonly e: number | null
  /** Level PER CLASS (B4), never a scalar. Class slug → level 0..9. */
  readonly niv: Readonly<Record<string, number>>
  /** Component codes, indexing into `composantes`. */
  readonly c: readonly number[]
  /** Range code, indexing into `portees`. */
  readonly p: number | null
  /** Saving-throw code, indexing into `jets`. */
  readonly j: number | null
  /** Spell resistance. `null` when the source is conditional — the corpus carries
   * values like "non et oui (cf. texte)", and forcing a boolean would assert
   * something the source declines to say. */
  readonly rm: boolean | null
  /** Tag codes from the optional LLM layer. `[]` when the layer is absent. */
  readonly t: readonly number[]
  /** Casting-time code, indexing into `temps_incantation`. `null` when the
   * source gives none. */
  readonly ti: number | null
  /** True when the corpus records a level disagreement for this spell. */
  readonly d: boolean
}

export interface ClasseIndex {
  readonly slug: string
  readonly nom: string
}

export interface IndexWeb {
  readonly version: number
  readonly genere_le: string
  readonly ecoles: readonly string[]
  readonly classes: readonly ClasseIndex[]
  readonly portees: readonly string[]
  readonly jets: readonly string[]
  readonly composantes: readonly string[]
  /** Empty when the enrichment layer was absent at export: the UI then hides the
   * tag filter rather than showing an empty one. */
  readonly tags: readonly string[]
  readonly temps_incantation: readonly string[]
  readonly sorts: readonly EntreeSort[]
}

/**
 * Resolve a school code to a token key.
 *
 * Returns null rather than a default when the code is out of range or names a
 * school the tokens do not know: a wrong pastille is worse than none, because it
 * looks like data. The contract checker fails on such a code, so reaching this
 * branch means the artefact bypassed it.
 */
export function ecoleDe(index: IndexWeb, code: number | null): Ecole | null {
  if (code === null) return null
  const nom = index.ecoles[code]
  if (nom === undefined) return null
  return (ECOLES as readonly string[]).includes(nom) ? (nom as Ecole) : null
}

/** The per-class levels, sorted by class name, ready to render. */
export function niveauxOrdonnes(
  index: IndexWeb,
  sort: EntreeSort,
): readonly { readonly slug: string; readonly nom: string; readonly niveau: number }[] {
  const noms = new Map(index.classes.map((classe) => [classe.slug, classe.nom]))
  return Object.entries(sort.niv)
    .map(([slug, niveau]) => ({ slug, nom: noms.get(slug) ?? slug, niveau }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}
