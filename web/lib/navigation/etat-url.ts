/**
 * The filter state, read from and written to the query string.
 *
 * The URL is the single source of state (B7). There is no parallel `useState`
 * holding the same thing, because two copies of one truth diverge: the classic
 * symptom is a back button that changes the address bar and not the table. Every
 * function here is pure — string in, state out — so the whole contract is
 * testable without a router.
 *
 * Contract:
 *   ?classe=barde&niveau=1-3&ecoles=evocation,abjuration&tags=offensif,zone
 *    &q=feu&sauvegarde=reflexes&composantes=v,s&desaccords=1
 *
 * Values are *names*, never the integer codes of the index. A URL is a durable,
 * shareable, human-readable thing; `ecoles=3` would break the day the export
 * reorders a code table, and silently — it would filter on the wrong school
 * rather than fail. Codes are resolved against the index at the last moment.
 *
 * Unknown values are dropped, never fatal. A URL is user input, it arrives
 * hand-edited and truncated by chat clients, and a filter nobody can name is
 * better ignored than crashed on.
 */

import type { IndexWeb } from '@/lib/donnees/index-web'
import type { Filtres } from '@/lib/recherche/filtres'

export const NIVEAU_MAX = 9

export interface EtatUrl {
  readonly classe: string | null
  /** Levels, ascending and deduplicated. Empty = no level constraint. */
  readonly niveaux: readonly number[]
  readonly ecoles: readonly string[]
  readonly tags: readonly string[]
  readonly composantes: readonly string[]
  readonly sauvegarde: readonly string[]
  readonly q: string
  readonly desaccords: boolean
}

export const ETAT_VIDE: EtatUrl = {
  classe: null,
  niveaux: [],
  ecoles: [],
  tags: [],
  composantes: [],
  sauvegarde: [],
  q: '',
  desaccords: false,
}

/** The query-string keys, so a typo is a compile error and not a dead filter. */
export const CLES = {
  classe: 'classe',
  niveau: 'niveau',
  ecoles: 'ecoles',
  tags: 'tags',
  composantes: 'composantes',
  sauvegarde: 'sauvegarde',
  q: 'q',
  desaccords: 'desaccords',
} as const

function listeDe(valeur: string | null, connus: readonly string[]): string[] {
  if (valeur === null) return []
  // Matched case-insensitively but stored with the index's own casing. The code
  // tables are not uniform — schools and saving throws are lowercase, component
  // codes are the uppercase letters `V`, `M`, `FD` — so lowercasing the value
  // made every component filter silently unmatchable, and a URL written `?…=V`
  // filtered on nothing while looking like it worked.
  const parPli = new Map(connus.map((connu) => [connu.toLowerCase(), connu]))
  const vus = new Set<string>()
  for (const brut of valeur.split(',')) {
    const propre = parPli.get(brut.trim().toLowerCase())
    if (propre !== undefined) vus.add(propre)
  }
  // Ordered by the index's own table, so two URLs listing the same schools in a
  // different order produce byte-identical state — and one canonical URL.
  return connus.filter((connu) => vus.has(connu))
}

/**
 * Parse `niveau`: `1-3`, `0,2,5`, `1-3,7`, or a bare `4`.
 *
 * Ranges are accepted because "levels 1 to 3" is how a player thinks, and typing
 * `1-3` into the address bar has to work. A reversed range (`5-2`) is read
 * forwards rather than dropped — the intent is unambiguous and refusing it would
 * only punish a typo.
 */
export function analyserNiveaux(valeur: string | null): number[] {
  if (valeur === null) return []
  const trouves = new Set<number>()
  for (const morceau of valeur.split(',')) {
    const propre = morceau.trim()
    if (propre === '') continue
    const intervalle = /^(\d)\s*-\s*(\d)$/.exec(propre)
    if (intervalle !== null) {
      const a = Number(intervalle[1])
      const b = Number(intervalle[2])
      for (let n = Math.min(a, b); n <= Math.max(a, b); n += 1) trouves.add(n)
      continue
    }
    if (/^\d$/.test(propre)) trouves.add(Number(propre))
  }
  return [...trouves].filter((n) => n >= 0 && n <= NIVEAU_MAX).sort((a, b) => a - b)
}

/** Render levels back as compact ranges: [1,2,3,7] → "1-3,7". */
export function formaterNiveaux(niveaux: readonly number[]): string {
  const tries = [...new Set(niveaux)].sort((a, b) => a - b)
  const morceaux: string[] = []
  let debut = 0
  while (debut < tries.length) {
    let fin = debut
    while (fin + 1 < tries.length && tries[fin + 1] === tries[fin]! + 1) fin += 1
    // A run of two is written "1,2": "1-2" is not shorter and reads worse.
    morceaux.push(fin - debut >= 2 ? `${tries[debut]}-${tries[fin]}` : tries.slice(debut, fin + 1).join(','))
    debut = fin + 1
  }
  return morceaux.join(',')
}

