/**
 * Builds `verdicts.jsonl` records (the frozen contract of
 * `scripts/comparer_verdicts.ts`, produced by 02_TOOLS) from the step-06 data
 * contract (`data/schemas/moteur_dons.schema.json` / its restricted
 * `web/fixtures/moteur_dons.json` fixture) and the step-02 character matrix
 * (`data/dons/matrice_personnages.json`).
 *
 * Pure and disk-free on purpose — same split as `moteur.ts`/`graphe.ts` vs
 * `web/lib/donnees/index-web.ts` vs `lire-index.ts`. Only
 * `scripts/vider_verdicts_ts.ts` touches `node:fs`.
 *
 * This module does NOT compare against the Python producer — that is step
 * 14's job. Comparing here would tempt fixing the TS engine until it merely
 * matches the Python one's current output, rather than being correct on its
 * own terms.
 */

import { evaluerDon, nettoyerNomDon, normaliser } from './moteur.js'
import type { CatalogueDons } from './moteur.js'
import type {
  DonConditions,
  InfoAffiniteCreature,
  InfoLanceur,
  InfoMagieDon,
  InfoMaitrise,
  InfoRace,
  InfoRestrictionClasse,
  LigneVerdict,
  Personnage,
  Progression,
  TablesMoteur,
} from './types.js'

// ---------------------------------------------------------------------------
// Raw contract shape — the on-disk JSON, parsed but not yet validated. Every
// field this module reads matches `TablesMoteur`'s shape one-for-one (the
// step-06 contract was written to need no reshaping), except `conditions`,
// which is keyed by SLUG rather than by exact catalog name.
// ---------------------------------------------------------------------------

export interface ContratMoteurDons {
  readonly conditions: Readonly<Record<string, DonConditions>>
  readonly lanceurs: Readonly<Record<string, InfoLanceur>>
  readonly maitrises: Readonly<Record<string, InfoMaitrise>>
  readonly magie_des_dons: Readonly<Record<string, InfoMagieDon>>
  readonly affinite_creature: Readonly<Record<string, InfoAffiniteCreature>>
  readonly restriction_de_classe: Readonly<Record<string, InfoRestrictionClasse>>
  readonly races: Readonly<Record<string, InfoRace>>
  readonly armes_raciales: Readonly<Record<string, readonly string[]>>
  readonly reclassement_racial: Readonly<Record<string, string>>
  readonly progression_bba: Readonly<Record<string, Progression>>
}

/** One entry of `data/dons/matrice_personnages.json` — a baseline character
 * with no feats yet assigned (`dons_acquis` always present, always `[]` for
 * this matrix; that emptiness is semantically "no known feats", distinct
 * from `undefined`, see `Personnage.dons_connus`'s doc). */
export interface EntreeMatricePersonnage {
  readonly classe: string
  readonly niveau: number
  readonly race: string
  readonly caracteristiques: Readonly<Record<string, number>>
  readonly dons_acquis: readonly string[]
  readonly alignement: string | null
  readonly divinite: string | null
}

export interface MatricePersonnages {
  readonly complet: readonly EntreeMatricePersonnage[]
  readonly rapide: readonly EntreeMatricePersonnage[]
}

export type ProfilMatrice = keyof MatricePersonnages

// ---------------------------------------------------------------------------
// Slug <-> nom exact — `build_moteur_dons_contract.py::slugify`, ported
// literally so the join between `conditions` (keyed by slug) and
// `magie_des_dons`/`affinite_creature`/`restriction_de_classe` (keyed by the
// exact catalog name, asterisk kept) does not silently drop a feat.
// ---------------------------------------------------------------------------

export function trancherEnSlug(nom: string): string {
  const base = normaliser(nom).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base === '' ? 'don' : base
}

/** Ability-score abbreviations (`Dex`, `Int`, …) used by `charge.ability` in
 * the parsed conditions, keyed from the full French names
 * `matrice_personnages.json` uses. Purely a loader-side adaptation — never
 * baked into `moteur.ts`, which only ever sees the abbreviations. */
const ABREVIATION_PAR_CARACTERISTIQUE: Readonly<Record<string, string>> = {
  force: 'For',
  dexterite: 'Dex',
  constitution: 'Con',
  intelligence: 'Int',
  sagesse: 'Sag',
  charisme: 'Cha',
}

// ---------------------------------------------------------------------------
// Building TablesMoteur / CatalogueDons / Personnage from the raw contract
// ---------------------------------------------------------------------------

