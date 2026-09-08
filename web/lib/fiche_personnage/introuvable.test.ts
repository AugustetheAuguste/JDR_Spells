/**
 * La propagation de `introuvable` (Skill pf-fiche-personnage § 3) : partant
 * d'une fiche vide, aucune fonction publique du moteur ne rend un total à
 * `0` par défaut. Couvre les fonctions exportées des huit modules de calcul,
 * comparées à la liste ci-dessous — critère de vérification n°5 du plan de
 * l'étape 12 : une fonction nouvelle non couverte fait échouer la suite.
 */
import { describe, expect, it } from 'vitest'

import { creerFicheVide } from './fiche-vide'
import * as resoudreModule from './resoudre'
import * as caracteristiquesModule from './caracteristiques'
import * as defenseModule from './defense'
import * as combatModule from './combat'
import * as sauvegardesModule from './sauvegardes'
import * as attaquesModule from './attaques'
import * as competencesModule from './competences'
import * as sortsModule from './sorts'
import type { Attaque, Competence, Fiche } from './schema'
import type { TablesRegles } from './regles'

const FICHE_VIDE: Fiche = creerFicheVide('fiche-vide', '2026-09-08T00:00:00.000Z')

const TABLES_VIDES: TablesRegles = {
  typesBonus: [],
  modificateursCarac: { bornes: [] },
  sortsBonus: null,
  armures: null,
  progressionClasses: {},
}

const ATTAQUE_TEST: Attaque = {
  nom: 'Attaque de test',
  type: 'corpsACorps',
  caracteristiqueAttaque: 'force',
  caracteristiqueDegats: 'force',
  des: '1d4',
  critique: { plage: '20', multiplicateur: 2 },
  portee: 'corps à corps',
  modificateursAttaque: [],
  modificateursDegats: [],
  source: 'maison',
  ref: null,
}

const COMPETENCE_TEST: Competence = {
  nom: 'Compétence de test',
  caracteristique: 'force',
  rangs: null,
  estDeClasse: false,
  subitMalusArmure: false,
  modificateurs: [],
}

function attendreIntrouvable(resultat: { readonly total: number | null; readonly manquants: readonly string[] }): void {
  expect(resultat.total).toBeNull()
  expect(resultat.manquants.length).toBeGreaterThan(0)
}

/** Les fonctions couvertes explicitement ci-dessous, une par une. Toute
 * fonction exportée d'un des huit modules et absente de cet ensemble fait
 * échouer le test de couverture plus bas. */
const FONCTIONS_COUVERTES = new Set<string>([
  'resoudre',
  'modificateurCaracteristique',
  'valeurEffectiveCaracteristique',
  'normaliserTaille',
  'classeArmure',
  'vitesse',
  'initiative',
  'pointsDeVieMaximum',
  'resistanceMagie',
  'manoeuvreOffensive',
  'manoeuvreDefensive',
  'sauvegarde',
  'serieAttaques',
  'bonusAttaque',
  'bonusDegats',
  'attaquesCompletes',
  'convertirAbreviationCaracteristique',
  'abiliteDeEntreeClassSkill',
  'competencesDeClasse',
  'suggererEstDeClasse',
  'malusArmureEffectif',
  'totalCompetence',
  'emplacementsDeBase',
  'emplacementsBonus',
  'emplacementsTotaux',
  'degreDeDifficulte',
  'niveauLanceur',
  'sortsConnus',
])

describe('couverture des fonctions publiques du moteur', () => {
  const modules = {
    resoudre: resoudreModule,
    caracteristiques: caracteristiquesModule,
    defense: defenseModule,
    combat: combatModule,
    sauvegardes: sauvegardesModule,
    attaques: attaquesModule,
    competences: competencesModule,
    sorts: sortsModule,
  }

  for (const [nomModule, module_] of Object.entries(modules)) {
    it(`toute fonction exportée de ${nomModule}.ts est couverte`, () => {
      const nonCouvertes = Object.entries(module_)
        .filter(([, valeur]) => typeof valeur === 'function')
        .map(([nom]) => nom)
        .filter((nom) => !FONCTIONS_COUVERTES.has(nom))
      expect(nonCouvertes, `fonctions non couvertes dans ${nomModule}.ts`).toEqual([])
    })
  }
})

