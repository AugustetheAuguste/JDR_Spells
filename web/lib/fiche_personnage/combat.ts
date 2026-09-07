/**
 * Initiative, manœuvres de combat, points de vie et résistance à la magie —
 * cf. `build/fiche_personnage/09_MOTEUR_DEFENSE_COMBAT.md`.
 *
 * Formules sourcées sur pathfinder-fr.org :
 * - Initiative : un test de Dextérité, modificateur de Dextérité inclus.
 *   https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Le%20d%c3%a9roulement%20d%27un%20combat.ashx
 *   (section « L'initiative »).
 * - BMO = bonus de base à l'attaque + modificateur de Force + modificateur
 *   de taille (table dédiée, différente de celle de la CA — une créature
 *   très petite ou plus petite utilise son modificateur de Dextérité à la
 *   place de celui de Force) ; DDM = 10 + bonus de base à l'attaque +
 *   modificateur de Force + modificateur de Dextérité + le même
 *   modificateur de taille.
 *   https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Man%c5%93uvres%20offensives.ashx
 * - Points de vie maximum et résistance à la magie : valeurs saisies, cf.
 *   § « Notes d'implémentation » du plan — le dé de vie moyen, le choix du
 *   joueur et les dons ne se déduisent pas sans règle non sourcée.
 *
 * Fonctions pures : les tables arrivent en argument.
 */

import { MOTS } from '@/lib/design/tokens'
import type { Fiche } from '@/lib/fiche_personnage/schema'
import type { TablesRegles } from '@/lib/fiche_personnage/regles'
import type { ResultatCalcul } from '@/lib/fiche_personnage/resoudre'
import {
  modificateurCaracteristique,
  valeurEffectiveCaracteristique,
} from '@/lib/fiche_personnage/caracteristiques'
import { normaliserTaille } from '@/lib/fiche_personnage/defense'

/** Modificateurs de taille au BMO et au DDM, lus sur « Les manœuvres
 * offensives » — signe opposé à celui de la table de la CA (une grande
 * créature est meilleure en manœuvre, pas moins facile à toucher). */
const MODIFICATEURS_TAILLE_MANOEUVRE: Readonly<Record<string, number>> = {
  colossal: 8,
  colossale: 8,
  gigantesque: 4,
  'tres grand': 2,
  'tres grande': 2,
  tg: 2,
  grand: 1,
  grande: 1,
  g: 1,
  moyen: 0,
  moyenne: 0,
  m: 0,
  petit: -1,
  petite: -1,
  p: -1,
  'tres petit': -2,
  'tres petite': -2,
  tp: -2,
  minuscule: -4,
  min: -4,
  infime: -8,
  i: -8,
}

/** Tailles pour lesquelles le BMO utilise le modificateur de Dextérité au
 * lieu de celui de Force — « Les créatures de taille TP ou moins utilisent
 * leur modificateur de Dextérité au lieu du modificateur de Force pour
 * déterminer leur BMO. » (même page que ci-dessus). */
const TAILLES_BMO_PAR_DEXTERITE = new Set(['tres petit', 'tres petite', 'tp', 'minuscule', 'min', 'infime', 'i'])

function modificateurTailleManoeuvre(taille: string): number | null {
  const cle = normaliserTaille(taille)
  return Object.prototype.hasOwnProperty.call(MODIFICATEURS_TAILLE_MANOEUVRE, cle)
    ? MODIFICATEURS_TAILLE_MANOEUVRE[cle] ?? null
    : null
}

/** Initiative : le modificateur de Dextérité, seule entrée que le schéma de
 * la fiche porte pour cette valeur à cette étape (aucune liste de
 * modificateurs d'initiative n'existe encore sur `Fiche`). */
export function initiative(fiche: Fiche, tables: TablesRegles): ResultatCalcul {
  const dexEffective = valeurEffectiveCaracteristique(fiche.caracteristiques.dexterite, tables.typesBonus)
  if (dexEffective.total === null) {
    return {
      total: null,
      detail: [],
      manquants: dexEffective.manquants.length > 0 ? dexEffective.manquants : ['caracteristiques.dexterite'],
    }
  }
  const dexModificateur = modificateurCaracteristique(dexEffective.total, tables.modificateursCarac)
  if (dexModificateur.total === null) {
    return { total: null, detail: [], manquants: dexModificateur.manquants }
  }
  return {
    total: dexModificateur.total,
    detail: [
      {
        libelle: MOTS.ficheMoteurInitiativeDexterite,
        valeur: dexModificateur.total,
        type: 'dexterite',
        retenue: true,
        motifEcart: null,
      },
    ],
    manquants: [],
  }
}

/** Points de vie maximum : valeur saisie, jamais reconstituée à partir du
 * dé de vie. */
export function pointsDeVieMaximum(fiche: Fiche): ResultatCalcul {
  const valeur = fiche.combat.pvMax
  if (valeur === null) {
    return { total: null, detail: [], manquants: ['combat.pvMax'] }
  }
  return {
    total: valeur,
    detail: [
      {
        libelle: MOTS.ficheMoteurPvMaxSaisi,
        valeur,
        type: 'saisie',
        retenue: true,
        motifEcart: null,
      },
    ],
    manquants: [],
  }
}

