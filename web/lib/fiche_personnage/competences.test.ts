import { describe, expect, it } from 'vitest'

import type { Caracteristique, ClasseFiche, Competence, Defense, Fiche, Modificateur } from './schema'
import type { ModificateursCaracteristiques, TypeBonus } from './regles'
import { creerFicheVide } from './fiche-vide'
import {
  CONVERSION_ABREVIATION_CARACTERISTIQUE,
  convertirAbreviationCaracteristique,
  competencesDeClasse,
  malusArmureEffectif,
  suggererEstDeClasse,
  totalCompetence,
  type TableClassSkills,
} from './competences'

function modificateur(partiel: Partial<Modificateur> & { libelle: string; valeur: number; type: string }): Modificateur {
  return {
    origine: partiel.origine ?? 'test',
    sourceUrl: partiel.sourceUrl ?? null,
    saisieManuelle: partiel.saisieManuelle ?? false,
    ...partiel,
  }
}

function competence(partiel: Partial<Competence> & { nom: string }): Competence {
  return {
    caracteristique: 'force',
    rangs: 0,
    estDeClasse: false,
    subitMalusArmure: false,
    modificateurs: [],
    ...partiel,
  }
}

function classeFiche(nom: string): ClasseFiche {
  return { nom, niveau: 1, archetype: null, source: 'pathfinder-fr', ref: null }
}

const TYPE_CUMULABLE: TypeBonus = { cle: 'esquive', libelle: 'Bonus d’esquive', cumulable: true, note: '' }
const TABLE_VALEURS: ModificateursCaracteristiques = { valeurs: { '14': 2, '16': 3 } }

function ficheAvec(partiel: {
  competences?: readonly Competence[]
  classes?: readonly ClasseFiche[]
  caracteristique?: { cle: Caracteristique; base: number }
  defense?: Defense
}): Fiche {
  const fiche = creerFicheVide('f1', '2026-09-08T00:00:00.000Z')
  return {
    ...fiche,
    identite: { ...fiche.identite, classes: partiel.classes ?? [] },
    caracteristiques: partiel.caracteristique
      ? {
          ...fiche.caracteristiques,
          [partiel.caracteristique.cle]: { base: partiel.caracteristique.base, modificateurs: [] },
        }
      : fiche.caracteristiques,
    defense: partiel.defense ?? fiche.defense,
    competences: partiel.competences ?? [],
  }
}

describe('convertirAbreviationCaracteristique', () => {
  it('convertit chacune des six abréviations', () => {
    expect(convertirAbreviationCaracteristique('For')).toBe('force')
    expect(convertirAbreviationCaracteristique('Dex')).toBe('dexterite')
    expect(convertirAbreviationCaracteristique('Con')).toBe('constitution')
    expect(convertirAbreviationCaracteristique('Int')).toBe('intelligence')
    expect(convertirAbreviationCaracteristique('Sag')).toBe('sagesse')
    expect(convertirAbreviationCaracteristique('Cha')).toBe('charisme')
  })

  it('rend null pour une abréviation inconnue, jamais devinée', () => {
    expect(convertirAbreviationCaracteristique('Réd')).toBeNull()
    expect(convertirAbreviationCaracteristique('')).toBeNull()
  })

  it('la table exportée porte exactement les six clés', () => {
    expect(Object.keys(CONVERSION_ABREVIATION_CARACTERISTIQUE).sort()).toEqual(
      ['Cha', 'Con', 'Dex', 'For', 'Int', 'Sag'].sort(),
    )
  })
})

