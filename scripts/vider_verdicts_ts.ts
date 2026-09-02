/**
 * Dumps `verdicts.jsonl` from the TS eligibility engine (`web/lib/dons/`),
 * against the full data contract (`data/schemas/moteur_dons.schema.json`)
 * and the step-02 character matrix (`data/dons/matrice_personnages.json`).
 *
 * This is the TS-side twin of a future Python producer (step 08); the two
 * are compared at step 14, never here — this script only has to produce a
 * correct, deterministic dump of its own engine.
 *
 * Output format (frozen by `scripts/comparer_verdicts.ts`): one compact JSON
 * object per line, LF, UTF-8 without BOM, no trailing newline beyond the
 * last record's, sorted by `(cle_personnage, nom_don)` in byte order. Running
 * this script twice on an unchanged contract must produce byte-identical
 * output — that determinism is what makes a step-14 diff meaningful.
 *
 * Usage: npx tsx scripts/vider_verdicts_ts.ts --profil rapide|complet [-o chemin/vers/sortie.jsonl]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { serialiserLigne, viderVerdicts } from '../web/lib/dons/verdicts.js'
import type { ContratMoteurDons, MatricePersonnages, ProfilMatrice } from '../web/lib/dons/verdicts.js'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHEMIN_CONTRAT_DEFAUT = resolve(RACINE, 'data/schemas/moteur_dons.schema.json')
const CHEMIN_MATRICE_DEFAUT = resolve(RACINE, 'data/dons/matrice_personnages.json')
const CHEMIN_SORTIE_DEFAUT = resolve(RACINE, 'data/dons/verdicts_ts.jsonl')

function estProfilValide(valeur: string): valeur is ProfilMatrice {
  return valeur === 'complet' || valeur === 'rapide'
}

function lireArgument(argv: readonly string[], drapeau: string): string | undefined {
  const rang = argv.indexOf(drapeau)
  return rang >= 0 ? argv[rang + 1] : undefined
}

function lireJson<T>(chemin: string): T {
  return JSON.parse(readFileSync(chemin, 'utf8')) as T
}

export function main(argv: readonly string[]): number {
  const profilBrut = lireArgument(argv, '--profil') ?? 'rapide'
  if (!estProfilValide(profilBrut)) {
    console.error(`profil inconnu : ${JSON.stringify(profilBrut)} (attendu 'complet' ou 'rapide')`)
    return 1
  }
  const profil: ProfilMatrice = profilBrut
  const cheminContrat = lireArgument(argv, '--contrat') ?? CHEMIN_CONTRAT_DEFAUT
  const cheminMatrice = lireArgument(argv, '--matrice') ?? CHEMIN_MATRICE_DEFAUT
  const cheminSortie = lireArgument(argv, '-o') ?? lireArgument(argv, '--sortie') ?? CHEMIN_SORTIE_DEFAUT

  const contrat = lireJson<ContratMoteurDons>(cheminContrat)
  const matrice = lireJson<MatricePersonnages>(cheminMatrice)

  const lignes = viderVerdicts(contrat, matrice, profil)
  const contenu = lignes.map(serialiserLigne).join('\n') + '\n'
  writeFileSync(cheminSortie, contenu, { encoding: 'utf8' })

  console.log(`OK — ${cheminSortie} écrit (${lignes.length} verdict(s), profil « ${profil} »).`)
  return 0
}

process.exit(main(process.argv.slice(2)))
