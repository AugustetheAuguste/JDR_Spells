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
const THEMES_JOUR_SEUL = ['jour'] as const
const THEMES_JOUR_ET_NUIT = ['jour', 'nuit'] as const

const ROUTES: readonly {
  readonly nom: string
  readonly chemin: string
  readonly themes: readonly ('jour' | 'nuit')[]
}[] = [
  { nom: 'navigation', chemin: 'index.html', themes: THEMES_JOUR_SEUL },
  // 13_UI_DONS_LIST : la navigation à facettes des 1417 dons — vérifiée dans
  // les deux thèmes, comme la fiche d'un don, pour la même raison : le mode
  // sombre est un mode de première classe, pas un après-coup.
  { nom: 'dons', chemin: 'dons/index.html', themes: THEMES_JOUR_ET_NUIT },
  { nom: 'fiche', chemin: 'sorts/detection-de-la-magie/index.html', themes: THEMES_JOUR_SEUL },
  { nom: 'comparaison', chemin: 'comparaison/index.html', themes: THEMES_JOUR_SEUL },
  { nom: 'favoris', chemin: 'favoris/index.html', themes: THEMES_JOUR_SEUL },
  { nom: 'exploration', chemin: 'explorer/index.html', themes: THEMES_JOUR_SEUL },
  { nom: 'compte', chemin: 'compte/index.html', themes: THEMES_JOUR_SEUL },
  // 11_UI_DONS_SHEET : la fiche d'un don, avec ses deux blocs de conditions
  // (source / curation) — le bloc en tirets et son étiquette textuelle sont
  // exactement le genre de distinction qu'axe peut valider sans couleur.
  // Vérifiée dans les deux thèmes : le mode sombre y est un mode de première
  // classe, pas un après-coup (`CLAUDE.md`).
  { nom: 'fiche-don', chemin: 'dons/vigilance/index.html', themes: THEMES_JOUR_ET_NUIT },
]

const NIVEAUX = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const

/** `data-theme="nuit"` is set on `<html>` by an inline script before paint
 * (`tokens.ts`'s night palette); jsdom never runs that script, so this mirrors
 * it by hand — the only way to axe-check the dark-mode markup this repository
 * actually ships, rather than only ever checking the light default. */
function appliquerTheme(document: Document, theme: 'jour' | 'nuit'): void {
  if (theme === 'nuit') document.documentElement.setAttribute('data-theme', 'nuit')
}

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

async function analyser(html: string, theme: 'jour' | 'nuit' = 'jour'): Promise<AxeResults> {
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
    appliquerTheme(window.document, theme)
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

  let nbRoutesTestees = 0

  for (const route of ROUTES) {
    const chemin = join(racineOut, route.chemin)
    if (!existsSync(chemin)) {
      echecs.push(`route absente de la sortie : ${route.chemin}`)
      continue
    }
    const html = readFileSync(chemin, 'utf8')

    for (const theme of route.themes) {
      nbRoutesTestees += 1
      const nomAffiche = route.themes.length > 1 ? `${route.nom} (${theme})` : route.nom
      const resultats = await analyser(html, theme)
      const bloquantes = resultats.violations.filter((violation) =>
        violation.tags.some((tag) => (NIVEAUX as readonly string[]).includes(tag)),
      )
      const avis = resultats.violations.filter(
        (violation) => !bloquantes.includes(violation),
      )
      conseils += avis.length

      const verdict = bloquantes.length === 0 ? 'OK' : `${bloquantes.length} violation(s)`
      console.log(
        `${nomAffiche.padEnd(18)}: ${verdict}` +
          (avis.length > 0 ? ` (+${avis.length} conseil(s) non bloquant(s))` : ''),
      )
      for (const violation of bloquantes) {
        echecs.push(`${nomAffiche} — ${decrire(violation)}`)
      }
      for (const violation of avis) {
        console.log(`  conseil : ${decrire(violation)}`)
      }
    }
  }

  if (echecs.length > 0) {
    console.error(`\nÉCHEC — ${echecs.length} violation(s) WCAG A/AA :`)
    for (const message of echecs) console.error(`  - ${message}`)
    return 1
  }

  console.log(
    `\nOK — aucune violation WCAG A/AA sur ${nbRoutesTestees} route(s)×thème(s)` +
      (conseils > 0 ? `, ${conseils} conseil(s) signalé(s).` : '.') +
      '\nPortée : le HTML prérendu, sans JavaScript client — pas l’état après hydratation.',
  )
  return 0
}

process.exit(await main(process.argv))
