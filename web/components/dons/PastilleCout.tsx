import { RAMPE_COUT, RAMPE_COUT_NUIT } from '@/lib/design/tokens'

/**
 * A don's cost, in slots to unlock (prerequisites included) — an ORDINAL
 * magnitude, never a category.
 *
 * `RAMPE_COUT`/`RAMPE_COUT_NUIT` is a single hue walked down (day) or up
 * (night) in lightness, deliberately not the multi-hue `RAMPE_CATEGORIELLE`
 * used for the exploration chart's slices: a cost of 3 is not "a different
 * *kind* of thing" from a cost of 2, it is more of the same thing, and a
 * sequential ramp is the one shape of colour that says so. See `tokens.ts`'s
 * doc comment on `RAMPE_COUT` for the contrast floor this pair holds in both
 * palettes, checked by `scripts/validate_palette.js --ordinal`.
 *
 * The colour never carries the value alone — same rule as `PastilleEcole`'s
 * `variante="complete"`: the swatch is a small square of its own, `aria-hidden`,
 * and the digit is written beside it in ordinary ink, not as white text sitting
 * on the fill (no text on this site is white; ink-on-fill failed AA here for
 * the same reason it did for the school pastilles).
 */
export function PastilleCout({
  cout,
  theme = 'jour',
}: {
  /** `1..COUTS_MAX`, or `null` when not computed for this character/context —
   * rendered as an em dash, never a guessed value (the corpus-gap convention
   * `TableDense` documents). */
  readonly cout: number | null
  readonly theme?: 'jour' | 'nuit'
}) {
  if (cout === null) {
    return (
      <span className="text-encre-faible" title="Coût non calculé">
        —
      </span>
    )
  }

  const rampe = theme === 'nuit' ? RAMPE_COUT_NUIT : RAMPE_COUT
  const fond = rampe[Math.min(Math.max(cout, 1), rampe.length) - 1]

  return (
    <span
      className="inline-flex items-center gap-1.5 font-donnees text-corps text-encre"
      title={`${cout} emplacement${cout > 1 ? 's' : ''} pour décrocher ce don, prérequis compris`}
    >
      <span
        aria-hidden="true"
        className="inline-block size-3 shrink-0 rounded-jeton align-middle"
        style={{ backgroundColor: fond }}
      />
      {cout}
    </span>
  )
}
