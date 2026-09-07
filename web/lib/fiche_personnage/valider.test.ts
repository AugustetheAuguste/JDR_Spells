/**
 * Le validateur juge la forme, jamais la valeur de jeu. Les cas ci-dessous
 * suivent les critères de vérification de
 * build/fiche_personnage/07_SCHEMA_FICHE.md : refus nommé, accumulation des
 * refus, acceptation d'une fiche vide.
 */
import { describe, expect, it } from 'vitest'

import { creerFicheVide } from './fiche-vide'
import { valider } from './valider'

describe('valider, formes refusées', () => {
  it('refuse une entrée qui n’est pas un objet', () => {
    const verdict = valider('pas un objet')
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.refus.length).toBeGreaterThan(0)
    }
  })

  it('refuse un objet sans schemaVersion', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    const { schemaVersion: _schemaVersion, ...sansVersion } = fiche
    const verdict = valider(sansVersion)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.refus.some((refus) => refus.chemin === 'schemaVersion')).toBe(true)
    }
  })

  it('refuse une clé inconnue à la racine, en la nommant', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    const entree = { ...fiche, uneCleInconnue: 'valeur' }
    const verdict = valider(entree)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.refus.some((refus) => refus.chemin === 'uneCleInconnue')).toBe(true)
    }
  })

  it('refuse un modificateur à cinq clés', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    const entree = {
      ...fiche,
      defense: {
        ...fiche.defense,
        modificateursCA: [
          { libelle: 'bonus', valeur: 1, type: 'armure', origine: 'cuirasse', sourceUrl: null },
        ],
      },
    }
    const verdict = valider(entree)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(
        verdict.refus.some((refus) => refus.chemin === 'defense.modificateursCA[0]'),
      ).toBe(true)
    }
  })

  it('refuse un modificateur à sept clés', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    const entree = {
      ...fiche,
      defense: {
        ...fiche.defense,
        modificateursCA: [
          {
            libelle: 'bonus',
            valeur: 1,
            type: 'armure',
            origine: 'cuirasse',
            sourceUrl: null,
            saisieManuelle: false,
            cleSupplementaire: 'trop',
          },
        ],
      },
    }
    const verdict = valider(entree)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(
        verdict.refus.some((refus) => refus.chemin === 'defense.modificateursCA[0]'),
      ).toBe(true)
    }
  })

  it('refuse une valeur numérique passée en chaîne', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    const entree = {
      ...fiche,
      combat: { ...fiche.combat, pvMax: '12' },
    }
    const verdict = valider(entree)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.refus.some((refus) => refus.chemin === 'combat.pvMax')).toBe(true)
    }
  })

  it('refuse chaque mot interdit, un cas par mot', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    const mots = ['poids', 'charge', 'encombrement', 'actuel', 'restant', 'depense']
    for (const mot of mots) {
      const entree = { ...fiche, notes: fiche.notes, [`champ_${mot}`]: 1 }
      const verdict = valider(entree)
      expect(verdict.ok, `le mot interdit ${mot} devrait être refusé`).toBe(false)
    }
  })

  it('accumule plusieurs refus sans s’arrêter au premier', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    const entree = {
      ...fiche,
      uneCleInconnue: 'x',
      combat: { ...fiche.combat, pvMax: '12' },
    }
    const verdict = valider(entree)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.refus.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('valider, formes acceptées', () => {
  it('accepte une fiche vide fraîchement construite', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    const verdict = valider(fiche)
    expect(verdict.ok).toBe(true)
  })
})
