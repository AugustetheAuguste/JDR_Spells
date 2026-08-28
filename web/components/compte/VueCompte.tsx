'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Annonce, Bouton, ChampTexte } from '@/components/compte/elements'
import { useSynchro } from '@/lib/compte/SynchroFavoris'
import { LONGUEUR_MOT_DE_PASSE, useSession, type Resultat } from '@/lib/compte/session'
import { MOTS } from '@/lib/design/tokens'

/**
 * The account route: sign in, sign up, and what synchronisation is currently doing.
 *
 * The page states the trade the user is making, in the first paragraph, before any
 * field: favourites already work without an account, and the account buys exactly
 * one thing — the same lists on a second device. Saying it up front is what stops
 * the login form from reading as a wall in front of a site that has none.
 *
 * Every branch below is on `statut`, never on `utilisateur !== null`. The state
 * `inconnu` is why: a session is restored asynchronously, and treating "not yet
 * known" as "signed out" flashes a login form at someone already signed in on every
 * page load.
 */
export function VueCompte() {
  const { statut, utilisateur } = useSession()

  return (
    <section>
      <h1 className="m-0 font-affichage text-titre1 font-semibold">Compte</h1>
      <p className="mt-1 mb-5 max-w-[68ch] text-corps text-encre-douce">
        Les {MOTS.favoris} fonctionnent sans {MOTS.compte} : ils sont enregistrés dans ce
        navigateur. Un {MOTS.compte} n’ajoute qu’une chose — retrouver les mêmes listes
        sur un autre appareil. Il ne conditionne l’accès à aucun {MOTS.sort}.
      </p>

      {statut === 'hors_service' ? (
        <HorsService />
      ) : statut === 'inconnu' ? (
        <p className="text-corps text-encre-douce" role="status">
          Lecture de la session en cours…
        </p>
      ) : statut === 'connecte' && utilisateur !== null ? (
        <PanneauConnecte courriel={utilisateur.email} />
      ) : (
        <FormulaireIdentification />
      )}
    </section>
  )
}

/** No service configured. Not an error: a clone of this repository without
 * `.env.local` is a legitimate, fully working build, and the page says which
 * variables would turn accounts on rather than pretending something broke. */
function HorsService() {
  return (
    <div className="rounded-panneau border border-bord bg-surface px-4 py-4">
      <p className="m-0 font-affichage text-titre3 font-semibold">
        Aucun service de {MOTS.compte} n’est configuré pour ce site.
      </p>
      <p className="mt-2 mb-0 max-w-[68ch] text-corps text-encre-douce">
        Ce n’est pas une panne : les {MOTS.favoris} continuent de fonctionner dans ce
        navigateur, et le reste du site est identique. La {MOTS.synchronisation} demande
        deux variables au build,{' '}
        <code className="font-donnees text-petit">NEXT_PUBLIC_SUPABASE_URL</code> et{' '}
        <code className="font-donnees text-petit">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> —
        voir <code className="font-donnees text-petit">web/.env.example</code>.
      </p>
      <p className="mt-3 mb-0">
        <Link className="text-corps text-accent underline hover:text-accent-survol" href="/favoris">
          Aller aux {MOTS.favoris}
        </Link>
      </p>
    </div>
  )
}

