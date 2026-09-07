import { describe, expect, it } from 'vitest'

import type { EntreeCaracteristique, Modificateur } from './schema'
import type { ModificateursCaracteristiques, TypeBonus } from './regles'
import { modificateurCaracteristique, valeurEffectiveCaracteristique } from './caracteristiques'

function modificateur(partiel: Partial<Modificateur> & { libelle: string; valeur: number; type: string }): Modificateur {
  return {
    origine: partiel.origine ?? 'test',
    sourceUrl: partiel.sourceUrl ?? null,
    saisieManuelle: partiel.saisieManuelle ?? false,
    ...partiel,
  }
}

const TABLE_BORNES: ModificateursCaracteristiques = {
  bornes: [
    { min: 8, max: 9, modificateur: -1 },
    { min: 10, max: 11, modificateur: 0 },
    { min: 12, max: 13, modificateur: 1 },
  ],
}

const TABLE_VALEURS: ModificateursCaracteristiques = {
  valeurs: { '10': 0, '12': 1 },
}

const TYPE_CUMULABLE: TypeBonus = { cle: 'esquive', libelle: 'Bonus d’esquive', cumulable: true, note: '' }

describe('modificateurCaracteristique', () => {
  it('rend introuvable quand la valeur est null', () => {
    const resultat = modificateurCaracteristique(null, TABLE_BORNES)
    expect(resultat.total).toBeNull()
    expect(resultat.manquants).toEqual(['valeur'])
  })

  it('rend introuvable quand la table est null', () => {
    const resultat = modificateurCaracteristique(14, null)
    expect(resultat.total).toBeNull()
    expect(resultat.manquants).toEqual(['modificateurs_caracteristiques'])
  })

  it('lit la borne correspondante', () => {
    const resultat = modificateurCaracteristique(12, TABLE_BORNES)
    expect(resultat.total).toBe(1)
    expect(resultat.detail).toHaveLength(1)
    const [contribution] = resultat.detail
    expect(contribution?.retenue).toBe(true)
    expect(contribution?.motifEcart).toBeNull()
  })

  it('rend introuvable, sans extrapoler, pour une valeur hors des bornes lues', () => {
    const resultat = modificateurCaracteristique(999, TABLE_BORNES)
    expect(resultat.total).toBeNull()
    expect(resultat.manquants).toEqual(['valeur hors des bornes lues'])
  })

  it('lit la forme valeurs', () => {
    const resultat = modificateurCaracteristique(12, TABLE_VALEURS)
    expect(resultat.total).toBe(1)
  })

  it('rend introuvable pour une clé absente de la forme valeurs, jamais 0', () => {
    const resultat = modificateurCaracteristique(15, TABLE_VALEURS)
    expect(resultat.total).toBeNull()
    expect(resultat.manquants).toEqual(['valeur hors des bornes lues'])
  })
})

describe('valeurEffectiveCaracteristique', () => {
  it('rend introuvable quand la base est absente', () => {
    const entree: EntreeCaracteristique = { base: null, modificateurs: [] }
    const resultat = valeurEffectiveCaracteristique(entree, [TYPE_CUMULABLE])
    expect(resultat.total).toBeNull()
    expect(resultat.manquants).toEqual(['base'])
  })

  it('additionne la base et le total résolu des modificateurs', () => {
    const entree: EntreeCaracteristique = {
      base: 14,
      modificateurs: [modificateur({ libelle: 'Anneau', valeur: 2, type: 'esquive' })],
    }
    const resultat = valeurEffectiveCaracteristique(entree, [TYPE_CUMULABLE])
    expect(resultat.total).toBe(16)
  })

  it('propage introuvable quand la table des types de bonus manque', () => {
    const entree: EntreeCaracteristique = {
      base: 14,
      modificateurs: [modificateur({ libelle: 'Anneau', valeur: 2, type: 'esquive' })],
    }
    const resultat = valeurEffectiveCaracteristique(entree, null)
    expect(resultat.total).toBeNull()
    expect(resultat.manquants).toEqual(['types_bonus'])
  })
})
