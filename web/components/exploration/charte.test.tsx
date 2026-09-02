/**
 * Two guards this step exists to add, neither expressible as a claim on the
 * screen alone.
 *
 * `text-base` is invisible to every other test: jsdom puts the class in the DOM
 * whichever colour Tailwind resolves it to, so the only guard left is a grep —
 * ugly, but it is what survives the piège (`11_EXPLORATION.md` § A).
 *
 * The theme guard renders the real components rather than asserting on
 * `couleurCategorie` in isolation (`rampe.test.ts` already does that): the point
 * of this step is that `Donut` and `Barres` actually call it with the live theme,
 * not that the function itself is correct.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Barres } from '@/components/exploration/Barres'
import { Donut } from '@/components/exploration/Donut'
import { RAMPE_CATEGORIELLE_NUIT } from '@/lib/design/rampe'
import { RAMPE_CATEGORIELLE } from '@/lib/design/tokens'
import type { Tranche } from '@/lib/exploration/axes'

const ICI = dirname(fileURLToPath(import.meta.url))

describe('la classe text-base ne revient pas', () => {
  it('aucun fichier de web/components/exploration/ ne la porte', () => {
    const fautifs = readdirSync(ICI)
      .filter((nom) => (nom.endsWith('.tsx') || nom.endsWith('.ts')) && !nom.endsWith('.test.tsx'))
      .filter((nom) => /\btext-base\b/.test(readFileSync(join(ICI, nom), 'utf8')))
    expect(fautifs, `text-base retombé dans : ${fautifs.join(', ')}`).toEqual([])
  })
})

const TRANCHES: readonly Tranche[] = [
  { ecole: null, libelle: 'Première', libelleAccessible: 'Première, 3 sorts', nb: 3, valeur: 'a' },
  { ecole: null, libelle: 'Seconde', libelleAccessible: 'Seconde, 1 sort', nb: 1, valeur: 'b' },
]

afterEach(() => {
  delete document.documentElement.dataset.theme
})

describe('la rampe catégorielle suit le thème', () => {
  it('Donut colore ses parts avec la rampe jour par défaut', () => {
    render(<Donut legendeTotal="sorts" surChoix={() => {}} total={4} tranches={TRANCHES} />)
    const parts = document.querySelectorAll('svg path')
    expect(parts[0]?.getAttribute('fill')).toBe(RAMPE_CATEGORIELLE[0])
  })

  it('Donut colore ses parts avec la rampe nuit sous data-theme="nuit"', () => {
    document.documentElement.dataset.theme = 'nuit'
    render(<Donut legendeTotal="sorts" surChoix={() => {}} total={4} tranches={TRANCHES} />)
    const parts = document.querySelectorAll('svg path')
    expect(parts[0]?.getAttribute('fill')).toBe(RAMPE_CATEGORIELLE_NUIT[0])
  })

  it('Barres colore ses lignes avec la rampe nuit sous data-theme="nuit"', () => {
    document.documentElement.dataset.theme = 'nuit'
    render(<Barres surChoix={() => {}} total={4} tranches={TRANCHES} />)
    const premiereBarre = screen.getByRole('button', { name: /Première/ })
    const remplissage = premiereBarre.querySelector('[aria-hidden="true"]')
    expect(remplissage).not.toBeNull()
    expect((remplissage as HTMLElement).style.backgroundColor).toBe(
      hexVersRgb(RAMPE_CATEGORIELLE_NUIT[0] as string),
    )
  })
})

/** jsdom normalises an inline `background-color` to `rgb(...)`, never keeping the
 * hex literal — so the assertion above has to convert to compare like with like. */
function hexVersRgb(hex: string): string {
  const brut = hex.replace('#', '')
  const r = Number.parseInt(brut.slice(0, 2), 16)
  const g = Number.parseInt(brut.slice(2, 4), 16)
  const b = Number.parseInt(brut.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}
