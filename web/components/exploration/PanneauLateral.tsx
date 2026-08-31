'use client'

import { FiltreConditions } from '@/components/navigation/FiltreConditions'
import { FiltreTags } from '@/components/navigation/FiltreTags'
import type { IndexWeb } from '@/lib/donnees/index-web'
import { GROUPES_TAGS } from '@/lib/navigation/groupes-tags'
import type { EtatUrl } from '@/lib/navigation/etat-url'

const TITRE_EFFET = 'Effet sur la cible'

/** The six tags of the « Effet sur la cible » family, read off `GROUPES_TAGS`
 * itself rather than duplicated here — one table stays the source of that
 * split, same discipline `groupes-tags.ts` already asks of every other
 * consumer. */
const TAGS_EFFET = GROUPES_TAGS.find((groupe) => groupe.titre === TITRE_EFFET)?.tags ?? []

/**
 * The permanent companion beside the wheel: tags and inflicted conditions,
 * always mounted, never a wheel category of their own.
 *
 * Three of the categories the rework asked for — « Effet sur la cible »,
 * « Autre », « Conditions infligées » — do not fit the wheel's pie/bar model:
 * a tag or a condition is a three- or four-state toggle (want / exclude /
 * require), not a slice of a partition. Rather than force them through
 * `Donut`/`Barres`, they live here, reusing `FiltreTags` twice with two
 * disjoint slices of `index.tags` (`FiltreTags` groups whatever tag list it is
 * given via `grouperTags`, so handing it a subset is enough to get exactly the
 * families that belong in each panel — no new grouping table) and
 * `FiltreConditions` unchanged.
 */
export function PanneauLateral({
  index,
  etat,
  surEtat,
}: {
  readonly index: IndexWeb
  readonly etat: EtatUrl
  readonly surEtat: (etat: EtatUrl) => void
}) {
  const tagsEffet = index.tags.filter((tag) => TAGS_EFFET.includes(tag))
  const tagsAutres = index.tags.filter((tag) => !TAGS_EFFET.includes(tag))

  if (tagsEffet.length === 0 && tagsAutres.length === 0 && index.conditions_infligees.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-4 rounded-panneau border border-bord bg-surface px-4 py-4">
      {tagsEffet.length === 0 ? null : (
        <div>
          <p className="m-0 mb-1 text-petit font-semibold text-encre-douce">{TITRE_EFFET}</p>
          <FiltreTags
            surTags={(tags, tagsExclus, tagsObliges) =>
              surEtat({
                ...etat,
                tags: [...etat.tags.filter((tag) => !TAGS_EFFET.includes(tag)), ...tags],
                tagsExclus: [
                  ...etat.tagsExclus.filter((tag) => !TAGS_EFFET.includes(tag)),
                  ...tagsExclus,
                ],
                tagsObliges: [
                  ...etat.tagsObliges.filter((tag) => !TAGS_EFFET.includes(tag)),
                  ...tagsObliges,
                ],
              })
            }
            tags={etat.tags.filter((tag) => TAGS_EFFET.includes(tag))}
            tagsConnus={tagsEffet}
            tagsExclus={etat.tagsExclus.filter((tag) => TAGS_EFFET.includes(tag))}
            tagsObliges={etat.tagsObliges.filter((tag) => TAGS_EFFET.includes(tag))}
          />
        </div>
      )}

      {tagsAutres.length === 0 ? null : (
        <div>
          <p className="m-0 mb-1 text-petit font-semibold text-encre-douce">Autre</p>
          <FiltreTags
            surTags={(tags, tagsExclus, tagsObliges) =>
              surEtat({
                ...etat,
                tags: [...etat.tags.filter((tag) => TAGS_EFFET.includes(tag)), ...tags],
                tagsExclus: [
                  ...etat.tagsExclus.filter((tag) => TAGS_EFFET.includes(tag)),
                  ...tagsExclus,
                ],
                tagsObliges: [
                  ...etat.tagsObliges.filter((tag) => TAGS_EFFET.includes(tag)),
                  ...tagsObliges,
                ],
              })
            }
            tags={etat.tags.filter((tag) => !TAGS_EFFET.includes(tag))}
            tagsConnus={tagsAutres}
            tagsExclus={etat.tagsExclus.filter((tag) => !TAGS_EFFET.includes(tag))}
            tagsObliges={etat.tagsObliges.filter((tag) => !TAGS_EFFET.includes(tag))}
          />
        </div>
      )}

      {index.conditions_infligees.length === 0 ? null : (
        <FiltreConditions
          conditions={etat.conditionsInfligees}
          conditionsConnues={index.conditions_infligees}
          conditionsExclues={etat.conditionsInfligeesExclues}
          conditionsObligees={etat.conditionsInfligeesObligees}
          surConditions={(conditions, conditionsExclues, conditionsObligees) =>
            surEtat({
              ...etat,
              conditionsInfligees: conditions,
              conditionsInfligeesExclues: conditionsExclues,
              conditionsInfligeesObligees: conditionsObligees,
            })
          }
        />
      )}
    </div>
  )
}
