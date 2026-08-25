/**
 * The filters, which are class-relative by construction (B4).
 *
 * The assertions that matter most here are the refusals: a level filter without a
 * class must not fall back on some minimum across classes. That fallback is the
 * bug the whole data model exists to prevent — it would show a bard a "level 1"
 * list containing spells the bard only gets at 4, and every number on screen
 * would look like data.
 */

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { type EntreeSort, type IndexWeb } from '@/lib/donnees/index-web'
import { CHEMIN_INDEX_FIXTURE } from '@/lib/donnees/lire-index'

import {
  appliquerFiltres,
  appliquerFiltresAuxResultats,
  FILTRES_VIDES,
  filtresActifs,
} from './filtres'

const FIXTURE = JSON.parse(readFileSync(CHEMIN_INDEX_FIXTURE, 'utf8')) as IndexWeb

function sort(partiel: Partial<EntreeSort> & { id: string }): EntreeSort {
  return {
    i: 0,
    s: partiel.id,
    n: partiel.id,
    nf: partiel.id,
    e: null,
    niv: {},
    c: [],
    p: null,
    j: null,
    rm: null,
    t: [],
    d: false,
    ...partiel,
  }
}

const A = sort({ id: 'a', niv: { barde: 1, druide: 4 }, e: 0, c: [0, 1], j: 2, t: [7], d: true })
const B = sort({ id: 'b', niv: { barde: 4 }, e: 1, c: [0], j: 2, t: [] })
const C = sort({ id: 'c', niv: { druide: 1 }, e: 0, c: [], j: null, t: [7, 8] })
const CORPUS = [A, B, C]

function gardes(entrees: EntreeSort[]): string[] {
  return entrees.map((entree) => entree.id)
}

describe('le niveau est relatif à la classe', () => {
  it('« niveau 1 » veut dire niveau 1 POUR cette classe', () => {
    // A is level 1 for the bard and level 4 for the druid. The same spell is in
    // one list and not the other; that is the whole point.
    expect(gardes(appliquerFiltres(CORPUS, { classe: 'barde', niveaux: [1] }))).toEqual(['a'])
    expect(gardes(appliquerFiltres(CORPUS, { classe: 'druide', niveaux: [1] }))).toEqual(['c'])
    expect(gardes(appliquerFiltres(CORPUS, { classe: 'druide', niveaux: [4] }))).toEqual(['a'])
  })

  it('un niveau sans classe est ignoré, jamais appliqué à un minimum', () => {
    // The refusal. Taking the minimum across classes would produce a number
    // nobody asked for and present it as the spell's level.
    expect(gardes(appliquerFiltres(CORPUS, { niveaux: [1] }))).toEqual(['a', 'b', 'c'])
  })

  it('une classe seule garde les sorts que cette classe reçoit', () => {
    expect(gardes(appliquerFiltres(CORPUS, { classe: 'barde' }))).toEqual(['a', 'b'])
  })

  it('écarte un sort qu\'aucune classe filtrée n\'accorde', () => {
    expect(gardes(appliquerFiltres(CORPUS, { classe: 'magus' }))).toEqual([])
  })

  it('accepte plusieurs niveaux', () => {
    expect(gardes(appliquerFiltres(CORPUS, { classe: 'barde', niveaux: [1, 4] }))).toEqual([
      'a',
      'b',
    ])
  })

  it('traite le niveau 0 comme un niveau réel, pas comme une absence', () => {
    const tour = sort({ id: 'tour', niv: { barde: 0 } })
    expect(gardes(appliquerFiltres([tour], { classe: 'barde', niveaux: [0] }))).toEqual(['tour'])
    expect(gardes(appliquerFiltres([tour], { classe: 'barde', niveaux: [1] }))).toEqual([])
  })
})