export function construireTables(contrat: ContratMoteurDons): TablesMoteur {
  return {
    lanceurs: contrat.lanceurs,
    maitrises: contrat.maitrises,
    magie_des_dons: contrat.magie_des_dons,
    affinite_creature: contrat.affinite_creature,
    restriction_de_classe: contrat.restriction_de_classe,
    races: contrat.races,
    armes_raciales: contrat.armes_raciales,
    reclassement_racial: contrat.reclassement_racial,
    progression_bba: contrat.progression_bba,
  }
}

/** Re-indexes `contrat.conditions` (slug -> conditions) by exact catalog
 * name (name -> conditions), the shape `moteur.ts`'s `evaluerDon` expects —
 * it needs the exact name to look up `magie_des_dons`/`affinite_creature`/
 * `restriction_de_classe`, which are indexed by name, not by slug. */
export function construireCatalogue(contrat: ContratMoteurDons): CatalogueDons {
  const nomParSlug = new Map<string, string>()
  for (const nom of Object.keys(contrat.magie_des_dons)) {
    nomParSlug.set(trancherEnSlug(nom), nom)
  }
  const catalogue = new Map<string, DonConditions>()
  for (const [slug, conditions] of Object.entries(contrat.conditions)) {
    const nom = nomParSlug.get(slug)
    if (nom !== undefined) catalogue.set(nom, conditions)
  }
  return catalogue
}

/** `<classe>|<niveau>|<race>` — the step-02 `verdicts.jsonl` key, classe in
 * the matrix's own slug form. */
export function clePersonnage(entree: EntreeMatricePersonnage): string {
  return `${entree.classe}|${entree.niveau}|${entree.race}`
}

export function construirePersonnage(entree: EntreeMatricePersonnage): Personnage {
  const caracteristiques: Record<string, number> = {}
  for (const [nomComplet, score] of Object.entries(entree.caracteristiques)) {
    const abbr = ABREVIATION_PAR_CARACTERISTIQUE[nomComplet]
    if (abbr !== undefined) caracteristiques[abbr] = score
  }
  return {
    classe: entree.classe,
    niveau: entree.niveau,
    race: entree.race,
    caracteristiques,
    // Always explicit (never `undefined`): the matrix's `dons_acquis` is
    // semantically "known feats", empty or not — see `Personnage.dons_connus`.
    dons_connus: new Set(entree.dons_acquis.map((nom) => normaliser(nettoyerNomDon(nom)))),
    // `exactOptionalPropertyTypes` forbids writing an explicit `undefined`
    // into an optional field whose declared type excludes it — so a `null`
    // from the matrix is dropped via spread rather than coerced in place.
    ...(entree.alignement !== null ? { alignement: entree.alignement } : {}),
    ...(entree.divinite !== null ? { divinite: entree.divinite } : {}),
  }
}

// ---------------------------------------------------------------------------
// The verdicts.jsonl dump proper
// ---------------------------------------------------------------------------

/** Byte-order comparator on the composite key `(cle_personnage, nom_don)` —
 * the sort the step-02 contract mandates so two dumps compare line-by-line
 * without prior indexing. */
function comparerOctets(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Evaluates every feat of the catalog against every character of the given
 * matrix profile, and returns the resulting `verdicts.jsonl` records sorted
 * by `(cle_personnage, nom_don)` in byte order — deterministic and
 * re-runnable byte-for-byte. */
export function viderVerdicts(
  contrat: ContratMoteurDons,
  matrice: MatricePersonnages,
  profil: ProfilMatrice,
): readonly LigneVerdict[] {
  const tables = construireTables(contrat)
  const catalogue = construireCatalogue(contrat)
  const lignes: LigneVerdict[] = []

  for (const entree of matrice[profil]) {
    const perso = construirePersonnage(entree)
    const cle = clePersonnage(entree)
    for (const [nomDon, conditions] of catalogue) {
      const resultat = evaluerDon(nomDon, conditions, perso, tables)
      lignes.push({
        cle_personnage: cle,
        nom_don: nomDon,
        statut: resultat.statut,
        motifs: [...resultat.motifs].sort(comparerOctets),
      })
    }
  }

  lignes.sort((a, b) => comparerOctets(`${a.cle_personnage} ${a.nom_don}`, `${b.cle_personnage} ${b.nom_don}`))
  return lignes
}

/** Serializes one `LigneVerdict` in the step-02 contract's exact format:
 * compact JSON, no omitted key, real UTF-8 (never `\uXXXX` escapes for
 * accented French text — `JSON.stringify` already does this by default). */
export function serialiserLigne(ligne: LigneVerdict): string {
  return JSON.stringify({
    cle_personnage: ligne.cle_personnage,
    nom_don: ligne.nom_don,
    statut: ligne.statut,
    motifs: ligne.motifs,
  })
}
