/**
 * Reading the web index off disk.
 *
 * Split out of `index-web.ts` because that module is imported by client
 * components for its types, and a `node:fs` import anywhere in that graph puts
 * `node:fs` in the browser bundle — the build fails with "the chunking context
 * does not support external modules", which is the correct outcome but only
 * after the fact. Keeping the file read in its own module makes the boundary a
 * decision rather than an accident.
 *
 * Everything here is server-side and build-time: the index is a committed
 * artefact, so this is a file read, never a network call. The browser gets it by
 * fetching `/data/index.json` as the static asset it is.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { IndexWeb } from '@/lib/donnees/index-web'

/** The real export, 2070 spells. */
export const CHEMIN_INDEX_REEL = join(process.cwd(), 'public', 'data', 'index.json')

/** The frozen 24-spell fixture, used by tests. */
export const CHEMIN_INDEX_FIXTURE = join(process.cwd(), 'fixtures', 'index.json')

export function chargerIndex(chemin: string = CHEMIN_INDEX_REEL): IndexWeb {
  return JSON.parse(readFileSync(chemin, 'utf8')) as IndexWeb
}
