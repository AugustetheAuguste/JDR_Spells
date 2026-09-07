/**
 * Emplacements de sorts, degré de difficulté et niveau de lanceur —
 * cf. `build/fiche_personnage/11_MOTEUR_SORTS.md`.
 *
 * Fonctions pures : les tables de règles arrivent en argument, jamais lues
 * depuis le réseau ni depuis le stockage. **Aucun suivi de consommation** :
 * ce fichier calcule le nombre maximal d'emplacements disponibles, sans
 * suivre la moindre case cochée (cf. Skill pf-fiche-personnage § 1).
 */

import { MOTS } from '@/lib/design/tokens'
import { normaliser } from '@/lib/dons/moteur'
import type { Fiche, ClasseFiche, Modificateur } from '@/lib/fiche_personnage/schema'
import type { TablesRegles } from '@/lib/fiche_personnage/regles'
import { resoudre, type ResultatCalcul, type Contribution } from '@/lib/fiche_personnage/resoudre'
import { modificateurCaracteristique, valeurEffectiveCaracteristique } from '@/lib/fiche_personnage/caracteristiques'

/** Les dix niveaux de sort possibles, 0 (oraisons) compris — jamais écarté
 * par un test de vérité sur la clé (§ Notes d'implémentation du plan). */
const NIVEAUX_DE_SORT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null
}

/** Slug de classe tel qu'utilisé comme clé dans `progression_classes.json`
 * (`chasseur_de_vampire`, `pretre_combattant`) : la normalisation NFKD +
 * minuscule de `normaliser` (réutilisée depuis `web/lib/dons/moteur.ts`,
 * cf. plan § Notes d'implémentation), plus le remplacement des espaces par
 * des soulignés — le seul pas que `normaliser` ne fait pas lui-même. */
function slugifierClasse(nom: string): string {
  return normaliser(nom).replace(/\s+/g, '_')
}

function lireEntreeProgression(
  progressionClasses: unknown,
  slug: string,
): Record<string, unknown> | undefined {
  if (!estObjet(progressionClasses)) return undefined
  const entree = progressionClasses[slug]
  return estObjet(entree) ? entree : undefined
}

function lireTableEmplacements(entree: Record<string, unknown>): Record<string, unknown> | null {
  const emplacements = entree.emplacements
  return estObjet(emplacements) ? emplacements : null
}

/** Une cellule absente ou non numérique vaut `null`, jamais `0` — la
 * cellule vide de la page source signifie « pas encore accessible à ce
 * niveau », pas « zéro emplacement mesuré ». */
function lireCelluleNiveau(ligne: unknown, niveauDeSort: number): number | null {
  if (!estObjet(ligne)) return null
  const valeur = ligne[String(niveauDeSort)]
  return typeof valeur === 'number' ? valeur : null
}

function fusionnerCellule(existante: number | null, valeur: number | null): number | null {
  if (existante === null && valeur === null) return null
  return (existante ?? 0) + (valeur ?? 0)
}

// ---------------------------------------------------------------------------
// Emplacements de base
// ---------------------------------------------------------------------------

/** L'état d'une classe de la fiche face à la table de progression : trois
 * états distincts, jamais confondus (§ Notes d'implémentation, critère 7) —
 * `introuvable` est une lacune de données, `non_lanceuse` est un fait
 * légitime sur la classe. */
export interface EtatClasseSorts {
  readonly classe: string
  readonly slug: string
  readonly etat: 'lanceuse' | 'non_lanceuse' | 'introuvable'
}

export interface EmplacementsBase {
  readonly parClasse: readonly EtatClasseSorts[]
  readonly parNiveauDeSort: ReadonlyMap<number, number | null>
  readonly manquants: readonly string[]
}

function classerClasses(
  classes: readonly ClasseFiche[],
  progressionClasses: unknown,
): { parClasse: EtatClasseSorts[]; manquants: string[] } {
  const parClasse: EtatClasseSorts[] = []
  const manquants: string[] = []

  if (progressionClasses === null) {
    for (const classe of classes) {
      const slug = slugifierClasse(classe.nom)
      parClasse.push({ classe: classe.nom, slug, etat: 'introuvable' })
      manquants.push(MOTS.ficheMoteurProgressionClassesIntrouvable)
    }
    return { parClasse, manquants }
  }

  for (const classe of classes) {
    const slug = slugifierClasse(classe.nom)
    const entree = lireEntreeProgression(progressionClasses, slug)

    if (entree === undefined) {
      parClasse.push({ classe: classe.nom, slug, etat: 'introuvable' })
      manquants.push(slug)
      continue
    }

    const table = lireTableEmplacements(entree)
    if (table === null || entree.genre_table_sorts !== 'sorts_par_jour') {
      parClasse.push({ classe: classe.nom, slug, etat: 'non_lanceuse' })
      continue
    }

    if (classe.niveau === null) {
      parClasse.push({ classe: classe.nom, slug, etat: 'introuvable' })
      manquants.push(`${slug} : ${MOTS.ficheMoteurNiveauClasseAbsent}`)
      continue
    }

    parClasse.push({ classe: classe.nom, slug, etat: 'lanceuse' })
  }

  return { parClasse, manquants }
}