describe('malusArmureEffectif', () => {
  it('rend 0 sans lacune quand aucune armure ni bouclier ne sont portés', () => {
    const resultat = malusArmureEffectif({ armure: null, bouclier: null, modificateursCA: [] })
    expect(resultat.total).toBe(0)
    expect(resultat.detail).toEqual([])
    expect(resultat.manquants).toEqual([])
  })

  it('deux sources, armure et bouclier, produisent deux contributions distinctes', () => {
    const defense: Defense = {
      armure: { nom: 'Cotte de mailles', bonusCA: 5, bonusDexMax: 4, malusTests: -5, categorie: 'intermediaire' },
      bouclier: { nom: 'Bouclier léger', bonusCA: 1, malusTests: -1 },
      modificateursCA: [],
    }
    const resultat = malusArmureEffectif(defense)
    expect(resultat.total).toBe(-6)
    expect(resultat.detail).toHaveLength(2)
    expect(resultat.detail.every((c) => c.retenue)).toBe(true)
  })

  it('une armure sans malus renseigné ne produit aucune contribution', () => {
    const defense: Defense = {
      armure: { nom: 'Armure de cuir', bonusCA: 2, bonusDexMax: 6, malusTests: null, categorie: 'legere' },
      bouclier: null,
      modificateursCA: [],
    }
    const resultat = malusArmureEffectif(defense)
    expect(resultat.total).toBe(0)
    expect(resultat.detail).toEqual([])
  })
})

describe('totalCompetence', () => {
  const tables = { typesBonus: [TYPE_CUMULABLE], modificateursCarac: TABLE_VALEURS, sortsBonus: null, armures: null, progressionClasses: null }

  it('rend introuvable, manquants contient caracteristique, quand elle est absente', () => {
    const fiche = ficheAvec({ caracteristique: { cle: 'force', base: 14 } })
    const c = { ...competence({ nom: 'Sans carac', rangs: 1 }), caracteristique: null as unknown as Caracteristique }
    const resultat = totalCompetence(fiche, c, tables)
    expect(resultat.total).toBeNull()
    expect(resultat.manquants).toContain('caracteristique')
  })

  it('le malus d’armure n’apparaît que pour la compétence qui subit le drapeau', () => {
    const defense: Defense = {
      armure: { nom: 'Cotte de mailles', bonusCA: 5, bonusDexMax: 4, malusTests: -5, categorie: 'intermediaire' },
      bouclier: null,
      modificateursCA: [],
    }
    const fiche = ficheAvec({ caracteristique: { cle: 'force', base: 14 }, defense })

    const avecMalus = competence({ nom: 'Escalade', caracteristique: 'force', rangs: 1, subitMalusArmure: true })
    const sansMalus = competence({ nom: 'Perception', caracteristique: 'force', rangs: 1, subitMalusArmure: false })

    const resultatAvec = totalCompetence(fiche, avecMalus, tables)
    const resultatSans = totalCompetence(fiche, sansMalus, tables)

    expect(resultatAvec.detail.some((c) => c.type === 'malus_armure')).toBe(true)
    expect(resultatSans.detail.some((c) => c.type === 'malus_armure')).toBe(false)
    expect(resultatAvec.total).toBe((resultatSans.total ?? 0) - 5)
  })

  it('estDeClasse faux retire la contribution de compétence de classe du détail', () => {
    const fiche = ficheAvec({ caracteristique: { cle: 'force', base: 14 } })
    const deClasse = competence({ nom: 'Escalade', caracteristique: 'force', rangs: 1, estDeClasse: true })
    const horsClasse = competence({ nom: 'Escalade', caracteristique: 'force', rangs: 1, estDeClasse: false })

    const resultatDeClasse = totalCompetence(fiche, deClasse, tables)
    const resultatHorsClasse = totalCompetence(fiche, horsClasse, tables)

    expect(resultatDeClasse.detail.some((c) => c.type === 'competence_classe')).toBe(true)
    expect(resultatHorsClasse.detail.some((c) => c.type === 'competence_classe')).toBe(false)
    expect(resultatDeClasse.total).toBe((resultatHorsClasse.total ?? 0) + 3)
  })

  it('zéro rang saisi produit une contribution de zéro rang, jamais le niveau du personnage', () => {
    const fiche = ficheAvec({ caracteristique: { cle: 'force', base: 14 } })
    const c = competence({ nom: 'Natation', caracteristique: 'force', rangs: 0 })
    const resultat = totalCompetence(fiche, c, tables)
    const contributionRang = resultat.detail.find((d) => d.type === 'rang_competence')
    expect(contributionRang?.valeur).toBe(0)
    expect(resultat.total).not.toBeNull()
  })

  it('un modificateur propre à la compétence est résolu et compté dans le total', () => {
    const fiche = ficheAvec({ caracteristique: { cle: 'force', base: 14 } })
    const c = competence({
      nom: 'Natation',
      caracteristique: 'force',
      rangs: 1,
      modificateurs: [modificateur({ libelle: 'Anneau de natation', valeur: 4, type: 'esquive' })],
    })
    const resultat = totalCompetence(fiche, c, tables)
    expect(resultat.detail.some((d) => d.libelle === 'Anneau de natation' && d.retenue)).toBe(true)
  })
})

