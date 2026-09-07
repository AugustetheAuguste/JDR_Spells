import { describe, expect, it } from 'vitest'

import { chargerRegles, type LecteurTable } from './regles'

const TYPES_BONUS_VALIDE = JSON.stringify({
  meta: { version: 1, genere_le: '2026-09-07', sources: [], outil: 'test' },
  donnees: {
    types: [
      { cle: 'esquive', libelle: 'Bonus d’esquive', cumulable: true, note: '' },
      { cle: 'alteration', libelle: 'Bonus d’altération', cumulable: null, note: '' },
    ],
  },
})

const MODIFICATEURS_CARAC_BORNES = JSON.stringify({
  meta: { version: 1, genere_le: '2026-09-07', sources: [], outil: 'test' },
  donnees: { bornes: [{ min: 10, max: 11, modificateur: 0 }] },
})

function lecteurDe(fichiers: Readonly<Record<string, string>>): LecteurTable {
  return (nomFichier) => fichiers[nomFichier] ?? null
}

describe('chargerRegles', () => {
  it('rend les types de bonus quand le fichier est valide', async () => {
    const tables = await chargerRegles(
      lecteurDe({ 'types_bonus.json': TYPES_BONUS_VALIDE, 'modificateurs_caracteristiques.json': MODIFICATEURS_CARAC_BORNES }),
    )
    expect(tables.typesBonus).toEqual([
      { cle: 'esquive', libelle: 'Bonus d’esquive', cumulable: true, note: '' },
      { cle: 'alteration', libelle: 'Bonus d’altération', cumulable: null, note: '' },
    ])
    expect(tables.modificateursCarac).toEqual({ bornes: [{ min: 10, max: 11, modificateur: 0 }] })
  })

  it('rend null pour une table absente, jamais une table par défaut', async () => {
    const tables = await chargerRegles(lecteurDe({}))
    expect(tables.typesBonus).toBeNull()
    expect(tables.modificateursCarac).toBeNull()
    expect(tables.sortsBonus).toBeNull()
    expect(tables.armures).toBeNull()
    expect(tables.progressionClasses).toBeNull()
  })

  it('rend null pour une table dont le JSON est invalide', async () => {
    const tables = await chargerRegles(lecteurDe({ 'types_bonus.json': '{ pas du json' }))
    expect(tables.typesBonus).toBeNull()
  })

  it('rend null pour une enveloppe sans clé meta ou donnees', async () => {
    const tables = await chargerRegles(lecteurDe({ 'types_bonus.json': JSON.stringify({ donnees: {} }) }))
    expect(tables.typesBonus).toBeNull()
  })

  it('lit la forme valeurs de modificateurs_caracteristiques.json', async () => {
    const brut = JSON.stringify({
      meta: { version: 1, genere_le: '2026-09-07', sources: [], outil: 'test' },
      donnees: { valeurs: { '10': 0, '11': 0 } },
    })
    const tables = await chargerRegles(lecteurDe({ 'modificateurs_caracteristiques.json': brut }))
    expect(tables.modificateursCarac).toEqual({ valeurs: { '10': 0, '11': 0 } })
  })

  it('porte sortsBonus, armures et progressionClasses tels que lus, sans les interpréter', async () => {
    const brut = JSON.stringify({
      meta: { version: 1, genere_le: '2026-09-07', sources: [], outil: 'test' },
      donnees: { quoique: 'ce soit' },
    })
    const tables = await chargerRegles(
      lecteurDe({ 'sorts_bonus.json': brut, 'armures.json': brut, 'progression_classes.json': brut }),
    )
    expect(tables.sortsBonus).toEqual({ quoique: 'ce soit' })
    expect(tables.armures).toEqual({ quoique: 'ce soit' })
    expect(tables.progressionClasses).toEqual({ quoique: 'ce soit' })
  })
})
