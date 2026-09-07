import { describe, expect, it } from 'vitest'

import type { Modificateur } from './schema'
import type { TypeBonus } from './regles'
import { resoudre } from './resoudre'

function modificateur(partiel: Partial<Modificateur> & { libelle: string; valeur: number; type: string }): Modificateur {
  return {
    origine: partiel.origine ?? 'test',
    sourceUrl: partiel.sourceUrl ?? null,
    saisieManuelle: partiel.saisieManuelle ?? false,
    ...partiel,
  }
}

const TYPE_CUMULABLE: TypeBonus = { cle: 'esquive', libelle: 'Bonus d’esquive', cumulable: true, note: '' }
const TYPE_NON_CUMULABLE: TypeBonus = { cle: 'alteration', libelle: 'Bonus d’altération', cumulable: false, note: '' }
const TYPE_NON_TRANCHE: TypeBonus = { cle: 'taille', libelle: 'Bonus de taille', cumulable: null, note: '' }

describe('resoudre, table des types de bonus introuvable', () => {
  it('rend total null, aucune contribution retenue, manquants contient types_bonus', () => {
    const modificateurs = [modificateur({ libelle: 'Anneau', valeur: 2, type: 'alteration' })]
    const resultat = resoudre(modificateurs, null)
    expect(resultat.total).toBeNull()
    expect(resultat.detail).toHaveLength(1)
    const [contribution] = resultat.detail
    expect(contribution?.retenue).toBe(false)
    expect(contribution?.motifEcart).not.toBeNull()
    expect(resultat.manquants).toEqual(['types_bonus'])
  })
})

describe('resoudre, liste vide', () => {
  // Cas 8 du plan : l'absence de modificateur est une information complète,
  // le seul zéro légitime de cette étape — pas une lacune signalée par null.
  it('rend total 0 sans lacune', () => {
    const resultat = resoudre([], [TYPE_CUMULABLE])
    expect(resultat.total).toBe(0)
    expect(resultat.detail).toEqual([])
    expect(resultat.manquants).toEqual([])
  })
})

describe('resoudre, type cumulable', () => {
  it('retient les deux bonus et somme leurs valeurs', () => {
    const modificateurs = [
      modificateur({ libelle: 'Anneau', valeur: 2, type: 'esquive' }),
      modificateur({ libelle: 'Talent', valeur: 1, type: 'esquive' }),
    ]
    const resultat = resoudre(modificateurs, [TYPE_CUMULABLE])
    expect(resultat.total).toBe(3)
    expect(resultat.detail.every((c) => c.retenue)).toBe(true)
    expect(resultat.detail.every((c) => c.motifEcart === null)).toBe(true)
  })
})

describe('resoudre, type non cumulable, deux bonus', () => {
  it('retient le plus élevé, écarte l’autre avec un motif', () => {
    const modificateurs = [
      modificateur({ libelle: 'Petit anneau', valeur: 1, type: 'alteration' }),
      modificateur({ libelle: 'Grand anneau', valeur: 3, type: 'alteration' }),
    ]
    const resultat = resoudre(modificateurs, [TYPE_NON_CUMULABLE])
    expect(resultat.total).toBe(3)
    const retenu = resultat.detail.find((c) => c.libelle === 'Grand anneau')
    const ecarte = resultat.detail.find((c) => c.libelle === 'Petit anneau')
    expect(retenu?.retenue).toBe(true)
    expect(retenu?.motifEcart).toBeNull()
    expect(ecarte?.retenue).toBe(false)
    expect(ecarte?.motifEcart).toBeTruthy()
  })
})

describe('resoudre, type non cumulable, bonus et malus', () => {
  it('retient les deux : un malus ne disparaît jamais derrière un bonus', () => {
    const modificateurs = [
      modificateur({ libelle: 'Anneau', valeur: 3, type: 'alteration' }),
      modificateur({ libelle: 'Malédiction', valeur: -2, type: 'alteration' }),
    ]
    const resultat = resoudre(modificateurs, [TYPE_NON_CUMULABLE])
    expect(resultat.total).toBe(1)
    expect(resultat.detail.every((c) => c.retenue)).toBe(true)
  })

  it('retient le pire malus et écarte le moindre, avec motif', () => {
    const modificateurs = [
      modificateur({ libelle: 'Petite malédiction', valeur: -1, type: 'alteration' }),
      modificateur({ libelle: 'Grande malédiction', valeur: -4, type: 'alteration' }),
    ]
    const resultat = resoudre(modificateurs, [TYPE_NON_CUMULABLE])
    expect(resultat.total).toBe(-4)
    const retenu = resultat.detail.find((c) => c.libelle === 'Grande malédiction')
    const ecarte = resultat.detail.find((c) => c.libelle === 'Petite malédiction')
    expect(retenu?.retenue).toBe(true)
    expect(ecarte?.retenue).toBe(false)
    expect(ecarte?.motifEcart).toBeTruthy()
  })
})

describe('resoudre, type inconnu de la table', () => {
  it('retient la contribution et ajoute le type à manquants', () => {
    const modificateurs = [modificateur({ libelle: 'Mystère', valeur: 2, type: 'inconnu' })]
    const resultat = resoudre(modificateurs, [TYPE_CUMULABLE])
    const [contribution] = resultat.detail
    expect(contribution?.retenue).toBe(true)
    expect(contribution?.motifEcart).toBeNull()
    expect(resultat.manquants).toEqual(['inconnu'])
  })
})

describe('resoudre, cumulable non tranché par la source', () => {
  it('retient tout et ajoute le type à manquants', () => {
    const modificateurs = [
      modificateur({ libelle: 'Grand gabarit', valeur: 2, type: 'taille' }),
      modificateur({ libelle: 'Autre effet', valeur: 1, type: 'taille' }),
    ]
    const resultat = resoudre(modificateurs, [TYPE_NON_TRANCHE])
    expect(resultat.detail.every((c) => c.retenue)).toBe(true)
    expect(resultat.manquants).toEqual(['taille'])
  })
})

describe('resoudre, contrat sur motifEcart', () => {
  it('aucune contribution écartée sans motif', () => {
    const modificateurs = [
      modificateur({ libelle: 'Petit anneau', valeur: 1, type: 'alteration' }),
      modificateur({ libelle: 'Grand anneau', valeur: 3, type: 'alteration' }),
    ]
    const resultat = resoudre(modificateurs, [TYPE_NON_CUMULABLE])
    for (const contribution of resultat.detail) {
      if (!contribution.retenue) {
        expect(contribution.motifEcart).not.toBeNull()
      }
    }
  })
})

describe('resoudre, ordre du détail', () => {
  it('conserve l’ordre d’entrée, jamais un ordre trié', () => {
    const modificateurs = [
      modificateur({ libelle: 'Z', valeur: 1, type: 'esquive' }),
      modificateur({ libelle: 'A', valeur: 2, type: 'esquive' }),
    ]
    const resultat = resoudre(modificateurs, [TYPE_CUMULABLE])
    expect(resultat.detail.map((c) => c.libelle)).toEqual(['Z', 'A'])
  })
})
