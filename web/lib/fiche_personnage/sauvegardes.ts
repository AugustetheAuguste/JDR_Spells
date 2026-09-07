/**
 * Les trois jets de sauvegarde — cf.
 * `build/fiche_personnage/09_MOTEUR_DEFENSE_COMBAT.md`.
 *
 * Formule sourcée : « Modificateur du jet de sauvegarde = Bonus de base au
 * jet de sauvegarde + modificateur de caractéristique. » Association jet ↔
 * caractéristique : Réflexes ↔ Dextérité, Vigueur ↔ Constitution, Volonté ↔
 * Sagesse — jamais supposée, lue sur :
 * https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Valeurs%20de%20combat.ashx
 * (section « Jets de sauvegarde »).
 *
 * Fonction pure : la table arrive en argument.
 */

import { MOTS } from '@/lib/design/tokens'
import type { Caracteristique, Fiche, Sauvegarde } from '@/lib/fiche_personnage/schema'
import type { TablesRegles } from '@/lib/fiche_personnage/regles'
import { resoudre, type ResultatCalcul } from '@/lib/fiche_personnage/resoudre'
import { modificateurCaracteristique, valeurEffectiveCaracteristique } from '@/lib/fiche_personnage/caracteristiques'

/** L'association jet de sauvegarde ↔ caractéristique, lue sur la page
 * source citée ci-dessus — jamais devinée. */
export const CARACTERISTIQUE_PAR_SAUVEGARDE: Readonly<Record<Sauvegarde, Caracteristique>> = {
  reflexes: 'dexterite',
  vigueur: 'constitution',
  volonte: 'sagesse',
}

/** Un jet de sauvegarde : base saisie, plus le modificateur de la
 * caractéristique associée, plus les modificateurs propres au jet. Une base
 * `null` rend `introuvable`, jamais le seul modificateur de caractéristique. */
export function sauvegarde(fiche: Fiche, quelle: Sauvegarde, tables: TablesRegles): ResultatCalcul {
  const entree = fiche.sauvegardes[quelle]

  if (entree.base === null) {
    return { total: null, detail: [], manquants: [`sauvegardes.${quelle}.base`] }
  }

  const caracteristique = CARACTERISTIQUE_PAR_SAUVEGARDE[quelle]
  const caracEffective = valeurEffectiveCaracteristique(fiche.caracteristiques[caracteristique], tables.typesBonus)
  if (caracEffective.total === null) {
    return {
      total: null,
      detail: [],
      manquants:
        caracEffective.manquants.length > 0 ? caracEffective.manquants : [`caracteristiques.${caracteristique}`],
    }
  }

  const caracModificateur = modificateurCaracteristique(caracEffective.total, tables.modificateursCarac)
  if (caracModificateur.total === null) {
    return { total: null, detail: [], manquants: caracModificateur.manquants }
  }

  const resoluModificateurs = resoudre(entree.modificateurs, tables.typesBonus)
  if (resoluModificateurs.total === null) {
    return { total: null, detail: resoluModificateurs.detail, manquants: resoluModificateurs.manquants }
  }

  const detail = [
    {
      libelle: MOTS.ficheMoteurSauvegardeBase,
      valeur: entree.base,
      type: 'base',
      retenue: true,
      motifEcart: null,
    },
    {
      libelle: MOTS.ficheMoteurModificateurCaracteristique,
      valeur: caracModificateur.total,
      type: caracteristique,
      retenue: true,
      motifEcart: null,
    },
    ...resoluModificateurs.detail,
  ]

  return {
    total: entree.base + caracModificateur.total + resoluModificateurs.total,
    detail,
    manquants: resoluModificateurs.manquants,
  }
}