describe('les autres axes', () => {
  it('filtre par école', () => {
    expect(gardes(appliquerFiltres(CORPUS, { ecoles: [0] }))).toEqual(['a', 'c'])
  })

  it('écarte un sort sans école quand une école est demandée', () => {
    expect(gardes(appliquerFiltres([sort({ id: 'x', e: null })], { ecoles: [0] }))).toEqual([])
  })

  it('exige TOUTES les composantes demandées', () => {
    // Conjunctive on purpose: someone asking for V+M wants spells needing both,
    // not spells needing either. Disjunctive would return almost the whole corpus.
    expect(gardes(appliquerFiltres(CORPUS, { composantes: [0] }))).toEqual(['a', 'b'])
    expect(gardes(appliquerFiltres(CORPUS, { composantes: [0, 1] }))).toEqual(['a'])
  })

  it('accepte N\'IMPORTE QUEL tag demandé', () => {
    // Disjunctive, unlike components: tags are a facet, and asking for two of
    // them means "either of these themes".
    expect(gardes(appliquerFiltres(CORPUS, { tags: [8] }))).toEqual(['c'])
    expect(gardes(appliquerFiltres(CORPUS, { tags: [7, 8] }))).toEqual(['a', 'c'])
  })

  it('filtre par jet de sauvegarde et écarte les nuls', () => {
    expect(gardes(appliquerFiltres(CORPUS, { jets: [2] }))).toEqual(['a', 'b'])
  })

  it('isole les sorts en désaccord', () => {
    expect(gardes(appliquerFiltres(CORPUS, { desaccord: true }))).toEqual(['a'])
  })

  it('combine les axes en conjonction', () => {
    expect(
      gardes(appliquerFiltres(CORPUS, { classe: 'barde', niveaux: [1], ecoles: [0], tags: [7] })),
    ).toEqual(['a'])
    expect(gardes(appliquerFiltres(CORPUS, { classe: 'barde', ecoles: [0], tags: [8] }))).toEqual(
      [],
    )
  })
})

describe('les cas neutres', () => {
  it('un jeu de filtres vide rend tout, dans l\'ordre reçu', () => {
    expect(appliquerFiltres(CORPUS, FILTRES_VIDES)).toEqual(CORPUS)
  })

  it('un tableau de filtre vide ne filtre rien', () => {
    // [] means "no constraint on this axis", not "match nothing" — an axis whose
    // checkboxes are all unticked must not empty the list.
    expect(gardes(appliquerFiltres(CORPUS, { ecoles: [], tags: [], composantes: [] }))).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('ne mute jamais l\'entrée', () => {
    const copie = [...CORPUS]
    appliquerFiltres(CORPUS, { classe: 'barde' })
    expect(CORPUS).toEqual(copie)
    expect(appliquerFiltres(CORPUS, FILTRES_VIDES)).not.toBe(CORPUS)
  })

  it('filtresActifs distingue « rien de coché » de « quelque chose de coché »', () => {
    expect(filtresActifs(FILTRES_VIDES)).toBe(false)
    expect(filtresActifs({ niveaux: [1] })).toBe(false) // sans classe : inopérant
    expect(filtresActifs({ ecoles: [] })).toBe(false)
    expect(filtresActifs({ classe: 'barde' })).toBe(true)
    expect(filtresActifs({ desaccord: true })).toBe(true)
  })
})

describe('sur des résultats de recherche', () => {
  const parId = new Map(CORPUS.map((entree) => [entree.id, entree]))
  const resultats = [{ id: 'b' }, { id: 'a' }, { id: 'c' }]

  it('préserve l\'ordre de pertinence, sans le retrier', () => {
    // The incoming order IS the ranking the engine computed; re-sorting here
    // would throw that away and rank by index position instead.
    expect(appliquerFiltresAuxResultats(resultats, parId, { classe: 'barde' })).toEqual([
      { id: 'b' },
      { id: 'a' },
    ])
  })

  it('écarte un résultat introuvable dans l\'index', () => {
    expect(appliquerFiltresAuxResultats([{ id: 'inconnu' }], parId, { ecoles: [0] })).toEqual([])
  })

  it('rend tout quand aucun filtre n\'est actif', () => {
    expect(appliquerFiltresAuxResultats(resultats, parId, FILTRES_VIDES)).toEqual(resultats)
  })
})

describe('sur la fixture figée', () => {
  it('filtre le corpus réel de la fixture par classe et niveau', () => {
    const bardes1 = appliquerFiltres(FIXTURE.sorts, { classe: 'barde', niveaux: [1] })
    expect(bardes1.length).toBeGreaterThan(0)
    for (const entree of bardes1) expect(entree.niv['barde']).toBe(1)
  })

  it('les codes d\'école filtrés existent dans la table de codes', () => {
    const code = FIXTURE.ecoles.indexOf('divination')
    expect(code).toBeGreaterThanOrEqual(0)
    for (const entree of appliquerFiltres(FIXTURE.sorts, { ecoles: [code] })) {
      expect(entree.e).toBe(code)
    }
  })
})
