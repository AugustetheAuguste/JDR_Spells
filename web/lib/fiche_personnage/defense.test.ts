import { describe, expect, it } from 'vitest'

import type { Modificateur } from './schema'
import type { TablesRegles, TypeBonus } from './regles'
import { creerFicheVide } from './fiche-vide'
import { classeArmure, vitesse } from './defense'

function modificateur(partiel: Partial<Modificateur> & { libelle: string; valeur: number; type: string }): Modificateur {
  return {
    origine: partiel.origine ?? 'test',
    sourceUrl: partiel.sourceUrl ?? null,
    saisieManuelle: partiel.saisieManuelle ?? false,
    ...partiel,
  }
}

const TYPES_BONUS: readonly TypeBonus[] = [
  { cle: 'esquive', libelle: 'Bonus d’esquive', cumulable: true, note: '' },
  { cle: 'armure_naturelle', libelle: 'Bonus d’armure naturelle', cumulable: null, note: '' },
]

const TABLE_VALEURS = { valeurs: { '14': 2, '10': 0 } }

function tables(armures: unknown = null): TablesRegles {
  return {
    typesBonus: TYPES_BONUS,
    modificateursCarac: TABLE_VALEURS,
    sortsBonus: null,
    armures,
    progressionClasses: null,
  }
}

const ARMURES_TEST = {
  armures: [
    {
      nom: 'Armure de cuir',
      categorie: 'legere',
      vitesse_par_base: { '9 m': '9 m (6 c)', '6 m': '6 m (4 c)' },
    },
    {
      nom: 'Cotte de mailles',
      categorie: 'intermediaire',
      vitesse_par_base: { '9 m': '6 m (4 c)', '6 m': '4,5 m (3 c)' },
    },
  ],
}

