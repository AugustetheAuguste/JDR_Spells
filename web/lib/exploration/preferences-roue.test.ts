/**
 * The wheel's personal preference: local, never fatal on a corrupted value, and
 * `niveau` pinned first no matter what was stored — the same guarantees
 * `etat-url.ts` gives a hand-edited URL, applied to `localStorage` instead.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  CLE_STOCKAGE_ROUE,
  ecrirePreferenceRoue,
  lirePreferenceRoue,
  ORDRE_PAR_DEFAUT,
} from '@/lib/exploration/preferences-roue'

beforeEach(() => {
  window.localStorage.clear()
})

describe('lirePreferenceRoue', () => {
  it('retombe sur le défaut quand rien n’est stocké', () => {
    expect(lirePreferenceRoue()).toEqual(ORDRE_PAR_DEFAUT)
  })

  it('retombe sur le défaut sur une valeur corrompue', () => {
    window.localStorage.setItem(CLE_STOCKAGE_ROUE, '{ceci ne parse pas')
    expect(lirePreferenceRoue()).toEqual(ORDRE_PAR_DEFAUT)
  })

  it('retombe sur le défaut sur une valeur qui n’est pas un tableau', () => {
    window.localStorage.setItem(CLE_STOCKAGE_ROUE, JSON.stringify({ pas: 'un tableau' }))
    expect(lirePreferenceRoue()).toEqual(ORDRE_PAR_DEFAUT)
  })

  it('écarte les clés inconnues et les doublons, jamais fatal', () => {
    window.localStorage.setItem(
      CLE_STOCKAGE_ROUE,
      JSON.stringify(['ecole', 'inexistant', 'ecole', 'sauvegarde']),
    )
    expect(lirePreferenceRoue()).toEqual(['niveau', 'ecole', 'sauvegarde'])
  })

  it('niveau est toujours en tête, même absent du stockage', () => {
    window.localStorage.setItem(CLE_STOCKAGE_ROUE, JSON.stringify(['composante', 'portee']))
    expect(lirePreferenceRoue()).toEqual(['niveau', 'composante', 'portee'])
  })
})

describe('ecrirePreferenceRoue', () => {
  it('écrit-lit est un point fixe, niveau replacé en tête', () => {
    ecrirePreferenceRoue(['degats', 'niveau', 'ecole'])
    expect(lirePreferenceRoue()).toEqual(['niveau', 'degats', 'ecole'])
  })
})
