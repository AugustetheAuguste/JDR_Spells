/**
 * The design system's guarantees, as tests.
 *
 * Three of these are load-bearing rather than cosmetic:
 *
 *   - the AA contrast of the nine pastilles. It is *computed*, not eyeballed. A
 *     value lightened for taste breaks the floor, and this test is the only thing
 *     that would say so.
 *   - no hex outside this directory. The pastilles are only verifiable if there is
 *     one list to verify; a second copy elsewhere is a second thing to forget.
 *   - `styles/theme.css` agreeing with `tokens.ts`. Tailwind 4 is CSS-first and no
 *     longer reads a JS config, so the values exist twice by force. Silent drift
 *     would give components that pass their tests and look wrong in a browser.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  COULEURS,
  COULEURS_ECOLES,
  COULEURS_NUIT,
  DENSITE,
  ECHELLE,
  ECOLES,
  LIBELLES_ECOLES,
  MOUVEMENT,
  POLICES,
  RAMPE_CATEGORIELLE,
} from '@/lib/design/tokens'
import { couleurTranche } from '@/lib/design/rampe'

const RACINE_WEB = process.cwd()

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const canal = (paire: string): number => {
    const valeur = Number.parseInt(paire, 16) / 255
    return valeur <= 0.03928 ? valeur / 12.92 : ((valeur + 0.055) / 1.055) ** 2.4
  }
  const brut = hex.replace('#', '')
  const r = canal(brut.slice(0, 2))
  const g = canal(brut.slice(2, 4))
  const b = canal(brut.slice(4, 6))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Hue in degrees, for the accent-vs-school separation check. */
