/**
 * Proves the dons contract checker (`scripts/check_data_contract_dons.ts`)
 * actually catches what it claims to catch.
 *
 * A verifier nobody has watched fail verifies nothing: the five fixtures
 * under `web/fixtures/dons_casses/` are each the good fixture with exactly
 * one contract violation introduced, and this test asserts the checker exits
 * 1 on every one of them, plus 0 on the good fixture itself.
 *
 * The checker lives at the repo root (`scripts/`), one level above `web/`,
 * and this app's `node_modules` does not carry `tsx` or `ajv` — those are
 * root devDependencies. The test therefore shells out to the root's own
 * `tsx` binary rather than assuming either package is resolvable from here.
 */

import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const RACINE_WEB = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const RACINE_DEPOT = resolve(RACINE_WEB, '..')
const TSX = resolve(RACINE_DEPOT, 'node_modules/tsx/dist/cli.mjs')
const CHECKER = resolve(RACINE_DEPOT, 'scripts/check_data_contract_dons.ts')

interface Resultat {
  readonly code: number
  readonly sortie: string
}

function executer(cheminFixture: string): Resultat {
  try {
    const sortie = execFileSync(process.execPath, [TSX, CHECKER, cheminFixture], {
      cwd: RACINE_DEPOT,
      encoding: 'utf8',
    })
    return { code: 0, sortie }
  } catch (erreur) {
    const e = erreur as { status?: number; stdout?: string; stderr?: string }
    return { code: e.status ?? 1, sortie: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

describe('check_data_contract_dons — la bonne fixture', () => {
  it('sort avec le code 0', () => {
    const { code, sortie } = executer('web/fixtures/index_dons.json')
    expect(code, sortie).toBe(0)
  })
})

describe('check_data_contract_dons — les cinq fixtures cassées', () => {
  const cas: ReadonlyArray<readonly [string, string]> = [
    ['slug dupliqué', 'web/fixtures/dons_casses/slug_duplique.json'],
    ['`i` troué', 'web/fixtures/dons_casses/i_troue.json'],
    ['code `ep` hors table', 'web/fixtures/dons_casses/code_ep_hors_table.json'],
    ['`nf` ≠ plier(n)', 'web/fixtures/dons_casses/nf_incoherent.json'],
    ['champ inconnu ajouté', 'web/fixtures/dons_casses/champ_inconnu.json'],
  ]

  it.each(cas)('%s → code de sortie 1', (_titre, chemin) => {
    const { code } = executer(chemin)
    expect(code).toBe(1)
  })
})
