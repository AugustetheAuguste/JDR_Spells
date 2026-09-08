import { describe, expect, it } from 'vitest'

import { creerFicheVide } from './fiche-vide'
import type { Fiche } from './schema'
import { ficheVersCharacter } from './vers-character'

function ficheAvecClasse(partiel: Partial<Fiche['identite']> = {}): Fiche {
  const base = creerFicheVide('f1', '2026-01-01T00:00:00.000Z')
  return {
    ...base,
    identite: {
      ...base.identite,
      classes: [{ nom: 'Guerrier', niveau: 6, archetype: null, source: 'pathfinder-fr', ref: 'guerrier' }],
      ...partiel,
    },
  }
}

describe('ficheVersCharacter', () => {
  it('rend null sur une fiche sans classe', () => {
    const fiche = creerFicheVide('f1', '2026-01-01T00:00:00.000Z')
    expect(ficheVersCharacter(fiche)).toBeNull()
  })

  it('rend null quand la classe n’a pas de niveau saisi', () => {
    const fiche = ficheAvecClasse({
      classes: [{ nom: 'Guerrier', niveau: null, archetype: null, source: 'pathfinder-fr', ref: null }],
    })
    expect(ficheVersCharacter(fiche)).toBeNull()
  })

  it('convertit classe et niveau', () => {
    const perso = ficheVersCharacter(ficheAvecClasse())
    expect(perso).not.toBeNull()
    expect(perso?.classe).toBe('Guerrier')
    expect(perso?.niveau).toBe(6)
  })

  it('ne fabrique pas de caractéristique absente, ni de 10 par défaut', () => {
    const perso = ficheVersCharacter(ficheAvecClasse())
    expect(perso?.caracteristiques).toBeUndefined()
  })

  it('remonte les caractéristiques saisies sous les clés capitalisées attendues par le moteur', () => {
    const fiche = ficheAvecClasse()
    const avecCarac: Fiche = {
      ...fiche,
      caracteristiques: {
        ...fiche.caracteristiques,
        force: { base: 16, modificateurs: [] },
        dexterite: { base: 12, modificateurs: [] },
      },
    }
    const perso = ficheVersCharacter(avecCarac)
    expect(perso?.caracteristiques).toEqual({ For: 16, Dex: 12 })
  })

  it('produit toujours un Set pour dons_connus, même vide', () => {
    const perso = ficheVersCharacter(ficheAvecClasse())
    expect(perso?.dons_connus).toBeInstanceOf(Set)
    expect(perso?.dons_connus?.size).toBe(0)
  })

  it('ne fabrique pas d’alignement, de divinité, de race ou de taille par défaut', () => {
    const perso = ficheVersCharacter(ficheAvecClasse())
    expect(perso?.alignement).toBeUndefined()
    expect(perso?.divinite).toBeUndefined()
    expect(perso?.race).toBeUndefined()
    expect(perso?.taille).toBeUndefined()
  })
})
