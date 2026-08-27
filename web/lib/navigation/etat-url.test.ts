/**
 * The URL contract (B7), tested without a router.
 *
 * Everything in `etat-url.ts` is a pure string↔state function precisely so that
 * this file can assert the contract directly: a pasted link restores exactly the
 * state it encodes, and a state serializes to exactly one string. The second half
 * is what makes back/forward work — if two equal states could produce two
 * different query strings, the router would rewrite the URL on every render and
 * fill the history with entries the user never asked for.
 */

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { type IndexWeb } from '@/lib/donnees/index-web'
import { CHEMIN_INDEX_FIXTURE } from '@/lib/donnees/lire-index'

import {
  analyserNiveaux,
  analyserTags,
  CLES,
  ecrireEtat,
  ETAT_VIDE,
  etatActif,
  filtreLePlusRestrictif,
  formaterNiveaux,
  formaterTags,
  lireEtat,
  sansFiltre,
  versFiltres,
  versQueryString,
  type EtatUrl,
} from './etat-url'

const INDEX = JSON.parse(readFileSync(CHEMIN_INDEX_FIXTURE, 'utf8')) as IndexWeb

function lire(query: string): EtatUrl {
  return lireEtat(new URLSearchParams(query), INDEX)
}

describe('analyserNiveaux', () => {
  it.each([
    ['1-3', [1, 2, 3]],
    ['0,2,5', [0, 2, 5]],
    ['1-3,7', [1, 2, 3, 7]],
    ['4', [4]],
    ['0-9', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
  ])('lit %j comme %j', (entree, attendu) => {
    expect(analyserNiveaux(entree)).toEqual(attendu)
  })

  it('lit un intervalle inversé dans le bon sens', () => {
    // The intent of "5-2" is unambiguous; refusing it would only punish a typo.
    expect(analyserNiveaux('5-2')).toEqual([2, 3, 4, 5])
  })

  it('trie et déduplique', () => {
    expect(analyserNiveaux('3,1,3,2-2')).toEqual([1, 2, 3])
  })

  it.each([['', []], ['abc', []], ['12', []], ['-', []], ['1-', []], ['x-3', []]])(
    'ignore %j plutôt que d’échouer',
    (entree, attendu) => {
      // A URL is user input: it arrives hand-edited and truncated by chat
      // clients. A filter nobody can name is better ignored than crashed on.
      expect(analyserNiveaux(entree)).toEqual(attendu)
    },
  )

  it('écarte un niveau hors de 0–9', () => {
    expect(analyserNiveaux('9')).toEqual([9])
    expect(analyserNiveaux('99')).toEqual([])
  })
})

describe('formaterNiveaux', () => {
  it.each([
    [[1, 2, 3], '1-3'],
    [[1, 2, 3, 7], '1-3,7'],
    [[4], '4'],
    [[1, 2], '1,2'],
    [[], ''],
    [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], '0-9'],
  ])('rend %j comme %j', (entree, attendu) => {
    expect(formaterNiveaux(entree)).toBe(attendu)
  })

  it('fait l’aller-retour sur tous les sous-ensembles de 0–4', () => {
    // Exhaustive rather than sampled: the run-detection loop is the kind of code
    // that works on every case one thinks of and fails on the 19th.
    for (let masque = 0; masque < 32; masque += 1) {
      const niveaux = [0, 1, 2, 3, 4].filter((n) => (masque & (1 << n)) !== 0)
      expect(analyserNiveaux(formaterNiveaux(niveaux))).toEqual(niveaux)
    }
  })
})

