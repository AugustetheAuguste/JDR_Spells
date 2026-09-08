/**
 * Classe d'armure (totale, en contact, pris au dépourvu) et vitesse de
 * déplacement selon la catégorie d'armure — cf.
 * `build/fiche_personnage/09_MOTEUR_DEFENSE_COMBAT.md`.
 *
 * Formules sourcées sur pathfinder-fr.org :
 * - CA = 10 + bonus d'armure + bonus de bouclier + modificateur de Dextérité
 *   + modificateur de taille, et la table des modificateurs de taille
 *   (Colossal -8 … Infime +8) :
 *   https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Valeurs%20de%20combat.ashx
 *   (section « Classe d'armure (CA) », sous-section « Autres modificateurs »)
 * - CA de contact : ne compte pas les bonus d'armure, de bouclier ni
 *   d'armure naturelle ; conserve Dextérité, taille et parade — même page,
 *   section « Attaques de contact ».
 * - Pris au dépourvu : perd le bonus de Dextérité à la CA, et avec lui tout
 *   bonus d'esquive puisque celui-ci « disparait si le personnage perd son
 *   bonus de Dextérité » (même page, « Autres modificateurs ») :
 *   https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Le%20d%c3%a9roulement%20d%27un%20combat.ashx
 *   (section « L'initiative », paragraphe « Pris au dépourvu »)
 * - Vitesse par catégorie d'armure : `data/regles/armures.json`, champ
 *   `vitesse_par_base` de chaque entrée (la page source y est déjà
 *   consignée dans le `meta` du fichier).
 *
 * Fonctions pures : les tables arrivent en argument, rien n'est lu du DOM ni
 * du disque ici.
 */

import { MOTS } from '@/lib/design/tokens'
import type { Fiche } from '@/lib/fiche_personnage/schema'
import type { TablesRegles } from '@/lib/fiche_personnage/regles'
import { resoudre, type Contribution, type ResultatCalcul } from '@/lib/fiche_personnage/resoudre'
import {
  modificateurCaracteristique,
  valeurEffectiveCaracteristique,
} from '@/lib/fiche_personnage/caracteristiques'

/** CA de base, constante sourcée (§ ci-dessus), jamais recalculée. */
const CA_BASE = 10

/** Modificateurs de taille à la CA (et aux jets d'attaque, cf.
 * `attaques.ts`), lus sur « Valeurs de combat » — table « Modificateurs de
 * taille ». Clés normalisées (minuscules, sans accent) pour tolérer les
 * variantes de libellé portées par `Identite.taille`. */
export const MODIFICATEURS_TAILLE_CA: Readonly<Record<string, number>> = {
  colossal: -8,
  colossale: -8,
  gigantesque: -4,
  'tres grand': -2,
  'tres grande': -2,
  tg: -2,
  grand: -1,
  grande: -1,
  g: -1,
  moyen: 0,
  moyenne: 0,
  m: 0,
  petit: 1,
  petite: 1,
  p: 1,
  'tres petit': 2,
  'tres petite': 2,
  tp: 2,
  minuscule: 4,
  min: 4,
  infime: 8,
  i: 8,
}

/** Normalise un libellé de taille pour l'indexer dans une table de taille :
 * minuscules, sans accent, espaces simples. */
