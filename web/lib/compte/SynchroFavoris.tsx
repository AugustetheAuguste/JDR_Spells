'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { obtenirClient } from '@/lib/compte/client'
import { effacerDonnees, enterrer, pousser, tirer } from '@/lib/compte/distant'
import { useSession } from '@/lib/compte/session'
import { fusionner, listesDisparues, type RapportFusion } from '@/lib/compte/synchro'
import { useFavoris } from '@/lib/favoris/contexte'
import { ecrire } from '@/lib/favoris/magasin'

import type { EtatFavoris } from '@/lib/favoris/stockage'

/**
 * Synchronisation as an observer of the local store, not as a layer inside it.
 *
 * `lib/favoris/` is untouched by this feature. It reads the state through
 * `useFavoris` and writes through `ecrire`, exactly as any other consumer would,
 * which is what guarantees the promise made on the account page: **without an
 * account the site behaves precisely as it did before.** There is no branch inside
 * the local path that a logged-out user could fall down.
 *
 * The ordering rule is the whole design, and it is enforced by `base` being null
 * until the merge lands: **nothing is ever pushed before the pull has been merged
 * in.** Pushing first would send up a state that has not yet heard about the other
 * devices, and since a push deletes the spell rows the state does not contain, that
 * one wrong ordering is the only way this feature can lose data.
 *
 * Deletions are diffed against `base` — the last state we successfully pushed — and
 * never against the server. A list the server has and this device does not is not a
 * deletion; it is a device that has not learned about it yet. Diffing the wrong way
 * round would turn every first sync on a new phone into a mass erasure.
 */

export type EtatSynchro =
  /** No account service, or nobody signed in. */
  | 'inactive'
  /** Signed in, pulling and merging. Nothing is pushed in this state. */
  | 'fusion'
  /** Local and remote agree as of the last write. */
  | 'a_jour'
  /** A local change is on its way up. */
  | 'envoi'
  | 'erreur'

export interface ValeurSynchro {
  readonly etatSynchro: EtatSynchro
  /** What the last merge changed, or null when nothing has been reported yet. */
  readonly rapport: RapportFusion | null
  readonly erreur: string | null
  /** Re-run the pull and merge. Offered as a button rather than a timer: a
   * background poll on a static site is cost with no occasion. */
  readonly resynchroniser: () => void
  readonly oublierRapport: () => void
  /** Erase the account's lists and disarm synchronisation, so nothing is sent back
   * up afterwards. The caller signs out next; the local lists are untouched. */
  readonly effacerDuCompte: () => Promise<
    { readonly ok: true } | { readonly ok: false; readonly message: string }
  >
}

const Contexte = createContext<ValeurSynchro>({
  etatSynchro: 'inactive',
  rapport: null,
  erreur: null,
  resynchroniser: () => {},
  oublierRapport: () => {},
  effacerDuCompte: () =>
    Promise.resolve({ ok: false, message: 'Aucun compte n’est connecté.' }),
})

/** Long enough that toggling five favourites in a row is one request, short enough
 * that closing the tab straight after a click still catches it. */
const DELAI_ENVOI_MS = 800

/**
 * How stale a merge has to be before returning to the tab re-runs it.
 *
 * The merge is keyed on the account, so it runs once when a session is restored and
 * then never again on its own. On a phone that is a real gap: the tab stays open for
 * days, the laptop adds a favourite, and nothing arrives until the tab is closed and
 * reopened. Coming back to the tab is the one moment a user is about to *read* their
 * lists, which makes it the moment worth spending a pull on.
 *
 * A minute, and not a timer: a background poll on a statically exported site is cost
 * with no occasion, whereas `visibilitychange` fires exactly when the answer might
 * be looked at. The throttle is there because the event fires on every alt-tab, and
 * six pulls a minute for a state that changes twice a day is noise.
 */
const DELAI_REVISITE_MS = 60_000

