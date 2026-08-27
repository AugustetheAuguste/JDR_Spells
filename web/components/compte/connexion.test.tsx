import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

/**
 * The sign-in form against a fake provider.
 *
 * The point is not to test Supabase — it is to test the wiring that a fake exercises
 * and a real service would hide: that the form waits for a session before deciding
 * it is signed out, that a rejection is shown *translated*, and that
 * `autoComplete` is right on both modes. That last one has no visible symptom until
 * a friend's password manager saves the wrong entry.
 */

vi.mock('@/lib/compte/configuration', () => ({
  COMPTES_ACTIFS: true,
  CONFIGURATION: { url: 'https://faux.supabase.co', cle: 'sb_publishable_faux' },
  lireConfiguration: () => ({ url: 'https://faux.supabase.co', cle: 'sb_publishable_faux' }),
}))

const signInWithPassword = vi.fn(async () => ({
  data: { session: null, user: null },
  error: { message: 'Invalid login credentials' },
}))

vi.mock('@/lib/compte/client', () => ({
  reinitialiserClient: () => {},
  obtenirClient: async () => ({
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signInWithPassword,
    },
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

describe('VueCompte, service configuré', () => {
  it('n’affiche le formulaire qu’une fois la session lue, jamais avant', async () => {
    monter()
    // « Lecture de la session en cours » est le premier état : traiter « on ne sait
    // pas encore » comme « déconnecté » ferait clignoter ce formulaire devant
    // quelqu'un de déjà connecté, à chaque chargement de page.
    expect(screen.getByText(/Lecture de la session en cours/)).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByLabelText('Mot de passe')).toBeTruthy()
    })
  })

  it('montre le refus traduit, pas le message anglais du fournisseur', async () => {
    const utilisateur = userEvent.setup()
    monter()
    await waitFor(() => screen.getByLabelText('Mot de passe'))

    await utilisateur.type(screen.getByLabelText('Adresse e-mail'), 'ami@exemple.fr')
    await utilisateur.type(screen.getByLabelText('Mot de passe'), 'mauvais-mot-de-passe')
    await utilisateur.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Adresse e-mail ou mot de passe incorrect.',
      )
    })
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'ami@exemple.fr',
      password: 'mauvais-mot-de-passe',
    })
  })

  it('bascule `autoComplete` entre connexion et inscription', async () => {
    const utilisateur = userEvent.setup()
    monter()
    await waitFor(() => screen.getByLabelText('Mot de passe'))

    expect(screen.getByLabelText('Mot de passe').getAttribute('autocomplete')).toBe(
      'current-password',
    )
    await utilisateur.click(screen.getByRole('button', { name: 'Je n’en ai pas encore' }))
    expect(screen.getByLabelText('Mot de passe').getAttribute('autocomplete')).toBe(
      'new-password',
    )
  })

  it('donne au bouton d’envoi un nom distinct de celui de la bascule', async () => {
    const utilisateur = userEvent.setup()
    monter()
    await waitFor(() => screen.getByLabelText('Mot de passe'))

    // Deux boutons de même nom accessible pour deux actions différentes : c'est ce
    // que ce test interdit de réintroduire.
    expect(screen.getAllByRole('button', { name: 'Se connecter' })).toHaveLength(1)
    await utilisateur.click(screen.getByRole('button', { name: 'Je n’en ai pas encore' }))
    expect(screen.getAllByRole('button', { name: 'Créer un compte' })).toHaveLength(1)
  })

  it('refuse un mot de passe trop court sans faire payer un aller-retour', async () => {
    const utilisateur = userEvent.setup()
    monter()
    await waitFor(() => screen.getByLabelText('Mot de passe'))

    await utilisateur.click(screen.getByRole('button', { name: 'Je n’en ai pas encore' }))
    await utilisateur.type(screen.getByLabelText('Adresse e-mail'), 'ami@exemple.fr')
    await utilisateur.type(screen.getByLabelText('Mot de passe'), 'court')
    await utilisateur.click(screen.getByRole('button', { name: 'Créer un compte' }))

    expect(screen.getByRole('alert').textContent).toContain('au moins 8 caractères')
  })
})