describe('classeArmure', () => {
  it('somme base, armure, bouclier, Dextérité et taille', () => {
    const fiche = {
      ...creerFicheVide('f1', '2026-09-08'),
      identite: { ...creerFicheVide('f1', '2026-09-08').identite, taille: 'Moyenne' },
      caracteristiques: {
        ...creerFicheVide('f1', '2026-09-08').caracteristiques,
        dexterite: { base: 14, modificateurs: [] },
      },
      defense: {
        armure: { nom: 'Armure de cuir', bonusCA: 2, bonusDexMax: null, malusTests: 0, categorie: 'legere' },
        bouclier: { nom: 'Écu', bonusCA: 2, malusTests: -2 },
        modificateursCA: [],
      },
    }
    const resultat = classeArmure(fiche, tables())
    // 10 base + 2 armure + 2 bouclier + 2 dex + 0 taille
    expect(resultat.totale.total).toBe(16)
  })

  it('plafonne le modificateur de Dextérité par bonusDexMax, sans le raboter en silence', () => {
    const base = creerFicheVide('f2', '2026-09-08')
    const fiche = {
      ...base,
      identite: { ...base.identite, taille: 'Moyenne' },
      caracteristiques: { ...base.caracteristiques, dexterite: { base: 14, modificateurs: [] } },
      defense: {
        armure: { nom: 'Cuirasse', bonusCA: 6, bonusDexMax: 1, malusTests: -4, categorie: 'intermediaire' },
        bouclier: null,
        modificateursCA: [],
      },
    }
    const resultat = classeArmure(fiche, tables())
    const plafonnee = resultat.totale.detail.find((c) => c.type === 'dexterite' && !c.retenue)
    const retenue = resultat.totale.detail.find((c) => c.type === 'dexterite' && c.retenue)
    expect(plafonnee?.valeur).toBe(2)
    expect(plafonnee?.motifEcart).toMatch(/\+1/)
    expect(retenue?.valeur).toBe(1)
    // 10 base + 0 armure(non renseigné -> manquant) ... on vérifie juste le plafond ici
  })

  it('la CA en contact retire armure, bouclier et armure naturelle, présents mais non retenus', () => {
    const base = creerFicheVide('f3', '2026-09-08')
    const fiche = {
      ...base,
      identite: { ...base.identite, taille: 'Moyenne' },
      caracteristiques: { ...base.caracteristiques, dexterite: { base: 10, modificateurs: [] } },
      defense: {
        armure: { nom: 'Armure de cuir', bonusCA: 2, bonusDexMax: null, malusTests: 0, categorie: 'legere' },
        bouclier: { nom: 'Écu', bonusCA: 2, malusTests: -2 },
        modificateursCA: [modificateur({ libelle: 'Carapace', valeur: 1, type: 'armure_naturelle' })],
      },
    }
    const resultat = classeArmure(fiche, tables())
    const armureContact = resultat.contact.detail.find((c) => c.type === 'armure')
    const naturelleContact = resultat.contact.detail.find((c) => c.type === 'armure_naturelle')
    expect(armureContact?.retenue).toBe(false)
    expect(naturelleContact?.retenue).toBe(false)
    expect(resultat.contact.total).toBe(resultat.totale.total !== null ? resultat.totale.total! - 2 - 2 - 1 : null)
  })

  it('pris au dépourvu retire la Dextérité, présente mais non retenue', () => {
    const base = creerFicheVide('f4', '2026-09-08')
    const fiche = {
      ...base,
      identite: { ...base.identite, taille: 'Moyenne' },
      caracteristiques: { ...base.caracteristiques, dexterite: { base: 14, modificateurs: [] } },
      defense: { armure: null, bouclier: null, modificateursCA: [] },
    }
    const resultat = classeArmure(fiche, tables())
    const dex = resultat.prisAuDepourvu.detail.find((c) => c.type === 'dexterite')
    expect(dex?.retenue).toBe(false)
    expect(resultat.prisAuDepourvu.total).toBe(resultat.totale.total !== null ? resultat.totale.total! - 2 : null)
  })

  it('rend introuvable quand la taille est absente de la table lue', () => {
    const base = creerFicheVide('f5', '2026-09-08')
    const fiche = { ...base, identite: { ...base.identite, taille: 'inconnue' } }
    const resultat = classeArmure(fiche, tables())
    expect(resultat.totale.total).toBeNull()
    expect(resultat.totale.manquants).toContain('identite.taille')
  })
})

describe('vitesse', () => {
  it('rend la vitesse de base sans catégorie d’armure renseignée', () => {
    const base = creerFicheVide('f6', '2026-09-08')
    const fiche = { ...base, combat: { ...base.combat, vitesseBase: 9 } }
    const resultat = vitesse(fiche, tables(ARMURES_TEST))
    expect(resultat.total).toBe(9)
  })

  it('lit la vitesse résultante pour la catégorie d’armure portée', () => {
    const base = creerFicheVide('f7', '2026-09-08')
    const fiche = {
      ...base,
      combat: { ...base.combat, vitesseBase: 9 },
      defense: {
        armure: { nom: 'Cotte de mailles', bonusCA: 6, bonusDexMax: 2, malusTests: -5, categorie: 'intermediaire' },
        bouclier: null,
        modificateursCA: [],
      },
    }
    const resultat = vitesse(fiche, tables(ARMURES_TEST))
    expect(resultat.total).toBe(6)
  })

  it('rend introuvable pour une base absente de la table', () => {
    const base = creerFicheVide('f8', '2026-09-08')
    const fiche = {
      ...base,
      combat: { ...base.combat, vitesseBase: 12 },
      defense: {
        armure: { nom: 'Armure de cuir', bonusCA: 2, bonusDexMax: null, malusTests: 0, categorie: 'legere' },
        bouclier: null,
        modificateursCA: [],
      },
    }
    const resultat = vitesse(fiche, tables(ARMURES_TEST))
    expect(resultat.total).toBeNull()
  })
})
