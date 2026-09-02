/**
 * `FiltreStatut` — `manual_check` stays visible AND selectable by default.
 *
 * Verification criterion 4 of `13_UI_DONS_LIST`: a test must assert that
 * `manual_check` is NOT excluded from the empty/default state. Filtering it
 * out by default would hide, from the player, exactly the feats the engine
 * could not decide — the under-attribution this repository's whole gating
 * design fights.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FiltreStatut } from './FiltreStatut'

describe('FiltreStatut — manual_check jamais exclu par défaut', () => {
  it('la case « À vérifier » (manual_check) est présente, non désactivée, et décochée dans l’état vide', () => {
    render(<FiltreStatut statuts={[]} surStatuts={vi.fn()} />)
    const case_ = screen.getByRole('checkbox', { name: 'À vérifier' }) as HTMLInputElement
    expect(case_.disabled).toBe(false)
    expect(case_.checked).toBe(false)
  })

  it('les trois statuts sont tous cochables', () => {
    render(<FiltreStatut statuts={[]} surStatuts={vi.fn()} />)
    for (const nom of ['Éligible', 'À vérifier', 'Inéligible']) {
      expect(screen.getByRole('checkbox', { name: nom })).toBeTruthy()
    }
  })

  it('cocher manual_check l’ajoute à la sélection sans retirer les autres', async () => {
    const surStatuts = vi.fn()
    render(<FiltreStatut statuts={['eligible']} surStatuts={surStatuts} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'À vérifier' }))
    expect(surStatuts).toHaveBeenCalledWith(['eligible', 'manual_check'])
  })

  it('décocher manual_check le retire sans toucher aux autres', async () => {
    const surStatuts = vi.fn()
    render(<FiltreStatut statuts={['eligible', 'manual_check']} surStatuts={surStatuts} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'À vérifier' }))
    expect(surStatuts).toHaveBeenCalledWith(['eligible'])
  })
})
