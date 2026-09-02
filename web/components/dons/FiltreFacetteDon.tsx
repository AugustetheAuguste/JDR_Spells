'use client'

import { JetonTag } from '@/components/navigation/FiltreTags'
import { GroupeDepliant } from '@/components/navigation/GroupeDepliant'
import { lisible } from '@/lib/donnees/index-web-dons'
import { basculerTag, etatDuTag } from '@/lib/navigation/tags'

/**
 * One dons facet, three-state (OR/NOT/AND), with a live count beside every
 * option — the visible half of the counter-honesty invariant
 * (`13_UI_DONS_LIST`).
 *
 * Built on the exact primitives `FiltreTags` uses for spells (`JetonTag`,
 * `etatDuTag`, `basculerTag`, `GroupeDepliant`) rather than on `FiltreTags`
 * itself: that component's fixed "Tags" heading and its spell-specific
 * `grouperTags` grouping do not fit a facet named "Cible du bonus" or
 * "Contexte" — reusing the CONTROL, as the plan asks, not the spell-shaped
 * wrapper around it.
 */
export function FiltreFacetteDon({
  titre,
  aide,
  options,
  comptes,
  tags,
  tagsExclus,
  tagsObliges,
  surTags,
}: {
  readonly titre: string
  readonly aide?: string
  /** Every option worth showing — already filtered to non-zero counts (plus
   * whatever is currently posed) by the caller; this component never recounts. */
  readonly options: readonly string[]
  /** How many entries selecting each option (OR) would keep — computed once
   * by `compterOptions` and passed straight through. */
  readonly comptes: ReadonlyMap<string, number>
  readonly tags: readonly string[]
  readonly tagsExclus: readonly string[]
  readonly tagsObliges: readonly string[]
  readonly surTags: (
    tags: readonly string[],
    tagsExclus: readonly string[],
    tagsObliges: readonly string[],
  ) => void
}) {
  if (options.length === 0) return null

  const poses = tags.length + tagsExclus.length + tagsObliges.length

  return (
    <GroupeDepliant {...(aide === undefined ? {} : { aide })} poses={poses} titre={titre} total={options.length}>
      {options.map((option) => {
        const compte = comptes.get(option)
        return (
        <JetonTag
          {...(compte === undefined ? {} : { compte })}
          etat={etatDuTag(option, tags, tagsExclus, tagsObliges)}
          key={option}
          libelle={lisible(option)}
          surClic={() => {
            const suivant = basculerTag(option, tags, tagsExclus, options, tagsObliges)
            surTags(suivant.tags, suivant.tagsExclus, suivant.tagsObliges)
          }}
        />
        )
      })}
    </GroupeDepliant>
  )
}
