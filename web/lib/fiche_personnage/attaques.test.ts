import { describe, expect, it } from 'vitest'

import type { Attaque } from './schema'
import type { TablesRegles } from './regles'
import { creerFicheVide } from './fiche-vide'
import { attaquesCompletes, bonusAttaque, bonusDegats, serieAttaques } from './attaques'

const TABLE_VALEURS = { valeurs: { '16': 3, '14': 2, '10': 0 } }

function tables(progressionClasses: unknown = null): TablesRegles {
  return {
    typesBonus: [],
    modificateursCarac: TABLE_VALEURS,
    sortsBonus: null,
    armures: null,
    progressionClasses,
  }
}

function attaque(partiel: Partial<Attaque> = {}): Attaque {
  return {
    nom: 'Épée longue',
    type: 'corpsACorps',
    caracteristiqueAttaque: 'force',
    caracteristiqueDegats: 'force',
    des: '1d8',
    critique: { plage: '20', multiplicateur: 2 },
    portee: '',
    modificateursAttaque: [],
    modificateursDegats: [],
    source: 'maison',
    ref: null,
    ...partiel,
  }
}

describe('serieAttaques', () => {
  it('rend introuvable, jamais une liste vide, quand bbaBase est null', () => {
    const resultat = serieAttaques(null, tables())
    expect(resultat).toHaveLength(1)
    expect(resultat[0]?.total).toBeNull()
  })

  it('applique le décrément de 5 par attaque supplémentaire', () => {
    const resultat = serieAttaques(16, tables())
    expect(resultat.map((r) => r.total)).toEqual([16, 11, 6, 1])
  })

  it('une seule attaque sous le seuil de +6', () => {
    const resultat = serieAttaques(5, tables())
    expect(resultat.map((r) => r.total)).toEqual([5])
  })

  it('lit la série dans progression_classes.json quand la classe est connue', () => {
    const progression = {
      guerrier: {
        progression: [{ niveau: 16, bba: 16, bba_serie: ['+16', '+11', '+6', '+1'] }],
      },
    }
    const resultat = serieAttaques(16, tables(progression), { slug: 'guerrier', niveau: 16 })
    expect(resultat.map((r) => r.total)).toEqual([16, 11, 6, 1])
    expect(resultat[0]?.detail[0]?.type).toBe('bba_serie')
  })
})

describe('bonusAttaque', () => {
  it('BBA + modificateur de la caractéristique d’attaque + taille', () => {
    const base = creerFicheVide('a1', '2026-09-08')
    const fiche = {
      ...base,
      identite: { ...base.identite, taille: 'Moyenne' },
      combat: { ...base.combat, bbaBase: 5 },
      caracteristiques: { ...base.caracteristiques, force: { base: 16, modificateurs: [] } },
    }
    const resultat = bonusAttaque(fiche, attaque(), tables())
    expect(resultat.total).toBe(8)
  })

  it('une attaque à distance ne diffère que par la caractéristique portée par l’attaque', () => {
    const base = creerFicheVide('a2', '2026-09-08')
    const fiche = {
      ...base,
      identite: { ...base.identite, taille: 'Moyenne' },
      combat: { ...base.combat, bbaBase: 5 },
      caracteristiques: { ...base.caracteristiques, dexterite: { base: 16, modificateurs: [] } },
    }
    const resultat = bonusAttaque(
      fiche,
      attaque({ type: 'distance', caracteristiqueAttaque: 'dexterite' }),
      tables(),
    )
    expect(resultat.total).toBe(8)
  })

  it('rend introuvable sans BBA', () => {
    const fiche = creerFicheVide('a3', '2026-09-08')
    expect(bonusAttaque(fiche, attaque(), tables()).total).toBeNull()
  })
})

describe('bonusDegats', () => {
  it('modificateur de la caractéristique de dégâts, sans recalcul du dé', () => {
    const base = creerFicheVide('a4', '2026-09-08')
    const fiche = { ...base, caracteristiques: { ...base.caracteristiques, force: { base: 16, modificateurs: [] } } }
    const resultat = bonusDegats(fiche, attaque(), tables())
    expect(resultat.total).toBe(3)
  })
})

describe('attaquesCompletes', () => {
  it('une entrée par attaque de la série, mêmes contributions hors bonus de base', () => {
    const base = creerFicheVide('a5', '2026-09-08')
    const fiche = {
      ...base,
      identite: { ...base.identite, taille: 'Moyenne' },
      combat: { ...base.combat, bbaBase: 6 },
      caracteristiques: { ...base.caracteristiques, force: { base: 16, modificateurs: [] } },
      attaques: [attaque()],
    }
    const [resultat] = attaquesCompletes(fiche, tables())
    expect(resultat?.bonusParAttaque.map((r) => r.total)).toEqual([9, 4])
  })
})
