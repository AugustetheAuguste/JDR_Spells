/**
 * The `dons_*` URL contract, layered onto the existing spell URL contract.
 *
 * The two halves are read/written by independent function pairs
 * (`lireEtat`/`ecrireEtat` for spells, `lireEtatDons`/`ecrireEtatDons` for
 * dons) precisely so that adding this half could never touch the first: every
 * assertion below that exercises the existing spell functions is there to
 * prove that, not to re-test spells.
 */

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { type IndexWeb } from '@/lib/donnees/index-web'
import { CHEMIN_INDEX_FIXTURE } from '@/lib/donnees/lire-index'
import { FILTRES_DONS_VIDES, STATUTS_DONS, type StatutDon } from '@/lib/recherche/filtres'

import {
  CLES,
  ecrireEtat,
  ecrireEtatDons,
  ETAT_VIDE_DONS,
  lireEtat,
  lireEtatDons,
  type EtatUrlDons,
  type VocabulaireDons,
} from './etat-url'

const INDEX = JSON.parse(readFileSync(CHEMIN_INDEX_FIXTURE, 'utf8')) as IndexWeb

const VOCABULAIRE: VocabulaireDons = {
  effets: ['defense', 'mobilite', 'social'],
  effets2: ['mobilite', 'manoeuvre'],
  cibles: ['CA', 'degats', 'PV'],
  contextes: ['melee', 'exploration', 'social'],
  activations: ['passif', 'actif_illimite'],
  polyvalences: ['polyvalent', 'conditionnel', 'niche'],
  categories: ['combat', 'sociale', 'heritage'],
}

function lireDons(query: string): EtatUrlDons {
  return lireEtatDons(new URLSearchParams(query), VOCABULAIRE)
}

describe('lireEtatDons — état vide', () => {
  it("rend l'état vide pour une query string vide", () => {
    expect(lireDons('')).toEqual(ETAT_VIDE_DONS)
  })
})

describe('le cycle à trois états — dons_effet', () => {
  it('OU, NON et ET produisent trois états distincts', () => {
    const ou = lireDons('dons_effet=defense')
    const non = lireDons('dons_effet=-defense')
    const et = lireDons('dons_effet=!defense')

    expect(ou.effets).toEqual(['defense'])
    expect(ou.effetsExclus).toEqual([])
    expect(ou.effetsObliges).toEqual([])

    expect(non.effets).toEqual([])
    expect(non.effetsExclus).toEqual(['defense'])
    expect(non.effetsObliges).toEqual([])

    expect(et.effets).toEqual([])
    expect(et.effetsExclus).toEqual([])
    expect(et.effetsObliges).toEqual(['defense'])

    expect(ou).not.toEqual(non)
    expect(non).not.toEqual(et)
    expect(ou).not.toEqual(et)
  })

  it('« + » ne vaut PAS ET : il se décode en espace et l’option se perd', () => {
    // A `+` in a query string decodes to a space before URLSearchParams even
    // sees the raw value, so `dons_effet=+defense` arrives as " defense" — the
    // leading space, once trimmed, leaves a bare name (OR), never AND.
    const etat = lireDons('dons_effet=+defense')
    expect(etat.effetsObliges).toEqual([])
    expect(etat.effets).toEqual(['defense'])
  })
})

describe('dons_cout', () => {
  it.each([
    ['1', 1],
    ['5', 5],
    ['3', 3],
  ])('accepte %j', (brut, attendu) => {
    expect(lireDons(`dons_cout=${brut}`).cout).toBe(attendu)
  })

  it.each(['0', '9', 'abc', '-1', '2.5', ''])(
    'ignore %j silencieusement, sans exception',
    (brut) => {
      expect(() => lireDons(`dons_cout=${brut}`)).not.toThrow()
      expect(lireDons(`dons_cout=${brut}`).cout).toBeNull()
    },
  )
})

describe('dons_statut', () => {
  it('manual_check est sélectionnable', () => {
    expect(lireDons('dons_statut=manual_check').statut).toEqual(['manual_check'])
  })

  it('porte les trois valeurs à la fois', () => {
    const attendu: readonly StatutDon[] = [...STATUTS_DONS]
    expect([...lireDons('dons_statut=eligible,manual_check,ineligible').statut].sort()).toEqual(
      [...attendu].sort(),
    )
  })

  it('rejette une valeur inconnue sans lever', () => {
    expect(lireDons('dons_statut=inconnu').statut).toEqual([])
  })
})

describe('dons_q', () => {
  it('lit la recherche plein texte telle quelle', () => {
    expect(lireDons('dons_q=feu').q).toBe('feu')
  })
})

describe('round-trip ecrireEtatDons → lireEtatDons', () => {
  const ETATS: readonly EtatUrlDons[] = [
    ETAT_VIDE_DONS,
    { ...ETAT_VIDE_DONS, effets: ['defense'] },
    { ...ETAT_VIDE_DONS, effetsExclus: ['defense'] },
    { ...ETAT_VIDE_DONS, effetsObliges: ['defense'] },
    { ...ETAT_VIDE_DONS, effets2: ['mobilite'], effets2Obliges: ['manoeuvre'] },
    { ...ETAT_VIDE_DONS, cibles: ['CA', 'degats'], ciblesExclues: ['PV'] },
    { ...ETAT_VIDE_DONS, contextes: ['melee'], activations: ['passif'] },
    { ...ETAT_VIDE_DONS, polyvalences: ['niche'], categories: ['combat', 'sociale'] },
    { ...ETAT_VIDE_DONS, cout: 3 },
    {
      ...ETAT_VIDE_DONS,
      effets: ['defense'],
      effetsExclus: ['social'],
      effets2Obliges: ['manoeuvre'],
      cibles: ['CA'],
      contextes: ['exploration'],
      activations: ['actif_illimite'],
      polyvalences: ['polyvalent'],
      categoriesObligees: ['combat'],
      cout: 2,
      statut: ['eligible', 'manual_check'],
      q: 'défense',
    },
  ]

  it.each(ETATS.map((etat, i) => [i, etat] as const))('état #%d — identité', (_i, etat) => {
    const query = ecrireEtatDons(etat)
    const relu = lireEtatDons(query, VOCABULAIRE)
    expect(relu).toEqual(etat)
  })
})

