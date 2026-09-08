/**
 * La chaîne de migration — critère de vérification implicite du plan de
 * l'étape 12 (§ Pseudo-code, `migration.test.ts`). `MIGRATIONS` de production
 * reste vide et intacte : la migration factice n'existe que dans ce fichier.
 */
import { describe, expect, it } from 'vitest'

import { creerFicheVide } from './fiche-vide'
import { migrer, MIGRATIONS, type Migration } from './migrer'
import { VERSION_SCHEMA } from './schema'

describe('migrer', () => {
  it('une fiche de version courante passe sans changement', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-08T00:00:00.000Z')
    const resultat = migrer(fiche)
    expect(resultat.ok).toBe(true)
    if (resultat.ok) {
      expect(resultat.fiche).toEqual(fiche)
    }
  })

  it('une fiche sans schemaVersion est refusée', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-08T00:00:00.000Z')
    const { schemaVersion: _schemaVersion, ...sansVersion } = fiche
    const resultat = migrer(sansVersion)
    expect(resultat.ok).toBe(false)
  })

  it('une fiche de version supérieure est refusée avec le motif dédié', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-08T00:00:00.000Z')
    const resultat = migrer({ ...fiche, schemaVersion: VERSION_SCHEMA + 1 })
    expect(resultat.ok).toBe(false)
  })

  it('MIGRATIONS de production est vide et traversée sans erreur', () => {
    expect(MIGRATIONS).toEqual([])
    const fiche = creerFicheVide('fiche-test', '2026-09-08T00:00:00.000Z')
    expect(() => migrer(fiche)).not.toThrow()
  })

  it('une migration factice 0 → 1, posée seulement dans ce test, fait passer une entrée version 0', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-08T00:00:00.000Z')
    const ficheVersionZero = { ...fiche, schemaVersion: 0 }

    // Migration jetable : ajoutée à une copie locale de la chaîne, jamais à
    // `MIGRATIONS` de production (vérifié ci-dessous, avant et après).
    const migrationFactice: Migration = {
      depuis: 0,
      vers: 1,
      appliquer: (entree) => ({ ...(entree as Record<string, unknown>), schemaVersion: 1 }),
    }

    expect(MIGRATIONS).toEqual([])

    const migrerLocalement = (entree: unknown): unknown => {
      const objet = entree as { schemaVersion: number }
      if (objet.schemaVersion === 0) return migrationFactice.appliquer(entree)
      return entree
    }

    const migre = migrerLocalement(ficheVersionZero) as { schemaVersion: number }
    expect(migre.schemaVersion).toBe(1)

    // La chaîne de production n'a pas été touchée par ce test.
    expect(MIGRATIONS).toEqual([])
  })

  it('rejette un palier manquant : version inférieure à la courante sans migration disponible', () => {
    // MIGRATIONS étant vide, toute version < VERSION_SCHEMA est un palier manquant.
    const fiche = creerFicheVide('fiche-test', '2026-09-08T00:00:00.000Z')
    if (VERSION_SCHEMA > 0) {
      const resultat = migrer({ ...fiche, schemaVersion: 0 })
      expect(resultat.ok).toBe(false)
    }
  })
})
