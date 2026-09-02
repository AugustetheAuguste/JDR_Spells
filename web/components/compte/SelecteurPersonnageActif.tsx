'use client'

import Link from 'next/link'

import { usePersonnageActif } from '@/lib/compte/contexte-personnages'

/**
 * The one selector shared by `/sorts` and `/dons` — proof, per the plan's
 * verification criterion 2, that the two pages read the SAME active
 * character: this component holds no state of its own, it only reads and
 * writes `usePersonnageActif()`, which is declared once in
 * `Fournisseurs.tsx`.
 *
 * Renders nothing when there is no roster to pick from (signed out, or a
 * signed-in account with zero characters yet) rather than an empty,
 * confusing dropdown — the same degradation `VuePersonnages.tsx` already
 * applies to its own states.
 */
export function SelecteurPersonnageActif() {
  const { personnages, personnageActifId, selectionnerPersonnage } = usePersonnageActif()

  if (personnages.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 text-corps text-encre-douce">
      <label className="font-medium" htmlFor="selecteur-personnage-actif">
        Personnage
      </label>
      <select
        className="rounded-jeton border border-bord-fort bg-surface px-2 py-1 text-corps text-encre"
        id="selecteur-personnage-actif"
        onChange={(evenement) => selectionnerPersonnage(evenement.target.value === '' ? null : evenement.target.value)}
        value={personnageActifId ?? ''}
      >
        <option value="">— aucun —</option>
        {personnages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nom}
          </option>
        ))}
      </select>
      <Link className="text-petit text-accent underline" href="/compte/personnages">
        modifier ses champs
      </Link>
    </div>
  )
}
