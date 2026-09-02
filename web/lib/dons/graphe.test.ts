/**
 * Tests for the graph derivations (`calculerVagues`, `calculerCouts`,
 * `construireGraphe`, `calculerLeviers`, `calculerVoies`), built on a small
 * hand-built catalogue rather than the full 1417-feat contract — enough to
 * exercise every documented invariant without a slow fixture load.
 */

import { describe, expect, it } from 'vitest'

import { calculerCouts, calculerLeviers, calculerVagues, calculerVoies, construireGraphe } from './graphe.js'
import { filtrerDons } from './moteur.js'
import type { CatalogueDons } from './moteur.js'
import type { DonConditions, Exigence, Personnage, TablesMoteur } from './types.js'

const TABLES: TablesMoteur = {
  lanceurs: { guerrier: { is_caster: false } },
  maitrises: { guerrier: { armes_martiales: true, armes_simples: true, armes_specifiques: [], boucliers: true } },
  magie_des_dons: {},
  affinite_creature: {},
  restriction_de_classe: {},
  races: {},
  armes_raciales: {},
  reclassement_racial: {},
  progression_bba: { guerrier: 'good' },
}

function feat(charge: Record<string, unknown>): Exigence {
  return { type: 'feat', charge, verif_manuelle: false, segment: 'feat' }
}

function bbaMin(min: number): Exigence {
  return { type: 'bba', charge: { min }, verif_manuelle: false, segment: 'bba' }
}

/**
 * A tiny chain-shaped catalogue:
 *   - "Fondation A", "Fondation B" : no prereqs (wave 1)
 *   - "Combo" : requires BOTH "Fondation A" AND "Fondation B" (cost 3, not 2)
 *   - "Suite" : requires "Combo" (wave 3, since Combo unlocks in wave 2)
 *   - "Isolé" : no prereqs, unlocks nothing (leverage 0, no edges)
 */
function catalogueDeTest(): CatalogueDons {
  return new Map<string, DonConditions>([
    ['Fondation A', { brut: '', effectif: '', exigences: [] }],
    ['Fondation B', { brut: '', effectif: '', exigences: [] }],
    ['Combo', { brut: '', effectif: '', exigences: [feat({ feat_name: 'Fondation A' }), feat({ feat_name: 'Fondation B' })] }],
    ['Suite', { brut: '', effectif: '', exigences: [feat({ feat_name: 'Combo' })] }],
    ['Isolé', { brut: '', effectif: '', exigences: [] }],
    ['Trop haut', { brut: '', effectif: '', exigences: [bbaMin(99)] }],
  ])
}

const PERSO: Personnage = { classe: 'guerrier', niveau: 5 }

describe('calculerVagues — connaissance explicite des dons', () => {
  it('donne strictement moins de dons en vague 1 que filtrerDons sur le même personnage', () => {
    const catalogue = catalogueDeTest()
    const { vagueDe } = calculerVagues(PERSO, catalogue, 3, TABLES)
    const vague1 = [...vagueDe.entries()].filter(([, v]) => v === 1).map(([nom]) => nom)

    const groupes = filtrerDons(catalogue, PERSO, TABLES)
    const accessiblesFiltrer = [...groupes.eligible, ...groupes.manual_check].map((r) => r.nom_don)

    // "Combo" et "Suite" dépendent de dons non pris : `filtrerDons` (dons_connus
    // undefined -> null -> manual_check) les compte accessibles tout de suite,
    // `calculerVagues` (dons_connus explicite -> false) les repousse à plus tard.
    expect(vague1.length).toBeLessThan(accessiblesFiltrer.length)
    expect(vague1).toContain('Fondation A')
    expect(vague1).toContain('Fondation B')
    expect(vague1).not.toContain('Combo')
  })

  it('« Combo » n’apparaît qu’en vague 2, « Suite » en vague 3', () => {
    const catalogue = catalogueDeTest()
    const { vagueDe } = calculerVagues(PERSO, catalogue, 3, TABLES)
    expect(vagueDe.get('Combo')).toBe(2)
    expect(vagueDe.get('Suite')).toBe(3)
  })

  it('un don hors de portée (BBA 99) ne rejoint aucune vague', () => {
    const catalogue = catalogueDeTest()
    const { vagueDe } = calculerVagues(PERSO, catalogue, 3, TABLES)
    expect(vagueDe.has('Trop haut')).toBe(false)
  })
})

