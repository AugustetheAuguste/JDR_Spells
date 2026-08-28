import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

/**
 * Account deletion against a fake Edge Function.
 *
 * The point is the two gates, not the function itself: the button stays
 * disabled until the typed address matches exactly, and a successful call
 * signs the local session out even though the deletion itself happened
 * entirely server-side.
 */

vi.mock('@/lib/compte/configuration', () => ({
  COMPTES_ACTIFS: true,
  CONFIGURATION: { url: 'https://faux.supabase.co', cle: 'sb_publishable_faux' },
  lireConfiguration: () => ({ url: 'https://faux.supabase.co', cle: 'sb_publishable_faux' }),
}))

const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }))
const signOut = vi.fn(async () => ({ error: null }))

vi.mock('@/lib/compte/client', () => ({
  reinitialiserClient: () => {},
  obtenirClient: async () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'u1', email: 'ami@exemple.fr' } } },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut,
    },
    functions: { invoke },
  }),
}))

vi.mock('@/lib/compte/SynchroFavoris', () => ({
  useSynchro: () => ({
    etatSynchro: 'inactive',
    rapport: null,
    erreur: null,
    resynchroniser: () => {},
    oublierRapport: () => {},
    effacerDuCompte: async () => ({ ok: true }),
  }),
}))

const { VueCompte } = await import('@/components/compte/VueCompte')
const { FournisseurSession } = await import('@/lib/compte/session')

function monter() {
  return render(
    <FournisseurSession>
      <VueCompte />
    </FournisseurSession>,
  )
}

describe('Suppression définitive du compte', () => {
  it('garde le bouton bloqué jusqu’à ce que l’adresse retapée corresponde', async () => {
    const utilisateur = userEvent.setup()
    monter()
    await waitFor(() => screen.getByText('ami@exemple.fr'))

    await utilisateur.click(
      screen.getByRole('button', { name: 'Supprimer définitivement mon compte' }),
    )
    const champ = screen.getByLabelText(/Adresse e-mail du compte, pour confirmer/)
    expect(
      (screen.getByRole('button', { name: 'Adresse à confirmer' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    await utilisateur.type(champ, 'mauvaise@exemple.fr')
    expect(
      (screen.getByRole('button', { name: 'Adresse à confirmer' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    await utilisateur.clear(champ)
    await utilisateur.type(champ, 'ami@exemple.fr')
    await waitFor(() => {
      expect(
        (
          screen.getByRole('button', {
            name: 'Supprimer définitivement mon compte',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false)
    })
  })

  it('appelle la fonction puis déconnecte localement, une fois confirmé', async () => {
    const utilisateur = userEvent.setup()
    monter()
    await waitFor(() => screen.getByText('ami@exemple.fr'))

    await utilisateur.click(
      screen.getAllByRole('button', { name: 'Supprimer définitivement mon compte' })[0]!,
    )
    await utilisateur.type(
      screen.getByLabelText(/Adresse e-mail du compte, pour confirmer/),
      'ami@exemple.fr',
    )
    const boutons = screen.getAllByRole('button', { name: 'Supprimer définitivement mon compte' })
    await utilisateur.click(boutons[boutons.length - 1]!)

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('supprimer-compte', { method: 'POST' })
    })
    expect(signOut).toHaveBeenCalled()
  })
})