/** Les emplacements de sorts maximaux, base seule (avant les emplacements
 * bonus de caractéristique). Additionne les classes lanceuses de la fiche
 * niveau de sort par niveau de sort ; une classe non lanceuse ou introuvable
 * ne contribue aucun nombre (cf. `classerClasses`). */
export function emplacementsDeBase(fiche: Fiche, tables: TablesRegles): EmplacementsBase {
  const { parClasse, manquants } = classerClasses(fiche.identite.classes, tables.progressionClasses)
  const parNiveauDeSort = new Map<number, number | null>()

  for (const etat of parClasse) {
    if (etat.etat !== 'lanceuse') continue
    const classe = fiche.identite.classes.find((c) => slugifierClasse(c.nom) === etat.slug)
    if (classe === undefined || classe.niveau === null) continue
    const entree = lireEntreeProgression(tables.progressionClasses, etat.slug)
    if (entree === undefined) continue
    const table = lireTableEmplacements(entree)
    if (table === null) continue
    const ligne = table[String(classe.niveau)]

    for (const niveauDeSort of NIVEAUX_DE_SORT) {
      const valeur = lireCelluleNiveau(ligne, niveauDeSort)
      const existante = parNiveauDeSort.get(niveauDeSort) ?? null
      parNiveauDeSort.set(niveauDeSort, fusionnerCellule(existante, valeur))
    }
  }

  return { parClasse, parNiveauDeSort, manquants: [...new Set(manquants)] }
}

// ---------------------------------------------------------------------------
// Le modificateur de la caractéristique d'incantation, partagé par les
// emplacements bonus et le degré de difficulté.
// ---------------------------------------------------------------------------

function lireModificateurIncantation(fiche: Fiche, tables: TablesRegles): ResultatCalcul {
  const carac = fiche.sorts.caracteristiqueIncantation
  if (carac === null) {
    return { total: null, detail: [], manquants: [MOTS.ficheMoteurCaracteristiqueIncantationAbsente] }
  }
  const entree = fiche.caracteristiques[carac]
  const valeurEffective = valeurEffectiveCaracteristique(entree, tables.typesBonus)
  if (valeurEffective.total === null) return valeurEffective
  return modificateurCaracteristique(valeurEffective.total, tables.modificateursCarac)
}

// ---------------------------------------------------------------------------
// Emplacements bonus
// ---------------------------------------------------------------------------

export interface EmplacementsBonus {
  readonly parNiveauDeSort: ReadonlyMap<number, number | null>
  readonly manquants: readonly string[]
}

/** Les emplacements bonus de caractéristique élevée, lus dans
 * `sorts_bonus.json` (table « Modificateurs de caractéristique et sorts en
 * bonus », page Caractéristiques). Un modificateur au-delà du maximum
 * réellement lu sur la page rend `introuvable`, jamais extrapolé. */
export function emplacementsBonus(fiche: Fiche, tables: TablesRegles): EmplacementsBonus {
  const modificateur = lireModificateurIncantation(fiche, tables)
  if (modificateur.total === null) {
    return { parNiveauDeSort: new Map(), manquants: modificateur.manquants }
  }

  if (!estObjet(tables.sortsBonus)) {
    return { parNiveauDeSort: new Map(), manquants: [MOTS.ficheMoteurSortsBonusIntrouvable] }
  }
  const parModificateur = tables.sortsBonus.par_modificateur
  if (!estObjet(parModificateur)) {
    return { parNiveauDeSort: new Map(), manquants: [MOTS.ficheMoteurSortsBonusIntrouvable] }
  }

  const ligne = parModificateur[String(modificateur.total)]
  if (ligne === undefined) {
    return { parNiveauDeSort: new Map(), manquants: [MOTS.ficheMoteurModificateurHorsTable] }
  }

  const parNiveauDeSort = new Map<number, number | null>()
  for (const niveauDeSort of NIVEAUX_DE_SORT) {
    parNiveauDeSort.set(niveauDeSort, lireCelluleNiveau(ligne, niveauDeSort))
  }
  return { parNiveauDeSort, manquants: [] }
}

