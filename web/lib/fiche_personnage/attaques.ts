/**
 * Bonus d'attaque, série d'attaques multiples et bonus de dégâts — cf.
 * `build/fiche_personnage/09_MOTEUR_DEFENSE_COMBAT.md`.
 *
 * Formules sourcées sur pathfinder-fr.org :
 * - Bonus d'attaque au corps à corps = bonus de base à l'attaque +
 *   modificateur de Force + modificateur de taille ; à distance, on
 *   remplace Force par Dextérité (le malus de portée n'est pas calculé
 *   ici : la fiche ne porte aucune notion de distance à une cible, cf.
 *   lacunes assumées).
 *   https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Valeurs%20de%20combat.ashx
 *   (section « Bonus d'attaque ») — le modificateur de taille employé est
 *   celui de la table de la CA (même page, « Autres modificateurs »),
 *   partagé avec `defense.ts`.
 * - Attaque à outrance : « Lorsque le bonus de base à l'attaque d'un
 *   personnage atteint +6, +11 ou +16, il reçoit une attaque
 *   supplémentaire », en les portant « en commençant par celle qui
 *   s'accompagne du meilleur bonus » — donc en ordre décroissant.
 *   https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Vocabulaire%20courant.ashx
 *   (entrée « Bonus de base à l'attaque (BBA) ») et
 *   https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Actions%20complexes.ashx
 *   (section « L'attaque à outrance »). Le décrément de 5 entre deux
 *   attaques n'est pas énoncé en toutes lettres sur ces deux pages ; il est
 *   lu directement dans `data/regles/progression_classes.json`
 *   (`bba_serie`, déjà sourcé dans son propre `meta`), où chaque série
 *   observée (ex. guerrier niveau 16 : +16/+11/+6/+1) confirme le
 *   décrément régulier de 5 entre les seuils +6/+11/+16 ci-dessus. Quand la
 *   classe et le niveau du personnage sont connus et présents dans cette
 *   table, la série lue y est utilisée directement ; sinon, la règle du
 *   décrément est appliquée.
 *
 * Fonctions pures : les tables arrivent en argument.
 */

import { MOTS } from '@/lib/design/tokens'
import type { Attaque, Fiche } from '@/lib/fiche_personnage/schema'
import type { TablesRegles } from '@/lib/fiche_personnage/regles'
import { resoudre, type Contribution, type ResultatCalcul } from '@/lib/fiche_personnage/resoudre'
import { modificateurCaracteristique, valeurEffectiveCaracteristique } from '@/lib/fiche_personnage/caracteristiques'
import { MODIFICATEURS_TAILLE_CA, normaliserTaille } from '@/lib/fiche_personnage/defense'

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null
}

interface NiveauProgression {
  readonly niveau: number
  readonly bba_serie: readonly number[]
}

function extraireSeriePourClasse(donnees: unknown, slug: string, niveau: number): readonly number[] | null {
  if (!estObjet(donnees)) return null
  const classe = donnees[slug]
  if (!estObjet(classe) || !Array.isArray(classe.progression)) return null

  const niveaux: NiveauProgression[] = []
  for (const entree of classe.progression) {
    if (!estObjet(entree) || typeof entree.niveau !== 'number' || !Array.isArray(entree.bba_serie)) continue
    const valeurs: number[] = []
    for (const v of entree.bba_serie) {
      if (typeof v !== 'string') return null
      const n = Number.parseInt(v, 10)
      if (!Number.isFinite(n)) return null
      valeurs.push(n)
    }
    niveaux.push({ niveau: entree.niveau, bba_serie: valeurs })
  }

  const trouve = niveaux.find((n) => n.niveau === niveau)
  return trouve ? trouve.bba_serie : null
}

/** La série d'attaques multiples pour un bonus de base à l'attaque donné.
 * `bbaBase` à `null` rend un tableau à un seul élément, ce Resultat portant
 * `total: null` — jamais un tableau vide, cf. critère de vérification n°5
 * du plan. */
export function serieAttaques(
  bbaBase: number | null,
  tables: TablesRegles,
  classeConnue?: { readonly slug: string; readonly niveau: number },
): readonly ResultatCalcul[] {
  if (bbaBase === null) {
    return [{ total: null, detail: [], manquants: ['combat.bbaBase'] }]
  }

  if (classeConnue) {
    const serie = extraireSeriePourClasse(tables.progressionClasses, classeConnue.slug, classeConnue.niveau)
    if (serie !== null && serie.length > 0) {
      return serie.map((valeur) => ({
        total: valeur,
        detail: [
          {
            libelle: MOTS.ficheMoteurAttaqueSerieClasse,
            valeur,
            type: 'bba_serie',
            retenue: true,
            motifEcart: null,
          },
        ],
        manquants: [],
      }))
    }
  }

  // Une attaque supplémentaire tous les 5 points pleins de bonus de base à
  // l'attaque, à partir de +6 (donc jusqu'à quatre attaques à +16, comme
  // observé dans `progression_classes.json`) ; jamais moins d'une attaque.
  const nombreAttaques = bbaBase >= 1 ? 1 + Math.floor((bbaBase - 1) / 5) : 1
  const valeurs = Array.from({ length: nombreAttaques }, (_, i) => bbaBase - 5 * i)

  return valeurs.map((valeur) => ({
    total: valeur,
    detail: [
      {
        libelle: MOTS.ficheMoteurAttaqueSerieGenerique,
        valeur,
        type: 'bba_serie',
        retenue: true,
        motifEcart: null,
      },
    ],
    manquants: [],
  }))
}

