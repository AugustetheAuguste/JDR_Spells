/**
 * Local store for character sheets: one `localStorage` key per sheet.
 *
 * Modelled on `web/lib/favoris/stockage.ts`, but the invariant here is
 * stronger. Favourites hold one array under one key; a sheet under this
 * module holds its *own* key, precisely so that writing sheet B can never
 * touch sheet A's bytes. The list a caller sees is never a stored index —
 * it is derived by scanning `localStorage` for the prefix — because a
 * stored index can drift from what is actually there, and a scan cannot.
 *
 * Every function here takes the `Storage` it should use, so the whole
 * contract is testable without a browser. Dates and ids are supplied by the
 * caller (the context, ultimately), never read from the clock in here — cf.
 * Skill `pf-fiche-personnage` § 7, discipline des fonctions pures.
 */

import { creerFicheVide } from '@/lib/fiche_personnage/fiche-vide'
import { migrer } from '@/lib/fiche_personnage/migrer'
import { valider } from '@/lib/fiche_personnage/valider'
import type { Fiche } from '@/lib/fiche_personnage/schema'
import { MOTS } from '@/lib/design/tokens'

export const PREFIXE = 'pf-fiche:'
export const PREFIXE_SECOURS = 'pf-fiche-secours:'

export function cle(id: string): string {
  return `${PREFIXE}${id}`
}

export function cleSecours(id: string): string {
  return `${PREFIXE_SECOURS}${id}`
}

/** A rejected sheet: reported, never repaired and never removed — cf. §8 of
 * the plan, an unreadable value must stay exactly where it was found. */
export interface FicheIllisible {
  readonly cle: string
  readonly motif: string
}

export interface Listage {
  readonly fiches: readonly Fiche[]
  readonly illisibles: readonly FicheIllisible[]
}

/** Uniform outcome for every mutating verb: success carries the sheet that
 * was written, failure carries a motive an interface can show, never a raw
 * thrown exception. */
export type Resultat =
  | { readonly ok: true; readonly fiche: Fiche }
  | { readonly ok: false; readonly motif: string }

function analyserEtMigrer(brut: string): { readonly ok: true; readonly fiche: Fiche } | { readonly ok: false; readonly motif: string } {
  let analyse: unknown
  try {
    analyse = JSON.parse(brut)
  } catch {
    return { ok: false, motif: MOTS.ficheJsonIllisible }
  }
  const migre = migrer(analyse)
  if (!migre.ok) return { ok: false, motif: migre.motif }
  return { ok: true, fiche: migre.fiche }
}

/**
 * Every sheet under the prefix, sheets sorted by `meta.modifieLe` descending.
 *
 * Rescue-copy keys are never included — they are not sheets, they are the
 * one-shot recovery bytes `supprimer` leaves behind. An unreadable value is
 * reported in `illisibles` and left untouched in storage: this function
 * never writes.
 */
export function lister(stockage: Storage): Listage {
  const fiches: Fiche[] = []
  const illisibles: FicheIllisible[] = []

  for (let index = 0; index < stockage.length; index += 1) {
    const cleCourante = stockage.key(index)
    if (cleCourante === null) continue
    if (!cleCourante.startsWith(PREFIXE)) continue
    if (cleCourante.startsWith(PREFIXE_SECOURS)) continue

    const brut = stockage.getItem(cleCourante)
    if (brut === null) continue

    const resultat = analyserEtMigrer(brut)
    if (!resultat.ok) {
      illisibles.push({ cle: cleCourante, motif: resultat.motif })
      continue
    }
    fiches.push(resultat.fiche)
  }

  fiches.sort((a, b) => (a.meta.modifieLe < b.meta.modifieLe ? 1 : a.meta.modifieLe > b.meta.modifieLe ? -1 : 0))
  return { fiches, illisibles }
}

/** Read one sheet. `null` covers both « absent » and « unreadable »: the
 * caller wanting to distinguish the two uses `lister`. */
export function lire(stockage: Storage, id: string): Fiche | null {
  const brut = stockage.getItem(cle(id))
  if (brut === null) return null
  const resultat = analyserEtMigrer(brut)
  return resultat.ok ? resultat.fiche : null
}

/** Write under `cle(fiche.id)` and nowhere else. Validated before the write,
 * refused without writing on a negative verdict — a refusal must never leave
 * a half-written sheet behind. A storage that throws (quota exceeded, private
 * mode) is reported, not swallowed and not let to escape as an exception. */
export function ecrire(stockage: Storage, fiche: Fiche): Resultat {
  const verdict = valider(fiche)
  if (!verdict.ok) {
    return { ok: false, motif: verdict.refus.map((refus) => refus.motif).join(' ') }
  }
  try {
    stockage.setItem(cle(fiche.id), JSON.stringify(verdict.fiche))
    return { ok: true, fiche: verdict.fiche }
  } catch {
    return { ok: false, motif: MOTS.ficheEcritureRefusee }
  }
}

export function creer(stockage: Storage, id: string, maintenant: string): Resultat {
  return ecrire(stockage, creerFicheVide(id, maintenant))
}

/**
 * Copy a sheet under a new id, marked as a copy in its displayed name so a
 * duplicate is never mistaken for the original in a list of sheets.
 */
export function dupliquer(stockage: Storage, id: string, nouvelId: string, maintenant: string): Resultat {
  const source = lire(stockage, id)
  if (source === null) return { ok: false, motif: MOTS.ficheIntrouvable }
  const copie: Fiche = {
    ...source,
    id: nouvelId,
    meta: {
      ...source.meta,
      nomPersonnage: `${source.meta.nomPersonnage} ${MOTS.ficheSuffixeCopie}`.trim(),
      creeLe: maintenant,
      modifieLe: maintenant,
    },
  }
  return ecrire(stockage, copie)
}

/**
 * Remove a sheet, but only after copying its current bytes under the rescue
 * key. That copy is the *only* thing that makes a delete recoverable — cf.
 * `restaurerSecours`. `undefined` from `getItem` on an absent key is treated
 * as « nothing to remove », not a failure: deleting twice must not error.
 */
export function supprimer(stockage: Storage, id: string): Resultat {
  const brut = stockage.getItem(cle(id))
  if (brut === null) {
    return { ok: false, motif: MOTS.ficheIntrouvable }
  }
  try {
    stockage.setItem(cleSecours(id), brut)
  } catch {
    return { ok: false, motif: MOTS.ficheEcritureRefusee }
  }
  const resultat = analyserEtMigrer(brut)
  try {
    stockage.removeItem(cle(id))
  } catch {
    return { ok: false, motif: MOTS.ficheEcritureRefusee }
  }
  return resultat.ok ? { ok: true, fiche: resultat.fiche } : { ok: false, motif: resultat.motif }
}

/**
 * Undo the most recent `supprimer` for `id`. Refuses when there is no rescue
 * copy — a stale success message here would claim a restore that did not
 * happen.
 */
export function restaurerSecours(stockage: Storage, id: string): Resultat {
  const brut = stockage.getItem(cleSecours(id))
  if (brut === null) {
    return { ok: false, motif: MOTS.ficheAucuneSauvegarde }
  }
  const resultat = analyserEtMigrer(brut)
  if (!resultat.ok) return resultat
  return ecrire(stockage, resultat.fiche)
}
