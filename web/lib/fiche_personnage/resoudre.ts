/**
 * Résolution d'une liste de modificateurs : la règle de non cumul par type,
 * lue dans `types_bonus.json` (jamais écrite en dur ici), et le contrat de
 * retour à sept clés du Skill pf-fiche-personnage § 6.
 *
 * Fonction pure : aucune table n'est chargée ici, elle arrive en argument.
 */

import { MOTS } from '@/lib/design/tokens'
import type { Modificateur } from '@/lib/fiche_personnage/schema'
import type { TypeBonus } from '@/lib/fiche_personnage/regles'

/** Une ligne du détail rendu par le moteur : la contribution d'un
 * modificateur au total, retenue ou écartée, avec son motif. */
export interface Contribution {
  readonly libelle: string
  readonly valeur: number
  readonly type: string
  readonly retenue: boolean
  readonly motifEcart: string | null
}

/** Le contrat de retour, imposé à toute fonction de calcul du moteur. */
export interface ResultatCalcul {
  readonly total: number | null
  readonly detail: readonly Contribution[]
  readonly manquants: readonly string[]
}

/** Résout une liste de modificateurs contre la table des types de bonus.
 *
 * - `typesBonus` introuvable : `total` vaut `null`, aucune contribution n'est
 *   retenue, `manquants` porte `'types_bonus'`.
 * - Type connu et cumulable : toutes les contributions du groupe sont
 *   retenues.
 * - Type connu et non cumulable : le meilleur bonus (valeur la plus haute
 *   parmi les valeurs non négatives) ET le pire malus (valeur la plus basse
 *   parmi les valeurs négatives) sont retenus ensemble — un malus de même
 *   type qu'un bonus retenu ne disparaît jamais.
 * - Type connu mais dont `cumulable` vaut `null` (la page source ne tranche
 *   pas) : tout est retenu, par la maxime de sûreté du dépôt, et le type est
 *   ajouté à `manquants`.
 * - Type inconnu de la table : tout est retenu, un type inconnu n'étant pas
 *   une preuve de non cumul, et le type est ajouté à `manquants`.
 */
export function resoudre(
  modificateurs: readonly Modificateur[],
  typesBonus: readonly TypeBonus[] | null,
): ResultatCalcul {
  if (typesBonus === null) {
    return {
      total: null,
      detail: modificateurs.map((m) => ({
        libelle: m.libelle,
        valeur: m.valeur,
        type: m.type,
        retenue: false,
        motifEcart: MOTS.ficheMoteurTypesBonusIntrouvable,
      })),
      manquants: ['types_bonus'],
    }
  }

  // Cas légitime : l'absence de modificateur est une information complète
  // (« le personnage n'a aucun bonus de ce genre »), pas une lacune — le seul
  // zéro de cette étape qui n'est pas une valeur par défaut déguisée.
  if (modificateurs.length === 0) {
    return { total: 0, detail: [], manquants: [] }
  }

  const parCle = new Map<string, TypeBonus>()
  for (const t of typesBonus) parCle.set(t.cle, t)

  const groupes = new Map<string, Modificateur[]>()
  for (const m of modificateurs) {
    const groupe = groupes.get(m.type)
    if (groupe) groupe.push(m)
    else groupes.set(m.type, [m])
  }

  // Identité d'objet comme clé : deux modificateurs distincts, même de même
  // libellé et de même valeur, restent deux lignes distinctes du détail.
  const retenueParModificateur = new Map<Modificateur, boolean>()
  const motifParModificateur = new Map<Modificateur, string | null>()
  const manquants: string[] = []

  for (const [typeCle, groupe] of groupes) {
    const typeInfo = parCle.get(typeCle)

    if (!typeInfo) {
      for (const m of groupe) retenueParModificateur.set(m, true)
      manquants.push(typeCle)
      continue
    }

    if (typeInfo.cumulable === true) {
      for (const m of groupe) retenueParModificateur.set(m, true)
      continue
    }

    if (typeInfo.cumulable === null) {
      for (const m of groupe) retenueParModificateur.set(m, true)
      manquants.push(typeCle)
      continue
    }

    // cumulable === false : le meilleur bonus (valeur >= 0) et le pire malus
    // (valeur < 0) coexistent, l'un n'efface pas l'autre.
    let meilleurBonus: Modificateur | null = null
    let pireMalus: Modificateur | null = null
    for (const m of groupe) {
      if (m.valeur >= 0) {
        if (meilleurBonus === null || m.valeur > meilleurBonus.valeur) meilleurBonus = m
      } else {
        if (pireMalus === null || m.valeur < pireMalus.valeur) pireMalus = m
      }
    }

    for (const m of groupe) {
      if (m === meilleurBonus || m === pireMalus) {
        retenueParModificateur.set(m, true)
        continue
      }
      retenueParModificateur.set(m, false)
      const supplantant = m.valeur < 0 ? pireMalus : meilleurBonus
      motifParModificateur.set(
        m,
        supplantant
          ? `${MOTS.ficheMoteurSupplantePar} « ${supplantant.libelle} »`
          : MOTS.ficheMoteurSupplantePar,
      )
    }
  }

  const detail: Contribution[] = modificateurs.map((m) => {
    const estRetenue = retenueParModificateur.get(m) ?? false
    return {
      libelle: m.libelle,
      valeur: m.valeur,
      type: m.type,
      retenue: estRetenue,
      motifEcart: estRetenue ? null : motifParModificateur.get(m) ?? null,
    }
  })

  const total = detail.reduce((somme, c) => (c.retenue ? somme + c.valeur : somme), 0)

  return { total, detail, manquants }
}
