/**
 * `LignePersonnage` (the account row, `@/lib/compte/distant`) -> `Personnage`
 * (the engine's input shape, `./types`).
 *
 * Two rules, both load-bearing, both documented at length in
 * `16_CHARACTER_BINDING.md`:
 *
 *   - `dons_connus` is ALWAYS an explicit `Set`, never `undefined`, even for
 *     an empty `dons_acquis`. `undefined` reads to the engine as "known feats
 *     not supplied" (`null` / manual_check on a feat-name prerequisite);
 *     an empty `Set` reads as "this character has zero feats" (`false`). A
 *     character with no feats yet must produce the second, not the first —
 *     conflating them silently shifts an entire reachability wave (234 vs
 *     482 for a level-6 Guerrier, per `feat_slots.py`'s own history).
 *   - `caracteristiques`/`alignement`/`divinite` are passed through only when
 *     present. No invented default: an absent alignment must read as
 *     "manual_check, non renseigné", never as a guessed alignment that
 *     produces a false verdict.
 */

import type { LignePersonnage } from '@/lib/compte/distant'
import { nettoyerNomDon, normaliser } from './moteur.js'
import type { Personnage } from './types.js'

/** `Character.ability_scores`'s keys (`"For"`, `"Dex"`, …) are the
 * capitalized abbreviation the parser writes into a requirement's payload —
 * see `moteur.ts::evaluerExigence`'s `ability_score` branch. `caracteristiques`
 * on the account row is keyed by the lowercase abbreviation instead
 * (`for`, `dex`, `con`, `int`, `sag`, `cha`), so the two never collide by
 * accident and always need this explicit map. */
const ABREVIATION_CAPITALISEE: Readonly<Record<string, string>> = {
  for: 'For',
  dex: 'Dex',
  con: 'Con',
  int: 'Int',
  sag: 'Sag',
  cha: 'Cha',
}

export function versCharacter(personnage: LignePersonnage): Personnage {
  const caracteristiques: Record<string, number> | undefined =
    personnage.caracteristiques === null
      ? undefined
      : Object.fromEntries(
          Object.entries(personnage.caracteristiques).map(([abrege, score]) => [
            ABREVIATION_CAPITALISEE[abrege] ?? abrege,
            score,
          ]),
        )

  return {
    classe: personnage.classe ?? '',
    niveau: personnage.niveau ?? 0,
    ...(personnage.race !== null ? { race: personnage.race } : {}),
    ...(personnage.taille !== null ? { taille: personnage.taille } : {}),
    ...(caracteristiques !== undefined ? { caracteristiques } : {}),
    // Explicit, always — see the module docstring above.
    dons_connus: new Set(personnage.dons_acquis.map((nom) => normaliser(nettoyerNomDon(nom)))),
    ...(personnage.alignement !== null ? { alignement: personnage.alignement } : {}),
    ...(personnage.divinite !== null ? { divinite: personnage.divinite } : {}),
  }
}