describe('analyserTags', () => {
  const CONNUS = ['bonus_chiffre', 'zone_d_effet', 'effet_mental']

  it('lit les trois marques : OR, NOT (-), AND (!)', () => {
    expect(analyserTags('bonus_chiffre,-zone_d_effet,!effet_mental', CONNUS)).toEqual({
      tags: ['bonus_chiffre'],
      tagsExclus: ['zone_d_effet'],
      tagsObliges: ['effet_mental'],
    })
  })

  it('un `+` ne marche pas : il décoderait en espace dans une query string', () => {
    // The whole reason `!` and not `+` was chosen for AND.
    expect(analyserTags('+bonus_chiffre', CONNUS).tagsObliges).toEqual([])
  })

  it('un tag nommé deux fois garde sa première occurrence', () => {
    expect(analyserTags('bonus_chiffre,!bonus_chiffre', CONNUS)).toEqual({
      tags: ['bonus_chiffre'],
      tagsExclus: [],
      tagsObliges: [],
    })
  })
})

describe('formaterTags', () => {
  it('rend OR nu, NOT avec `-`, AND avec `!`', () => {
    expect(formaterTags(['bonus_chiffre'], ['zone_d_effet'], ['effet_mental'])).toBe(
      'bonus_chiffre,-zone_d_effet,!effet_mental',
    )
  })

  it('fait l’aller-retour avec analyserTags', () => {
    const CONNUS = ['bonus_chiffre', 'zone_d_effet', 'effet_mental']
    const rendu = formaterTags(['bonus_chiffre'], ['zone_d_effet'], ['effet_mental'])
    expect(analyserTags(rendu, CONNUS)).toEqual({
      tags: ['bonus_chiffre'],
      tagsExclus: ['zone_d_effet'],
      tagsObliges: ['effet_mental'],
    })
  })
})

describe('lireEtat', () => {
  it('restitue exactement l’état d’une URL complète', () => {
    const etat = lire(
      'classe=barde&niveau=1-3&ecoles=evocation,abjuration&tags=bonus_chiffre' +
        '&q=feu&sauvegarde=volonte&composantes=V,M&desaccords=1',
    )
    expect(etat).toEqual({
      classe: 'barde',
      niveaux: [1, 2, 3],
      // Ordered by the index's own table, not by the URL's order, so the same
      // filters always give the same canonical link.
      ecoles: ['abjuration', 'evocation'],
      tags: ['bonus_chiffre'],
      tagsExclus: [],
      tagsObliges: [],
      composantes: ['M', 'V'],
      sauvegarde: ['volonte'],
      portees: [],
      tempsIncantation: [],
      q: 'feu',
      desaccords: true,
      tri: null,
      sens: 'asc',
    })
  })

  it('rend l’état vide pour une query string vide', () => {
    expect(lire('')).toEqual(ETAT_VIDE)
  })

  it('écarte une classe qui n’est pas dans l’index', () => {
    // Silently, and back to "all classes". A URL naming a class that does not
    // exist is a link that aged out; refusing to render is a worse answer.
    expect(lire('classe=archimage-supreme').classe).toBeNull()
    expect(lire('classe=barde').classe).toBe('barde')
  })

  it('écarte une école, un tag, une composante, un jet inconnus', () => {
    const etat = lire('ecoles=evocation,cuisine&tags=inexistant&composantes=Z&sauvegarde=chance')
    expect(etat.ecoles).toEqual(['evocation'])
    expect(etat.tags).toEqual([])
    expect(etat.composantes).toEqual([])
    expect(etat.sauvegarde).toEqual([])
  })

  it('lit portees et temps, et écarte les valeurs inconnues', () => {
    expect(lire('portees=courte,contact').portees).toEqual(['contact', 'courte'])
    expect(lire('temps=action_simple,round').tempsIncantation).toEqual([
      'action_simple',
      'round',
    ])
    expect(lire('portees=voyage-astral').portees).toEqual([])
    expect(lire('temps=teleportation').tempsIncantation).toEqual([])
  })

  it('normalise la casse des valeurs', () => {
    expect(lire('classe=Barde&ecoles=EVOCATION').classe).toBe('barde')
    expect(lire('ecoles=EVOCATION').ecoles).toEqual(['evocation'])
  })

  it('ne lit desaccords que sur "1"', () => {
    // Explicit rather than truthy: `desaccords=0` must mean off, and a truthy
    // test would turn the string "0" into on.
    expect(lire('desaccords=1').desaccords).toBe(true)
    expect(lire('desaccords=0').desaccords).toBe(false)
    expect(lire('desaccords=true').desaccords).toBe(false)
  })

  it('conserve la requête verbatim, accents compris', () => {
    // Folding belongs to the search engine; storing a folded query in the URL
    // would show the user their own words rewritten.
    expect(lire('q=%C3%A9clair').q).toBe('éclair')
    expect(lire("q=mur+d'%C3%A9pines").q).toBe("mur d'épines")
  })
})

