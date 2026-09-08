import { describe, expect, it } from 'vitest'

import type { TablesRegles } from './regles'
import { creerFicheVide } from './fiche-vide'
import {
  initiative,
  manoeuvreDefensive,
  manoeuvreOffensive,
  pointsDeVieMaximum,
  resistanceMagie,
} from './combat'

const TABLE_VALEURS = { valeurs: { '14': 2, '16': 3, '10': 0 } }

function tables(): TablesRegles {
  return { typesBonus: [], modificateursCarac: TABLE_VALEURS, sortsBonus: null, armures: null, progressionClasses: null }
}

describe('initiative', () => {
  it('rend le modificateur de Dextérité', () => {
    const base = creerFicheVide('c1', '2026-09-08')
    const fiche = { ...base, caracteristiques: { ...base.caracteristiques, dexterite: { base: 14, modificateurs: [] } } }
    expect(initiative(fiche, tables()).total).toBe(2)
  })

  it('rend introuvable sans base de Dextérité', () => {
    const fiche = creerFicheVide('c2', '2026-09-08')
    const resultat = initiative(fiche, tables())
    expect(resultat.total).toBeNull()
  })
})

describe('pointsDeVieMaximum', () => {
  it('rend la valeur saisie', () => {
    const base = creerFicheVide('c3', '2026-09-08')
    const fiche = { ...base, combat: { ...base.combat, pvMax: 42 } }
    expect(pointsDeVieMaximum(fiche).total).toBe(42)
  })

  it('rend introuvable, jamais 0, sans valeur saisie', () => {
    const fiche = creerFicheVide('c4', '2026-09-08')
    expect(pointsDeVieMaximum(fiche).total).toBeNull()
  })
})

describe('resistanceMagie', () => {
  it('rend introuvable, jamais 0, sans valeur saisie', () => {
    const fiche = creerFicheVide('c5', '2026-09-08')
    const resultat = resistanceMagie(fiche)
    expect(resultat.total).toBeNull()
    expect(resultat.manquants).toEqual(['combat.resistanceMagie'])
  })

  it('rend la valeur saisie', () => {
    const base = creerFicheVide('c6', '2026-09-08')
    const fiche = { ...base, combat: { ...base.combat, resistanceMagie: 15 } }
    expect(resistanceMagie(fiche).total).toBe(15)
  })
})

describe('manoeuvreOffensive', () => {
  it('BMO = BBA + modificateur de Force + modificateur de taille', () => {
    const base = creerFicheVide('c7', '2026-09-08')
    const fiche = {
      ...base,
      identite: { ...base.identite, taille: 'Moyenne' },
      combat: { ...base.combat, bbaBase: 5 },
      caracteristiques: { ...base.caracteristiques, force: { base: 16, modificateurs: [] } },
    }
    expect(manoeuvreOffensive(fiche, tables()).total).toBe(8)
  })

  it('utilise la Dextérité pour une créature très petite ou plus petite', () => {
    const base = creerFicheVide('c8', '2026-09-08')
    const fiche = {
      ...base,
      identite: { ...base.identite, taille: 'Très petite' },
      combat: { ...base.combat, bbaBase: 5 },
      caracteristiques: { ...base.caracteristiques, dexterite: { base: 14, modificateurs: [] } },
    }
    const resultat = manoeuvreOffensive(fiche, tables())
    // 5 bba + 2 dex + (-2 taille TP) = 5
    expect(resultat.total).toBe(5)
  })

  it('rend introuvable sans BBA', () => {
    const fiche = creerFicheVide('c9', '2026-09-08')
    expect(manoeuvreOffensive(fiche, tables()).total).toBeNull()
  })
})

describe('manoeuvreDefensive', () => {
  it('DDM = 10 + BBA + Force + Dextérité + taille', () => {
    const base = creerFicheVide('c10', '2026-09-08')
    const fiche = {
      ...base,
      identite: { ...base.identite, taille: 'Moyenne' },
      combat: { ...base.combat, bbaBase: 5 },
      caracteristiques: {
        ...base.caracteristiques,
        force: { base: 16, modificateurs: [] },
        dexterite: { base: 14, modificateurs: [] },
      },
    }
    expect(manoeuvreDefensive(fiche, tables()).total).toBe(10 + 5 + 3 + 2 + 0)
  })
})
