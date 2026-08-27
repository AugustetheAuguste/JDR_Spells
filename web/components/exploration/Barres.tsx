'use client'

import { COULEUR_TRANCHE_SANS_VALEUR, couleurTranche } from '@/lib/design/rampe'
import { formaterPart } from '@/lib/exploration/geometrie'
import type { Tranche } from '@/lib/exploration/axes'

/**
 * The overlapping axes, as ranked bars.
 *
 * A spell carries several tags and several components at once, so these slices sum
 * to more than the subset. Drawn as a pie, a wedge would claim a share of a circle
 * it does not have — the chart would be wrong, not merely unusual. Bars state each
 * share against the subset independently, which is the fact the corpus actually
 * carries, and the overlap is written out under them rather than left for the
 * reader to discover by adding the percentages up.
 *
 * Each bar takes its own step of the categorical ramp, same as a donut wedge: a
 * long list of bars is easier to scan back to its legend when the colour, not
 * only the position, tells two rows apart.
 *
 * Each bar is a button: the row *is* the control, so there is nothing to mirror and
 * no `aria-hidden` chart. The bar is drawn with a plain div width, hence no SVG.
 */
export function Barres({
  tranches,
  total,
  surChoix,
  multiple = false,
  selection = [],
}: {
  readonly tranches: readonly Tranche[]
  /** The subset each bar is a share of. */
  readonly total: number
  /** In single mode, a click drills immediately. In multiple mode, a click only
   * toggles membership in `selection` — the view confirms with its own button. */
  readonly surChoix: (valeur: string) => void
  readonly multiple?: boolean
  readonly selection?: readonly string[]
}) {
  return (
    <div>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {tranches.map((tranche, rang) => {
          const part = total <= 0 ? 0 : tranche.nb / total
          const coche = multiple && tranche.valeur !== null && selection.includes(tranche.valeur)
          const couleur =
            tranche.valeur === null
              ? COULEUR_TRANCHE_SANS_VALEUR
              : couleurTranche(rang, tranches.length)
          const barre = (
            <span
              aria-hidden="true"
              className="block h-2 rounded-jeton"
              style={{
                backgroundColor: couleur,
                // Floored at 2 % so that a bar which exists is a bar you can see:
                // one spell out of 548 is 0,2 % and would render as nothing.
                width: `${Math.max(2, part * 100)}%`,
              }}
            />
          )
          const contenu = (
            <>
              <span className="flex items-baseline gap-2">
                {multiple ? (
                  <span
                    aria-hidden="true"
                    className={[
                      'inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border',
                      coche ? 'border-accent bg-accent text-surface' : 'border-bord-fort bg-surface',
                    ].join(' ')}
                  >
                    {coche ? '✓' : ''}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate">{tranche.libelle}</span>
                <span className="font-donnees text-petit text-encre-douce">{tranche.nb}</span>
                <span className="w-12 text-right text-petit text-encre-faible">
                  {formaterPart(part)}
                </span>
              </span>
              <span className="mt-1 block bg-bord">{barre}</span>
            </>
          )
          if (tranche.valeur === null) {
            return (
              <li className="px-2 py-1.5 text-petit text-encre-faible" key={tranche.libelle}>
                {contenu}
                <span className="mt-1 block text-micro">
                  Non filtrable : aucun filtre ne nomme cette absence.
                </span>
              </li>
            )
          }
          return (
            <li key={tranche.libelle}>
              <button
                aria-checked={multiple ? coche : undefined}
                aria-label={tranche.libelleAccessible}
                className={[
                  'block w-full rounded-jeton px-2 py-1.5 text-left text-base text-encre hover:bg-survol',
                  coche ? 'bg-accent-voile' : '',
                ].join(' ')}
                onClick={() => surChoix(tranche.valeur as string)}
                role={multiple ? 'checkbox' : 'button'}
                type="button"
              >
                {contenu}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 mb-0 text-micro text-encre-faible">
        Un sort peut relever de plusieurs de ces lignes à la fois : les parts se
        recouvrent et ne font pas 100 %. C’est pourquoi ce découpage n’est pas un
        camembert.
      </p>
    </div>
  )
}
