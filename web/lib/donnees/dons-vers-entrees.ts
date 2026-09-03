/**
 * Bridge from the downloaded dons web index (`IndexDons`, coded, one or two
 * letters per field) to the filtering domain's `EntreeDon`
 * (`lib/recherche/filtres.ts`, plain names).
 *
 * Kept as its own tiny module, on the exact model `versFiltres` follows for
 * spells in `etat-url.ts`: names live in the filter/URL layer, codes live in
 * the index, and this is the one place they meet. Facet values are read as the
 * index's RAW slugs (`bonus_chiffre`, not "bonus chiffre") — `lisible()` in
 * `index-web-dons.ts` only dresses a slug up for on-screen display, and using
 * its spaced form here would silently break every match against the URL's
 * vocabulary, which is validated against these same raw slugs.
 *
 * `cout` and `statut` are always `null`/absent-shaped here: neither the graph
 * cost (step 15) nor a character's eligibility verdict (step 16) has landed on
 * this branch, so this view never claims either. `statut` still needs a
 * concrete `StatutDon` to satisfy `EntreeDon`'s type — `'manual_check'` is used
 * as the placeholder, but it is never read: `VueDons` neither renders a status
 * column nor offers a status filter without a character, exactly as the plan
 * requires ("la colonne est absente, pas remplie de manual_check" — the same
 * rule, one level up, for the column this module never populates from real data
 * in the first place).
 */

import type { EntreeDon, IndexDons } from '@/lib/donnees/index-web-dons'
import type { EntreeDon as EntreeDonFiltre } from '@/lib/recherche/filtres'

function resoudre(table: readonly string[], code: number | null): string | null {
  if (code === null) return null
  return table[code] ?? null
}

function resoudreListe(table: readonly string[], codes: readonly number[]): readonly string[] {
  return codes.map((code) => table[code]).filter((v): v is string => v !== undefined)
}

/** One don's searchable free text: name plus its short summary and keywords —
 * enough for `dons_q` to find a feat by what it does, not only by its title. */
function texteDe(don: EntreeDon): string {
  return [don.n, don.rc ?? '', ...don.mc].join(' ')
}

export function versEntreeFiltre(index: IndexDons, don: EntreeDon): EntreeDonFiltre {
  return {
    id: don.id,
    effet: resoudre(index.effets_principaux, don.ep),
    effets2: resoudreListe(index.effets_principaux, don.es),
    cibles: resoudreListe(index.cibles_bonus, don.cb),
    contextes: resoudreListe(index.contextes, don.cx),
    activation: resoudre(index.activations, don.ac),
    polyvalence: resoudre(index.polyvalences, don.pv),
    categories: resoudreListe(index.categories, don.cat),
    // Neither computed here — see this module's doc comment.
    cout: null,
    statut: 'manual_check',
    texte: texteDe(don),
  }
}

export function versEntreesFiltre(index: IndexDons): readonly EntreeDonFiltre[] {
  return index.dons.map((don) => versEntreeFiltre(index, don))
}
