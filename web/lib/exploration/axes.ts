/**
 * The axes a subset of spells can be cut along, and what clicking a slice means.
 *
 * One table, one entry per axis, each carrying everything the view needs: how to
 * cut the current subset, what the resulting criterion is, how to undo it, and how
 * to name it in the breadcrumb. The view holds no `switch` on the axis for that
 * reason — a new axis is one entry here, not five places to remember.
 *
 * Two kinds of axis, and the distinction is not cosmetic:
 *
 *   - a **partition**: every spell falls in exactly one slice (its level for the
 *     chosen class, its school, its saving throw). The shares sum to the whole, so
 *     a pie tells the truth and is drawn.
 *   - an **overlap**: a spell can be in several slices at once (it carries three
 *     tags, four components). The shares sum to more than the whole, and a pie
 *     would then be a lie — a wedge would claim a fraction of a circle it does not
 *     have. Those axes are drawn as ranked bars, each stating its share of the
 *     subset, with the overlap written out under them.
 *
 * There is no « portée » axis, though the index carries the range: the filter state
 * has no range key, so a slice could be drawn but not clicked. An axis that cannot
 * narrow anything is a chart nobody can use.
 *
 * `null` as a slice value means "the source says nothing here" — 297 spells carry
 * no saving throw at all. Those spells are not dropped (nothing is discarded
 * silently) and not made clickable either, because no filter can name an absence.
 */

import { ecoleDe, type EntreeSort, type IndexWeb } from '@/lib/donnees/index-web'
import { LIBELLES_ECOLES, type Ecole } from '@/lib/design/tokens'
import { libelleTag } from '@/lib/navigation/groupes-tags'
import { libelleNiveau, LIBELLE_SANS_CLASSE } from '@/lib/navigation/niveaux'
import { niveauMinimum } from '@/lib/recherche/filtres'
import { classesChoisies } from '@/lib/exploration/classes-choisies'
import { famillesDisponibles, familleDe, slugFamille } from '@/lib/exploration/familles'
// Type-only, and deliberately so: `etat-exploration.ts` imports `CLES_AXES` from
// this module as a value. Erased at compile time, the cycle never exists at
// runtime — and the alternative, an axis table that cannot name its own state
// type, would push every `poser` back into the view.
import type { EtatExploration } from '@/lib/exploration/etat-exploration'

/** The axes, in the order the exploration suggests them. Order matters: it is the
 * order a spell is looked for at the table — what class, what it does, then the
 * narrower qualifiers. */
export const CLES_AXES = [
  'niveau',
  'categorie',
  'tag',
  'ecole',
  'sauvegarde',
  'composante',
] as const

export type CleAxe = (typeof CLES_AXES)[number]

export type FormeAxe = 'donut' | 'barres'

export interface Tranche {
  /** What goes in the URL. `null` when the source gives nothing here, and such a
   * slice is shown but not clickable. */
  readonly valeur: string | null
  /** The short label, on the slice and in the list. */
  readonly libelle: string
  /** The spoken label. Always self-sufficient: a level says which class it is a
   * level *for*, because « Niveau 2 » alone means nothing in this corpus. */
  readonly libelleAccessible: string
  readonly nb: number
  /** Set on the school axis only, where the school's own pastille colour is the
   * one the reader already knows from the table. */
  readonly ecole: Ecole | null
}

export interface Axe {
  readonly cle: CleAxe
  /** The label of the button that selects this axis. */
  readonly bouton: string
  /** Usually fixed, but the level axis switches to `barres` once several classes
   * are chosen: each spell can then fall in more than one class's level at once,
   * which is the overlap case, not a partition. A function so the view need not
   * special-case which axis that is. */
  readonly forme: FormeAxe | ((etat: EtatExploration) => FormeAxe)
  /** The heading above the chart, which names what the numbers belong to. */
  readonly question: (index: IndexWeb, etat: EtatExploration) => string
  /** True when the axis can exist at all here — the index carries what it needs
   * and the state has what it depends on. Whether it *discriminates* is a separate
   * question, answered by `discrimine`. */
  readonly disponible: (index: IndexWeb, etat: EtatExploration) => boolean
  readonly decouper: (
    sorts: readonly EntreeSort[],
    index: IndexWeb,
    etat: EtatExploration,
  ) => readonly Tranche[]
  /** Pose the criterion — every slice named in `valeurs` at once, replacing
   * whichever were posed before. An array rather than one value throughout,
   * because every criterion this table can pose is already an array in
   * `EtatUrl` (`niveaux`, `ecoles`, `tags`, …): letting the reader tick several
   * slices before confirming costs nothing extra here. Only `categorie` reads
   * just the first element — a family is chosen one at a time. Does not touch
   * `parcours`: `forer` owns the path. */
  readonly poser: (etat: EtatExploration, valeurs: readonly string[]) => EtatExploration
  readonly pose: (etat: EtatExploration) => boolean
  readonly retirer: (etat: EtatExploration) => EtatExploration
  /** The breadcrumb chip, or null when the axis poses nothing. */
  readonly libelleChoisi: (index: IndexWeb, etat: EtatExploration) => string | null
}

