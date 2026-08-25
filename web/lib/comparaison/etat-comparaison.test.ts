/**
 * The comparison view's URL contract (B7), asserted without a router.
 *
 * Same discipline as `lib/navigation/etat-url.test.ts`: a pasted link must
 * restore exactly the state it encodes, and one state must serialize to exactly
 * one string — two spellings of the same state would make the router rewrite the
 * address bar on every render.
 */

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { type IndexWeb } from '@/lib/donnees/index-web'
import { CHEMIN_INDEX_FIXTURE, CHEMIN_INDEX_REEL } from '@/lib/donnees/lire-index'

import {
  ETAT_COMPARAISON_VIDE,
  LIBELLES_MODES,
  MODES,
  ecrireEtatComparaison,
  lireEtatComparaison,
  versQueryComparaison,
  type EtatComparaison,
} from './etat-comparaison'

const FIXTURE = JSON.parse(readFileSync(CHEMIN_INDEX_FIXTURE, 'utf8')) as IndexWeb
const REEL = JSON.parse(readFileSync(CHEMIN_INDEX_REEL, 'utf8')) as IndexWeb

function lire(query: string, index: IndexWeb = FIXTURE): EtatComparaison {
  return lireEtatComparaison(new URLSearchParams(query), index)
}

describe('lireEtatComparaison', () => {
  it('restitue exactement l’état encodé', () => {
    expect(lire('?classes=barde,druide&mode=partages')).toEqual({
      classes: ['barde', 'druide'],
      mode: 'partages',
    })
  })

  it('lit le contrat du plan sur le corpus réel', () => {
    // The step plan writes `?classes=barde,ensorceleur`, but `ensorceleur` is not
    // a slug: multi-class labels are never split (CLAUDE.md § 9), so the real one
    // is `arcaniste-ensorceleur-magicien`. The stale half is dropped, the valid
    // half is kept.
    expect(lire('?classes=barde,ensorceleur&mode=partages', REEL)).toEqual({
      classes: ['barde'],
      mode: 'partages',
    })
    expect(
      lire('?classes=barde,arcaniste-ensorceleur-magicien&mode=exclusifs', REEL).classes,
    ).toEqual(['barde', 'arcaniste-ensorceleur-magicien'])
  })

  it('rend l’état vide sur une URL nue', () => {
    expect(lire('')).toEqual(ETAT_COMPARAISON_VIDE)
  })

  it('conserve l’ordre de sélection', () => {
    expect(lire('?classes=occultiste,barde').classes).toEqual(['occultiste', 'barde'])
  })

  it('laisse tomber une classe inconnue plutôt que de tout refuser', () => {
    expect(lire('?classes=barde,mousquetaire,druide').classes).toEqual(['barde', 'druide'])
  })

  it('replie les doublons', () => {
    expect(lire('?classes=barde,barde,druide').classes).toEqual(['barde', 'druide'])
  })

  it('tronque une URL bricolée au-delà de trois classes', () => {
    expect(lire('?classes=barde,druide,occultiste,barde').classes).toEqual([
      'barde',
      'druide',
      'occultiste',
    ])
  })

  it('tolère les espaces et la casse', () => {
    expect(lire('?classes=%20Barde%20,DRUIDE').classes).toEqual(['barde', 'druide'])
  })

  it.each(MODES)('accepte le mode %s', (mode) => {
    expect(lire(`?mode=${mode}`).mode).toBe(mode)
  })

  it('retombe sur le mode par défaut pour un mode inconnu', () => {
    expect(lire('?mode=diagramme').mode).toBe(ETAT_COMPARAISON_VIDE.mode)
  })
})

describe('ecrireEtatComparaison', () => {
  it('omet les clés vides et le mode par défaut', () => {
    expect(ecrireEtatComparaison(ETAT_COMPARAISON_VIDE).toString()).toBe('')
    expect(versQueryComparaison(ETAT_COMPARAISON_VIDE)).toBe('')
    expect(versQueryComparaison({ classes: ['barde', 'druide'], mode: 'partages' })).toBe(
      '?classes=barde%2Cdruide',
    )
  })

  it('écrit un mode non défaut', () => {
    expect(versQueryComparaison({ classes: ['barde'], mode: 'exclusifs' })).toBe(
      '?classes=barde&mode=exclusifs',
    )
  })

  it('sérialise un état en une seule chaîne, quel que soit le chemin pris', () => {
    const etat: EtatComparaison = { classes: ['barde', 'druide'], mode: 'tous' }
    expect(versQueryComparaison(etat)).toBe(versQueryComparaison({ ...etat }))
  })

  it('fait un aller-retour sans perte', () => {
    const etats: EtatComparaison[] = [
      ETAT_COMPARAISON_VIDE,
      { classes: ['barde'], mode: 'tous' },
      { classes: ['barde', 'druide'], mode: 'exclusifs' },
      { classes: ['occultiste', 'druide', 'barde'], mode: 'partages' },
    ]
    for (const etat of etats) {
      expect(lire(versQueryComparaison(etat))).toEqual(etat)
    }
  })
})

describe('LIBELLES_MODES', () => {
  it('nomme chaque mode, sans trou', () => {
    for (const mode of MODES) {
      expect(LIBELLES_MODES[mode]).toBeTruthy()
    }
    expect(Object.keys(LIBELLES_MODES)).toHaveLength(MODES.length)
  })
})
