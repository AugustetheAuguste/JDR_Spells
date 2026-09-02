'use client'

import { MarqueurStatut } from '@/components/dons/MarqueurStatut'
import { STATUTS_DONS, type StatutDon } from '@/lib/recherche/filtres'

const LIBELLES: Readonly<Record<StatutDon, string>> = {
  eligible: 'Éligible',
  manual_check: 'À vérifier',
  ineligible: 'Inéligible',
}

/**
 * The status filter: three checkboxes, one per `StatutDon`, OR-combined — a
 * don only ever carries one status, so there is no NOT/AND state to cycle
 * through here (unlike the tag-shaped facets, which reuse `FiltreTags`).
 *
 * None checked is the default and it means "show every status" — `manual_check`
 * is never excluded by default. Hiding it would hide, from the player, exactly
 * the feats the engine could not decide: the under-attribution this whole
 * repository's gating design exists to prevent.
 */
export function FiltreStatut({
  statuts,
  surStatuts,
}: {
  readonly statuts: readonly StatutDon[]
  readonly surStatuts: (statuts: readonly StatutDon[]) => void
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1.5 block w-full p-0 text-petit font-semibold text-encre-douce">
        Statut d’éligibilité
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {STATUTS_DONS.map((statut) => {
          const coche = statuts.includes(statut)
          return (
            <label
              className={[
                'inline-flex cursor-pointer items-center gap-1.5 rounded-jeton border px-2 py-1 text-petit',
                coche ? 'border-accent bg-accent-voile text-encre' : 'border-bord bg-surface text-encre-douce hover:bg-survol',
              ].join(' ')}
              key={statut}
            >
              <input
                aria-label={LIBELLES[statut]}
                checked={coche}
                className="size-3.5 accent-[var(--color-accent)]"
                onChange={(evenement) => {
                  const suivants = new Set(statuts)
                  if (evenement.target.checked) suivants.add(statut)
                  else suivants.delete(statut)
                  surStatuts(STATUTS_DONS.filter((s) => suivants.has(s)))
                }}
                type="checkbox"
              />
              <MarqueurStatut statut={statut} />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
