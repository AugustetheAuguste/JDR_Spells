import { describe, expect, it } from 'vitest'

import { creerFicheVide } from './fiche-vide'
import type { ClasseFiche, Fiche } from './schema'
import type { ModificateursCaracteristiques, TypeBonus } from './regles'
import type { TablesRegles } from './regles'
import {
  degreDeDifficulte,
  emplacementsBonus,
  emplacementsDeBase,
  emplacementsTotaux,
  niveauLanceur,
  sortsConnus,
} from './sorts'

const TYPES_BONUS: readonly TypeBonus[] = [
  { cle: 'ameliore', libelle: 'Bonus amélioré', cumulable: true, note: '' },
]

const MODIFICATEURS_CARAC: ModificateursCaracteristiques = {
  bornes: [
    { min: 10, max: 11, modificateur: 0 },
    { min: 16, max: 17, modificateur: 3 },
    { min: 30, max: 30, modificateur: 100 },
  ],
}

const SORTS_BONUS = {
  par_modificateur: {
    '3': { '0': null, '1': 1, '2': 1, '3': 1 },
  },
}

const PROGRESSION_CLASSES = {
  magicien: {
    genre_table_sorts: 'sorts_par_jour',
    emplacements: {
      '5': { '0': 4, '1': 3, '2': 2, '3': 1, '4': null },
    },
  },
  guerrier: {
    genre_table_sorts: null,
    emplacements: null,
  },
  barde: {
    genre_table_sorts: 'sorts_connus',
    emplacements: {
      '3': { '0': 4, '1': 3, '2': null },
    },
  },
  pretre: {
    genre_table_sorts: 'sorts_par_jour',
    emplacements: {
      '3': { '0': 3, '1': 2 },
    },
  },
}

function tables(partiel: Partial<TablesRegles> = {}): TablesRegles {
  return {
    typesBonus: TYPES_BONUS,
    modificateursCarac: MODIFICATEURS_CARAC,
    sortsBonus: SORTS_BONUS,
    armures: null,
    progressionClasses: PROGRESSION_CLASSES,
    ...partiel,
  }
}

function classe(partiel: Partial<ClasseFiche> & { nom: string }): ClasseFiche {
  return { niveau: null, archetype: null, source: 'pathfinder-fr', ref: null, ...partiel }
}

function ficheMagicien(niveau = 5): Fiche {
  const fiche = creerFicheVide('f1', '2026-09-08T00:00:00.000Z')
  return {
    ...fiche,
    identite: { ...fiche.identite, classes: [classe({ nom: 'Magicien', niveau })] },
    caracteristiques: {
      ...fiche.caracteristiques,
      intelligence: { base: 16, modificateurs: [] },
    },
    sorts: { ...fiche.sorts, caracteristiqueIncantation: 'intelligence' },
  }
}

describe('emplacementsDeBase', () => {
  it('lit la table de la classe, le niveau de sort 0 compris', () => {
    const resultat = emplacementsDeBase(ficheMagicien(), tables())
    expect(resultat.parNiveauDeSort.get(0)).toBe(4)
    expect(resultat.parNiveauDeSort.has(0)).toBe(true)
  })

  it('garde une cellule null, jamais 0', () => {
    const resultat = emplacementsDeBase(ficheMagicien(), tables())
    expect(resultat.parNiveauDeSort.get(4)).toBeNull()
  })

  it('rend introuvable, nommant le slug, pour une classe absente de la table', () => {
    const fiche = creerFicheVide('f2', '2026-09-08T00:00:00.000Z')
    const avecClasseInconnue: Fiche = {
      ...fiche,
      identite: { ...fiche.identite, classes: [classe({ nom: 'Nécromancien inventé', niveau: 3 })] },
    }
    const resultat = emplacementsDeBase(avecClasseInconnue, tables())
    expect(resultat.manquants).toContain('necromancien_invente')
    expect(resultat.parClasse[0]?.etat).toBe('introuvable')
  })

  it('distingue une classe non lanceuse d’une classe introuvable', () => {
    const fiche = creerFicheVide('f3', '2026-09-08T00:00:00.000Z')
    const guerrier: Fiche = {
      ...fiche,
      identite: { ...fiche.identite, classes: [classe({ nom: 'Guerrier', niveau: 4 })] },
    }
    const resultat = emplacementsDeBase(guerrier, tables())
    expect(resultat.parClasse[0]?.etat).toBe('non_lanceuse')
    expect(resultat.parClasse[0]?.etat).not.toBe('introuvable')
    expect(resultat.manquants).toEqual([])
    expect(resultat.parNiveauDeSort.size).toBe(0)
  })
})

