/**
 * Check the built site for completeness, and report its weight for information.
 *
 * This runs on `web/out/`, after `next build`, and what it enforces is that the
 * output is *complete* — nothing here enforces a size.
 *
 * The page count is the check that matters. A spell that falls out of the index
 * does not error — `generateStaticParams` simply enumerates one fewer entry, the
 * build succeeds, and a URL that used to work 404s. Comparing against
 * `|index.sorts|` turns that into a build failure.
 *
 * Weight is measured and printed, never enforced. There was a blocking budget here
 * — 200 kB gzip of client JS per route, later split into a framework floor and a
 * per-route ceiling — and it was removed deliberately: performance is explicitly
 * secondary for this project, and a threshold nobody intends to defend is worse
 * than no threshold, because it fails builds for reasons the author does not care
 * about. The numbers are still printed because they cost nothing to compute and a
 * tenfold jump is worth seeing; seeing it is all this script now does about it.
 *
 * Measured from the HTML, by summing every script the document actually loads.
 * Reading a build manifest would measure what the bundler intended; reading the
 * emitted `<script src>` list measures what the browser will fetch. Both codecs are
 * shown, brotli being what a CDN actually serves.
 *
 * Usage: tsx scripts/verifier_build.ts [--racine-web web]
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

interface Poids {
  readonly gzip: number
  readonly brotli: number
}

/** Both codecs at once, at default quality for brotli — which is 11, the same
 * maximum a CDN uses for static assets it compresses ahead of time. */
function peser(octets: Buffer): Poids {
  return { gzip: pesee(octets), brotli: brotliCompressSync(octets).byteLength }
}

const somme = (poids: readonly Poids[]): Poids => ({
  gzip: poids.reduce((total, p) => total + p.gzip, 0),
  brotli: poids.reduce((total, p) => total + p.brotli, 0),
})

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
 * The scripts a document loads, as URLs.
 *
 * Deduplicated, because the same chunk appears both as a preload `href` and a
 * `src` and the browser fetches it once.
 */
function scriptsCharges(html: string): readonly string[] {
  const urls = new Set<string>()
  for (const trouve of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)) {
    const url = trouve[1]
    if (url !== undefined) urls.add(url)
  }
  return [...urls]
}

/**
 * Weigh a set of chunk URLs, reporting a missing one as a failure.
 *
 * A referenced-but-absent script is not a weight problem, it is a broken build —
 * but it surfaces here because this is the only place that resolves those URLs
 * against the filesystem.
 */
function peserChunks(racineOut: string, urls: readonly string[]): Poids {
  const poids: Poids[] = []
  for (const url of urls) {
    const chemin = join(racineOut, url)
    if (!existsSync(chemin)) {
      echec(`script référencé mais absent de la sortie : ${url}`)
      continue
    }
    poids.push(peser(readFileSync(chemin)))
  }
  return somme(poids)
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

  // --- poids des données, pour information --------------------------------
  console.log(`index gzip : ${ko(pesee(brutIndex))}`)

  const cheminAlias = join(racineWeb, 'public/data/alias.json')
  if (existsSync(cheminAlias)) {
    const gzipAlias = pesee(readFileSync(cheminAlias))
    console.log(`alias gzip : ${ko(gzipAlias)}`)
  } else {
    echec('alias.json absent : la recherche le charge au démarrage.')
  }

  // --- poids du JS client, pour information -------------------------------
  // La seule chose encore bloquante ici est un script référencé mais absent de la
  // sortie : ce n'est pas un problème de poids, c'est un build cassé.
  for (const route of ROUTES) {
    const chemin = join(racineOut, route.chemin)
    if (!existsSync(chemin)) {
      echec(`route absente de la sortie : ${route.chemin}`)
      continue
    }
    const urls = scriptsCharges(readFileSync(chemin, 'utf8'))
    const poids = peserChunks(racineOut, urls)
    console.log(
      `js ${route.nom.padEnd(11)}: ${ko(poids.brotli)} brotli, ${ko(poids.gzip)} gzip ` +
        `(${urls.length} fragment(s))`,
    )
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

  console.log('\nOK — pages complètes. Les poids ci-dessus sont indicatifs, aucun plafond.')
  return 0
}

process.exit(main(process.argv))
