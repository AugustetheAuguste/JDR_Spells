/**
 * Reading the dons web index off disk.
 *
 * Split out of `index-web-dons.ts` for the same reason `lire-index.ts` is split
 * from `index-web.ts`: a `node:fs` import anywhere in a module a client
 * component imports puts `node:fs` in the browser bundle, and the build fails.
 *
 * Wave-3 note (`11_UI_DONS_SHEET`): this route is deliberately built ahead of
 * the exporter (step 08 of the fusion plan), which has not landed on this
 * branch — `public/data/dons/index.json` does not exist yet. Rather than hard
 * -coding the fixture path (which would silently keep serving 24 dons forever,
 * even once the real export lands) or the real path (which would break the
 * build today), `chargerIndexDons` picks whichever of the two exists on disk at
 * build time. Once step 08 is merged, `public/data/dons/index.json` appears and
 * this function starts reading it with no code change — the fixture path is
 * used only in its absence, exactly the state this branch is developed in.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { IndexDons } from '@/lib/donnees/index-web-dons'

/** The real export, 1417 dons — once step 08 lands. */
export const CHEMIN_INDEX_DONS_REEL = join(process.cwd(), 'public', 'data', 'dons', 'index.json')

/** The frozen 24-don fixture (`05_WEB_INDEX_CONTRACT`), used until then and by
 * every test. */
export const CHEMIN_INDEX_DONS_FIXTURE = join(process.cwd(), 'fixtures', 'index_dons.json')

/** Picks the real export when present, else the fixture. Exported so a caller
 * that wants the fixture specifically (tests) can still pass it explicitly. */
export function cheminIndexDonsActif(): string {
  return existsSync(CHEMIN_INDEX_DONS_REEL) ? CHEMIN_INDEX_DONS_REEL : CHEMIN_INDEX_DONS_FIXTURE
}

export function chargerIndexDons(chemin: string = cheminIndexDonsActif()): IndexDons {
  return JSON.parse(readFileSync(chemin, 'utf8')) as IndexDons
}