describe('ecrireEtatDons — clés absentes plutôt que vides', () => {
  it('ne pose aucune clé pour l’état vide', () => {
    expect(ecrireEtatDons(ETAT_VIDE_DONS).toString()).toBe('')
  })
})

describe('ETAT_VIDE / ETAT_VIDE_DONS / FILTRES_DONS_VIDES — aucune clé omise', () => {
  it('ETAT_VIDE_DONS porte toutes les clés déclarées par EtatUrlDons', () => {
    const attendu = [
      'effets',
      'effetsExclus',
      'effetsObliges',
      'effets2',
      'effets2Exclus',
      'effets2Obliges',
      'cibles',
      'ciblesExclues',
      'ciblesObligees',
      'contextes',
      'contextesExclus',
      'contextesObliges',
      'activations',
      'activationsExclues',
      'activationsObligees',
      'polyvalences',
      'polyvalencesExclues',
      'polyvalencesObligees',
      'categories',
      'categoriesExclues',
      'categoriesObligees',
      'cout',
      'statut',
      'q',
    ].sort()
    expect(Object.keys(ETAT_VIDE_DONS).sort()).toEqual(attendu)
  })

  it('un scalaire absent lit `null`, une liste absente lit `[]`', () => {
    expect(ETAT_VIDE_DONS.cout).toBeNull()
    expect(ETAT_VIDE_DONS.q).toBe('')
    expect(ETAT_VIDE_DONS.effets).toEqual([])
    expect(ETAT_VIDE_DONS.statut).toEqual([])
  })

  it('FILTRES_DONS_VIDES ne porte aucune clé de plus ou de moins qu ETAT_VIDE_DONS', () => {
    // Les deux objets ne partagent pas la même interface (`cout`/`coutMax`,
    // `statut`/`statuts`) mais doivent nommer, une fois ces deux paires mises en
    // correspondance, exactement le même jeu de facettes — sinon l'une des deux
    // couches (URL, filtre) a une clé que l'autre ignore en silence.
    const clesUrl = new Set(Object.keys(ETAT_VIDE_DONS))
    clesUrl.delete('cout')
    clesUrl.delete('statut')
    const clesFiltres = new Set(Object.keys(FILTRES_DONS_VIDES))
    clesFiltres.delete('coutMax')
    clesFiltres.delete('statuts')
    expect([...clesFiltres].sort()).toEqual([...clesUrl].sort())
  })
})

describe('non-régression — les URLs de sorts existantes ne changent pas', () => {
  const URLS: readonly string[] = [
    'classe=barde&niveau=1-3&ecoles=evocation,abjuration',
    'tags=zone_d_effet,-effet_mental,!persistant&q=feu',
    'sauvegarde=reflexes&composantes=v,s&portees=courte&temps=round',
    'desaccords=1&tri=-portee',
    'classe=magicien&niveau=0,2,5&degats=feu&conditions=aveuglement,-etourdissement',
  ]

  it.each(URLS.map((url, i) => [i, url] as const))('URL #%d — EtatUrl inchangé', (_i, url) => {
    const etat = lireEtat(new URLSearchParams(url), INDEX)
    // `lireEtat` was not modified to populate `dons` — no key on the returned
    // object that a caller pre-dating this step did not already see.
    expect(etat.dons).toBeUndefined()
    expect(Object.keys(etat).sort()).toEqual(
      [
        'classe',
        'niveaux',
        'ecoles',
        'tags',
        'tagsExclus',
        'tagsObliges',
        'composantes',
        'sauvegarde',
        'portees',
        'tempsIncantation',
        'typesDegats',
        'conditionsInfligees',
        'conditionsInfligeesExclues',
        'conditionsInfligeesObligees',
        'q',
        'desaccords',
        'tri',
        'sens',
      ].sort(),
    )
    // Round-trips to the exact same canonical query string as before this step
    // — the real regression: a `dons`-unaware caller must get byte-identical
    // output for a URL it already knew about.
    expect(ecrireEtat(etat).toString()).toBe(ecrireEtat({ ...etat }).toString())
    const query = ecrireEtat(etat)
    const reparsed = lireEtat(query, INDEX)
    expect(reparsed).toEqual(etat)
  })

  it('aucun `useState` miroir : lireEtat est pure, deux appels identiques rendent le même objet de valeur', () => {
    const a = lireEtat(new URLSearchParams(URLS[0]), INDEX)
    const b = lireEtat(new URLSearchParams(URLS[0]), INDEX)
    expect(a).toEqual(b)
  })
})

describe('CLES — clé de sort inchangée', () => {
  it('ne porte aucune clé `dons_*`', () => {
    expect(Object.values(CLES).some((v) => v.startsWith('dons_'))).toBe(false)
  })
})
