import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

/** A clock the test moves by hand: the visibility throttle is a duration, and
 * waiting a real minute to assert one is not a test anyone will keep running. */
let maintenant = Date.parse('2026-08-31T09:00:00.000Z')

beforeEach(() => {
  appels.length = 0
  maintenant = Date.parse('2026-08-31T09:00:00.000Z')
  vi.spyOn(Date, 'now').mockImplementation(() => maintenant)
  window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(ETAT_LOCAL))
  reinitialiserCache()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Simulate coming back to the tab. `visibilityState` is a getter on `document`,
 * so it has to be redefined rather than assigned. */
async function revenirAlOnglet(): Promise<void> {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

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

  it('retirer l’onglet et revenir dans la minute ne relance rien', async () => {
    const { getByTestId } = render(
      <Fournisseurs>
        <Sonde />
      </Fournisseurs>,
    )
    await waitFor(() => {
      expect(getByTestId('etat').textContent).toBe('a_jour')
    })
    const apresFusion = appels.length

    maintenant += 30_000
    await revenirAlOnglet()

    // Le garde anti-rafale : `visibilitychange` part à chaque alt-tab, et six
    // tirages par minute pour un état qui change deux fois par jour, c'est du bruit.
    expect(appels.length).toBe(apresFusion)
  })

  it('revenir après plus d’une minute relance un tirage', async () => {
    const { getByTestId } = render(
      <Fournisseurs>
        <Sonde />
      </Fournisseurs>,
    )
    await waitFor(() => {
      expect(getByTestId('etat').textContent).toBe('a_jour')
    })
    const apresFusion = appels.filter((a) => a.table === 'listes' && a.verbe === 'select').length

    maintenant += 61_000
    await revenirAlOnglet()

    // C'est le trou que ceci comble : sur un téléphone dont l'onglet reste ouvert
    // des jours, la fusion tourne une fois à la restauration de session et plus
    // jamais — le favori ajouté sur le PC n'arrivait qu'après fermeture de l'onglet.
    await waitFor(() => {
      const lectures = appels.filter((a) => a.table === 'listes' && a.verbe === 'select').length
      expect(lectures).toBeGreaterThan(apresFusion)
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
