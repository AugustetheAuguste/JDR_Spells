/// <reference lib="dom" />
/**
 * Measure real touch-target sizes and horizontal overflow in a real browser.
 *
 * `design/FOLLOWUPS.md` carried two gaps that no jsdom test can close: a
 * control's rendered height and a document's horizontal scrollWidth are layout
 * properties, and jsdom never computes layout. This drives the built export in
 * the Chromium already present on the machine (playwright-core is a driver
 * only, no browser download) and measures four things across six viewport
 * widths and six routes: horizontal overflow, control size against a 44 px
 * floor (32 px inside a table row), input font size under 768 px, and content
 * loss at a simulated 200 % zoom.
 *
 * Limit, stated in the output as well: one browser (Chromium), one theme (day,
 * the default), and no interaction state — a closed drawer is not measured.
 *
 * Usage: tsx scripts/verifier_cibles.ts [--racine-web web]
 */

import { createServer, type Server } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, type Browser, type Page } from 'playwright-core'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const CIBLE_MIN = 44
const LIGNE_MIN = 32
const POLICE_MIN_MOBILE = 16
const SEUIL_MOBILE = 768

const LARGEURS = [320, 375, 768, 1024, 1440, 1920] as const

const ROUTES: readonly { readonly nom: string; readonly chemin: string }[] = [
  { nom: 'navigation', chemin: '' },
  { nom: 'fiche', chemin: 'sorts/detection-de-la-magie/' },
  { nom: 'comparaison', chemin: 'comparaison/' },
  { nom: 'favoris', chemin: 'favoris/' },
  { nom: 'exploration', chemin: 'explorer/' },
  { nom: 'compte', chemin: 'compte/' },
]

const TYPES_MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

interface Echec {
  readonly type: 'defilement-horizontal' | 'cible-trop-petite' | 'police-champ-mobile' | 'perte-au-zoom'
  readonly largeur: number
  readonly route: string
  readonly detail: string
}

/** Serve `racine` on 127.0.0.1, reproducing `trailingSlash: true`: a directory
 * resolves to its `index.html`, an unknown path falls back to `404.html`. A
 * server that answers 404 for every route would fail all six measures for a
 * reason that has nothing to do with layout, hence checking this first. */
function servir(racine: string, port: number): Server {
  const serveur = createServer((requete, reponse) => {
    const url = new URL(requete.url ?? '/', 'http://127.0.0.1')
    let chemin = decodeURIComponent(url.pathname)
    if (chemin.endsWith('/')) chemin += 'index.html'
    let fichier = join(racine, chemin)
    if (!existsSync(fichier) || !fichier.startsWith(racine)) {
      fichier = join(racine, '404.html')
    }
    const type = TYPES_MIME[extname(fichier)] ?? 'application/octet-stream'
    try {
      const contenu = readFileSync(fichier)
      reponse.writeHead(existsSync(join(racine, chemin)) ? 200 : 404, { 'Content-Type': type })
      reponse.end(contenu)
    } catch {
      reponse.writeHead(404, { 'Content-Type': 'text/plain' })
      reponse.end('Introuvable')
    }
  })
  serveur.listen(port, '127.0.0.1')
  return serveur
}

function portLibre(): Promise<number> {
  return new Promise((resoudre, rejeter) => {
    const sonde = createServer()
    sonde.listen(0, '127.0.0.1', () => {
      const adresse = sonde.address()
      if (adresse === null || typeof adresse === 'string') {
        rejeter(new Error('adresse de sonde de port introuvable'))
        return
      }
      const { port } = adresse
      sonde.close(() => resoudre(port))
    })
  })
}

/** Wait past the "Chargement" placeholder the index takes a beat to replace,
 * on top of Playwright's own network-idle wait. */
async function attendreChargement(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  await page
    .waitForFunction(() => !(document.body.textContent ?? '').includes('Chargement'), undefined, {
      timeout: 5000,
    })
    .catch(() => {
      // Some routes never show the placeholder; that is not a failure here.
    })
}

async function mesurerDefilement(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const racine = document.documentElement
    return racine.scrollWidth > racine.clientWidth + 1
  })
}

interface MesureCible {
  readonly selecteur: string
  readonly largeur: number
  readonly hauteur: number
  readonly plancher: number
  readonly texte: string
}

