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
import { slugFamille } from '@/lib/exploration/familles'
import { appliquerFiltres } from '@/lib/recherche/filtres'
import { lireEtat, versFiltres } from '@/lib/navigation/etat-url'
import { grouperTags } from '@/lib/navigation/groupes-tags'

const INDEX = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'data', 'index.json'), 'utf8'),
) as IndexWeb

function lire(query: string): EtatExploration {
  return lireExploration(new URLSearchParams(query), INDEX)
}

const ESPRIT = slugFamille('Esprit')

describe('lire puis écrire est un point fixe', () => {
  const CAS = [
    '',
    'classe=barde',
    'classe=barde&niveau=2',
    `classe=barde&categorie=${ESPRIT}`,
    `classe=barde&categorie=${ESPRIT}&parcours=niveau,categorie`,
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
    expect(explorationActive(lire(`categorie=${ESPRIT}`))).toBe(true)
  })
})

describe('une valeur inconnue est écartée, jamais fatale', () => {
  it('une famille qui n’existe pas est ignorée', () => {
    expect(lire('categorie=pyrotechnie').categorie).toBeNull()
  })

  it('un axe qui n’existe pas retombe sur la suggestion', () => {
    expect(lire('axe=portee').axe).toBeNull()
  })

  it('un parcours ne garde que des axes connus, sans doublon', () => {
    // A path that visits the same axis twice is a path the breadcrumb cannot draw.
    expect(lire('parcours=niveau,portee,niveau,ecole').parcours).toEqual([
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
  it('sans famille, ce sont exactement les filtres du tableau', () => {
    const query = 'classe=barde&niveau=2&ecoles=evocation'
    expect(versFiltresExploration(lire(query), INDEX)).toEqual(
      versFiltres(lireEtat(new URLSearchParams(query), INDEX), INDEX),
    )
  })

  it('une famille signifie « n’importe lequel de ses tags »', () => {
    const famille = grouperTags(INDEX.tags).find((groupe) => groupe.titre === 'Esprit')
    const filtres = versFiltresExploration(lire(`categorie=${ESPRIT}`), INDEX)
    expect(filtres.tags).toHaveLength(famille?.tags.length ?? 0)
  })

  it('un tag posé rend la famille muette côté filtre', () => {
    // The spell carrying the tag necessarily carries one of the family's tags; the
    // family stays in the URL only so the breadcrumb can say where the reader is.
    const avecTag = lire(`categorie=${ESPRIT}&tags=effet_mental`)
    expect(versFiltresExploration(avecTag, INDEX).tags).toEqual(
      versFiltres(avecTag.base, INDEX).tags,
    )
    expect(avecTag.categorie).toBe(ESPRIT)
  })

  it('le lien « voir en tableau » montre la même liste, pas une plus large', () => {
    // The table route has no notion of a family, so the family is expanded into its
    // tags on the way out. Same spells on both sides, or the link lies.
    const etat = lire(`classe=barde&categorie=${ESPRIT}`)
    const ici = appliquerFiltres(INDEX.sorts, versFiltresExploration(etat, INDEX))
    const query = versQueryTableau(etat, INDEX)
    const laBas = appliquerFiltres(
      INDEX.sorts,
      versFiltres(lireEtat(new URLSearchParams(query), INDEX), INDEX),
    )
    expect(ici.length).toBeGreaterThan(0)
    expect(laBas.map((sort) => sort.id)).toEqual(ici.map((sort) => sort.id))
  })

  it('le lien en tableau n’emporte ni parcours ni axe', () => {
    const etat = forer(lire('classe=barde'), 'niveau', ['2'])
    const query = versQueryTableau(etat, INDEX)
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