/**
 * Progress, stamped with the account it belongs to.
 *
 * The stamp is what removes the need to reset anything on sign-out. Progress from a
 * previous session simply stops matching the current account, so it is ignored
 * rather than cleared — and clearing it was the `setState` inside an effect body
 * that `react-hooks/set-state-in-effect` rightly refused.
 */
interface Progres {
  readonly compte: string
  readonly etat: EtatSynchro
  readonly erreur: string | null
  readonly rapport: RapportFusion | null
}

function messageDe(erreur: unknown): string {
  if (erreur instanceof Error) return erreur.message
  return 'La synchronisation a échoué sans message.'
}

export function FournisseurSynchro({ children }: { readonly children: ReactNode }) {
  const { utilisateur } = useSession()
  const { etat, pret } = useFavoris()

  const [progres, setProgres] = useState<Progres | null>(null)

  /** The last state successfully pushed. Null means "not merged yet", which is the
   * interlock that forbids pushing. */
  const base = useRef<EtatFavoris | null>(null)
  /** Which account `base` belongs to, so switching users re-merges instead of
   * pushing one person's lists into another's account. */
  const compteFusionne = useRef<string | null>(null)
  /** The live local state, for effects that must not re-run when it changes — the
   * merge effect is keyed on the account, not on the favourites. Written in an
   * effect and not during render: a ref assigned mid-render is a value React is
   * entitled to discard. */
  const etatCourant = useRef<EtatFavoris>(etat)
  const [demandes, setDemandes] = useState(0)
  /** When the last merge *started*, for the visibility throttle. Start, not finish:
   * a merge that is still running is not stale, and timing from the finish would let
   * a slow pull be re-triggered on top of itself. */
  const dernierTirage = useRef(0)

  useEffect(() => {
    etatCourant.current = etat
  }, [etat])

  const idCompte = utilisateur?.id ?? null

  // Derived, not stored. Signed out is always 'inactive', and progress belonging to
  // another account is not progress here — so a fresh sign-in reads as 'fusion'
  // instead of showing the previous session's stale 'a_jour'.
  const pertinent = progres !== null && idCompte !== null && progres.compte === idCompte
  const etatSynchro: EtatSynchro =
    idCompte === null ? 'inactive' : pertinent ? progres.etat : 'fusion'
  const erreur = pertinent ? progres.erreur : null
  const rapport = pertinent ? progres.rapport : null

  const resynchroniser = useCallback(() => {
    compteFusionne.current = null
    base.current = null
    setDemandes((n) => n + 1)
  }, [])

  const oublierRapport = useCallback(() => {
    setProgres((actuel) => (actuel === null ? null : { ...actuel, rapport: null }))
  }, [])

  const effacerDuCompte = useCallback(async () => {
    if (idCompte === null) {
      return { ok: false as const, message: 'Aucun compte n’est connecté.' }
    }
    // Disarm first: `base` null blocks the push effect, and `compteFusionne` left on
    // this account blocks the merge effect. Without both, the erase would race its
    // own re-upload and appear to have done nothing.
    base.current = null
    compteFusionne.current = idCompte
    try {
      const client = await obtenirClient()
      if (client === null) {
        return { ok: false as const, message: 'Le service de comptes est injoignable.' }
      }
      await effacerDonnees(client, idCompte)
      setProgres({ compte: idCompte, etat: 'inactive', erreur: null, rapport: null })
      return { ok: true as const }
    } catch (echec) {
      return { ok: false as const, message: messageDe(echec) }
    }
  }, [idCompte])

  // --- pull, merge, then push once -----------------------------------------
  useEffect(() => {
    if (idCompte === null) {
      base.current = null
      compteFusionne.current = null
      return
    }
    // The local state has to be read before it can be merged: merging against a
    // state that has not loaded yet would push an empty list up and delete the
    // spell rows it does not contain.
    if (!pret) return
    if (compteFusionne.current === idCompte) return
    compteFusionne.current = idCompte
    dernierTirage.current = Date.now()

    let vivant = true
    void (async () => {
      try {
        // Awaited before the first `setProgres`, so no state is written in the
        // synchronous part of the effect. Until it resolves, `etatSynchro` derives
        // to 'fusion' anyway — which is exactly what is happening.
        const client = await obtenirClient()
        if (client === null || !vivant) return
        const distant = await tirer(client, idCompte)
        if (!vivant) return
        const fusion = fusionner(etatCourant.current, distant)
        // Local first, then remote. If the push fails, the user still has
        // everything the merge found; the reverse order would show them a
        // successful sync over a state they cannot see.
        ecrire(fusion.etat)
        await pousser(client, idCompte, fusion.etat)
        if (!vivant) return
        base.current = fusion.etat
        setProgres({ compte: idCompte, etat: 'a_jour', erreur: null, rapport: fusion })
      } catch (echec) {
        if (!vivant) return
        // `base` stays null, so nothing will be pushed until a retry succeeds.
        // Favourites keep working locally throughout.
        compteFusionne.current = null
        setProgres({
          compte: idCompte,
          etat: 'erreur',
          erreur: messageDe(echec),
          rapport: null,
        })
      }
    })()

    return () => {
      vivant = false
    }
  }, [idCompte, pret, demandes])

  // --- pull again when the tab comes back, at most once a minute -----------
  //
  // `resynchroniser` and not a separate path: coming back to the tab wants exactly
  // what the button wants, and a second way to run the same merge is a second place
  // for the ordering rule to be got wrong. Signed out, nothing is listened for at
  // all — there is nothing to pull.
  useEffect(() => {
    if (idCompte === null) return

    function surRetour(): void {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - dernierTirage.current < DELAI_REVISITE_MS) return
      resynchroniser()
    }

    document.addEventListener('visibilitychange', surRetour)
    return () => {
      document.removeEventListener('visibilitychange', surRetour)
    }
  }, [idCompte, resynchroniser])

  // --- push local changes, debounced ---------------------------------------
  useEffect(() => {
    const precedent = base.current
    if (idCompte === null || precedent === null) return
    if (etat === precedent) return

    const minuteur = setTimeout(() => {
      void (async () => {
        try {
          const client = await obtenirClient()
          if (client === null) return
          setProgres((actuel) => ({
            compte: idCompte,
            etat: 'envoi',
            erreur: null,
            rapport: actuel?.compte === idCompte ? actuel.rapport : null,
          }))
          const disparues = listesDisparues(precedent, etat)
          // Buried before the push, so a list deleted here cannot be re-created by
          // the upsert that follows.
          await enterrer(client, idCompte, disparues, new Date().toISOString())
          await pousser(client, idCompte, etat)
          base.current = etat
          setProgres((actuel) => ({
            compte: idCompte,
            etat: 'a_jour',
            erreur: null,
            rapport: actuel?.compte === idCompte ? actuel.rapport : null,
          }))
        } catch (echec) {
          // `base` is left where it was: the next local change diffs against the
          // last state the server actually acknowledged, so a failed push retries
          // its own deletions rather than forgetting them.
          setProgres((actuel) => ({
            compte: idCompte,
            etat: 'erreur',
            erreur: messageDe(echec),
            rapport: actuel?.compte === idCompte ? actuel.rapport : null,
          }))
        }
      })()
    }, DELAI_ENVOI_MS)

    return () => {
      clearTimeout(minuteur)
    }
  }, [etat, idCompte])

  const valeur = useMemo<ValeurSynchro>(
    () => ({
      etatSynchro,
      rapport,
      erreur,
      resynchroniser,
      oublierRapport,
      effacerDuCompte,
    }),
    [etatSynchro, rapport, erreur, resynchroniser, oublierRapport, effacerDuCompte],
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

/** Read the sync status. Returns the inert default outside a provider rather than
 * throwing, unlike `useFavoris` and `useSession`: a view that merely *reports*
 * synchronisation is legitimate in a tree that has none, and 'inactive' is the
 * truthful answer there. */
export function useSynchro(): ValeurSynchro {
  return useContext(Contexte)
}
