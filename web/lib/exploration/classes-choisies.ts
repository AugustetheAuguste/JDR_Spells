/**
 * The classes chosen at step one, as a set rather than a single slug.
 *
 * Its own leaf module for the same reason `familles.ts` is one: `axes.ts` needs
 * this to shape the level axis, `etat-exploration.ts` needs it to build the
 * filter, and having either reach into the other would close an import cycle at
 * runtime (`etat-exploration.ts` already imports `CLES_AXES` as a value from
 * `axes.ts`).
 *
 * `base.classe` stays the *primary* class — the one every other route
 * (`/`, `/comparer`, `/favoris`, a spell page) already understands as "the"
 * class. Extra classes chosen alongside it live only here, in the exploration
 * route's own state, because widening "the level of a spell" to several
 * classes at once is a question only this route asks.
 */

import type { EtatExploration } from '@/lib/exploration/etat-exploration'

/** The classes in play, primary first, deduplicated. Empty when none is chosen —
 * the cross-class-floor case the rest of the site already knows how to label. */
export function classesChoisies(etat: EtatExploration): readonly string[] {
  const { classe } = etat.base
  if (classe === null) return []
  const vues = new Set<string>([classe])
  for (const autre of etat.classesSupplementaires) vues.add(autre)
  return [...vues]
}
