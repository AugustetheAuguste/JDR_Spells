/**
 * The URL is the state (CLAUDE.md § 11), so these are the tests that keep it honest:
 * a link opens on exactly the view it was copied from, a hand-typed value cannot
 * break the page, and a family means the same set of spells here as the table route
 * shows when the link is handed over to it.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { IndexWeb } from '@/lib/donnees/index-web'
import { forer } from '@/lib/exploration/axes'
import {
  ecrireExploration,
  explorationActive,
  EXPLORATION_VIDE,
  lireExploration,
  versFiltresExploration,
  versQueryExploration,
  versQueryTableau,
  type EtatExploration,
} from '@/lib/exploration/etat-exploration'
import { appliquerFiltres } from '@/lib/recherche/filtres'
import { lireEtat, versFiltres } from '@/lib/navigation/etat-url'

const INDEX = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'data', 'index.json'), 'utf8'),
) as IndexWeb

function lire(query: string): EtatExploration {
  return lireExploration(new URLSearchParams(query), INDEX)
}

describe('lire puis écrire est un point fixe', () => {
  const CAS = [
    '',
    'classe=barde',
    'classe=barde&niveau=2',
    'classe=barde&tags=effet_mental',
    'classe=barde&tags=effet_mental&parcours=niveau',
    'classe=barde&axe=ecole',
  ]

  it.each(CAS)('« %s » se relit à l’identique', (query) => {
    const etat = lire(query)
    const rendu = ecrireExploration(etat).toString()
    expect(ecrireExploration(lire(rendu)).toString()).toBe(rendu)
  })

  it('n’émet aucune clé pour l’état vide — la route nue reste nue', () => {
    expect(versQueryExploration(EXPLORATION_VIDE)).toBe('')
    expect(explorationActive(EXPLORATION_VIDE)).toBe(false)
  })

  it('un seul critère suffit à rendre l’exploration active', () => {
    expect(explorationActive(lire('classe=barde'))).toBe(true)
    expect(explorationActive(lire('tags=effet_mental'))).toBe(true)
  })
})

describe('une valeur inconnue est écartée, jamais fatale', () => {
  it('un axe qui n’existe pas retombe sur la suggestion', () => {
    expect(lire('axe=inexistant').axe).toBeNull()
  })

  it('un parcours ne garde que des axes connus, sans doublon', () => {
    // A path that visits the same axis twice is a path the breadcrumb cannot draw.
    expect(lire('parcours=niveau,inexistant,niveau,ecole').parcours).toEqual([
      'niveau',
      'ecole',
    ])
  })

  it('la casse et les espaces sont tolérés dans les clés propres à la route', () => {
    expect(lire('axe=Ecole').axe).toBe('ecole')
    expect(lire('parcours= NIVEAU , ecole ').parcours).toEqual(['niveau', 'ecole'])
  })
})

describe('les filtres partagés avec la route en tableau', () => {
  it('ce sont exactement les filtres du tableau', () => {
    const query = 'classe=barde&niveau=2&ecoles=evocation&tags=effet_mental'
    expect(versFiltresExploration(lire(query), INDEX)).toEqual(
      versFiltres(lireEtat(new URLSearchParams(query), INDEX), INDEX),
    )
  })

  it('le lien « voir en tableau » montre la même liste', () => {
    const etat = lire('classe=barde&tags=effet_mental')
    const ici = appliquerFiltres(INDEX.sorts, versFiltresExploration(etat, INDEX))
    const query = versQueryTableau(etat)
    const laBas = appliquerFiltres(
      INDEX.sorts,
      versFiltres(lireEtat(new URLSearchParams(query), INDEX), INDEX),
    )
    expect(ici.length).toBeGreaterThan(0)
    expect(laBas.map((sort) => sort.id)).toEqual(ici.map((sort) => sort.id))
  })

  it('le lien en tableau n’emporte ni parcours ni axe', () => {
    const etat = forer(lire('classe=barde'), 'niveau', ['2'])
    const query = versQueryTableau(etat)
    expect(query).not.toContain('parcours')
    expect(query).not.toContain('axe')
    expect(query).toContain('classe=barde')
  })
})

describe('un état foré se recharge sur la même vue', () => {
  it('le parcours survit à l’aller-retour par l’URL', () => {
    const etat = forer(forer(lire('classe=barde'), 'niveau', ['2']), 'ecole', ['evocation'])
    const relu = lire(ecrireExploration(etat).toString())
    expect(relu.parcours).toEqual(['niveau', 'ecole'])
    expect(relu.base.classe).toBe('barde')
    expect(relu.base.niveaux).toEqual([2])
    expect(relu.base.ecoles).toEqual(['evocation'])
  })
})
