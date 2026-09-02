import { describe, expect, it } from 'vitest'

import type { LignePersonnage } from '@/lib/compte/distant'
import { versCharacter } from './vers-character'
import { evaluerExigence } from './moteur'
import type { TablesMoteur } from './types'

const LIGNE_BASE: LignePersonnage = {
  id: 'p1',
  nom: 'Test',
  classe: 'guerrier',
  niveau: 6,
  race: 'Humain',
  caracteristiques: { for: 16, dex: 12, con: 14, int: 10, sag: 10, cha: 8 },
  alignement: null,
  divinite: null,
  taille: null,
  dons_acquis: [],
}

const TABLES_VIDES: TablesMoteur = {
  lanceurs: {},
  maitrises: {},
  magie_des_dons: {},
  affinite_creature: {},
  restriction_de_classe: {},
  races: {},
  armes_raciales: {},
  reclassement_racial: {},
  progression_bba: {},
}

describe('versCharacter', () => {
  it('produit toujours un Set pour dons_connus, même pour dons_acquis vide', () => {
    const perso = versCharacter(LIGNE_BASE)
    expect(perso.dons_connus).toBeInstanceOf(Set)
    expect(perso.dons_connus?.size).toBe(0)
  })

  it('un prérequis de don non possédé vaut donc false, jamais null', () => {
    const perso = versCharacter(LIGNE_BASE)
    const [verdict] = evaluerExigence(
      { type: 'feat', segment: 'Endurance', verif_manuelle: false, charge: { feat_name: 'Endurance' } },
      perso,
      TABLES_VIDES,
    )
    expect(verdict).toBe(false)
  })

  it('ne fabrique pas d’alignement ou de divinité par défaut quand absents', () => {
    const perso = versCharacter(LIGNE_BASE)
    expect(perso.alignement).toBeUndefined()
    expect(perso.divinite).toBeUndefined()
  })

  it('remonte les caractéristiques sous les clés capitalisées attendues par le moteur', () => {
    const perso = versCharacter(LIGNE_BASE)
    expect(perso.caracteristiques).toEqual({
      For: 16,
      Dex: 12,
      Con: 14,
      Int: 10,
      Sag: 10,
      Cha: 8,
    })
  })
})
