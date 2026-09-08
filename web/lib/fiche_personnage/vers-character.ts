/**
 * `Fiche` (the local reference sheet, `./schema`) -> `Personnage` (the dons
 * eligibility engine's input shape, `@/lib/dons/types`), for the
 * warning-only feat check this step adds to the sheet.
 *
 * `web/lib/dons/` is never touched by this module — it only imports its
 * public `normaliser`/`nettoyerNomDon` helpers, exactly as
 * `web/lib/dons/vers-character.ts` (the account-row converter) already does,
 * so the two converters stay consistent without duplicating the
 * normalization rule.
 *
 * Absence stays absence (Skill pf-fiche-personnage § 3, and the dons
 * converter's own docstring) : a characteristic with no `base` score set is
 * omitted from `caracteristiques`, never defaulted to 10 ; an unset
 * alignment/divinity/race/size is omitted, never guessed. `classe` and
 * `niveau` are the only two fields the engine's `Personnage` type requires
 * (`readonly classe: string; readonly niveau: number`), so a fiche missing
 * either renders `null` here — the caller shows "vérification impossible",
 * which is NOT a refusal to attach a feat (CLAUDE.md § 12, la maxime de
 * sûreté) : it only means the warning check itself cannot run.
 *
 * Class-name casing is not folded here : `moteur.ts`'s own lookups
 * (`classeLanceSorts`, `verdictMaitrise`, `bba`, …) already run every class
 * name through `normaliser()` before indexing a table, so passing the
 * fiche's class name through verbatim is enough — normalizing twice would
 * not change a single lookup.
 */

import { nettoyerNomDon, normaliser } from '@/lib/dons/moteur'
import type { Personnage } from '@/lib/dons/types'

import type { Caracteristique, Fiche } from './schema'

/** `Personnage.caracteristiques`'s keys, in the exact capitalised form
 * `moteur.ts::evaluerExigence`'s `ability_score` branch reads (`"For"`,
 * `"Dex"`, …) — mirrors `web/lib/dons/vers-character.ts`'s own table. */
const ABREVIATION_CAPITALISEE: Readonly<Record<Caracteristique, string>> = {
  force: 'For',
  dexterite: 'Dex',
  constitution: 'Con',
  intelligence: 'Int',
  sagesse: 'Sag',
  charisme: 'Cha',
}

const ORDRE_CARACTERISTIQUES: readonly Caracteristique[] = [
  'force',
  'dexterite',
  'constitution',
  'intelligence',
  'sagesse',
  'charisme',
]

function caracteristiquesDefinies(fiche: Fiche): Record<string, number> | undefined {
  const entrees: Record<string, number> = {}
  for (const carac of ORDRE_CARACTERISTIQUES) {
    const base = fiche.caracteristiques[carac].base
    if (base !== null) {
      entrees[ABREVIATION_CAPITALISEE[carac]] = base
    }
  }
  return Object.keys(entrees).length > 0 ? entrees : undefined
}

/**
 * Convertit une fiche en `Personnage` pour le moteur d'éligibilité des
 * dons. Rend `null` si la fiche ne porte pas assez pour construire un
 * `Personnage` valide (aucune classe saisie, ou niveau de la première
 * classe absent). Ce n'est pas un refus de rattachement : l'appelant
 * affiche que la vérification n'est pas possible et laisse le bouton de
 * rattachement actif.
 */
export function ficheVersCharacter(fiche: Fiche): Personnage | null {
  const classePrincipale = fiche.identite.classes[0]
  if (classePrincipale === undefined) return null
  const nomClasse = classePrincipale.nom.trim()
  if (nomClasse === '') return null
  if (classePrincipale.niveau === null) return null

  const race = fiche.identite.race?.nom.trim()
  const taille = fiche.identite.taille.trim()
  const alignement = fiche.identite.alignement.trim()
  const divinite = fiche.identite.divinite.trim()
  const caracteristiques = caracteristiquesDefinies(fiche)

  return {
    classe: nomClasse,
    niveau: classePrincipale.niveau,
    ...(race !== undefined && race !== '' ? { race } : {}),
    ...(taille !== '' ? { taille } : {}),
    ...(caracteristiques !== undefined ? { caracteristiques } : {}),
    // Toujours un Set explicite, jamais `undefined` — voir le docstring du
    // module et la même règle dans `web/lib/dons/vers-character.ts`.
    dons_connus: new Set(fiche.dons.map((don) => normaliser(nettoyerNomDon(don.nom))).filter((nom) => nom !== '')),
    ...(alignement !== '' ? { alignement } : {}),
    ...(divinite !== '' ? { divinite } : {}),
  }
}
