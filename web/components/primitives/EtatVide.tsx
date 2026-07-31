import type { ReactNode } from 'react'

/**
 * An empty state that offers a way out.
 *
 * Never "No results" alone. The Skill requires three things: what was searched
 * for, why it came back empty, and a button that escapes. An empty state with no
 * action leaves the user to guess which of their filters is the guilty one — and
 * with class, level and school posed at once, guessing is expensive.
 *
 * `actions` is required for that reason. An empty state with nothing to do is the
 * defect this primitive exists to prevent, so the type refuses it.
 */
export interface ActionVide {
  readonly libelle: string
  readonly surClic: () => void
  readonly primaire?: boolean
}

export function EtatVide({
  titre,
  explication,
  actions,
}: {
  readonly titre: string
  readonly explication?: ReactNode
  readonly actions: readonly [ActionVide, ...ActionVide[]]
}) {
  return (
    <div className="rounded-panneau border border-bord bg-surface px-4 py-6 text-center">
      <p className="m-0 font-affichage text-titre3 font-semibold">{titre}</p>
      {explication === undefined ? null : (
        <p className="mx-auto mt-2 mb-0 max-w-[52ch] text-base text-encre-douce">
          {explication}
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {actions.map((action) => (
          <button
            className={[
              'rounded-jeton border px-3 py-2 text-base font-medium',
              action.primaire === true
                ? 'border-transparent bg-accent text-surface hover:bg-accent-survol'
                : 'border-bord-fort bg-surface text-encre hover:bg-survol',
            ].join(' ')}
            key={action.libelle}
            onClick={action.surClic}
            type="button"
          >
            {action.libelle}
          </button>
        ))}
      </div>
    </div>
  )
}
