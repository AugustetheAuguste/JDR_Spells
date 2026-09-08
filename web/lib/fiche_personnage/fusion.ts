/**
 * The merge, and nothing but the merge: no network, no React, no Supabase.
 *
 * Modelled on `web/lib/compte/synchro.ts` in shape, not in rule. Favourites
 * union spells because losing one is the failure this module's cousin
 * exists to prevent; a character sheet is a document edited in depth, and
 * unioning two edited copies field by field would produce a character no
 * one wrote. So where `synchro.ts` merges, this module refuses to and
 * reports a conflict instead — the whole point of `Conflit` is that no
 * function in this file ever picks a winner between two differing
 * contents.
 *
 * Existence, unlike content, still resolves without a human: a tombstone
 * beats a sheet that has not been touched since, exactly as it does for
 * favourites, for the same reason — a deletion that never traveled would
 * make every first sync on a new device a silent resurrection.
 */

import { VERSION_SCHEMA, type Fiche } from '@/lib/fiche_personnage/schema'
import { migrer } from '@/lib/fiche_personnage/migrer'
import type { LigneFiche } from '@/lib/fiche_personnage/distant'

/** A sheet whose content differs on both sides. Never auto-resolved: see
 * module docstring. */
export interface Conflit {
  readonly id: string
  readonly locale: Fiche
  readonly distante: LigneFiche
  readonly motif: string
}

/** A remote row that could not be trusted as-is: a schema too new for this
 * build, or one that failed migration. Left exactly where it was found —
 * never overwritten, never deleted. */
export interface Ignoree {
  readonly id: string
  readonly motif: string
}

export interface RapportFusionFiches {
  readonly aEcrireEnLocal: readonly Fiche[]
  readonly aEcrireEnDistant: readonly LigneFiche[]
  /**
   * Ids to remove from local storage.
   *
   * `schema.ts`'s `Fiche` carries no tombstone field — a sheet either exists
   * locally or it does not (cf. `magasin.ts`'s `supprimer`, a real removal
   * plus a one-shot rescue copy, not a dated marker). Rule 4 below can
   * still conclude "the remote deletion wins", and that conclusion has
   * nowhere to live inside a `Fiche`. Rather than inventing a field the
   * schema does not have, the caller (`SynchroFiches.tsx`) is handed this
   * separate list of ids and applies it through the existing
   * `magasin.supprimer`, which already knows how to remove a sheet safely.
   */
  readonly aSupprimerLocalement: readonly string[]
  readonly conflits: readonly Conflit[]
  readonly ignorees: readonly Ignoree[]
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

/** Order-independent structural equality. `JSON.stringify` would disagree on
 * two objects with the same keys written in a different order, and nothing
 * upstream promises a stable key order. */
function memeValeur(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    return a.every((element, index) => memeValeur(element, b[index]))
  }
  if (estObjet(a) || estObjet(b)) {
    if (!estObjet(a) || !estObjet(b)) return false
    const clesA = Object.keys(a)
    const clesB = Object.keys(b)
    if (clesA.length !== clesB.length) return false
    return clesA.every((cle) => Object.hasOwn(b, cle) && memeValeur(a[cle], b[cle]))
  }
  return false
}

/** A timestamp as a comparable number, 0 for "no date at all" — same
 * convention as `synchro.ts`'s `instant`, so an absent date never wins a
 * last-write-wins comparison. */
function instant(date: string | null): number {
  if (date === null || date === '') return 0
  const valeur = Date.parse(date)
  return Number.isNaN(valeur) ? 0 : valeur
}

/** Local sheet → the row shape it would take remotely, ready to upsert.
 * `supprime_le` is always null: a sheet present locally is, by that fact,
 * not deleted — pushing it also revives a sheet re-edited after a deletion
 * recorded elsewhere (rule 4). */
