import type { KeyboardEvent, ReactNode } from 'react'

/**
 * A dense results table with a sticky header.
 *
 * The density target is a number, not a feeling: 40 rows readable on a 1366×768
 * laptop, which fixes the row height at 32px. Rows are a fixed height so that
 * scanning a long list does not require re-reading the layout on every line.
 *
 * No zebra striping and no vertical rules — a 1px horizontal rule is enough, and
 * striping fights the selected-row wash for the same visual channel.
 *
 * Generic over the row type so callers keep their own shape; `cle` must be
 * stable, and for spells that is the slug.
 */
export interface ColonneDense<T> {
  readonly cle: string
  readonly entete: string
  /** Rendered per row. Returning `null` is legitimate: the corpus has gaps, and a
   * gap must render as an em dash, never as an invented value. */
  readonly cellule: (ligne: T) => ReactNode
  /** Hidden below 640px. The Skill fixes which columns fall, and in what order:
   * components, range, saving throw. Name, school and per-class level stay. */
  readonly secondaire?: boolean
  readonly alignement?: 'gauche' | 'droite'
  readonly largeur?: string
}

export function TableDense<T>({
  colonnes,
  lignes,
  cleDe,
  legende,
  ligneActive,
  surLigneActivee,
}: {
  readonly colonnes: readonly ColonneDense<T>[]
  readonly lignes: readonly T[]
  readonly cleDe: (ligne: T) => string
  /** Announced to screen readers; a table without one is an unlabelled grid. */
  readonly legende: string
  readonly ligneActive?: string
  readonly surLigneActivee?: (ligne: T) => void
}) {
  return (
    <div className="overflow-x-auto rounded-panneau border border-bord bg-surface">
      <table className="w-full border-collapse text-base">
        <caption className="sr-only">{legende}</caption>
        <thead>
          <tr>
            {colonnes.map((colonne) => (
              <th
                className={[
                  'sticky top-0 z-10 border-b border-bord bg-surface px-2.5 py-1.5',
                  'text-petit font-semibold text-encre-douce',
                  colonne.alignement === 'droite' ? 'text-right' : 'text-left',
                  colonne.secondaire === true ? 'hidden sm:table-cell' : '',
                ].join(' ')}
                key={colonne.cle}
                scope="col"
                {...(colonne.largeur === undefined ? {} : { style: { width: colonne.largeur } })}
              >
                {colonne.entete}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => {
            const cle = cleDe(ligne)
            const active = cle === ligneActive
            return (
              <tr
                className={[
                  'h-ligne border-b border-bord last:border-b-0',
                  active
                    ? 'bg-accent-voile shadow-[inset_2px_0_0_0_var(--color-accent)]'
                    : 'hover:bg-survol',
                  surLigneActivee === undefined ? '' : 'cursor-pointer',
                ].join(' ')}
                key={cle}
                {...(surLigneActivee === undefined
                  ? {}
                  : {
                      // An activatable row has to be reachable without a mouse.
                      // `onClick` alone makes the whole list unusable from the
                      // keyboard, which is the one input this tool is built for.
                      onClick: () => surLigneActivee(ligne),
                      onKeyDown: (evenement: KeyboardEvent<HTMLTableRowElement>) => {
                        if (evenement.key !== 'Enter' && evenement.key !== ' ') return
                        evenement.preventDefault()
                        surLigneActivee(ligne)
                      },
                      tabIndex: 0,
                    })}
              >
                {colonnes.map((colonne) => (
                  <td
                    className={[
                      'px-2.5 py-1.5 align-middle',
                      colonne.alignement === 'droite' ? 'text-right' : 'text-left',
                      colonne.secondaire === true ? 'hidden sm:table-cell' : '',
                    ].join(' ')}
                    key={colonne.cle}
                  >
                    {colonne.cellule(ligne)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
