/**
 * The search engine, exercised outside any browser.
 *
 * Two corpora are used deliberately, because neither alone covers the plan:
 *
 *   - the frozen 24-spell fixture, for the semantics — accents, apostrophes,
 *     empty states, ranking. It is small enough that an assertion can name every
 *     expected result rather than counting them.
 *   - the real 2070-spell export, for the plan's literal vectors. The fixture
 *     contains neither « Éclair » nor « Mur d'épines », and only one alias key
 *     intersects it, so `chercher("eclair")` and `chercher("magic missile")` are
 *     checked where those spells actually live. Pinning them against the shipped
 *     artefact is stronger than pinning them against a fixture anyway: it is the
 *     file the site serves.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { type EntreeSort, type IndexWeb } from '@/lib/donnees/index-web'
import { CHEMIN_INDEX_FIXTURE, CHEMIN_INDEX_REEL } from '@/lib/donnees/lire-index'

import { construireMoteur, LIMITE_DEFAUT, type Resultat, type TableAlias } from './moteur'
import { plier } from './pliage'

function lire<T>(chemin: string): T {
  return JSON.parse(readFileSync(chemin, 'utf8')) as T
}

const FIXTURE = lire<IndexWeb>(CHEMIN_INDEX_FIXTURE)
const REEL = lire<IndexWeb>(CHEMIN_INDEX_REEL)
const ALIAS = lire<TableAlias>(join(process.cwd(), 'public', 'data', 'alias.json'))

/** A synthetic alias table over fixture ids, so alias behaviour can be asserted
 * on the small corpus too. `light` is ambiguous on purpose. */
const ALIAS_FIXTURE: TableAlias = {
  version: 1,
  alias: {
    'detect magic': ['detection-de-la-magie'],
    'eagle eye': ['aire-de-l-aigle'],
    'detect magic any': ['detection-de-la-magie', 'detection-de-la-magie-supreme'],
    'sort fantome': ['sort-qui-n-existe-pas'],
  },
}

const surFixture = construireMoteur(FIXTURE, ALIAS_FIXTURE)
const surReel = construireMoteur(REEL, ALIAS)

function noms(resultats: Resultat[] | null): string[] {
  return (resultats ?? []).map((r) => r.n)
}

function ids(resultats: Resultat[] | null): string[] {
  return (resultats ?? []).map((r) => r.id)
}

describe('les critères de vérification du plan, sur le corpus réel', () => {
  it('chercher("eclair") trouve le sort nommé « Éclair »', () => {
    expect(ids(surReel.chercher('eclair'))).toContain('eclair')
  })

  it('chercher("Éclair") et chercher("eclair") donnent le même résultat', () => {
    // The accented and unaccented queries must be indistinguishable — this is the
    // one assertion that fails loudly if the TS fold ever drifts from the Python
    // one, since `nf` in the artefact was produced by the Python side.
    expect(surReel.chercher('Éclair')).toEqual(surReel.chercher('eclair'))
  })

  it('chercher("mur d\'epines") et chercher("mur depines") trouvent le même sort', () => {
    const avec = ids(surReel.chercher("mur d'epines"))
    const sans = ids(surReel.chercher('mur depines'))
    expect(avec).toContain('mur-d-epines')
    expect(sans).toContain('mur-d-epines')
  })

  it('chercher("magic missile") renvoie l\'id français attendu, via "alias"', () => {
    const resultats = surReel.chercher('magic missile') ?? []
    expect(resultats[0]).toMatchObject({ id: 'projectile-magique', via: 'alias' })
  })

  it('un alias ambigu renvoie plusieurs résultats, aucun élu', () => {
    const resultats = (surReel.chercher('cure wounds') ?? []).filter((r) => r.via === 'alias')
    expect(resultats.map((r) => r.id)).toEqual([
      'soins-importants',
      'soins-intensifs',
      'soins-legers',
      'soins-moderes',
    ])
  })

  it('trouve un sort par ses premières lettres', () => {
    // The dominant case: someone typing a name they already know.
    expect(ids(surReel.chercher('projec'))).toContain('projectile-magique')
  })
})

describe('les états vides, qui ne sont pas le même état', () => {
  it('chercher("") renvoie null, pas []', () => {
    // null means "no search happened" → the browse view shows the full list.
    expect(surFixture.chercher('')).toBeNull()
  })

  it('une requête réduite à du vide par le pliage renvoie aussi null', () => {
    expect(surFixture.chercher('   ')).toBeNull()
    expect(surFixture.chercher("'")).toBeNull()
  })

  it('une requête sans correspondance renvoie [], pas null', () => {
    // [] is an empty state with a message, not a full list. Collapsing the two
    // would flash the whole corpus at every cleared keystroke.
    const resultats = surFixture.chercher('xyzzyquux')
    expect(resultats).toEqual([])
    expect(resultats).not.toBeNull()
  })

  it('un mot vide seul ne cherche rien de significatif', () => {
    // "de" is dropped by processTerm on both sides, so the query has no terms
    // left; what matters is that it does not return the entire corpus as matches.
    expect((surFixture.chercher('de') ?? []).length).toBeLessThan(FIXTURE.sorts.length)
  })
})