function nomClasse(index: IndexWeb, slug: string | null): string {
  if (slug === null) return ''
  return index.classes.find((classe) => classe.slug === slug)?.nom ?? slug
}

/** Descending by count, then by label, so equal counts are in a stable order and
 * the ramp's darkest step is always the largest share. */
function parTaille(tranches: readonly Tranche[]): readonly Tranche[] {
  return [...tranches].sort(
    (a, b) => b.nb - a.nb || a.libelle.localeCompare(b.libelle, 'fr'),
  )
}

/** Count the spells of `sorts` matching each of `valeurs` — the overlap case,
 * where a spell can be counted in several slices. */
function compter<T>(
  sorts: readonly EntreeSort[],
  valeurs: readonly T[],
  porte: (sort: EntreeSort, valeur: T) => boolean,
): readonly { readonly valeur: T; readonly nb: number }[] {
  return valeurs.map((valeur) => ({
    valeur,
    nb: sorts.filter((sort) => porte(sort, valeur)).length,
  }))
}

const AXE_NIVEAU: Axe = {
  cle: 'niveau',
  bouton: 'Niveau',
  // A partition for zero or one class — every spell has exactly one level in
  // that frame. With several classes chosen a spell can sit at two different
  // levels for two different classes at once, so the wedges would sum to more
  // than the subset: the overlap case, drawn as bars, same as tags.
  forme: (etat) => (classesChoisies(etat).length > 1 ? 'barres' : 'donut'),
  question: (index, etat) => {
    const classes = classesChoisies(etat)
    return classes.length > 1
      ? `Quel niveau, pour ${classes.map((slug) => nomClasse(index, slug)).join(' ou ')} ?`
      : libelleNiveau(index, etat.base.classe)
  },
  // Always available: a level exists for every spell, either for the chosen
  // class(es) or as the cross-class floor the label names in full.
  disponible: () => true,
  decouper: (sorts, index, etat) => {
    const classes = classesChoisies(etat)
    const compte = new Map<number, number>()
    let sans = 0
    if (classes.length > 1) {
      // Overlap: a spell is counted once per level at which ANY of the chosen
      // classes grants it, so a spell on two of those lists at two different
      // levels counts in both bars.
      for (const sort of sorts) {
        const niveaux = new Set(
          classes.map((c) => sort.niv[c]).filter((n): n is number => n !== undefined),
        )
        if (niveaux.size === 0) sans += 1
        else for (const niveau of niveaux) compte.set(niveau, (compte.get(niveau) ?? 0) + 1)
      }
    } else {
      const classe = etat.base.classe
      for (const sort of sorts) {
        const niveau = classe === null ? niveauMinimum(sort) : (sort.niv[classe] ?? null)
        if (niveau === null) sans += 1
        else compte.set(niveau, (compte.get(niveau) ?? 0) + 1)
      }
    }
    const contexte =
      classes.length > 1
        ? ` pour au moins l’une de ces classes : ${classes.map((c) => nomClasse(index, c)).join(', ')}`
        : classes.length === 1
          ? ` pour ${nomClasse(index, classes[0]!)}`
          : `, ${LIBELLE_SANS_CLASSE.toLowerCase()}`
    // Ascending, not by count: a caster's list is read by level, and a level axis
    // sorted by popularity would put level 4 before level 0.
    const tranches: Tranche[] = [...compte.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([niveau, nb]) => ({
        valeur: String(niveau),
        // Level 0 is real — the orisons — so a bare digit is shown, never a dash.
        libelle: `Niveau ${niveau}`,
        libelleAccessible: `Niveau ${niveau}${contexte} — ${nb} sorts`,
        nb,
        ecole: null,
      }))
    if (sans > 0) {
      tranches.push({
        valeur: null,
        libelle: 'Aucune classe ne le reçoit',
        libelleAccessible: `Aucune classe du corpus ne reçoit ces ${sans} sorts`,
        nb: sans,
        ecole: null,
      })
    }
    return tranches
  },
  poser: (etat, valeurs) => ({
    ...etat,
    base: { ...etat.base, niveaux: valeurs.map(Number).sort((a, b) => a - b) },
  }),
  pose: (etat) => etat.base.niveaux.length > 0,
  retirer: (etat) => ({ ...etat, base: { ...etat.base, niveaux: [] } }),
  libelleChoisi: (index, etat) => {
    if (etat.base.niveaux.length === 0) return null
    const niveaux = etat.base.niveaux.join(', ')
    const classes = classesChoisies(etat)
    if (classes.length === 0) return `${LIBELLE_SANS_CLASSE} : ${niveaux}`
    return `Niveau ${niveaux} pour ${classes.map((slug) => nomClasse(index, slug)).join(', ')}`
  },
}

