'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Annonce, Bouton, ChampTexte } from '@/components/compte/elements'
import { useSession, type Resultat } from '@/lib/compte/session'
import { MOTS } from '@/lib/design/tokens'

/**
 * Ask for a reset link.
 *
 * The answer is the same whether or not the address has an account, and that is a
 * decision rather than vagueness: sign-up is open to anyone with the URL, so a form
 * that confirmed which addresses are registered would be a membership oracle for
 * this group of friends. `demanderReinitialisation` is where that sameness lives; the
 * page only has to not undo it.
 */
export function VueMotDePasseOublie() {
  const { statut, demanderReinitialisation } = useSession()
  const [courriel, setCourriel] = useState('')
  const [annonce, setAnnonce] = useState<Resultat | null>(null)
  const [enAttente, setEnAttente] = useState(false)

  async function soumettre(): Promise<void> {
    setEnAttente(true)
    setAnnonce(null)
    setAnnonce(await demanderReinitialisation(courriel))
    setEnAttente(false)
  }

  return (
    <section className="max-w-[46ch]">
      <h1 className="m-0 font-affichage text-titre1 font-semibold">{MOTS.motDePasseOublie}</h1>
      <p className="mt-1 mb-5 text-corps text-encre-douce">
        Indiquez l’{MOTS.adresseEmail} du {MOTS.compte}. Un lien vous permettra d’en
        choisir un nouveau.
      </p>

      {statut === 'hors_service' ? (
        <Annonce ton="echec">
          Aucun service de {MOTS.compte} n’est configuré pour ce site, il n’y a donc aucun{' '}
          {MOTS.motDePasse} à réinitialiser.
        </Annonce>
      ) : (
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
            id="oubli-courriel"
            surChangement={setCourriel}
            type="email"
            valeur={courriel}
          />
          {annonce === null ? null : (
            <Annonce ton={annonce.ok ? 'succes' : 'echec'}>
              {annonce.message ?? 'Terminé.'}
            </Annonce>
          )}
          <div>
            <Bouton enAttente={enAttente} libelleAttente="Envoi…" primaire type="submit">
              Envoyer le lien
            </Bouton>
          </div>
        </form>
      )}

      <p className="mt-5 mb-0">
        <Link
          className="inline-flex min-h-cible items-center text-corps text-accent underline hover:text-accent-survol"
          href="/compte"
        >
          Retour au {MOTS.compte}
        </Link>
      </p>
    </section>
  )
}
