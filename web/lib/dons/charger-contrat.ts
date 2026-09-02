/**
 * Fetches the step-06 engine data contract (`/data/moteur_dons.json`, a copy
 * of `web/fixtures/moteur_dons.json` served statically) and builds the
 * `TablesMoteur`/`CatalogueDons` pair `evaluerDon` needs — once per page
 * load, not once per row: `/dons` renders up to 200 rows, and refetching or
 * rebuilding either structure per row would be quadratic for nothing, since
 * neither depends on the row.
 */

import { construireCatalogue, construireTables, type ContratMoteurDons } from './verdicts.js'
import type { CatalogueDons } from './moteur.js'
import type { TablesMoteur } from './types.js'

export interface ContratCharge {
  readonly tables: TablesMoteur
  readonly catalogue: CatalogueDons
}

let enCours: Promise<ContratCharge> | null = null

export function chargerContratMoteurDons(): Promise<ContratCharge> {
  if (enCours !== null) return enCours
  enCours = fetch('/data/moteur_dons.json')
    .then((reponse) => {
      if (!reponse.ok) throw new Error(`moteur_dons.json : ${reponse.status}`)
      return reponse.json() as Promise<ContratMoteurDons>
    })
    .then((contrat) => ({
      tables: construireTables(contrat),
      catalogue: construireCatalogue(contrat),
    }))
    .catch((cause: unknown) => {
      enCours = null
      throw cause
    })
  return enCours
}
