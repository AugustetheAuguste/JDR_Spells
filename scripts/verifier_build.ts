/**
 * Measure the built site against blocking budgets.
 *
 * This runs on `web/out/`, after `next build`, and it exists because the two
 * numbers that decide whether the site is usable are invisible from the source:
 * how many pages actually got generated, and how much JavaScript a visitor
 * actually downloads before the first keystroke works.
 *
 * The page count is the one that catches a silent data regression. A spell that
 * falls out of the index does not error — `generateStaticParams` simply enumerates
 * one fewer entry, the build succeeds, and a URL that used to work 404s. Comparing
 * against `|index.sorts|` turns that into a build failure.
 *
 * The JS budget is measured per route, from the HTML, by summing the gzip of every
 * script the document actually loads. Next 16 no longer prints per-route sizes, and
 * reading a build manifest would measure what the bundler intended; reading the
 * emitted `<script src>` list measures what the browser will fetch.
 *
 * Budgets are blocking. A warning ignored three times is a permanent regression.
 *
 * Usage: tsx scripts/verifier_build.ts [--racine-web web]
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Same ceiling as `BUDGET_GZIP_OCTETS` in `pf_spells.export_web` and in
 * `check_data_contract.ts`. Three readers, one number, stated three times — but
 * the alternative is a shared module that only this script would import. */
const BUDGET_INDEX_GZIP = 400 * 1024

/** The plan's ceiling for the initial client bundle. Measured per route on the
 * gzip of the scripts the document loads. */
const BUDGET_JS_GZIP = 200 * 1024

/** The three routes the plan names, and the ones with genuinely distinct
 * bundles: the navigation view, one spell sheet, the comparison view. Favourites
 * is added because it is the fourth interactive route and its bundle is the one a
 * new `localStorage` dependency would inflate. */
const ROUTES: readonly { readonly nom: string; readonly chemin: string }[] = [
  { nom: 'navigation', chemin: 'index.html' },
  { nom: 'fiche', chemin: 'sorts/detection-de-la-magie/index.html' },
  { nom: 'comparaison', chemin: 'comparaison/index.html' },
  { nom: 'favoris', chemin: 'favoris/index.html' },
]

const echecs: string[] = []

function echec(message: string): void {
  echecs.push(message)
}

const ko = (n: number): string => `${(n / 1024).toFixed(1)} kB`

/** gzip at level 9, no timestamp: the measurement must be a function of the
 * content alone, or the same bytes score differently on two machines. */
function pesee(octets: Buffer): number {
  return gzipSync(octets, { level: 9 }).byteLength
}

/** Every `index.html` under a directory, recursively. Counting `*.html` at large
 * would also count `404.html`, which is not a spell page and not in the index. */
function compterPages(racine: string): number {
  let total = 0
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name)
    if (entree.isDirectory()) total += compterPages(chemin)
    else if (entree.name === 'index.html') total += 1
  }
  return total
}

/**
 * The gzip weight of the scripts a document loads.
 *
 * Deduplicated by URL, because the same chunk appears both as a preload `href`
 * and a `src` and the browser fetches it once.
 */
function poidsJs(racineOut: string, html: string): { readonly gzip: number; readonly nb: number } {
  const urls = new Set<string>()
  for (const trouve of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)) {
    const url = trouve[1]
    if (url !== undefined) urls.add(url)
  }
  let gzip = 0
  for (const url of urls) {
    const chemin = join(racineOut, url)
    if (!existsSync(chemin)) {
      echec(`script référencé mais absent de la sortie : ${url}`)
      continue
    }
    gzip += pesee(readFileSync(chemin))
  }
  return { gzip, nb: urls.size }
}

