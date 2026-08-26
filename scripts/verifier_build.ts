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
 * The JS budget is measured per route, from the HTML, by summing every script the
 * document actually loads. Next 16 no longer prints per-route sizes, and reading a
 * build manifest would measure what the bundler intended; reading the emitted
 * `<script src>` list measures what the browser will fetch.
 *
 * Two things about that measurement were wrong until now, and both made it report
 * a number nobody experiences.
 *
 * It weighed gzip. Vercel serves brotli, and on this bundle the gap is 25 kB —
 * six times the margin the old ceiling appeared to leave. A budget must be
 * denominated in the bytes that cross the wire, so the ceilings below are brotli;
 * gzip is still printed, as the floor for a hypothetical client that cannot do
 * better.
 *
 * It was a single per-route total, and 95 % of that total is React and the Next
 * router. So the budget tracked the version of Next, not this repository: a Next
 * upgrade could fail CI with no source change, while the application code could
 * grow several times over without moving the number much. It is therefore split
 * in two — a floor for the shared framework chunks, which moves only on upgrade,
 * and a per-route budget for the chunks this repository actually writes, which is
 * the one a new view or a new dependency has to answer to.
 *
 * Budgets are blocking. A warning ignored three times is a permanent regression.
 *
 * Usage: tsx scripts/verifier_build.ts [--racine-web web]
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Same ceiling as `BUDGET_GZIP_OCTETS` in `pf_spells.export_web` and in
 * `check_data_contract.ts`. Three readers, one number, stated three times — but
 * the alternative is a shared module that only this script would import. */
const BUDGET_INDEX_GZIP = 400 * 1024

/**
 * Ceiling for the chunks shared by every route — React, the Flight client, the
 * app router. Brotli.
 *
 * This is a witness value, not an aspiration: it is what the framework weighs
 * today (161 kB) plus room for a minor upgrade. Nothing this repository writes can
 * bring it down; only leaving React would, which is a rewrite and not an
 * optimisation. Its job is to make a framework regression a visible event —
 * a Next release that adds 30 kB to every page should stop the build and be
 * decided on, not absorbed silently into a total nobody reads.
 *
 * Raising it is legitimate. Raising it without saying why, in the commit that
 * raises it, is how a budget becomes decoration.
 */
const BUDGET_SOCLE_BROTLI = 175 * 1024

/**
 * Ceiling for the route-specific chunks — the code this repository writes.
 * Brotli, per route.
 *
 * The heaviest route sits at 9.3 kB, so this is deliberately loose: it is sized to
 * admit a real feature (the search suggestion combobox, a second index) and still
 * refuse a bundled UI library. That is the whole point of splitting the budget —
 * this number is the one a pull request can actually move, so it is the one worth
 * measuring.
 */
const BUDGET_ROUTE_BROTLI = 25 * 1024

/**
 * The search engine must stay out of every route's initial payload.
 *
 * `VueNavigation` imports `lib/recherche/moteur` as a type and then via `import()`,
 * precisely so MiniSearch lands in its own chunk (5.4 kB brotli, fetched on the
 * first keystroke). Nothing in the type system enforces that: turning the dynamic
 * import into a static one compiles, passes every test, and quietly adds those
 * kilobytes to all four routes — a regression with no symptom, which is the kind
 * this file exists to catch.
 *
 * Matched on the minified class name rather than a module path, because Turbopack
 * emits no `node_modules/` comment in production output.
 */
const EMPREINTE_MOTEUR = 'MiniSearch'

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

/**
 * The chunks loaded by *every* route.
 *
 * This is the operational definition of "framework" used by the budget: not a
 * hardcoded list of `react-dom` filenames, which the next Turbopack release would
 * silently invalidate, but whatever the four routes have in common. A chunk that
 * only some routes load is application code by construction, and a shared chunk
 * that this repository put there — a provider in `layout.tsx`, say — counts
 * against the framework floor, which is the honest place for it: every visitor
 * downloads it on every page.
 */
