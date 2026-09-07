/* Validateur de forme pour la fiche de personnage.
 *
 * Juge la forme, jamais la plausibilité d'une valeur de jeu (cf. Skill
 * pf-fiche-personnage, build/fiche_personnage/07_SCHEMA_FICHE.md). Une Force
 * de 47 est valide, un niveau 31 est valide. Accumule tous les refus, ne
 * s'arrête jamais au premier.
 */
import { MOTS } from '@/lib/design/tokens'
import type { Fiche } from './schema'
import { VERSION_SCHEMA } from './schema'

export interface Refus {
  readonly chemin: string
  readonly motif: string
}

export type Verdict = { readonly ok: true; readonly fiche: Fiche } | { readonly ok: false; readonly refus: readonly Refus[] }

const CLES_MODIFICATEUR = ['libelle', 'valeur', 'type', 'origine', 'sourceUrl', 'saisieManuelle'] as const

const MOTS_INTERDITS = ['poids', 'charge', 'encombrement', 'actuel', 'restant', 'depense'] as const

const CLES_RACINE = [
  'schemaVersion',
  'id',
  'personnageId',
  'meta',
  'identite',
  'caracteristiques',
  'combat',
  'defense',
  'sauvegardes',
  'attaques',
  'competences',
  'dons',
  'aptitudes',
  'sorts',
  'equipement',
  'notes',
] as const

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

function contientMotInterdit(cle: string): boolean {
  const normalisee = cle.toLowerCase()
  return MOTS_INTERDITS.some((mot) => normalisee.includes(mot))
}

/** Parcourt tout l'arbre et signale toute clé de poids ou de consommation, où qu'elle soit. */
function chercherChampsInterdits(valeur: unknown, chemin: string, refus: Refus[]): void {
  if (Array.isArray(valeur)) {
    valeur.forEach((element, index) => chercherChampsInterdits(element, `${chemin}[${index}]`, refus))
    return
  }
  if (!estObjet(valeur)) return
  for (const cle of Object.keys(valeur)) {
    const cheminEnfant = chemin === '' ? cle : `${chemin}.${cle}`
    if (contientMotInterdit(cle)) {
      refus.push({ chemin: cheminEnfant, motif: MOTS.ficheRefusChampInterdit })
    }
    chercherChampsInterdits(valeur[cle], cheminEnfant, refus)
  }
}

function validerModificateurs(valeur: unknown, chemin: string, refus: Refus[]): void {
  if (!Array.isArray(valeur)) {
    refus.push({ chemin, motif: MOTS.ficheRefusTypeInvalide })
    return
  }
  valeur.forEach((entree, index) => {
    const cheminEntree = `${chemin}[${index}]`
    if (!estObjet(entree)) {
      refus.push({ chemin: cheminEntree, motif: MOTS.ficheRefusModificateurInvalide })
      return
    }
    const cles = Object.keys(entree)
    const ensembleAttendu = new Set<string>(CLES_MODIFICATEUR)
    const memeCles =
      cles.length === CLES_MODIFICATEUR.length && cles.every((cle) => ensembleAttendu.has(cle))
    if (!memeCles) {
      refus.push({ chemin: cheminEntree, motif: MOTS.ficheRefusModificateurInvalide })
      return
    }
    if (typeof entree.libelle !== 'string') {
      refus.push({ chemin: `${cheminEntree}.libelle`, motif: MOTS.ficheRefusTypeInvalide })
    }
    if (typeof entree.valeur !== 'number') {
      refus.push({ chemin: `${cheminEntree}.valeur`, motif: MOTS.ficheRefusTypeInvalide })
    }
    if (typeof entree.type !== 'string') {
      refus.push({ chemin: `${cheminEntree}.type`, motif: MOTS.ficheRefusTypeInvalide })
    }
    if (typeof entree.origine !== 'string') {
      refus.push({ chemin: `${cheminEntree}.origine`, motif: MOTS.ficheRefusTypeInvalide })
    }
    if (entree.sourceUrl !== null && typeof entree.sourceUrl !== 'string') {
      refus.push({ chemin: `${cheminEntree}.sourceUrl`, motif: MOTS.ficheRefusTypeInvalide })
    }
    if (typeof entree.saisieManuelle !== 'boolean') {
      refus.push({ chemin: `${cheminEntree}.saisieManuelle`, motif: MOTS.ficheRefusTypeInvalide })
    }
  })
}