const AXE_ECOLE: Axe = {
  cle: 'ecole',
  bouton: 'École',
  forme: 'donut',
  question: () => 'Quelle école ?',
  disponible: (index) => index.ecoles.length > 0,
  decouper: (sorts, index) => {
    const compte = new Map<string, number>()
    let sans = 0
    for (const sort of sorts) {
      const ecole = sort.e === null ? null : index.ecoles[sort.e]
      if (ecole === undefined || ecole === null) sans += 1
      else compte.set(ecole, (compte.get(ecole) ?? 0) + 1)
    }
    const tranches = parTaille(
      [...compte.entries()].map(([ecole, nb]) => {
        const code = index.ecoles.indexOf(ecole)
        const resolue = ecoleDe(index, code)
        const libelle = resolue === null ? ecole : LIBELLES_ECOLES[resolue]
        return {
          valeur: ecole,
          libelle,
          libelleAccessible: `${libelle} — ${nb} sorts`,
          nb,
          ecole: resolue,
        }
      }),
    )
    return sans === 0
      ? tranches
      : [
          ...tranches,
          {
            valeur: null,
            libelle: 'École non renseignée',
            libelleAccessible: `École non renseignée par la source — ${sans} sorts`,
            nb: sans,
            ecole: null,
          },
        ]
  },
  poser: (etat, valeurs) => ({ ...etat, base: { ...etat.base, ecoles: valeurs } }),
  pose: (etat) => etat.base.ecoles.length > 0,
  retirer: (etat) => ({ ...etat, base: { ...etat.base, ecoles: [] } }),
  libelleChoisi: (index, etat) =>
    etat.base.ecoles.length === 0
      ? null
      : etat.base.ecoles
          .map((ecole) => {
            const resolue = ecoleDe(index, index.ecoles.indexOf(ecole))
            return resolue === null ? ecole : LIBELLES_ECOLES[resolue]
          })
          .join(', '),
}

const AXE_SAUVEGARDE: Axe = {
  cle: 'sauvegarde',
  bouton: 'Jet de sauvegarde',
  forme: 'donut',
  question: () => 'Quel jet de sauvegarde ?',
  disponible: (index) => index.jets.length > 0,
  decouper: (sorts, index) => {
    const compte = new Map<string, number>()
    let sans = 0
    for (const sort of sorts) {
      const jet = sort.j === null ? undefined : index.jets[sort.j]
      if (jet === undefined) sans += 1
      else compte.set(jet, (compte.get(jet) ?? 0) + 1)
    }
    const tranches = parTaille(
      [...compte.entries()].map(([jet, nb]) => ({
        valeur: jet,
        libelle: jet,
        libelleAccessible: `Jet de sauvegarde ${jet} — ${nb} sorts`,
        nb,
        ecole: null,
      })),
    )
    return sans === 0
      ? tranches
      : [
          ...tranches,
          {
            valeur: null,
            // The corpus records values like « non et oui (cf. texte) »; the export
            // declines to force them into a code, and so does this slice.
            libelle: 'Non renseigné par la source',
            libelleAccessible: `Jet de sauvegarde non renseigné par la source — ${sans} sorts`,
            nb: sans,
            ecole: null,
          },
        ]
  },
  poser: (etat, valeurs) => ({ ...etat, base: { ...etat.base, sauvegarde: valeurs } }),
  pose: (etat) => etat.base.sauvegarde.length > 0,
  retirer: (etat) => ({ ...etat, base: { ...etat.base, sauvegarde: [] } }),
  libelleChoisi: (_index, etat) =>
    etat.base.sauvegarde.length === 0
      ? null
      : `Jet de sauvegarde : ${etat.base.sauvegarde.join(', ')}`,
}

