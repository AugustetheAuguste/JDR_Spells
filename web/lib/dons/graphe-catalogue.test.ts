/**
 * `catalogueDepuisMoteur` — round-tripping `moteur.json`'s precomputed
 * `aretes`/`prerequis_dons`/`levier_catalogue` through a synthetic
 * `CatalogueDons` and back out through the REAL `construireGraphe`, so the
 * tree view's edges are provably the same edges `moteur.json` shipped, not a
 * second, hand-rolled walk of the same data.
 */
import { describe, expect, it } from 'vitest'

import { catalogueDepuisMoteur, couterCatalogue, type DonneesGrapheMoteur } from './graphe-catalogue.js'
import { construireGraphe } from './graphe.js'

/**
 * A small hand-built `moteur.json` slice: "Fondation A"/"Fondation B" unlock
 * "Combo" only together (an OR-group of ONE alternative — both required),
 * "Combo" unlocks "Suite", "Isolé" unlocks and requires nothing, and
 * "Branche"/"Ou Branche" are true alternatives for "Choix" (a real OR).
 */
function moteurDeTest(): DonneesGrapheMoteur {
  return {
    aretes: [
      { de: 'fondation-a', vers: 'combo' },
      { de: 'fondation-b', vers: 'combo' },
      { de: 'combo', vers: 'suite' },
      { de: 'branche', vers: 'choix' },
      { de: 'ou-branche', vers: 'choix' },
    ],
    prerequis_dons: {
      choix: [['branche', 'ou-branche']],
    },
    levier_catalogue: {
      'fondation-a': 3,
      'fondation-b': 1,
      combo: 1,
      suite: 0,
      isole: 0,
      branche: 1,
      'ou-branche': 1,
      choix: 0,
    },
  }
}

describe('catalogueDepuisMoteur', () => {
  it('reproduit exactement les arêtes de moteur.json via le VRAI construireGraphe', () => {
    const donnees = moteurDeTest()
    const catalogue = catalogueDepuisMoteur(donnees)
    const { enfants, parents } = construireGraphe(catalogue)

    expect(enfants.get('fondation-a')).toEqual(new Set(['combo']))
    expect(enfants.get('fondation-b')).toEqual(new Set(['combo']))
    expect(enfants.get('combo')).toEqual(new Set(['suite']))
    expect(parents.get('choix')).toEqual(new Set(['branche', 'ou-branche']))
    expect(enfants.get('isole')).toBeUndefined()
  })

  it('« Combo » (deux prérequis distincts, tous deux requis) coûte 3, pas 2', () => {
    const catalogue = catalogueDepuisMoteur(moteurDeTest())
    const couts = couterCatalogue(catalogue)
    expect(couts.get('combo')).toBe(3)
  })

  it('« Choix » (deux alternatives, une seule requise) coûte 2, pas 3', () => {
    const catalogue = catalogueDepuisMoteur(moteurDeTest())
    const couts = couterCatalogue(catalogue)
    expect(couts.get('choix')).toBe(2)
  })

  it('« Isolé » coûte 1 (aucun prérequis)', () => {
    const catalogue = catalogueDepuisMoteur(moteurDeTest())
    const couts = couterCatalogue(catalogue)
    expect(couts.get('isole')).toBe(1)
  })
})