function verifierNombreOuNul(valeur: unknown, chemin: string, refus: Refus[]): void {
  if (valeur !== null && typeof valeur !== 'number') {
    refus.push({ chemin, motif: MOTS.ficheRefusTypeInvalide })
  }
}

function verifierChaine(valeur: unknown, chemin: string, refus: Refus[]): void {
  if (typeof valeur !== 'string') {
    refus.push({ chemin, motif: MOTS.ficheRefusTypeInvalide })
  }
}

function verifierCaracteristiques(valeur: unknown, chemin: string, refus: Refus[]): void {
  const attendues = ['force', 'dexterite', 'constitution', 'intelligence', 'sagesse', 'charisme']
  if (!estObjet(valeur)) {
    refus.push({ chemin, motif: MOTS.ficheRefusTypeInvalide })
    return
  }
  for (const cle of attendues) {
    const entree = valeur[cle]
    if (!estObjet(entree)) {
      refus.push({ chemin: `${chemin}.${cle}`, motif: MOTS.ficheRefusChampManquant })
      continue
    }
    verifierNombreOuNul(entree.base, `${chemin}.${cle}.base`, refus)
    validerModificateurs(entree.modificateurs, `${chemin}.${cle}.modificateurs`, refus)
  }
}

function verifierSauvegardes(valeur: unknown, chemin: string, refus: Refus[]): void {
  const attendues = ['reflexes', 'vigueur', 'volonte']
  if (!estObjet(valeur)) {
    refus.push({ chemin, motif: MOTS.ficheRefusTypeInvalide })
    return
  }
  for (const cle of attendues) {
    const entree = valeur[cle]
    if (!estObjet(entree)) {
      refus.push({ chemin: `${chemin}.${cle}`, motif: MOTS.ficheRefusChampManquant })
      continue
    }
    verifierNombreOuNul(entree.base, `${chemin}.${cle}.base`, refus)
    validerModificateurs(entree.modificateurs, `${chemin}.${cle}.modificateurs`, refus)
  }
}

/**
 * Valide la forme d'une entrée inconnue à la version courante du schéma.
 * Ne migre pas, cf. `migrer.ts` pour la chaîne de migration.
 */
