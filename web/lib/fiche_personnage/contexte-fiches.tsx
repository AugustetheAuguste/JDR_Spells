'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  creer as creerDansMagasin,
  dupliquer as dupliquerDansMagasin,
  ecrire,
  lister,
  restaurerSecours,
  supprimer as supprimerDuMagasin,
  type FicheIllisible,
  type Resultat,
} from '@/lib/fiche_personnage/magasin'
import { importer as importerFichier, type ResultatImport } from '@/lib/fiche_personnage/echange'
import type { Fiche } from '@/lib/fiche_personnage/schema'

/**
 * The sheets a reader has on this device.
 *
 * Read in an effect rather than at render, unlike `FournisseurFavoris`: this
 * store scans an arbitrary number of keys rather than one, so the read is a
 * genuine « go fetch this » rather than a cheap external-store snapshot, and
 * `chargement` exists precisely to let the interface say so. The listener on
 * `storage` keeps a second tab in agreement, the same reason
 * `favoris/magasin.ts` has one.
 *
 * `useFiches()` outside the provider throws — it never falls back to an
 * inert default context. That fallback is exactly what let the favourites
 * synchronisation ship unmounted (cf. Skill § comment in
 * `Fournisseurs.tsx`): a silent no-op provider looks like a storage bug
 * rather than a missing wire.
 */
export interface ValeurFiches {
  readonly chargement: boolean
  readonly fiches: readonly Fiche[]
  readonly illisibles: readonly FicheIllisible[]
  readonly creer: (nom: string) => Promise<Resultat>
  readonly modifier: (fiche: Fiche) => Promise<Resultat>
  readonly dupliquer: (id: string) => Promise<Resultat>
  readonly supprimer: (id: string) => Promise<Resultat>
  readonly restaurer: (id: string) => Promise<Resultat>
  readonly importer: (texte: string, option?: { readonly nouvelId?: string }) => Promise<ResultatImport>
  readonly recharger: () => void
}

const Contexte = createContext<ValeurFiches | null>(null)

interface Etat {
  readonly chargement: boolean
  readonly fiches: readonly Fiche[]
  readonly illisibles: readonly FicheIllisible[]
}

const ETAT_INITIAL: Etat = { chargement: true, fiches: [], illisibles: [] }

export function FournisseurFiches({ children }: { readonly children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>(ETAT_INITIAL)
  /** Monotonic within the session, combined with the clock so two sheets
   * created in the same millisecond do not collide on their id. */
  const compteur = useRef(0)

  const recharger = useCallback((): void => {
    if (typeof window === 'undefined') return
    const { fiches, illisibles } = lister(window.localStorage)
    setEtat({ chargement: false, fiches, illisibles })
  }, [])

  useEffect(() => {
    recharger()
    const surStockage = (evenement: StorageEvent): void => {
      if (evenement.key === null || evenement.key.startsWith('pf-fiche')) {
        recharger()
      }
    }
    window.addEventListener('storage', surStockage)
    return () => window.removeEventListener('storage', surStockage)
  }, [recharger])

  const graine = useCallback((): string => {
    compteur.current += 1
    return `f${Date.now().toString(36)}${compteur.current.toString(36)}`
  }, [])

  const maintenant = useCallback((): string => new Date().toISOString(), [])

  const valeur = useMemo<ValeurFiches>(
    () => ({
      chargement: etat.chargement,
      fiches: etat.fiches,
      illisibles: etat.illisibles,
      creer: async (nom) => {
        const resultat = creerDansMagasin(window.localStorage, graine(), maintenant())
        if (resultat.ok) {
          const avecNom = ecrire(window.localStorage, {
            ...resultat.fiche,
            meta: { ...resultat.fiche.meta, nomPersonnage: nom },
          })
          recharger()
          return avecNom
        }
        recharger()
        return resultat
      },
      modifier: async (fiche) => {
        const resultat = ecrire(window.localStorage, {
          ...fiche,
          meta: { ...fiche.meta, modifieLe: maintenant() },
        })
        recharger()
        return resultat
      },
      dupliquer: async (id) => {
        const resultat = dupliquerDansMagasin(window.localStorage, id, graine(), maintenant())
        recharger()
        return resultat
      },
      supprimer: async (id) => {
        const resultat = supprimerDuMagasin(window.localStorage, id)
        recharger()
        return resultat
      },
      restaurer: async (id) => {
        const resultat = restaurerSecours(window.localStorage, id)
        recharger()
        return resultat
      },
      importer: async (texte, option) => {
        const resultat = importerFichier(window.localStorage, texte, option?.nouvelId)
        recharger()
        return resultat
      },
      recharger,
    }),
    [etat, graine, maintenant, recharger],
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

/**
 * Read the sheets. Throws outside `FournisseurFiches` rather than returning a
 * stub context — cf. module docstring.
 */
export function useFiches(): ValeurFiches {
  const valeur = useContext(Contexte)
  if (valeur === null) {
    throw new Error('useFiches hors de FournisseurFiches')
  }
  return valeur
}
