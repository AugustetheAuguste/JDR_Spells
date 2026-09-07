/**
 * La chaîne de migration est vide en version 1. Ces tests couvrent le
 * comportement attendu avant qu'un premier palier n'existe, cf.
 * build/fiche_personnage/07_SCHEMA_FICHE.md § critères de vérification.
 */
import { describe, expect, it } from 'vitest'

import { creerFicheVide } from './fiche-vide'
import { migrer, MIGRATIONS } from './migrer'

describe('migrer', () => {
  it('refuse une version absente', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    const { schemaVersion: _schemaVersion, ...sansVersion } = fiche
    const resultat = migrer(sansVersion)
    expect(resultat.ok).toBe(false)
  })

  it('refuse une version supérieure à la version connue', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    const resultat = migrer({ ...fiche, schemaVersion: 999 })
    expect(resultat.ok).toBe(false)
  })

  it('accepte la version courante', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    const resultat = migrer(fiche)
    expect(resultat.ok).toBe(true)
  })

  it('traverse une liste de migrations vide sans erreur', () => {
    expect(MIGRATIONS).toHaveLength(0)
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    expect(() => migrer(fiche)).not.toThrow()
  })
})
