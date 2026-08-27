'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Annonce, Bouton, ChampTexte } from '@/components/compte/elements'
import { LONGUEUR_MOT_DE_PASSE, useSession, type Resultat } from '@/lib/compte/session'
import { MOTS } from '@/lib/design/tokens'

/**
 * Where the e-mail link lands: choose a new password.
 *
 * This route needs no server, which is the only reason it can exist on a statically
 * exported site. The link comes back carrying a recovery token, `detectSessionInUrl`
 * exchanges it for a session in the browser, and `updateUser` then changes the
 * password on an authenticated request. Nothing is ever handled by us in between.
 *
 * That also explains the shape of the page: the whole thing hinges on `statut`
 * becoming `connecte`. A visitor here who is *not* connected did not follow a valid
 * link — expired, already used, or opened in a different browser than the one it was
 * requested from — and telling them that beats a form that would fail on submit.
 *
 * The confirmation field is checked here rather than by the provider, because the
 * provider cannot: it only ever sees one password. A typo in a password you cannot
 * read is the one mistake this form exists to catch.
 */
export function VueReinitialiser() {
  const { statut, definirMotDePasse } = useSession()
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [annonce, setAnnonce] = useState<Resultat | null>(null)
  const [enAttente, setEnAttente] = useState(false)
  const [fait, setFait] = useState(false)

  async function soumettre(): Promise<void> {
    if (motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
      setAnnonce({
        ok: false,
        message: `Le ${MOTS.motDePasse} doit faire au moins ${LONGUEUR_MOT_DE_PASSE} caractères.`,
      })
      return
    }
    if (motDePasse !== confirmation) {
      setAnnonce({ ok: false, message: 'Les deux saisies ne sont pas identiques.' })
      return
    }
    setEnAttente(true)
    setAnnonce(null)
    const resultat = await definirMotDePasse(motDePasse)
    setAnnonce(resultat)
    setEnAttente(false)
    if (resultat.ok) {
      setMotDePasse('')
      setConfirmation('')
      setFait(true)
    }
  }

  return (
    <section className="max-w-[46ch]">
      <h1 className="m-0 font-affichage text-titre1 font-semibold">Nouveau mot de passe</h1>

      {statut === 'hors_service' ? (
        <div className="mt-4">
          <Annonce ton="echec">
            Aucun service de {MOTS.compte} n’est configuré pour ce site.
          </Annonce>
        </div>
      ) : statut === 'inconnu' ? (
        <p className="mt-4 text-corps text-encre-douce" role="status">
          Vérification du lien en cours…
        </p>
      ) : statut === 'deconnecte' ? (
        <div className="mt-4 flex flex-col gap-3">
          <Annonce ton="echec">
            Ce lien n’ouvre pas de session. Il a expiré, il a déjà servi, ou il a été
            ouvert dans un autre navigateur que celui qui l’a demandé. Demandez-en un
            nouveau : rien n’a été modifié.
          </Annonce>
          <p className="m-0">
            <Link
              className="text-corps text-accent underline hover:text-accent-survol"
              href="/compte/mot-de-passe-oublie"
            >
              Demander un nouveau lien
            </Link>
          </p>
        </div>
      ) : fait ? (
        <div className="mt-4 flex flex-col gap-3">
          <Annonce ton="succes">
            {MOTS.motDePasse[0]!.toUpperCase() + MOTS.motDePasse.slice(1)} enregistré. Vous
            êtes connecté, et vos listes se synchronisent.
          </Annonce>
          <p className="m-0">
            <Link
              className="text-corps text-accent underline hover:text-accent-survol"
              href="/compte"
            >
              Aller au {MOTS.compte}
            </Link>
          </p>
        </div>
      ) : (
        <form
          className="mt-4 flex flex-col gap-3"
          noValidate
          onSubmit={(evenement) => {
            evenement.preventDefault()
            void soumettre()
          }}
        >
          <ChampTexte
            aide={`${LONGUEUR_MOT_DE_PASSE} caractères au minimum.`}
            autoComplete="new-password"
            etiquette="Nouveau mot de passe"
            id="reinit-mot-de-passe"
            minLongueur={LONGUEUR_MOT_DE_PASSE}
            surChangement={setMotDePasse}
            type="password"
            valeur={motDePasse}
          />
          <ChampTexte
            autoComplete="new-password"
            etiquette="Répéter le mot de passe"
            id="reinit-confirmation"
            surChangement={setConfirmation}
            type="password"
            valeur={confirmation}
          />
          {annonce === null ? null : (
            <Annonce ton={annonce.ok ? 'succes' : 'echec'}>
              {annonce.message ?? 'Terminé.'}
            </Annonce>
          )}
          <div>
            <Bouton enAttente={enAttente} libelleAttente="Enregistrement…" primaire type="submit">
              Enregistrer
            </Bouton>
          </div>
        </form>
      )}
    </section>
  )
}
