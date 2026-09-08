'use client'

import { useState } from 'react'

import { MOTS } from '@/lib/design/tokens'
import { useSynchroFiches } from '@/lib/fiche_personnage/SynchroFiches'

/**
 * Lists the sheets that exist on this device and have never been proposed
 * to the account — cf. `SynchroFiches.tsx`'s module docstring for why they
 * are held out of the automatic merge. One row, a name, a date, two
 * buttons: nothing here is preselected, and nothing leaves this device
 * without the explicit click that `onEnvoyer`/`onIgnorer` reports.
 *
 * Renders nothing when there is nothing to propose, rather than an empty
 * card — a card with no rows reads as a bug, not as "you have none".
 */
export function PropositionMontee() {
  const { propositions, proposer, ignorerProposition } = useSynchroFiches()
  const [enCours, setEnCours] = useState<ReadonlySet<string>>(() => new Set())

  if (propositions.length === 0) return null

  async function envoyer(id: string): Promise<void> {
    setEnCours((actuelles) => new Set(actuelles).add(id))
    try {
      await proposer(id)
    } finally {
      setEnCours((actuelles) => {
        const suivantes = new Set(actuelles)
        suivantes.delete(id)
        return suivantes
      })
    }
  }

  return (
    <section aria-labelledby="proposition-montee-titre" className="border border-bord bg-surface p-4">
      <h2 className="font-affichage text-titre3 text-encre" id="proposition-montee-titre">
        {MOTS.ficheSynchroPropositionsTitre}
      </h2>
      <p className="mt-1 text-petit text-encre-douce">{MOTS.ficheSynchroPropositionsTexte}</p>
      <ul className="mt-3 divide-y divide-bord">
        {propositions.map((fiche) => (
          <li className="flex items-center justify-between gap-3 py-2" key={fiche.id}>
            <div>
              <p className="text-corps text-encre">
                {fiche.meta.nomPersonnage === '' ? MOTS.ficheSansNom : fiche.meta.nomPersonnage}
              </p>
              <p className="text-petit text-encre-faible">{fiche.meta.creeLe}</p>
            </div>
            <div className="flex gap-2">
              <button
                className="min-h-cible min-w-cible px-3 text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                disabled={enCours.has(fiche.id)}
                onClick={() => ignorerProposition(fiche.id)}
                type="button"
              >
                {MOTS.ficheSynchroPropositionIgnorer}
              </button>
              <button
                className="min-h-cible min-w-cible bg-accent px-3 text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                disabled={enCours.has(fiche.id)}
                onClick={() => void envoyer(fiche.id)}
                type="button"
              >
                {MOTS.ficheSynchroPropositionEnvoyer}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
