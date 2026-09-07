import { describe, expect, it } from 'vitest'

import type { TablesRegles } from './regles'
import { creerFicheVide } from './fiche-vide'
import { sauvegarde } from './sauvegardes'

const TABLE_VALEURS = { valeurs: { '14': 2, '10': 0 } }

function tables(): TablesRegles {
  return { typesBonus: [], modificateursCarac: TABLE_VALEURS, sortsBonus: null, armures: null, progressionClasses: null }
}

describe('sauvegarde', () => {
  it('additionne la base et le modificateur de la caractéristique associée', () => {
    const base = creerFicheVide('s1', '2026-09-08')
    const fiche = {
      ...base,
      caracteristiques: { ...base.caracteristiques, dexterite: { base: 14, modificateurs: [] } },
      sauvegardes: { ...base.sauvegardes, reflexes: { base: 3, modificateurs: [] } },
    }
    const resultat = sauvegarde(fiche, 'reflexes', tables())
    expect(resultat.total).toBe(5)
  })

  it('associe Vigueur à Constitution', () => {
    const base = creerFicheVide('s2', '2026-09-08')
    const fiche = {
      ...base,
      caracteristiques: { ...base.caracteristiques, constitution: { base: 14, modificateurs: [] } },
      sauvegardes: { ...base.sauvegardes, vigueur: { base: 2, modificateurs: [] } },
    }
    expect(sauvegarde(fiche, 'vigueur', tables()).total).toBe(4)
  })

  it('associe Volonté à Sagesse', () => {
    const base = creerFicheVide('s3', '2026-09-08')
    const fiche = {
      ...base,
      caracteristiques: { ...base.caracteristiques, sagesse: { base: 14, modificateurs: [] } },
      sauvegardes: { ...base.sauvegardes, volonte: { base: 1, modificateurs: [] } },
    }
    expect(sauvegarde(fiche, 'volonte', tables()).total).toBe(3)
  })

  it('rend introuvable quand la base est null, jamais le seul modificateur de caractéristique', () => {
    const base = creerFicheVide('s4', '2026-09-08')
    const fiche = {
      ...base,
      caracteristiques: { ...base.caracteristiques, dexterite: { base: 14, modificateurs: [] } },
    }
    const resultat = sauvegarde(fiche, 'reflexes', tables())
    expect(resultat.total).toBeNull()
    expect(resultat.manquants).toEqual(['sauvegardes.reflexes.base'])
  })
})
