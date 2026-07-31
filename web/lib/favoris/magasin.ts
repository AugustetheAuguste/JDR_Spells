/**
 * `localStorage` as an external store, in the sense `useSyncExternalStore` means.
 *
 * The obvious implementation — read storage in an effect, `setState` — is what
 * `react-hooks/set-state-in-effect` refuses, and it is right to: the read is a
 * subscription to something outside React, not a state synchronisation, and doing
 * it as an effect costs a cascading render on every mount. `useSyncExternalStore`
 * is the API for exactly this, and it takes a *server* snapshot as a separate
 * argument — which is what the prerendered HTML needs, since the export runs on a
 * machine with no storage at all.
 *
 * The snapshot must be reference-stable between reads or React re-renders forever,
 * hence the cache: `lireInstantane` parses once and then returns the same object
 * until something writes.
 */

import {
  ETAT_FAVORIS_VIDE,
  charger,
  enregistrer,
  type Chargement,
  type EtatFavoris,
  type Incident,
} from '@/lib/favoris/stockage'

/** A snapshot, plus whether it came from real storage.
 *
 * `pret` is what lets the interface decline to answer: during the prerender and
 * during hydration React serves the server snapshot, and a toggle that rendered
 * « pas en favori » there would be asserting something it cannot know. */
export interface Instantane extends Chargement {
  readonly pret: boolean
}

const INSTANTANE_SERVEUR: Instantane = {
  etat: ETAT_FAVORIS_VIDE,
  incident: { type: 'aucun' },
  pret: false,
}

let cache: Instantane | null = null
const abonnes = new Set<() => void>()

export function sabonner(rappel: () => void): () => void {
  abonnes.add(rappel)
  const surStockage = (evenement: StorageEvent): void => {
    // Another tab wrote. Dropping the cache rather than merging: two tabs of the
    // same site are one user, and the last write is what they meant.
    if (evenement.key === null || evenement.key.startsWith('pf-sorts-favoris')) {
      cache = null
      notifier()
    }
  }
  window.addEventListener('storage', surStockage)
  return () => {
    abonnes.delete(rappel)
    window.removeEventListener('storage', surStockage)
  }
}

function notifier(): void {
  for (const rappel of abonnes) rappel()
}

/** The client snapshot. Cached so the reference is stable across renders. */
export function lireInstantane(): Instantane {
  if (cache === null) {
    cache =
      typeof window === 'undefined'
        ? INSTANTANE_SERVEUR
        : { ...charger(window.localStorage), pret: true }
  }
  return cache
}

/** The server snapshot: the empty state, because the prerender has no storage
 * and must not pretend otherwise. */
export function lireInstantaneServeur(): Instantane {
  return INSTANTANE_SERVEUR
}

/** Write, then notify. The cache is replaced rather than invalidated so that the
 * next read does not re-parse what we just serialized. */
export function ecrire(etat: EtatFavoris): void {
  if (typeof window !== 'undefined') enregistrer(window.localStorage, etat)
  cache = { etat, incident: lireInstantane().incident, pret: true }
  notifier()
}

/** Dismiss the incident banner without touching stored data. */
export function ecarterIncident(): void {
  const actuel = lireInstantane()
  cache = { etat: actuel.etat, incident: { type: 'aucun' } as Incident, pret: actuel.pret }
  notifier()
}

/** Test-only reset: the cache is module-level, so it outlives a component tree. */
export function reinitialiserCache(): void {
  cache = null
}
