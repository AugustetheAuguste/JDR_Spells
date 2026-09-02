/**
 * Closes the Skill's "point non résolu" on `RAMPE_CATEGORIELLE` under
 * `COULEURS_NUIT.base` with numbers, not eyeballing.
 *
 * `luminance`/`contraste`/`teinte`/`ecartTeinte` are redefined here rather than
 * imported from `tokens.test.ts` — that file belongs to the parallel step that
 * owns `tokens.ts`/`theme.css`/`tokens.test.ts`, and none of the four helpers
 * are exported from it. Duplication acknowledged, to be resorbed once that step
 * lands and can export them (`05_RAMPE_NUIT.md` § Contexte hérité).
 */

import { describe, expect, it } from 'vitest'

import { COULEURS_NUIT, RAMPE_CATEGORIELLE } from '@/lib/design/tokens'
import { RAMPE_CATEGORIELLE_NUIT, couleurCategorie, rampe } from '@/lib/design/rampe'

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

/** Hue in degrees. */
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
  return (((h * 60) % 360) + 360) % 360
}

function ecartTeinte(a: number, b: number): number {
  const brut = Math.abs(a - b)
  return Math.min(brut, 360 - brut)
}

describe('la rampe nuit tient sur son fond', () => {
  it.each(RAMPE_CATEGORIELLE_NUIT)('%s clear 3:1 sur COULEURS_NUIT.base', (pas) => {
    expect(contraste(pas, COULEURS_NUIT.base)).toBeGreaterThanOrEqual(3)
  })
})

describe('les huit teintes nuit restent distinguables', () => {
  it('chaque paire est écartée d’au moins 25°', () => {
    for (const [rang, gauche] of RAMPE_CATEGORIELLE_NUIT.entries()) {
      for (const droite of RAMPE_CATEGORIELLE_NUIT.slice(rang + 1)) {
        expect(
          ecartTeinte(teinte(gauche), teinte(droite)),
          `${gauche} et ${droite} sont trop proches`,
        ).toBeGreaterThanOrEqual(25)
      }
    }
  })
})

describe('les deux rampes se correspondent', () => {
  it('ont la même longueur, 8', () => {
    expect(RAMPE_CATEGORIELLE).toHaveLength(8)
    expect(RAMPE_CATEGORIELLE_NUIT).toHaveLength(8)
  })

  it('gardent la même famille de teinte à chaque rang', () => {
    // "Petit" (§ Pseudo-code) is bounded here by the pastilles' own same-hue
    // floor: two of the eight ranks were nudged to hold the ramp's own
    // pairwise 25° floor, and even those stay under 6°.
    for (const [rang, jour] of RAMPE_CATEGORIELLE.entries()) {
      const nuit = RAMPE_CATEGORIELLE_NUIT[rang]
      expect(nuit).toBeDefined()
      expect(
        ecartTeinte(teinte(jour), teinte(nuit as string)),
        `rang ${rang} a changé de famille de teinte`,
      ).toBeLessThan(6)
    }
  })
})

describe('couleurCategorie cycle modulo 8', () => {
  it.each(['jour', 'nuit'] as const)('dans le thème %s', (theme) => {
    expect(couleurCategorie(0, theme)).toBe(couleurCategorie(8, theme))
    expect(couleurCategorie(9, theme)).toBe(couleurCategorie(1, theme))
    expect(couleurCategorie(1, theme)).not.toBe(couleurCategorie(0, theme))
  })

  it.each(['jour', 'nuit'] as const)('couvre les huit rangs sans répétition évitable dans %s', (theme) => {
    const pas = rampe(theme)
    for (let rang = 0; rang < 8; rang += 1) {
      expect(couleurCategorie(rang, theme)).toBe(pas[rang])
    }
  })
})

describe('la rampe jour est inchangée', () => {
  it('rampe(\'jour\') est RAMPE_CATEGORIELLE, référence comprise', () => {
    expect(rampe('jour')).toBe(RAMPE_CATEGORIELLE)
  })

  it('n’a pas été « harmonisée » silencieusement avec la nuit', () => {
    expect(rampe('jour')).toEqual([
      '#1F6F8B',
      '#A8501C',
      '#8C6E1E',
      '#6B7A1E',
      '#8A3A8C',
      '#7A3E9E',
      '#4A4E8C',
      '#B03060',
    ])
  })
})
