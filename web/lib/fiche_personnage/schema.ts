/* Schéma versionné de la fiche de personnage.
 *
 * Aucune fonction de calcul ici, cf. build/fiche_personnage/07_SCHEMA_FICHE.md.
 * Le moteur commence à l'étape 08. Ce fichier ne pose que la forme : les
 * types, la version courante, et rien d'autre.
 *
 * Le zéro n'est jamais un défaut (cf. Skill pf-fiche-personnage § 3) : toute
 * valeur numérique de jeu vaut `number | null`, jamais `0` par convention.
 */

/** Version courante du schéma de la fiche. Incrémentée à chaque migration. */
export const VERSION_SCHEMA = 1

export type Caracteristique =
  | 'force'
  | 'dexterite'
  | 'constitution'
  | 'intelligence'
  | 'sagesse'
  | 'charisme'

export type Sauvegarde = 'reflexes' | 'vigueur' | 'volonte'

/** Provenance d'une valeur de règle, cf. Skill pf-fiche-personnage § 4. */
export type Source = 'pathfinder-fr' | 'maison'

/** Forme canonique d'un modificateur, sept clés, jamais six ni huit. */
export interface Modificateur {
  readonly libelle: string
  readonly valeur: number
  readonly type: string
  readonly origine: string
  readonly sourceUrl: string | null
  readonly saisieManuelle: boolean
}

export interface EntreeCorpus {
  readonly nom: string
  readonly source: Source
  readonly ref: string | null
  /** Note libre du joueur, jamais dérivée du corpus. Chaîne vide par défaut,
   * jamais `null` — cf. le champ `note` d'`Equipement`, même convention. */
  readonly note: string
}

export interface Race {
  readonly nom: string
  readonly source: Source
  readonly ref: string | null
}

export interface ClasseFiche {
  readonly nom: string
  readonly niveau: number | null
  readonly archetype: string | null
  readonly source: Source
  readonly ref: string | null
}

export interface Meta {
  readonly nomPersonnage: string
  readonly nomJoueur: string
  readonly creeLe: string
  readonly modifieLe: string
}

export interface Identite {
  readonly race: Race | null
  readonly classes: readonly ClasseFiche[]
  readonly alignement: string
  readonly divinite: string
  readonly taille: string
  readonly langues: readonly string[]
}

export interface EntreeCaracteristique {
  readonly base: number | null
  readonly modificateurs: readonly Modificateur[]
}

export type Caracteristiques = {
  readonly [cle in Caracteristique]: EntreeCaracteristique
}

export interface Combat {
  readonly bbaBase: number | null
  readonly pvMax: number | null
  readonly vitesseBase: number | null
  readonly resistanceMagie: number | null
}

export interface Armure {
  readonly nom: string
  readonly bonusCA: number | null
  readonly bonusDexMax: number | null
  readonly malusTests: number | null
  readonly categorie: string
}

export interface Bouclier {
  readonly nom: string
  readonly bonusCA: number | null
  readonly malusTests: number | null
}

export interface Defense {
  readonly armure: Armure | null
  readonly bouclier: Bouclier | null
  readonly modificateursCA: readonly Modificateur[]
}

export interface EntreeSauvegarde {
  readonly base: number | null
  readonly modificateurs: readonly Modificateur[]
}

export type Sauvegardes = {
  readonly [cle in Sauvegarde]: EntreeSauvegarde
}

export interface CritiqueAttaque {
  readonly plage: string
  readonly multiplicateur: number | null
}

export interface Attaque {
  readonly nom: string
  readonly type: 'corpsACorps' | 'distance'
  readonly caracteristiqueAttaque: Caracteristique | null
  readonly caracteristiqueDegats: Caracteristique | null
  readonly des: string
  readonly critique: CritiqueAttaque
  readonly portee: string
  readonly modificateursAttaque: readonly Modificateur[]
  readonly modificateursDegats: readonly Modificateur[]
  readonly source: Source
  readonly ref: string | null
}

export interface Competence {
  readonly nom: string
  readonly caracteristique: Caracteristique
  readonly rangs: number | null
  readonly estDeClasse: boolean
  readonly subitMalusArmure: boolean
  readonly modificateurs: readonly Modificateur[]
}

export interface Aptitude {
  readonly nom: string
  readonly origine: string
  readonly usagesParJour: number | null
  readonly texte: string
  readonly source: Source
  readonly ref: string | null
}

export type ModeCarnetSorts = 'prepare' | 'spontane' | 'usageLimite'

export interface CarnetSorts {
  readonly mode: ModeCarnetSorts | null
  readonly caracteristiqueIncantation: Caracteristique | null
  readonly niveauLanceur: number | null
  readonly emplacementsParNiveau: readonly (number | null)[]
  readonly sortsConnus: readonly EntreeCorpus[]
  readonly sortsPrepares: readonly EntreeCorpus[]
}

export interface Equipement {
  readonly nom: string
  readonly quantite: number | null
  readonly note: string
  readonly source: Source
  readonly ref: string | null
}

/** La fiche de personnage, forme versionnée. */
export interface Fiche {
  readonly schemaVersion: number
  readonly id: string
  readonly personnageId: string | null
  readonly meta: Meta
  readonly identite: Identite
  readonly caracteristiques: Caracteristiques
  readonly combat: Combat
  readonly defense: Defense
  readonly sauvegardes: Sauvegardes
  readonly attaques: readonly Attaque[]
  readonly competences: readonly Competence[]
  readonly dons: readonly EntreeCorpus[]
  readonly aptitudes: readonly Aptitude[]
  readonly sorts: CarnetSorts
  readonly equipement: readonly Equipement[]
  readonly notes: string
}
