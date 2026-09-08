import { describe, expect, it } from 'vitest'

import { ecrireFichesDistantes, lireFichesDistantes, marquerSupprimee } from '@/lib/fiche_personnage/distant'

import type { SupabaseClient } from '@supabase/supabase-js'

interface Appel {
  readonly table: string
  readonly verbe: 'select' | 'upsert' | 'update'
  readonly payload?: unknown
}

/** A minimal fake of the chainable, thenable builder, on the model of
 * `web/components/fournisseurs.test.tsx`'s `tableFausse`. */
function clientFaux(appels: Appel[], reponse: { readonly data: unknown; readonly error: unknown }) {
  function requete(table: string) {
    const objet = {
      select: () => {
        appels.push({ table, verbe: 'select' })
        return Promise.resolve(reponse)
      },
      upsert: (payload: unknown) => {
        appels.push({ table, verbe: 'upsert', payload })
        return Promise.resolve(reponse)
      },
      update: (payload: unknown) => {
        appels.push({ table, verbe: 'update', payload })
        return objet
      },
      eq: () => objet,
      then: (resolve: (valeur: typeof reponse) => void) => Promise.resolve(reponse).then(resolve),
    }
    return objet
  }
  return { from: (table: string) => requete(table) } as unknown as SupabaseClient
}

describe('lireFichesDistantes', () => {
  it('lit la table fiches, tombstones compris', async () => {
    const appels: Appel[] = []
    const lignes = [
      {
        id_fiche: 'f1',
        schema_version: 1,
        contenu: {},
        nom: 'Kaelis',
        cree_le: null,
        modifie_le: null,
        supprime_le: null,
        personnage_id: null,
      },
    ]
    const client = clientFaux(appels, { data: lignes, error: null })
    const resultat = await lireFichesDistantes(client)
    expect(resultat.ok).toBe(true)
    if (resultat.ok) expect(resultat.valeur).toEqual(lignes)
    expect(appels).toEqual([{ table: 'fiches', verbe: 'select' }])
  })

  it('rapporte un motif humain sur erreur, jamais l’exception brute', async () => {
    const client = clientFaux([], { data: null, error: { message: 'boom' } })
    const resultat = await lireFichesDistantes(client)
    expect(resultat.ok).toBe(false)
  })
})

describe('ecrireFichesDistantes', () => {
  it('upserte avec user_id attaché, ne touche rien si la liste est vide', async () => {
    const appels: Appel[] = []
    const client = clientFaux(appels, { data: null, error: null })
    const resultat = await ecrireFichesDistantes(client, 'u1', [])
    expect(resultat.ok).toBe(true)
    expect(appels).toEqual([])
  })

  it('attache user_id à chaque ligne envoyée', async () => {
    const appels: Appel[] = []
    const client = clientFaux(appels, { data: null, error: null })
    const ligne = {
      id_fiche: 'f1',
      schema_version: 1,
      contenu: {},
      nom: null,
      cree_le: null,
      modifie_le: null,
      supprime_le: null,
      personnage_id: null,
    }
    const resultat = await ecrireFichesDistantes(client, 'u1', [ligne])
    expect(resultat.ok).toBe(true)
    expect(appels).toEqual([
      { table: 'fiches', verbe: 'upsert', payload: [{ ...ligne, user_id: 'u1' }] },
    ])
  })
})

describe('marquerSupprimee', () => {
  it('écrit supprime_le, sans delete', async () => {
    const appels: Appel[] = []
    const client = clientFaux(appels, { data: null, error: null })
    const resultat = await marquerSupprimee(client, 'u1', 'f1', '2026-09-07T00:00:00.000Z')
    expect(resultat.ok).toBe(true)
    expect(appels).toEqual([
      { table: 'fiches', verbe: 'update', payload: { supprime_le: '2026-09-07T00:00:00.000Z' } },
    ])
  })
})
