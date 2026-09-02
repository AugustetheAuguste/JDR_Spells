/**
 * The types of the dons web index, and the pure code-resolution helpers.
 *
 * Mirrors `index-web.ts` (spells): fields are one or two letters, coded against
 * head tables (`effets_principaux`, `cibles_bonus`, …), because the index is
 * downloaded by every visitor and the integer coding is what holds the size
 * budget for 1417 entries. See `Data/schemas/web_index_dons.schema.json` (Python
 * repo) for the frozen contract this mirrors.
 *
 * This module carries types and pure helpers ONLY — no `node:fs` — so a client
 * component can import it for its types without pulling a filesystem read into
 * the browser bundle. Reading the file off disk lives in `lire-index-dons.ts`.
 */

export interface EntreeDon {
  /** Dense index, 0..n-1. Short identifier used by the views. */
  readonly i: number
  readonly id: string
  /** The slug, which IS the public URL. */
  readonly s: string
  /** Display name, accented verbatim, repeatable-feat asterisk included. */
  readonly n: string
  /** Folded name: the search key. Must equal `plier(n)`. */
  readonly nf: string
  /** Repeatable: the CSV name ends with `*`. */
  readonly r: boolean
  /** `effet_principal` code, indexing into `effets_principaux`. */
  readonly ep: number | null
  /** `effets_secondaires` codes, indexing into `effets_principaux` (same
   * vocabulary as `ep`). */
  readonly es: readonly number[]
  /** `cible_du_bonus` codes, indexing into `cibles_bonus`. */
  readonly cb: readonly number[]
  /** `contexte` codes, indexing into `contextes`. */
  readonly cx: readonly number[]
  /** `activation` code, indexing into `activations`. */
  readonly ac: number | null
  /** `polyvalence` code, indexing into `polyvalences`. Deliberately never
   * surfaced prominently in the sheet: `conditionnel` for 61 % of the catalogue
   * makes it a weak facet (measured, `OUTPUT_taxonomie_semantique.md`). */
  readonly pv: number | null
  /** `categorie_officielle` codes, indexing into `categories`. A don can carry
   * more than one. */
  readonly cat: readonly number[]
  /** `Src` column code, indexing into `sources`. */
  readonly src: number | null
  /** `valeur_bonus`, free-text string, never coded (too varied to table). */
  readonly vb: string | null
  /** `resume_court`, free-text string from the LLM layer. */
  readonly rc: string | null
  /** `mots_cles`, free text, never coded — long tail, not repetitive enough to
   * pay for a table. */
  readonly mc: readonly string[]
}

export interface IndexDons {
  readonly version: number
  readonly genere_le: string
  readonly effets_principaux: readonly string[]
  readonly cibles_bonus: readonly string[]
  readonly contextes: readonly string[]
  readonly activations: readonly string[]
  readonly polyvalences: readonly string[]
  readonly categories: readonly string[]
  readonly sources: readonly string[]
  readonly dons: readonly EntreeDon[]
}

/** Taxonomy keys are machine slugs (`prerequis_assoupli`); the closed lists ship
 * no display labels, so the slug is unfolded rather than dressed up with a
 * mapping this module would have to keep in step — same convention as
 * `CoucheEnrichissement.tsx`'s `lisible()`. */
export function lisible(cle: string): string {
  return cle.replace(/_/g, ' ')
}

/** Resolve a single code against a head table. `null` on a missing code or an
 * out-of-range one: a wrong label is worse than an absent facette, because it
 * looks like data. The contract checker (`check_data_contract_dons.ts`) fails on
 * an out-of-range code before it ever reaches here. */
function resoudre(table: readonly string[], code: number | null): string | null {
  if (code === null) return null
  const valeur = table[code]
  return valeur === undefined ? null : valeur
}

/** Resolve a list of codes against a head table, dropping any that fail to
 * resolve rather than throwing — the sheet degrades a bad code to "absent",
 * never to a crash. */
function resoudreListe(table: readonly string[], codes: readonly number[]): readonly string[] {
  return codes
    .map((code) => resoudre(table, code))
    .filter((valeur): valeur is string => valeur !== null)
}

export function effetPrincipalDe(index: IndexDons, don: EntreeDon): string | null {
  const valeur = resoudre(index.effets_principaux, don.ep)
  return valeur === null ? null : lisible(valeur)
}

export function effetsSecondairesDe(index: IndexDons, don: EntreeDon): readonly string[] {
  return resoudreListe(index.effets_principaux, don.es).map(lisible)
}

export function ciblesBonusDe(index: IndexDons, don: EntreeDon): readonly string[] {
  return resoudreListe(index.cibles_bonus, don.cb).map(lisible)
}

export function contextesDe(index: IndexDons, don: EntreeDon): readonly string[] {
  return resoudreListe(index.contextes, don.cx).map(lisible)
}

export function activationDe(index: IndexDons, don: EntreeDon): string | null {
  const valeur = resoudre(index.activations, don.ac)
  return valeur === null ? null : lisible(valeur)
}

export function categoriesDe(index: IndexDons, don: EntreeDon): readonly string[] {
  return resoudreListe(index.categories, don.cat).map(lisible)
}

export function sourceDe(index: IndexDons, don: EntreeDon): string | null {
  return resoudre(index.sources, don.src)
}

/** Find one don's index entry by slug, or `null`. Linear scan: the index is
 * loaded once per static-build invocation of the page, never client-side. */
export function trouverDon(index: IndexDons, slug: string): EntreeDon | null {
  return index.dons.find((don) => don.s === slug) ?? null
}