const AXE_CATEGORIE: Axe = {
  cle: 'categorie',
  bouton: 'Famille d’effet',
  forme: 'barres',
  question: () => 'Que doit faire le sort ?',
  // Hidden entirely when the enrichment layer is absent from the export: an axis
  // that can only ever show one empty bar invites the reader to look for a control
  // that is not there.
  disponible: (index) => famillesDisponibles(index).length > 0,
  decouper: (sorts, index) => {
    const familles = famillesDisponibles(index)
    const codes = familles.map((famille) => ({
      famille,
      codes: new Set(
        famille.tags.map((tag) => index.tags.indexOf(tag)).filter((code) => code >= 0),
      ),
    }))
    const tranches = parTaille(
      compter(sorts, codes, (sort, entree) =>
        sort.t.some((code) => entree.codes.has(code)),
      )
        .filter((mesure) => mesure.nb > 0)
        .map((mesure) => ({
          valeur: slugFamille(mesure.valeur.famille.titre),
          libelle: mesure.valeur.famille.titre,
          libelleAccessible: `${mesure.valeur.famille.titre} — ${mesure.nb} sorts`,
          nb: mesure.nb,
          ecole: null,
        })),
    )
    const sans = sorts.filter((sort) => sort.t.length === 0).length
    return sans === 0
      ? tranches
      : [
          ...tranches,
          {
            valeur: null,
            libelle: 'Aucun tag dans le corpus',
            libelleAccessible: `Sans tag : la couche d’enrichissement ne couvre pas ces ${sans} sorts`,
            nb: sans,
            ecole: null,
          },
        ]
  },
  // The family changes, so a tag chosen inside the previous one is dropped: it
  // would filter on something the breadcrumb no longer shows. A family is
  // chosen one at a time — only the first tick counts.
  poser: (etat, valeurs) => ({
    ...etat,
    categorie: valeurs[0] ?? null,
    base: { ...etat.base, tags: [] },
  }),
  pose: (etat) => etat.categorie !== null,
  retirer: (etat) => ({ ...etat, categorie: null, base: { ...etat.base, tags: [] } }),
  libelleChoisi: (index, etat) => familleDe(index, etat.categorie)?.titre ?? null,
}

const AXE_TAG: Axe = {
  cle: 'tag',
  bouton: 'Tag précis',
  forme: 'barres',
  question: (index, etat) =>
    `Quel effet, dans « ${familleDe(index, etat.categorie)?.titre ?? '—'} » ?`,
  // Depends on a family being chosen: the 35 tags at large are an inventory, not a
  // chart, and a bar per tag would be unreadable and unrankable.
  disponible: (index, etat) => familleDe(index, etat.categorie) !== null,
  decouper: (sorts, index, etat) => {
    const famille = familleDe(index, etat.categorie)
    if (famille === null) return []
    return parTaille(
      compter(sorts, famille.tags, (sort, tag) => sort.t.includes(index.tags.indexOf(tag)))
        .filter((mesure) => mesure.nb > 0)
        .map((mesure) => ({
          valeur: mesure.valeur,
          libelle: libelleTag(mesure.valeur),
          libelleAccessible: `${libelleTag(mesure.valeur)} — ${mesure.nb} sorts`,
          nb: mesure.nb,
          ecole: null,
        })),
    )
  },
  poser: (etat, valeurs) => ({ ...etat, base: { ...etat.base, tags: valeurs } }),
  pose: (etat) => etat.base.tags.length > 0,
  retirer: (etat) => ({ ...etat, base: { ...etat.base, tags: [] } }),
  libelleChoisi: (_index, etat) =>
    etat.base.tags.length === 0 ? null : etat.base.tags.map(libelleTag).join(', '),
}

const AXE_COMPOSANTE: Axe = {
  cle: 'composante',
  bouton: 'Composantes',
  forme: 'barres',
  question: () => 'Quelles composantes ?',
  disponible: (index) => index.composantes.length > 0,
  decouper: (sorts, index) =>
    parTaille(
      compter(sorts, index.composantes, (sort, composante) =>
        sort.c.includes(index.composantes.indexOf(composante)),
      )
        .filter((mesure) => mesure.nb > 0)
        .map((mesure) => ({
          valeur: mesure.valeur,
          libelle: mesure.valeur,
          libelleAccessible: `Composante ${mesure.valeur} — ${mesure.nb} sorts`,
          nb: mesure.nb,
          ecole: null,
        })),
    ),
  poser: (etat, valeurs) => ({ ...etat, base: { ...etat.base, composantes: valeurs } }),
  pose: (etat) => etat.base.composantes.length > 0,
  retirer: (etat) => ({ ...etat, base: { ...etat.base, composantes: [] } }),
  libelleChoisi: (_index, etat) =>
    etat.base.composantes.length === 0
      ? null
      : `Composantes : ${etat.base.composantes.join(', ')}`,
}

