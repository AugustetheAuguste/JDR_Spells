/**
 * `MarqueurStatut` — the three eligibility states, told apart WITHOUT colour.
 *
 * Verification criterion 5 of `13_UI_DONS_LIST`: disable the tint and the
 * three states must still be distinguishable by text label and dashed border
 * alone. This test asserts on exactly those two channels — the text content
 * and the border style — never on a CSS colour class.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarqueurStatut } from './MarqueurStatut'

describe('MarqueurStatut — trois états, jamais par la teinte seule', () => {
  it('« eligible » porte un libellé textuel', () => {
    render(<MarqueurStatut statut="eligible" />)
    expect(screen.getByText('éligible')).toBeTruthy()
  })

  it('« manual_check » porte une bordure en tirets ET un « ! » textuel', () => {
    render(<MarqueurStatut statut="manual_check" />)
    const marqueur = screen.getByText('à vérifier').closest('span') as HTMLElement
    expect(marqueur.className).toMatch(/border-dashed/)
    expect(screen.getByText('!')).toBeTruthy()
  })

  it('« ineligible » porte un libellé textuel distinct des deux autres', () => {
    render(<MarqueurStatut statut="ineligible" />)
    expect(screen.getByText('inéligible')).toBeTruthy()
  })

  it('les trois libellés sont distincts, indépendamment de toute classe de couleur', () => {
    const libelles = (['eligible', 'manual_check', 'ineligible'] as const).map((statut) => {
      const { unmount, container } = render(<MarqueurStatut statut={statut} />)
      const texte = container.textContent ?? ''
      unmount()
      return texte
    })
    expect(new Set(libelles).size).toBe(3)
  })

  it('seul « manual_check » porte la bordure en tirets', () => {
    for (const statut of ['eligible', 'ineligible'] as const) {
      const { unmount, container } = render(<MarqueurStatut statut={statut} />)
      expect(container.querySelector('.border-dashed')).toBeNull()
      unmount()
    }
  })
})