describe('l’aller-retour, qui fait marcher le bouton précédent', () => {
  const cas = [
    '',
    'classe=barde',
    'niveau=1-3',
    'classe=druide&niveau=0,4&ecoles=evocation',
    'q=feu&desaccords=1',
    'classe=barde&niveau=2&ecoles=abjuration,evocation&composantes=M,V&sauvegarde=volonte&tags=bonus_chiffre&q=eclair&desaccords=1',
    'tags=bonus_chiffre,-zone_d_effet,!effet_mental',
    'portees=courte,contact',
    'temps=action_simple,round',
    'portees=contact&temps=round&classe=barde',
  ]

  it.each(cas)('lire ∘ écrire est l’identité sur %j', (query) => {
    const etat = lire(query)
    expect(lireEtat(ecrireEtat(etat), INDEX)).toEqual(etat)
  })

  it.each(cas)('écrire ∘ lire est un point fixe sur %j', (query) => {
    // The stronger of the two: if serializing a parsed URL gave a different
    // string, the router would rewrite the address bar on every render.
    const premier = versQueryString(lire(query))
    expect(versQueryString(lire(premier.replace(/^\?/, '')))).toBe(premier)
  })

  it('n’émet pas de clé vide', () => {
    // `?classe=&niveau=` is noise in a shared link, and it also breaks the fixed
    // point above.
    expect(versQueryString(ETAT_VIDE)).toBe('')
    expect(versQueryString({ ...ETAT_VIDE, classe: 'barde' })).toBe('?classe=barde')
  })

  it('émet les clés dans un ordre stable', () => {
    const etat: EtatUrl = { ...ETAT_VIDE, q: 'feu', classe: 'barde', niveaux: [1, 2, 3] }
    expect(versQueryString(etat)).toBe('?classe=barde&niveau=1-3&q=feu')
    expect([...ecrireEtat(etat).keys()]).toEqual([CLES.classe, CLES.niveau, CLES.q])
  })
})

describe('versFiltres', () => {
  it('résout les noms en codes de l’index', () => {
    const filtres = versFiltres(
      lire('classe=barde&niveau=1&ecoles=evocation&sauvegarde=volonte&portees=courte&temps=round'),
      INDEX,
    )
    expect(filtres.classe).toBe('barde')
    expect(filtres.niveaux).toEqual([1])
    expect(filtres.ecoles).toEqual([INDEX.ecoles.indexOf('evocation')])
    expect(filtres.jets).toEqual([INDEX.jets.indexOf('volonte')])
    expect(filtres.portees).toEqual([INDEX.portees.indexOf('courte')])
    expect(filtres.tempsIncantation).toEqual([INDEX.temps_incantation.indexOf('round')])
  })

  it('demande explicitement le minimum quand aucune classe n’est choisie', () => {
    // The view labels that number « Niveau le plus bas, toutes classes », which
    // is the only thing that makes the minimum legitimate at all.
    expect(versFiltres(lire('niveau=1'), INDEX).niveauSansClasse).toBe('minimum')
  })

  it('ne produit jamais de code -1', () => {
    // Unknown names were already dropped by `lireEtat`; -1 would silently filter
    // on nothing and look like an empty result.
    const filtres = versFiltres(lire('ecoles=cuisine&tags=inexistant&composantes=Z'), INDEX)
    for (const codes of [filtres.ecoles, filtres.tags, filtres.composantes, filtres.jets]) {
      expect(codes ?? []).not.toContain(-1)
    }
  })

  it('résout tagsObliges en codes, distincts de tags et tagsExclus', () => {
    const filtres = versFiltres(lire('tags=bonus_chiffre,-zone_d_effet,!effet_mental'), INDEX)
    expect(filtres.tags).toEqual([INDEX.tags.indexOf('bonus_chiffre')])
    expect(filtres.tagsExclus).toEqual([INDEX.tags.indexOf('zone_d_effet')])
    expect(filtres.tagsObliges).toEqual([INDEX.tags.indexOf('effet_mental')])
  })
})

