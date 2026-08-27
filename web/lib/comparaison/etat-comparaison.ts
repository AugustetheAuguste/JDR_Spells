/**
 * The comparison view's own URL contract, deliberately separate from
 * `lib/navigation/etat-url.ts`.
 *
 * It answers a different question and shares no filter axis with the browse
 * view, so folding them into one state object would mean a state where half the
 * keys are always meaningless. Same discipline though: the URL is the single
 * source of truth, names go in it rather than codes, and every function here is
 * pure so the contract can be asserted without a router.
 */

import type { IndexWeb } from '@/lib/donnees/index-web'
import {
  estColonneComparaison,
  MAX_CLASSES,
  type ColonneComparaison,
} from '@/lib/comparaison/ensembles'
import { analyserTags, formaterTags } from '@/lib/navigation/etat-url'
import type { SensTri } from '@/lib/navigation/tri'

export const MODES = ['partages', 'exclusifs', 'tous'] as const
export type Mode = (typeof MODES)[number]

export const CLES_COMPARAISON = {
  classes: 'classes',
  mode: 'mode',
  tags: 'tags',
  tri: 'tri',
} as const

export interface EtatComparaison {
  /** In the order picked, which is the order the columns appear in. */
  readonly classes: readonly string[]
  readonly mode: Mode
  /** Same four-state tag filter as the browse view, same `-`/`!` convention in
   * the URL. The taxonomy is one closed list and it answers the same question here. */
  readonly tags: readonly string[]
  readonly tagsExclus: readonly string[]
  readonly tagsObliges: readonly string[]
  /** The sorted column, or null for the view's own order — widest spread first. */
  readonly tri: ColonneComparaison | null
  readonly sens: SensTri
}

export const ETAT_COMPARAISON_VIDE: EtatComparaison = {
  classes: [],
  mode: 'partages',
  tags: [],
  tagsExclus: [],
  tagsObliges: [],
  tri: null,
  sens: 'asc',
}

/**
 * Read the selection from a query string.
 *
 * Unknown class slugs are dropped rather than refused: a link naming a class
 * that no longer exists is a link that aged out, and rendering nothing would be
 * a worse answer than rendering what is still valid. Duplicates collapse, and
 * anything past the third pick is dropped here too — but the SELECTOR is what
 * says so in words; silently truncating a hand-edited URL is acceptable,
 * silently ignoring a click is not.
 */
export function lireEtatComparaison(
  params: URLSearchParams,
  index: IndexWeb,
): EtatComparaison {
  const connus = new Map(index.classes.map((classe) => [classe.slug.toLowerCase(), classe.slug]))
  const brut = params.get(CLES_COMPARAISON.classes) ?? ''
  const classes: string[] = []
  for (const morceau of brut.split(',')) {
    const slug = connus.get(morceau.trim().toLowerCase())
    if (slug === undefined || classes.includes(slug)) continue
    if (classes.length >= MAX_CLASSES) break
    classes.push(slug)
  }

  const modeBrut = (params.get(CLES_COMPARAISON.mode) ?? '').toLowerCase()
  const mode = (MODES as readonly string[]).includes(modeBrut)
    ? (modeBrut as Mode)
    : ETAT_COMPARAISON_VIDE.mode

  const tags = analyserTags(params.get(CLES_COMPARAISON.tags), index.tags)

  // The column is validated against the classes just parsed, so `tri=niveau:barde`
  // on a comparison without the bard is dropped rather than sorting the table by a
  // column nobody can see.
  const triBrut = (params.get(CLES_COMPARAISON.tri) ?? '').trim()
  const desc = triBrut.startsWith('-')
  const nomColonne = desc ? triBrut.slice(1) : triBrut
  const tri = estColonneComparaison(nomColonne, classes) ? nomColonne : null

  return {
    classes,
    mode,
    tags: tags.tags,
    tagsExclus: tags.tagsExclus,
    tagsObliges: tags.tagsObliges,
    tri,
    sens: tri !== null && desc ? 'desc' : 'asc',
  }
}

/** Absent keys rather than empty ones, and a stable key order: two equal states
 * must serialize to one string, or the router rewrites the address bar on every
 * render. The default mode is omitted for the same reason. */
export function ecrireEtatComparaison(etat: EtatComparaison): URLSearchParams {
  const params = new URLSearchParams()
  if (etat.classes.length > 0) {
    params.set(CLES_COMPARAISON.classes, etat.classes.join(','))
  }
  if (etat.mode !== ETAT_COMPARAISON_VIDE.mode) {
    params.set(CLES_COMPARAISON.mode, etat.mode)
  }
  if (etat.tags.length > 0 || etat.tagsExclus.length > 0 || etat.tagsObliges.length > 0) {
    params.set(CLES_COMPARAISON.tags, formaterTags(etat.tags, etat.tagsExclus, etat.tagsObliges))
  }
  if (etat.tri !== null) {
    params.set(CLES_COMPARAISON.tri, `${etat.sens === 'desc' ? '-' : ''}${etat.tri}`)
  }
  return params
}

export function versQueryComparaison(etat: EtatComparaison): string {
  const query = ecrireEtatComparaison(etat).toString()
  return query === '' ? '' : `?${query}`
}

export const LIBELLES_MODES: Readonly<Record<Mode, string>> = {
  partages: 'Sorts partagés',
  exclusifs: 'Sorts exclusifs',
  tous: 'Tout',
}
