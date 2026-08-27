'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { obtenirClient } from '@/lib/compte/client'
import { COMPTES_ACTIFS } from '@/lib/compte/configuration'

/**
 * Who is signed in, and the five things one can do about it.
 *
 * Unlike the favourites store, this genuinely is asynchronous: restoring a session
 * means reading storage *and* possibly refreshing a token over the network, so
 * there is no synchronous snapshot to hand `useSyncExternalStore`. State therefore
 * moves only inside promise callbacks and inside the `onAuthStateChange`
 * subscription, never in an effect body — which is both what
 * `react-hooks/set-state-in-effect` requires and what keeps the first paint from
 * cascading.
 *
 * `statut` has four values and no booleans, because the fourth is the one a
 * boolean pair always gets wrong: `inconnu` is *before we know*. An interface that
 * treats it as "signed out" flashes a login form at someone who is already signed
 * in, on every single page load.
 */

export type StatutSession =
  | 'hors_service'
  | 'inconnu'
  | 'deconnecte'
  | 'connecte'

export interface Utilisateur {
  readonly id: string
  readonly email: string
}

/** The result of an action, already translated. Never a raw provider message: they
 * are in English and written for whoever wrote the query. */
export type Resultat =
  | { readonly ok: true; readonly message?: string }
  | { readonly ok: false; readonly message: string }

export interface ValeurSession {
  readonly statut: StatutSession
  readonly utilisateur: Utilisateur | null
  readonly sInscrire: (email: string, motDePasse: string) => Promise<Resultat>
  readonly seConnecter: (email: string, motDePasse: string) => Promise<Resultat>
  readonly seDeconnecter: () => Promise<Resultat>
  readonly demanderReinitialisation: (email: string) => Promise<Resultat>
  readonly definirMotDePasse: (motDePasse: string) => Promise<Resultat>
}

const Contexte = createContext<ValeurSession | null>(null)

/** The shortest password the interface accepts, and the reason it is stated here
 * rather than discovered from a rejected request: Supabase's own floor is 6, and a
 * form that only learns the rule from the server makes the user pay a round trip to
 * be told a rule we already knew. */
export const LONGUEUR_MOT_DE_PASSE = 8

/**
 * Turn a provider error into a sentence a human can act on.
 *
 * Matching on message text is fragile, and it is still the right call: the
 * alternative is showing English, and the two failures that actually happen to a
 * group of friends — a typo in the password, and a captcha nobody remembers
 * enabling — deserve to be recognised. Anything unmatched falls through with its
 * original text appended, so an unknown cause is still diagnosable instead of
 * being flattened into "une erreur est survenue".
 */
export function traduireErreur(brut: string): string {
  const texte = brut.toLowerCase()
  if (texte.includes('invalid login credentials')) {
    return 'Adresse e-mail ou mot de passe incorrect.'
  }
  if (texte.includes('email not confirmed')) {
    return (
      'Ce compte n’est pas encore confirmé. Ouvrez le lien envoyé par e-mail à ' +
      'l’inscription, puis reconnectez-vous.'
    )
  }
  if (texte.includes('already registered') || texte.includes('already been registered')) {
    return 'Un compte existe déjà pour cette adresse. Connectez-vous, ou demandez un nouveau mot de passe.'
  }
  if (texte.includes('captcha')) {
    return (
      'Le service exige une vérification anti-robot que ce site n’affiche pas. ' +
      'Désactivez le captcha dans Supabase (Authentication → Attack Protection), ' +
      'ou fournissez sa clé de site pour qu’il soit intégré ici.'
    )
  }
  if (texte.includes('rate limit') || texte.includes('for security purposes')) {
    return (
      'Trop de tentatives ou trop d’e-mails en peu de temps : le service impose une ' +
      'pause. Réessayez dans quelques minutes.'
    )
  }
  if (texte.includes('password') && texte.includes('at least')) {
    return `Le mot de passe doit faire au moins ${LONGUEUR_MOT_DE_PASSE} caractères.`
  }
  if (texte.includes('failed to fetch') || texte.includes('networkerror')) {
    return 'Le service de comptes est injoignable. Vos favoris restent enregistrés dans ce navigateur.'
  }
  return `Le service de comptes a refusé la demande : ${brut}`
}

function messageDe(erreur: unknown): string {
  if (erreur instanceof Error) return traduireErreur(erreur.message)
  if (typeof erreur === 'string') return traduireErreur(erreur)
  return 'Le service de comptes a échoué sans message. Réessayez.'
}

/** Where an e-mail link comes back to. Derived from the current origin rather than
 * configured: the same build has to work on localhost and on the deployed domain,
 * and a hard-coded origin sends every reset link to the wrong one of the two.
 *
 * Both URLs must be listed in Supabase → Authentication → URL Configuration →
 * Redirect URLs, or the provider silently falls back to the Site URL. */