// ---------------------------------------------------------------------------
// Emplacements totaux
// ---------------------------------------------------------------------------

/** Base plus bonus, chaque terme une contribution nommée. Règle lue sur
 * https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Caract%C3%A9ristiques.ashx
 * (section « Déterminer les modificateurs → Sorts en bonus... ») : « Vous ne
 * gagnez des sorts en bonus que si votre niveau de classe vous donne accès
 * aux niveaux de sorts considérés. » — un emplacement bonus ne s'ajoute
 * jamais à un niveau de sort où la base est absente. Une base introuvable
 * (classe manquante de la table) rend le total introuvable pour tous les
 * niveaux de sort, pas seulement celui affecté. */
export function emplacementsTotaux(fiche: Fiche, tables: TablesRegles): ReadonlyMap<number, ResultatCalcul> {
  const base = emplacementsDeBase(fiche, tables)
  const bonus = emplacementsBonus(fiche, tables)
  const resultat = new Map<number, ResultatCalcul>()

  for (const niveauDeSort of NIVEAUX_DE_SORT) {
    if (base.manquants.length > 0) {
      resultat.set(niveauDeSort, { total: null, detail: [], manquants: base.manquants })
      continue
    }

    const valeurBase = base.parNiveauDeSort.get(niveauDeSort) ?? null

    if (valeurBase === null) {
      resultat.set(niveauDeSort, { total: null, detail: [], manquants: [] })
      continue
    }

    const detail: Contribution[] = [
      {
        libelle: MOTS.ficheMoteurEmplacementsBase,
        valeur: valeurBase,
        type: 'emplacements_sorts',
        retenue: true,
        motifEcart: null,
      },
    ]
    let total = valeurBase
    const manquants: string[] = []

    if (bonus.manquants.length > 0) {
      manquants.push(...bonus.manquants)
      detail.push({
        libelle: MOTS.ficheMoteurEmplacementsBonus,
        valeur: 0,
        type: 'emplacements_sorts_bonus',
        retenue: false,
        motifEcart: bonus.manquants.join(', '),
      })
    } else {
      const valeurBonus = bonus.parNiveauDeSort.get(niveauDeSort) ?? null
      if (valeurBonus !== null) {
        detail.push({
          libelle: MOTS.ficheMoteurEmplacementsBonus,
          valeur: valeurBonus,
          type: 'emplacements_sorts_bonus',
          retenue: true,
          motifEcart: null,
        })
        total = valeurBase + valeurBonus
      }
    }

    resultat.set(niveauDeSort, { total, detail, manquants: [...new Set(manquants)] })
  }

  return resultat
}

// ---------------------------------------------------------------------------
// Degré de difficulté
// ---------------------------------------------------------------------------

/** Le degré de difficulté d'un jet de sauvegarde contre un sort de ce
 * niveau. Formule lue sur
 * https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Lancer%20des%20sorts.ashx
 * (canonique de la page « Niveau de lanceur de sorts ») : « 10 + niveau du
 * sort + valeur de caractéristique du lanceur de sorts » — la « valeur de
 * caractéristique » citée est le modificateur, jamais le score brut.
 * `modificateursDD` est prêt à recevoir d'éventuels modificateurs de DD
 * propres à la fiche ; le schéma actuel (étape 07) n'en porte aucun, d'où le
 * défaut à liste vide — lacune assumée, pas une omission. */
export function degreDeDifficulte(
  fiche: Fiche,
  niveauDeSort: number,
  tables: TablesRegles,
  modificateursDD: readonly Modificateur[] = [],
): ResultatCalcul {
  const modificateur = lireModificateurIncantation(fiche, tables)
  if (modificateur.total === null) {
    return { total: null, detail: [], manquants: modificateur.manquants }
  }

  const detail: Contribution[] = [
    { libelle: MOTS.ficheMoteurDegreBase, valeur: 10, type: 'degre_difficulte', retenue: true, motifEcart: null },
    {
      libelle: MOTS.ficheMoteurDegreNiveauSort,
      valeur: niveauDeSort,
      type: 'degre_difficulte',
      retenue: true,
      motifEcart: null,
    },
    {
      libelle: MOTS.ficheMoteurModificateurCaracteristique,
      valeur: modificateur.total,
      type: 'degre_difficulte',
      retenue: true,
      motifEcart: null,
    },
  ]
  let total = 10 + niveauDeSort + modificateur.total
  let manquants: readonly string[] = []

  if (modificateursDD.length > 0) {
    const resultatModifs = resoudre(modificateursDD, tables.typesBonus)
    detail.push(...resultatModifs.detail)
    manquants = resultatModifs.manquants
    if (resultatModifs.total === null) {
      return { total: null, detail, manquants }
    }
    total += resultatModifs.total
  }

  return { total, detail, manquants }
}

