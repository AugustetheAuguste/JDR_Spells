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
import { useSession } from '@/lib/compte/session'
import { ecrireFichesDistantes, lireFichesDistantes } from '@/lib/fiche_personnage/distant'
import { fusionner, type Conflit } from '@/lib/fiche_personnage/fusion'
import { useFiches } from '@/lib/fiche_personnage/contexte-fiches'
import { ecrire as ecrireLocal, supprimer as supprimerLocal } from '@/lib/fiche_personnage/magasin'

import type { LigneFiche } from '@/lib/fiche_personnage/distant'
import type { Fiche } from '@/lib/fiche_personnage/schema'

/**
 * Synchronisation of character sheets, on the model of `SynchroFavoris.tsx`
 * in shape, but with two rules `SynchroFavoris` does not need.
 *
 * **The "never proposed" set.** A sheet created before the very first
 * sign-in must not be uploaded the moment a session restores — the rule
 * that "a sheet present on one side only goes to the other, no question
 * asked" (`fusion.ts` rule 1) is written for sheets *already part of the
 * synchronised set* (created on another device, or previously proposed and
 * declined). A brand-new local sheet has never been part of that set. This
 * component therefore never hands `fusionner` the full local list: it
 * splits it first into `connues` (known to the account already, i.e.
 * present among the remote rows) and `jamaisProposees` (everything else).
 * Only `connues` goes through `fusionner`; `jamaisProposees` is exposed as
 * `propositions`, and the only way one of them reaches the account is the
 * explicit `proposer(id)` call `PropositionMontee.tsx` makes on a click.
 *
 * **"Ignorer" persists.** Declining a proposition has to survive a reload,
 * or the same three sheets would resurface on every visit to `/compte`.
 * The set of ignored ids is kept in its own `localStorage` key,
 * `pf-fiche-propositions-ignorees`, deliberately outside `pf-fiche:` and
 * `pf-fiche-secours:` (`magasin.ts`'s prefixes) — it is not a sheet, and a
 * scan for the sheet prefix must never pick it up.
 */

const CLE_IGNOREES = 'pf-fiche-propositions-ignorees'

function lireIgnorees(): ReadonlySet<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const brut = window.localStorage.getItem(CLE_IGNOREES)
    if (brut === null) return new Set()
    const valeur: unknown = JSON.parse(brut)
    if (!Array.isArray(valeur)) return new Set()
    return new Set(valeur.filter((element): element is string => typeof element === 'string'))
  } catch {
    return new Set()
  }
}

function ecrireIgnorees(ignorees: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CLE_IGNOREES, JSON.stringify([...ignorees]))
}

export type EtatSynchroFiches =
  | 'inactive'
  | 'fusion'
  | 'a_jour'
  | 'envoi'
  | 'erreur'

export type ChoixConflit = 'locale' | 'distante' | 'les_deux'

export interface ValeurSynchroFiches {
  readonly etatSynchro: EtatSynchroFiches
  readonly erreur: string | null
  readonly propositions: readonly Fiche[]
  readonly conflits: readonly Conflit[]
  readonly proposer: (id: string) => Promise<void>
  readonly ignorerProposition: (id: string) => void
  readonly resoudreConflit: (id: string, choix: ChoixConflit) => Promise<void>
  readonly resynchroniser: () => void
}

const Contexte = createContext<ValeurSynchroFiches>({
  etatSynchro: 'inactive',
  erreur: null,
  propositions: [],
  conflits: [],
  proposer: () => Promise.resolve(),
  ignorerProposition: () => {},
  resoudreConflit: () => Promise.resolve(),
  resynchroniser: () => {},
})

function messageDe(erreur: unknown): string {
  if (erreur instanceof Error) return erreur.message
  return 'La synchronisation des fiches a échoué sans message.'
}

function versLigneFiche(fiche: Fiche): LigneFiche {
  return {
    id_fiche: fiche.id,
    schema_version: fiche.schemaVersion,
    contenu: fiche as unknown as Record<string, unknown>,
    nom: fiche.meta.nomPersonnage,
    cree_le: fiche.meta.creeLe === '' ? null : fiche.meta.creeLe,
    modifie_le: fiche.meta.modifieLe === '' ? null : fiche.meta.modifieLe,
    supprime_le: null,
    personnage_id: fiche.personnageId,
  }
}

