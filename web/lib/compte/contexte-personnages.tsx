'use client'

/**
 * The shared "active character" — the second consumer `personnages.ts`'s own
 * docstring predicted: "Step 16 (the UI for the feat fields added to
 * `personnages` — race, abilities, alignment, deity, feats taken) is expected
 * to be that second consumer; converting this hook into a context belongs to
 * that step, not to the schema change that only widens `ChampsPersonnage`."
 * `/sorts` and `/dons` both need to know which character is selected, so the
 * selection itself is promoted to a context here — declared once, in
 * `Fournisseurs.tsx`, per this repo's rule that the provider stack lives in
 * exactly one file.
 *
 * `usePersonnages()` (`@/lib/compte/personnages`) is left untouched: it is
 * still a plain hook, still imported directly by `VuePersonnages.tsx` and
 * exercised directly by `personnages.test.tsx` without any provider mounted.
 * This module wraps it rather than replacing it — the roster (`personnages`,
 * `creer`, `modifier`, `supprimer`, …) is threaded through unchanged, and the
 * only thing added is *which one is active* and a lookup for it, backed by
 * the URL rather than a mirrored `useState` (B7).
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import type { LignePersonnage } from '@/lib/compte/distant'
import { usePersonnages, type ValeurPersonnages } from '@/lib/compte/personnages'

const CLE_URL = 'personnage'

export interface ValeurPersonnageActif extends ValeurPersonnages {
  /** `null` = aucun personnage sélectionné, ou l'id en URL ne correspond plus
   * à un personnage existant (supprimé ailleurs, ou compte différent). */
  readonly personnageActif: LignePersonnage | null
  readonly personnageActifId: string | null
  /** Écrit l'id en URL (`{ scroll: false }`) ; `null` retire le paramètre. */
  readonly selectionnerPersonnage: (id: string | null) => void
}

/** Inert default — no roster, no selection, every write a documented no-op.
 * `VueDons.test.tsx`/`navigation.test.tsx` render `VueDons`/`VueNavigation`
 * with no `FournisseurPersonnageActif` mounted (same as they render with no
 * `FournisseurSession`), so this context needs a real default rather than a
 * throw: the same shape of graceful degradation `useSynchro`'s own default
 * context already uses. */
const VALEUR_INERTE: ValeurPersonnageActif = {
  chargement: false,
  personnages: [],
  erreur: null,
  recharger: () => {},
  creer: async () => ({ ok: false, message: 'Aucun compte n’est connecté.' }),
  modifier: async () => ({ ok: false, message: 'Aucun compte n’est connecté.' }),
  supprimer: async () => ({ ok: false, message: 'Aucun compte n’est connecté.' }),
  personnageActif: null,
  personnageActifId: null,
  selectionnerPersonnage: () => {},
}

const ContextePersonnageActif = createContext<ValeurPersonnageActif>(VALEUR_INERTE)

export function FournisseurPersonnageActif({ children }: { readonly children: ReactNode }) {
  const roster = usePersonnages()

  // `fournisseurs.test.tsx` mounts `<Fournisseurs>` with no Next app-router
  // context at all — it asserts wiring, not navigation, exactly like the
  // other two providers it already covers. `useRouter`/`useSearchParams`
  // throw outside that context; falling back to an inert URL (no selection,
  // no-op writer) here is the same shape of graceful degradation `useSession`
  // and `useFavoris` already have their own default contexts for, just
  // without a second context object to keep the file lean.
  let router: ReturnType<typeof useRouter> | null = null
  let parametres: ReturnType<typeof useSearchParams> | null = null
  try {
    // Always called, in a fixed position, on every render; the try/catch
    // guards the runtime throw outside a router context (see comment
    // above), not a conditional call — the linter's heuristic cannot see
    // that distinction, hence the two disables below.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter()
    // eslint-disable-next-line react-hooks/rules-of-hooks
    parametres = useSearchParams()
  } catch {
    router = null
    parametres = null
  }

  const idUrl = parametres?.get(CLE_URL) ?? null

  const personnageActif = useMemo(
    () => roster.personnages.find((p) => p.id === idUrl) ?? null,
    [roster.personnages, idUrl],
  )

  const selectionnerPersonnage = useCallback(
    (id: string | null) => {
      if (router === null || parametres === null) return
      const suivant = new URLSearchParams(parametres.toString())
      if (id === null) suivant.delete(CLE_URL)
      else suivant.set(CLE_URL, id)
      const query = suivant.toString()
      router.replace((query === '' ? '?' : `?${query}`) as `?${string}`, { scroll: false })
    },
    [parametres, router],
  )

  const valeur: ValeurPersonnageActif = useMemo(
    () => ({
      ...roster,
      personnageActif,
      personnageActifId: idUrl,
      selectionnerPersonnage,
    }),
    [roster, personnageActif, idUrl, selectionnerPersonnage],
  )

  return (
    <ContextePersonnageActif.Provider value={valeur}>{children}</ContextePersonnageActif.Provider>
  )
}

export function usePersonnageActif(): ValeurPersonnageActif {
  return useContext(ContextePersonnageActif)
}
