'use client'

/**
 * The characters attached to an account.
 *
 * A hook and not a context, unlike `FournisseurSynchro`: exactly one page reads
 * this today (`VuePersonnages`), and a provider mounted at the root for one
 * consumer is a cost paid on every page for a feature most visits never touch.
 * If a second consumer appears — the picker on a favourites list, say — reaching
 * for a context then is the right move, not now. Step 16 (the UI for the feat
 * fields added to `personnages` — race, abilities, alignment, deity, feats
 * taken) is expected to be that second consumer; converting this hook into a
 * context belongs to that step, not to the schema change that only widens
 * `ChampsPersonnage`.
 *
 * Unlike favourites, `personnages` has no local-only existence: it is a plain
 * table behind Row Level Security, with no offline fallback. So this hook does
 * not try to be optimistic across a page reload the way `stockage.ts` is; it
 * refetches after every write instead of reconciling a local cache, because the
 * whole dataset for one person is at most a few dozen rows.
 */

import { useCallback, useEffect, useState } from 'react'

import { obtenirClient } from '@/lib/compte/client'
import {
  creerPersonnage,
  listerPersonnages,
  modifierPersonnage,
  supprimerPersonnage,
  type ChampsPersonnage,
  type LignePersonnage,
} from '@/lib/compte/distant'
import { useSession, type Resultat } from '@/lib/compte/session'

function messageDe(erreur: unknown): string {
  if (erreur instanceof Error) return erreur.message
  return 'Le service de comptes a échoué sans message. Réessayez.'
}

export interface ValeurPersonnages {
  readonly chargement: boolean
  readonly personnages: readonly LignePersonnage[]
  readonly erreur: string | null
  readonly recharger: () => void
  readonly creer: (
    nom: string,
    classe: string | null,
    niveau: number | null,
    champs?: ChampsPersonnage,
  ) => Promise<Resultat>
  readonly modifier: (
    id: string,
    nom: string,
    classe: string | null,
    niveau: number | null,
    champs?: ChampsPersonnage,
  ) => Promise<Resultat>
  readonly supprimer: (id: string) => Promise<Resultat>
}

export function usePersonnages(): ValeurPersonnages {
  const { statut, utilisateur } = useSession()
  const idCompte = statut === 'connecte' ? utilisateur?.id ?? null : null

  const [personnages, setPersonnages] = useState<readonly LignePersonnage[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [demandes, setDemandes] = useState(0)
  /** Which account's data `personnages` currently holds, or the account whose
   * fetch failed — `null` only before the very first result. Compared against
   * `idCompte` to derive `chargement`, the same way `FournisseurSynchro` compares
   * `progres.compte`: every write below happens inside the async callback, never
   * synchronously in the effect body. */
  const [compteCharge, setCompteCharge] = useState<string | null>(null)

  const recharger = useCallback(() => setDemandes((n) => n + 1), [])

  useEffect(() => {
    if (idCompte === null) return
    let vivant = true
    void (async () => {
      try {
        const client = await obtenirClient()
        if (client === null || !vivant) return
        const lignes = await listerPersonnages(client, idCompte)
        if (!vivant) return
        setPersonnages(lignes)
        setErreur(null)
        setCompteCharge(idCompte)
      } catch (echec) {
        if (!vivant) return
        setErreur(messageDe(echec))
        setCompteCharge(idCompte)
      }
    })()
    return () => {
      vivant = false
    }
  }, [idCompte, demandes])

  const chargement = idCompte !== null && compteCharge !== idCompte

  const creer = useCallback(
    async (
      nom: string,
      classe: string | null,
      niveau: number | null,
      champs?: ChampsPersonnage,
    ): Promise<Resultat> => {
      if (idCompte === null) return { ok: false, message: 'Aucun compte n’est connecté.' }
      try {
        const client = await obtenirClient()
        if (client === null) return { ok: false, message: 'Le service de comptes est injoignable.' }
        await creerPersonnage(client, idCompte, nom, classe, niveau, champs)
        recharger()
        return { ok: true, message: 'Personnage créé.' }
      } catch (echec) {
        return { ok: false, message: messageDe(echec) }
      }
    },
    [idCompte, recharger],
  )

  const modifier = useCallback(
    async (
      id: string,
      nom: string,
      classe: string | null,
      niveau: number | null,
      champs?: ChampsPersonnage,
    ): Promise<Resultat> => {
      if (idCompte === null) return { ok: false, message: 'Aucun compte n’est connecté.' }
      try {
        const client = await obtenirClient()
        if (client === null) return { ok: false, message: 'Le service de comptes est injoignable.' }
        await modifierPersonnage(client, idCompte, id, nom, classe, niveau, champs)
        recharger()
        return { ok: true, message: 'Personnage modifié.' }
      } catch (echec) {
        return { ok: false, message: messageDe(echec) }
      }
    },
    [idCompte, recharger],
  )

  const supprimer = useCallback(
    async (id: string): Promise<Resultat> => {
      if (idCompte === null) return { ok: false, message: 'Aucun compte n’est connecté.' }
      try {
        const client = await obtenirClient()
        if (client === null) return { ok: false, message: 'Le service de comptes est injoignable.' }
        await supprimerPersonnage(client, idCompte, id)
        recharger()
        return {
          ok: true,
          message:
            'Personnage supprimé. Les listes qui lui étaient attachées restent, sans personnage.',
        }
      } catch (echec) {
        return { ok: false, message: messageDe(echec) }
      }
    },
    [idCompte, recharger],
  )

  if (idCompte === null) {
    return { chargement: false, personnages: [], erreur: null, recharger, creer, modifier, supprimer }
  }
  return { chargement, personnages, erreur, recharger, creer, modifier, supprimer }
}
