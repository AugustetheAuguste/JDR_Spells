/**
 * Le moteur des compétences : le total d'une compétence, son détail complet,
 * et une suggestion (jamais une décision) de quelles compétences sont de
 * classe. Cf. `build/fiche_personnage/10_MOTEUR_COMPETENCES.md`.
 *
 * Fonctions pures : aucune table n'est chargée ici, elle arrive en argument,
 * sur le même modèle que `resoudre.ts` et `caracteristiques.ts`.
 *
 * Sourcé (page « Compétences » du wiki, cf. le bloc de traçabilité en pied de
 * dépôt) :
 * - la formule du total : « 1d20 + rang + modificateur de caractéristique +
 *   modificateur racial + 3 » pour une compétence de classe dans laquelle au
 *   moins un rang est investi ;
 * - le bonus de compétence de classe est exactement +3, et seulement quand
 *   `estDeClasse` est vrai ET qu'au moins un rang est investi ;
 * - le malus d'armure ne s'applique qu'aux tests de compétence associés à la
 *   Force ou à la Dextérité — la raison structurelle pour laquelle ce moteur
 *   ne dérive jamais `subitMalusArmure` d'un nom de compétence : le drapeau
 *   est posé sur la compétence elle-même (étape 07), lu tel quel ici.
 */

import { MOTS } from '@/lib/design/tokens'
import type { Caracteristique, ClasseFiche, Competence, Defense, Fiche } from '@/lib/fiche_personnage/schema'
import type { TablesRegles } from '@/lib/fiche_personnage/regles'
import { resoudre, type Contribution, type ResultatCalcul } from '@/lib/fiche_personnage/resoudre'
import { modificateurCaracteristique, valeurEffectiveCaracteristique } from '@/lib/fiche_personnage/caracteristiques'

/** Sourcé, page « Compétences » : « Le personnage bénéficie donc d'un bonus
 * de +3 à toutes les compétences de classe dans lesquelles il a investi au
 * moins un point de compétence. » Un seul endroit du chantier écrit ce
 * chiffre — jamais une seconde fois de mémoire. */
export const BONUS_COMPETENCE_DE_CLASSE = 3

/** La conversion des abréviations de caractéristique lues dans
 * `class_skills.json` (`For`, `Dex`, `Con`, `Int`, `Sag`, `Cha`) vers les clés
 * du schéma de la fiche. Le seul endroit du chantier où cette conversion
 * existe, cf. plan §"Les compétences de classe, données existantes". */
export const CONVERSION_ABREVIATION_CARACTERISTIQUE: Readonly<Record<string, Caracteristique>> = {
  For: 'force',
  Dex: 'dexterite',
  Con: 'constitution',
  Int: 'intelligence',
  Sag: 'sagesse',
  Cha: 'charisme',
}

/** Une abréviation hors des six connues rend `null`, jamais une
 * caractéristique devinée. */
export function convertirAbreviationCaracteristique(abreviation: string): Caracteristique | null {
  return CONVERSION_ABREVIATION_CARACTERISTIQUE[abreviation] ?? null
}

/** Une entrée de `class_skills.json`, telle que lue sur disque (41 classes,
 * clé au slug de classe). */
export interface EntreeClassSkill {
  readonly ability: string
  readonly skill: string
}

/** La forme de `class_skills.json` republiée côté web, clé au slug de
 * classe — cf. plan §"Les compétences de classe, données existantes". */
export interface TableClassSkills {
  readonly [slugClasse: string]: {
    readonly class_skills: readonly EntreeClassSkill[]
  }
}

/** La caractéristique associée à une entrée de `class_skills.json`, convertie
 * par la table ci-dessus. `null` pour une abréviation inconnue, jamais
 * devinée. */
export function abiliteDeEntreeClassSkill(entree: EntreeClassSkill): Caracteristique | null {
  return convertirAbreviationCaracteristique(entree.ability)
}

/** Réduit un nom d'affichage de classe au même slug que celui des clés de
 * `class_skills.json` — minuscules, accents retirés, toute suite hors
 * `[a-z0-9]` réduite à un unique `_`. Ce n'est pas l'algorithme du corpus des
 * sorts (`src/pf_spells/slugs.py`, séparateur `-`) : c'est celui déjà en
 * vigueur dans `class_skills.json` (séparateur `_`, ex. `chasseur_de_vampire`,
 * `pretre_combattant`), vérifié contre les 41 clés du fichier. */
