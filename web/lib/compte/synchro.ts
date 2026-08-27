/**
 * The merge, and nothing but the merge: no network, no React, no Supabase.
 *
 * Everything hard about syncing favourites is here, and everything here is a pure
 * function of its arguments, so the whole contract is a table of examples rather
 * than a thing you find out in production on someone else's phone.
 *
 * The rule that decides every trade-off below is `stockage.ts`'s, inherited
 * rather than restated: **never destroy someone's data silently.** It is why the
 * merge unions spells instead of picking a winner, why an unknown id survives, and
 * why a deletion has to be an explicit dated write before it is allowed to remove
 * anything.
 *
 * Three consequences worth knowing before reading the code:
 *
 *  - **Spells union, names last-write-wins.** A whole-list last-write-wins would
 *    lose a favourite added on the phone while the laptop was also editing, and
 *    losing a favourite is the one outcome this module exists to prevent. The
 *    price is the mirror case: a favourite *removed* on one device comes back if
 *    the other device never learned of the removal. Resurrection is recoverable
 *    with one click; loss is not, so that is the direction the asymmetry points.
 *    It is also exactly what `importer('fusionner')` already does.
 *
 *  - **Existence is last-write-wins, via the tombstone.** A list deleted while
 *    connected gets a dated `supprime_le`; a list whose local `modifie_le` is
 *    *newer* than that date survives anyway, because editing a list after
 *    deleting it elsewhere is an unambiguous statement that you want it.
 *
 *  - **`liste_active` is never synced.** Which list is selected is a property of
 *    the device in your hand, not of the account: syncing it would move the
 *    selection under a second reader's cursor. The remote therefore stores no
 *    active list, and the merge preserves the local one.
 */

import {
  VERSION_FAVORIS,
  garantirActive,
  type EtatFavoris,
  type ListeFavoris,
} from '@/lib/favoris/stockage'

/** One row of `public.listes`. Timestamps are nullable because the local format
 * tolerates a missing one — the remote must not be stricter than the local, or a
 * valid local list becomes impossible to synchronise. */
export interface LigneListe {
  readonly id_liste: string
  readonly nom: string | null
  readonly cree_le: string | null
  readonly modifie_le: string | null
  readonly supprime_le: string | null
}

/** One row of `public.listes_sorts`. `position` carries the insertion order the
 * local format guarantees; without it the rows come back in whatever order the
 * planner chose. */
export interface LigneSort {
  readonly id_liste: string
  readonly spell_id: string
  readonly position: number
}

/** What the remote holds, split into the living and the buried. A tombstoned list
 * is deliberately *not* in `etat`: it is not a list any more, it is a dated claim
 * that a list should go away. */
export interface Distant {
  readonly etat: EtatFavoris
  /** `id_liste` → normalised `supprime_le`. */
  readonly supprimees: ReadonlyMap<string, string>
}

/**
 * What the merge did, in numbers, so the interface can say it out loud.
 *
 * A sync that reports "terminé" tells the user nothing about whether their lists
 * changed under them. These counters are the sentence instead.
 */
export interface RapportFusion {
  readonly etat: EtatFavoris
  /** Lists that existed only on the server and have just arrived. */
  readonly listes_recues: number
  /** Lists that existed on both sides and were genuinely changed by the merge. */
  readonly listes_fusionnees: number
  /** Spell ids gained from the server, across all lists. */
  readonly sorts_recus: number
  /** Lists removed here because a newer deletion was recorded elsewhere. */
  readonly listes_supprimees: number
}

/**
 * A timestamp as a comparable number, with 0 for "no date at all".
 *
 * `Date.parse` and not a string comparison: the local clock writes
 * `2026-08-27T10:00:00.000Z` and PostgREST returns `2026-08-27T10:00:00+00:00`.
 * Those two are the same instant and compare as different strings, so a string
 * comparison would silently pick the wrong winner about half the time.
 *
 * 0 means oldest-possible, which is the honest reading of an absent date: it
 * cannot win a last-write-wins, and it never claims to be recent.
 */
