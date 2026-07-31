/**
 * The per-spell props: the shape of `public/data/sorts/<slug>.json`.
 *
 * These types were read off the real artefacts rather than off the step plan,
 * and they differ from it in one way that matters: `niveaux_par_classe` maps a
 * class slug to `{nom, niveau}` and not to a bare integer. The display name has
 * to travel with the level, because the page shows « Barde 2 » and the slug
 * `pretre-pretre-combattant-oracle` is not something to put in front of a reader.
 *
 * Reading lives here too, and like `lire-index.ts` this module must never be
 * imported by a client component: `node:fs` in a browser bundle is a build
 * error, which is the correct outcome.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface NiveauClasse {
  /** The wiki's own label, accents and slashes intact. */
  readonly nom: string
  readonly niveau: number
}

/**
 * One class where the class list and the spell page disagree about a level.
 *
 * On the corpus as committed there are none: all 8409 comparable pairs concord
 * (`reports/08_enrich.md`). This is the probe that makes the first real
 * divergence visible, and it is exercised against a synthetic case in the frozen
 * fixture — the alternative being code that ships untested until the day it
 * matters.
 */
export interface DesaccordSort {
  readonly classe: string | null
  readonly slug: string | null
  readonly niveau_liste: number | null
  readonly niveau_page: number | null
}

/**
 * The LLM layer, joined by `id` and nothing else.
 *
 * Sixteen keys, none omitted. There is no `verifie_par_humain`: the step plan
 * names one, but the field does not exist and its absence is deliberate — the
 * enrichment schema refuses a seventeenth key, so declaring oneself reviewed
 * makes a record *invalid* rather than trusted (CLAUDE.md § 10). The page
 * therefore cannot show a human-verified badge, and says what is true instead:
 * which model wrote it and when.
 */
export interface Enrichissement {
  readonly id: string
  readonly resume_court: string | null
  readonly categorie_principale: string | null
  readonly tags: readonly string[]
  readonly roles_tactiques: readonly string[]
  readonly cible_typique: string | null
  readonly type_degats: string | null
  readonly condition_infligee: readonly string[]
  readonly preuves: Readonly<Record<string, unknown>>
  readonly notes_ambiguite: string | null
  readonly slug: string
  readonly version_prompt: string
  readonly version_taxonomie: string
  readonly modele: string
  readonly genere_le: string
  readonly hash_source: string
}

/** A variant sub-spell, carrying its own technical block. */
export interface Variante {
  readonly nom: string
  readonly id: string | null
  readonly ecole: string | null
  readonly descripteurs: readonly string[]
  readonly niveaux: Readonly<Record<string, number>>
  readonly temps_incantation: string | null
  readonly composantes: string | null
  readonly portee: string | null
  readonly cible: string | null
  readonly duree: string | null
  readonly jet_de_sauvegarde: string | null
  readonly resistance_magie: string | null
  readonly description: string | null
}

export interface Mythique {
  readonly description: string | null
  readonly description_html: string | null
}

export interface PropsSort {
  readonly id: string
  readonly nom: string
  readonly url: string
  readonly ecole: string | null
  readonly descripteurs: readonly string[]
  /** The wiki's own abbreviations (`Ens/Mag`, `Occ`). Kept because the page
   * shows the abbreviation line verbatim; the resolved table is
   * `niveaux_par_classe`. */
  readonly niveaux: Readonly<Record<string, number>>
  readonly temps_incantation: string | null
  readonly composantes: string | null
  readonly portee: string | null
  readonly cible: string | null
  readonly duree: string | null
  readonly jet_de_sauvegarde: string | null
  readonly resistance_magie: string | null
  readonly description: string | null
  readonly description_html: string | null
  readonly mythique: Mythique | null
  readonly variantes: readonly Variante[]
  readonly sources: readonly string[]
  readonly classes: readonly unknown[]
  readonly meta: Readonly<Record<string, unknown>>
  readonly slug: string
  readonly url_source: string
  readonly niveaux_par_classe: Readonly<Record<string, NiveauClasse>>
  readonly desaccords: readonly DesaccordSort[]
  readonly enrichissement: Enrichissement | null
}

export const DOSSIER_SORTS_REEL = join(process.cwd(), 'public', 'data', 'sorts')
export const DOSSIER_SORTS_FIXTURE = join(process.cwd(), 'fixtures', 'sorts')

/**
 * Read one spell's props, or null if the file is absent.
 *
 * null rather than a throw, so the page can answer `notFound()`. A slug that is
 * in the index but has no props file is a different failure — a broken export —
 * and `verifier-props.test.ts` is what catches that, loudly, rather than letting
 * 404s stand in for it.
 */
export function lirePropsSort(slug: string, dossier: string = DOSSIER_SORTS_REEL): PropsSort | null {
  try {
    return JSON.parse(readFileSync(join(dossier, `${slug}.json`), 'utf8')) as PropsSort
  } catch {
    return null
  }
}