function construireBonusAttaque(bba: number, fiche: Fiche, attaque: Attaque, tables: TablesRegles): ResultatCalcul {
  const contributions: Contribution[] = [
    { libelle: MOTS.ficheMoteurBmoBase, valeur: bba, type: 'bba', retenue: true, motifEcart: null },
  ]
  const manquants: string[] = []

  if (attaque.caracteristiqueAttaque === null) {
    contributions.push({
      libelle: MOTS.ficheMoteurAucuneCaracteristiqueAttaque,
      valeur: 0,
      type: 'caracteristique_attaque',
      retenue: true,
      motifEcart: null,
    })
  } else {
    const carac = attaque.caracteristiqueAttaque
    const caracEffective = valeurEffectiveCaracteristique(fiche.caracteristiques[carac], tables.typesBonus)
    if (caracEffective.total === null) {
      manquants.push(...(caracEffective.manquants.length > 0 ? caracEffective.manquants : [`caracteristiques.${carac}`]))
    } else {
      const caracModificateur = modificateurCaracteristique(caracEffective.total, tables.modificateursCarac)
      if (caracModificateur.total === null) {
        manquants.push(...caracModificateur.manquants)
      } else {
        contributions.push({
          libelle: MOTS.ficheMoteurModificateurCaracteristique,
          valeur: caracModificateur.total,
          type: carac,
          retenue: true,
          motifEcart: null,
        })
      }
    }
  }

  const tailleCle = normaliserTaille(fiche.identite.taille)
  const tailleValeur = Object.prototype.hasOwnProperty.call(MODIFICATEURS_TAILLE_CA, tailleCle)
    ? MODIFICATEURS_TAILLE_CA[tailleCle] ?? null
    : null
  if (tailleValeur === null) {
    manquants.push('identite.taille')
  } else {
    contributions.push({
      libelle: MOTS.ficheMoteurModificateurTaille,
      valeur: tailleValeur,
      type: 'taille',
      retenue: true,
      motifEcart: null,
    })
  }

  const resoluAttaque = resoudre(attaque.modificateursAttaque, tables.typesBonus)
  manquants.push(...resoluAttaque.manquants)

  if (manquants.length > 0) {
    return { total: null, detail: [...contributions, ...resoluAttaque.detail], manquants }
  }

  const detail = [...contributions, ...resoluAttaque.detail]
  return { total: detail.reduce((s, c) => (c.retenue ? s + c.valeur : s), 0), detail, manquants: [] }
}

/** Bonus d'attaque total pour une attaque, sur le bonus de base à l'attaque
 * plein (première attaque de la série). */
export function bonusAttaque(fiche: Fiche, attaque: Attaque, tables: TablesRegles): ResultatCalcul {
  const bba = fiche.combat.bbaBase
  if (bba === null) {
    return { total: null, detail: [], manquants: ['combat.bbaBase'] }
  }
  return construireBonusAttaque(bba, fiche, attaque, tables)
}

/** Bonus de dégâts pour une attaque : modificateur de la caractéristique de
 * dégâts, plus les modificateurs de dégâts propres à l'attaque. Le dé de
 * dégâts est restitué verbatim par l'appelant, jamais recalculé ici. */
export function bonusDegats(fiche: Fiche, attaque: Attaque, tables: TablesRegles): ResultatCalcul {
  const contributions: Contribution[] = []
  const manquants: string[] = []

  if (attaque.caracteristiqueDegats === null) {
    contributions.push({
      libelle: MOTS.ficheMoteurAucuneCaracteristiqueDegats,
      valeur: 0,
      type: 'caracteristique_degats',
      retenue: true,
      motifEcart: null,
    })
  } else {
    const carac = attaque.caracteristiqueDegats
    const caracEffective = valeurEffectiveCaracteristique(fiche.caracteristiques[carac], tables.typesBonus)
    if (caracEffective.total === null) {
      manquants.push(...(caracEffective.manquants.length > 0 ? caracEffective.manquants : [`caracteristiques.${carac}`]))
    } else {
      const caracModificateur = modificateurCaracteristique(caracEffective.total, tables.modificateursCarac)
      if (caracModificateur.total === null) {
        manquants.push(...caracModificateur.manquants)
      } else {
        contributions.push({
          libelle: MOTS.ficheMoteurModificateurCaracteristique,
          valeur: caracModificateur.total,
          type: carac,
          retenue: true,
          motifEcart: null,
        })
      }
    }
  }

  const resoluDegats = resoudre(attaque.modificateursDegats, tables.typesBonus)
  manquants.push(...resoluDegats.manquants)

  const detail = [...contributions, ...resoluDegats.detail]
  if (manquants.length > 0) {
    return { total: null, detail, manquants }
  }
  return { total: detail.reduce((s, c) => (c.retenue ? s + c.valeur : s), 0), detail, manquants: [] }
}

/** Une attaque complète : sa série de bonus d'attaque (un par attaque de la
 * série) et son bonus de dégâts. */
export interface AttaqueComplete {
  readonly attaque: Attaque
  readonly bonusParAttaque: readonly ResultatCalcul[]
  readonly degats: ResultatCalcul
}

/** `serieAttaques` appliquée à chaque attaque de la fiche : les mêmes
 * contributions non liées au bonus de base (caractéristique, taille,
 * modificateurs propres à l'attaque) sont recombinées avec chaque valeur
 * décrémentée de la série, jamais recalculées indépendamment. */
export function attaquesCompletes(fiche: Fiche, tables: TablesRegles): readonly AttaqueComplete[] {
  const serie = serieAttaques(fiche.combat.bbaBase, tables)

  return fiche.attaques.map((attaque) => {
    const bonusParAttaque =
      serie[0]?.total === null
        ? serie
        : serie.map((entree) => construireBonusAttaque(entree.total as number, fiche, attaque, tables))

    return {
      attaque,
      bonusParAttaque,
      degats: bonusDegats(fiche, attaque, tables),
    }
  })
}
