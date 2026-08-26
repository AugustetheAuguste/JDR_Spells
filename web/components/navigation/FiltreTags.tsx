'use client'

import { useState } from 'react'

import { grouperTags, libelleTag } from '@/lib/navigation/groupes-tags'
import {
  basculerTag,
  etatDuTag,
  LIBELLES_ETATS_TAG,
  type EtatTag,
} from '@/lib/navigation/tags'

/**
 * The tag filter: grouped, folded, and three-state.
 *
 * One component for both views. The browse table and the comparison table ask the
 * same question of the same closed list, and two copies of a thirty-five-tag
 * taxonomy would drift the first time a tag was added.
 *
 * Three states rather than a checkbox, because a tag answers three questions and
 * not two: « only these », « none of these », « I do not care ». « Hide every
 * mind-affecting spell » is the most useful thing to ask of this taxonomy at the
 * table, and a checkbox could not express it at all.
 */

/**
 * One tag, as a three-state button.
 *
 * A button and not a checkbox: an `indeterminate` checkbox cannot be cycled by
 * clicking — it is only settable from script, which is precisely the state a user
 * cannot reach. The state rides on a glyph and on `aria-label` wording, never on
 * the colour alone.
 */
function JetonTag({
  etat,
  libelle,
  surClic,
}: {
  readonly etat: EtatTag
  readonly libelle: string
  readonly surClic: () => void
}) {
  const styles: Readonly<Record<EtatTag, string>> = {
    neutre: 'border-bord bg-surface text-encre-douce hover:bg-survol',
    inclus: 'border-accent bg-accent-voile text-encre',
    exclu: 'border-desaccord bg-desaccord-voile text-desaccord line-through',
  }
  const glyphes: Readonly<Record<EtatTag, string>> = { neutre: '+', inclus: '✓', exclu: '✕' }
  return (
    <button
      aria-label={`${libelle} : ${LIBELLES_ETATS_TAG[etat]}`}
      className={[
        'inline-flex cursor-pointer items-center gap-1.5 rounded-jeton border px-2 py-1 text-petit',
        styles[etat],
      ].join(' ')}
      onClick={surClic}
      title={`${libelle} : ${LIBELLES_ETATS_TAG[etat]}`}
      type="button"
    >
      <span aria-hidden="true" className="font-donnees no-underline">
        {glyphes[etat]}
      </span>
      {libelle}
    </button>
  )
}

export function FiltreTags({
  tagsConnus,
  tags,
  tagsExclus,
  surTags,
}: {
  /** The index's tag table. Also fixes the order both lists are written in, so one
   * state is one URL whatever order the tags were clicked in. */
  readonly tagsConnus: readonly string[]
  readonly tags: readonly string[]
  readonly tagsExclus: readonly string[]
  readonly surTags: (tags: readonly string[], tagsExclus: readonly string[]) => void
}) {
  const groupes = grouperTags(tagsConnus)

  // Which groups are unfolded. NOT filter state, and deliberately not in the URL:
  // it says nothing about which spells are shown, and putting it there would make
  // two links to the same result set look different. A group holding a posed tag
  // starts open, so a shared link never hides its own filters behind a fold.
  const [deplies, setDeplies] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        groupes
          .filter((groupe) =>
            groupe.tags.some((tag) => tags.includes(tag) || tagsExclus.includes(tag)),
          )
          .map((groupe) => groupe.titre),
      ),
  )

  const poses = tags.length + tagsExclus.length

  if (tagsConnus.length === 0) return null

  return (
    <div>
      <p className="mt-0 mb-1 text-petit font-semibold text-encre-douce">
        Tags
        {poses === 0 ? null : (
          <span className="ml-1.5 font-normal text-encre-faible">
            {poses} posé{poses === 1 ? '' : 's'}
          </span>
        )}
      </p>
      {/* Thirty-five tags in one flat list is an inventory, not a filter: nothing
          said which of them answered the same question, so the only way to use it
          was to read all thirty-five every time. */}
      <p className="mt-0 mb-2 text-micro text-encre-faible">
        Un clic exige le tag, un second l’exclut, un troisième le relâche. Un sort suffit
        à porter l’un des tags exigés ; il est écarté s’il porte un tag exclu.
      </p>
      <div className="flex flex-col gap-1">
        {groupes.map((groupe) => {
          const posesDuGroupe = groupe.tags.filter(
            (tag) => etatDuTag(tag, tags, tagsExclus) !== 'neutre',
          ).length
          const ouvert = deplies.has(groupe.titre)
          return (
            <section key={groupe.titre}>
              <h3 className="m-0">
                <button
                  aria-expanded={ouvert}
                  className="flex w-full cursor-pointer items-center gap-1.5 rounded-jeton border border-bord bg-surface px-2 py-1 text-left text-petit font-semibold text-encre hover:bg-survol"
                  onClick={() =>
                    setDeplies((actuels) => {
                      const suivants = new Set(actuels)
                      if (suivants.has(groupe.titre)) suivants.delete(groupe.titre)
                      else suivants.add(groupe.titre)
                      return suivants
                    })
                  }
                  type="button"
                >
                  <span aria-hidden="true" className="font-donnees text-encre-faible">
                    {ouvert ? '−' : '+'}
                  </span>
                  {groupe.titre}
                  <span className="ml-auto font-normal text-encre-faible">
                    {posesDuGroupe === 0
                      ? groupe.tags.length
                      : `${posesDuGroupe}/${groupe.tags.length}`}
                  </span>
                </button>
              </h3>
              {ouvert ? (
                <div className="mt-1 mb-1 flex flex-wrap gap-1.5 pl-1">
                  {groupe.tags.map((tag) => (
                    <JetonTag
                      etat={etatDuTag(tag, tags, tagsExclus)}
                      key={tag}
                      libelle={libelleTag(tag)}
                      surClic={() => {
                        const suivant = basculerTag(tag, tags, tagsExclus, tagsConnus)
                        surTags(suivant.tags, suivant.tagsExclus)
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}
