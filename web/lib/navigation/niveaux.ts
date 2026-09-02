/**
 * How a level is named on screen — the user-facing face of B4.
 *
 * `niv` is a class→level table. With a class chosen, a level is a fact and can be
 * shown as a number. Without one, there is no such thing as "the" level of a
 * spell, and printing « Niveau 3 » would state something the corpus does not say.
 * So the no-class case gets its own label, written out in full, and every place
 * that displays a level goes through here rather than reading `niv` directly.
 *
 * The failure this prevents is not cosmetic: someone reads « Niveau 2 » at the
 * table, prepares the spell, and discovers mid-session that their class gets it
 * at 4. An interface that hides which class a level belongs to lies to its user
 * during play.
 */

import type { EntreeSort, IndexWeb } from '@/lib/donnees/index-web'
import { niveauMinimum } from '@/lib/recherche/filtres'

/** Shown as the level column header and as the level filter's legend. */
export const LIBELLE_SANS_CLASSE = 'Niveau le plus bas, toutes classes'

export function libelleNiveau(index: IndexWeb, classe: string | null): string {
  if (classe === null) return LIBELLE_SANS_CLASSE
  const nom = index.classes.find((entree) => entree.slug === classe)?.nom ?? classe
  return `Niveau pour ${nom}`
}

/** The level to display, and whether it is class-relative or a cross-class floor. */
export interface NiveauAffiche {
  readonly valeur: number | null
  readonly relatifAUneClasse: boolean
  /** The tooltip. Always names what the number means, class or no class. */
  readonly titre: string
}

export function niveauAffiche(
  index: IndexWeb,
  sort: EntreeSort,
  classe: string | null,
): NiveauAffiche {
  if (classe !== null) {
    const valeur = sort.niv[classe] ?? null
    return {
      valeur,
      relatifAUneClasse: true,
      titre: `${libelleNiveau(index, classe)} : ${valeur ?? 'ce sort n’est pas sur sa liste'}`,
    }
  }
  const valeur = niveauMinimum(sort)
  const detail = Object.entries(sort.niv)
    .map(([slug, niveau]) => {
      const nom = index.classes.find((entree) => entree.slug === slug)?.nom ?? slug
      return `${nom} ${niveau}`
    })
    .sort((a, b) => a.localeCompare(b, 'fr'))
  return {
    valeur,
    relatifAUneClasse: false,
    // The full table in the tooltip, because the number shown is a floor and the
    // reader has to be able to see what it is the floor of.
    titre:
      detail.length === 0
        ? 'Aucune classe ne reçoit ce sort dans le corpus'
        : `${LIBELLE_SANS_CLASSE}. Par classe, ${detail.join(', ')}.`,
  }
}

/**
 * Sort by level then name, in French collation.
 *
 * Level first because a prepared-caster's list is read by level; name second
 * with `localeCompare(fr)` because « Éclair » sorts after « Eau » in French and
 * before it by code point.
 */
export function trierParNiveauPuisNom(
  index: IndexWeb,
  sorts: readonly EntreeSort[],
  classe: string | null,
): EntreeSort[] {
  return [...sorts].sort((a, b) => {
    // A spell with no level goes last, not first: null is "unknown", and unknown
    // at the top of a level-ordered list looks like level 0.
    const na = niveauAffiche(index, a, classe).valeur ?? Number.POSITIVE_INFINITY
    const nb = niveauAffiche(index, b, classe).valeur ?? Number.POSITIVE_INFINITY
    return na === nb ? a.n.localeCompare(b.n, 'fr') : na - nb
  })
}
