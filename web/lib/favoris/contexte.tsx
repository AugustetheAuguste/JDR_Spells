'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import {
  ecarterIncident,
  ecrire,
  lireInstantane,
  lireInstantaneServeur,
  sabonner,
} from '@/lib/favoris/magasin'
import {
  activerListe,
  ajouterListe,
  basculer,
  importer,
  listeActive,
  nouvelleListe,
  renommerListe,
  supprimerListe,
  type EtatFavoris,
  type Incident,
  type ListeFavoris,
  type ModeImport,
  type RapportImport,
} from '@/lib/favoris/stockage'

/**
 * The favourites state, read once and shared.
 *
 * `useSyncExternalStore` rather than read-in-an-effect: `localStorage` IS an
 * external store, the effect version costs a cascading render on every mount, and
 * `react-hooks/set-state-in-effect` rejects it outright. It also gives the one
 * thing this interface needs — a distinct *server* snapshot — because the export
 * prerenders on a machine with no storage, and a toggle rendering « pas en
 * favori » there would be asserting something it cannot know. That is what `pret`
 * carries, and why the button says « Lecture des favoris en cours » instead.
 *
 * The clock and the id seed enter through here so `stockage.ts` stays pure and
 * equality-testable.
 */

export interface ValeurFavoris {
  readonly etat: EtatFavoris
  readonly pret: boolean
  readonly incident: Incident
  readonly active: ListeFavoris | null
  readonly basculerSort: (id_sort: string) => void
  readonly creer: (nom: string) => void
  readonly renommer: (id_liste: string, nom: string) => void
  readonly supprimer: (id_liste: string) => void
  readonly activer: (id_liste: string) => void
  readonly importerDepuis: (brut: unknown, mode: ModeImport) => RapportImport | null
  readonly oublierIncident: () => void
}

const Contexte = createContext<ValeurFavoris | null>(null)

/** The default list, created on the first toggle rather than up front: an empty
 * list nobody asked for is noise, and the first save is the moment it earns its
 * existence. */
export const NOM_LISTE_DEFAUT = 'Ma liste'

export function FournisseurFavoris({ children }: { readonly children: ReactNode }) {
  const instantane = useSyncExternalStore(sabonner, lireInstantane, lireInstantaneServeur)
  /** Monotonic within the session, and combined with the clock — two lists
   * created in the same millisecond must not collide on their id. */
  const compteur = useRef(0)

  const graine = useCallback((): string => {
    compteur.current += 1
    return `l${Date.now().toString(36)}${compteur.current.toString(36)}`
  }, [])

  const { etat, pret, incident } = instantane

  const valeur = useMemo<ValeurFavoris>(() => {
    const maintenant = (): string => new Date().toISOString()
    return {
      etat,
      pret,
      incident,
      active: listeActive(etat),
      basculerSort: (id_sort) => {
        const instant = maintenant()
        // The list is created on demand so that a first click just works, rather
        // than asking the user to name a list before saving anything.
        const base =
          listeActive(etat) === null
            ? ajouterListe(etat, nouvelleListe(NOM_LISTE_DEFAUT, instant, graine()))
            : etat
        ecrire(basculer(base, id_sort, instant))
      },
      creer: (nom) => {
        ecrire(ajouterListe(etat, nouvelleListe(nom, maintenant(), graine())))
      },
      renommer: (id_liste, nom) => {
        ecrire(renommerListe(etat, id_liste, nom, maintenant()))
      },
      supprimer: (id_liste) => {
        ecrire(supprimerListe(etat, id_liste))
      },
      activer: (id_liste) => {
        ecrire(activerListe(etat, id_liste))
      },
      importerDepuis: (brut, mode) => {
        const rapport = importer(etat, brut, mode, maintenant(), () => graine())
        if (rapport !== null) ecrire(rapport.etat)
        return rapport
      },
      oublierIncident: ecarterIncident,
    }
  }, [etat, pret, incident, graine])

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

/**
 * Read the favourites.
 *
 * Throws when the provider is missing rather than returning a stub: a silent
 * stub would make every toggle a no-op, and a no-op toggle looks like a bug in
 * storage rather than a missing provider.
 */
export function useFavoris(): ValeurFavoris {
  const valeur = useContext(Contexte)
  if (valeur === null) {
    throw new Error('useFavoris hors de FournisseurFavoris')
  }
  return valeur
}
