'use client'

import { useFavoris } from '@/lib/favoris/contexte'

/**
 * The toggle, on a spell page and on every result row.
 *
 * The vocabulary is fixed by the Skill and the same verb runs through the whole
 * interaction: the button says « Ajouter aux favoris », and once added the
 * accessible name says « Retirer des favoris » while the live region says
 * « Ajouté aux favoris ». One verb, three tenses — never « Sauvegarder » here and
 * « Ajouté » there.
 *
 * Before storage has been read the button is disabled and says so, rather than
 * claiming the spell is not saved: under `output: 'export'` the prerendered HTML
 * knows nothing about this browser's localStorage.
 */
export function BoutonFavori({
  id_sort,
  compact = false,
}: {
  readonly id_sort: string
  readonly compact?: boolean
}) {
  const { pret, active, basculerSort } = useFavoris()
  const dedans = active?.sorts.includes(id_sort) ?? false

  const libelle = dedans ? 'Retirer des favoris' : 'Ajouter aux favoris'
  const classes = compact
    ? 'rounded-jeton border px-1.5 py-0.5 text-micro leading-none'
    : 'rounded-jeton border px-3 py-2 text-corps font-medium'

  return (
    <>
      <button
        aria-pressed={dedans}
        className={[
          classes,
          dedans
            ? 'border-accent bg-accent-voile text-accent hover:bg-survol'
            : 'border-bord-fort bg-surface text-encre hover:bg-survol',
          pret ? '' : 'cursor-wait opacity-60',
        ].join(' ')}
        disabled={!pret}
        onClick={() => basculerSort(id_sort)}
        title={pret ? libelle : 'Lecture des favoris en cours'}
        type="button"
      >
        {compact ? (
          <span aria-hidden="true">{dedans ? '★' : '☆'}</span>
        ) : (
          <>
            <span aria-hidden="true">{dedans ? '★' : '☆'}</span> {libelle}
          </>
        )}
        {compact ? <span className="sr-only">{libelle}</span> : null}
      </button>
      <span aria-live="polite" className="sr-only">
        {pret && dedans ? 'Ajouté aux favoris' : ''}
      </span>
    </>
  )
}