describe('competencesDeClasse', () => {
  const table: TableClassSkills = {
    guerrier: { class_skills: [{ ability: 'For', skill: 'Escalade' }] },
    magicien: { class_skills: [{ ability: 'Int', skill: 'Art de la magie' }] },
  }

  it('une classe absente de la table rend deClasse à null, jamais false', () => {
    const { parNom, inconnues } = competencesDeClasse([classeFiche('Chasseur de vampire')], table)
    expect(inconnues).toEqual(['chasseur_de_vampire'])
    for (const suggestion of parNom.values()) {
      expect(suggestion.deClasse).not.toBe(false)
    }
  })

  it('une classe connue accorde deClasse vrai pour ses compétences', () => {
    const { parNom } = competencesDeClasse([classeFiche('Guerrier')], table)
    expect(parNom.get('Escalade')?.deClasse).toBe(true)
    expect(parNom.get('Escalade')?.classes).toEqual(['Guerrier'])
  })

  it('une classe connue rend deClasse faux pour une compétence qu’elle n’accorde pas', () => {
    const { parNom } = competencesDeClasse([classeFiche('Guerrier')], table)
    expect(parNom.get('Art de la magie')?.deClasse).toBe(false)
  })
})

describe('suggererEstDeClasse', () => {
  const table: TableClassSkills = {
    guerrier: { class_skills: [{ ability: 'For', skill: 'Escalade' }] },
  }

  it('ne modifie jamais la fiche passée en argument', () => {
    const fiche = ficheAvec({
      classes: [classeFiche('Guerrier')],
      competences: [competence({ nom: 'Escalade', estDeClasse: false })],
    })
    const avant = JSON.parse(JSON.stringify(fiche))
    suggererEstDeClasse(fiche, table)
    expect(fiche).toEqual(avant)
  })

  it('suggère de classe quand la compétence est de classe et saisie hors classe', () => {
    const fiche = ficheAvec({
      classes: [classeFiche('Guerrier')],
      competences: [competence({ nom: 'Escalade', estDeClasse: false })],
    })
    const suggestions = suggererEstDeClasse(fiche, table)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.nomCompetence).toBe('Escalade')
    expect(suggestions[0]?.valeurSuggeree).toBe(true)
  })

  it('ne suggère rien quand la saisie correspond déjà à la table', () => {
    const fiche = ficheAvec({
      classes: [classeFiche('Guerrier')],
      competences: [competence({ nom: 'Escalade', estDeClasse: true })],
    })
    expect(suggererEstDeClasse(fiche, table)).toEqual([])
  })
})

describe('aucun accès au DOM ni au stockage', () => {
  it('le module ne référence ni document, ni window, ni localStorage', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const ici = path.dirname(url.fileURLToPath(import.meta.url))
    const chemin = path.resolve(ici, 'competences.ts')
    const source = await fs.readFile(chemin, 'utf8')
    expect(source).not.toMatch(/\bdocument\./)
    expect(source).not.toMatch(/\bwindow\./)
    expect(source).not.toMatch(/localStorage/)
  })
})
