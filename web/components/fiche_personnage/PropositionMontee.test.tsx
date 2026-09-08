import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PropositionMontee } from '@/components/fiche_personnage/PropositionMontee'
import { creerFicheVide } from '@/lib/fiche_personnage/fiche-vide'

const proposer = vi.fn(async () => {})
const ignorerProposition = vi.fn()

vi.mock('@/lib/fiche_personnage/SynchroFiches', () => ({
  useSynchroFiches: () => ({
    etatSynchro: 'a_jour',
    erreur: null,
    propositions: [creerFicheVide('f1', '2026-09-01T00:00:00.000Z')],
    conflits: [],
    proposer,
    ignorerProposition,
    resoudreConflit: async () => {},
    resynchroniser: () => {},
  }),
}))

beforeEach(() => {
  proposer.mockClear()
  ignorerProposition.mockClear()
})

describe('PropositionMontee', () => {
  it('affiche une fiche jamais proposée et rien de plus', () => {
    const { getByText } = render(<PropositionMontee />)
    expect(getByText('Fiches créées hors ligne')).toBeTruthy()
  })

  it('un clic sur Envoyer appelle proposer avec l’id de la fiche', async () => {
    const { getByRole } = render(<PropositionMontee />)
    await userEvent.click(getByRole('button', { name: 'Envoyer' }))
    await waitFor(() => {
      expect(proposer).toHaveBeenCalledWith('f1')
    })
  })

  it('un clic sur Ignorer appelle ignorerProposition, sans envoyer', async () => {
    const { getByRole } = render(<PropositionMontee />)
    await userEvent.click(getByRole('button', { name: 'Ignorer' }))
    expect(ignorerProposition).toHaveBeenCalledWith('f1')
    expect(proposer).not.toHaveBeenCalled()
  })
})
