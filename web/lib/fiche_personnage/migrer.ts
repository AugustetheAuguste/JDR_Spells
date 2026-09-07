/* Chaîne de migration du schéma de la fiche.
 *
 * Vide en version 1 : aucun palier à franchir tant qu'il n'existe qu'une
 * version. Posée maintenant pour que les étapes ultérieures qui feront
 * évoluer le schéma n'aient pas à inventer le mécanisme.
 */
import { MOTS } from '@/lib/design/tokens'
import type { Fiche } from './schema'
import { VERSION_SCHEMA } from './schema'
import { valider } from './valider'

export interface Migration {
  readonly depuis: number
  readonly vers: number
  readonly appliquer: (entree: unknown) => unknown
}

/** Vide en version 1. Chaque migration future s'ajoute ici, un palier à la fois. */
export const MIGRATIONS: readonly Migration[] = []

export type ResultatMigration = { readonly ok: true; readonly fiche: Fiche } | { readonly ok: false; readonly motif: string }

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

/**
 * Fait remonter une entrée à la version courante du schéma, palier par
 * palier, puis la valide. Ne suppose jamais une version absente.
 */
export function migrer(entree: unknown): ResultatMigration {
  if (!estObjet(entree) || entree.schemaVersion === undefined) {
    return { ok: false, motif: MOTS.ficheRefusVersionAbsente }
  }

  const version = entree.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { ok: false, motif: MOTS.ficheRefusVersionInvalide }
  }

  if (version > VERSION_SCHEMA) {
    return { ok: false, motif: MOTS.ficheRefusVersionSuperieure }
  }

  let courante: unknown = entree
  let versionCourante = version

  while (versionCourante < VERSION_SCHEMA) {
    const palier = MIGRATIONS.find((migration) => migration.depuis === versionCourante)
    if (!palier) {
      return { ok: false, motif: MOTS.ficheRefusPalierManquant }
    }
    courante = palier.appliquer(courante)
    versionCourante = palier.vers
  }

  const verdict = valider(courante)
  if (!verdict.ok) {
    return { ok: false, motif: verdict.refus.map((refus) => refus.motif).join(' ') }
  }

  return { ok: true, fiche: verdict.fiche }
}
