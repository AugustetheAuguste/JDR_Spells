/**
 * The global-search source registry.
 *
 * Two kinds of check: a static one, that the module itself never pulls
 * MiniSearch (or `lib/recherche/moteur`, which does) in as a value import —
 * only `import type`, which TypeScript erases entirely — and a behavioural
 * one, that neither source fetches its index before `chercher` is actually
 * called.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { IndexDons } from '@/lib/donnees/index-web-dons'
import type { IndexWeb } from '@/lib/donnees/index-web'

const SOURCE_TEXTE = readFileSync(join(process.cwd(), 'lib', 'recherche', 'sources-globales.ts'), 'utf8')

describe('sources-globales, chargement paresseux', () => {
  it("n'importe jamais minisearch ni moteur.ts par une importation de valeur", () => {
    // A type-only import is erased at compile time and therefore never pulls
    // MiniSearch into whatever bundle imports this module; a value import of
    // either would.
    expect(SOURCE_TEXTE).not.toMatch(/^import\s+(?!type\b)[^\n]*['"]minisearch['"]/m)
    expect(SOURCE_TEXTE).not.toMatch(/^import\s+(?!type\b)[^\n]*recherche\/moteur['"]/m)
    // The only reference to the engine module is inside a dynamic `import(...)`.
    expect(SOURCE_TEXTE).toMatch(/import\(['"]@\/lib\/recherche\/moteur['"]\)/)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("sourceSorts ne charge l'index ni le moteur avant le premier appel a chercher", async () => {
    const index: IndexWeb = {
      version: 1,
      genere_le: '',
      ecoles: [],
      classes: [],
      portees: [],
      jets: [],
      composantes: [],
      tags: [],
      temps_incantation: [],
      types_degats: [],
      conditions_infligees: [],
      sorts: [
        {
          i: 0,
          id: 'boule-de-feu',
          s: 'boule-de-feu',
          n: 'Boule de feu',
          nf: 'boule de feu',
          e: null,
          niv: {},
          c: [],
          p: null,
          j: null,
          rm: null,
          t: [],
          ti: null,
          td: null,
          ci: [],
          d: false,
        },
      ],
    }
    const fetchAppele = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(index) } as Response),
    )
    vi.stubGlobal('fetch', fetchAppele)

    const { sourceSorts } = await import('./sources-globales')
    expect(fetchAppele).not.toHaveBeenCalled()

    const resultats = await sourceSorts.chercher('feu', 5)
    expect(fetchAppele).toHaveBeenCalledWith('/data/index.json')
    expect(resultats.map((r) => r.href)).toContain('/sorts/boule-de-feu/')
  })

  it("sourceDons ne charge l'index des dons avant le premier appel a chercher", async () => {
    const index: IndexDons = {
      version: 1,
      genere_le: '',
      effets_principaux: [],
      cibles_bonus: [],
      contextes: [],
      activations: [],
      polyvalences: [],
      categories: [],
      sources: [],
      dons: [
        {
          i: 0,
          id: 'esquive',
          s: 'esquive',
          n: 'Esquive',
          nf: 'esquive',
          r: false,
          ep: null,
          es: [],
          cb: [],
          cx: [],
          ac: null,
          pv: null,
          cat: [],
          src: null,
          vb: null,
          rc: null,
          mc: [],
        },
      ],
    }
    const fetchAppele = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(index) } as Response),
    )
    vi.stubGlobal('fetch', fetchAppele)

    const { sourceDons } = await import('./sources-globales')
    expect(fetchAppele).not.toHaveBeenCalled()

    const resultats = await sourceDons.chercher('esquive', 5)
    expect(fetchAppele).toHaveBeenCalledWith('/data/dons/index.json')
    expect(resultats.map((r) => r.href)).toContain('/dons/esquive/')
  })
})
