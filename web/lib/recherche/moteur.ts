/**
 * The client search engine: an in-memory index over the thin web index, plus the
 * English alias table.
 *
 * Deliberately free of any React import. A search that can only be exercised by
 * mounting a component is a search that gets tested by clicking, and the bugs
 * that matter here — an accent that stops matching, an alias that resolves to the
 * wrong spell — are exactly the ones clicking around does not find. Everything
 * below is a pure function of its inputs.
 *
 * What this index does NOT carry is descriptions (B1): the thin index is sized to
 * be downloaded by every visitor. Full-text search, if it is ever wanted, is a
 * second index loaded on demand — not a fatter first one.
 */

import MiniSearch, { type SearchResult } from 'minisearch'

import type { EntreeSort, IndexWeb } from '@/lib/donnees/index-web'

import { plier } from './pliage'

/**
 * A very small French stopword list.
 *
 * Short on purpose. These words carry no discriminating power in a corpus where
 * a third of the names are "<noun> de <noun>", and dropping them keeps "detection
 * de la magie" from scoring on "de". It stays short because every word removed is
 * a word a user can no longer search for: `mort` or `feu` would be catastrophic,
 * and even `en` is arguable. MiniSearch applies `processTerm` to both the index
 * and the query, so the two sides drop the same words — that symmetry is what
 * makes the list safe at all.
 */
const MOTS_VIDES: ReadonlySet<string> = new Set([
  'de',
  'la',
  'le',
  'les',
  'des',
  'du',
  'un',
  'une',
  'et',
  'en',
])

/** How a result was reached. The interface says so: someone who typed
 * "magic missile" should see that it was understood as an English name. */
export type Via = 'alias' | 'nom'

export interface Resultat {
  readonly i: number
  readonly id: string
  readonly s: string
  readonly n: string
  readonly score: number
  readonly via: Via
}

export interface TableAlias {
  readonly version: number
  readonly alias: Readonly<Record<string, readonly string[]>>
}

/** The limit is a display limit, not a correctness one: nobody scans past 50
 * rows, and building more result objects than that is work thrown away. */
export const LIMITE_DEFAUT = 50

/** Prefix matching on, fuzziness low. The dominant case is someone typing the
 * first letters of a name they know, not someone misspelling it; a generous
 * fuzziness drowns the exact name under its neighbours. */
const OPTIONS_RECHERCHE = {
  prefix: true,
  fuzzy: 0.15,
  boost: { nf: 6, n: 6 },
} as const

/**
 * Fold a term, dropping stopwords.
 *
 * Used for the index and for the query — the same function, not two that agree
 * today. Returning null tells MiniSearch to drop the term.
 */
function traiterTerme(terme: string): string | null {
  const plie = plier(terme)
  if (plie === '' || MOTS_VIDES.has(plie)) return null
  return plie
}

export interface Moteur {
  /**
   * Search by folded name, then by English alias.
   *
   * Returns `null` for an empty query — "no search happened", which the caller
   * renders as the full list — and `[]` for a query that matched nothing, which
   * is an empty state. Collapsing the two would make the browse view flash the
   * whole corpus every time someone clears the box mid-word.
   */
  chercher(requete: string, limite?: number): Resultat[] | null
  /** Exposed for the performance test and for debugging; not for rendering. */
  readonly taille: number
}

export function construireMoteur(index: IndexWeb, table?: TableAlias | null): Moteur {
  const mini = new MiniSearch<EntreeSort>({
    idField: 'id',
    fields: ['nf', 'n'],
    storeFields: ['i', 'id', 's', 'n'],
    processTerm: traiterTerme,
    searchOptions: OPTIONS_RECHERCHE,
  })
  mini.addAll(index.sorts as EntreeSort[])

  const parId = new Map(index.sorts.map((sort) => [sort.id, sort]))
  const alias = table?.alias ?? {}

  function chercher(requete: string, limite: number = LIMITE_DEFAUT): Resultat[] | null {
    const q = plier(requete)
    if (q === '') return null

    const vus = new Set<string>()
    const resultats: Resultat[] = []

    // Aliases go first, always. Someone who types "magic missile" knows what
    // they are looking for; ranking a fuzzy French match above it would be the
    // engine second-guessing an exact statement of intent. An ambiguous alias
    // yields several results and none of them is elected — see `alias.json`.
    for (const id of alias[q] ?? []) {
      const sort = parId.get(id)
      // A dangling id means alias.json and index.json were built from different
      // corpora. Skipping is right at runtime; the Python builder refuses such a
      // line outright, which is where that gets caught.
      if (sort === undefined || vus.has(id)) continue
      vus.add(id)
      resultats.push({ i: sort.i, id: sort.id, s: sort.s, n: sort.n, score: Infinity, via: 'alias' })
    }

    for (const trouve of mini.search(q) as (SearchResult & Partial<EntreeSort>)[]) {
      if (resultats.length >= limite) break
      const id = String(trouve.id)
      if (vus.has(id)) continue
      const sort = parId.get(id)
      if (sort === undefined) continue
      vus.add(id)
      resultats.push({
        i: sort.i,
        id: sort.id,
        s: sort.s,
        n: sort.n,
        score: trouve.score,
        via: 'nom',
      })
    }

    return resultats.slice(0, limite)
  }

  return { chercher, taille: index.sorts.length }
}