describe('calculerCouts — la vague est une borne inférieure', () => {
  it('« Combo » (deux prérequis distincts de vague 1) coûte 3, pas 2', () => {
    const catalogue = catalogueDeTest()
    const { vagueDe } = calculerVagues(PERSO, catalogue, 3, TABLES)
    const couts = calculerCouts(catalogue, vagueDe, new Set())
    expect(couts.get('Combo')).toBe(3)
  })

  it('« Suite » (Combo + ses deux prérequis) coûte 4', () => {
    const catalogue = catalogueDeTest()
    const { vagueDe } = calculerVagues(PERSO, catalogue, 3, TABLES)
    const couts = calculerCouts(catalogue, vagueDe, new Set())
    expect(couts.get('Suite')).toBe(4)
  })

  it('« Fondation A » (aucun prérequis) coûte 1', () => {
    const catalogue = catalogueDeTest()
    const { vagueDe } = calculerVagues(PERSO, catalogue, 3, TABLES)
    const couts = calculerCouts(catalogue, vagueDe, new Set())
    expect(couts.get('Fondation A')).toBe(1)
  })
})

describe('construireGraphe — appelé deux fois, invariant 0/0/0', () => {
  it('zéro nœud à levier supérieur à son degré sortant dans la vue restreinte', () => {
    const catalogue = catalogueDeTest()
    const { vagueDe } = calculerVagues(PERSO, catalogue, 3, TABLES)
    const atteignables = new Set(vagueDe.keys())

    const { enfants: enfantsCatalogue } = construireGraphe(catalogue)
    const { enfants: enfantsVue } = construireGraphe(catalogue, atteignables)

    const leviersCatalogue = calculerLeviers(new Set(catalogue.keys()), enfantsCatalogue)
    const leviersVue = calculerLeviers(atteignables, enfantsVue)

    let nbLevierSurevalue = 0
    let nbSansArete = 0
    for (const nom of atteignables) {
      const degreSortantVue = enfantsVue.get(nom)?.size ?? 0
      if ((leviersVue.get(nom) ?? 0) > 0 && degreSortantVue === 0 && (enfantsCatalogue.get(nom)?.size ?? 0) > 0) {
        // Ce cas — un levier positif dans la vue sans arête dans la vue —
        // serait exactement le bug d'origine (leviersVue affiché à côté d'un
        // graphe qui ne montre pas ces arêtes).
        nbLevierSurevalue += 1
      }
      if (degreSortantVue === 0 && (leviersVue.get(nom) ?? 0) > 0) nbSansArete += 1
    }

    expect(nbLevierSurevalue).toBe(0)
    expect(nbSansArete).toBe(0)
    // The catalogue-wide leverage figure exists and may legitimately exceed
    // the view's — that gap is surfaced (levier vs levier_catalogue), not
    // hidden — but it must never be silently substituted for the view's own.
    expect(leviersCatalogue.get('Fondation A')).toBeGreaterThanOrEqual(leviersVue.get('Fondation A') ?? 0)
  })

  it('zéro voie nommée d’après un don non retenu dans la vue', () => {
    const catalogue = catalogueDeTest()
    const { vagueDe } = calculerVagues(PERSO, catalogue, 3, TABLES)
    const atteignables = new Set(vagueDe.keys())

    const { enfants, parents } = construireGraphe(catalogue, atteignables)
    const leviers = calculerLeviers(atteignables, enfants)
    const voies = calculerVoies(atteignables, leviers, parents)

    for (const hub of voies.values()) {
      expect(atteignables.has(hub)).toBe(true)
    }
  })

  it('l’« Isolé » n’a aucune arête dans aucun des deux graphes', () => {
    const catalogue = catalogueDeTest()
    const { enfants: enfantsCatalogue, parents: parentsCatalogue } = construireGraphe(catalogue)
    expect(enfantsCatalogue.get('Isolé')).toBeUndefined()
    expect(parentsCatalogue.get('Isolé')).toBeUndefined()
  })
})