function teinte(hex: string): number {
  const brut = hex.replace('#', '')
  const r = Number.parseInt(brut.slice(0, 2), 16) / 255
  const g = Number.parseInt(brut.slice(2, 4), 16) / 255
  const b = Number.parseInt(brut.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const delta = max - min
  let h: number
  if (max === r) h = ((g - b) / delta) % 6
  else if (max === g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4
  return ((h * 60) % 360 + 360) % 360
}

function ecartTeinte(a: number, b: number): number {
  const brut = Math.abs(a - b)
  return Math.min(brut, 360 - brut)
}

describe('contraste des pastilles d’école', () => {
  it('les neuf écoles ont un jeton de couleur et un libellé', () => {
    // Nine, not the eight the plan announced: `normaliser_ecole` also returns
    // `universel`. Eight tokens would leave a universal spell with no pastille.
    expect(ECOLES).toHaveLength(9)
    for (const ecole of ECOLES) {
      expect(COULEURS_ECOLES[ecole]).toMatch(/^#[0-9A-F]{6}$/)
      expect(LIBELLES_ECOLES[ecole].length).toBeGreaterThan(0)
    }
  })

  it.each(ECOLES)('%s passe AA sur la base', (ecole) => {
    expect(contraste(COULEURS_ECOLES[ecole], COULEURS.base)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(ECOLES)('%s porte du texte blanc au niveau AA', (ecole) => {
    // The pastille is a flat fill with white text on it, so this is the contrast
    // that is actually read — not the one against the page background.
    expect(contraste(COULEURS_ECOLES[ecole], COULEURS.surface)).toBeGreaterThanOrEqual(4.5)
  })

  it('respecte le plancher annoncé par le Skill (4,53:1)', () => {
    // transmutation is the floor, measured at 4.5359:1 against the Grimoire
    // parchment `base` (`#F1E7D2`, luminance 0.805) — darker than v1's near-white
    // `#FAFAF9` (0.94), which is why the floor moved down from the old 5.13:1.
    // The Skill announces 4,53:1 rather than 4,54:1 for the same reason as
    // before — a rounded-up figure makes the guard fail against the very value
    // it describes.
    const plancher = Math.min(
      ...ECOLES.map((ecole) => contraste(COULEURS_ECOLES[ecole], COULEURS.base)),
    )
    expect(plancher).toBeGreaterThanOrEqual(4.53)
  })

  it('les neuf teintes sont distinguables deux à deux', () => {
    // Two pastilles at the same hue are one pastille as far as the reader is
    // concerned. 6° is the floor, and it is why the label is never optional.
    const teintes = ECOLES.map((ecole) => ({
      ecole,
      valeur: teinte(COULEURS_ECOLES[ecole]),
    }))
    for (const [rang, gauche] of teintes.entries()) {
      for (const droite of teintes.slice(rang + 1)) {
        expect(
          ecartTeinte(gauche.valeur, droite.valeur),
          `${gauche.ecole} et ${droite.ecole} sont à la même teinte`,
        ).toBeGreaterThan(6)
      }
    }
  })
})

describe('la rampe des tranches', () => {
  it('a huit teintes distinguables deux à deux', () => {
    // Categorical, by explicit human decision (2026-08-27): a chart's slices no
    // longer read as one hue walked down in lightness. Same floor as the school
    // pastilles' own pairwise check, applied here to the ramp's own steps.
    for (const [rang, gauche] of RAMPE_CATEGORIELLE.entries()) {
      for (const droite of RAMPE_CATEGORIELLE.slice(rang + 1)) {
        expect(
          ecartTeinte(teinte(gauche), teinte(droite)),
          `${gauche} et ${droite} sont à la même teinte`,
        ).toBeGreaterThan(6)
      }
    }
  })

  it('chaque pas se détache de la base comme un élément d’interface', () => {
    // 3:1, the floor for a graphical object, and not the 4,5:1 of the pastilles:
    // nothing is written *on* a wedge. The count and the label sit beside it, in
    // ink on the panel, because the colour is never the carrier (Skill, plancher
    // d'accessibilité).
    for (const pas of RAMPE_CATEGORIELLE) {
      expect(contraste(pas, COULEURS.base)).toBeGreaterThanOrEqual(3)
    }
  })

  it('cycle proprement au-delà de huit tranches', () => {
    // Beyond eight slices the ramp repeats rather than inventing a colour, so
    // rang 8 must be rang 0's own step.
    for (const total of [9, 14, 20]) {
      for (let rang = 0; rang < total; rang += 1) {
        expect(couleurTranche(rang, total)).toBe(
          RAMPE_CATEGORIELLE[rang % RAMPE_CATEGORIELLE.length],
        )
      }
    }
  })
})

describe('contraste du texte et de l’accent', () => {
  it.each([
    ['encre', COULEURS.encre, 4.5],
    ['encreDouce', COULEURS.encreDouce, 4.5],
    ['encreFaible', COULEURS.encreFaible, 4.5],
    ['accent', COULEURS.accent, 4.5],
    ['desaccord', COULEURS.desaccord, 4.5],
  ])('%s passe AA sur la base', (_nom, valeur, seuil) => {
    expect(contraste(valeur, COULEURS.base)).toBeGreaterThanOrEqual(seuil)
  })

  it('du blanc passe AA sur l’accent — un bouton primaire en dépend', () => {
    expect(contraste(COULEURS.surface, COULEURS.accent)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(COULEURS.surface, COULEURS.accentSurvol)).toBeGreaterThanOrEqual(4.5)
  })

  it('le désaccord passe AA sur son propre voile', () => {
    expect(
      contraste(COULEURS.desaccord, COULEURS.desaccordVoile),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('l’accent survolé est plus sombre, jamais plus clair', () => {
    expect(luminance(COULEURS.accentSurvol)).toBeLessThan(luminance(COULEURS.accent))
  })

  it('bordFort tient le plancher 3:1 d’un contour de contrôle (WCAG 1.4.11)', () => {
    // Not the 4.5:1 text floor: a field or panel border is a UI boundary, not
    // text, and 3:1 is the correct threshold. `#C9C6C0` measured 1.63:1 here
    // undetected until this test existed.
    expect(contraste(COULEURS.bordFort, COULEURS.base)).toBeGreaterThanOrEqual(3)
    expect(contraste(COULEURS.bordFort, COULEURS.surface)).toBeGreaterThanOrEqual(3)
  })

  it('l’accent est à plus de 20° de toute teinte d’école', () => {
    // The whole reason `#116B4F` was chosen. Any closer and the reader sees a
    // school where the interface means "active".
    const teinteAccent = teinte(COULEURS.accent)
    for (const ecole of ECOLES) {
      expect(
        ecartTeinte(teinteAccent, teinte(COULEURS_ECOLES[ecole])),
        `l’accent se confond avec ${ecole}`,
      ).toBeGreaterThan(20)
    }
  })
})

describe('palette nuit — permutation plate, elle aussi vérifiée par calcul', () => {
  it.each([
    ['encre', COULEURS_NUIT.encre],
    ['encreDouce', COULEURS_NUIT.encreDouce],
    ['encreFaible', COULEURS_NUIT.encreFaible],
    ['accent', COULEURS_NUIT.accent],
    ['desaccord', COULEURS_NUIT.desaccord],
  ])('%s passe AA sur la base nuit', (_nom, valeur) => {
    expect(contraste(valeur, COULEURS_NUIT.base)).toBeGreaterThanOrEqual(4.5)
  })

  it('bordFort nuit tient le plancher 3:1 d’un contour de contrôle', () => {
    expect(contraste(COULEURS_NUIT.bordFort, COULEURS_NUIT.base)).toBeGreaterThanOrEqual(3)
    expect(contraste(COULEURS_NUIT.bordFort, COULEURS_NUIT.surface)).toBeGreaterThanOrEqual(3)
  })

  it('le désaccord nuit passe AA sur son propre voile', () => {
    expect(
      contraste(COULEURS_NUIT.desaccord, COULEURS_NUIT.desaccordVoile),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('l’accent nuit est plus clair que l’accent jour, jamais plus sombre', () => {
    // On a dark ground "further from the background" means lighter, the
    // opposite direction from the day palette's accentSurvol rule.
    expect(luminance(COULEURS_NUIT.accentSurvol)).toBeGreaterThan(luminance(COULEURS_NUIT.accent))
  })

  it('l’encre nuit reste lisible sur la base nuit avec une marge large', () => {
    // Not a floor check — a sanity check that the swap kept the darkest tone
    // for the page background and the lightest for text, not the reverse.
    expect(contraste(COULEURS_NUIT.encre, COULEURS_NUIT.base)).toBeGreaterThan(10)
  })
})

describe('aucun hexadécimal hors de tokens.ts', () => {
  function fichiersSources(depuis: string): string[] {
    const ignores = new Set(['node_modules', '.next', 'public', 'fixtures', 'out'])
    const trouves: string[] = []
    for (const entree of readdirSync(depuis)) {
      if (ignores.has(entree)) continue
      const chemin = join(depuis, entree)
      if (statSync(chemin).isDirectory()) {
        trouves.push(...fichiersSources(chemin))
      } else if (/\.(ts|tsx|css)$/.test(entree)) {
        trouves.push(chemin)
      }
    }
    return trouves
  }

  it('un hex n’apparaît que dans tokens.ts et theme.css', () => {
    // theme.css is the forced exception: Tailwind 4 needs the values as CSS
    // custom properties, and the agreement test below pins it to tokens.ts.
    const autorises = new Set([
      join(RACINE_WEB, 'lib', 'design', 'tokens.ts'),
      join(RACINE_WEB, 'lib', 'design', 'tokens.test.ts'),
      join(RACINE_WEB, 'styles', 'theme.css'),
    ])
    const fautifs: string[] = []
    for (const chemin of fichiersSources(RACINE_WEB)) {
      if (autorises.has(chemin)) continue
      const texte = readFileSync(chemin, 'utf8')
      for (const [numero, ligne] of texte.split('\n').entries()) {
        if (/#[0-9a-fA-F]{3,8}\b/.test(ligne)) {
          fautifs.push(`${chemin}:${numero + 1} ${ligne.trim()}`)
        }
      }
    }
    expect(fautifs).toEqual([])
  })
})

describe('theme.css ne dérive pas de tokens.ts', () => {
  const css = readFileSync(join(RACINE_WEB, 'styles', 'theme.css'), 'utf8')

  function propriete(nom: string): string | null {
    const trouve = new RegExp(`--${nom}:\\s*([^;]+);`).exec(css)
    return trouve?.[1]?.trim() ?? null
  }

  it.each(ECOLES)('--color-ecole-%s vaut le jeton', (ecole) => {
    expect(propriete(`color-ecole-${ecole}`)?.toUpperCase()).toBe(
      COULEURS_ECOLES[ecole].toUpperCase(),
    )
  })

  it.each([
    ['color-base', COULEURS.base],
    ['color-surface', COULEURS.surface],
    ['color-bord', COULEURS.bord],
    ['color-bord-fort', COULEURS.bordFort],
    ['color-encre', COULEURS.encre],
    ['color-encre-douce', COULEURS.encreDouce],
    ['color-encre-faible', COULEURS.encreFaible],
    ['color-survol', COULEURS.survol],
    ['color-accent', COULEURS.accent],
    ['color-accent-survol', COULEURS.accentSurvol],
    ['color-accent-voile', COULEURS.accentVoile],
    ['color-desaccord', COULEURS.desaccord],
    ['color-desaccord-voile', COULEURS.desaccordVoile],
  ])('--%s vaut le jeton', (nom, attendu) => {
    expect(propriete(nom)?.toUpperCase()).toBe(attendu.toUpperCase())
  })

  it.each([
    ['font-affichage', POLICES.affichage],
    ['font-corps', POLICES.corps],
    ['font-donnees', POLICES.donnees],
  ])('--%s vaut le jeton', (nom, attendu) => {
    // Quote style differs between a TS string and CSS, so compare normalised.
    const normaliser = (valeur: string): string => valeur.replaceAll('"', "'").replace(/\s+/g, ' ')
    expect(normaliser(propriete(nom) ?? '')).toBe(normaliser(attendu))
  })

  it.each(Object.entries(ECHELLE))('--text-%s vaut le jeton', (nom, cran) => {
    expect(propriete(`text-${nom}`)).toBe(cran.taille)
    expect(propriete(`text-${nom}--line-height`)).toBe(cran.interligne)
  })

  it('aucun cran de l’échelle ne porte le nom d’une couleur', () => {
    // Tailwind builds ONE `text-<nom>` utility from both `--color-<nom>` and
    // `--text-<nom>`, and the colour wins. When the scale held a `base` cran next
    // to the `base` colour, `text-base` painted body text in the page background:
    // invisible cells on a white surface, and nothing in the suite could see it
    // because every assertion here was about a token, not about a utility class.
    const couleurs = new Set(Object.keys(COULEURS).map((nom) => nom.toLowerCase()))
    for (const nom of Object.keys(ECHELLE)) {
      expect(couleurs.has(nom.toLowerCase()), `text-${nom} est ambigu`).toBe(false)
    }
  })

  it('la hauteur de ligne dense vaut le jeton', () => {
    expect(propriete('spacing-ligne')).toBe(DENSITE.ligneHauteur)
    expect(propriete('spacing-ligne-dense')).toBe(DENSITE.ligneHauteurDense)
    expect(propriete('radius-jeton')).toBe(DENSITE.rayon)
    expect(propriete('radius-panneau')).toBe(DENSITE.rayonPanneau)
  })

  describe('le bloc [data-theme="nuit"]', () => {
    const blocNuit = /\[data-theme=['"]nuit['"]\]\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''

    function proprieteNuit(nom: string): string | null {
      const trouve = new RegExp(`--${nom}:\\s*([^;]+);`).exec(blocNuit)
      return trouve?.[1]?.trim() ?? null
    }

    it.each([
      ['color-base', COULEURS_NUIT.base],
      ['color-surface', COULEURS_NUIT.surface],
      ['color-bord', COULEURS_NUIT.bord],
      ['color-bord-fort', COULEURS_NUIT.bordFort],
      ['color-encre', COULEURS_NUIT.encre],
      ['color-encre-douce', COULEURS_NUIT.encreDouce],
      ['color-encre-faible', COULEURS_NUIT.encreFaible],
      ['color-survol', COULEURS_NUIT.survol],
      ['color-accent', COULEURS_NUIT.accent],
      ['color-accent-survol', COULEURS_NUIT.accentSurvol],
      ['color-accent-voile', COULEURS_NUIT.accentVoile],
      ['color-desaccord', COULEURS_NUIT.desaccord],
      ['color-desaccord-voile', COULEURS_NUIT.desaccordVoile],
    ])('--%s vaut le jeton nuit', (nom, attendu) => {
      expect(proprieteNuit(nom)?.toUpperCase()).toBe(attendu.toUpperCase())
    })
  })
})

describe('les contraintes du brief sont tenues dans le CSS', () => {
  const css = readFileSync(join(RACINE_WEB, 'styles', 'theme.css'), 'utf8')
  /** Declarations only. The comments in this file discuss `outline: none` in
   * order to forbid it, and a guard that greps the prose it is written in
   * accuses the very sentence that states the rule. */
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('aucun dégradé', () => {
    expect(css).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/)
  })

  it('le focus clavier est défini et jamais supprimé', () => {
    expect(declarations).toMatch(/:focus-visible/)
    expect(declarations).toMatch(/outline:\s*2px solid var\(--color-accent\)/)
    expect(declarations).not.toMatch(/outline:\s*(none|0)/)
  })

  it('prefers-reduced-motion annule effectivement les transitions', () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/)
    const bloc = /prefers-reduced-motion:\s*reduce\s*\)\s*\{([\s\S]*?)\n {2}\}/.exec(css)
    expect(bloc?.[1]).toMatch(/transition-duration:\s*0s/)
    expect(bloc?.[1]).toMatch(/animation-duration:\s*0s/)
  })

  it('les polices sont servies depuis le dépôt et les fichiers existent', () => {
    // A `@font-face` pointing at a file that is not committed fails silently: the
    // browser falls back and the page merely looks slightly wrong. And a CDN URL
    // here would break the promise that the site is a pure function of the repo.
    const sources = [...declarations.matchAll(/src:\s*url\('([^']+)'\)/g)].map((t) => t[1])
    expect(sources.length).toBeGreaterThanOrEqual(4)
    for (const source of sources) {
      expect(source).toMatch(/^\/fonts\/[\w.-]+\.woff2$/)
      const octets = readFileSync(join(RACINE_WEB, 'public', source ?? ''))
      // 'wOF2' — the magic number. A 404 page saved under a .woff2 name would
      // otherwise pass an existence check.
      expect(octets.subarray(0, 4).toString('latin1')).toBe('wOF2')
    }
    expect(declarations).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|https?:/)
    // `block` would show a blank where a spell name should be.
    expect(declarations.match(/font-display:\s*swap/g)?.length).toBe(sources.length)
  })

  it('la densité annoncée tient dans la hauteur d’un portable', () => {
    // 40 rows is the stated target; the row height is what delivers it. If either
    // moves, the pair must still be consistent.
    const hauteur = Number.parseInt(DENSITE.ligneHauteur, 10)
    expect(hauteur * DENSITE.lignesVisiblesCible).toBeLessThanOrEqual(1400)
    expect(hauteur).toBeGreaterThanOrEqual(28)
  })

  it('la transition est courte, et la nuit ne suit pas la préférence système', () => {
    expect(Number.parseInt(MOUVEMENT.duree, 10)).toBeLessThanOrEqual(200)
    // Night mode is an explicit, persisted choice (a toggle + localStorage,
    // applied via `data-theme` before paint) — not `prefers-color-scheme`. An
    // automatic switch would silently override whatever the reader picked last
    // time their OS theme changed underneath them.
    expect(css).not.toMatch(/prefers-color-scheme/)
    expect(css).toMatch(/\[data-theme=['"]nuit['"]\]/)
  })
})