function versLigneFiche(fiche: Fiche): LigneFiche {
  return {
    id_fiche: fiche.id,
    schema_version: fiche.schemaVersion,
    contenu: fiche as unknown as Record<string, unknown>,
    nom: fiche.meta.nomPersonnage,
    cree_le: fiche.meta.creeLe === '' ? null : fiche.meta.creeLe,
    modifie_le: fiche.meta.modifieLe === '' ? null : fiche.meta.modifieLe,
    supprime_le: null,
    personnage_id: fiche.personnageId,
  }
}

/**
 * Merge local sheets with what the account holds.
 *
 * `maintenant` is accepted for the same reason every other pure function in
 * this codebase takes its clock as an argument (cf. Skill
 * `pf-fiche-personnage` § 7): it is not read from inside this function, so
 * the caller decides what "now" means, and a test can hand it any instant.
 */
export function fusionner(
  locales: readonly Fiche[],
  distantes: readonly LigneFiche[],
  maintenant: Date | string,
): RapportFusionFiches {
  const horodatageActuel = typeof maintenant === 'string' ? maintenant : maintenant.toISOString()
  void horodatageActuel // accepted for API symmetry; every date compared below already carries its own timestamp

  const parIdLocal = new Map(locales.map((fiche) => [fiche.id, fiche]))
  const parIdDistant = new Map(distantes.map((ligne) => [ligne.id_fiche, ligne]))

  const aEcrireEnLocal: Fiche[] = []
  const aEcrireEnDistant: LigneFiche[] = []
  const aSupprimerLocalement: string[] = []
  const conflits: Conflit[] = []
  const ignorees: Ignoree[] = []

  function motifVersionSuperieure(schemaVersionDistante: number): string {
    return (
      `la fiche distante utilise le schéma version ${schemaVersionDistante}, ` +
      `plus récente que la version ${VERSION_SCHEMA} de cette build. Mettez à jour l’application.`
    )
  }

  for (const locale of locales) {
    const distante = parIdDistant.get(locale.id)

    // Rule 1: present on this side only, goes to the other without question.
    if (distante === undefined) {
      aEcrireEnDistant.push(versLigneFiche(locale))
      continue
    }

    // Rule 4: existence. A tombstone beats a sheet untouched since; editing
    // after the deletion is an unambiguous statement of wanting to keep it.
    if (distante.supprime_le !== null && distante.supprime_le !== '') {
      if (instant(locale.meta.modifieLe) > instant(distante.supprime_le)) {
        aEcrireEnDistant.push(versLigneFiche(locale))
      } else {
        aSupprimerLocalement.push(locale.id)
      }
      continue
    }

    // Rule 6: a remote schema newer than this build cannot be read at all.
    if (distante.schema_version > VERSION_SCHEMA) {
      ignorees.push({ id: locale.id, motif: motifVersionSuperieure(distante.schema_version) })
      continue
    }

    // Rule 5: a remote row that fails migration is reported, never written.
    const migree = migrer(distante.contenu)
    if (!migree.ok) {
      ignorees.push({ id: locale.id, motif: migree.motif })
      continue
    }

    // Rule 2: identical content on both sides, nothing to do.
    if (memeValeur(locale, migree.fiche)) {
      continue
    }

    // Rule 3: differing content, always a conflict, never resolved here.
    conflits.push({
      id: locale.id,
      locale,
      distante,
      motif: 'la fiche a été modifiée sur cet appareil et sur le compte, un choix humain est nécessaire',
    })
  }

  for (const distante of distantes) {
    if (parIdLocal.has(distante.id_fiche)) continue // already handled above

    // A tombstone unknown locally names nothing to create.
    if (distante.supprime_le !== null && distante.supprime_le !== '') continue

    if (distante.schema_version > VERSION_SCHEMA) {
      ignorees.push({ id: distante.id_fiche, motif: motifVersionSuperieure(distante.schema_version) })
      continue
    }

    const migree = migrer(distante.contenu)
    if (!migree.ok) {
      ignorees.push({ id: distante.id_fiche, motif: migree.motif })
      continue
    }

    // Rule 1, mirrored: present on the other side only.
    aEcrireEnLocal.push(migree.fiche)
  }

  return { aEcrireEnLocal, aEcrireEnDistant, aSupprimerLocalement, conflits, ignorees }
}