async function mesurerCibles(page: Page): Promise<readonly MesureCible[]> {
  return page.evaluate(
    ({ cibleMin, ligneMin }) => {
      const elements = document.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, summary, [role=checkbox], label:has(input)',
      )
      const resultats: MesureCible[] = []
      for (const element of Array.from(elements)) {
        const style = window.getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        // `sr-only` (the skip link, revealed only on focus) clips its element to
        // 1×1 px rather than to a strictly empty rect: an unfocused skip link is
        // a closed drawer, not a control failing its floor.
        const invisible =
          rect.width < 2 ||
          rect.height < 2 ||
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          element.hidden
        if (invisible) continue

        const ligne = element.closest('tbody tr') !== null
        const estBouton = element.tagName === 'BUTTON'
        const plancher = ligne && !estBouton ? ligneMin : cibleMin

        if (rect.height < plancher || rect.width < plancher) {
          let selecteur = element.tagName.toLowerCase()
          if (element.id !== '') selecteur += `#${element.id}`
          else if (element.className !== '') selecteur += `.${element.className.split(' ')[0]}`
          resultats.push({
            selecteur,
            largeur: Math.round(rect.width),
            hauteur: Math.round(rect.height),
            plancher,
            texte: (element.textContent ?? '').trim().slice(0, 40),
          })
        }
      }
      return resultats
    },
    { cibleMin: CIBLE_MIN, ligneMin: LIGNE_MIN },
  )
}

interface MesurePolice {
  readonly selecteur: string
  readonly taille: number
}

async function mesurerPolicesChamps(page: Page): Promise<readonly MesurePolice[]> {
  return page.evaluate((seuil) => {
    const champs = document.querySelectorAll<HTMLElement>('input, textarea')
    const resultats: MesurePolice[] = []
    for (const champ of Array.from(champs)) {
      const rect = champ.getBoundingClientRect()
      const style = window.getComputedStyle(champ)
      if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden') {
        continue
      }
      const taille = parseFloat(style.fontSize)
      if (taille < seuil) {
        let selecteur = champ.tagName.toLowerCase()
        if (champ.id !== '') selecteur += `#${champ.id}`
        resultats.push({ selecteur, taille })
      }
    }
    return resultats
  }, POLICE_MIN_MOBILE)
}

interface MesureZoom {
  readonly defilement: boolean
  readonly h1Tronque: boolean
  readonly h1Absent: boolean
  readonly debordements: readonly string[]
}

async function mesurerZoom(page: Page): Promise<MesureZoom> {
  return page.evaluate(() => {
    const racine = document.documentElement
    const defilement = racine.scrollWidth > racine.clientWidth + 1

    const h1 = document.querySelector('h1')
    const h1Absent = h1 === null
    let h1Tronque = false
    if (h1 !== null) {
      const style = window.getComputedStyle(h1)
      h1Tronque =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        h1.getBoundingClientRect().width === 0

      // A one-line ellipsis truncation is visible as scrollWidth > clientWidth
      // on the element itself, distinct from the document-level check above.
      if (h1.scrollWidth > h1.clientWidth + 1 && style.overflow === 'hidden') {
        h1Tronque = true
      }
    }

    const debordements: string[] = []
    const tousLesElements = document.querySelectorAll<HTMLElement>('*')
    for (const element of Array.from(tousLesElements)) {
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      // Same closed-drawer exemption as the target-size pass: an `sr-only`
      // skip link clips to 1×1 px with `overflow: hidden` by construction, and
      // is not a truncation the zoom lost — it is unfocused and never shown.
      const invisible = rect.width < 2 || rect.height < 2 || style.display === 'none' || style.visibility === 'hidden'
      if (invisible) continue
      if (style.overflow === 'hidden' && element.scrollWidth > element.clientWidth + 1) {
        let selecteur = element.tagName.toLowerCase()
        if (element.id !== '') selecteur += `#${element.id}`
        debordements.push(selecteur)
      }
    }

    return { defilement, h1Tronque, h1Absent, debordements: debordements.slice(0, 5) }
  })
}

