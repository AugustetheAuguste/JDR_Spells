'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Annonce, Bouton, ChampTexte } from '@/components/compte/elements'
import { useSession, type Resultat } from '@/lib/compte/session'
import { MOTS } from '@/lib/design/tokens'

/**
 * Change the account's e-mail address.
 *
 * Signed-in only, unlike `VueMotDePasseOublie` — there is no address to change
 * for someone who is not connected, and offering the form anyway would fail on
 * submit instead of saying so up front. Supabase confirms the change on both
 * addresses by default (« secure email change »): the success message says so,
 * because a silent success here would look like an immediate change it is not.
 */
export function VueChangerEmail() {
  const { statut, utilisateur, changerEmail } = useSession()
  const [nouvelEmail, setNouvelEmail] = useState('')
  const [annonce, setAnnonce] = useState<Resultat | null>(null)
  const [enAttente, setEnAttente] = useState(false)

  async function soumettre(): Promise<void> {
    setEnAttente(true)
    setAnnonce(null)
    setAnnonce(await changerEmail(nouvelEmail))
    setEnAttente(false)
  }

  return (
    <section className="max-w-[46ch]">
      <h1 className="m-0 font-affichage text-titre1 font-semibold">
        Changer d’{MOTS.adresseEmail}
      </h1>

      {statut === 'hors_service' ? (
        <div className="mt-4">
          <Annonce ton="echec">
            Aucun service de {MOTS.compte} n’est configuré pour ce site.
          </Annonce>
        </div>
      ) : statut === 'inconnu' ? (
        <p className="mt-4 text-corps text-encre-douce" role="status">
          Lecture de la session en cours…
        </p>
      ) : statut !== 'connecte' || utilisateur === null ? (
        <div className="mt-4 flex flex-col gap-3">
          <Annonce ton="echec">
            Changer d’{MOTS.adresseEmail} demande d’être connecté à un {MOTS.compte}.
          </Annonce>
          <p className="m-0">
            <Link className="text-corps text-accent underline hover:text-accent-survol" href="/compte">
              Aller au {MOTS.compte}
            </Link>
          </p>
        </div>
      ) : (
        <>
          <p className="mt-1 mb-5 text-corps text-encre-douce">
            {MOTS.adresseEmail[0]!.toUpperCase() + MOTS.adresseEmail.slice(1)} actuelle :{' '}
            <span className="font-donnees">{utilisateur.email}</span>
          </p>
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
              etiquette="Nouvelle adresse e-mail"
              id="changer-email-nouvelle"
              surChangement={setNouvelEmail}
              type="email"
              valeur={nouvelEmail}
            />
            {annonce === null ? null : (
              <Annonce ton={annonce.ok ? 'succes' : 'echec'}>
                {annonce.message ?? 'Terminé.'}
              </Annonce>
            )}
            <div>
              <Bouton enAttente={enAttente} libelleAttente="Envoi…" primaire type="submit">
                Envoyer les liens de confirmation
              </Bouton>
            </div>
          </form>
        </>
      )}

      <p className="mt-5 mb-0">
        <Link className="text-corps text-accent underline hover:text-accent-survol" href="/compte">
          Retour au {MOTS.compte}
        </Link>
      </p>
    </section>
  )
}
