/**
 * The registry of global-search sources: one entry per corpus, each producing
 * `ResultatGlobal`s the header's `RechercheGlobale` groups by `type`.
 *
 * Character sheets do not exist yet (étape 14 adds them). `SOURCES_PAR_DEFAUT`
 * is deliberately just `[sourceSorts, sourceDons]` today; a later step adds a
 * `sourceFiches` to this array and touches nothing else, because the component
 * that consumes it only ever iterates the array it is given.
 *
 * Both corpus sources load their index lazily, on first search, and cache
 * the in-flight promise so a second keystroke does not refetch. `sourceSorts`
 * additionally defers importing `lib/recherche/moteur` (MiniSearch) until
 * that same first search — this file itself imports nothing but types from
 * that module, so `minisearch` never lands in whatever bundle imports this
 * one until `chercher` is actually called.
 *
 * `sourceFiches` (étape 14) is the odd one out: sheets live in
 * `localStorage` on this device and can change between two keystrokes, so
 * there is nothing to cache — it is built by `source-fiches.ts`'s factory,
 * `sourceFiches(lireFiches)`, with `lireFiches` reading the store fresh on
 * every call.
 */

import { MOTS } from '@/lib/design/tokens'
import type { IndexWeb } from '@/lib/donnees/index-web'
import type { IndexDons } from '@/lib/donnees/index-web-dons'
import { lister } from '@/lib/fiche_personnage/magasin'
import type { Fiche } from '@/lib/fiche_personnage/schema'
import type { Moteur, TableAlias } from '@/lib/recherche/moteur'

import { plier } from './pliage'
import { sourceFiches } from './source-fiches'

export type TypeResultat = 'sort' | 'don' | 'fiche'

export interface ResultatGlobal {
  readonly type: TypeResultat
  readonly cle: string
  readonly titre: string
  readonly detail: string | null
  readonly href: string
}

export interface SourceGlobale {
  readonly type: TypeResultat
  /** Group header, from `MOTS`. */
  readonly libelle: string
  /** Display order of the group among the others. */
  readonly ordre: number
  /** The link to the corpus page for this source, query carried in the URL
   * (`?q=<requete>`), for "see all results". */
  readonly hrefTousLesResultats: (requete: string) => string
  /** The group's "see all results" link label. */
  readonly libelleTousLesResultats: string
  chercher(requete: string, limite: number): Promise<ResultatGlobal[]>
}

let indexSortsPromesse: Promise<IndexWeb> | null = null
function chargerIndexSorts(): Promise<IndexWeb> {
  if (indexSortsPromesse === null) {
    indexSortsPromesse = fetch('/data/index.json').then((reponse) => {
      if (!reponse.ok) throw new Error(`index.json : ${reponse.status}`)
      return reponse.json() as Promise<IndexWeb>
    })
  }
  return indexSortsPromesse
}

let moteurSortsPromesse: Promise<Moteur> | null = null
function chargerMoteurSorts(): Promise<Moteur> {
  if (moteurSortsPromesse === null) {
    moteurSortsPromesse = Promise.all([
      chargerIndexSorts(),
      // Dynamic import: this is the one line in the whole module that pulls
      // MiniSearch in, and it runs only once `chercher` below is actually
      // called — never at module load.
      import('@/lib/recherche/moteur'),
    ]).then(([index, module]) => module.construireMoteur(index, null as TableAlias | null))
  }
  return moteurSortsPromesse
}

export const sourceSorts: SourceGlobale = {
  type: 'sort',
  libelle: MOTS.rechercheGroupeSorts,
  ordre: 0,
  libelleTousLesResultats: MOTS.rechercheVoirTousLesSorts,
  hrefTousLesResultats: (requete) => `/?q=${encodeURIComponent(requete)}`,
  async chercher(requete, limite) {
    const moteur = await chargerMoteurSorts()
    const trouves = moteur.chercher(requete, limite) ?? []
    return trouves.slice(0, limite).map((resultat) => ({
      type: 'sort' as const,
      cle: resultat.id,
      titre: resultat.n,
      detail: null,
      href: `/sorts/${resultat.s}/`,
    }))
  },
}

let indexDonsPromesse: Promise<IndexDons> | null = null
function chargerIndexDons(): Promise<IndexDons> {
  if (indexDonsPromesse === null) {
    indexDonsPromesse = fetch('/data/dons/index.json').then((reponse) => {
      if (!reponse.ok) throw new Error(`dons/index.json : ${reponse.status}`)
      return reponse.json() as Promise<IndexDons>
    })
  }
  return indexDonsPromesse
}

export const sourceDons: SourceGlobale = {
  type: 'don',
  libelle: MOTS.rechercheGroupeDons,
  ordre: 1,
  libelleTousLesResultats: MOTS.rechercheVoirTousLesDons,
  hrefTousLesResultats: (requete) => `/dons?q=${encodeURIComponent(requete)}`,
  async chercher(requete, limite) {
    const index = await chargerIndexDons()
    const q = plier(requete)
    if (q === '') return []
    const trouves = index.dons.filter((don) => don.nf.includes(q)).slice(0, limite)
    return trouves.map((don) => ({
      type: 'don' as const,
      cle: don.id,
      titre: don.n,
      detail: null,
      href: `/dons/${don.s}/`,
    }))
  },
}

/** `lireFiches` is only ever called from inside `chercher`, client-side and
 * post-interaction, so `window` is guaranteed to exist by then — this guard
 * is only for the module ever being evaluated during the static build. */
function lireFichesLocales(): readonly Fiche[] {
  if (typeof window === 'undefined') return []
  return lister(window.localStorage).fiches
}

export const SOURCES_PAR_DEFAUT: readonly SourceGlobale[] = [
  sourceSorts,
  sourceDons,
  sourceFiches(lireFichesLocales),
]
