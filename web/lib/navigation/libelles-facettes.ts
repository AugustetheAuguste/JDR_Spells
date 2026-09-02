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
  round: 'Rounds',
  minute: 'Minutes',
  heure: 'Heures',
  semaine: 'Semaine',
  special: 'Spécial',
}

/** Display labels for the damage-type facet, from the closed vocabulary
 * `conventions/vocabulaires/types_degats.json`. */
export const LIBELLES_TYPES_DEGATS: Readonly<Record<string, string>> = {
  feu: 'Feu',
  froid: 'Froid',
  acide: 'Acide',
  electricite: 'Électricité',
  son: 'Son',
  force: 'Force',
  negatif: 'Énergie négative',
  positif: 'Énergie positive',
  perforant: 'Perforant',
  tranchant: 'Tranchant',
  contondant: 'Contondant',
  precision: 'Précision',
  autre: 'Autre',
}

/** Display labels for the inflicted-condition facet, from the closed vocabulary
 * `conventions/vocabulaires/conditions.json`. Keys are unaccented (corpus
 * convention, CLAUDE.md § 3); labels restore the accent. */
export const LIBELLES_CONDITIONS: Readonly<Record<string, string>> = {
  aveugle: 'Aveuglé',
  ebloui: 'Ébloui',
  etourdi: 'Étourdi',
  chancelant: 'Chancelant',
  secoue: 'Secoué',
  effraye: 'Effrayé',
  paralyse: 'Paralysé',
  confus: 'Confus',
  fascine: 'Fasciné',
  enchevetre: 'Enchevêtré',
  ralenti: 'Ralenti',
  assourdi: 'Assourdi',
  nauseeux: 'Nauséeux',
  fatigue: 'Fatigué',
  epuise: 'Épuisé',
  fievreux: 'Fiévreux',
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

export function libelleTypeDegats(code: string): string {
  return LIBELLES_TYPES_DEGATS[code] ?? capitaliser(code)
}

export function libelleCondition(code: string): string {
  return LIBELLES_CONDITIONS[code] ?? capitaliser(code)
}
