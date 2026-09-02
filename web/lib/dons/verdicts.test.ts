/**
 * Tests for `verdicts.ts` — the pure loader/dump logic — plus an
 * end-to-end check that `scripts/vider_verdicts_ts.ts` produces a sorted,
 * exact-format, byte-identical-on-rerun JSONL. Never compared against a
 * Python producer here (that is step 14's job): only the TS engine's own
 * self-consistency is asserted.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  clePersonnage,
  construireCatalogue,
  construirePersonnage,
  construireTables,
  serialiserLigne,
  trancherEnSlug,
  viderVerdicts,
} from './verdicts.js'
import type { ContratMoteurDons, EntreeMatricePersonnage, MatricePersonnages } from './verdicts.js'

const RACINE_WEB = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const RACINE_DEPOT = resolve(RACINE_WEB, '..')
const TSX = resolve(RACINE_DEPOT, 'node_modules/tsx/dist/cli.mjs')
const SCRIPT = resolve(RACINE_DEPOT, 'scripts/vider_verdicts_ts.ts')
const CHEMIN_CONTRAT = resolve(RACINE_DEPOT, 'data/schemas/moteur_dons.schema.json')
const CHEMIN_MATRICE = resolve(RACINE_DEPOT, 'data/dons/matrice_personnages.json')

const CONTRAT_MIN: ContratMoteurDons = {
  conditions: {
    endurance: { brut: '', effectif: '', exigences: [] },
    'attaque-en-puissance': {
      brut: 'BBA +1',
      effectif: 'BBA +1',
      exigences: [{ type: 'bba', charge: { min: 1 }, verif_manuelle: false, segment: 'BBA +1' }],
    },
  },
  lanceurs: { guerrier: { is_caster: false } },
  maitrises: { guerrier: { armes_martiales: true, armes_simples: true, armes_specifiques: [], boucliers: true } },
  magie_des_dons: {
    Endurance: { is_magic: false, matched_keywords: [], needs_manual_check: false },
    'Attaque en puissance': { is_magic: false, matched_keywords: [], needs_manual_check: false },
  },
  affinite_creature: {},
  restriction_de_classe: {},
  races: { humain: { taille: 'M', texte_traits: '', magie_innee: false } },
  armes_raciales: {},
  reclassement_racial: {},
  progression_bba: { guerrier: 'good' },
}

const ENTREE: EntreeMatricePersonnage = {
  classe: 'guerrier',
  niveau: 5,
  race: 'humain',
  caracteristiques: { charisme: 14, constitution: 14, dexterite: 14, force: 14, intelligence: 14, sagesse: 14 },
  dons_acquis: [],
  alignement: 'Neutre',
  divinite: null,
}

describe('trancherEnSlug', () => {
  it('reproduit build_moteur_dons_contract.py::slugify (accents, astérisque, espaces)', () => {
    expect(trancherEnSlug('Endurance')).toBe('endurance')
    expect(trancherEnSlug('Arme de prédilection*')).toBe('arme-de-predilection')
    expect(trancherEnSlug('Attaque en puissance')).toBe('attaque-en-puissance')
  })
})

describe('construireCatalogue', () => {
  it('réindexe les conditions (par slug) par nom exact du catalogue', () => {
    const catalogue = construireCatalogue(CONTRAT_MIN)
    expect(catalogue.has('Endurance')).toBe(true)
    expect(catalogue.has('Attaque en puissance')).toBe(true)
    expect(catalogue.size).toBe(2)
  })
})

describe('construirePersonnage', () => {
  it('convertit les caractéristiques en abréviations françaises', () => {
    const perso = construirePersonnage(ENTREE)
    expect(perso.caracteristiques).toEqual({ Cha: 14, Con: 14, Dex: 14, For: 14, Int: 14, Sag: 14 })
  })

  it('dons_connus est toujours un Set explicite (jamais undefined)', () => {
    const perso = construirePersonnage(ENTREE)
    expect(perso.dons_connus).toBeInstanceOf(Set)
    expect(perso.dons_connus?.size).toBe(0)
  })

  it('divinite null devient undefined (absente), pas null littéral', () => {
    const perso = construirePersonnage(ENTREE)
    expect(perso.divinite).toBeUndefined()
    expect('divinite' in perso).toBe(false)
  })
})

describe('clePersonnage', () => {
  it('forme "<classe>|<niveau>|<race>"', () => {
    expect(clePersonnage(ENTREE)).toBe('guerrier|5|humain')
  })
})

describe('viderVerdicts — format des 4 clés, tri par octets', () => {
  const matrice: MatricePersonnages = { complet: [ENTREE], rapide: [ENTREE] }

  it('chaque ligne porte exactement les 4 clés du contrat, jamais omises', () => {
    const lignes = viderVerdicts(CONTRAT_MIN, matrice, 'rapide')
    expect(lignes.length).toBeGreaterThan(0)
    for (const ligne of lignes) {
      expect(Object.keys(ligne).sort()).toEqual(['cle_personnage', 'motifs', 'nom_don', 'statut'])
    }
  })

  it('trié par (cle_personnage, nom_don) en octets', () => {
    const lignes = viderVerdicts(CONTRAT_MIN, matrice, 'rapide')
    const cles = lignes.map((l) => `${l.cle_personnage} ${l.nom_don}`)
    const triees = [...cles].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    expect(cles).toEqual(triees)
  })

  it('serialiserLigne produit du JSON compact, une clé jamais omise', () => {
    const [ligne] = viderVerdicts(CONTRAT_MIN, matrice, 'rapide')
    const texte = serialiserLigne(ligne!)
    const relu = JSON.parse(texte)
    expect(Object.keys(relu).sort()).toEqual(['cle_personnage', 'motifs', 'nom_don', 'statut'])
    expect(texte).not.toContain('\n')
  })
})

describe('construireTables', () => {
  it('recopie les tables du contrat sans les retraiter', () => {
    const tables = construireTables(CONTRAT_MIN)
    expect(tables.progression_bba).toBe(CONTRAT_MIN.progression_bba)
    expect(tables.lanceurs).toBe(CONTRAT_MIN.lanceurs)
  })
})

describe('scripts/vider_verdicts_ts.ts — bout en bout', () => {
  it('produit un JSONL trié, au format exact, relançable à l’octet identique', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'verdicts-ts-'))
    const sortie = join(dossier, 'verdicts_ts.jsonl')
    try {
      const executer = (): string =>
        execFileSync(
          process.execPath,
          [TSX, SCRIPT, '--profil', 'rapide', '--contrat', CHEMIN_CONTRAT, '--matrice', CHEMIN_MATRICE, '-o', sortie],
          { cwd: RACINE_DEPOT, encoding: 'utf8' },
        )

      executer()
      const premierContenu = readFileSync(sortie, 'utf8')
      executer()
      const secondContenu = readFileSync(sortie, 'utf8')

      expect(secondContenu).toBe(premierContenu)
      expect(premierContenu.endsWith('\n')).toBe(true)
      expect(premierContenu.includes('\r')).toBe(false)

      const lignes = premierContenu.trimEnd().split('\n')
      expect(lignes.length).toBeGreaterThan(0)
      const cles: string[] = []
      for (const ligne of lignes) {
        const objet = JSON.parse(ligne) as Record<string, unknown>
        expect(Object.keys(objet).sort()).toEqual(['cle_personnage', 'motifs', 'nom_don', 'statut'])
        cles.push(`${objet.cle_personnage as string} ${objet.nom_don as string}`)
      }
      const triees = [...cles].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      expect(cles).toEqual(triees)
    } finally {
      rmSync(dossier, { recursive: true, force: true })
    }
  }, 90000)
})
