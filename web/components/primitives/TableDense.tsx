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
/** A sortable header's state. `null` means "this table is in its own order". */
export interface EtatTriTable {
  readonly colonne: string | null
  readonly sens: 'asc' | 'desc'
  /** Called with the clicked column's `cle`; the caller decides what comes next. */
  readonly surColonne: (cle: string) => void
}

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
  /** Opt-in. A header only becomes a button when the caller can actually sort on
   * it, because a control that does nothing is worse than no control. */
  readonly triable?: boolean
}

/**
 * The sort indicator.
 *
 * A glyph and not a coloured header: colour is never the sole carrier of
 * information here, and `aria-sort` on the `th` already tells a screen reader the
 * state — the arrow is for everyone else. An unsorted sortable column shows a
 * faint neutral mark so that it is discoverable as clickable before the click.
 */
function FlecheTri({ etat }: { readonly etat: 'asc' | 'desc' | null }) {
  return (
    <span aria-hidden="true" className={etat === null ? 'text-encre-faible' : 'text-accent'}>
      {etat === null ? '↕' : etat === 'asc' ? '↑' : '↓'}
    </span>
  )
}

export function TableDense<T>({
  colonnes,
  lignes,
  cleDe,
  legende,
  ligneActive,
  surLigneActivee,
  tri,
}: {
  readonly colonnes: readonly ColonneDense<T>[]
  readonly lignes: readonly T[]
  readonly cleDe: (ligne: T) => string
  /** Announced to screen readers; a table without one is an unlabelled grid. */
  readonly legende: string
  readonly ligneActive?: string
  readonly surLigneActivee?: (ligne: T) => void
  /** Omitted: the headers stay plain text. Sorting is a caller's capability. */
  readonly tri?: EtatTriTable
}) {
  return (
    <div className="rounded-panneau border border-bord bg-surface">
      <table className="w-full border-collapse text-corps">
        <caption className="sr-only">{legende}</caption>
        <thead>
          <tr>
            {colonnes.map((colonne) => {
              const triable = tri !== undefined && colonne.triable === true
              const actif = triable && tri.colonne === colonne.cle
              const sens = actif ? tri.sens : null
              return (
                <th
                  // `aria-sort` is what a screen reader reads; the arrow is only
                  // its visible half, and one without the other is half a control.
                  {...(triable
                    ? {
                        'aria-sort': (actif
                          ? sens === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none') as 'ascending' | 'descending' | 'none',
                      }
                    : {})}
                  className={[
                    // `top` reads the contract variable étape 09 publishes on the
                    // results container, so this header sits below the sticky
                    // search field rather than under it. The 0px fallback is what
                    // keeps this étape green whether or not 09 has merged yet.
                    'sticky z-10 border-b border-bord bg-surface px-2.5 py-1.5',
                    'text-petit font-semibold text-encre-douce',
                    colonne.alignement === 'droite' ? 'text-right' : 'text-left',
                    colonne.secondaire === true ? 'hidden sm:table-cell' : '',
                  ].join(' ')}
                  key={colonne.cle}
                  scope="col"
                  style={{
                    top: 'var(--pf-decalage-collant, 0px)',
                    // A sortable header is itself a 44px control (Skill, cible
                    // tactile): the column must never shrink its button under
                    // that floor, even once the row content beside it does.
                    // +20px accounts for the cell's own horizontal padding
                    // (px-2.5 on both sides), which the button's width does not.
                    ...(triable ? { minWidth: '64px' } : {}),
                    ...(colonne.largeur === undefined ? {} : { width: colonne.largeur }),
                  }}
                >
                  {triable ? (
                    <button
                      className={[
                        'inline-flex min-h-cible w-full items-center gap-1 bg-transparent p-0 text-petit font-semibold',
                        'cursor-pointer hover:text-accent',
                        actif ? 'text-encre' : 'text-encre-douce',
                        colonne.alignement === 'droite' ? 'justify-end' : 'justify-start',
                      ].join(' ')}
                      onClick={() => tri.surColonne(colonne.cle)}
                      type="button"
                    >
                      {colonne.entete}
                      <FlecheTri etat={sens} />
                    </button>
                  ) : (
                    colonne.entete
                  )}
                </th>
              )
            })}
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
