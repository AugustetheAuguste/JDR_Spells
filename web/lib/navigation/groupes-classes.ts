/**
 * Class ordering for the pickers.
 *
 * The index lists the nineteen classes alphabetically, which puts `alchimiste` and
 * `antipaladin` above `barde` and buries the wizard inside
 * `arcaniste-ensorceleur-magicien` at position three. Alphabetical is the right
 * default for a machine and the wrong one for a player: the classes reached for
 * first are the core ones, and they should be reached first.
 *
 * So two groups, ordered — the familiar ones, then the rest — and inside the first
 * group the order is by how commonly the class is played, not by name. Inside the
 * second, alphabetical, because there is no such ranking to claim among them.
 *
 * This is presentation only. The slug is unchanged, `index.classes` remains the
 * authority on which classes exist, and a class this file does not name still
 * appears — in the second group. The corpus grows a class list without asking
 * this file, and a class silently missing from the picker would be a class the
 * reader cannot filter on.
 */

import type { ClasseIndex, IndexWeb } from '@/lib/donnees/index-web'

export interface GroupeClasses {
  readonly titre: string
  readonly classes: readonly ClasseIndex[]
}

export const TITRE_CLASSIQUES = 'Classes classiques'
export const TITRE_AUTRES_CLASSES = 'Classes moins courantes'

/**
 * The five classes shown directly, most-played first (human call, 2026-08-31):
 * the two combined caster pages, then the three other classic classes with the
 * highest spell counts. Every other class — the fourteen remaining, including
 * `sorciere`, `inquisiteur`, `alchimiste`, `magus`, `conjurateur`,
 * `antipaladin` — falls through to `TITRE_AUTRES_CLASSES` below a disclosure,
 * so the picker's first screen is five cards, not nineteen.
 *
 * The three combined labels (`arcaniste-ensorceleur-magicien`,
 * `pretre-pretre-combattant-oracle`) lead because between them they cover the two
 * archetypal casters; they are one wiki page each and are never split
 * (CLAUDE.md § 9).
 */
export const CLASSES_CLASSIQUES: readonly string[] = [
  'arcaniste-ensorceleur-magicien',
  'pretre-pretre-combattant-oracle',
  'druide',
  'barde',
  'paladin',
]

/** Group the index's classes for a picker. Empty groups are dropped. */
export function grouperClasses(index: IndexWeb): readonly GroupeClasses[] {
  const parSlug = new Map(index.classes.map((classe) => [classe.slug, classe]))

  const classiques = CLASSES_CLASSIQUES.map((slug) => parSlug.get(slug)).filter(
    (classe): classe is ClasseIndex => classe !== undefined,
  )
  const connus = new Set(classiques.map((classe) => classe.slug))
  const autres = [...index.classes]
    .filter((classe) => !connus.has(classe.slug))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  const groupes: GroupeClasses[] = []
  if (classiques.length > 0) groupes.push({ titre: TITRE_CLASSIQUES, classes: classiques })
  if (autres.length > 0) groupes.push({ titre: TITRE_AUTRES_CLASSES, classes: autres })
  return groupes
}

/** The classes in picker order, flattened — for a list that shows no headings. */
export function classesOrdonnees(index: IndexWeb): readonly ClasseIndex[] {
  return grouperClasses(index).flatMap((groupe) => groupe.classes)
}
