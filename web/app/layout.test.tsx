import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `app/layout.tsx` renders `<html>`/`<body>` itself, which is not something
 * React Testing Library can mount without doubling those tags inside the jsdom
 * document it already owns. The source of truth for this shell is therefore
 * read as text, the same way the brief's own verification criteria do (`grep
 * -n "pathfinder-fr.org" web/app/layout.tsx`, `grep -nE "Provider|Fournisseur"
 * …`) — these assertions are exactly those greps, kept in the suite so a
 * regression fails `npm --prefix web run test` instead of waiting for a human
 * to rerun a grep by hand.
 */
const CHEMIN_LAYOUT = join(process.cwd(), 'app', 'layout.tsx')
const SOURCE = readFileSync(CHEMIN_LAYOUT, 'utf-8')

describe('app/layout.tsx', () => {
  it('garde le lien vers pathfinder-fr.org dans le pied de page', () => {
    const piedDePage = SOURCE.slice(SOURCE.indexOf('<footer'), SOURCE.indexOf('</footer>'))
    expect(piedDePage).toContain('https://www.pathfinder-fr.org/')
    // Un engagement de CLAUDE.md §11, pas une décoration : le pied maigrit,
    // le lien reste.
    expect(piedDePage).toContain('pathfinder-fr.org')
  })

  it('tient le pied de page en une phrase plus le lien', () => {
    const piedDePage = SOURCE.slice(SOURCE.indexOf('<footer'), SOURCE.indexOf('</footer>'))
    // Le texte visible du paragraphe, hors lien, ne doit porter qu'un seul
    // point final : une phrase, pas deux.
    const texteVisible = piedDePage
      .replace(/<a[\s\S]*?<\/a>/, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const pointsFinaux = texteVisible.match(/\./g) ?? []
    expect(pointsFinaux.length).toBeLessThanOrEqual(1)
  })

  it("n'a plus la phrase de provenance retirée", () => {
    const piedDePage = SOURCE.slice(SOURCE.indexOf('<footer'), SOURCE.indexOf('</footer>'))
    expect(piedDePage).not.toContain('index de consultation')
  })

  it('ne recompose pas les providers hors de Fournisseurs', () => {
    // La règle la plus coûteuse à enfreindre du §11 : un provider oublié ne
    // casse rien visiblement. Ce test grep le CODE (commentaires retirés)
    // pour tout nom de Provider ou de Fournisseur, hors l'import et l'usage
    // de `Fournisseurs`.
    const sansCommentaires = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const lignesSuspectes = sansCommentaires.split('\n').filter((ligne) => {
      if (!/Provider|Fournisseur/.test(ligne)) return false
      if (ligne.includes("from '@/components/Fournisseurs'")) return false
      if (/<\/?Fournisseurs(\s|>|$)/.test(ligne)) return false
      return true
    })
    expect(lignesSuspectes).toEqual([])
  })

  it('porte exactement les 5 liens de navigation attendus', () => {
    const nav = SOURCE.slice(SOURCE.indexOf('<nav'), SOURCE.indexOf('</nav>'))
    const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(['/', '/explorer', '/comparaison', '/favoris', '/compte'])
  })

  it('porte les liens de navigation, la mention de source et la bascule à 44 px', () => {
    const nav = SOURCE.slice(SOURCE.indexOf('<nav'), SOURCE.indexOf('</nav>'))
    const liensNav = [...nav.matchAll(/<Link[\s\S]*?<\/Link>/g)]
    expect(liensNav.length).toBe(5)
    for (const lien of liensNav) {
      expect(lien[0]).toContain('min-h-cible')
      expect(lien[0]).toContain('min-w-cible')
    }

    const enteteAvantFooter = SOURCE.slice(SOURCE.indexOf('<header'), SOURCE.indexOf('</header>'))
    // La mention de source et la bascule sont chacune dans un conteneur à
    // cible tactile, même si la bascule elle-même reste hors périmètre
    // (BasculeTheme.tsx appartient à l'étape 15).
    const apresNav = enteteAvantFooter.slice(enteteAvantFooter.indexOf('</nav>'))
    expect(apresNav).toContain('<BasculeTheme />')
    const occurrencesCible = apresNav.match(/min-h-cible/g) ?? []
    expect(occurrencesCible.length).toBeGreaterThanOrEqual(2)
  })

  it("n'écrit aucun deux-points, point-virgule ou tiret cadratin en prose", () => {
    // Charte typographique, pf-web-design-system : aucun signe interdit dans
    // une chaîne affichée. `MOTS.source` porte un deux-points figé dans
    // tokens.ts (hors périmètre) ; ce fichier ne le reprend plus tel quel.
    expect(SOURCE).not.toContain('{MOTS.source}')
    const enteteAvantFooter = SOURCE.slice(SOURCE.indexOf('<header'), SOURCE.indexOf('</header>'))
    expect(enteteAvantFooter).not.toMatch(/>\s*source\s*:/i)
  })

  it('garde le script de thème inline avant peinture, dans <head>', () => {
    const tete = SOURCE.slice(SOURCE.indexOf('<head>'), SOURCE.indexOf('</head>'))
    expect(tete).toContain('SCRIPT_THEME')
  })

  it('ne touche pas à lang="fr"', () => {
    expect(SOURCE).toContain('lang="fr"')
  })

  it('garde le lien d’évitement avec une cible tactile de 44 px', () => {
    const lienEvitement = SOURCE.slice(SOURCE.indexOf('href="#contenu"') - 20, SOURCE.indexOf('</a>'))
    expect(lienEvitement).toMatch(/focus:.*cible|min-h-cible/)
  })
})