function main(argv: readonly string[]): number {
  const rangRacine = argv.indexOf('--racine-web')
  const racineWeb = resolve(
    RACINE,
    rangRacine >= 0 ? (argv[rangRacine + 1] ?? 'web') : 'web',
  )
  const racineOut = join(racineWeb, 'out')

  if (!existsSync(racineOut)) {
    console.error(
      `ÉCHEC : ${relative(RACINE, racineOut).replaceAll('\\', '/')} est absent — ` +
        'lancer `npm run web:build` avant de mesurer.',
    )
    return 1
  }

  const cheminIndex = join(racineWeb, 'public/data/index.json')
  const brutIndex = readFileSync(cheminIndex)
  const index = JSON.parse(brutIndex.toString('utf8')) as {
    readonly sorts: readonly unknown[]
  }
  const nbSorts = index.sorts.length

  console.log(`sortie     : ${relative(RACINE, racineOut).replaceAll('\\', '/')}`)
  console.log(`sorts      : ${nbSorts}`)

  // --- pages -------------------------------------------------------------
  const cheminSorts = join(racineOut, 'sorts')
  const nbPagesSorts = existsSync(cheminSorts) ? compterPages(cheminSorts) : 0
  const nbPagesTotal = compterPages(racineOut)
  console.log(`pages sort : ${nbPagesSorts}`)
  console.log(`pages tot. : ${nbPagesTotal}`)

  if (nbPagesSorts !== nbSorts) {
    echec(
      `${nbPagesSorts} page(s) sous /sorts/ pour ${nbSorts} sort(s) dans l’index. ` +
        'Un sort sans page est un lien mort, une page sans sort est un artefact périmé.',
    )
  }

  // --- poids des données -------------------------------------------------
  const gzipIndex = pesee(brutIndex)
  console.log(
    `index gzip : ${ko(gzipIndex)} / ${ko(BUDGET_INDEX_GZIP)} ` +
      `(${((gzipIndex / BUDGET_INDEX_GZIP) * 100).toFixed(1)} %)`,
  )
  if (gzipIndex > BUDGET_INDEX_GZIP) {
    echec(`index.json hors budget : ${gzipIndex} octets gzippés > ${BUDGET_INDEX_GZIP}.`)
  }

  const cheminAlias = join(racineWeb, 'public/data/alias.json')
  if (existsSync(cheminAlias)) {
    const gzipAlias = pesee(readFileSync(cheminAlias))
    console.log(`alias gzip : ${ko(gzipAlias)}`)
  } else {
    echec('alias.json absent : la recherche le charge au démarrage.')
  }

  // --- poids du JS client ------------------------------------------------
  for (const route of ROUTES) {
    const chemin = join(racineOut, route.chemin)
    if (!existsSync(chemin)) {
      echec(`route absente de la sortie : ${route.chemin}`)
      continue
    }
    const { gzip, nb } = poidsJs(racineOut, readFileSync(chemin, 'utf8'))
    const part = ((gzip / BUDGET_JS_GZIP) * 100).toFixed(1)
    console.log(
      `js ${route.nom.padEnd(12)}: ${ko(gzip)} / ${ko(BUDGET_JS_GZIP)} ` +
        `(${part} %, ${nb} fragment(s))`,
    )
    if (gzip > BUDGET_JS_GZIP) {
      echec(
        `route ${route.nom} hors budget JS : ${gzip} octets gzippés > ${BUDGET_JS_GZIP}.`,
      )
    }
  }

  // --- les données sont bien publiées -----------------------------------
  const donneesPubliees = join(racineOut, 'data/index.json')
  if (!existsSync(donneesPubliees)) {
    echec('/data/index.json est absent de la sortie : les vues le récupèrent au runtime.')
  } else if (statSync(donneesPubliees).size !== brutIndex.byteLength) {
    echec('/data/index.json publié diffère de public/data/index.json en taille.')
  }

  if (echecs.length > 0) {
    console.error(`\nÉCHEC — ${echecs.length} contrôle(s) en défaut :`)
    for (const message of echecs) console.error(`  - ${message}`)
    return 1
  }

  console.log('\nOK — pages complètes, budgets tenus.')
  return 0
}

process.exit(main(process.argv))