function chunksCommuns(parRoute: ReadonlyMap<string, readonly string[]>): ReadonlySet<string> {
  const listes = [...parRoute.values()]
  const premiere = listes[0] ?? []
  return new Set(premiere.filter((url) => listes.every((liste) => liste.includes(url))))
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
  // Toutes les routes sont relevées d'abord : la partition socle / applicatif est
  // définie par ce que les routes ont en commun, donc aucune ne peut être pesée
  // avant que toutes soient lues.
  const parRoute = new Map<string, readonly string[]>()
  for (const route of ROUTES) {
    const chemin = join(racineOut, route.chemin)
    if (!existsSync(chemin)) {
      echec(`route absente de la sortie : ${route.chemin}`)
      continue
    }
    parRoute.set(route.nom, scriptsCharges(readFileSync(chemin, 'utf8')))
  }

  if (parRoute.size === ROUTES.length) {
    const communs = chunksCommuns(parRoute)
    const socle = peserChunks(racineOut, [...communs])
    console.log(
      `\njs ${'socle'.padEnd(11)}: ${ko(socle.brotli)} brotli / ${ko(BUDGET_SOCLE_BROTLI)} ` +
        `(${((socle.brotli / BUDGET_SOCLE_BROTLI) * 100).toFixed(1)} %, ` +
        `${ko(socle.gzip)} gzip, ${communs.size} fragment(s)) — React + routeur Next`,
    )
    if (socle.brotli > BUDGET_SOCLE_BROTLI) {
      echec(
        `socle commun hors budget : ${socle.brotli} octets brotli > ${BUDGET_SOCLE_BROTLI}. ` +
          'Aucun code applicatif ne le fera baisser — vérifier ce qu’une mise à jour du ' +
          'framework a ajouté, ou ce qu’un composant partagé a fait remonter dans le socle.',
      )
    }

    for (const route of ROUTES) {
      const urls = parRoute.get(route.nom) ?? []
      const propres = urls.filter((url) => !communs.has(url))
      const applicatif = peserChunks(racineOut, propres)
      const total = peserChunks(racineOut, urls)
      console.log(
        `js ${route.nom.padEnd(11)}: ${ko(applicatif.brotli)} brotli / ` +
          `${ko(BUDGET_ROUTE_BROTLI)} ` +
          `(${((applicatif.brotli / BUDGET_ROUTE_BROTLI) * 100).toFixed(1)} %, ` +
          `${propres.length} fragment(s)) — total page ${ko(total.brotli)} brotli, ` +
          `${ko(total.gzip)} gzip`,
      )
      if (applicatif.brotli > BUDGET_ROUTE_BROTLI) {
        echec(
          `route ${route.nom} hors budget applicatif : ${applicatif.brotli} octets ` +
            `brotli > ${BUDGET_ROUTE_BROTLI}. Charger à la demande ce dont la première ` +
            'frappe n’a pas besoin, comme le moteur de recherche l’est déjà.',
        )
      }
    }
  }

  // --- le moteur reste chargé à la demande -------------------------------
  const chargesPartout = new Set([...parRoute.values()].flat())
  const entreesFautives = [...chargesPartout].filter((url) => {
    const chemin = join(racineOut, url)
    return existsSync(chemin) && readFileSync(chemin, 'utf8').includes(EMPREINTE_MOTEUR)
  })
  const cheminChunks = join(racineOut, '_next/static/chunks')
  const differe = existsSync(cheminChunks)
    ? readdirSync(cheminChunks).filter(
        (nom) =>
          nom.endsWith('.js') &&
          !chargesPartout.has(`/_next/static/chunks/${nom}`) &&
          readFileSync(join(cheminChunks, nom), 'utf8').includes(EMPREINTE_MOTEUR),
      )
    : []

  console.log(
    `moteur     : ${differe.length} fragment(s) différé(s), ` +
      `${entreesFautives.length} dans le payload initial`,
  )
  if (entreesFautives.length > 0) {
    echec(
      `le moteur de recherche est dans le payload initial de ${entreesFautives.length} ` +
        'fragment(s) chargé(s) d’emblée : l’import dynamique de `lib/recherche/moteur` ' +
        'est devenu statique.',
    )
  }
  // A vacuously green check is worse than no check: if the fingerprint stops
  // matching — a MiniSearch major that renames the class, a bundler that mangles
  // it — the search above finds nothing anywhere and reports success.
  if (differe.length === 0) {
    echec(
      `empreinte « ${EMPREINTE_MOTEUR} » introuvable dans les fragments différés : ` +
        'le contrôle du chargement à la demande ne mesure plus rien. Réaligner ' +
        '`EMPREINTE_MOTEUR` sur la sortie du bundler.',
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

  console.log('\nOK — pages complètes, budgets tenus.')
  return 0
}

process.exit(main(process.argv))
