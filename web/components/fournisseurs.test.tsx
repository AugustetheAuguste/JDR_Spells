import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The one test the account feature did not have: **is synchronisation mounted?**
 *
 * It shipped without being. `FournisseurSynchro` was written, unit-tested and
 * exported, and `app/layout.tsx` composed `FournisseurSession` and
 * `FournisseurFavoris` around the page without it. `useSynchro()` then returns its
 * inert default context — `etatSynchro: 'inactive'`, `resynchroniser: () => {}` —
 * and every single unit test still passed, because each one mounted the provider by
 * hand. A production HAR settled it: `signInWithPassword` 200, and not one request
 * to `/rest/v1/` in the whole capture.
 *
 * So this file asserts the wiring, never the merge. `synchro.test.ts` already owns
 * the rules; what was missing is the boring question of whether anything calls them.
 * The assertion is deliberately the same one the HAR failed: signing in must produce
 * a read *and* a write against `listes`. Counting requests rather than reading the
 * resulting state is the point — a merge that computes the right answer and posts
 * nothing is exactly the bug that got here.
 */

vi.mock('@/lib/compte/configuration', () => ({
  COMPTES_ACTIFS: true,
  CONFIGURATION: { url: 'https://faux.supabase.co', cle: 'sb_publishable_faux' },
  lireConfiguration: () => ({ url: 'https://faux.supabase.co', cle: 'sb_publishable_faux' }),
}))

/** One PostgREST call, reduced to what a network tab would show: which table, and
 * whether it read or wrote. */
interface Appel {
  readonly table: string
  readonly verbe: 'select' | 'upsert' | 'update' | 'delete'
}

const appels: Appel[] = []

/** A minimal fake of the chainable, thenable builder — the same shape
 * `personnages.test.tsx` uses, with the calls recorded instead of a fixture
 * returned. Every response is empty: the remote holding nothing is the case that
 * must still push, and it is the state a real first sync starts from. */
function tableFausse(table: string) {
  const vide = { data: [] as readonly unknown[], error: null }
  function requete() {
    const objet = {
      select: () => {
        appels.push({ table, verbe: 'select' })
        return objet
      },
      upsert: () => {
        appels.push({ table, verbe: 'upsert' })
        return requete()
      },
      update: () => {
        appels.push({ table, verbe: 'update' })
        return requete()
      },
      delete: () => {
        appels.push({ table, verbe: 'delete' })
        return requete()
      },
      eq: () => objet,
      in: () => objet,
      order: () => objet,
      single: () => Promise.resolve(vide),
      then: (resolve: (valeur: typeof vide) => void) => Promise.resolve(vide).then(resolve),
    }
    return objet
  }
  return requete()
}

vi.mock('@/lib/compte/client', () => ({
  reinitialiserClient: () => {},
  obtenirClient: async () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'u1', email: 'ami@exemple.fr' } } },
        error: null,
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: (table: string) => tableFausse(table),
  }),
}))

const { Fournisseurs } = await import('@/components/Fournisseurs')
const { useSynchro } = await import('@/lib/compte/SynchroFavoris')
const { FournisseurSession } = await import('@/lib/compte/session')
const { FournisseurFavoris } = await import('@/lib/favoris/contexte')
const { reinitialiserCache } = await import('@/lib/favoris/magasin')
const { CLE_STOCKAGE } = await import('@/lib/favoris/stockage')

/** A local list to push. An empty local state would make the push a no-op and the
 * test would pass against a provider that does nothing. */
const ETAT_LOCAL = {
  version: 1,
  listes: [
    {
      id_liste: 'l1',
      nom: 'Ma liste',
      cree_le: '2026-08-30T10:00:00.000Z',
      modifie_le: '2026-08-30T10:00:00.000Z',
      sorts: ['boule-de-feu'],
      personnage_id: null,
    },
  ],
  liste_active: 'l1',
}

beforeEach(() => {
  appels.length = 0
  window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(ETAT_LOCAL))
  reinitialiserCache()
})

/** Reports the context it was given, so a test can tell the live provider from the
 * inert default without reaching into React internals. */
function Sonde() {
  const { etatSynchro } = useSynchro()
  return <p data-testid="etat">{etatSynchro}</p>
}

describe('Fournisseurs', () => {
  it('monte la synchronisation : une session connectée lit ET écrit dans listes', async () => {
    render(
      <Fournisseurs>
        <Sonde />
      </Fournisseurs>,
    )

    // Le critère du HAR, tel quel. Un select sans upsert, c'est une fusion qui
    // calcule et n'envoie rien ; un upsert sans select, c'est l'ordre interdit.
    await waitFor(() => {
      expect(appels.some((a) => a.table === 'listes' && a.verbe === 'select')).toBe(true)
      expect(appels.some((a) => a.table === 'listes' && a.verbe === 'upsert')).toBe(true)
    })

    // Et dans cet ordre : rien n'est poussé avant que le tirage soit fusionné.
    const premierEnvoi = appels.findIndex((a) => a.verbe === 'upsert')
    const premiereLecture = appels.findIndex((a) => a.verbe === 'select')
    expect(premiereLecture).toBeLessThan(premierEnvoi)
  })

  it('fournit un contexte vivant, pas le défaut inerte', async () => {
    const { getByTestId } = render(
      <Fournisseurs>
        <Sonde />
      </Fournisseurs>,
    )
    // Le défaut inerte reste sur 'inactive' quoi qu'il arrive ; le vrai provider
    // passe par 'fusion' puis atteint 'a_jour'.
    await waitFor(() => {
      expect(getByTestId('etat').textContent).toBe('a_jour')
    })
  })

  it('sans FournisseurSynchro, la même page n’émet rien — le bug d’origine', async () => {
    // La composition qui était en production : session + favoris, sans synchro.
    // Conservée comme test parce que c'est ce qui a échappé à 622 tests unitaires —
    // aucune erreur, aucun avertissement, juste un contexte par défaut silencieux.
    const { getByTestId } = render(
      <FournisseurSession>
        <FournisseurFavoris>
          <Sonde />
        </FournisseurFavoris>
      </FournisseurSession>,
    )
    await waitFor(() => {
      expect(getByTestId('etat').textContent).toBe('inactive')
    })
    expect(appels.filter((a) => a.table === 'listes')).toEqual([])
  })
})