async function main(argv: readonly string[]): Promise<number> {
  const rang = argv.indexOf('--racine-web')
  const racineWeb = resolve(RACINE, rang >= 0 ? (argv[rang + 1] ?? 'web') : 'web')
  const racineOut = join(racineWeb, 'out')

  if (!existsSync(racineOut)) {
    console.error('ÉCHEC : web/out est absent — lancer `npm run web:build` d’abord.')
    return 1
  }

  const port = await portLibre()
  const serveur = servir(racineOut, port)

  const executable = join(
    process.env.LOCALAPPDATA ?? '',
    'ms-playwright',
    'chromium-1223',
    'chrome-win64',
    'chrome.exe',
  )
  let navigateur: Browser | undefined
  const echecs: Echec[] = []
  // width -> route -> nombre d'échecs, pour le tableau imprimé en sortie.
  const matrice = new Map<number, Map<string, number>>()

  try {
    navigateur = await chromium.launch({ executablePath: executable })

    for (const largeur of LARGEURS) {
      const parRoute = new Map<string, number>()
      matrice.set(largeur, parRoute)
      const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } })

      for (const route of ROUTES) {
        const avant = echecs.length
        await page.goto(`http://127.0.0.1:${port}/${route.chemin}`, { waitUntil: 'domcontentloaded' })
        await attendreChargement(page)

        if (await mesurerDefilement(page)) {
          echecs.push({
            type: 'defilement-horizontal',
            largeur,
            route: route.nom,
            detail: 'documentElement.scrollWidth dépasse clientWidth de plus de 1 px',
          })
        }

        for (const cible of await mesurerCibles(page)) {
          echecs.push({
            type: 'cible-trop-petite',
            largeur,
            route: route.nom,
            detail:
              `${cible.selecteur} « ${cible.texte} » mesure ${cible.largeur}×${cible.hauteur} px, ` +
              `plancher ${cible.plancher} px`,
          })
        }

        if (largeur <= SEUIL_MOBILE) {
          for (const champ of await mesurerPolicesChamps(page)) {
            echecs.push({
              type: 'police-champ-mobile',
              largeur,
              route: route.nom,
              detail: `${champ.selecteur} a une police de ${champ.taille} px, plancher ${POLICE_MIN_MOBILE} px`,
            })
          }
        }

        if (largeur === 1440) {
          await page.setViewportSize({ width: 720, height: 450 })
          const zoom = await mesurerZoom(page)
          if (zoom.defilement) {
            echecs.push({
              type: 'perte-au-zoom',
              largeur,
              route: route.nom,
              detail: 'défilement horizontal apparu au zoom simulé (720 px de large)',
            })
          }
          if (zoom.h1Absent) {
            echecs.push({
              type: 'perte-au-zoom',
              largeur,
              route: route.nom,
              detail: 'aucun h1 trouvé au zoom simulé',
            })
          } else if (zoom.h1Tronque) {
            echecs.push({
              type: 'perte-au-zoom',
              largeur,
              route: route.nom,
              detail: 'le h1 est tronqué ou hors flux au zoom simulé',
            })
          }
          if (zoom.debordements.length > 0) {
            echecs.push({
              type: 'perte-au-zoom',
              largeur,
              route: route.nom,
              detail: `overflow hidden avec contenu débordant au zoom simulé : ${zoom.debordements.join(', ')}`,
            })
          }
          // Revert so the next route in this width loop measures the intended viewport.
          await page.setViewportSize({ width: largeur, height: 900 })
        }

        parRoute.set(route.nom, echecs.length - avant)
      }

      await page.close()
    }
  } finally {
    await navigateur?.close()
    await new Promise<void>((resoudre) => serveur.close(() => resoudre()))
  }

  console.log('Largeur × route — nombre d’écarts :\n')
  const enTete = ['largeur', ...ROUTES.map((route) => route.nom)]
  console.log(enTete.join('\t'))
  for (const largeur of LARGEURS) {
    const parRoute = matrice.get(largeur)
    const ligne = [String(largeur)]
    for (const route of ROUTES) {
      ligne.push(String(parRoute?.get(route.nom) ?? 0))
    }
    console.log(ligne.join('\t'))
  }

  if (echecs.length > 0) {
    console.log('\nÉcarts, groupés par type :')
    for (const type of ['defilement-horizontal', 'cible-trop-petite', 'police-champ-mobile', 'perte-au-zoom'] as const) {
      const duType = echecs.filter((echec) => echec.type === type)
      if (duType.length === 0) continue
      console.log(`\n${type} (${duType.length}) :`)
      for (const echec of duType) {
        console.log(`  - ${echec.route} @ ${echec.largeur} px — ${echec.detail}`)
      }
    }
  }

  console.log(
    '\nPortée : six largeurs (320, 375, 768, 1024, 1440, 1920), six routes, ' +
      'un seul navigateur (Chromium) et un seul thème (jour, le défaut).',
  )
  console.log('Limite : aucun état d’interaction mesuré — un tiroir fermé n’est pas mesuré.')

  if (echecs.length > 0) {
    console.error(`\nÉCHEC — ${echecs.length} écarts de cible ou de largeur.`)
    return 1
  }

  console.log(
    '\nOK — 6 largeurs et 6 routes, cibles au moins 44 px, aucun défilement horizontal, zoom 200 % sans perte.',
  )
  return 0
}

process.exit(await main(process.argv))
