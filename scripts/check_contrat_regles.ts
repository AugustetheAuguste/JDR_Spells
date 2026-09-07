/**
 * Verify the published rules tables against their contract.
 *
 * Model read before writing this: `scripts/check_data_contract.ts` (the sorts
 * index checker — same posture: read the artefact the site actually serves,
 * fail loudly and specifically, never guess a fix).
 *
 * This is the sole guard the exporter (`tools/regles/exporter_web.py`) hands
 * off to: it checks what a schema alone cannot —
 *   - the published bytes under `web/public/data/regles/<nom>` match the
 *     sha256 the index recorded for `data/regles/<nom>`, so a hand-edited or
 *     stale copy is caught rather than silently served;
 *   - every table's `meta` carries a `version` integer, a non-empty `sources`
 *     list of `{ url, page, lu_le }`, and an ISO `genere_le`;
 *   - every source URL actually points at pathfinder-fr.org — a wrong or
 *     invented URL here is worse than a missing one, cf. CLAUDE.md's safety
 *     maxim about never guessing a provenance;
 *   - `donnees` is not empty.
 *
 * `data/regles/` empty is the ONE case tolerated with exit 0 (steps 05/06
 * have not run yet, not an error); every other gap is exit 1.
 *
 * Usage: tsx scripts/check_contrat_regles.ts
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEST_DIR = resolve(RACINE, 'web/public/data/regles')
const SOURCE_DIR = resolve(RACINE, 'data/regles')
const CHEMIN_INDEX = resolve(DEST_DIR, 'index.json')

interface EntreeIndex {
  readonly nom: string
  readonly version: number
  readonly sha256: string
}

interface Index {
  readonly tables: readonly EntreeIndex[]
}

interface Source {
  readonly url: string
  readonly page: string
  readonly lu_le: string
}

interface Meta {
  readonly version: number
  readonly sources: readonly Source[]
  readonly genere_le: string
  readonly outil?: string
}

interface Table {
  readonly meta: Meta
  readonly donnees: unknown
}

const echecs: string[] = []

function echec(nom: string, message: string): void {
  echecs.push(`${nom} : ${message}`)
}

const REGEX_ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/

function verifierMeta(nom: string, meta: Meta): void {
  if (typeof meta.version !== 'number' || !Number.isInteger(meta.version)) {
    echec(nom, `meta.version doit être un entier, trouvé ${JSON.stringify(meta.version)}`)
  }
  if (!Array.isArray(meta.sources) || meta.sources.length === 0) {
    echec(nom, 'meta.sources doit être une liste non vide')
  } else {
    meta.sources.forEach((source, i) => {
      if (!source || typeof source !== 'object') {
        echec(nom, `meta.sources[${i}] n'est pas un objet`)
        return
      }
      if (typeof source.url !== 'string' || !source.url.startsWith('https://www.pathfinder-fr.org/')) {
        echec(nom, `meta.sources[${i}].url ne commence pas par https://www.pathfinder-fr.org/ : ${String(source.url)}`)
      }
      if (typeof source.page !== 'string' || source.page.length === 0) {
        echec(nom, `meta.sources[${i}].page manquant ou vide`)
      }
      if (typeof source.lu_le !== 'string' || !REGEX_ISO_DATE.test(source.lu_le)) {
        echec(nom, `meta.sources[${i}].lu_le n'est pas une date ISO : ${String(source.lu_le)}`)
      }
    })
  }
  if (typeof meta.genere_le !== 'string' || !REGEX_ISO_DATE.test(meta.genere_le)) {
    echec(nom, `meta.genere_le n'est pas une date ISO : ${String(meta.genere_le)}`)
  }
}

function verifierDonneesNonVides(nom: string, donnees: unknown): void {
  if (donnees === null || donnees === undefined) {
    echec(nom, 'donnees est absent')
    return
  }
  if (Array.isArray(donnees)) {
    if (donnees.length === 0) echec(nom, 'donnees est une liste vide')
    return
  }
  if (typeof donnees === 'object') {
    if (Object.keys(donnees as Record<string, unknown>).length === 0) {
      echec(nom, 'donnees est un objet vide')
    }
    return
  }
  echec(nom, `donnees a un type inattendu : ${typeof donnees}`)
}

function sha256DeFichier(chemin: string): string | null {
  if (!existsSync(chemin)) return null
  return createHash('sha256').update(readFileSync(chemin)).digest('hex')
}

function main(): number {
  if (!existsSync(CHEMIN_INDEX)) {
    console.log(
      `OK — ${CHEMIN_INDEX.replace(RACINE, '.').replaceAll('\\', '/')} est absent : ` +
        'data/regles/ non encore peuplé (les étapes 05/06 n’ont pas tourné). Seul cas toléré.',
    )
    return 0
  }

  let index: Index
  try {
    index = JSON.parse(readFileSync(CHEMIN_INDEX, 'utf8')) as Index
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur)
    console.error(`ÉCHEC : index.json illisible — ${detail}`)
    return 1
  }

  if (!Array.isArray(index.tables) || index.tables.length === 0) {
    console.log('OK — index.json ne liste aucune table : état non encore peuplé, seul cas toléré.')
    return 0
  }

  for (const entree of index.tables) {
    const cheminDest = resolve(DEST_DIR, entree.nom)
    const cheminSource = resolve(SOURCE_DIR, entree.nom)

    if (!existsSync(cheminDest)) {
      echec(entree.nom, `absent de ${DEST_DIR.replace(RACINE, '.').replaceAll('\\', '/')}`)
      continue
    }

    const shaSource = sha256DeFichier(cheminSource)
    if (shaSource === null) {
      echec(entree.nom, `source absente : ${cheminSource.replace(RACINE, '.').replaceAll('\\', '/')}`)
    } else if (shaSource !== entree.sha256) {
      echec(entree.nom, `sha256 de l'index (${entree.sha256.slice(0, 12)}…) ≠ sha256 de la source actuelle (${shaSource.slice(0, 12)}…) — réexporter`)
    }

    let table: Table
    try {
      table = JSON.parse(readFileSync(cheminDest, 'utf8')) as Table
    } catch (erreur) {
      const detail = erreur instanceof Error ? erreur.message : String(erreur)
      echec(entree.nom, `JSON invalide — ${detail}`)
      continue
    }

    if (!table.meta || typeof table.meta !== 'object') {
      echec(entree.nom, 'meta absent')
    } else {
      verifierMeta(entree.nom, table.meta)
    }
    verifierDonneesNonVides(entree.nom, table.donnees)
  }

  if (echecs.length > 0) {
    console.error(`ÉCHEC — ${echecs.length} écart(s) :`)
    for (const message of echecs) console.error(`  - ${message}`)
    return 1
  }

  console.log(`OK — ${index.tables.length} table(s) de règles conformes au contrat.`)
  return 0
}

process.exit(main())
