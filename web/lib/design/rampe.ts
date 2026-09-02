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

/**
 * The night counterpart of `RAMPE_CATEGORIELLE`, closing the Skill's "point non
 * résolu" (`pf-web-design-system`, § Plancher d'accessibilité): the day ramp was
 * re-verified against the Grimoire `base` and holds (floor 3.86:1), but was never
 * checked against `COULEURS_NUIT.base` (`#1E1710`), where four of its eight steps
 * fell as low as 2.33:1 — under the 3:1 floor for a graphical object (WCAG
 * 1.4.11).
 *
 * Measured before touching anything (`base` day `#F1E7D2`, `base` night
 * `#1E1710`):
 *
 *   step        day    night
 *   #1F6F8B    4.62    3.13
 *   #A8501C    4.47    3.23
 *   #8C6E1E    3.92    3.68
 *   #6B7A1E    3.86    3.74
 *   #8A3A8C    5.58    2.59
 *   #7A3E9E    5.68    2.54
 *   #4A4E8C    6.20    2.33   <- the low point the Skill cites
 *   #B03060    4.97    2.90
 *
 * Two ramps, not one lightened ramp shared by both backgrounds (form decision,
 * made here rather than re-litigated per call site). A single hue that clears
 * 3:1 on BOTH `#F1E7D2` and `#1E1710` is necessarily mid-lightness — pull the
 * eight steps toward that middle band and they crowd together in lightness,
 * which is exactly the property a categorical ramp cannot afford: separating
 * eight slices in a chart is the ramp's whole job, and the background floor is
 * only a minimum it must also clear, not the thing it optimises for.
 *
 * Built by keeping each step's hue (its colour family) and raising only its
 * HSL lightness until `contraste(step, COULEURS_NUIT.base) >= 3`. Six of the
 * eight steps needed no hue change at all (0.00–0.28° of drift, well inside
 * the 6° "same hue" floor the school pastilles use for their own pairwise
 * check). Two steps — ranks 1 and 5 — could not also hold the ramp's OWN
 * pairwise-distinguishability floor (>= 25° of hue, the same rule this ramp's
 * day version is held to) at their day hue: `#A8501C`/`#8C6E1E` sit 21.35°
 * apart and `#8A3A8C`/`#7A3E9E` sit 21.04° apart already in the *day* ramp —
 * a pre-existing near-collision this task did not introduce and does not fix
 * in `RAMPE_CATEGORIELLE` (out of scope: that file belongs to step 04). Simply
 * lightening those two pairs in place would have carried the same 21° gap into
 * the night ramp and failed the mutual-distinguishability floor below. Ranks 1
 * and 5 alone were nudged in hue — 5.50° and 5.61° respectively, still inside
 * the pastilles' 6° "same hue" band — just enough to clear 25° from their
 * nearest neighbour; every other step's hue is untouched.
 *
 * Resulting contrast against `COULEURS_NUIT.base`, each step's floor:
 *
 *   #1F6F8B  3.1258   (rank 0, hue unchanged, 195.56°)
 *   #AB441C  3.0164   (rank 1, hue nudged 5.50° from #A8501C's 22.29° to 16.78°)
 *   #8C6E1E  3.6821   (rank 2, hue unchanged, 43.64°)
 *   #6B7A1E  3.7357   (rank 3, hue unchanged, 69.78°)
 *   #99409B  3.0046   (rank 4, hue unchanged, 298.68°)
 *   #8348B7  3.0169   (rank 5, hue nudged 5.61° from #7A3E9E's 277.50° to 271.89°)
 *   #595EA7  3.0237   (rank 6, hue unchanged, 236.15°)
 *   #B43162  3.0005   (rank 7, hue unchanged, 337.56°)
 *
 * Every pairwise hue gap in this ramp is >= 25.17°, and every step clears the
 * 3:1 floor with a small positive margin rather than sitting exactly on it —
 * asserted in `rampe.test.ts`, not eyeballed.
 *
 * A CSS-variable switch (the cascade choosing the ramp from `[data-theme]`,
 * with no component code deciding anything) would be the structurally better
 * home for this — `styles/theme.css` already carries every other themed colour
 * that way. Not done here: `theme.css` belongs to the parallel step that owns
 * `tokens.ts`/`theme.css`/`tokens.test.ts`, and this module must not touch it.
 * Flagging it here, and in this step's commit message, rather than silently
 * building the JS accessor as if it were the final shape.
 */
export const RAMPE_CATEGORIELLE_NUIT = [
  '#1F6F8B',
  '#AB441C',
  '#8C6E1E',
  '#6B7A1E',
  '#99409B',
  '#8348B7',
  '#595EA7',
  '#B43162',
] as const

/** Every colour token in this module is one of these two. */
export type Theme = 'jour' | 'nuit'

/**
 * The eight-step ramp for `theme`. `jour` is `RAMPE_CATEGORIELLE` itself —
 * the same array reference, not a copy — so a reader who switches theme keeps
 * recognising a category by its hue family rather than relearning a legend
 * (`rampe.test.ts` asserts referential equality, guarding against a silent
 * "harmonisation" of the day ramp under this change).
 */
export function rampe(theme: Theme): typeof RAMPE_CATEGORIELLE | typeof RAMPE_CATEGORIELLE_NUIT {
  return theme === 'nuit' ? RAMPE_CATEGORIELLE_NUIT : RAMPE_CATEGORIELLE
}

/**
 * The fill for category `index` under `theme`, cycling modulo 8 — the same
 * behaviour `couleurTranche` already gives the exploration chart, extended to
 * the theme axis rather than replacing it. `pas[0]` is a literal-index read on
 * a fixed 8-tuple, so it is typed `string`, never `undefined` — the same
 * fallback shape `couleurTranche` already uses above.
 */
export function couleurCategorie(index: number, theme: Theme): string {
  const pas = rampe(theme)
  const rang = ((index % pas.length) + pas.length) % pas.length
  return pas[rang] ?? pas[0]
}