export const AXES: Readonly<Record<CleAxe, Axe>> = {
  niveau: AXE_NIVEAU,
  categorie: AXE_CATEGORIE,
  tag: AXE_TAG,
  ecole: AXE_ECOLE,
  sauvegarde: AXE_SAUVEGARDE,
  composante: AXE_COMPOSANTE,
}

/** The axes in suggestion order, keeping only those that can exist here. */
export function axesDisponibles(index: IndexWeb, etat: EtatExploration): readonly Axe[] {
  return CLES_AXES.map((cle) => AXES[cle]).filter((axe) => axe.disponible(index, etat))
}

/**
 * True when cutting `sorts` along `axe` would actually offer a choice.
 *
 * Two clickable slices is the floor. One slice is a chart that says « all of them
 * are this » and leaves nothing to click; zero is a chart of nothing. Either way
 * the axis is not offered, so the reader is never sent to a dead end.
 *
 * Two slices are not enough on their own for an overlap axis, where a spell sits in
 * several at once: three spells each carrying two tag families draw two full-width
 * bars, and clicking either one narrows nothing. So a slice has to be strictly
 * smaller than the subset — that is what « narrows » means, and on a partition axis
 * it follows from having two slices anyway.
 */
export function discrimine(
  axe: Axe,
  sorts: readonly EntreeSort[],
  index: IndexWeb,
  etat: EtatExploration,
): boolean {
  const utilisables = axe
    .decouper(sorts, index, etat)
    .filter((tranche) => tranche.valeur !== null)
  return (
    utilisables.length >= 2 && utilisables.some((tranche) => tranche.nb < sorts.length)
  )
}

/**
 * The axis to offer next: the first in suggestion order that is not already posed
 * and still discriminates.
 *
 * `sousEnsemble` is a function rather than a list because deciding this means
 * cutting the subset several times, each time with that axis's own criterion
 * lifted — otherwise an axis already posed would look like it discriminates
 * nothing and one already answered would be skipped for the wrong reason.
 */
export function axeSuggere(
  index: IndexWeb,
  etat: EtatExploration,
  sousEnsemble: (etat: EtatExploration) => readonly EntreeSort[],
): CleAxe | null {
  for (const axe of axesDisponibles(index, etat)) {
    if (axe.pose(etat)) continue
    if (discrimine(axe, sousEnsemble(etat), index, etat)) return axe.cle
  }
  return null
}

/**
 * Drill into a slice: pose the criterion, record the axis at the end of the path,
 * and let the next axis be suggested again.
 *
 * The axis is moved to the end rather than appended blindly, so re-answering an
 * earlier question puts it where it was actually answered — the breadcrumb reads
 * in the order the reader chose, which is the only order « remonter » can undo.
 */
export function forer(
  etat: EtatExploration,
  cle: CleAxe,
  valeurs: readonly string[],
): EtatExploration {
  const pose = AXES[cle].poser(etat, valeurs)
  return {
    ...pose,
    parcours: [...pose.parcours.filter((autre) => autre !== cle), cle],
    axe: null,
  }
}

/**
 * Zoom out one step: undo the last answer and show that chart again.
 *
 * `axe` is set to the axis just undone, not left null: the reader who steps back
 * wants to see the wedges they came from, not to be moved on to another question.
 */
export function remonter(etat: EtatExploration): EtatExploration {
  const dernier = etat.parcours.at(-1)
  if (dernier === undefined) return etat
  const sans = AXES[dernier].retirer(etat)
  return { ...sans, parcours: etat.parcours.slice(0, -1), axe: dernier }
}

/** Drop one answer wherever it sits in the path — what a breadcrumb chip's cross
 * does. The answers after it are kept: they are still true of the wider set. */
export function retirerAxe(etat: EtatExploration, cle: CleAxe): EtatExploration {
  const sans = AXES[cle].retirer(etat)
  return { ...sans, parcours: sans.parcours.filter((autre) => autre !== cle), axe: null }
}
