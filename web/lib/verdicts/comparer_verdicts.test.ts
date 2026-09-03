/**
 * Adversarial fixtures for scripts/comparer_verdicts.ts.
 *
 * A differ that never detects anything passes a green CI in silence — exactly
 * the failure mode 02_TOOLS.md warns against. So this test does not just check
 * the identical case: it also feeds the differ one manufactured RÉGRESSION, one
 * RELÂCHEMENT, one BRUIT-only pair, and one pair with disjoint key sets, and
 * asserts each is classified as the plan's asymmetric rule demands — a
 * RÉGRESSION must never be reported as a RELÂCHEMENT or vice versa.
 *
 * The pure functions (`lireJsonl`, `comparer`, `formaterRapport`) are exercised
 * directly rather than through a spawned CLI process: this both keeps the test
 * fast and exercises exactly the logic the future step-14 comparison will call,
 * without depending on tsx's process-spawning behaviour on Windows.
 */

import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { comparer, formaterRapport, lireJsonl } from '../../../scripts/comparer_verdicts'

const RACINE_FIXTURES = join(process.cwd(), 'fixtures', 'verdicts')

function charger(nom: string): ReturnType<typeof lireJsonl> {
  return lireJsonl(join(RACINE_FIXTURES, `${nom}.jsonl`))
}

describe('comparer_verdicts — cas identique', () => {
  it('ne rapporte ni régression ni relâchement, sortie 0 attendue', () => {
    const rapport = comparer(charger('identique_reference'), charger('identique_candidat'))
    expect(rapport.couvertureDivergente).toBe(false)
    expect(rapport.regressions).toHaveLength(0)
    expect(rapport.relachements).toHaveLength(0)
    expect(rapport.bruits).toHaveLength(0)
    expect(formaterRapport(rapport)).toContain('0 régression(s), 0 relâchement(s)')
  })
})

describe('comparer_verdicts — une régression', () => {
  it('classe eligible -> ineligible en RÉGRESSION, jamais en RELÂCHEMENT', () => {
    const rapport = comparer(
      charger('une_regression_reference'),
      charger('une_regression_candidat'),
    )
    expect(rapport.regressions).toHaveLength(1)
    expect(rapport.relachements).toHaveLength(0)
    expect(rapport.regressions[0]?.nom_don).toBe('Attaque en puissance')
    const echec = rapport.regressions.length > 0 || rapport.relachements.length > 0
    expect(echec).toBe(true) // sortie attendue : 1
    expect(formaterRapport(rapport)).toContain('RÉGRESSION')
  })
})

describe('comparer_verdicts — un relâchement', () => {
  it('classe ineligible -> eligible en RELÂCHEMENT, jamais en RÉGRESSION', () => {
    const rapport = comparer(
      charger('un_relachement_reference'),
      charger('un_relachement_candidat'),
    )
    expect(rapport.relachements).toHaveLength(1)
    expect(rapport.regressions).toHaveLength(0)
    expect(rapport.relachements[0]?.nom_don).toBe('Endurance')
    const echec = rapport.regressions.length > 0 || rapport.relachements.length > 0
    expect(echec).toBe(true) // sortie attendue : 1
    expect(formaterRapport(rapport)).toContain('RELÂCHEMENT')
  })
})

describe('comparer_verdicts — bruit de motif', () => {
  it('ne bloque pas quand seuls les motifs diffèrent, sortie 0 attendue', () => {
    const rapport = comparer(
      charger('bruit_de_motif_reference'),
      charger('bruit_de_motif_candidat'),
    )
    expect(rapport.bruits).toHaveLength(1)
    expect(rapport.regressions).toHaveLength(0)
    expect(rapport.relachements).toHaveLength(0)
    const echec = rapport.regressions.length > 0 || rapport.relachements.length > 0
    expect(echec).toBe(false) // sortie attendue : 0, malgré l'avertissement
    expect(formaterRapport(rapport)).toContain('BRUIT')
  })
})

describe('comparer_verdicts — couverture divergente', () => {
  it('échoue net sur un ensemble de clés disjoint, jamais « 0 divergence »', () => {
    const rapport = comparer(
      charger('couverture_divergente_reference'),
      charger('couverture_divergente_candidat'),
    )
    expect(rapport.couvertureDivergente).toBe(true)
    expect(formaterRapport(rapport)).toContain('couverture divergente')
    // Crucially, a diverging key set must not fall through to a 0-diff report.
    expect(rapport.regressions).toHaveLength(0)
    expect(rapport.relachements).toHaveLength(0)
    expect(rapport.bruits).toHaveLength(0)
  })
})
