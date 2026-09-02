import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { calculerEmplacements, niveauxEmplacementsGeneraux, type DonneesEmplacements } from './emplacements'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const DONNEES: DonneesEmplacements = JSON.parse(
  readFileSync(resolve(RACINE, 'web/public/data/emplacements.json'), 'utf-8'),
)

/** Reference dump from `src/pf_dons/feat_slots.py::compute_feat_slots` on
 * the same five class/level/race triples — see the plan's verification
 * criterion 6 ("comparé au Python `compute_feat_slots` sur au moins 5
 * couples classe/niveau"). Each tuple is `(slot_id, source, level_gained,
 * category_restriction)`. */
const REFERENCE_PYTHON: Readonly<
  Record<string, readonly (readonly [string, string, number, string | null])[]>
> = {
  'guerrier|6|humain': [
    ['class-1', 'class', 1, null],
    ['general-1', 'general', 1, null],
    ['racial-1', 'racial', 1, null],
    ['class-2', 'class', 2, null],
    ['general-3', 'general', 3, null],
    ['class-4', 'class', 4, null],
    ['general-5', 'general', 5, null],
    ['class-6', 'class', 6, null],
  ],
  'magicien|5|elfe': [
    ['general-1', 'general', 1, null],
    ['general-3', 'general', 3, null],
    ['class-5', 'class', 5, null],
    ['general-5', 'general', 5, null],
  ],
  'barde|9|nain': [
    ['general-1', 'general', 1, null],
    ['general-3', 'general', 3, null],
    ['general-5', 'general', 5, null],
    ['general-7', 'general', 7, null],
    ['general-9', 'general', 9, null],
  ],
  'moine|3|halfelin': [
    ['class-1', 'class', 1, null],
    ['general-1', 'general', 1, null],
    ['class-2', 'class', 2, null],
    ['general-3', 'general', 3, null],
  ],
  'druide|12|gnome': [
    ['general-1', 'general', 1, null],
    ['general-3', 'general', 3, null],
    ['general-5', 'general', 5, null],
    ['general-7', 'general', 7, null],
    ['general-9', 'general', 9, null],
    ['general-11', 'general', 11, null],
  ],
}

describe('calculerEmplacements', () => {
  for (const [cle, attendu] of Object.entries(REFERENCE_PYTHON)) {
    const [classe, niveauTexte, race] = cle.split('|')
    const niveau = Number(niveauTexte)

    it(`correspond au Python pour ${cle}`, () => {
      const emplacements = calculerEmplacements(classe as string, niveau, race as string, DONNEES)
      // Python's own sort is (level_gained, source) ASCENDING but keeps
      // insertion order (general, then racial, then class levels already
      // filtered by <= level) within ties differently from a byte sort on
      // slot_id — compare on the same projection as the reference tuples,
      // sorted the same way Python's stable sort leaves same-key items.
      const projection = emplacements
        .map((e) => [e.slot_id, e.source, e.level_gained, e.category_restriction] as const)
        .sort((a, b) => (a[2] !== b[2] ? a[2] - b[2] : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
      const attenduTrie = [...attendu].sort((a, b) =>
        a[2] !== b[2] ? a[2] - b[2] : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0,
      )
      expect(projection).toEqual(attenduTrie)
    })
  }

  it('un emplacement général au niveau 1 et à chaque niveau impair', () => {
    expect(niveauxEmplacementsGeneraux(6)).toEqual([1, 3, 5])
    expect(niveauxEmplacementsGeneraux(1)).toEqual([1])
  })
})