/** Résistance à la magie : valeur saisie, `introuvable` si absente, jamais
 * `0` par défaut. */
export function resistanceMagie(fiche: Fiche): ResultatCalcul {
  const valeur = fiche.combat.resistanceMagie
  if (valeur === null) {
    return { total: null, detail: [], manquants: ['combat.resistanceMagie'] }
  }
  return {
    total: valeur,
    detail: [
      {
        libelle: MOTS.ficheMoteurResistanceMagieSaisie,
        valeur,
        type: 'saisie',
        retenue: true,
        motifEcart: null,
      },
    ],
    manquants: [],
  }
}

/** Bonus de manœuvre offensive (BMO). */
export function manoeuvreOffensive(fiche: Fiche, tables: TablesRegles): ResultatCalcul {
  const bba = fiche.combat.bbaBase
  if (bba === null) {
    return { total: null, detail: [], manquants: ['combat.bbaBase'] }
  }

  const utiliseDexterite = TAILLES_BMO_PAR_DEXTERITE.has(normaliserTaille(fiche.identite.taille))
  const caracteristique = utiliseDexterite ? fiche.caracteristiques.dexterite : fiche.caracteristiques.force
  const caracLibelle = utiliseDexterite ? MOTS.ficheMoteurBmoDexterite : MOTS.ficheMoteurBmoForce
  const caracType = utiliseDexterite ? 'dexterite' : 'force'

  const caracEffective = valeurEffectiveCaracteristique(caracteristique, tables.typesBonus)
  if (caracEffective.total === null) {
    return {
      total: null,
      detail: [],
      manquants: caracEffective.manquants.length > 0 ? caracEffective.manquants : [`caracteristiques.${caracType}`],
    }
  }
  const caracModificateur = modificateurCaracteristique(caracEffective.total, tables.modificateursCarac)
  if (caracModificateur.total === null) {
    return { total: null, detail: [], manquants: caracModificateur.manquants }
  }

  const tailleValeur = modificateurTailleManoeuvre(fiche.identite.taille)
  if (tailleValeur === null) {
    return { total: null, detail: [], manquants: ['identite.taille'] }
  }

  const detail = [
    { libelle: MOTS.ficheMoteurBmoBase, valeur: bba, type: 'bba', retenue: true, motifEcart: null },
    { libelle: caracLibelle, valeur: caracModificateur.total, type: caracType, retenue: true, motifEcart: null },
    {
      libelle: MOTS.ficheMoteurModificateurTaille,
      valeur: tailleValeur,
      type: 'taille',
      retenue: true,
      motifEcart: null,
    },
  ]

  return { total: bba + caracModificateur.total + tailleValeur, detail, manquants: [] }
}

/** Degré de manœuvre défensive (DDM). */
export function manoeuvreDefensive(fiche: Fiche, tables: TablesRegles): ResultatCalcul {
  const bba = fiche.combat.bbaBase
  if (bba === null) {
    return { total: null, detail: [], manquants: ['combat.bbaBase'] }
  }

  const forceEffective = valeurEffectiveCaracteristique(fiche.caracteristiques.force, tables.typesBonus)
  const dexEffective = valeurEffectiveCaracteristique(fiche.caracteristiques.dexterite, tables.typesBonus)
  if (forceEffective.total === null || dexEffective.total === null) {
    const manquants = [
      ...(forceEffective.total === null
        ? forceEffective.manquants.length > 0
          ? forceEffective.manquants
          : ['caracteristiques.force']
        : []),
      ...(dexEffective.total === null
        ? dexEffective.manquants.length > 0
          ? dexEffective.manquants
          : ['caracteristiques.dexterite']
        : []),
    ]
    return { total: null, detail: [], manquants }
  }

  const forceModificateur = modificateurCaracteristique(forceEffective.total, tables.modificateursCarac)
  const dexModificateur = modificateurCaracteristique(dexEffective.total, tables.modificateursCarac)
  if (forceModificateur.total === null || dexModificateur.total === null) {
    return {
      total: null,
      detail: [],
      manquants: [...forceModificateur.manquants, ...dexModificateur.manquants],
    }
  }

  const tailleValeur = modificateurTailleManoeuvre(fiche.identite.taille)
  if (tailleValeur === null) {
    return { total: null, detail: [], manquants: ['identite.taille'] }
  }

  const detail = [
    { libelle: MOTS.ficheMoteurDdmBase, valeur: 10, type: 'base', retenue: true, motifEcart: null },
    { libelle: MOTS.ficheMoteurBmoBase, valeur: bba, type: 'bba', retenue: true, motifEcart: null },
    {
      libelle: MOTS.ficheMoteurDdmForce,
      valeur: forceModificateur.total,
      type: 'force',
      retenue: true,
      motifEcart: null,
    },
    {
      libelle: MOTS.ficheMoteurDdmDexterite,
      valeur: dexModificateur.total,
      type: 'dexterite',
      retenue: true,
      motifEcart: null,
    },
    {
      libelle: MOTS.ficheMoteurModificateurTaille,
      valeur: tailleValeur,
      type: 'taille',
      retenue: true,
      motifEcart: null,
    },
  ]

  return {
    total: 10 + bba + forceModificateur.total + dexModificateur.total + tailleValeur,
    detail,
    manquants: [],
  }
}