export function FournisseurSynchroFiches({ children }: { readonly children: ReactNode }) {
  const { utilisateur } = useSession()
  const { fiches, chargement, recharger } = useFiches()

  const [etatSynchro, setEtatSynchro] = useState<EtatSynchroFiches>('inactive')
  const [erreur, setErreur] = useState<string | null>(null)
  const [distantes, setDistantes] = useState<readonly LigneFiche[]>([])
  const [conflits, setConflits] = useState<readonly Conflit[]>([])
  // Lazy initial state, on the model of `contexte-fiches.tsx`'s
  // `lireEtatInitial`: read once during the first render rather than in an
  // effect, since `lireIgnorees` already guards the server/no-window case.
  const [ignorees, setIgnorees] = useState<ReadonlySet<string>>(() => lireIgnorees())

  const compteFusionne = useRef<string | null>(null)
  const [demandes, setDemandes] = useState(0)
  const compteur = useRef(0)

  const idCompte = utilisateur?.id ?? null

  const idsDistants = useMemo(() => new Set(distantes.map((ligne) => ligne.id_fiche)), [distantes])

  // "Never proposed": absent from the account and never declined either.
  const propositions = useMemo(
    () => fiches.filter((fiche) => !idsDistants.has(fiche.id) && !ignorees.has(fiche.id)),
    [fiches, idsDistants, ignorees],
  )

  const resynchroniser = useCallback(() => {
    compteFusionne.current = null
    setDemandes((n) => n + 1)
  }, [])

  useEffect(() => {
    if (idCompte === null) {
      compteFusionne.current = null
      // Deferred rather than called directly in the effect body: signing out
      // is not "the render's own external system" being synchronised, it is
      // a state transition, and `react-hooks/set-state-in-effect` wants it
      // scheduled rather than run inline — the same reasoning that already
      // has every other branch of this effect update state from inside the
      // async callback below, never at the top of the effect body.
      void Promise.resolve().then(() => {
        setEtatSynchro('inactive')
        setDistantes([])
        setConflits([])
      })
      return
    }
    if (chargement) return
    if (compteFusionne.current === idCompte) return
    compteFusionne.current = idCompte

    let vivant = true
    setEtatSynchro('fusion')
    void (async () => {
      try {
        const client = await obtenirClient()
        if (client === null || !vivant) return
        const lecture = await lireFichesDistantes(client)
        if (!vivant) return
        if (!lecture.ok) throw new Error(lecture.motif)

        setDistantes(lecture.valeur)

        // Only sheets already part of the synchronised set — cf. module
        // docstring — are handed to the merge. A sheet never proposed stays
        // out of `fusionner` entirely, so rule 1 never auto-uploads it.
        const idsConnusDistant = new Set(lecture.valeur.map((ligne) => ligne.id_fiche))
        const connues = fiches.filter((fiche) => idsConnusDistant.has(fiche.id))

        const rapport = fusionner(connues, lecture.valeur, new Date())

        for (const fiche of rapport.aEcrireEnLocal) {
          ecrireLocal(window.localStorage, fiche)
        }
        for (const id of rapport.aSupprimerLocalement) {
          supprimerLocal(window.localStorage, id)
        }
        if (rapport.aEcrireEnDistant.length > 0) {
          const ecriture = await ecrireFichesDistantes(client, idCompte, rapport.aEcrireEnDistant)
          if (!ecriture.ok) throw new Error(ecriture.motif)
        }

        recharger()
        if (!vivant) return
        setConflits(rapport.conflits)
        setErreur(null)
        setEtatSynchro('a_jour')
      } catch (echec) {
        if (!vivant) return
        compteFusionne.current = null
        setErreur(messageDe(echec))
        setEtatSynchro('erreur')
      }
    })()

    return () => {
      vivant = false
    }
    // `fiches`/`recharger` deliberately excluded: this effect runs once per
    // account (or on `resynchroniser`), not on every local edit — a
    // continuous re-merge here would race the debounced push below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCompte, chargement, demandes])

  const proposer = useCallback(
    async (id: string): Promise<void> => {
      if (idCompte === null) return
      const fiche = fiches.find((candidate) => candidate.id === id)
      if (fiche === undefined) return
      const client = await obtenirClient()
      if (client === null) return
      setEtatSynchro('envoi')
      try {
        const ecriture = await ecrireFichesDistantes(client, idCompte, [versLigneFiche(fiche)])
        if (!ecriture.ok) throw new Error(ecriture.motif)
        setDistantes((actuelles) => [
          ...actuelles.filter((ligne) => ligne.id_fiche !== id),
          versLigneFiche(fiche),
        ])
        setEtatSynchro('a_jour')
      } catch (echec) {
        setErreur(messageDe(echec))
        setEtatSynchro('erreur')
      }
    },
    [idCompte, fiches],
  )

  const ignorerProposition = useCallback((id: string): void => {
    setIgnorees((actuelles) => {
      const suivantes = new Set(actuelles)
      suivantes.add(id)
      ecrireIgnorees(suivantes)
      return suivantes
    })
  }, [])

  const graine = useCallback((): string => {
    compteur.current += 1
    return `f${Date.now().toString(36)}${compteur.current.toString(36)}`
  }, [])

  const resoudreConflit = useCallback(
    async (id: string, choix: ChoixConflit): Promise<void> => {
      if (idCompte === null) return
      const conflit = conflits.find((candidat) => candidat.id === id)
      if (conflit === undefined) return
      const client = await obtenirClient()
      if (client === null) return

      try {
        if (choix === 'locale') {
          const ecriture = await ecrireFichesDistantes(client, idCompte, [versLigneFiche(conflit.locale)])
          if (!ecriture.ok) throw new Error(ecriture.motif)
          setDistantes((actuelles) => [
            ...actuelles.filter((ligne) => ligne.id_fiche !== id),
            versLigneFiche(conflit.locale),
          ])
        } else if (choix === 'distante') {
          const distanteCommeLocal: Fiche = conflit.distante.contenu as unknown as Fiche
          const resultat = ecrireLocal(window.localStorage, distanteCommeLocal)
          if (!resultat.ok) throw new Error(resultat.motif)
        } else {
          // Garder les deux : la fiche locale garde son identifiant, la
          // version distante devient une nouvelle fiche locale, et les deux
          // repartent vers le compte sous deux identifiants distincts.
          const nouvelId = graine()
          const distanteCommeLocal: Fiche = conflit.distante.contenu as unknown as Fiche
          const copie: Fiche = { ...distanteCommeLocal, id: nouvelId }
          const resultat = ecrireLocal(window.localStorage, copie)
          if (!resultat.ok) throw new Error(resultat.motif)
          const ecriture = await ecrireFichesDistantes(client, idCompte, [
            versLigneFiche(conflit.locale),
            versLigneFiche(copie),
          ])
          if (!ecriture.ok) throw new Error(ecriture.motif)
          setDistantes((actuelles) => [
            ...actuelles.filter((ligne) => ligne.id_fiche !== id),
            versLigneFiche(conflit.locale),
            versLigneFiche(copie),
          ])
        }
        recharger()
        setConflits((actuels) => actuels.filter((candidat) => candidat.id !== id))
      } catch (echec) {
        setErreur(messageDe(echec))
        setEtatSynchro('erreur')
      }
    },
    [idCompte, conflits, recharger, graine],
  )

  const valeur = useMemo<ValeurSynchroFiches>(
    () => ({
      etatSynchro,
      erreur,
      propositions,
      conflits,
      proposer,
      ignorerProposition,
      resoudreConflit,
      resynchroniser,
    }),
    [etatSynchro, erreur, propositions, conflits, proposer, ignorerProposition, resoudreConflit, resynchroniser],
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

/**
 * Read the sheet-sync status. Returns the inert default outside a provider,
 * like `useSynchro` — a view that merely reports status is legitimate in a
 * tree with none.
 *
 * `marquerSupprimee` (`distant.ts`) is intentionally not called from
 * anywhere in this file: `useFiches().supprimer` only removes a sheet
 * locally (plus its rescue copy, cf. `magasin.ts`), and this step's spec
 * scopes the UI to proposing, merging and resolving conflicts — wiring a
 * remote tombstone to the existing delete button is a follow-up, not part
 * of this component.
 */
export function useSynchroFiches(): ValeurSynchroFiches {
  return useContext(Contexte)
}
