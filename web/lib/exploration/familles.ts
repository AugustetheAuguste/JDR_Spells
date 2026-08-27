/**
 * Tag families, as the exploration route names them in a URL.
 *
 * Its own module rather than part of `etat-exploration.ts` for one reason: both
 * the state and the axes need it, and having the axes reach into the state module
 * would close an import cycle at runtime. Here it is a leaf that both import.
 *
 * The families themselves are `groupes-tags.ts` — presentation only, no authority,
 * and the closed list stays the closed list.
 */

import type { IndexWeb } from '@/lib/donnees/index-web'
import { grouperTags, type GroupeTags } from '@/lib/navigation/groupes-tags'
import { plier } from '@/lib/recherche/pliage'

/**
 * The URL slug of a family.
 *
 * Derived from the title rather than stored beside it: the groups carry no
 * authority, and giving each an identifier of its own would make it look like
 * corpus vocabulary. Folded with the corpus's own `plier`, so a family slugs the
 * same way here as a spell name does everywhere else in the repo.
 */
export function slugFamille(titre: string): string {
  return plier(titre).replaceAll(' ', '-')
}

/** The families actually available, given what the export carries. Empty when the
 * enrichment layer is absent — the route then offers no family axis at all. */
export function famillesDisponibles(index: IndexWeb): readonly GroupeTags[] {
  return grouperTags(index.tags)
}

/** The family named by a slug, or null when nothing matches. */
export function familleDe(index: IndexWeb, slug: string | null): GroupeTags | null {
  if (slug === null) return null
  return famillesDisponibles(index).find((groupe) => slugFamille(groupe.titre) === slug) ?? null
}