// ---------------------------------------------------------------------------
// Niveau de lanceur
// ---------------------------------------------------------------------------

/** Le niveau de lanceur affiché, avec sa provenance. Une saisie manuelle
 * prime toujours ; à défaut, une seule classe lanceuse permet de le déduire
 * de son niveau de classe (règle lue sur
 * https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Niveau%20de%20lanceur%20de%20sorts.ashx :
 * « Elle est généralement égale à son niveau de classe dans la classe
 * utilisée pour lancer le sort. ») ; plusieurs classes lanceuses rendent
 * `introuvable`, le cumul multiclasse n'étant pas une règle présente dans ce
 * dépôt. */
export function niveauLanceur(fiche: Fiche, tables: TablesRegles): ResultatCalcul {
  if (fiche.sorts.niveauLanceur !== null) {
    return {
      total: fiche.sorts.niveauLanceur,
      detail: [
        {
          libelle: MOTS.ficheMoteurNiveauLanceurSaisi,
          valeur: fiche.sorts.niveauLanceur,
          type: 'niveau_lanceur',
          retenue: true,
          motifEcart: null,
        },
      ],
      manquants: [],
    }
  }

  const { parClasse } = classerClasses(fiche.identite.classes, tables.progressionClasses)
  const lanceuses = parClasse.filter((e) => e.etat === 'lanceuse')

  if (lanceuses.length === 0) {
    return { total: null, detail: [], manquants: [MOTS.ficheMoteurAucuneClasseLanceuse] }
  }

  if (lanceuses.length > 1) {
    return { total: null, detail: [], manquants: [MOTS.ficheMoteurNiveauLanceurMulticlasse] }
  }

  const [seule] = lanceuses
  const classe = fiche.identite.classes.find((c) => slugifierClasse(c.nom) === seule?.slug)
  if (classe === undefined || classe.niveau === null) {
    return { total: null, detail: [], manquants: [MOTS.ficheMoteurNiveauClasseAbsent] }
  }

  return {
    total: classe.niveau,
    detail: [
      {
        libelle: MOTS.ficheMoteurNiveauLanceurDeduit,
        valeur: classe.niveau,
        type: 'niveau_lanceur',
        retenue: true,
        motifEcart: MOTS.ficheMoteurNiveauLanceurDeduit,
      },
    ],
    manquants: [],
  }
}

// ---------------------------------------------------------------------------
// Sorts connus
// ---------------------------------------------------------------------------

export interface SortsConnus {
  /** `false` quand aucune classe de la fiche ne publie de table de sorts
   * connus — une absence explicite, pas une table vide. */
  readonly disponible: boolean
  readonly parNiveauDeSort: ReadonlyMap<number, number | null>
  readonly manquants: readonly string[]
}

/** Le nombre de sorts connus par niveau de sort, seulement pour les classes
 * dont `genre_table_sorts` vaut `sorts_connus` sur la page lue. */
export function sortsConnus(fiche: Fiche, tables: TablesRegles): SortsConnus {
  if (tables.progressionClasses === null) {
    return {
      disponible: false,
      parNiveauDeSort: new Map(),
      manquants: [MOTS.ficheMoteurProgressionClassesIntrouvable],
    }
  }

  const parNiveauDeSort = new Map<number, number | null>()
  const manquants: string[] = []
  let disponible = false

  for (const classe of fiche.identite.classes) {
    const slug = slugifierClasse(classe.nom)
    const entree = lireEntreeProgression(tables.progressionClasses, slug)
    if (entree === undefined) {
      manquants.push(slug)
      continue
    }
    if (entree.genre_table_sorts !== 'sorts_connus') continue // absence explicite, pas une lacune
    if (classe.niveau === null) {
      manquants.push(`${slug} : ${MOTS.ficheMoteurNiveauClasseAbsent}`)
      continue
    }
    const table = lireTableEmplacements(entree)
    if (table === null) continue

    disponible = true
    const ligne = table[String(classe.niveau)]
    for (const niveauDeSort of NIVEAUX_DE_SORT) {
      const valeur = lireCelluleNiveau(ligne, niveauDeSort)
      const existante = parNiveauDeSort.get(niveauDeSort) ?? null
      parNiveauDeSort.set(niveauDeSort, fusionnerCellule(existante, valeur))
    }
  }

  if (!disponible) {
    return { disponible: false, parNiveauDeSort: new Map(), manquants: [...new Set(manquants)] }
  }
  return { disponible: true, parNiveauDeSort, manquants: [...new Set(manquants)] }
}
