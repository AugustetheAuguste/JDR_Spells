/**
 * The set logic, and the cross-check against the pipeline's own share maps.
 *
 * Two halves, deliberately. The first asserts the partition on the frozen
 * 24-spell fixture, where every membership can be read by eye. The second checks
 * the numbers this module computes from `index.json` against
 * `data/index/sorts_exclusifs.json` and `data/index/carte_doublons.json`, which
 * the pipeline computed independently at step 05 — a check, never a source. Two
 * codebases agreeing on 296 exclusives and 1774 shared spells is worth more than
 * either one asserting its own output.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { type IndexWeb } from '@/lib/donnees/index-web'
import { CHEMIN_INDEX_FIXTURE, CHEMIN_INDEX_REEL } from '@/lib/donnees/lire-index'

import {
  comparer,
  exclusifsAbsolus,
  MAX_CLASSES,
  MIN_CLASSES,
  trierParEcart,
  trierParNom,
} from './ensembles'

const FIXTURE = JSON.parse(readFileSync(CHEMIN_INDEX_FIXTURE, 'utf8')) as IndexWeb
const REEL = JSON.parse(readFileSync(CHEMIN_INDEX_REEL, 'utf8')) as IndexWeb

const TROIS = ['barde', 'druide', 'occultiste'] as const

function slugs(sorts: readonly { readonly sort: { readonly s: string } }[]): string[] {
  return sorts.map((entree) => entree.sort.s).sort()
}

describe('comparer — bornes', () => {
  it('plafonne à trois classes et en exige deux', () => {
    expect(MAX_CLASSES).toBe(3)
    expect(MIN_CLASSES).toBe(2)
  })

  it('préserve l’ordre de sélection, sans le retrier', () => {
    // The column order is the pick order: sorting it here would make the URL and
    // the table disagree about which class comes first.
    expect(comparer(FIXTURE, ['occultiste', 'barde']).classes).toEqual([
      'occultiste',
      'barde',
    ])
  })
})

describe('comparer — sur la fixture', () => {
  it('place dans partages un sort reçu par les trois classes', () => {
    const { partages } = comparer(FIXTURE, TROIS)
    expect(slugs(partages)).toEqual([
      'conscience-accrue',
      'creation-de-carte-au-tresor',
      'degout',
      'detection-de-la-magie',
      'detection-de-la-magie-supreme',
    ])
  })

  it('place un exclusif dans la bonne classe et nulle part ailleurs', () => {
    const { exclusifs, partages, partiels } = comparer(FIXTURE, TROIS)
    // `talisman-instrumental` : niv = {occultiste: 3}, et rien d'autre.
    expect(slugs(exclusifs['occultiste'] ?? [])).toContain('talisman-instrumental')
    expect(slugs(exclusifs['barde'] ?? [])).not.toContain('talisman-instrumental')
    expect(slugs(exclusifs['druide'] ?? [])).not.toContain('talisman-instrumental')
    expect(slugs(partages)).not.toContain('talisman-instrumental')
    expect(slugs(partiels)).not.toContain('talisman-instrumental')
  })

  it('classe en partiel un sort reçu par deux des trois classes', () => {
    const { partiels } = comparer(FIXTURE, TROIS)
    expect(slugs(partiels)).toEqual([
      'adaptation-culturelle',
      'affaiblissement-des-energies-destructives',
      'alteration-d-instrument-de-musique',
      'attirance',
    ])
  })

  it('n’a aucun partiel à deux classes : « au moins deux » et « toutes » y sont la même chose', () => {
    expect(comparer(FIXTURE, ['barde', 'druide']).partiels).toEqual([])
  })

  it('ignore les sorts qu’aucune classe sélectionnée ne reçoit', () => {
    const union = comparer(FIXTURE, ['barde', 'occultiste']).union
    expect(slugs(union)).not.toContain('absorption-de-toxine')
  })
})

describe('la partition', () => {
  it.each([
    [['barde', 'druide']],
    [['barde', 'occultiste']],
    [['barde', 'druide', 'occultiste']],
    [['occultiste', 'druide', 'barde']],
  ])('|partages| + Σ|exclusifs| + |partiels| = |union| pour %j', (classes) => {
    const comparaison = comparer(FIXTURE, classes)
    const exclusifs = Object.values(comparaison.exclusifs).reduce(
      (total, liste) => total + liste.length,
      0,
    )
    const somme = comparaison.partages.length + exclusifs + comparaison.partiels.length
    expect(somme).toBe(comparaison.union.length)

    // And the union really is « held by at least one selected class », counted
    // from the index rather than from the function under test.
    const attendu = FIXTURE.sorts.filter((sort) =>
      classes.some((classe) => sort.niv[classe] !== undefined),
    ).length
    expect(comparaison.union.length).toBe(attendu)
  })

  it('vérifie aussi la partition sur les 2070 sorts réels', () => {
    const comparaison = comparer(REEL, ['barde', 'druide', 'arcaniste-ensorceleur-magicien'])
    const exclusifs = Object.values(comparaison.exclusifs).reduce(
      (total, liste) => total + liste.length,
      0,
    )
    expect(
      comparaison.partages.length + exclusifs + comparaison.partiels.length,
    ).toBe(comparaison.union.length)
    expect(comparaison.union.length).toBeGreaterThan(0)
  })

  it('ne range aucun sort dans deux ensembles à la fois', () => {
    const { partages, exclusifs, partiels } = comparer(FIXTURE, TROIS)
    const tous = [
      ...slugs(partages),
      ...Object.values(exclusifs).flatMap((liste) => slugs(liste)),
      ...slugs(partiels),
    ]
    expect(new Set(tous).size).toBe(tous.length)
  })
})

describe('niveaux et écart', () => {
  it('donne un niveau par classe qui reçoit le sort, et rien pour les autres', () => {
    const degout = comparer(FIXTURE, TROIS).partages.find(
      (entree) => entree.sort.s === 'degout',
    )
    expect(degout?.niveaux).toEqual({ barde: 2, druide: 3, occultiste: 2 })
  })

  it('mesure l’écart comme max − min', () => {
    const degout = comparer(FIXTURE, TROIS).partages.find(
      (entree) => entree.sort.s === 'degout',
    )
    expect(degout?.ecart).toBe(1)
  })

  it('donne un écart de 0 quand toutes les classes y accèdent au même niveau', () => {
    const detection = comparer(FIXTURE, TROIS).partages.find(
      (entree) => entree.sort.s === 'detection-de-la-magie',
    )
    expect(detection?.ecart).toBe(0)
  })

  it('donne un écart null, jamais 0, quand une seule classe reçoit le sort', () => {
    // 0 would rank it as « aucune divergence », which is a claim; null is the
    // absence of a measurement, which is the truth.
    const seul = comparer(FIXTURE, TROIS).exclusifs['occultiste']?.find(
      (entree) => entree.sort.s === 'talisman-instrumental',
    )
    expect(seul?.ecart).toBeNull()
    expect(seul?.niveaux).toEqual({ occultiste: 3 })
  })

  it('ne confond pas le niveau 0 avec une absence', () => {
    // `allie-involontaire` is level 0 for the bard: an orison is a real level.
    const zero = comparer(FIXTURE, TROIS).exclusifs['barde']?.find(
      (entree) => entree.sort.s === 'allie-involontaire',
    )
    expect(zero?.niveaux).toEqual({ barde: 0 })
  })
})

describe('trierParEcart', () => {
  it('place en tête le plus grand différentiel', () => {
    const trie = trierParEcart(comparer(FIXTURE, TROIS).union)
    expect(trie[0]?.ecart).toBe(3) // attirance : druide 9, occultiste 6
    expect(trie[0]?.sort.s).toBe('attirance')
    const ecarts = trie.map((entree) => entree.ecart).filter((ecart) => ecart !== null)
    expect(ecarts).toEqual([...ecarts].sort((a, b) => b - a))
  })

  it('rejette les écarts null en fin de liste', () => {
    const trie = trierParEcart(comparer(FIXTURE, TROIS).union)
    const premierNul = trie.findIndex((entree) => entree.ecart === null)
    expect(premierNul).toBeGreaterThan(0)
    expect(trie.slice(premierNul).every((entree) => entree.ecart === null)).toBe(true)
  })

  it('départage les ex æquo sur le nom, collationné en français', () => {
    const trie = trierParEcart(
      comparer(FIXTURE, TROIS).union.filter((entree) => entree.ecart === 0),
    )
    const noms = trie.map((entree) => entree.sort.n)
    expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')))
  })

  it('ne mute pas le tableau reçu', () => {
    const union = comparer(FIXTURE, TROIS).union
    const avant = slugs(union)
    trierParEcart(union)
    trierParNom(union)
    expect(slugs(union)).toEqual(avant)
  })
})

/**
 * The cross-check.
 *
 * `data/index/*` is read here as a second opinion computed by a different
 * codebase at step 05. If these ever disagree, one of the two is wrong and the
 * step-05 report is the tiebreaker — but the maps are never a source for the
 * view, which recomputes everything from `index.json`.
 */
