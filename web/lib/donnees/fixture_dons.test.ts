/**
 * Asserts the hand-written fixture (`web/fixtures/index_dons.json`) actually
 * covers the nine grid cases it was built for. A fixture that silently drops
 * a case would let the consumers of this contract (steps 10, 11, 13) build
 * against a shape they never actually see exercised.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const RACINE_WEB = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const RACINE_DEPOT = resolve(RACINE_WEB, '..')

interface Don {
  readonly i: number
  readonly id: string
  readonly s: string
  readonly n: string
  readonly nf: string
  readonly r: boolean
  readonly ep: number | null
  readonly es: readonly number[]
  readonly cb: readonly number[]
  readonly cx: readonly number[]
  readonly ac: number | null
  readonly pv: number | null
  readonly cat: readonly number[]
  readonly src: number | null
  readonly vb: string | null
  readonly rc: string | null
  readonly mc: readonly string[]
}

interface IndexDons {
  readonly dons: readonly Don[]
  readonly categories: readonly string[]
  readonly sources: readonly string[]
}

const index: IndexDons = JSON.parse(
  readFileSync(resolve(RACINE_DEPOT, 'web/fixtures/index_dons.json'), 'utf8'),
) as IndexDons

function trouver(nom: string): Don {
  const don = index.dons.find((d) => d.n === nom)
  if (don === undefined) throw new Error(`fixture : don "${nom}" introuvable`)
  return don
}

describe('fixture des dons — taille et grille des neuf cas', () => {
  it('contient exactement 24 dons', () => {
    expect(index.dons).toHaveLength(24)
  })

  it('cas 1 — un don sans prérequis (Endurance)', () => {
    // The fixture only carries character-independent fields; the absence of
    // prerequisites is attested here by the source feat's real Conditions
    // column ("—"), not by a field of this contract.
    expect(trouver('Endurance')).toBeDefined()
  })

  it('cas 2 — un don à chaîne de prérequis profonde (>= 3 niveaux)', () => {
    // Tir à bout portant* (0) <- Tir rapide* / Tir soudain* (1) <- Science du
    // tir soudain* (2) <- Tir soudain supérieur* (3) : 4 niveaux réels dans
    // Dons.csv. All four links of that chain are present in the fixture.
    for (const nom of ['Tir à bout portant*', 'Tir rapide*', 'Tir soudain*', 'Science du tir soudain*', 'Tir soudain supérieur*']) {
      expect(trouver(nom)).toBeDefined()
    }
  })

  it('cas 3 — au moins un don répétable (nom finissant par *)', () => {
    const repetables = index.dons.filter((d) => d.r)
    expect(repetables.length).toBeGreaterThan(0)
    for (const d of repetables) {
      expect(d.n.endsWith('*')).toBe(true)
      expect(d.s.endsWith('*')).toBe(false) // l'astérisque n'entre jamais dans le slug
    }
  })

  it('cas 4 — un don dont les Conditions du catalogue portent un OU (Acrobate des corniches)', () => {
    // Real Conditions: "Dex 13, nain, trait racial montagnard ou stabilité".
    expect(trouver('Acrobate des corniches')).toBeDefined()
  })

  it('cas 5 — un don magique de confiance haute (Absorption rageuse)', () => {
    // feat_magic_info.json: is_magic=true, needs_manual_check=false.
    const don = trouver('Absorption rageuse')
    expect(don.cx.length).toBeGreaterThan(0)
  })

  it('cas 6 — un don à gating racial/anatomie/divinité/alignement', () => {
    expect(trouver('Arrachage sauvage*')).toBeDefined() // anatomie : attaque de morsure
    expect(trouver('Canalisateur polyvalent')).toBeDefined() // alignement
    expect(trouver('Guérison athée')).toBeDefined() // divinité (absence de divinité)
  })

  it("cas 7 — un don non étiqueté par la couche LLM : tous les champs sémantiques nuls/[]", () => {
    const don = trouver('Vigilance instinctive')
    expect(don.ep).toBeNull()
    expect(don.es).toEqual([])
    expect(don.cb).toEqual([])
    expect(don.cx).toEqual([])
    expect(don.ac).toBeNull()
    expect(don.pv).toBeNull()
    expect(don.vb).toBeNull()
    expect(don.rc).toBeNull()
    expect(don.mc).toEqual([])
    // But every key is still PRESENT (not omitted) — that's the point.
    expect(Object.keys(don)).toContain('ep')
    expect(Object.keys(don)).toContain('mc')
  })

  it('cas 8 — un don à catégorie officielle multiple (Blessant : combat + sociale)', () => {
    const don = trouver('Blessant*')
    expect(don.cat.length).toBeGreaterThanOrEqual(2)
    const noms = don.cat.map((code) => index.categories[code])
    expect(noms).toContain('combat')
    expect(noms).toContain('sociale')
  })

  it('cas 9 — un don dont la source est rare (Compagnon mythique, CMy)', () => {
    const don = trouver('Compagnon mythique')
    expect(don.src).not.toBeNull()
    expect(index.sources[don.src as number]).toBe('CMy')
  })
})
