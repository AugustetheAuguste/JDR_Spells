/**
 * Display labels for the range and casting-time facets.
 *
 * Both facets are already folded into families by the exporter
 * (`web_pliage.normaliser_portee`/`normaliser_temps_incantation`); these maps only
 * turn the family's own code into readable French for the filter panel. Neither is
 * a design token — they are filter-facet vocabulary, not colours or type scale, so
 * they live here rather than in `lib/design/tokens.ts`.
 *
 * A code missing from its map falls back to itself, capitalized: the facet still
 * has to render something if the corpus ever grows a family neither map lists yet.
 */

export const LIBELLES_PORTEES: Readonly<Record<string, string>> = {
  contact: 'Contact',
  personnelle: 'Personnelle',
  courte: 'Courte',
  moyenne: 'Moyenne',
  longue: 'Longue',
  autre: 'Autre',
}

export const LIBELLES_TEMPS_INCANTATION: Readonly<Record<string, string>> = {
  action_simple: 'Action simple',
  action_immediate: 'Action immédiate',
  action_rapide: 'Action rapide',
  action_complexe: 'Action complexe',
  round: 'Round(s)',
  minute: 'Minute(s)',
  heure: 'Heure(s)',
  semaine: 'Semaine',
  special: 'Spécial',
}

function capitaliser(code: string): string {
  return code.length === 0 ? code : code[0]!.toUpperCase() + code.slice(1)
}

export function libellePortee(code: string): string {
  return LIBELLES_PORTEES[code] ?? capitaliser(code)
}

export function libelleTempsIncantation(code: string): string {
  return LIBELLES_TEMPS_INCANTATION[code] ?? capitaliser(code)
}
