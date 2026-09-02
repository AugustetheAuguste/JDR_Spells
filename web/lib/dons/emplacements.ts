/**
 * Port of `src/pf_dons/feat_slots.py::compute_feat_slots` — one general slot
 * at level 1 and every odd level after, one racial slot if the race grants a
 * bonus feat, one class slot per level listed for the class. Ported
 * function-for-function, same slot-id scheme (`general-<n>`, `racial-1`,
 * `class-<n>`), same sort key (level, then source), so a Python/TS
 * comparison never needs to reconcile two different orderings.
 *
 * `category_restriction` on a class slot is passed through verbatim from
 * `web/public/data/emplacements.json` (produced offline from
 * `data/classes/class_bonus_feats.json`) — never derived or guessed here,
 * same rule as the Python original.
 */

import { normaliser } from './moteur.js'

export type SourceEmplacement = 'general' | 'racial' | 'class'

export interface Emplacement {
  readonly slot_id: string
  readonly source: SourceEmplacement
  readonly level_gained: number
  readonly category_restriction: string | null
}

export interface InfoClasseEmplacements {
  readonly bonus_feat_levels: readonly number[]
  readonly category_restriction: string | null
}

export interface InfoRaceEmplacements {
  readonly has_bonus_feat: boolean
}

export interface DonneesEmplacements {
  readonly classes: Readonly<Record<string, InfoClasseEmplacements>>
  readonly races: Readonly<Record<string, InfoRaceEmplacements>>
}

export function niveauxEmplacementsGeneraux(niveauMax: number): readonly number[] {
  const niveaux: number[] = []
  for (let niveau = 1; niveau <= niveauMax; niveau += 1) {
    if (niveau === 1 || niveau % 2 === 1) niveaux.push(niveau)
  }
  return niveaux
}

export function calculerEmplacements(
  classe: string,
  niveau: number,
  race: string | null,
  donnees: DonneesEmplacements,
): readonly Emplacement[] {
  const emplacements: Emplacement[] = []

  for (const lvl of niveauxEmplacementsGeneraux(niveau)) {
    emplacements.push({
      slot_id: `general-${lvl}`,
      source: 'general',
      level_gained: lvl,
      category_restriction: null,
    })
  }

  const infoRace = race === null ? undefined : donnees.races[normaliser(race)]
  if (infoRace?.has_bonus_feat === true) {
    emplacements.push({
      slot_id: 'racial-1',
      source: 'racial',
      level_gained: 1,
      category_restriction: null,
    })
  }

  const infoClasse = donnees.classes[normaliser(classe)]
  for (const lvl of infoClasse?.bonus_feat_levels ?? []) {
    if (lvl <= niveau) {
      emplacements.push({
        slot_id: `class-${lvl}`,
        source: 'class',
        level_gained: lvl,
        category_restriction: infoClasse?.category_restriction ?? null,
      })
    }
  }

  return [...emplacements].sort((a, b) => {
    if (a.level_gained !== b.level_gained) return a.level_gained - b.level_gained
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0
  })
}