export function instant(date: string | null): number {
  if (date === null || date === '') return 0
  const valeur = Date.parse(date)
  return Number.isNaN(valeur) ? 0 : valeur
}

/**
 * A timestamp in the one form the local store holds.
 *
 * Normalising at the boundary rather than at each comparison means the local
 * state only ever contains `…Z` strings, whatever offset format the server used.
 * An unparseable date becomes `''` — the value `validerListe` already accepts —
 * rather than the string `Invalid Date`.
 */
export function normaliserDate(date: string | null): string {
  if (date === null || date === '') return ''
  const valeur = Date.parse(date)
  return Number.isNaN(valeur) ? '' : new Date(valeur).toISOString()
}

function plusRecente(a: string, b: string): string {
  if (a === '') return b
  if (b === '') return a
  return instant(a) >= instant(b) ? a : b
}

function plusAncienne(a: string, b: string): string {
  if (a === '') return b
  if (b === '') return a
  return instant(a) <= instant(b) ? a : b
}

/**
 * Rows → local state.
 *
 * Rows with an empty `id_liste`, or spells attached to no known list, are dropped
 * rather than guessed at: the database constraint forbids the first and the
 * foreign key forbids the second, so either one means the payload is not what it
 * claims to be.
 */
export function versEtat(
  listes: readonly LigneListe[],
  sorts: readonly LigneSort[],
): Distant {
  const parListe = new Map<string, LigneSort[]>()
  for (const sort of sorts) {
    if (sort.spell_id === '') continue
    const groupe = parListe.get(sort.id_liste)
    if (groupe === undefined) parListe.set(sort.id_liste, [sort])
    else groupe.push(sort)
  }

  const vivantes: ListeFavoris[] = []
  const supprimees = new Map<string, string>()

  for (const ligne of listes) {
    if (ligne.id_liste === '') continue
    if (ligne.supprime_le !== null && ligne.supprime_le !== '') {
      supprimees.set(ligne.id_liste, normaliserDate(ligne.supprime_le))
      continue
    }
    const groupe = [...(parListe.get(ligne.id_liste) ?? [])].sort(
      (gauche, droite) => gauche.position - droite.position,
    )
    vivantes.push({
      id_liste: ligne.id_liste,
      nom: ligne.nom ?? '',
      cree_le: normaliserDate(ligne.cree_le),
      modifie_le: normaliserDate(ligne.modifie_le),
      // Duplicates collapse, as they do locally: the same id twice is a write
      // bug, never intent.
      sorts: [...new Set(groupe.map((sort) => sort.spell_id))],
    })
  }

  return {
    // `liste_active` is null on purpose: the remote does not carry a selection,
    // and inventing one here would let a pull move the user's cursor.
    etat: { version: VERSION_FAVORIS, listes: vivantes, liste_active: null },
    supprimees,
  }
}

/** Local state → rows, ready to upsert. `supprime_le` is always null: a list
 * present in the state is, by that fact, not deleted — so pushing also revives a
 * list the user re-edited after deleting it elsewhere. */
export function versLignes(
  etat: EtatFavoris,
  user_id: string,
): {
  readonly listes: readonly (LigneListe & { readonly user_id: string })[]
  readonly sorts: readonly (LigneSort & { readonly user_id: string })[]
} {
  const listes = etat.listes.map((liste) => ({
    user_id,
    id_liste: liste.id_liste,
    nom: liste.nom,
    // `''` back to null: the column is a timestamptz and would reject the empty
    // string outright, failing the whole push over a missing piece of metadata.
    cree_le: liste.cree_le === '' ? null : liste.cree_le,
    modifie_le: liste.modifie_le === '' ? null : liste.modifie_le,
    supprime_le: null,
  }))
  const sorts = etat.listes.flatMap((liste) =>
    liste.sorts.map((spell_id, position) => ({
      user_id,
      id_liste: liste.id_liste,
      spell_id,
      position,
    })),
  )
  return { listes, sorts }
}

/** Merge one list present on both sides. Spells union, the rest follows the more
 * recent side. */