/** The signed-in panel: who you are, what sync is doing, and the two ways out. */
function PanneauConnecte({ courriel }: { readonly courriel: string }) {
  const { seDeconnecter } = useSession()
  const { etatSynchro, rapport, erreur, resynchroniser, oublierRapport, effacerDuCompte } =
    useSynchro()
  const [annonce, setAnnonce] = useState<Resultat | null>(null)
  const [effacementDemande, setEffacementDemande] = useState(false)
  const [enAttente, setEnAttente] = useState(false)

  async function deconnecter(): Promise<void> {
    setEnAttente(true)
    setAnnonce(await seDeconnecter())
    setEnAttente(false)
  }

  async function effacer(): Promise<void> {
    setEnAttente(true)
    const resultat = await effacerDuCompte()
    if (!resultat.ok) {
      setAnnonce(resultat)
      setEnAttente(false)
      setEffacementDemande(false)
      return
    }
    // Signing out is part of the erasure, not an extra step: staying connected
    // would let the next local change upload everything that was just removed.
    await seDeconnecter()
    setEnAttente(false)
    setEffacementDemande(false)
    setAnnonce({
      ok: true,
      message:
        'Les listes enregistrées sur le compte ont été effacées et la session est ' +
        'fermée. Vos listes de ce navigateur sont intactes.',
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-panneau border border-bord bg-surface px-4 py-4">
        <p className="m-0 text-petit font-medium text-encre-douce">Connecté en tant que</p>
        <p className="mt-1 mb-0 font-donnees text-corps text-encre">{courriel}</p>
        <p className="mt-2 mb-0">
          <Link
            className="text-petit text-accent underline hover:text-accent-survol"
            href="/compte/changer-email"
          >
            Changer d’{MOTS.adresseEmail}
          </Link>
        </p>
      </div>

      <div className="rounded-panneau border border-bord bg-surface px-4 py-4">
        <h2 className="m-0 font-affichage text-titre3 font-semibold">
          {MOTS.synchronisation[0]!.toUpperCase() + MOTS.synchronisation.slice(1)}
        </h2>
        <p className="mt-2 mb-0 max-w-[68ch] text-corps text-encre-douce">
          {etatSynchro === 'fusion'
            ? 'Vos listes de ce navigateur sont en cours de fusion avec celles du compte.'
            : etatSynchro === 'envoi'
              ? 'Une modification est en cours d’envoi.'
              : etatSynchro === 'a_jour'
                ? 'Ce navigateur et le compte portent les mêmes listes.'
                : etatSynchro === 'erreur'
                  ? 'La dernière tentative a échoué. Vos listes restent enregistrées dans ce navigateur, rien n’est perdu.'
                  : 'Aucune synchronisation en cours.'}
        </p>

        {erreur === null ? null : (
          <div className="mt-3">
            <Annonce ton="echec">{erreur}</Annonce>
          </div>
        )}

        {rapport === null ? null : (
          <div className="mt-3 rounded-jeton border border-bord bg-base px-3 py-2">
            <p className="m-0 text-corps">
              {rapport.listes_recues === 0 &&
              rapport.sorts_recus === 0 &&
              rapport.listes_supprimees === 0
                ? 'La fusion n’a rien changé : les deux côtés étaient déjà identiques.'
                : [
                    rapport.listes_recues > 0
                      ? `${rapport.listes_recues} liste(s) reçue(s) du compte`
                      : null,
                    rapport.sorts_recus > 0
                      ? `${rapport.sorts_recus} ${MOTS.sort}(s) ajouté(s) à vos listes`
                      : null,
                    rapport.listes_fusionnees > 0
                      ? `${rapport.listes_fusionnees} liste(s) présente(s) des deux côtés fusionnée(s)`
                      : null,
                    rapport.listes_supprimees > 0
                      ? `${rapport.listes_supprimees} liste(s) retirée(s) ici, supprimée(s) depuis un autre appareil`
                      : null,
                  ]
                    .filter((partie) => partie !== null)
                    .join(', ') + '.'}
            </p>
            <div className="mt-2">
              <Bouton surClic={oublierRapport}>Compris</Bouton>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Bouton enAttente={etatSynchro === 'fusion' || etatSynchro === 'envoi'} surClic={resynchroniser}>
            {MOTS.synchroniserMaintenant}
          </Bouton>
          <Link
            className="rounded-jeton border border-bord-fort bg-surface px-3 py-2 text-corps font-medium text-encre hover:bg-survol"
            href="/favoris"
          >
            Voir mes listes
          </Link>
        </div>
      </div>

      <div className="rounded-panneau border border-bord bg-surface px-4 py-4">
        <h2 className="m-0 font-affichage text-titre3 font-semibold">Personnages</h2>
        <p className="mt-2 mb-0 max-w-[68ch] text-corps text-encre-douce">
          Attachez une liste de {MOTS.favoris} à un personnage pour la retrouver par son
          nom plutôt que par la vôtre.
        </p>
        <div className="mt-3">
          <Link
            className="rounded-jeton border border-bord-fort bg-surface px-3 py-2 text-corps font-medium text-encre hover:bg-survol"
            href="/compte/personnages"
          >
            Gérer mes personnages
          </Link>
        </div>
      </div>

      {annonce === null ? null : (
        <Annonce ton={annonce.ok ? 'succes' : 'echec'}>
          {annonce.message ?? 'Terminé.'}
        </Annonce>
      )}

      <div className="flex flex-wrap gap-2">
        <Bouton enAttente={enAttente} libelleAttente="Déconnexion…" surClic={() => void deconnecter()}>
          {MOTS.seDeconnecter}
        </Bouton>
      </div>

      <div className="rounded-panneau border border-bord bg-surface px-4 py-4">
        <h2 className="m-0 font-affichage text-titre3 font-semibold">Effacer mes données</h2>
        <p className="mt-2 mb-0 max-w-[68ch] text-corps text-encre-douce">
          Le {MOTS.compte} ne contient que votre {MOTS.adresseEmail} et vos listes de{' '}
          {MOTS.favoris}. Le bouton ci-dessous efface les listes du serveur et ferme la
          session ; <strong>les listes de ce navigateur ne sont pas touchées</strong>.
          L’identifiant de connexion lui-même est retiré par l’administrateur depuis le
          tableau de bord Supabase — un site sans serveur ne peut pas le faire lui-même.
        </p>
        {effacementDemande ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="m-0 text-corps">Effacer les listes enregistrées sur le compte ?</p>
            <Bouton enAttente={enAttente} libelleAttente="Effacement…" primaire surClic={() => void effacer()}>
              Oui, effacer
            </Bouton>
            <Bouton surClic={() => setEffacementDemande(false)}>Annuler</Bouton>
          </div>
        ) : (
          <div className="mt-3">
            <Bouton surClic={() => setEffacementDemande(true)}>
              Effacer mes listes du {MOTS.compte}
            </Bouton>
          </div>
        )}
      </div>
    </div>
  )
}

/** Sign in and sign up, as one form with two modes.
 *
 * One form rather than two routes because the two differ by a single field's
 * `autoComplete` and a single call — and because a friend handed a link does not
 * know which of the two they need. The mode is a pair of buttons carrying
 * `aria-pressed`, so the current one is announced and not merely coloured. */
function FormulaireIdentification() {
  const { seConnecter, sInscrire } = useSession()
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion')
  const [courriel, setCourriel] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [annonce, setAnnonce] = useState<Resultat | null>(null)
  const [enAttente, setEnAttente] = useState(false)

  const inscription = mode === 'inscription'

  function changerMode(suivant: 'connexion' | 'inscription'): void {
    setMode(suivant)
    // The announcement belonged to the other mode. Keeping it would leave "adresse
    // ou mot de passe incorrect" sitting above a registration form.
    setAnnonce(null)
    setMotDePasse('')
  }

  async function soumettre(): Promise<void> {
    if (inscription && motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
      setAnnonce({
        ok: false,
        message: `Le ${MOTS.motDePasse} doit faire au moins ${LONGUEUR_MOT_DE_PASSE} caractères.`,
      })
      return
    }
    setEnAttente(true)
    setAnnonce(null)
    const resultat = inscription
      ? await sInscrire(courriel, motDePasse)
      : await seConnecter(courriel, motDePasse)
    setAnnonce(resultat)
    setEnAttente(false)
    if (resultat.ok) setMotDePasse('')
  }

  return (
    <div className="max-w-[46ch]">
      {/* The two toggles must not share their accessible name with the submit
          button below. They did at first — "Se connecter" appeared twice — and a
          screen reader then announces two buttons that sound identical and do
          different things. The labels here name the *situation*, the submit button
          names the *action*. */}
      <div aria-label="J’ai un compte, ou non" className="mb-4 flex gap-2" role="group">
        <button
          aria-pressed={!inscription}
          className={[
            'rounded-jeton border px-3 py-2 text-corps font-medium',
            inscription
              ? 'border-bord-fort bg-surface text-encre hover:bg-survol'
              : 'border-accent bg-accent-voile font-semibold text-accent',
          ].join(' ')}
          onClick={() => changerMode('connexion')}
          type="button"
        >
          J’ai déjà un {MOTS.compte}
        </button>
        <button
          aria-pressed={inscription}
          className={[
            'rounded-jeton border px-3 py-2 text-corps font-medium',
            inscription
              ? 'border-accent bg-accent-voile font-semibold text-accent'
              : 'border-bord-fort bg-surface text-encre hover:bg-survol',
          ].join(' ')}
          onClick={() => changerMode('inscription')}
          type="button"
        >
          Je n’en ai pas encore
        </button>
      </div>

      <form
        className="flex flex-col gap-3"
        noValidate
        onSubmit={(evenement) => {
          evenement.preventDefault()
          void soumettre()
        }}
      >
        <ChampTexte
          autoComplete="email"
          etiquette="Adresse e-mail"
          id="compte-courriel"
          surChangement={setCourriel}
          type="email"
          valeur={courriel}
        />
        <ChampTexte
          // `new-password` on sign-up and `current-password` on sign-in: getting
          // these two the wrong way round is what makes a password manager save
          // the wrong entry, and nobody notices until a friend cannot sign in.
          autoComplete={inscription ? 'new-password' : 'current-password'}
          etiquette="Mot de passe"
          {...(inscription
            ? {
                aide: `${LONGUEUR_MOT_DE_PASSE} caractères au minimum.`,
                minLongueur: LONGUEUR_MOT_DE_PASSE,
              }
            : {})}
          id="compte-mot-de-passe"
          surChangement={setMotDePasse}
          type="password"
          valeur={motDePasse}
        />

        {annonce === null ? null : (
          <Annonce ton={annonce.ok ? 'succes' : 'echec'}>
            {annonce.message ?? 'Terminé.'}
          </Annonce>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Bouton
            enAttente={enAttente}
            libelleAttente={inscription ? 'Création…' : 'Connexion…'}
            primaire
            type="submit"
          >
            {inscription ? MOTS.creerUnCompte : MOTS.seConnecter}
          </Bouton>
          <Link
            className="text-corps text-accent underline hover:text-accent-survol"
            href="/compte/mot-de-passe-oublie"
          >
            {MOTS.motDePasseOublie} ?
          </Link>
        </div>
      </form>

      <p className="mt-4 mb-0 max-w-[52ch] text-petit text-encre-faible">
        {inscription
          ? 'La création demande une confirmation par e-mail : ouvrez le lien reçu avant de vous connecter.'
          : 'Vos listes de ce navigateur seront fusionnées avec celles du compte, sans en perdre aucune.'}
      </p>
    </div>
  )
}
