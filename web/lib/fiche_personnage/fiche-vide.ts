/* Constructeur de fiche vide.
 *
 * Fonction pure : ni Date.now, ni aléatoire, ni accès au DOM ou au stockage
 * (cf. Skill pf-fiche-personnage § 7). L'identifiant et l'horodatage sont
 * passés en argument, jamais tirés dans la fonction.
 *
 * Aucune valeur numérique n'est mise à zéro par défaut ; toutes valent
 * `null`. Aucune règle n'est inventée : `sorts.mode` reste `null`, ce mode
 * étant une propriété de la classe, pas un défaut du schéma.
 */
import type { Caracteristique, Caracteristiques, Fiche, Sauvegarde, Sauvegardes } from './schema'
import { VERSION_SCHEMA } from './schema'

const CARACTERISTIQUES: readonly Caracteristique[] = [
  'force',
  'dexterite',
  'constitution',
  'intelligence',
  'sagesse',
  'charisme',
]

const SAUVEGARDES: readonly Sauvegarde[] = ['reflexes', 'vigueur', 'volonte']

function caracteristiquesVides(): Caracteristiques {
  const entree = { base: null, modificateurs: [] }
  return CARACTERISTIQUES.reduce(
    (acc, cle) => ({ ...acc, [cle]: entree }),
    {} as Caracteristiques,
  )
}

function sauvegardesVides(): Sauvegardes {
  const entree = { base: null, modificateurs: [] }
  return SAUVEGARDES.reduce(
    (acc, cle) => ({ ...acc, [cle]: entree }),
    {} as Sauvegardes,
  )
}

/** Construit une fiche vide. `maintenant` est un horodatage ISO, passé par l'appelant. */
export function creerFicheVide(id: string, maintenant: string): Fiche {
  return {
    schemaVersion: VERSION_SCHEMA,
    id,
    personnageId: null,
    meta: {
      nomPersonnage: '',
      nomJoueur: '',
      creeLe: maintenant,
      modifieLe: maintenant,
    },
    identite: {
      race: null,
      classes: [],
      alignement: '',
      divinite: '',
      taille: '',
      langues: [],
    },
    caracteristiques: caracteristiquesVides(),
    combat: {
      bbaBase: null,
      pvMax: null,
      vitesseBase: null,
      resistanceMagie: null,
    },
    defense: {
      armure: null,
      bouclier: null,
      modificateursCA: [],
    },
    sauvegardes: sauvegardesVides(),
    attaques: [],
    competences: [],
    dons: [],
    aptitudes: [],
    sorts: {
      mode: null,
      caracteristiqueIncantation: null,
      niveauLanceur: null,
      emplacementsParNiveau: [],
      sortsConnus: [],
      sortsPrepares: [],
    },
    equipement: [],
    notes: '',
  }
}