function fusionnerListe(
  locale: ListeFavoris,
  distante: ListeFavoris,
): { readonly liste: ListeFavoris; readonly gagnes: number } {
  const connus = new Set(locale.sorts)
  const gagnes = distante.sorts.filter((id) => !connus.has(id))
  const recente = instant(distante.modifie_le) > instant(locale.modifie_le)
  return {
    liste: {
      id_liste: locale.id_liste,
      // Only the strictly more recent side may rename: on a tie, the device in
      // front of the user keeps its own label rather than flickering.
      nom: recente ? distante.nom : locale.nom,
      cree_le: plusAncienne(locale.cree_le, distante.cree_le),
      modifie_le: plusRecente(locale.modifie_le, distante.modifie_le),
      sorts: [...locale.sorts, ...gagnes],
    },
    gagnes: gagnes.length,
  }
}

/**
 * Merge the local state with what the server holds.
 *
 * Called once per session, before anything is ever pushed. Pushing first would
 * overwrite the server with a state that has not yet learned about the other
 * devices, which is the one ordering that loses data — hence the state machine in
 * `SynchroFavoris` that forbids it.
 */
export function fusionner(local: EtatFavoris, distant: Distant): RapportFusion {
  const parIdDistant = new Map(distant.etat.listes.map((liste) => [liste.id_liste, liste]))
  const resultat: ListeFavoris[] = []
  let listes_fusionnees = 0
  let sorts_recus = 0
  let listes_supprimees = 0

  for (const locale of local.listes) {
    const enterrement = distant.supprimees.get(locale.id_liste)
    if (enterrement !== undefined && instant(enterrement) >= instant(locale.modifie_le)) {
      // Deleted elsewhere, and not touched here since. Honouring it is the whole
      // point of the tombstone — without it the list resurrects on every sync.
      listes_supprimees += 1
      continue
    }
    const distante = parIdDistant.get(locale.id_liste)
    if (distante === undefined) {
      resultat.push(locale)
      continue
    }
    const { liste, gagnes } = fusionnerListe(locale, distante)
    resultat.push(liste)
    sorts_recus += gagnes
    if (gagnes > 0 || liste.nom !== locale.nom) listes_fusionnees += 1
  }

  const parIdLocal = new Set(local.listes.map((liste) => liste.id_liste))
  let listes_recues = 0
  for (const distante of distant.etat.listes) {
    if (parIdLocal.has(distante.id_liste)) continue
    resultat.push(distante)
    listes_recues += 1
    sorts_recus += distante.sorts.length
  }

  return {
    // The local selection is carried over verbatim, then `garantirActive` for the
    // same reason `importer` calls it: the write path must not emit a state the
    // read path would repair behind the user's back. A live selection is never
    // stolen; one whose list a tombstone just removed is a hole, and gets filled.
    etat: garantirActive({
      version: VERSION_FAVORIS,
      listes: resultat,
      liste_active: local.liste_active,
    }),
    listes_recues,
    listes_fusionnees,
    sorts_recus,
    listes_supprimees,
  }
}

/** Lists that were pushed last time and are gone now — the ones a deletion has
 * to be recorded for. Diffed against the previous *pushed* state and never
 * against the server: a list missing from a device that never had it is not a
 * deletion, and treating it as one would erase the other devices' data. */
export function listesDisparues(
  precedent: EtatFavoris,
  courant: EtatFavoris,
): readonly string[] {
  const presents = new Set(courant.listes.map((liste) => liste.id_liste))
  return precedent.listes
    .map((liste) => liste.id_liste)
    .filter((id) => !presents.has(id))
}

/** Whether a merge changed anything the user would notice. Used to stay quiet
 * when it did not: a banner that appears on every page load stops being read. */
export function fusionMuette(rapport: RapportFusion): boolean {
  return (
    rapport.listes_recues === 0 &&
    rapport.listes_fusionnees === 0 &&
    rapport.sorts_recus === 0 &&
    rapport.listes_supprimees === 0
  )
}
