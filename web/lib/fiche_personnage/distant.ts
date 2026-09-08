/**
 * The only file that talks to the `fiches` table. Three verbs, on the model
 * of `web/lib/compte/distant.ts` — read everything, upsert everything,
 * bury one.
 *
 * No merging happens here and no policy is decided here — `fusion.ts` owns
 * that, in pure functions with no network. `user_id` is never a column of
 * `LigneFiche`: it is supplied separately to every call because it is part
 * of the composite primary key, not because it is hidden from the caller.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** A failure the interface can show a human. Postgres/PostgREST messages are
 * precise but written for whoever wrote the query. */
export class ErreurDistanteFiche extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ErreurDistanteFiche'
  }
}

/** One row of `public.fiches`, `user_id` excluded — RLS and `auth.uid()`
 * decide which rows a query can even see, so naming it again on every row
 * would only be a value the caller could get wrong. */
export interface LigneFiche {
  readonly id_fiche: string
  readonly schema_version: number
  readonly contenu: Record<string, unknown>
  readonly nom: string | null
  readonly cree_le: string | null
  readonly modifie_le: string | null
  readonly supprime_le: string | null
  readonly personnage_id: string | null
}

export type ResultatDistant<T> =
  | { readonly ok: true; readonly valeur: T }
  | { readonly ok: false; readonly motif: string }

const COLONNES =
  'id_fiche, schema_version, contenu, nom, cree_le, modifie_le, supprime_le, personnage_id'

/** Read everything the account holds, tombstones included — a buried row is
 * still a fact the merge needs to see, not a row to filter out here. */
export async function lireFichesDistantes(
  client: SupabaseClient,
): Promise<ResultatDistant<readonly LigneFiche[]>> {
  const reponse = await client.from('fiches').select(COLONNES)
  if (reponse.error !== null) {
    return { ok: false, motif: 'Vos fiches n’ont pas pu être relues depuis le compte.' }
  }
  return { ok: true, valeur: reponse.data as unknown as readonly LigneFiche[] }
}

/**
 * Upsert a batch of rows. `user_id` is attached here, once, rather than
 * asked of every caller of `fusion.ts` — the composite primary key is a fact
 * of this table, not of the merge.
 */
export async function ecrireFichesDistantes(
  client: SupabaseClient,
  user_id: string,
  lignes: readonly LigneFiche[],
): Promise<ResultatDistant<void>> {
  if (lignes.length === 0) return { ok: true, valeur: undefined }
  const avecUtilisateur = lignes.map((ligne) => ({ ...ligne, user_id }))
  const { error } = await client
    .from('fiches')
    .upsert(avecUtilisateur, { onConflict: 'user_id,id_fiche' })
  if (error !== null) {
    return { ok: false, motif: 'Vos fiches n’ont pas pu être envoyées au compte.' }
  }
  return { ok: true, valeur: undefined }
}

/**
 * Record a deletion as a dated write. `update`, never `delete`: a row that
 * disappears is indistinguishable from a row that never existed, and the
 * tombstone is what lets the next device tell the two apart.
 */
export async function marquerSupprimee(
  client: SupabaseClient,
  user_id: string,
  id_fiche: string,
  supprime_le: string,
): Promise<ResultatDistant<void>> {
  const { error } = await client
    .from('fiches')
    .update({ supprime_le })
    .eq('user_id', user_id)
    .eq('id_fiche', id_fiche)
  if (error !== null) {
    return { ok: false, motif: 'Une suppression de fiche n’a pas pu être enregistrée sur le compte.' }
  }
  return { ok: true, valeur: undefined }
}