export function valider(entree: unknown): Verdict {
  const refus: Refus[] = []

  if (!estObjet(entree)) {
    return { ok: false, refus: [{ chemin: '', motif: MOTS.ficheRefusEntreeInvalide }] }
  }

  if (entree.schemaVersion === undefined) {
    refus.push({ chemin: 'schemaVersion', motif: MOTS.ficheRefusVersionAbsente })
  } else if (typeof entree.schemaVersion !== 'number' || !Number.isInteger(entree.schemaVersion)) {
    refus.push({ chemin: 'schemaVersion', motif: MOTS.ficheRefusVersionInvalide })
  } else if (entree.schemaVersion > VERSION_SCHEMA) {
    refus.push({ chemin: 'schemaVersion', motif: MOTS.ficheRefusVersionSuperieure })
  }

  for (const cle of Object.keys(entree)) {
    if (!(CLES_RACINE as readonly string[]).includes(cle)) {
      refus.push({ chemin: cle, motif: MOTS.ficheRefusCleInconnue })
    }
  }

  for (const cle of CLES_RACINE) {
    if (!(cle in entree)) {
      refus.push({ chemin: cle, motif: MOTS.ficheRefusChampManquant })
    }
  }

  if (typeof entree.id === 'string') {
    // forme correcte, rien à ajouter
  } else if ('id' in entree) {
    refus.push({ chemin: 'id', motif: MOTS.ficheRefusTypeInvalide })
  }

  if ('personnageId' in entree && entree.personnageId !== null && typeof entree.personnageId !== 'string') {
    refus.push({ chemin: 'personnageId', motif: MOTS.ficheRefusTypeInvalide })
  }

  if ('meta' in entree) {
    const meta = entree.meta
    if (!estObjet(meta)) {
      refus.push({ chemin: 'meta', motif: MOTS.ficheRefusTypeInvalide })
    } else {
      verifierChaine(meta.nomPersonnage, 'meta.nomPersonnage', refus)
      verifierChaine(meta.nomJoueur, 'meta.nomJoueur', refus)
      verifierChaine(meta.creeLe, 'meta.creeLe', refus)
      verifierChaine(meta.modifieLe, 'meta.modifieLe', refus)
    }
  }

  if ('identite' in entree) {
    const identite = entree.identite
    if (!estObjet(identite)) {
      refus.push({ chemin: 'identite', motif: MOTS.ficheRefusTypeInvalide })
    } else {
      if (!Array.isArray(identite.classes)) {
        refus.push({ chemin: 'identite.classes', motif: MOTS.ficheRefusTypeInvalide })
      }
      if (!Array.isArray(identite.langues)) {
        refus.push({ chemin: 'identite.langues', motif: MOTS.ficheRefusTypeInvalide })
      }
    }
  }

  if ('caracteristiques' in entree) {
    verifierCaracteristiques(entree.caracteristiques, 'caracteristiques', refus)
  }

  if ('combat' in entree) {
    const combat = entree.combat
    if (!estObjet(combat)) {
      refus.push({ chemin: 'combat', motif: MOTS.ficheRefusTypeInvalide })
    } else {
      verifierNombreOuNul(combat.bbaBase, 'combat.bbaBase', refus)
      verifierNombreOuNul(combat.pvMax, 'combat.pvMax', refus)
      verifierNombreOuNul(combat.vitesseBase, 'combat.vitesseBase', refus)
      verifierNombreOuNul(combat.resistanceMagie, 'combat.resistanceMagie', refus)
    }
  }

  if ('defense' in entree) {
    const defense = entree.defense
    if (!estObjet(defense)) {
      refus.push({ chemin: 'defense', motif: MOTS.ficheRefusTypeInvalide })
    } else {
      validerModificateurs(defense.modificateursCA, 'defense.modificateursCA', refus)
    }
  }

  if ('sauvegardes' in entree) {
    verifierSauvegardes(entree.sauvegardes, 'sauvegardes', refus)
  }

  if ('attaques' in entree) {
    if (!Array.isArray(entree.attaques)) {
      refus.push({ chemin: 'attaques', motif: MOTS.ficheRefusTypeInvalide })
    } else {
      entree.attaques.forEach((attaque, index) => {
        if (!estObjet(attaque)) {
          refus.push({ chemin: `attaques[${index}]`, motif: MOTS.ficheRefusTypeInvalide })
          return
        }
        validerModificateurs(attaque.modificateursAttaque, `attaques[${index}].modificateursAttaque`, refus)
        validerModificateurs(attaque.modificateursDegats, `attaques[${index}].modificateursDegats`, refus)
      })
    }
  }

  if ('competences' in entree) {
    if (!Array.isArray(entree.competences)) {
      refus.push({ chemin: 'competences', motif: MOTS.ficheRefusTypeInvalide })
    } else {
      entree.competences.forEach((competence, index) => {
        if (!estObjet(competence)) {
          refus.push({ chemin: `competences[${index}]`, motif: MOTS.ficheRefusTypeInvalide })
          return
        }
        validerModificateurs(competence.modificateurs, `competences[${index}].modificateurs`, refus)
      })
    }
  }

  if ('dons' in entree && !Array.isArray(entree.dons)) {
    refus.push({ chemin: 'dons', motif: MOTS.ficheRefusTypeInvalide })
  }

  if ('aptitudes' in entree && !Array.isArray(entree.aptitudes)) {
    refus.push({ chemin: 'aptitudes', motif: MOTS.ficheRefusTypeInvalide })
  }

  if ('sorts' in entree) {
    const sorts = entree.sorts
    if (!estObjet(sorts)) {
      refus.push({ chemin: 'sorts', motif: MOTS.ficheRefusTypeInvalide })
    } else {
      const modesValides = ['prepare', 'spontane', 'usageLimite']
      if (sorts.mode !== null && !modesValides.includes(sorts.mode as string)) {
        refus.push({ chemin: 'sorts.mode', motif: MOTS.ficheRefusTypeInvalide })
      }
    }
  }

  if ('equipement' in entree && !Array.isArray(entree.equipement)) {
    refus.push({ chemin: 'equipement', motif: MOTS.ficheRefusTypeInvalide })
  }

  if ('notes' in entree) {
    verifierChaine(entree.notes, 'notes', refus)
  }

  chercherChampsInterdits(entree, '', refus)

  if (refus.length > 0) {
    return { ok: false, refus }
  }

  return { ok: true, fiche: entree as unknown as Fiche }
}