describe('emplacementsBonus', () => {
  it('rend introuvable quand la caractéristique d’incantation est absente', () => {
    const fiche = creerFicheVide('f4', '2026-09-08T00:00:00.000Z')
    const resultat = emplacementsBonus(fiche, tables())
    expect(resultat.parNiveauDeSort.size).toBe(0)
    expect(resultat.manquants.length).toBeGreaterThan(0)
  })

  it('lit la ligne du modificateur de caractéristique effectif', () => {
    const resultat = emplacementsBonus(ficheMagicien(), tables())
    expect(resultat.parNiveauDeSort.get(1)).toBe(1)
    expect(resultat.manquants).toEqual([])
  })

  it('rend introuvable, sans extrapoler, au-delà du modificateur maximal lu', () => {
    const fiche = ficheMagicien()
    const ficheModificateurEnorme: Fiche = {
      ...fiche,
      caracteristiques: { ...fiche.caracteristiques, intelligence: { base: 30, modificateurs: [] } },
    }
    const resultat = emplacementsBonus(ficheModificateurEnorme, tables())
    expect(resultat.parNiveauDeSort.size).toBe(0)
    expect(resultat.manquants.length).toBeGreaterThan(0)
  })
})

describe('emplacementsTotaux', () => {
  it('additionne base et bonus quand la base existe', () => {
    const resultat = emplacementsTotaux(ficheMagicien(), tables())
    expect(resultat.get(1)?.total).toBe(4) // 3 de base + 1 bonus
  })

  it('n’ajoute jamais un bonus à un niveau de sort sans base', () => {
    const resultat = emplacementsTotaux(ficheMagicien(), tables())
    expect(resultat.get(4)?.total).toBeNull()
  })

  it('propage introuvable pour tous les niveaux quand la base est introuvable', () => {
    const fiche = creerFicheVide('f5', '2026-09-08T00:00:00.000Z')
    const avecClasseInconnue: Fiche = {
      ...fiche,
      identite: { ...fiche.identite, classes: [classe({ nom: 'Inconnue', niveau: 1 })] },
    }
    const resultat = emplacementsTotaux(avecClasseInconnue, tables())
    expect(resultat.get(0)?.total).toBeNull()
    expect(resultat.get(0)?.manquants).toContain('inconnue')
  })
})

describe('degreDeDifficulte', () => {
  it('calcule 10 + niveau du sort + modificateur de caractéristique', () => {
    const resultat = degreDeDifficulte(ficheMagicien(), 3, tables())
    expect(resultat.total).toBe(16) // 10 + 3 + 3
  })

  it('rend introuvable quand le modificateur de caractéristique est introuvable', () => {
    const fiche = creerFicheVide('f6', '2026-09-08T00:00:00.000Z')
    const resultat = degreDeDifficulte(fiche, 3, tables())
    expect(resultat.total).toBeNull()
  })
})

describe('niveauLanceur', () => {
  it('priorise une saisie manuelle', () => {
    const fiche = ficheMagicien()
    const avecSaisie: Fiche = { ...fiche, sorts: { ...fiche.sorts, niveauLanceur: 12 } }
    const resultat = niveauLanceur(avecSaisie, tables())
    expect(resultat.total).toBe(12)
  })

  it('déduit le niveau de lanceur d’une unique classe lanceuse', () => {
    const resultat = niveauLanceur(ficheMagicien(), tables())
    expect(resultat.total).toBe(5)
  })

  it('rend introuvable avec un motif pour deux classes lanceuses', () => {
    const fiche = creerFicheVide('f7', '2026-09-08T00:00:00.000Z')
    const multiclasse: Fiche = {
      ...fiche,
      identite: {
        ...fiche.identite,
        classes: [classe({ nom: 'Magicien', niveau: 5 }), classe({ nom: 'Prêtre', niveau: 3 })],
      },
    }
    const resultat = niveauLanceur(multiclasse, tables())
    expect(resultat.total).toBeNull()
    expect(resultat.manquants.length).toBeGreaterThan(0)
  })

  it('ne remplace jamais mode par défaut, et null ne fait échouer aucune fonction', () => {
    const fiche = ficheMagicien()
    expect(fiche.sorts.mode).toBeNull()
    expect(() => niveauLanceur(fiche, tables())).not.toThrow()
    expect(() => emplacementsDeBase(fiche, tables())).not.toThrow()
    expect(() => emplacementsBonus(fiche, tables())).not.toThrow()
    expect(() => emplacementsTotaux(fiche, tables())).not.toThrow()
    expect(() => degreDeDifficulte(fiche, 1, tables())).not.toThrow()
    expect(() => sortsConnus(fiche, tables())).not.toThrow()
  })
})

describe('sortsConnus', () => {
  it('rend une absence explicite pour une classe qui ne publie pas cette table', () => {
    const resultat = sortsConnus(ficheMagicien(), tables())
    expect(resultat.disponible).toBe(false)
  })

  it('lit la table pour une classe au genre sorts_connus', () => {
    const fiche = creerFicheVide('f8', '2026-09-08T00:00:00.000Z')
    const barde: Fiche = {
      ...fiche,
      identite: { ...fiche.identite, classes: [classe({ nom: 'Barde', niveau: 3 })] },
    }
    const resultat = sortsConnus(barde, tables())
    expect(resultat.disponible).toBe(true)
    expect(resultat.parNiveauDeSort.get(0)).toBe(4)
    expect(resultat.parNiveauDeSort.get(2)).toBeNull()
  })
})
