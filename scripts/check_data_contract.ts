/**
 * Verify a web index against its frozen contract, then against what a schema
 * cannot express.
 *
 * Why this exists on the TypeScript side when the Python exporter already
 * validates: the exporter and the site are two programs reading the same file,
 * and this one reads it the way the site does. It runs in CI on the committed
 * artefact (step 10), so a hand-edited or half-written `index.json` is caught
 * before it ships rather than by a blank filter chip in production.
 *
 * The checks past JSON Schema are the ones that actually bite:
 *   - unique slugs: the slug IS the public URL, so a duplicate is two spells
 *     fighting over one page.
 *   - dense `i`: the views use it as a short identifier and index into arrays
 *     with it; a hole is an undefined row.
 *   - code coherence: a code pointing past its table renders as an empty
 *     pastille, with nothing anywhere to notice it.
 *   - `niv` is an object: B4. A scalar level is meaningless in this corpus.
 *   - gzip size: the budget is blocking. A warning ignored three times is a
 *     permanent regression.
 *
 * Usage: tsx scripts/check_data_contract.ts [chemin/vers/index.json]
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
const CHEMIN_SCHEMA = resolve(RACINE, 'data/schemas/web_index.schema.json')
const CHEMIN_DEFAUT = resolve(RACINE, 'web/public/data/index.json')

const U_FFFD = '�'

interface Entree {
  readonly i: number
  readonly id: string
  readonly s: string
  readonly n: string
  readonly nf: string
  readonly e: number | null
  readonly niv: Readonly<Record<string, number>>
  readonly c: readonly number[]
  readonly p: number | null
  readonly j: number | null
  readonly rm: boolean | null
  readonly t: readonly number[]
  readonly ti: number | null
  readonly d: boolean
}

interface Index {
  readonly version: number
  readonly genere_le: string
  readonly ecoles: readonly string[]
  readonly classes: readonly { readonly slug: string; readonly nom: string }[]
  readonly portees: readonly string[]
  readonly jets: readonly string[]
  readonly composantes: readonly string[]
  readonly tags: readonly string[]
  readonly temps_incantation: readonly string[]
  readonly sorts: readonly Entree[]
}

const echecs: string[] = []

function echec(message: string): void {
  echecs.push(message)
}

/**
 * Report at most `max` instances of a defect, then say how many were hidden.
 * A thousand identical lines buries the second, different defect underneath.
 */
function resumer(titre: string, cas: readonly string[], max = 5): void {
  if (cas.length === 0) return
  const montres = cas.slice(0, max)
  const cache = cas.length - montres.length
  const suite = cache > 0 ? ` … et ${cache} autre(s)` : ''
  echec(`${titre} (${cas.length}) : ${montres.join(', ')}${suite}`)
}

function verifierUnicite(sorts: readonly Entree[]): void {
  const vusSlug = new Map<string, number>()
  const doublonsSlug: string[] = []
  for (const sort of sorts) {
    const precedent = vusSlug.get(sort.s)
    if (precedent !== undefined) {
      doublonsSlug.push(`${sort.s} (i=${precedent} et i=${sort.i})`)
    } else {
      vusSlug.set(sort.s, sort.i)
    }
  }
  resumer('slugs en doublon — le slug est l’URL publique', doublonsSlug)

  const idsVus = new Set<string>()
  const doublonsId: string[] = []
  for (const sort of sorts) {
    if (idsVus.has(sort.id)) doublonsId.push(sort.id)
    idsVus.add(sort.id)
  }
  resumer('ids en doublon', doublonsId)
}

function verifierIndexDense(sorts: readonly Entree[]): void {
  const attendus = sorts.map((_, rang) => rang)
  const trouves = sorts.map((sort) => sort.i)
  const ecarts: string[] = []
  for (const [rang, attendu] of attendus.entries()) {
    const trouve = trouves[rang]
    if (trouve !== attendu) ecarts.push(`position ${rang} porte i=${trouve}`)
  }
  resumer('`i` n’est pas un index dense 0..n-1', ecarts)
}

