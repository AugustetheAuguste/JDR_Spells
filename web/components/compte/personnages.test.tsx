import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The character roster against a fake table.
 *
 * Same reason as `connexion.test.tsx`: not testing Supabase, testing that this
 * page waits for the session before deciding there is nothing to show, that a
 * created row appears without a reload, and that deleting asks first.
 */

vi.mock('@/lib/compte/configuration', () => ({
  COMPTES_ACTIFS: true,
  CONFIGURATION: { url: 'https://faux.supabase.co', cle: 'sb_publishable_faux' },
  lireConfiguration: () => ({ url: 'https://faux.supabase.co', cle: 'sb_publishable_faux' }),
}))

interface Ligne {
  readonly id: string
  readonly nom: string
  readonly classe: string | null
  readonly niveau: number | null
}

/** A minimal fake of the chainable, thenable PostgREST builder — just enough
 * of the shape `distant.ts` calls, not a Supabase mock library. */
function tableFausse(lignes: Ligne[]) {
  let compteur = 0
  function requete(resultat: () => { readonly data: unknown; readonly error: unknown }) {
    const objet = {
      select: () => objet,
      eq: () => objet,
      order: () => objet,
      insert: (valeurs: { nom: string; classe: string | null; niveau: number | null }) => {
        compteur += 1
        const ligne: Ligne = { id: `p${compteur}`, ...valeurs }
        lignes.push(ligne)
        return requete(() => ({ data: ligne, error: null }))
      },
      update: (valeurs: Partial<Ligne>) => {
        return requete(() => {
          const cible = lignes[0]
          if (cible !== undefined) Object.assign(cible, valeurs)
          return { data: null, error: null }
        })
      },
      delete: () => {
        return requete(() => {
          lignes.length = 0
          return { data: null, error: null }
        })
      },
      single: () => Promise.resolve(resultat()),
      then: (resolve: (valeur: { readonly data: unknown; readonly error: unknown }) => void) =>
        Promise.resolve(resultat()).then(resolve),
    }
    return objet
  }
  return requete(() => ({ data: lignes, error: null }))
}

const lignes: Ligne[] = []

beforeEach(() => {
  lignes.length = 0
  lignes.push({ id: 'p1', nom: 'Elara', classe: 'barde', niveau: 4 })
})

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
    },
    from: () => tableFausse(lignes),
  }),
}))

const { VuePersonnages } = await import('@/components/compte/VuePersonnages')
const { FournisseurSession } = await import('@/lib/compte/session')

function monter() {
  return render(
    <FournisseurSession>
      <VuePersonnages />
    </FournisseurSession>,
  )
}

describe('VuePersonnages, connecté', () => {
  it('liste les personnages existants une fois la session et la table lues', async () => {
    monter()
    await waitFor(() => {
      expect(screen.getByText('Elara')).toBeTruthy()
    })
    expect(screen.getByText('barde, niveau 4')).toBeTruthy()
  })

  it('crée un personnage et l’affiche sans rechargement de page', async () => {
    const utilisateur = userEvent.setup()
    monter()
    await waitFor(() => screen.getByText('Elara'))

    await utilisateur.click(screen.getByRole('button', { name: 'Nouveau personnage' }))
    await utilisateur.type(screen.getByLabelText('Nom'), 'Thorn')
    await utilisateur.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => {
      expect(screen.getByText('Thorn')).toBeTruthy()
    })
  })

  it('demande confirmation avant de supprimer', async () => {
    const utilisateur = userEvent.setup()
    monter()
    await waitFor(() => screen.getByText('Elara'))

    await utilisateur.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    // Rien n'a encore disparu : la ligne existe toujours derrière la boîte de
    // confirmation.
    expect(screen.getByText('Elara')).toBeTruthy()
  })
})