describe('l’état vide nomme un filtre précis', () => {
  it('désigne la recherche avant les filtres', () => {
    expect(filtreLePlusRestrictif(lire('q=feu&classe=barde&niveau=1'))).toBe('q')
  })

  it.each([
    ['desaccords=1&classe=barde&niveau=1', 'desaccords'],
    ['classe=barde&niveau=1&ecoles=evocation', 'niveau'],
    ['classe=barde&composantes=V&ecoles=evocation', 'composantes'],
    ['classe=barde&tags=bonus_chiffre&ecoles=evocation', 'tags'],
    ['classe=barde&tags=!bonus_chiffre&ecoles=evocation', 'tags'],
    ['classe=barde&sauvegarde=volonte&ecoles=evocation', 'sauvegarde'],
    ['classe=barde&portees=courte&ecoles=evocation', 'portees'],
    ['classe=barde&temps=round&ecoles=evocation', 'temps'],
    ['classe=barde&ecoles=evocation', 'ecoles'],
    ['classe=barde', 'classe'],
  ])('désigne %j → %j', (query, attendu) => {
    expect(filtreLePlusRestrictif(lire(query))).toBe(attendu)
  })

  it('ne désigne rien quand rien n’est filtré', () => {
    expect(filtreLePlusRestrictif(ETAT_VIDE)).toBeNull()
  })

  it('retirer le filtre désigné le retire vraiment, et lui seul', () => {
    const etat = lire('classe=barde&niveau=1-3&ecoles=evocation&q=feu')
    const sansQ = sansFiltre(etat, 'q')
    expect(sansQ.q).toBe('')
    expect(sansQ.classe).toBe('barde')
    expect(sansQ.niveaux).toEqual([1, 2, 3])
    expect(sansQ.ecoles).toEqual(['evocation'])
  })

  it('sansFiltre couvre chaque clé du contrat', () => {
    // If a key is ever added to the URL and forgotten here, its "remove this
    // filter" button would do nothing and the empty state would be a dead end.
    const plein = lire(
      'classe=barde&niveau=1&ecoles=evocation&tags=bonus_chiffre&composantes=V&sauvegarde=volonte' +
        '&portees=courte&temps=round&q=feu&desaccords=1&tri=-portee',
    )
    for (const cle of Object.keys(CLES) as (keyof typeof CLES)[]) {
      expect(versQueryString(sansFiltre(plein, cle))).not.toBe(versQueryString(plein))
    }
  })
})

describe('etatActif', () => {
  it('est faux sur l’état vide, vrai dès qu’un filtre est posé', () => {
    expect(etatActif(ETAT_VIDE)).toBe(false)
    expect(etatActif(lire('classe=barde'))).toBe(true)
    expect(etatActif(lire('q=feu'))).toBe(true)
    expect(etatActif(lire('desaccords=1'))).toBe(true)
  })

  it('est faux quand l’URL ne portait que des valeurs inconnues', () => {
    expect(etatActif(lire('classe=inexistante&ecoles=cuisine'))).toBe(false)
  })
})
