/**
 * Le modificateur de caractéristique, lu dans la table
 * `modificateurs_caracteristiques.json`, jamais calculé par une formule
 * écrite de mémoire — cf. `build/fiche_personnage/08_MOTEUR_BONUS.md`.
 *
 * Fonction pure : la table arrive en argument.
 */

import { MOTS } from '@/lib/design/tokens'
import type { EntreeCaracteristique } from '@/lib/fiche_personnage/schema'
import type { ModificateursCaracteristiques, TypeBonus } from '@/lib/fiche_personnage/regles'
import { resoudre, type ResultatCalcul } from '@/lib/fiche_personnage/resoudre'

/** Rend le modificateur associé à une valeur de caractéristique. La table a
 * deux formes possibles selon ce que la page source donnait — bornes ou
 * valeurs exactes — jamais devinées ni extrapolées au-delà de ce qui a été
 * lu. */
export function modificateurCaracteristique(
  valeur: number | null,
  table: ModificateursCaracteristiques | null,
): ResultatCalcul {
  if (valeur === null) {
    return { total: null, detail: [], manquants: ['valeur'] }
  }

  if (table === null) {
    return { total: null, detail: [], manquants: ['modificateurs_caracteristiques'] }
  }

  let modificateur: number | null = null

  if ('bornes' in table) {
    const borne = table.bornes.find((b) => valeur >= b.min && valeur <= b.max)
    modificateur = borne ? borne.modificateur : null
  } else {
    const cle = String(valeur)
    modificateur = Object.prototype.hasOwnProperty.call(table.valeurs, cle) ? table.valeurs[cle] ?? null : null
  }

  if (modificateur === null) {
    // Ni interpolation ni extrapolation : une valeur hors des bornes lues
    // reste introuvable plutôt qu'un chiffre inventé.
    return { total: null, detail: [], manquants: ['valeur hors des bornes lues'] }
  }

  return {
    total: modificateur,
    detail: [
      {
        libelle: MOTS.ficheMoteurModificateurCaracteristique,
        valeur: modificateur,
        type: 'modificateur_caracteristique',
        retenue: true,
        motifEcart: null,
      },
    ],
    manquants: [],
  }
}

/** La valeur effective d'une caractéristique : sa base, plus le total résolu
 * de ses modificateurs. `introuvable` se propage depuis la base absente ou
 * depuis un total de modificateurs introuvable — jamais une somme partielle
 * silencieuse. */
export function valeurEffectiveCaracteristique(
  entree: EntreeCaracteristique,
  typesBonus: readonly TypeBonus[] | null,
): ResultatCalcul {
  if (entree.base === null) {
    return { total: null, detail: [], manquants: ['base'] }
  }

  const resultatModificateurs = resoudre(entree.modificateurs, typesBonus)

  if (resultatModificateurs.total === null) {
    return {
      total: null,
      detail: resultatModificateurs.detail,
      manquants: resultatModificateurs.manquants,
    }
  }

  return {
    total: entree.base + resultatModificateurs.total,
    detail: resultatModificateurs.detail,
    manquants: resultatModificateurs.manquants,
  }
}
