/**
 * Chargeur des tables de règles publiées sous `web/public/data/regles/`.
 *
 * Aucune valeur de règle n'est écrite dans ce fichier : il ne fait que lire,
 * vérifier la forme et rendre des types. Une table absente ou mal formée rend
 * `null`, jamais une table de substitution — cf. Skill pf-fiche-personnage § 3
 * et `build/fiche_personnage/08_MOTEUR_BONUS.md`.
 *
 * `lecteur` est injecté : le chargement suit le modèle de
 * `web/lib/donnees/lire-index.ts` (lecture de fichier côté serveur), mais la
 * fonction qui décide de la forme reste pure et testable sans accès disque,
 * en recevant simplement le contenu brut de chaque fichier.
 */

/** Une entrée de la liste des sources d'une table de règles. */
export interface SourceRegle {
  readonly url: string
  readonly page: string
  readonly lu_le: string
}

/** L'enveloppe commune à toute table publiée sous `data/regles/`. */
export interface MetaRegle {
  readonly version: number
  readonly genere_le: string
  readonly sources: readonly SourceRegle[]
  readonly outil: string
}

interface EnveloppeRegle<T> {
  readonly meta: MetaRegle
  readonly donnees: T
}

/** Un type de bonus, tel que lu dans `types_bonus.json`. */
export interface TypeBonus {
  readonly cle: string
  readonly libelle: string
  readonly cumulable: boolean | null
  readonly note: string
}

/** Le contenu de `modificateurs_caracteristiques.json`, deux formes selon ce
 * que la page source donnait — jamais les deux à la fois. */
export type ModificateursCaracteristiques =
  | { readonly bornes: readonly { readonly min: number; readonly max: number; readonly modificateur: number }[] }
  | { readonly valeurs: Readonly<Record<string, number>> }

/** Les cinq tables de règles que le moteur peut consulter. `sortsBonus`,
 * `armures` et `progressionClasses` ne sont pas interprétées à cette étape
 * (§08) : elles sont portées telles quelles pour les étapes 09, 10 et 11, sous
 * une forme non typée puisque cette étape n'en connaît pas la structure
 * d'usage. */
export interface TablesRegles {
  readonly typesBonus: readonly TypeBonus[] | null
  readonly modificateursCarac: ModificateursCaracteristiques | null
  readonly sortsBonus: unknown | null
  readonly armures: unknown | null
  readonly progressionClasses: unknown | null
}

/** Nom de fichier de chaque table, sous `web/public/data/regles/`. */
const NOMS_FICHIERS = {
  typesBonus: 'types_bonus.json',
  modificateursCarac: 'modificateurs_caracteristiques.json',
  sortsBonus: 'sorts_bonus.json',
  armures: 'armures.json',
  progressionClasses: 'progression_classes.json',
} as const

/** Lit une table par son nom de fichier. Rend `null` quand le fichier est
 * introuvable ou illisible ; ne lance jamais. Injecté pour que le chargeur
 * reste testable sans accès disque ni réseau. */
export type LecteurTable = (nomFichier: string) => string | null

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null
}

function lireEnveloppe(lecteur: LecteurTable, nomFichier: string): EnveloppeRegle<unknown> | null {
  const brut = lecteur(nomFichier)
  if (brut === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(brut)
  } catch {
    return null
  }
  if (!estObjet(parsed) || !('meta' in parsed) || !('donnees' in parsed)) return null
  return parsed as unknown as EnveloppeRegle<unknown>
}

function extraireTypesBonus(enveloppe: EnveloppeRegle<unknown> | null): readonly TypeBonus[] | null {
  if (enveloppe === null) return null
  const donnees = enveloppe.donnees
  if (!estObjet(donnees) || !Array.isArray(donnees.types)) return null
  const types: TypeBonus[] = []
  for (const entree of donnees.types) {
    if (
      !estObjet(entree) ||
      typeof entree.cle !== 'string' ||
      typeof entree.libelle !== 'string' ||
      (typeof entree.cumulable !== 'boolean' && entree.cumulable !== null) ||
      typeof entree.note !== 'string'
    ) {
      return null
    }
    types.push({
      cle: entree.cle,
      libelle: entree.libelle,
      cumulable: entree.cumulable,
      note: entree.note,
    })
  }
  return types
}

function extraireModificateursCarac(
  enveloppe: EnveloppeRegle<unknown> | null,
): ModificateursCaracteristiques | null {
  if (enveloppe === null) return null
  const donnees = enveloppe.donnees
  if (!estObjet(donnees)) return null
  if (Array.isArray(donnees.bornes)) {
    const bornes: { min: number; max: number; modificateur: number }[] = []
    for (const b of donnees.bornes) {
      if (
        !estObjet(b) ||
        typeof b.min !== 'number' ||
        typeof b.max !== 'number' ||
        typeof b.modificateur !== 'number'
      ) {
        return null
      }
      bornes.push({ min: b.min, max: b.max, modificateur: b.modificateur })
    }
    return { bornes }
  }
  if (estObjet(donnees.valeurs)) {
    const valeurs: Record<string, number> = {}
    for (const [cle, v] of Object.entries(donnees.valeurs)) {
      if (typeof v !== 'number') return null
      valeurs[cle] = v
    }
    return { valeurs }
  }
  return null
}

/** Charge les cinq tables de règles depuis leurs fichiers publiés. Une table
 * absente ou mal formée n'interrompt pas les autres : elle est journalisée et
 * rendue `null`, jamais remplacée par une valeur par défaut. */
export async function chargerRegles(lecteur: LecteurTable): Promise<TablesRegles> {
  const typesBonusEnveloppe = lireEnveloppe(lecteur, NOMS_FICHIERS.typesBonus)
  const modificateursCaracEnveloppe = lireEnveloppe(lecteur, NOMS_FICHIERS.modificateursCarac)
  const sortsBonusEnveloppe = lireEnveloppe(lecteur, NOMS_FICHIERS.sortsBonus)
  const armuresEnveloppe = lireEnveloppe(lecteur, NOMS_FICHIERS.armures)
  const progressionClassesEnveloppe = lireEnveloppe(lecteur, NOMS_FICHIERS.progressionClasses)

  return {
    typesBonus: extraireTypesBonus(typesBonusEnveloppe),
    modificateursCarac: extraireModificateursCarac(modificateursCaracEnveloppe),
    sortsBonus: sortsBonusEnveloppe?.donnees ?? null,
    armures: armuresEnveloppe?.donnees ?? null,
    progressionClasses: progressionClassesEnveloppe?.donnees ?? null,
  }
}
