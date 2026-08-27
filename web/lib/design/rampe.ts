/**
 * The colour of one chart slice.
 *
 * Separate from `tokens.ts` because this is arithmetic on the tokens rather than a
 * token itself: no value is written here, and the no-hex-outside-tokens test
 * therefore holds without an exception for this file.
 *
 * Up to five slices, the ramp's own five steps are used and the reader can tell
 * them apart. Beyond five the steps are interpolated between the ends, and two
 * neighbours do become close — accepted deliberately, because the alternative is
 * inventing a second hue, which the brief refuses. What carries the meaning is the
 * label and the count written on every slice and repeated in the list beside the
 * chart; the colour only tells the reader which wedge belongs to which line. The
 * wedges are separated by a gap in the page colour for the same reason.
 */

import { COULEURS, RAMPE_TRANCHES } from '@/lib/design/tokens'

function versCanaux(hex: string): readonly [number, number, number] {
  const brut = hex.replace('#', '')
  return [
    Number.parseInt(brut.slice(0, 2), 16),
    Number.parseInt(brut.slice(2, 4), 16),
    Number.parseInt(brut.slice(4, 6), 16),
  ]
}

/**
 * The fill for slice `rang` of `total`.
 *
 * `rgb()` and not a hex, so that an interpolated value is visibly not a token: a
 * hex returned from here would look like a colour someone chose.
 */
export function couleurTranche(rang: number, total: number): string {
  const dernier = RAMPE_TRANCHES.length - 1
  // `?? RAMPE_TRANCHES[0]` throughout, because the index is computed and
  // `noUncheckedIndexedAccess` is right to say so: a ramp of no steps would be a
  // chart with no colours, and the darkest step is the honest fallback.
  if (total <= 0 || rang < 0) return RAMPE_TRANCHES[0]
  if (total <= RAMPE_TRANCHES.length) {
    return RAMPE_TRANCHES[Math.min(rang, dernier)] ?? RAMPE_TRANCHES[0]
  }
  // Interpolated in sRGB, which is not perceptually uniform — and does not need
  // to be. The ramp is one hue, so the only thing drifting is lightness, and the
  // eye reads that monotonically either way.
  const [rA, vA, bA] = versCanaux(RAMPE_TRANCHES[0])
  const [rB, vB, bB] = versCanaux(RAMPE_TRANCHES[dernier] ?? RAMPE_TRANCHES[0])
  const part = Math.min(rang, total - 1) / (total - 1)
  const melange = (a: number, b: number): number => Math.round(a + (b - a) * part)
  return `rgb(${melange(rA, rB)} ${melange(vA, vB)} ${melange(bA, bB)})`
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
