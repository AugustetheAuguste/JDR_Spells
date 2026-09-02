'use client'

import { GroupeDepliant } from '@/components/navigation/GroupeDepliant'
import { libelleCondition } from '@/lib/navigation/libelles-facettes'
import {
  basculerTag,
  etatDuTag,
  LIBELLES_ETATS_TAG,
  type EtatTag,
} from '@/lib/navigation/tags'

/**
 * The inflicted-condition filter: flat, three-state, same cycle as `FiltreTags`.
 *
 * Reuses `tags.ts`'s state machine as-is — it was already written generically
 * (a tag answers three questions, and so does a condition: only these, none of
 * these, all of these). Unlike `FiltreTags` there is no grouping table: sixteen
 * conditions is short enough to read as one flat list, and inventing thematic
 * groups for a taxonomy this small would be a second thing to keep in step with
 * `conventions/vocabulaires/conditions.json` for no reader benefit.
 */
function JetonCondition({
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

export function FiltreConditions({
  conditionsConnues,
  conditions,
  conditionsExclues,
  conditionsObligees,
  surConditions,
}: {
  /** The index's condition table. Also fixes the order all three lists are
   * written in, so one state is one URL whatever order they were clicked in. */
  readonly conditionsConnues: readonly string[]
  /** OR — a spell needs at least one of these. */
  readonly conditions: readonly string[]
  /** NOT — a spell must carry none of these. */
  readonly conditionsExclues: readonly string[]
  /** AND — a spell must carry every one of these. */
  readonly conditionsObligees: readonly string[]
  readonly surConditions: (
    conditions: readonly string[],
    conditionsExclues: readonly string[],
    conditionsObligees: readonly string[],
  ) => void
}) {
  if (conditionsConnues.length === 0) return null

  const poses = conditions.length + conditionsExclues.length + conditionsObligees.length

  return (
    <GroupeDepliant
      aide="Un clic pose la condition. Un deuxième l’exclut. Un troisième l’exige. Un quatrième la relâche. Les glyphes, + non filtrée, ✓ voulue, ✕ exclue, ‼ exigée."
      poses={poses}
      titre="Conditions infligées"
      total={conditionsConnues.length}
    >
      {conditionsConnues.map((condition) => (
        <JetonCondition
          etat={etatDuTag(condition, conditions, conditionsExclues, conditionsObligees)}
          key={condition}
          libelle={libelleCondition(condition)}
          surClic={() => {
            const suivant = basculerTag(
              condition,
              conditions,
              conditionsExclues,
              conditionsConnues,
              conditionsObligees,
            )
            surConditions(suivant.tags, suivant.tagsExclus, suivant.tagsObliges)
          }}
        />
      ))}
    </GroupeDepliant>
  )
}