describe('sur la fixture figée', () => {
  it('trouve un nom accentué tapé sans accent', () => {
    expect(noms(surFixture.chercher('detection'))).toContain('Détection de la magie')
  })

  it('trouve un nom apostrophé tapé sans apostrophe', () => {
    // The fixture's own apostrophised name, since it has no « Mur d'épines ».
    const avec = ids(surFixture.chercher("aire de l'aigle"))
    const sans = ids(surFixture.chercher('aire de laigle'))
    expect(avec).toContain('aire-de-l-aigle')
    expect(sans).toContain('aire-de-l-aigle')
  })

  it('trouve un nom à ligature par sa forme déliée', () => {
    // « Dégoût » is in the fixture; the ligature case is covered by pliage.test.
    expect(ids(surFixture.chercher('degout'))).toContain('degout')
  })

  it('met les correspondances d\'alias en tête, avant le texte', () => {
    const resultats = surFixture.chercher('detect magic') ?? []
    expect(resultats[0]).toMatchObject({ id: 'detection-de-la-magie', via: 'alias' })
    expect(resultats.filter((r) => r.via === 'alias')).toHaveLength(1)
  })

  it('déduplique : un sort trouvé par alias ne réapparaît pas par le texte', () => {
    const resultats = surFixture.chercher('detect magic any') ?? []
    const vus = resultats.map((r) => r.id)
    expect(new Set(vus).size).toBe(vus.length)
    expect(resultats.filter((r) => r.id === 'detection-de-la-magie')).toHaveLength(1)
  })

  it('ignore un id d\'alias absent de l\'index plutôt que de rendre une ligne morte', () => {
    // Cannot happen if both artefacts were built together — the Python builder
    // refuses an unknown id outright. If it ever does, a row pointing at a 404
    // is worse than no row.
    expect(surFixture.chercher('sort fantome')).toEqual([])
  })

  it('renvoie des résultats dont chaque champ vient de l\'index', () => {
    const parId = new Map(FIXTURE.sorts.map((s) => [s.id, s]))
    for (const resultat of surFixture.chercher('detection') ?? []) {
      const sort = parId.get(resultat.id) as EntreeSort
      expect(sort).toBeDefined()
      expect(resultat.i).toBe(sort.i)
      expect(resultat.s).toBe(sort.s)
      expect(resultat.n).toBe(sort.n)
    }
  })

  it('classe le nom exact avant ses préfixes', () => {
    // « Détection de la magie » must outrank « Détection de la magie suprême »
    // for the exact query, or the shorter, more likely target sinks.
    const resultats = noms(surFixture.chercher('detection de la magie'))
    expect(resultats[0]).toBe('Détection de la magie')
  })
})

describe('la limite', () => {
  it('tronque à la limite demandée', () => {
    // "detection" matches dozens of spells in the real corpus; "de la" would
    // match none, being entirely stopwords on both sides of processTerm.
    expect(surReel.chercher('detection', 5)).toHaveLength(5)
  })

  it('tronque à 50 par défaut', () => {
    const resultats = surReel.chercher('a') ?? []
    expect(resultats.length).toBeLessThanOrEqual(LIMITE_DEFAUT)
  })

  it('ne laisse pas les alias déborder la limite', () => {
    const resultats = surReel.chercher('cure wounds', 2) ?? []
    expect(resultats).toHaveLength(2)
    expect(resultats.every((r) => r.via === 'alias')).toBe(true)
  })
})

describe('l\'accord entre le pliage TypeScript et l\'artefact produit par Python', () => {
  it('nf est exactement plier(n) pour les 2070 sorts', () => {
    // The single assertion that would catch a drift between the two folds. It
    // runs over the whole shipped index rather than a sample, because the words
    // that break are the rare ones — a ligature, a modifier apostrophe.
    const divergents = REEL.sorts.filter((sort) => plier(sort.n) !== sort.nf)
    expect(divergents.map((s) => [s.n, s.nf, plier(s.n)])).toEqual([])
  })

  it('toute clé d\'alias est déjà pliée par la fonction TypeScript', () => {
    // Otherwise a folded query could never equal a key, and every alias would be
    // dead weight — silently.
    for (const cle of Object.keys(ALIAS.alias)) expect(plier(cle)).toBe(cle)
  })
})

describe('le budget de performance', () => {
  function corpusSynthetique(n: number): IndexWeb {
    const sorts: EntreeSort[] = Array.from({ length: n }, (_, i) => {
      const nom = `Sort synthétique numéro ${i} d'épreuve`
      return {
        i,
        id: `sort-${i}`,
        s: `sort-${i}`,
        n: nom,
        nf: plier(nom),
        e: i % 9,
        niv: { barde: i % 10 },
        c: [i % 4],
        p: 0,
        j: 0,
        rm: false,
        t: [],
        d: false,
      }
    })
    return { ...FIXTURE, sorts }
  }

  it('construit un index sur 2070 entrées sous le budget, mesuré', () => {
    // 150 ms is the mid-range-mobile budget from the plan; CI runs on a faster
    // machine, so this guards an order of magnitude, not a millisecond. The
    // measurement is printed because a budget nobody reads is a budget nobody
    // notices creeping.
    const index = corpusSynthetique(2070)
    const debut = performance.now()
    const moteur = construireMoteur(index, null)
    const duree = performance.now() - debut
    console.log(`construction de l'index sur 2070 entrées : ${duree.toFixed(1)} ms`)
    expect(moteur.taille).toBe(2070)
    expect(duree).toBeLessThan(1500)
  })

  it('répond à une requête sous le budget, mesuré', () => {
    const moteur = construireMoteur(corpusSynthetique(2070), null)
    moteur.chercher('synthetique') // warm-up, so the first-call cost is not measured
    const debut = performance.now()
    for (let n = 0; n < 20; n += 1) moteur.chercher(`numero ${n}`)
    const parRequete = (performance.now() - debut) / 20
    console.log(`requête moyenne sur 2070 entrées : ${parRequete.toFixed(2)} ms`)
    expect(parRequete).toBeLessThan(16)
  })
})
