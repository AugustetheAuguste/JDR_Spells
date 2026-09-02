/**
 * Run axe-core over the built HTML of the routes that matter.
 *
 * This checks the *prerendered* markup, in jsdom, with no client JavaScript. That
 * is a deliberate limit and worth stating: it cannot see a violation that only
 * appears after hydration — an `aria-expanded` that never flips, a focus trap in
 * the import dialog. What it does see is the document every visitor receives
 * first, including the one whose JavaScript never arrives, and that is the
 * document where a missing form label or an unreachable heading level is worst.
 *
 * Only violations of `wcag2a` / `wcag2aa` fail the run. `best-practice` rules are
 * printed and not enforced: they are advice, and a rule that blocks a merge on
 * advice teaches people to disable the check.
 *
 * Usage: tsx scripts/verifier_a11y.ts [--racine-web web]
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import axe, { type AxeResults, type Result } from 'axe-core'
import { JSDOM, VirtualConsole } from 'jsdom'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** One route per distinct rendering path: the filter panel and results table, one
 * spell sheet, the class comparison. Favourites is there because its prerender must
 * not claim a state it cannot know, and exploration because its charts are the only
 * place on the site where a control is drawn rather than written — a wedge that is
 * not a real button is exactly what axe should catch. */
const ROUTES: readonly { readonly nom: string; readonly chemin: string }[] = [
  { nom: 'navigation', chemin: 'index.html' },
  { nom: 'fiche', chemin: 'sorts/detection-de-la-magie/index.html' },
  { nom: 'comparaison', chemin: 'comparaison/index.html' },
  { nom: 'favoris', chemin: 'favoris/index.html' },
  { nom: 'exploration', chemin: 'explorer/index.html' },
  { nom: 'compte', chemin: 'compte/index.html' },
]

const NIVEAUX = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const

function decrire(violation: Result): string {
  const cibles = violation.nodes
    .slice(0, 3)
    .map((noeud) => noeud.target.join(' '))
    .join(' | ')
  const cache = violation.nodes.length - Math.min(3, violation.nodes.length)
  const suite = cache > 0 ? ` … et ${cache} autre(s) nœud(s)` : ''
  return `${violation.id} [${violation.impact ?? 'sans impact déclaré'}] ` +
    `${violation.help} — ${cibles}${suite}`
}

async function analyser(html: string): Promise<AxeResults> {
  // The prerendered markup references chunks that are not being served here, and
  // jsdom would log a resource-load failure per script. Silencing that keeps the
  // real findings visible.
  const consoleVirtuelle = new VirtualConsole()
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: consoleVirtuelle,
  })
  const { window } = dom
  try {
    // axe-core reads globals off the window it is injected into.
    const fenetre = window as unknown as { axe?: typeof axe }
    ;(window as unknown as Record<string, unknown>).axe = axe
    const source = readFileSync(
      resolve(RACINE, 'node_modules/axe-core/axe.min.js'),
      'utf8',
    )
    window.eval(source)
    const moteur = fenetre.axe
    if (moteur === undefined) throw new Error('axe-core ne s’est pas installé dans le DOM')
    return await moteur.run(window.document, {
      // `region` wants every node inside a landmark; the exported fragments are
      // full documents, so this is a real rule and stays on. Nothing is disabled.
      resultTypes: ['violations'],
    })
  } finally {
    window.close()
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const rang = argv.indexOf('--racine-web')
  const racineWeb = resolve(RACINE, rang >= 0 ? (argv[rang + 1] ?? 'web') : 'web')
  const racineOut = join(racineWeb, 'out')

  if (!existsSync(racineOut)) {
    console.error('ÉCHEC : web/out est absent — lancer `npm run web:build` d’abord.')
    return 1
  }

  const echecs: string[] = []
  let conseils = 0

  for (const route of ROUTES) {
    const chemin = join(racineOut, route.chemin)
    if (!existsSync(chemin)) {
      echecs.push(`route absente de la sortie : ${route.chemin}`)
      continue
    }
    const resultats = await analyser(readFileSync(chemin, 'utf8'))
    const bloquantes = resultats.violations.filter((violation) =>
      violation.tags.some((tag) => (NIVEAUX as readonly string[]).includes(tag)),
    )
    const avis = resultats.violations.filter(
      (violation) => !bloquantes.includes(violation),
    )
    conseils += avis.length

    const verdict = bloquantes.length === 0 ? 'OK' : `${bloquantes.length} violation(s)`
    console.log(
      `${route.nom.padEnd(12)}: ${verdict}` +
        (avis.length > 0 ? ` (+${avis.length} conseil(s) non bloquant(s))` : ''),
    )
    for (const violation of bloquantes) {
      echecs.push(`${route.nom} — ${decrire(violation)}`)
    }
    for (const violation of avis) {
      console.log(`  conseil : ${decrire(violation)}`)
    }
  }

  if (echecs.length > 0) {
    console.error(`\nÉCHEC — ${echecs.length} violation(s) WCAG A/AA :`)
    for (const message of echecs) console.error(`  - ${message}`)
    return 1
  }

  console.log(
    `\nOK — aucune violation WCAG A/AA sur ${ROUTES.length} routes` +
      (conseils > 0 ? `, ${conseils} conseil(s) signalé(s).` : '.') +
      '\nPortée : le HTML prérendu, sans JavaScript client — pas l’état après hydratation.',
  )
  return 0
}

process.exit(await main(process.argv))
