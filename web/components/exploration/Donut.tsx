'use client'

import { useState } from 'react'

import { useThemeActif } from '@/components/exploration/theme-actif'
import { COULEUR_TRANCHE_SANS_VALEUR, couleurCategorie } from '@/lib/design/rampe'
import { COULEURS_ECOLES } from '@/lib/design/tokens'
import { formaterPart, secteurs } from '@/lib/exploration/geometrie'
import type { Tranche } from '@/lib/exploration/axes'

/**
 * A partition of the current subset, as a clickable donut with its list beside it.
 *
 * Drawn only for axes where a spell falls in exactly one slice, so the wedges sum
 * to the whole and the circle means what a circle means. Overlapping axes get
 * `Barres` instead — see `axes.ts`.
 *
 * **The wedges are not the control.** The list beside the chart is: real
 * `<button>` elements, in the tab order, each naming its slice and its count. The
 * SVG is `aria-hidden` and mirrors them. That is not a shortcut — an SVG path with
 * `role="button"` is reachable but announces a shape, and a chart that can only be
 * used with a mouse fails the reader who has neither a mouse nor sight. The wedges
 * stay clickable because pointing at the big one is the fast path.
 *
 * No entry animation and no transition on hover: 2070 spells and a chart that
 * redraws on every click — each animation is delay. Hovering thickens the wedge's
 * outline, which is instant and needs no motion.
 */

const RAYON = 100
const RAYON_INTERNE = 58
const ECART_DEGRES = 1.6

export function Donut({
  tranches,
  total,
  legendeTotal,
  surChoix,
  multiple = false,
  selection = [],
}: {
  readonly tranches: readonly Tranche[]
  /** The subset size. Passed rather than summed: for a partition it equals the sum,
   * and asserting that here would hide the day it stops being true. */
  readonly total: number
  /** What the centre counts, e.g. « sorts du barde ». */
  readonly legendeTotal: string
  /** In single mode, a click drills immediately. In multiple mode, a click only
   * toggles membership in `selection` — the view confirms with its own button, so
   * several slices can be posed at once (« niveau 0, 1 et 2 »). */
  readonly surChoix: (valeur: string) => void
  readonly multiple?: boolean
  readonly selection?: readonly string[]
}) {
  const [survol, setSurvol] = useState<number | null>(null)
  const theme = useThemeActif()
  const arcs = secteurs(
    tranches.map((tranche) => tranche.nb),
    { rayon: RAYON, rayonInterne: RAYON_INTERNE, ecartDegres: ECART_DEGRES },
  )

  const remplissage = (tranche: Tranche, rang: number): string => {
    if (tranche.valeur === null) return COULEUR_TRANCHE_SANS_VALEUR
    // On the school axis the reader already knows the nine pastilles from the
    // table; reusing them means the same colour never names two different things.
    if (tranche.ecole !== null) return COULEURS_ECOLES[tranche.ecole]
    return couleurCategorie(rang, theme)
  }

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <svg
        aria-hidden="true"
        className="shrink-0"
        height={220}
        role="presentation"
        viewBox="-110 -110 220 220"
        width={220}
      >
        {tranches.map((tranche, rang) => {
          const arc = arcs[rang]
          if (arc === undefined || arc.d === '') return null
          const cliquable = tranche.valeur !== null
          return (
            <path
              className={cliquable ? 'cursor-pointer' : 'cursor-not-allowed'}
              d={arc.d}
              fill={remplissage(tranche, rang)}
              key={tranche.libelle}
              onClick={cliquable ? () => surChoix(tranche.valeur as string) : undefined}
              onMouseEnter={() => setSurvol(rang)}
              onMouseLeave={() => setSurvol(null)}
              /* The separator is the page colour, not a dark outline: two
                 neighbouring steps of a single-hue ramp need a gap to read as two
                 wedges, and a dark outline would add a tenth colour to the page. */
              stroke={
                multiple && tranche.valeur !== null && selection.includes(tranche.valeur)
                  ? 'var(--color-accent)'
                  : 'var(--color-base)'
              }
              strokeWidth={survol === rang ? 4 : 2}
            />
          )
        })}
        <text
          className="fill-encre font-donnees"
          dominantBaseline="middle"
          fontSize={25}
          textAnchor="middle"
          y={-6}
        >
          {total}
        </text>
        <text
          className="fill-encre-douce"
          dominantBaseline="middle"
          fontSize={11}
          textAnchor="middle"
          y={14}
        >
          {legendeTotal}
        </text>
      </svg>

      <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-0.5 p-0">
        {tranches.map((tranche, rang) => {
          const part = arcs[rang]?.part ?? 0
          const pastille = (
            <span
              aria-hidden="true"
              className="inline-block size-3 shrink-0 rounded-jeton"
              style={{ backgroundColor: remplissage(tranche, rang) }}
            />
          )
          if (tranche.valeur === null) {
            return (
              <li className="min-h-ligne px-2 py-1.5 text-petit text-encre-faible" key={tranche.libelle}>
                <span className="inline-flex items-center gap-2">
                  {pastille}
                  {tranche.libelle}
                  <span className="font-donnees">{tranche.nb}</span>
                  <span>{formaterPart(part)}</span>
                </span>
                {/* Disabled with the reason written beside it, as the Skill
                    requires: there is no filter that can name an absence, so the
                    slice is shown and cannot be entered. */}
                <span className="ml-2 text-micro">
                  Non filtrable, la source ne dit rien ici.
                </span>
              </li>
            )
          }
          const coche = multiple && selection.includes(tranche.valeur as string)
          return (
            <li key={tranche.libelle}>
              <button
                aria-checked={multiple ? coche : undefined}
                aria-label={tranche.libelleAccessible}
                className={[
                  'flex min-h-cible w-full items-center gap-2 rounded-jeton px-2 py-1.5 text-left text-corps',
                  coche ? 'bg-accent-voile' : survol === rang ? 'bg-survol' : 'bg-transparent',
                ].join(' ')}
                onClick={() => surChoix(tranche.valeur as string)}
                onFocus={() => setSurvol(rang)}
                onBlur={() => setSurvol(null)}
                onMouseEnter={() => setSurvol(rang)}
                onMouseLeave={() => setSurvol(null)}
                role={multiple ? 'checkbox' : 'button'}
                type="button"
              >
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
                {pastille}
                <span className="min-w-0 flex-1 truncate text-encre">{tranche.libelle}</span>
                <span className="font-donnees text-petit text-encre-douce">{tranche.nb}</span>
                <span className="w-12 text-right text-petit text-encre-faible">
                  {formaterPart(part)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