/** Read the state out of a query string, validated against the index. */
export function lireEtat(parametres: URLSearchParams, index: IndexWeb): EtatUrl {
  const classeBrute = parametres.get(CLES.classe)?.trim().toLowerCase() ?? ''
  const classe = index.classes.some((c) => c.slug === classeBrute) ? classeBrute : null
  return {
    classe,
    niveaux: analyserNiveaux(parametres.get(CLES.niveau)),
    ecoles: listeDe(parametres.get(CLES.ecoles), index.ecoles),
    tags: listeDe(parametres.get(CLES.tags), index.tags),
    composantes: listeDe(parametres.get(CLES.composantes), index.composantes),
    sauvegarde: listeDe(parametres.get(CLES.sauvegarde), index.jets),
    q: parametres.get(CLES.q) ?? '',
    desaccords: parametres.get(CLES.desaccords) === '1',
  }
}

/**
 * Serialize the state back to a query string.
 *
 * Absent keys rather than empty ones: `?classe=&niveau=` is noise in a shared
 * link, and round-tripping has to be stable — `ecrireEtat(lireEtat(s))` must
 * reach a fixed point or the router would rewrite the URL on every render.
 * Keys are emitted in `CLES` order, so the same state is always the same string.
 */
export function ecrireEtat(etat: EtatUrl): URLSearchParams {
  const parametres = new URLSearchParams()
  if (etat.classe !== null) parametres.set(CLES.classe, etat.classe)
  if (etat.niveaux.length > 0) parametres.set(CLES.niveau, formaterNiveaux(etat.niveaux))
  if (etat.ecoles.length > 0) parametres.set(CLES.ecoles, etat.ecoles.join(','))
  if (etat.tags.length > 0) parametres.set(CLES.tags, etat.tags.join(','))
  if (etat.composantes.length > 0) parametres.set(CLES.composantes, etat.composantes.join(','))
  if (etat.sauvegarde.length > 0) parametres.set(CLES.sauvegarde, etat.sauvegarde.join(','))
  if (etat.q !== '') parametres.set(CLES.q, etat.q)
  if (etat.desaccords) parametres.set(CLES.desaccords, '1')
  return parametres
}

/** The query string, `?` included, or `''` for the bare route. */
export function versQueryString(etat: EtatUrl): string {
  const rendu = ecrireEtat(etat).toString()
  return rendu === '' ? '' : `?${rendu}`
}

/** True when anything at all is filtered — drives « Tout effacer ». */
export function etatActif(etat: EtatUrl): boolean {
  return versQueryString(etat) !== ''
}

/**
 * Turn names into the index's integer codes.
 *
 * Names live in the URL, codes live in the index; this is the one place they
 * meet. `-1` can never come out: an unknown name was already dropped by
 * `lireEtat`, and `indexOf` is called on the same table that validated it.
 */
export function versFiltres(etat: EtatUrl, index: IndexWeb): Filtres {
  const codes = (noms: readonly string[], table: readonly string[]): number[] =>
    noms.map((nom) => table.indexOf(nom)).filter((code) => code >= 0)
  return {
    classe: etat.classe,
    niveaux: etat.niveaux,
    // Explicit: without a class the level filter reads the minimum across
    // classes, and the view labels it as such. See `Filtres.niveauSansClasse`.
    niveauSansClasse: 'minimum',
    ecoles: codes(etat.ecoles, index.ecoles),
    tags: codes(etat.tags, index.tags),
    composantes: codes(etat.composantes, index.composantes),
    jets: codes(etat.sauvegarde, index.jets),
    desaccord: etat.desaccords,
  }
}

/**
 * The filter to name in an empty state.
 *
 * Chosen as the most restrictive one, cheaply: not by re-running the filters
 * (that would be exact and cost eight passes on every empty render) but by the
 * order in which filters actually empty a list of spells. A named suggestion that
 * is merely a good guess beats « Aucun résultat » with nothing to click.
 */
export function filtreLePlusRestrictif(etat: EtatUrl): keyof typeof CLES | null {
  if (etat.q !== '') return 'q'
  if (etat.desaccords) return 'desaccords'
  if (etat.niveaux.length > 0) return 'niveau'
  if (etat.composantes.length > 0) return 'composantes'
  if (etat.tags.length > 0) return 'tags'
  if (etat.sauvegarde.length > 0) return 'sauvegarde'
  if (etat.ecoles.length > 0) return 'ecoles'
  if (etat.classe !== null) return 'classe'
  return null
}

/** Clear one filter, keeping the rest — what the empty state's button does. */
export function sansFiltre(etat: EtatUrl, cle: keyof typeof CLES): EtatUrl {
  switch (cle) {
    case 'classe':
      return { ...etat, classe: null }
    case 'niveau':
      return { ...etat, niveaux: [] }
    case 'ecoles':
      return { ...etat, ecoles: [] }
    case 'tags':
      return { ...etat, tags: [] }
    case 'composantes':
      return { ...etat, composantes: [] }
    case 'sauvegarde':
      return { ...etat, sauvegarde: [] }
    case 'q':
      return { ...etat, q: '' }
    case 'desaccords':
      return { ...etat, desaccords: false }
  }
}

/** Human labels for the filter keys, used in empty-state prose. */
export const LIBELLES_FILTRES: Readonly<Record<keyof typeof CLES, string>> = {
  classe: 'la classe',
  niveau: 'le niveau',
  ecoles: "l'école",
  tags: 'les tags',
  composantes: 'les composantes',
  sauvegarde: 'le jet de sauvegarde',
  q: 'la recherche',
  desaccords: 'le filtre des désaccords',
}
