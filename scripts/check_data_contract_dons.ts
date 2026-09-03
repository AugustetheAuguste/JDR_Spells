/**
 * Verify a dons web index against its frozen contract, then against what a
 * schema cannot express.
 *
 * Mirrors `check_data_contract.ts` (spells) — same reasoning, same shape of
 * checks — adapted to the dons index's flatter, character-independent
 * vocabulary. See that file's header for why this exists as a separate
 * TypeScript-side check even though a Python exporter will validate too.
 *
 * The checks past JSON Schema are the ones that actually bite:
 *   - unique slugs: the slug IS the public URL, so a duplicate is two feats
 *     fighting over one page.
 *   - dense `i`: the views use it as a short identifier and index into arrays
 *     with it; a hole is an undefined row.
 *   - code coherence: a code pointing past its table renders as an empty
 *     pastille, with nothing anywhere to notice it.
 *   - `nf === plier(n)`: otherwise search fails silently on that entry.
 *   - gzip size: MEASURED and printed, never opposed to a threshold — this
 *     repository removed weight budgets 2026-08-26 by human arbitration.
 *
 * Usage: tsx scripts/check_data_contract_dons.ts [chemin/vers/index_dons.json]
 */

import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Ajv and ajv-formats are CommonJS: under NodeNext + verbatimModuleSyntax the
// callable is on `.default`, and the bare namespace import is not constructable.
import type { AnySchema, ErrorObject } from 'ajv'
import ajvModule from 'ajv/dist/2020.js'
import formatsModule from 'ajv-formats'

const Ajv2020 = ajvModule.default
const addFormats = formatsModule.default

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHEMIN_SCHEMA = resolve(RACINE, 'data/schemas/web_index_dons.schema.json')
const CHEMIN_DEFAUT = resolve(RACINE, 'web/public/data/dons/index.json')

const U_FFFD = '�'

