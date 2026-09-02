/**
 * `PastilleCout` — the ordinal cost ramp, digit always in text.
 *
 * The ramp itself (monotone, 3:1 floor, both palettes) is validated by
 * `scripts/validate_palette.js --ordinal`, not re-derived here; this test
 * checks the two things a component test can see: the digit is always
 * literal text (never colour-only), and a `null` cost renders the corpus-gap
 * em dash rather than a guessed number.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PastilleCout } from './PastilleCout'

describe('PastilleCout', () => {
  it('affiche un tiret cadratin pour un coût non calculé, jamais un chiffre inventé', () => {
    render(<PastilleCout cout={null} />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it.each([1, 2, 3, 4, 5])('affiche le chiffre %d en texte, pas seulement par la couleur', (n) => {
    render(<PastilleCout cout={n} />)
    expect(screen.getByText(String(n))).toBeTruthy()
  })

  it('le chiffre distingue chaque coût indépendamment du remplissage', () => {
    const rendus = [1, 2, 3, 4, 5].map((n) => {
      const { unmount, container } = render(<PastilleCout cout={n} />)
      const texte = container.textContent
      unmount()
      return texte
    })
    expect(new Set(rendus).size).toBe(5)
  })
})