describe('introuvable, fiche vide', () => {
  it('resoudre : typesBonus null rend introuvable', () => {
    const resultat = resoudreModule.resoudre([{ libelle: 'x', valeur: 1, type: 't', origine: '', sourceUrl: null, saisieManuelle: true }], null)
    attendreIntrouvable(resultat)
  })

  it('valeurEffectiveCaracteristique : base absente', () => {
    attendreIntrouvable(caracteristiquesModule.valeurEffectiveCaracteristique(FICHE_VIDE.caracteristiques.force, []))
  })

  it('modificateurCaracteristique : valeur absente', () => {
    attendreIntrouvable(caracteristiquesModule.modificateurCaracteristique(null, { bornes: [] }))
  })

  it('classeArmure : les trois variantes', () => {
    const resultat = defenseModule.classeArmure(FICHE_VIDE, TABLES_VIDES)
    attendreIntrouvable(resultat.totale)
    attendreIntrouvable(resultat.contact)
    attendreIntrouvable(resultat.prisAuDepourvu)
  })

  it('vitesse : vitesseBase absente', () => {
    attendreIntrouvable(defenseModule.vitesse(FICHE_VIDE, TABLES_VIDES))
  })

  it('initiative : dextérité absente', () => {
    attendreIntrouvable(combatModule.initiative(FICHE_VIDE, TABLES_VIDES))
  })

  it('pointsDeVieMaximum : pvMax absent', () => {
    attendreIntrouvable(combatModule.pointsDeVieMaximum(FICHE_VIDE))
  })

  it('resistanceMagie : resistanceMagie absente', () => {
    attendreIntrouvable(combatModule.resistanceMagie(FICHE_VIDE))
  })

  it('manoeuvreOffensive : bba absent', () => {
    attendreIntrouvable(combatModule.manoeuvreOffensive(FICHE_VIDE, TABLES_VIDES))
  })

  it('manoeuvreDefensive : bba absent', () => {
    attendreIntrouvable(combatModule.manoeuvreDefensive(FICHE_VIDE, TABLES_VIDES))
  })

  it('sauvegarde : base absente, pour les trois jets', () => {
    for (const quelle of ['reflexes', 'vigueur', 'volonte'] as const) {
      attendreIntrouvable(sauvegardesModule.sauvegarde(FICHE_VIDE, quelle, TABLES_VIDES))
    }
  })

  it('serieAttaques : bbaBase absent rend un tableau à un seul élément introuvable', () => {
    const serie = attaquesModule.serieAttaques(null, TABLES_VIDES)
    expect(serie.length).toBe(1)
    attendreIntrouvable(serie[0]!)
  })

  it('bonusAttaque : bba absent', () => {
    attendreIntrouvable(attaquesModule.bonusAttaque(FICHE_VIDE, ATTAQUE_TEST, TABLES_VIDES))
  })

  it('bonusDegats : caractéristique de dégâts absente', () => {
    attendreIntrouvable(attaquesModule.bonusDegats(FICHE_VIDE, ATTAQUE_TEST, TABLES_VIDES))
  })

  it('attaquesCompletes : la série et les dégâts sont introuvables pour une attaque', () => {
    const ficheAvecAttaque: Fiche = { ...FICHE_VIDE, attaques: [ATTAQUE_TEST] }
    const completes = attaquesModule.attaquesCompletes(ficheAvecAttaque, TABLES_VIDES)
    expect(completes.length).toBe(1)
    attendreIntrouvable(completes[0]!.bonusParAttaque[0]!)
    attendreIntrouvable(completes[0]!.degats)
  })

  it('totalCompetence : rangs absents', () => {
    attendreIntrouvable(competencesModule.totalCompetence(FICHE_VIDE, COMPETENCE_TEST, TABLES_VIDES))
  })

  it('malusArmureEffectif : aucune armure ni bouclier rend 0, information complète et non une lacune (cf. docstring de la fonction)', () => {
    const resultat = competencesModule.malusArmureEffectif(FICHE_VIDE.defense)
    expect(resultat.total).toBe(0)
    expect(resultat.manquants).toEqual([])
  })

  it('competencesDeClasse : aucune classe connue de la table', () => {
    const resultat = competencesModule.competencesDeClasse(
      [{ nom: 'Classe introuvable', niveau: 6, archetype: null, source: 'maison', ref: null }],
      { connue: { class_skills: [] } },
    )
    expect(resultat.inconnues).toEqual(['classe_introuvable'])
  })

  it('degreDeDifficulte : caractéristique d’incantation absente', () => {
    attendreIntrouvable(sortsModule.degreDeDifficulte(FICHE_VIDE, 1, TABLES_VIDES))
  })

  it('niveauLanceur : aucune classe lanceuse', () => {
    attendreIntrouvable(sortsModule.niveauLanceur(FICHE_VIDE, TABLES_VIDES))
  })

  it('emplacementsTotaux : classe introuvable de la table rend chaque niveau introuvable', () => {
    const ficheAvecClasse: Fiche = {
      ...FICHE_VIDE,
      identite: {
        ...FICHE_VIDE.identite,
        classes: [{ nom: 'Classe introuvable', niveau: 6, archetype: null, source: 'maison', ref: null }],
      },
    }
    const emplacements = sortsModule.emplacementsTotaux(ficheAvecClasse, TABLES_VIDES)
    for (const niveau of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      attendreIntrouvable(emplacements.get(niveau)!)
    }
  })

  it('sortsConnus : aucune classe, disponible à faux, pas une lacune', () => {
    const resultat = sortsModule.sortsConnus(FICHE_VIDE, TABLES_VIDES)
    expect(resultat.disponible).toBe(false)
  })
})