// Same fold as `src/pf_spells/web_pliage.py::plier` / `web/lib/recherche/pliage.ts::plier`.
// Reimplemented here (not imported) because this script runs standalone under
// tsx without the web app's module graph — but the algorithm, order of
// operations included, must stay byte-for-byte identical to both.
const LIGATURES: ReadonlyArray<readonly [RegExp, string]> = [
  [/œ/g, 'oe'],
  [/Œ/g, 'oe'],
  [/æ/g, 'ae'],
  [/Æ/g, 'ae'],
]
const APOSTROPHES = /['’ʼ]/g
const ESPACES = /\s+/g
const MARQUES = /\p{M}/gu

function plier(texte: string): string {
  let resultat = texte
  for (const [motif, remplacement] of LIGATURES) {
    resultat = resultat.replace(motif, remplacement)
  }
  resultat = resultat.replace(APOSTROPHES, ' ')
  resultat = resultat.normalize('NFKD').replace(MARQUES, '')
  return resultat.toLowerCase().replace(ESPACES, ' ').trim()
}

interface Don {
  readonly i: number
  readonly id: string
  readonly s: string
  readonly n: string
  readonly nf: string
  readonly r: boolean
  readonly ep: number | null
  readonly es: readonly number[]
  readonly cb: readonly number[]
  readonly cx: readonly number[]
  readonly ac: number | null
  readonly pv: number | null
  readonly cat: readonly number[]
  readonly src: number | null
  readonly vb: string | null
  readonly rc: string | null
  readonly mc: readonly string[]
}

interface IndexDons {
  readonly version: number
  readonly genere_le: string
  readonly effets_principaux: readonly string[]
  readonly cibles_bonus: readonly string[]
  readonly contextes: readonly string[]
  readonly activations: readonly string[]
  readonly polyvalences: readonly string[]
  readonly categories: readonly string[]
  readonly sources: readonly string[]
  readonly dons: readonly Don[]
}

const echecs: string[] = []

function echec(message: string): void {
  echecs.push(message)
}

/** Report at most `max` instances of a defect, then say how many were hidden. */
function resumer(titre: string, cas: readonly string[], max = 5): void {
  if (cas.length === 0) return
  const montres = cas.slice(0, max)
  const cache = cas.length - montres.length
  const suite = cache > 0 ? ` … et ${cache} autre(s)` : ''
  echec(`${titre} (${cas.length}) : ${montres.join(', ')}${suite}`)
}

function verifierUnicite(dons: readonly Don[]): void {
  const vusSlug = new Map<string, number>()
  const doublonsSlug: string[] = []
  for (const don of dons) {
    const precedent = vusSlug.get(don.s)
    if (precedent !== undefined) {
      doublonsSlug.push(`${don.s} (i=${precedent} et i=${don.i})`)
    } else {
      vusSlug.set(don.s, don.i)
    }
  }
  resumer('slugs en doublon — le slug est l’URL publique', doublonsSlug)

  const idsVus = new Set<string>()
  const doublonsId: string[] = []
  for (const don of dons) {
    if (idsVus.has(don.id)) doublonsId.push(don.id)
    idsVus.add(don.id)
  }
  resumer('ids en doublon', doublonsId)
}

function verifierIndexDense(dons: readonly Don[]): void {
  const ecarts: string[] = []
  for (const [rang, don] of dons.entries()) {
    if (don.i !== rang) ecarts.push(`position ${rang} porte i=${don.i}`)
  }
  resumer('`i` n’est pas un index dense 0..n-1', ecarts)
}

function verifierCodes(index: IndexDons): void {
  const scalaires: readonly {
    readonly cle: 'ep' | 'ac' | 'pv' | 'src'
    readonly table: readonly string[]
    readonly nom: string
  }[] = [
    { cle: 'ep', table: index.effets_principaux, nom: 'effets_principaux' },
    { cle: 'ac', table: index.activations, nom: 'activations' },
    { cle: 'pv', table: index.polyvalences, nom: 'polyvalences' },
    { cle: 'src', table: index.sources, nom: 'sources' },
  ]

  for (const { cle, table, nom } of scalaires) {
    const pendants: string[] = []
    for (const don of index.dons) {
      const code = don[cle]
      if (code === null) continue
      if (!Number.isInteger(code) || code < 0 || code >= table.length) {
        pendants.push(`${don.s}.${cle}=${code}`)
      }
    }
    resumer(`codes hors de la table \`${nom}\` (taille ${table.length})`, pendants)
  }

  const listes: readonly {
    readonly cle: 'es' | 'cb' | 'cx' | 'cat'
    readonly table: readonly string[]
    readonly nom: string
  }[] = [
    { cle: 'es', table: index.effets_principaux, nom: 'effets_principaux (via es)' },
    { cle: 'cb', table: index.cibles_bonus, nom: 'cibles_bonus' },
    { cle: 'cx', table: index.contextes, nom: 'contextes' },
    { cle: 'cat', table: index.categories, nom: 'categories' },
  ]

  for (const { cle, table, nom } of listes) {
    const pendants: string[] = []
    for (const don of index.dons) {
      for (const code of don[cle]) {
        if (!Number.isInteger(code) || code < 0 || code >= table.length) {
          pendants.push(`${don.s}.${cle}=${code}`)
        }
      }
    }
    resumer(`codes hors de la table \`${nom}\` (taille ${table.length})`, pendants)
  }
}

function verifierPliage(index: IndexDons): void {
  const divergents: string[] = []
  for (const don of index.dons) {
    if (don.nf !== plier(don.n)) divergents.push(`${don.s} : nf=${JSON.stringify(don.nf)} ≠ plier(n)=${JSON.stringify(plier(don.n))}`)
  }
  resumer('`nf` ne correspond pas à `plier(n)`', divergents)
}

function verifierSemantiqueCoherente(index: IndexDons): void {
  // If a don carries no LLM enrichment, every semantic field must be
  // null/[] together — never a partial mix that would make the UI show a
  // half-empty facet section instead of hiding it.
  const incoherents: string[] = []
  for (const don of index.dons) {
    const champsScalaires = [don.ep, don.ac, don.pv]
    const champsListes = [don.es, don.cb, don.cx]
    const toutNul = champsScalaires.every((c) => c === null)
    const toutVide = champsListes.every((c) => c.length === 0)
    const rienDeTout = toutNul && toutVide
    const quelqueChose = champsScalaires.some((c) => c !== null) || champsListes.some((c) => c.length > 0)
    if (!rienDeTout && !quelqueChose) {
      incoherents.push(don.s)
    }
  }
  resumer('mélange incohérent de champs sémantiques nuls et renseignés', incoherents)
}

function verifierTexte(index: IndexDons, brut: string): void {
  if (brut.includes(U_FFFD)) {
    echec('U+FFFD dans le fichier : corruption d’encodage, jamais une donnée')
  }
  if (brut.includes('\r\n')) {
    echec('CRLF dans le fichier : les sorties sont en LF, win32 compris')
  }
  const sansNf: string[] = []
  for (const don of index.dons) {
    if (don.nf.length === 0 && don.n.length > 0) sansNf.push(don.s)
  }
  resumer('`nf` vide alors que `n` ne l’est pas — le pliage a échoué', sansNf)
}

function main(argv: readonly string[]): number {
  const argument = argv[2]
  const chemin = argument === undefined ? CHEMIN_DEFAUT : resolve(process.cwd(), argument)

  let brut: string
  try {
    brut = readFileSync(chemin, 'utf8')
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur)
    console.error(`ÉCHEC : index illisible — ${detail}`)
    return 1
  }

  let index: IndexDons
  try {
    index = JSON.parse(brut) as IndexDons
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur)
    console.error(`ÉCHEC : JSON invalide — ${detail}`)
    return 1
  }

  const schema = JSON.parse(readFileSync(CHEMIN_SCHEMA, 'utf8')) as AnySchema
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  const valider = ajv.compile(schema)

  if (!valider(index)) {
    const erreurs: ErrorObject[] = valider.errors ?? []
    resumer(
      'le contrat web_index_dons.schema.json est violé',
      erreurs.map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()),
      10,
    )
    // Stop here. The checks below read fields the schema was supposed to
    // guarantee; run on a shape that failed it, they crash on `undefined` and
    // a stack trace replaces the diagnosis that was already in hand.
    console.error(`\nÉCHEC — ${echecs.length} contrôle(s) en défaut :`)
    for (const message of echecs) console.error(`  - ${message}`)
    return 1
  }

  verifierUnicite(index.dons)
  verifierIndexDense(index.dons)
  verifierCodes(index)
  verifierPliage(index)
  verifierSemantiqueCoherente(index)
  verifierTexte(index, brut)

  const octets = Buffer.from(brut, 'utf8')
  // level 9 and no timestamp: the measured size must be a function of the
  // content alone. Reported, never enforced — there is no weight ceiling
  // anywhere in this repository, by decision.
  const tailleGzip = gzipSync(octets, { level: 9 }).byteLength

  const ko = (n: number): string => `${(n / 1024).toFixed(1)} kB`

  console.log(`index      : ${relative(RACINE, chemin).replaceAll('\\', '/')}`)
  console.log(`version    : ${index.version}`)
  console.log(`généré le  : ${index.genere_le}`)
  console.log(`dons       : ${index.dons.length}`)
  console.log(
    `tables     : ${index.effets_principaux.length} effets_principaux, ` +
      `${index.cibles_bonus.length} cibles_bonus, ${index.contextes.length} contextes, ` +
      `${index.activations.length} activations, ${index.polyvalences.length} polyvalences, ` +
      `${index.categories.length} categories, ${index.sources.length} sources`,
  )
  console.log(`répétables : ${index.dons.filter((d) => d.r).length}`)
  console.log(`brut       : ${ko(octets.byteLength)}`)
  console.log(`gzip       : ${ko(tailleGzip)}`)

  if (echecs.length > 0) {
    console.error(`\nÉCHEC — ${echecs.length} contrôle(s) en défaut :`)
    for (const message of echecs) console.error(`  - ${message}`)
    return 1
  }

  console.log('\nOK — contrat respecté. Le poids ci-dessus est indicatif, aucun plafond.')
  return 0
}

process.exit(main(process.argv))
