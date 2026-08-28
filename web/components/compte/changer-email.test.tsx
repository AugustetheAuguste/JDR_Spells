import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

/**
 * The e-mail-change form against a fake provider.
 *
 * Same intent as `connexion.test.tsx`: check the wiring, not Supabase — that the
 * form refuses to render for someone signed out, and that a successful call says
 * clearly that nothing has changed yet, since Supabase confirms on both addresses.
 */

vi.mock('@/lib/compte/configuration', () => ({
  COMPTES_ACTIFS: true,
  CONFIGURATION: { url: 'https://faux.supabase.co', cle: 'sb_publishable_faux' },
  lireConfiguration: () => ({ url: 'https://faux.supabase.co', cle: 'sb_publishable_faux' }),
}))

const updateUser = vi.fn(async () => ({ data: { user: null }, error: null }))

vi.mock('@/lib/compte/client', () => ({
  reinitialiserClient: () => {},
  obtenirClient: async () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'u1', email: 'ancien@exemple.fr' } } },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      updateUser,
    },
  }),
}))

const { VueChangerEmail } = await import('@/components/compte/VueChangerEmail')
const { FournisseurSession } = await import('@/lib/compte/session')

function monter() {
  return render(
    <FournisseurSession>
      <VueChangerEmail />
    </FournisseurSession>,
  )
}

describe('VueChangerEmail, connecté', () => {
  it('affiche l’adresse actuelle une fois la session lue', async () => {
    monter()
    await waitFor(() => {
      expect(screen.getByText('ancien@exemple.fr')).toBeTruthy()
    })
  })

  it('dit que les deux adresses doivent confirmer avant tout changement', async () => {
    const utilisateur = userEvent.setup()
    monter()
    await waitFor(() => screen.getByLabelText('Nouvelle adresse e-mail'))

    await utilisateur.type(screen.getByLabelText('Nouvelle adresse e-mail'), 'nouveau@exemple.fr')
    await utilisateur.click(screen.getByRole('button', { name: 'Envoyer les liens de confirmation' }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('ancienne et à la nouvelle')
    })
    expect(updateUser).toHaveBeenCalledWith(
      { email: 'nouveau@exemple.fr' },
      expect.objectContaining({ emailRedirectTo: expect.stringContaining('/compte/') }),
    )
  })
})
