/**
 * The colour of one chart slice.
 *
 * Separate from `tokens.ts` because this is arithmetic on the tokens rather than a
 * token itself: no value is written here, and the no-hex-outside-tokens test
 * therefore holds without an exception for this file.
 *
 * Categorical, not a gradient: slice `rang` gets step `rang mod length` of
 * `RAMPE_CATEGORIELLE`. Beyond eight slices two of them do repeat — accepted,
 * because the label and the count on every slice (and in the list beside the
 * chart) are what actually identify it; the colour only helps the eye jump
 * between a wedge and its line. The wedges are separated by a gap in the page
 * colour for the same reason.
 */

import { COULEURS, RAMPE_CATEGORIELLE } from '@/lib/design/tokens'

/**
 * The fill for slice `rang` of `total`. `total` is unused by the cycle itself —
 * kept in the signature because callers pass it and a chart of zero slices still
 * needs a defined, harmless answer.
 */
export function couleurTranche(rang: number, total: number): string {
  if (total <= 0 || rang < 0) return RAMPE_CATEGORIELLE[0]
  return RAMPE_CATEGORIELLE[rang % RAMPE_CATEGORIELLE.length] ?? RAMPE_CATEGORIELLE[0]
}

/**
 * The fill for a slice that cannot be drilled into.
 *
 * A slice exists for spells the source leaves blank — 297 spells carry no saving
 * throw at all — and there is no filter that can name that absence. Rather than
 * drop them (nothing is discarded silently) the wedge is drawn in the neutral
 * border colour, which reads as "not one of the choices" instead of as the palest
 * step of the ramp.
 */
export const COULEUR_TRANCHE_SANS_VALEUR = COULEURS.bordFort