export function normaliserTaille(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function modificateurTaille(taille: string, table: Readonly<Record<string, number>>): number | null {
  const cle = normaliserTaille(taille)
  return Object.prototype.hasOwnProperty.call(table, cle) ? table[cle] ?? null : null
}

/** Les trois variantes de classe d'armure, chacune un `Resultat` complet. */
export interface ClasseArmureResultat {
  readonly totale: ResultatCalcul
  readonly contact: ResultatCalcul
  readonly prisAuDepourvu: ResultatCalcul
}

function retenue(
  detail: readonly Contribution[],
  manquants: readonly string[],
): ResultatCalcul {
  const total = manquants.length > 0 ? null : detail.reduce((s, c) => (c.retenue ? s + c.valeur : s), 0)
  return { total, detail, manquants }
}

/** Rend une variante en écartant, dans une seule liste de contributions
 * partagée, les types nommés — jamais trois additions indépendantes qui
 * pourraient diverger (cf. plan § Notes d'implémentation). */
function filtrerVariante(
  detail: readonly Contribution[],
  manquants: readonly string[],
  typesRetires: readonly string[],
  motif: string,
): ResultatCalcul {
  const detailVariante = detail.map((c) =>
    c.retenue && typesRetires.includes(c.type) ? { ...c, retenue: false, motifEcart: motif } : c,
  )
  return retenue(detailVariante, manquants)
}

/** Classe d'armure totale, en contact et pris au dépourvu. */
export function classeArmure(fiche: Fiche, tables: TablesRegles): ClasseArmureResultat {
  const contributions: Contribution[] = []
  const manquants: string[] = []

  contributions.push({
    libelle: MOTS.ficheMoteurCaBase,
    valeur: CA_BASE,
    type: 'base',
    retenue: true,
    motifEcart: null,
  })

  const { armure, bouclier } = fiche.defense

  if (armure === null) {
    contributions.push({
      libelle: MOTS.ficheMoteurAucuneArmure,
      valeur: 0,
      type: 'armure',
      retenue: true,
      motifEcart: null,
    })
  } else if (armure.bonusCA === null) {
    manquants.push('defense.armure.bonusCA')
  } else {
    contributions.push({
      libelle: armure.nom,
      valeur: armure.bonusCA,
      type: 'armure',
      retenue: true,
      motifEcart: null,
    })
  }

  if (bouclier === null) {
    contributions.push({
      libelle: MOTS.ficheMoteurAucunBouclier,
      valeur: 0,
      type: 'bouclier',
      retenue: true,
      motifEcart: null,
    })
  } else if (bouclier.bonusCA === null) {
    manquants.push('defense.bouclier.bonusCA')
  } else {
    contributions.push({
      libelle: bouclier.nom,
      valeur: bouclier.bonusCA,
      type: 'bouclier',
      retenue: true,
      motifEcart: null,
    })
  }

  const dexEffective = valeurEffectiveCaracteristique(fiche.caracteristiques.dexterite, tables.typesBonus)
  if (dexEffective.total === null) {
    manquants.push(...(dexEffective.manquants.length > 0 ? dexEffective.manquants : ['caracteristiques.dexterite']))
  } else {
    const dexModificateur = modificateurCaracteristique(dexEffective.total, tables.modificateursCarac)
    if (dexModificateur.total === null) {
      manquants.push(...dexModificateur.manquants)
    } else {
      let valeurRetenue = dexModificateur.total
      if (armure !== null && armure.bonusDexMax !== null && valeurRetenue > armure.bonusDexMax) {
        contributions.push({
          libelle: MOTS.ficheMoteurModificateurDexterite,
          valeur: dexModificateur.total,
          type: 'dexterite',
          retenue: false,
          motifEcart: `${MOTS.ficheMoteurPlafonneA} ${armure.bonusDexMax >= 0 ? '+' : ''}${armure.bonusDexMax}`,
        })
        valeurRetenue = armure.bonusDexMax
      }
      contributions.push({
        libelle: MOTS.ficheMoteurModificateurDexterite,
        valeur: valeurRetenue,
        type: 'dexterite',
        retenue: true,
        motifEcart: null,
      })
    }
  }

  const tailleValeur = modificateurTaille(fiche.identite.taille, MODIFICATEURS_TAILLE_CA)
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

  const resoluCA = resoudre(fiche.defense.modificateursCA, tables.typesBonus)
  manquants.push(...resoluCA.manquants)

  const detailComplet = [...contributions, ...resoluCA.detail]

  const totale = retenue(detailComplet, manquants)
  const contact = filtrerVariante(
    detailComplet,
    manquants,
    ['armure', 'bouclier', 'armure_naturelle'],
    MOTS.ficheMoteurRetirePourContact,
  )
  const prisAuDepourvu = filtrerVariante(
    detailComplet,
    manquants,
    ['dexterite', 'esquive'],
    MOTS.ficheMoteurRetirePourPrisAuDepourvu,
  )

  return { totale, contact, prisAuDepourvu }
}

/** Une entrée de `data/regles/armures.json`, telle que nécessaire ici. */
interface EntreeArmureRegle {
  readonly categorie: string
  readonly vitesse_par_base: Readonly<Record<string, string | null>>
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null
}

function extraireArmures(donnees: unknown): readonly EntreeArmureRegle[] | null {
  if (!estObjet(donnees) || !Array.isArray(donnees.armures)) return null
  const armures: EntreeArmureRegle[] = []
  for (const entree of donnees.armures) {
    if (!estObjet(entree) || typeof entree.categorie !== 'string' || !estObjet(entree.vitesse_par_base)) {
      continue
    }
    const vitesseParBase: Record<string, string | null> = {}
    for (const [cle, valeur] of Object.entries(entree.vitesse_par_base)) {
      if (typeof valeur === 'string' || valeur === null) vitesseParBase[cle] = valeur
    }
    armures.push({ categorie: entree.categorie, vitesse_par_base: vitesseParBase })
  }
  return armures
}

/** Formate une vitesse de base en la clé de `vitesse_par_base` (« 9 m »,
 * « 6 m », …), au format décimal français lu sur la table. */
function formaterCleVitesse(metres: number): string {
  const texte = Number.isInteger(metres) ? String(metres) : String(metres).replace('.', ',')
  return `${texte} m`
}

/** Extrait la valeur numérique en tête d'une chaîne comme « 6 m (4 c) » ou
 * « 4,5 m (3 c) », jamais une extrapolation au-delà de ce qui est écrit. */
function parserMetres(texte: string): number | null {
  const correspondance = /^([\d]+(?:,[\d]+)?)/.exec(texte.trim())
  if (!correspondance) return null
  const valeur = Number(correspondance[1].replace(',', '.'))
  return Number.isFinite(valeur) ? valeur : null
}

/** Vitesse de déplacement, selon la catégorie de l'armure portée. Sans
 * catégorie renseignée, rend la vitesse de base telle quelle (contribution
 * informative). Une base absente de la table lue reste `introuvable`. */
export function vitesse(fiche: Fiche, tables: TablesRegles): ResultatCalcul {
  const vitesseBase = fiche.combat.vitesseBase
  if (vitesseBase === null) {
    return { total: null, detail: [], manquants: ['combat.vitesseBase'] }
  }

  const categorie = fiche.defense.armure?.categorie ?? null
  if (categorie === null || categorie === '') {
    return {
      total: vitesseBase,
      detail: [
        {
          libelle: MOTS.ficheMoteurVitesseSansArmure,
          valeur: vitesseBase,
          type: 'vitesse',
          retenue: true,
          motifEcart: null,
        },
      ],
      manquants: [],
    }
  }

  const armures = extraireArmures(tables.armures)
  if (armures === null) {
    return { total: null, detail: [], manquants: ['armures'] }
  }

  const entree = armures.find((a) => a.categorie === categorie)
  if (!entree) {
    return { total: null, detail: [], manquants: [`armures.categorie:${categorie}`] }
  }

  const cle = formaterCleVitesse(vitesseBase)
  const brut = entree.vitesse_par_base[cle]
  if (brut === undefined || brut === null) {
    return { total: null, detail: [], manquants: [`armures.vitesse_par_base:${cle}`] }
  }

  const valeurResultante = parserMetres(brut)
  if (valeurResultante === null) {
    return { total: null, detail: [], manquants: [`armures.vitesse_par_base:${cle}`] }
  }

  return {
    total: valeurResultante,
    detail: [
      {
        libelle: MOTS.ficheMoteurVitesseSelonArmure,
        valeur: valeurResultante,
        type: 'vitesse',
        retenue: true,
        motifEcart: null,
      },
    ],
    manquants: [],
  }
}