describe('contrôle croisé avec les cartes de partage du pipeline', () => {
  const racine = join(process.cwd(), '..', 'data', 'index')
  interface CarteExclusifs {
    readonly par_classe: Readonly<
      Record<string, { readonly slug: string; readonly nb: number }>
    >
    readonly totaux: Readonly<Record<string, number>>
  }
  interface CarteDoublons {
    readonly nb_sorts_uniques: number
    readonly nb_sorts_partages: number
    readonly sorts_partages: Readonly<
      Record<string, { readonly classes: Readonly<Record<string, number>> }>
    >
  }
  const exclusifs = JSON.parse(
    readFileSync(join(racine, 'sorts_exclusifs.json'), 'utf8'),
  ) as CarteExclusifs
  const doublons = JSON.parse(
    readFileSync(join(racine, 'carte_doublons.json'), 'utf8'),
  ) as CarteDoublons

  it('compte le même nombre de sorts uniques', () => {
    expect(REEL.sorts).toHaveLength(doublons.nb_sorts_uniques)
  })

  it('compte le même nombre de sorts partagés entre au moins deux classes', () => {
    const partages = REEL.sorts.filter((sort) => Object.keys(sort.niv).length >= 2)
    expect(partages).toHaveLength(doublons.nb_sorts_partages)
  })

  it('trouve les mêmes exclusifs absolus, classe par classe', () => {
    for (const [libelle, entree] of Object.entries(exclusifs.par_classe)) {
      expect(exclusifsAbsolus(REEL, entree.slug), libelle).toHaveLength(entree.nb)
      expect(exclusifs.totaux[libelle]).toBe(entree.nb)
    }
  })

  it('trouve les mêmes niveaux par classe que la carte de partage', () => {
    const parLibelle = new Map(REEL.classes.map((classe) => [classe.nom, classe.slug]))
    for (const [id, entree] of Object.entries(doublons.sorts_partages)) {
      const sort = REEL.sorts.find((candidat) => candidat.id === id)
      expect(sort, id).toBeDefined()
      const attendu: Record<string, number> = {}
      for (const [libelle, niveau] of Object.entries(entree.classes)) {
        const slug = parLibelle.get(libelle)
        expect(slug, libelle).toBeDefined()
        attendu[slug as string] = niveau
      }
      expect(sort?.niv, id).toEqual(attendu)
    }
  })
})