function slugifierNomClasse(nom: string): string {
  return nom
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Le verdict pour une compétence donnée : de classe, hors classe, ou
 * indéterminable — jamais `false` par défaut quand l'information manque. */
export interface SuggestionDeClasse {
  readonly deClasse: boolean | null
  /** Les classes de la fiche, connues de la table, pour lesquelles cette
   * compétence est effectivement une compétence de classe. Vide si
   * `deClasse` n'est pas `true`. */
  readonly classes: readonly string[]
}

export interface ResultatCompetencesDeClasse {
  readonly parNom: ReadonlyMap<string, SuggestionDeClasse>
  /** Les slugs de classe de la fiche absents de la table — une classe
   * inconnue n'est jamais une preuve d'absence, cf. plan §"Pseudo-code". */
  readonly inconnues: readonly string[]
}

/** Propose, sans jamais trancher, quelles compétences sont des compétences de
 * classe pour les classes de la fiche. Le joueur reste seul décisionnaire de
 * `Competence.estDeClasse` — cf. Skill pf-fiche-personnage et Notes
 * d'implémentation du plan. */
export function competencesDeClasse(
  classesDeLaFiche: readonly ClasseFiche[],
  tableClassSkills: TableClassSkills | null,
): ResultatCompetencesDeClasse {
  const inconnues: string[] = []
  const connues: { readonly slug: string; readonly nomAffiche: string }[] = []

  for (const classe of classesDeLaFiche) {
    const slug = slugifierNomClasse(classe.nom)
    if (tableClassSkills !== null && Object.prototype.hasOwnProperty.call(tableClassSkills, slug)) {
      connues.push({ slug, nomAffiche: classe.nom })
    } else {
      inconnues.push(slug)
    }
  }

  const parNom = new Map<string, SuggestionDeClasse>()

  if (tableClassSkills === null) {
    // Aucune table : rien n'est même énumérable, encore moins tranchable.
    return { parNom, inconnues }
  }

  // L'univers des noms de compétence connu de ce moteur est celui de la
  // table entière (41 classes) : au-delà, une compétence n'a simplement
  // jamais été vue par aucune classe et ce n'est pas ce que cette fonction
  // décide.
  const universDesCompetences = new Set<string>()
  for (const entree of Object.values(tableClassSkills)) {
    for (const ligne of entree.class_skills) universDesCompetences.add(ligne.skill)
  }

  const auMoinsUneClasseInconnue = inconnues.length > 0
  const auMoinsUneClasseConnue = connues.length > 0

  for (const nomCompetence of universDesCompetences) {
    const classesAccordantLaCompetence: string[] = []
    for (const { slug, nomAffiche } of connues) {
      const classeSkills = tableClassSkills[slug]?.class_skills ?? []
      if (classeSkills.some((c) => c.skill === nomCompetence)) {
        classesAccordantLaCompetence.push(nomAffiche)
      }
    }

    if (classesAccordantLaCompetence.length > 0) {
      parNom.set(nomCompetence, { deClasse: true, classes: classesAccordantLaCompetence })
      continue
    }

    if (!auMoinsUneClasseConnue || auMoinsUneClasseInconnue) {
      // Rien ne prouve l'absence : aucune classe connue ne l'accorde, mais
      // une classe inconnue de la fiche pourrait très bien l'accorder.
      parNom.set(nomCompetence, { deClasse: null, classes: [] })
    } else {
      // Toutes les classes de la fiche sont connues de la table, et aucune
      // ne l'accorde : l'absence est, ici, une information complète.
      parNom.set(nomCompetence, { deClasse: false, classes: [] })
    }
  }

  return { parNom, inconnues }
}

/** Une suggestion pour l'interface, jamais une écriture. */
export interface SuggestionEstDeClasse {
  readonly nomCompetence: string
  readonly valeurSuggeree: boolean
  readonly motif: string
}

/** Compare `Competence.estDeClasse` tel que saisi à la suggestion tirée de
 * `class_skills.json`, et rend l'écart — jamais la fiche modifiée. Pur : la
 * fiche passée en argument n'est ni mutée ni recopiée modifiée. */
export function suggererEstDeClasse(
  fiche: Fiche,
  tableClassSkills: TableClassSkills | null,
): readonly SuggestionEstDeClasse[] {
  const { parNom } = competencesDeClasse(fiche.identite.classes, tableClassSkills)
  const suggestions: SuggestionEstDeClasse[] = []

  for (const competence of fiche.competences) {
    const suggestion = parNom.get(competence.nom)
    if (suggestion === undefined || suggestion.deClasse === null) continue
    if (suggestion.deClasse === competence.estDeClasse) continue

    const motif = suggestion.deClasse
      ? `${MOTS.ficheMoteurSuggestionDeClasseVraie} ${suggestion.classes.join(', ')}`
      : MOTS.ficheMoteurSuggestionDeClasseFausse

    suggestions.push({
      nomCompetence: competence.nom,
      valeurSuggeree: suggestion.deClasse,
      motif,
    })
  }

  return suggestions
}

/** Le malus d'armure et de bouclier, chacun une contribution distincte
 * lorsqu'il est renseigné. L'absence totale de malus (aucune armure, aucun
 * bouclier, ou l'un et l'autre à `0`) rend un total `0` à détail vide — une
 * information complète (« le personnage ne subit aucun malus »), pas une
 * lacune, cf. Skill pf-fiche-personnage §3. */
export function malusArmureEffectif(defense: Defense): ResultatCalcul {
  const contributions: Contribution[] = []

  if (defense.armure !== null && defense.armure.malusTests !== null) {
    contributions.push({
      libelle: `${MOTS.ficheMoteurMalusArmure} (${defense.armure.nom})`,
      valeur: defense.armure.malusTests,
      type: 'malus_armure',
      retenue: true,
      motifEcart: null,
    })
  }

  if (defense.bouclier !== null && defense.bouclier.malusTests !== null) {
    contributions.push({
      libelle: `${MOTS.ficheMoteurMalusArmure} (${defense.bouclier.nom})`,
      valeur: defense.bouclier.malusTests,
      type: 'malus_armure',
      retenue: true,
      motifEcart: null,
    })
  }

  const total = contributions.reduce((somme, c) => somme + c.valeur, 0)
  return { total, detail: contributions, manquants: [] }
}

/** Le total d'une compétence et son détail complet.
 *
 * Bloquant (`total` à `null`) : `competence.rangs` absent, la caractéristique
 * de la compétence absente, ou sa valeur effective introuvable. Non bloquant
 * (compté dans `manquants` mais n'empêche pas un total) : un type de bonus
 * inconnu au sein de `competence.modificateurs`, cf. `resoudre.ts`. */
export function totalCompetence(fiche: Fiche, competence: Competence, tables: TablesRegles): ResultatCalcul {
  const manquants: string[] = []
  const contributions: Contribution[] = []
  let bloquant = false

  if (competence.rangs === null) {
    manquants.push('rangs')
    bloquant = true
  } else {
    contributions.push({
      libelle: MOTS.ficheMoteurRangsCompetence,
      valeur: competence.rangs,
      type: 'rang_competence',
      retenue: true,
      motifEcart: null,
    })
  }

  // Le schéma (étape 07) type `caracteristique` comme non nullable, mais ce
  // moteur reste défensif face à une fiche chargée depuis un stockage non
  // garanti par ce type au moment de l'écriture — cf. critère de
  // vérification n°3 du plan.
  const caracteristique = competence.caracteristique as Caracteristique | null

  if (caracteristique === null) {
    manquants.push('caracteristique')
    bloquant = true
  } else {
    const entreeCarac = fiche.caracteristiques[caracteristique]
    const valeurEffective = valeurEffectiveCaracteristique(entreeCarac, tables.typesBonus)

    if (valeurEffective.total === null) {
      manquants.push(`valeur de ${caracteristique}`)
      bloquant = true
    } else {
      const modificateur = modificateurCaracteristique(valeurEffective.total, tables.modificateursCarac)
      if (modificateur.total === null) {
        manquants.push(`valeur de ${caracteristique}`)
        bloquant = true
      } else {
        contributions.push({
          libelle: `${MOTS.ficheMoteurModificateurCaracteristique} (${caracteristique})`,
          valeur: modificateur.total,
          type: 'modificateur_caracteristique',
          retenue: true,
          motifEcart: null,
        })
      }
    }
  }

  if (competence.estDeClasse && competence.rangs !== null && competence.rangs > 0) {
    contributions.push({
      libelle: MOTS.ficheMoteurBonusCompetenceDeClasse,
      valeur: BONUS_COMPETENCE_DE_CLASSE,
      type: 'competence_classe',
      retenue: true,
      motifEcart: null,
    })
  }

  const resoluModificateurs = resoudre(competence.modificateurs, tables.typesBonus)
  if (resoluModificateurs.total === null) bloquant = true
  manquants.push(...resoluModificateurs.manquants)
  contributions.push(...resoluModificateurs.detail)

  if (competence.subitMalusArmure) {
    const malus = malusArmureEffectif(fiche.defense)
    contributions.push(...malus.detail)
  }

  if (bloquant) {
    return { total: null, detail: contributions, manquants }
  }

  const total = contributions.reduce((somme, c) => (c.retenue ? somme + c.valeur : somme), 0)
  return { total, detail: contributions, manquants }
}
