import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * The three states `SelecteurPersonnageActif` must never collapse into
 * silence: signed out, signed in with no character, signed in with a
 * roster. Mocking the two hooks directly (rather than mounting
 * `FournisseurSession`/`FournisseurPersonnageActif`) keeps this test about
 * the component's own branching, which is what regressed — the hooks
 * themselves already have their own tests.
 */

const etatSession = vi.fn()
const etatPersonnageActif = vi.fn()

vi.mock('@/lib/compte/session', () => ({
  useSession: () => etatSession(),
}))

vi.mock('@/lib/compte/contexte-personnages', () => ({
  usePersonnageActif: () => etatPersonnageActif(),
}))

const { SelecteurPersonnageActif } = await import('@/components/compte/SelecteurPersonnageActif')

function baseActif(personnages: readonly { id: string; nom: string }[] = []) {
  return {
    personnages,
    personnageActifId: null,
    selectionnerPersonnage: () => {},
  }
}

describe('SelecteurPersonnageActif', () => {
  it('invite à se connecter, avec le motif, quand déconnecté', () => {
    etatSession.mockReturnValue({ statut: 'deconnecte' })
    etatPersonnageActif.mockReturnValue(baseActif())

    render(<SelecteurPersonnageActif />)

    expect(screen.getByText(/filtrer les dons par éligibilité/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe('/compte')
  })

  it('invite à créer un personnage, sans détour, quand connecté sans personnage', () => {
    etatSession.mockReturnValue({ statut: 'connecte' })
    etatPersonnageActif.mockReturnValue(baseActif())

    render(<SelecteurPersonnageActif />)

    expect(screen.getByText(/Aucun personnage encore créé/)).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Créer un personnage' }).getAttribute('href'),
    ).toBe('/compte/personnages')
  })

  it('affiche le sélecteur, inchangé, quand connecté avec au moins un personnage', () => {
    etatSession.mockReturnValue({ statut: 'connecte' })
    etatPersonnageActif.mockReturnValue(baseActif([{ id: 'p1', nom: 'Elara' }]))

    render(<SelecteurPersonnageActif />)

    expect(screen.getByLabelText('Personnage')).toBeTruthy()
    expect(screen.getByText('Elara')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'modifier ses champs' }).getAttribute('href'),
    ).toBe('/compte/personnages')
  })

  it('ne rend rien pendant la restauration de la session', () => {
    etatSession.mockReturnValue({ statut: 'inconnu' })
    etatPersonnageActif.mockReturnValue(baseActif())

    const { container } = render(<SelecteurPersonnageActif />)

    expect(container.innerHTML).toBe('')
  })
})
