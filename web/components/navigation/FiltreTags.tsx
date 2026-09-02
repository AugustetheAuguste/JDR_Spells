'use client'

import { GroupeDepliant } from '@/components/navigation/GroupeDepliant'
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
  // Trois couleurs distinctes parce que les trois questions sont montrées côte
  // à côte sur le même contrôle, et un lecteur doit les distinguer d'un coup
  // d'œil, sans relire l'aide chaque fois. Le glyphe reste le porteur premier,
  // la couleur ne fait que s'y ajouter (la couleur n'est jamais seule porteuse).
  const styles: Readonly<Record<EtatTag, string>> = {
    neutre: 'border-bord bg-surface text-encre-douce hover:bg-survol',
    inclus: 'border-accent bg-accent-voile text-encre',
    exclu: 'border-desaccord bg-desaccord-voile text-desaccord line-through',
    oblige: 'border-oblige bg-oblige-voile text-oblige font-semibold',
  }
  const glyphes: Readonly<Record<EtatTag, string>> = {
    neutre: '+',
    inclus: '✓',
    exclu: '✕',
    oblige: '‼',
  }
  return (
    <button
      aria-label={`${libelle}, ${LIBELLES_ETATS_TAG[etat]}`}
      className={[
        'inline-flex min-h-cible min-w-cible cursor-pointer items-center gap-1.5 rounded-jeton border px-2.5 py-1 text-petit',
        styles[etat],
      ].join(' ')}
      onClick={surClic}
      title={`${libelle}, ${LIBELLES_ETATS_TAG[etat]}`}
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
  tagsObliges,
  surTags,
}: {
  /** The index's tag table. Also fixes the order all three lists are written in,
   * so one state is one URL whatever order the tags were clicked in. */
  readonly tagsConnus: readonly string[]
  /** OR — a spell needs at least one of these. */
  readonly tags: readonly string[]
  /** NOT — a spell must carry none of these. */
  readonly tagsExclus: readonly string[]
  /** AND — a spell must carry every one of these. */
  readonly tagsObliges: readonly string[]
  readonly surTags: (
    tags: readonly string[],
    tagsExclus: readonly string[],
    tagsObliges: readonly string[],
  ) => void
}) {
  const groupes = grouperTags(tagsConnus)

  const poses = tags.length + tagsExclus.length + tagsObliges.length

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
        Un clic pose le tag. Un deuxième l’exclut. Un troisième l’exige. Un
        quatrième le relâche.
      </p>
      <ul className="mt-0 mb-2 list-none pl-0 text-micro text-encre-faible">
        <li>
          <span aria-hidden="true" className="font-donnees">
            +
          </span>{' '}
          non filtré
        </li>
        <li>
          <span aria-hidden="true" className="font-donnees">
            ✓
          </span>{' '}
          voulu, au moins un tag voulu suffit
        </li>
        <li>
          <span aria-hidden="true" className="font-donnees">
            ✕
          </span>{' '}
          exclu, aucun tag exclu toléré
        </li>
        <li>
          <span aria-hidden="true" className="font-donnees">
            ‼
          </span>{' '}
          exigé, tous les tags exigés sont obligatoires
        </li>
      </ul>
      <div className="flex flex-col gap-1">
        {groupes.map((groupe) => {
          const posesDuGroupe = groupe.tags.filter(
            (tag) => etatDuTag(tag, tags, tagsExclus, tagsObliges) !== 'neutre',
          ).length
          return (
            <GroupeDepliant
              key={groupe.titre}
              // A group holding a posed tag starts open, so a shared link never
              // hides its own filters behind a fold. Otherwise closed: thirty-five
              // tags in flat groups is an inventory, not a filter.
              ouvertParDefaut={posesDuGroupe > 0}
              poses={posesDuGroupe}
              titre={groupe.titre}
              total={groupe.tags.length}
            >
              {groupe.tags.map((tag) => (
                <JetonTag
                  etat={etatDuTag(tag, tags, tagsExclus, tagsObliges)}
                  key={tag}
                  libelle={libelleTag(tag)}
                  surClic={() => {
                    const suivant = basculerTag(tag, tags, tagsExclus, tagsConnus, tagsObliges)
                    surTags(suivant.tags, suivant.tagsExclus, suivant.tagsObliges)
                  }}
                />
              ))}
            </GroupeDepliant>
          )
        })}
      </div>
    </div>
  )
}