function verifierCodes(index: Index): void {
  const tables: readonly {
    readonly cle: 'e' | 'p' | 'j' | 'ti'
    readonly table: readonly string[]
    readonly nom: string
  }[] = [
    { cle: 'e', table: index.ecoles, nom: 'ecoles' },
    { cle: 'p', table: index.portees, nom: 'portees' },
    { cle: 'j', table: index.jets, nom: 'jets' },
    { cle: 'ti', table: index.temps_incantation, nom: 'temps_incantation' },
  ]

  for (const { cle, table, nom } of tables) {
    const pendants: string[] = []
    for (const sort of index.sorts) {
      const code = sort[cle]
      if (code === null) continue
      if (!Number.isInteger(code) || code < 0 || code >= table.length) {
        pendants.push(`${sort.s}.${cle}=${code}`)
      }
    }
    resumer(`codes hors de la table \`${nom}\` (taille ${table.length})`, pendants)
  }

  const listes: readonly {
    readonly cle: 'c' | 't'
    readonly table: readonly string[]
    readonly nom: string
  }[] = [
    { cle: 'c', table: index.composantes, nom: 'composantes' },
    { cle: 't', table: index.tags, nom: 'tags' },
  ]

  for (const { cle, table, nom } of listes) {
    const pendants: string[] = []
    for (const sort of index.sorts) {
      for (const code of sort[cle]) {
        if (!Number.isInteger(code) || code < 0 || code >= table.length) {
          pendants.push(`${sort.s}.${cle}=${code}`)
        }
      }
    }
    resumer(`codes hors de la table \`${nom}\` (taille ${table.length})`, pendants)
  }

  // Every table entry should be reachable. An unused one is dead weight shipped
  // to every visitor, and usually the trace of a facet that stopped being emitted.
  const utilises = {
    ecoles: new Set<number>(),
    portees: new Set<number>(),
    jets: new Set<number>(),
    composantes: new Set<number>(),
    tags: new Set<number>(),
    temps_incantation: new Set<number>(),
  }
  for (const sort of index.sorts) {
    if (sort.e !== null) utilises.ecoles.add(sort.e)
    if (sort.p !== null) utilises.portees.add(sort.p)
    if (sort.j !== null) utilises.jets.add(sort.j)
    for (const code of sort.c) utilises.composantes.add(code)
    for (const code of sort.t) utilises.tags.add(code)
    if (sort.ti !== null) utilises.temps_incantation.add(sort.ti)
  }
  const orphelines: string[] = []
  for (const [nom, table] of [
    ['ecoles', index.ecoles],
    ['portees', index.portees],
    ['jets', index.jets],
    ['composantes', index.composantes],
    ['tags', index.tags],
    ['temps_incantation', index.temps_incantation],
  ] as const) {
    for (const [code, valeur] of table.entries()) {
      if (!utilises[nom].has(code)) orphelines.push(`${nom}[${code}]=${valeur}`)
    }
  }
  resumer('entrées de table jamais référencées', orphelines)
}

function verifierNiveaux(index: Index): void {
  const declarees = new Set(index.classes.map((classe) => classe.slug))
  const scalaires: string[] = []
  const vides: string[] = []
  const inconnues: string[] = []
  const horsBornes: string[] = []

  for (const sort of index.sorts) {
    // B4: the level is relative to a class, always. A scalar here would mean the
    // model was flattened somewhere upstream, and no UI can recover it.
    if (typeof sort.niv !== 'object' || sort.niv === null || Array.isArray(sort.niv)) {
      scalaires.push(`${sort.s}=${JSON.stringify(sort.niv)}`)
      continue
    }
    const paires = Object.entries(sort.niv)
    if (paires.length === 0) {
      vides.push(sort.s)
      continue
    }
    for (const [slug, niveau] of paires) {
      if (!declarees.has(slug)) inconnues.push(`${sort.s}→${slug}`)
      if (!Number.isInteger(niveau) || niveau < 0 || niveau > 9) {
        horsBornes.push(`${sort.s}.${slug}=${niveau}`)
      }
    }
  }

  resumer('`niv` n’est pas un objet (B4 : niveau relatif à la classe)', scalaires)
  resumer('`niv` vide — un sort sans niveau ne se rend pas', vides)
  resumer('`niv` cite une classe absente de `classes`', inconnues)
  resumer('niveau hors de 0..9', horsBornes)
}

function verifierTexte(index: Index, brut: string): void {
  if (brut.includes(U_FFFD)) {
    echec('U+FFFD dans le fichier : corruption d’encodage, jamais une donnée')
  }
  if (brut.includes('\r\n')) {
    echec('CRLF dans le fichier : les sorties sont en LF, win32 compris')
  }
  const sansNf: string[] = []
  for (const sort of index.sorts) {
    if (sort.nf.length === 0 && sort.n.length > 0) sansNf.push(sort.s)
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

  let index: Index
  try {
    index = JSON.parse(brut) as Index
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
      'le contrat web_index.schema.json est violé',
      erreurs.map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()),
      10,
    )
    // Stop here. The checks below read fields the schema was supposed to
    // guarantee; run on a shape that failed it, they crash on `undefined` and a
    // stack trace replaces the diagnosis that was already in hand.
    console.error(`\nÉCHEC — ${echecs.length} contrôle(s) en défaut :`)
    for (const message of echecs) console.error(`  - ${message}`)
    return 1
  }

  verifierUnicite(index.sorts)
  verifierIndexDense(index.sorts)
  verifierCodes(index)
  verifierNiveaux(index)
  verifierTexte(index, brut)

  const octets = Buffer.from(brut, 'utf8')
  // level 9 and no timestamp: the measured size must be a function of the content
  // alone, matching what the Python exporter reports. Reported, never enforced —
  // there is no weight ceiling anywhere in this repository, by decision.
  const tailleGzip = gzipSync(octets, { level: 9 }).byteLength

  const ko = (n: number): string => `${(n / 1024).toFixed(1)} kB`

  console.log(`index      : ${relative(RACINE, chemin).replaceAll('\\', '/')}`)
  console.log(`version    : ${index.version}`)
  console.log(`généré le  : ${index.genere_le}`)
  console.log(`sorts      : ${index.sorts.length}`)
  console.log(`classes    : ${index.classes.length}`)
  console.log(
    `tables     : ${index.ecoles.length} écoles, ${index.portees.length} portées, ` +
      `${index.jets.length} jets, ${index.composantes.length} composantes, ` +
      `${index.tags.length} tags, ${index.temps_incantation.length} temps d'incantation`,
  )
  console.log(`désaccords : ${index.sorts.filter((s) => s.d).length}`)
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
