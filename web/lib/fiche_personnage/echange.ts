/**
 * Export and import of a single sheet as a JSON file.
 *
 * Both halves are pure: `exporter` returns a name and a string rather than
 * triggering a download, and `importer` takes the already-read text plus the
 * store it should write through, rather than a `File`. Keeping the DOM out
 * of this module is what makes it testable without touching a browser (cf.
 * Skill `pf-fiche-personnage` § 7).
 */

import { cle, cleSecours, ecrire, lire } from '@/lib/fiche_personnage/magasin'
import { migrer } from '@/lib/fiche_personnage/migrer'
import { plier } from '@/lib/recherche/pliage'
import { MOTS } from '@/lib/design/tokens'
import type { Fiche } from '@/lib/fiche_personnage/schema'
import type { Resultat } from '@/lib/fiche_personnage/magasin'

/**
 * Fold `texte` into filename-safe runs: the same fold as everywhere else in
 * this repository (`plier`, ligatures pre-mapped, NFKD, diacritics dropped,
 * lowercase), with what is left of a space turned into a single dash and
 * edge dashes trimmed — step 5-6 of the slug algorithm, CLAUDE.md § 4.
 */
function versSegmentFichier(texte: string): string {
  return plier(texte)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * The exported file name, `<nom>-<classe>-<niveau>.json`.
 *
 * An empty name never produces a file named only `.json`: it falls back to
 * a readable word from `MOTS`, same treatment as an absent class or an
 * absent level sum.
 */
export function nomFichier(fiche: Fiche): string {
  const nomSegment = versSegmentFichier(fiche.meta.nomPersonnage)
  const nom = nomSegment === '' ? MOTS.ficheExportNomReplique : nomSegment

  const premiereClasse = fiche.identite.classes[0]?.nom ?? ''
  const classeSegment = versSegmentFichier(premiereClasse)
  const classe = classeSegment === '' ? MOTS.ficheExportClasseAbsente : classeSegment

  const niveaux = fiche.identite.classes
    .map((classeFiche) => classeFiche.niveau)
    .filter((niveau): niveau is number => niveau !== null)
  const niveau =
    niveaux.length === 0
      ? MOTS.ficheExportNiveauAbsent
      : String(niveaux.reduce((total, valeur) => total + valeur, 0))

  return `${nom}-${classe}-${niveau}.json`
}

export interface Export {
  readonly nom: string
  readonly contenu: string
}

/** Pure: produces bytes and a name, never a download. Indented and newline
 * terminated, like every other JSON file in this repository. */
export function exporter(fiche: Fiche): Export {
  return { nom: nomFichier(fiche), contenu: `${JSON.stringify(fiche, null, 2)}\n` }
}

export type ResultatImport =
  | {
      readonly ok: true
      readonly fiche: Fiche
      /** True when a sheet of the same id already existed and was rescued
       * before being overwritten — an overwrite is never silent. */
      readonly ecrase: boolean
    }
  | { readonly ok: false; readonly motifs: readonly string[] }

/**
 * Import a JSON text into `stockage`, through the store's own `ecrire` so
 * validation never happens twice in two different ways.
 *
 * `nouvelId`, when given, imports under a fresh id instead of the id in the
 * file — the caller decides, this module never chooses to overwrite on its
 * own initiative.
 */
export function importer(stockage: Storage, texte: string, nouvelId?: string): ResultatImport {
  let analyse: unknown
  try {
    analyse = JSON.parse(texte)
  } catch (erreur) {
    const position = erreur instanceof Error ? erreur.message : MOTS.ficheJsonIllisible
    return { ok: false, motifs: [position] }
  }

  const migre = migrer(analyse)
  if (!migre.ok) {
    return { ok: false, motifs: [migre.motif] }
  }

  const fiche: Fiche = nouvelId === undefined ? migre.fiche : { ...migre.fiche, id: nouvelId }

  const existante = lire(stockage, fiche.id)
  if (existante !== null) {
    // The overwrite path: rescue the existing bytes first, exactly like
    // `magasin.supprimer` does, so an import can be undone by
    // `restaurerSecours` the same way a delete can.
    const brutExistant = stockage.getItem(cle(fiche.id))
    if (brutExistant !== null) {
      try {
        stockage.setItem(cleSecours(fiche.id), brutExistant)
      } catch {
        return { ok: false, motifs: [MOTS.ficheEcritureRefusee] }
      }
    }
  }

  const resultat: Resultat = ecrire(stockage, fiche)
  if (!resultat.ok) {
    return { ok: false, motifs: [resultat.motif] }
  }
  return { ok: true, fiche: resultat.fiche, ecrase: existante !== null }
}
