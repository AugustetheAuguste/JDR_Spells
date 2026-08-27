/**
 * The tag filter's four-state cycle, tested without a router or a component.
 */

import { describe, expect, it } from 'vitest'

import { basculerTag, etatDuTag, LIBELLES_ETATS_TAG, PROCHAIN_ETAT_TAG, type EtatTag } from './tags'

const CONNUS = ['zone_d_effet', 'effet_mental', 'persistant']

describe('etatDuTag', () => {
  it('lit chacun des quatre états', () => {
    expect(etatDuTag('a', [], [], [])).toBe('neutre')
    expect(etatDuTag('a', ['a'], [], [])).toBe('inclus')
    expect(etatDuTag('a', [], ['a'], [])).toBe('exclu')
    expect(etatDuTag('a', [], [], ['a'])).toBe('oblige')
  })
})

describe('PROCHAIN_ETAT_TAG', () => {
  it('boucle neutre → inclus → exclu → oblige → neutre', () => {
    expect(PROCHAIN_ETAT_TAG.neutre).toBe('inclus')
    expect(PROCHAIN_ETAT_TAG.inclus).toBe('exclu')
    expect(PROCHAIN_ETAT_TAG.exclu).toBe('oblige')
    expect(PROCHAIN_ETAT_TAG.oblige).toBe('neutre')
  })

  it('n’a pas de cinquième état ni d’impasse', () => {
    let etat: EtatTag = 'neutre'
    const vus = new Set<EtatTag>([etat])
    for (let i = 0; i < 4; i += 1) {
      etat = PROCHAIN_ETAT_TAG[etat]
      vus.add(etat)
    }
    expect(vus).toEqual(new Set(['neutre', 'inclus', 'exclu', 'oblige']))
  })
})

describe('LIBELLES_ETATS_TAG', () => {
  it('nomme les quatre états', () => {
    for (const etat of ['neutre', 'inclus', 'exclu', 'oblige'] as const) {
      expect(LIBELLES_ETATS_TAG[etat].length).toBeGreaterThan(0)
    }
  })
})

describe('basculerTag', () => {
  it('un premier clic passe le tag à inclus (OR)', () => {
    const suivant = basculerTag('zone_d_effet', [], [], CONNUS)
    expect(suivant).toEqual({ tags: ['zone_d_effet'], tagsExclus: [], tagsObliges: [] })
  })

  it('un second clic passe le tag à exclu (NOT)', () => {
    const suivant = basculerTag('zone_d_effet', ['zone_d_effet'], [], CONNUS)
    expect(suivant).toEqual({ tags: [], tagsExclus: ['zone_d_effet'], tagsObliges: [] })
  })

  it('un troisième clic passe le tag à oblige (AND)', () => {
    const suivant = basculerTag('zone_d_effet', [], ['zone_d_effet'], CONNUS)
    expect(suivant).toEqual({ tags: [], tagsExclus: [], tagsObliges: ['zone_d_effet'] })
  })

  it('un quatrième clic relâche le tag', () => {
    const suivant = basculerTag('zone_d_effet', [], [], CONNUS, ['zone_d_effet'])
    expect(suivant).toEqual({ tags: [], tagsExclus: [], tagsObliges: [] })
  })

  it('laisse les autres tags intacts', () => {
    const suivant = basculerTag('effet_mental', ['zone_d_effet'], [], CONNUS, ['persistant'])
    expect(suivant).toEqual({
      tags: ['zone_d_effet', 'effet_mental'],
      tagsExclus: [],
      tagsObliges: ['persistant'],
    })
  })

  it('les trois listes sont disjointes et ordonnées par la table des connus', () => {
    // `persistant` starts neutral, so one click moves it to `inclus`, not
    // `oblige` — the cycle always starts at OR regardless of what else is posed.
    const suivant = basculerTag('persistant', ['effet_mental'], ['zone_d_effet'], CONNUS)
    expect(suivant.tags).toEqual(['effet_mental', 'persistant'])
    expect(suivant.tagsExclus).toEqual(['zone_d_effet'])
    expect(suivant.tagsObliges).toEqual([])
  })
})