function retour(chemin: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}${chemin}`
}

export function FournisseurSession({ children }: { readonly children: ReactNode }) {
  const [statut, setStatut] = useState<StatutSession>(
    COMPTES_ACTIFS ? 'inconnu' : 'hors_service',
  )
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null)

  useEffect(() => {
    if (!COMPTES_ACTIFS) return
    let vivant = true
    let desabonner: (() => void) | null = null

    void (async () => {
      const client = await obtenirClient()
      if (client === null || !vivant) return

      // `onAuthStateChange` fires with the restored session too, but subscribing
      // first and reading second would race: the very first event can arrive
      // before the initial read resolves, and then the read overwrites it with a
      // staler value.
      const { data } = await client.auth.getSession()
      if (!vivant) return
      appliquer(data.session)

      const abonnement = client.auth.onAuthStateChange((_evenement, session) => {
        if (vivant) appliquer(session)
      })
      desabonner = () => {
        abonnement.data.subscription.unsubscribe()
      }
    })()

    function appliquer(session: { readonly user?: { id: string; email?: string } } | null): void {
      const compte = session?.user
      if (compte === undefined) {
        setUtilisateur(null)
        setStatut('deconnecte')
        return
      }
      setUtilisateur({ id: compte.id, email: compte.email ?? '' })
      setStatut('connecte')
    }

    return () => {
      vivant = false
      if (desabonner !== null) desabonner()
    }
  }, [])

  const indisponible = useCallback(
    (): Resultat => ({
      ok: false,
      message:
        'Aucun service de comptes n’est configuré pour ce site. Les favoris restent ' +
        'enregistrés dans ce navigateur.',
    }),
    [],
  )

  const valeur = useMemo<ValeurSession>(
    () => ({
      statut,
      utilisateur,

      sInscrire: async (email, motDePasse) => {
        const client = await obtenirClient()
        if (client === null) return indisponible()
        try {
          const cible = retour('/compte/')
          const { data, error } = await client.auth.signUp({
            email,
            password: motDePasse,
            ...(cible === undefined ? {} : { options: { emailRedirectTo: cible } }),
          })
          if (error !== null) return { ok: false, message: traduireErreur(error.message) }
          // No session means e-mail confirmation is on, which is the configuration
          // we asked for. Saying so is the whole point: a silent success here looks
          // like a login that did not happen.
          if (data.session === null) {
            return {
              ok: true,
              message:
                'Compte créé. Un e-mail de confirmation vient de partir : ouvrez son ' +
                'lien, puis connectez-vous.',
            }
          }
          return { ok: true, message: 'Compte créé et connexion établie.' }
        } catch (erreur) {
          return { ok: false, message: messageDe(erreur) }
        }
      },

      seConnecter: async (email, motDePasse) => {
        const client = await obtenirClient()
        if (client === null) return indisponible()
        try {
          const { error } = await client.auth.signInWithPassword({
            email,
            password: motDePasse,
          })
          if (error !== null) return { ok: false, message: traduireErreur(error.message) }
          return { ok: true }
        } catch (erreur) {
          return { ok: false, message: messageDe(erreur) }
        }
      },

      seDeconnecter: async () => {
        const client = await obtenirClient()
        if (client === null) return indisponible()
        try {
          const { error } = await client.auth.signOut()
          if (error !== null) return { ok: false, message: traduireErreur(error.message) }
          return {
            ok: true,
            message:
              'Déconnecté. Vos listes restent dans ce navigateur, et sur le compte ' +
              'telles qu’elles y ont été envoyées.',
          }
        } catch (erreur) {
          return { ok: false, message: messageDe(erreur) }
        }
      },

      demanderReinitialisation: async (email) => {
        const client = await obtenirClient()
        if (client === null) return indisponible()
        try {
          const cible = retour('/compte/reinitialiser/')
          const { error } = await client.auth.resetPasswordForEmail(
            email,
            cible === undefined ? {} : { redirectTo: cible },
          )
          if (error !== null) return { ok: false, message: traduireErreur(error.message) }
          // Deliberately the same answer whether or not the address has an
          // account: signup is open, so confirming which e-mails are registered
          // would turn this form into a membership oracle.
          return {
            ok: true,
            message:
              'Si un compte existe pour cette adresse, un lien de réinitialisation ' +
              'vient d’y être envoyé.',
          }
        } catch (erreur) {
          return { ok: false, message: messageDe(erreur) }
        }
      },

      definirMotDePasse: async (motDePasse) => {
        const client = await obtenirClient()
        if (client === null) return indisponible()
        try {
          const { error } = await client.auth.updateUser({ password: motDePasse })
          if (error !== null) return { ok: false, message: traduireErreur(error.message) }
          return { ok: true, message: 'Mot de passe enregistré.' }
        } catch (erreur) {
          return { ok: false, message: messageDe(erreur) }
        }
      },
    }),
    [statut, utilisateur, indisponible],
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

/**
 * Read the session.
 *
 * Throws when the provider is missing, like `useFavoris`: a silent stub would make
 * every button a no-op, and a no-op login looks like a broken service rather than a
 * missing provider.
 */
export function useSession(): ValeurSession {
  const valeur = useContext(Contexte)
  if (valeur === null) {
    throw new Error('useSession hors de FournisseurSession')
  }
  return valeur
}
