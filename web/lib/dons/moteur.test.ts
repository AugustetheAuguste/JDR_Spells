/**
 * Tri-state tests for `moteur.ts`. Written before the "shape looks right"
 * kind of review, per the plan's own emphasis: the tri-state is the one
 * place a silent mistake produces a false `ineligible`, hiding a feat from a
 * player with no recourse.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  bba,
  evaluerDon,
  evaluerExigence,
  evaluerGroupeOu,
  filtrerDons,
  magieInaccessible,
  normaliser,
  verdictGating,
  verdictMaitrise,
} from './moteur.js'
import type { CatalogueDons } from './moteur.js'
import type {
  DonConditions,
  Exigence,
  GroupeOu,
  HitGating,
  Personnage,
  TablesMoteur,
  TypeExigence,
} from './types.js'
import { TYPES_EXIGENCE } from './types.js'

// ---------------------------------------------------------------------------
// Minimal fixture tables — enough to exercise every branch without pulling
// in the full 1417-feat contract.
// ---------------------------------------------------------------------------

const TABLES: TablesMoteur = {
  lanceurs: {
    guerrier: { is_caster: false },
    magicien: { is_caster: true },
  },
  maitrises: {
    guerrier: { armes_martiales: true, armes_simples: true, armes_specifiques: [], boucliers: true },
    // "chasseur de vampire" is deliberately absent — no such official class.
  },
  magie_des_dons: {},
  affinite_creature: {},
  restriction_de_classe: {},
  races: {
    nain: { taille: 'M', texte_traits: 'stabilite | resiste au bousculement', magie_innee: false },
    elfe: { taille: 'M', texte_traits: 'vision dans le noir | voit dans le noir', magie_innee: false },
    aasimar: { taille: 'M', texte_traits: 'pouvoir magique | lumiere du jour', magie_innee: true },
  },
  armes_raciales: { nain: ['marteau de guerre'] },
  reclassement_racial: { nain: 'naine' },
  progression_bba: { guerrier: 'good', magicien: 'poor' },
}

function perso(partiel: Partial<Personnage> & Pick<Personnage, 'classe' | 'niveau'>): Personnage {
  return { ...partiel }
}

function exigence(type: TypeExigence, charge: Record<string, unknown>, segment = ''): Exigence {
  return { type, charge, verif_manuelle: false, segment: segment || type }
}

// ---------------------------------------------------------------------------
// 1. Un test par RequirementType (13), true / false / null.
// ---------------------------------------------------------------------------

describe('evaluerExigence — les 13 RequirementType', () => {
  it('couvre exactement les 13 types du contrat, ni plus ni moins', () => {
    expect(TYPES_EXIGENCE).toHaveLength(13)
  })

  it('level : true / false, jamais null (niveau toujours connu)', () => {
    const p = perso({ classe: 'guerrier', niveau: 5 })
    expect(evaluerExigence(exigence('level', { min: 5 }), p, TABLES)[0]).toBe(true)
    expect(evaluerExigence(exigence('level', { min: 6 }), p, TABLES)[0]).toBe(false)
  })

  it('level_exact : true / false', () => {
    const p = perso({ classe: 'guerrier', niveau: 1 })
    expect(evaluerExigence(exigence('level_exact', { exact: 1 }), p, TABLES)[0]).toBe(true)
    expect(evaluerExigence(exigence('level_exact', { exact: 2 }), p, TABLES)[0]).toBe(false)
  })

  it('class_level : true / false selon la classe et le niveau', () => {
    const p = perso({ classe: 'magicien', niveau: 3 })
    expect(evaluerExigence(exigence('class_level', { class_name: 'magicien', min: 2 }), p, TABLES)[0]).toBe(true)
    expect(evaluerExigence(exigence('class_level', { class_name: 'guerrier', min: 2 }), p, TABLES)[0]).toBe(false)
  })

  it('bba : true / false (toujours dérivable dès classe+niveau connus)', () => {
    const p = perso({ classe: 'guerrier', niveau: 4 })
    expect(evaluerExigence(exigence('bba', { min: 4 }), p, TABLES)[0]).toBe(true)
    expect(evaluerExigence(exigence('bba', { min: 5 }), p, TABLES)[0]).toBe(false)
  })

  it('ability_score : null si score absent, sinon true / false', () => {
    const sansScore = perso({ classe: 'guerrier', niveau: 1 })
    expect(evaluerExigence(exigence('ability_score', { ability: 'Dex', min: 13 }), sansScore, TABLES)[0]).toBeNull()
    const avecScore = perso({ classe: 'guerrier', niveau: 1, caracteristiques: { Dex: 14 } })
    expect(evaluerExigence(exigence('ability_score', { ability: 'Dex', min: 13 }), avecScore, TABLES)[0]).toBe(true)
    const scoreBas = perso({ classe: 'guerrier', niveau: 1, caracteristiques: { Dex: 10 } })
    expect(evaluerExigence(exigence('ability_score', { ability: 'Dex', min: 13 }), scoreBas, TABLES)[0]).toBe(false)
  })

  it('caster_level : null par défaut, false seulement si magie inaccessible', () => {
    const magicien = perso({ classe: 'magicien', niveau: 5 })
    expect(evaluerExigence(exigence('caster_level', { min: 3 }), magicien, TABLES)[0]).toBeNull()
    const guerrier = perso({ classe: 'guerrier', niveau: 5 })
    expect(evaluerExigence(exigence('caster_level', { min: 3 }), guerrier, TABLES)[0]).toBe(false)
  })

  it('skill_ranks : null si rangs non fournis, sinon true / false (hypothèse optimiste par défaut)', () => {
    const sansRangs = perso({ classe: 'guerrier', niveau: 1 })
    // Sans `rangs_competence`, `rangCompetence` renvoie le niveau (optimiste) -> jamais null en pratique.
    expect(evaluerExigence(exigence('skill_ranks', { skill: 'Acrobaties', ranks: 1 }), sansRangs, TABLES)[0]).toBe(
      true,
    )
    const avecRangs = perso({ classe: 'guerrier', niveau: 5, rangs_competence: { Acrobaties: 2 } })
    expect(evaluerExigence(exigence('skill_ranks', { skill: 'Acrobaties', ranks: 5 }), avecRangs, TABLES)[0]).toBe(
      false,
    )
  })

  it('feat : null si dons connus non fournis, sinon true / false', () => {
    const sansDons = perso({ classe: 'guerrier', niveau: 1 })
    expect(evaluerExigence(exigence('feat', { feat_name: 'Endurance' }), sansDons, TABLES)[0]).toBeNull()
    const avecDon = perso({ classe: 'guerrier', niveau: 1, dons_connus: new Set(['endurance']) })
    expect(evaluerExigence(exigence('feat', { feat_name: 'Endurance' }), avecDon, TABLES)[0]).toBe(true)
    const sansLeDon = perso({ classe: 'guerrier', niveau: 1, dons_connus: new Set() })
    expect(evaluerExigence(exigence('feat', { feat_name: 'Endurance' }), sansLeDon, TABLES)[0]).toBe(false)
  })

  it('size : null si taille non fournie/dérivable, sinon true / false', () => {
    const sansTaille = perso({ classe: 'guerrier', niveau: 1 })
    expect(evaluerExigence(exigence('size', { size: 'P', comparator: 'exact' }), sansTaille, TABLES)[0]).toBeNull()
    const petit = perso({ classe: 'guerrier', niveau: 1, taille: 'P' })
    expect(evaluerExigence(exigence('size', { size: 'P', comparator: 'exact' }), petit, TABLES)[0]).toBe(true)
    const grand = perso({ classe: 'guerrier', niveau: 1, taille: 'G' })
    expect(evaluerExigence(exigence('size', { size: 'P', comparator: 'exact' }), grand, TABLES)[0]).toBe(false)
  })

  it('race : null si race non fournie, sinon true / false', () => {
    const sansRace = perso({ classe: 'guerrier', niveau: 1 })
    expect(evaluerExigence(exigence('race', { race: 'nain' }), sansRace, TABLES)[0]).toBeNull()
    const nain = perso({ classe: 'guerrier', niveau: 1, race: 'nain' })
    expect(evaluerExigence(exigence('race', { race: 'nain' }), nain, TABLES)[0]).toBe(true)
    const elfe = perso({ classe: 'guerrier', niveau: 1, race: 'elfe' })
    expect(evaluerExigence(exigence('race', { race: 'nain' }), elfe, TABLES)[0]).toBe(false)
  })

  it('class : true / false, jamais null (classe toujours connue)', () => {
    const p = perso({ classe: 'guerrier', niveau: 1 })
    expect(evaluerExigence(exigence('class', { class_name: 'guerrier' }), p, TABLES)[0]).toBe(true)
    expect(evaluerExigence(exigence('class', { class_name: 'magicien' }), p, TABLES)[0]).toBe(false)
  })

  it('class_feature_text : false si implied_classes exclut la classe, null sinon (défaut)', () => {
    const magicien = perso({ classe: 'guerrier', niveau: 1 })
    expect(
      evaluerExigence(exigence('class_feature_text', { text: 'sort de mage', implied_classes: ['magicien'] }), magicien, TABLES)[0],
    ).toBe(false)
    const sansTexte = perso({ classe: 'guerrier', niveau: 1 })
    expect(evaluerExigence(exigence('class_feature_text', { text: 'quelque chose de vague' }), sansTexte, TABLES)[0]).toBeNull()
  })

  it('unparsed : null par défaut (aucune règle ne permet de trancher)', () => {
    const p = perso({ classe: 'guerrier', niveau: 1 })
    expect(evaluerExigence(exigence('unparsed', { text: 'un segment jamais vu' }), p, TABLES)[0]).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 2. Special cases — bugfixes to preserve exactly
// ---------------------------------------------------------------------------

describe('cas particulier — implied_classes', () => {
  it('classe absente de implied_classes -> false', () => {
    const p = perso({ classe: 'guerrier', niveau: 1 })
    const [ok] = evaluerExigence(
      exigence('unparsed', { text: 'Capacité de classe mystère', implied_classes: ['oracle'] }),
      p,
      TABLES,
    )
    expect(ok).toBe(false)
  })

  it('classe présente dans implied_classes -> null (détail encore à vérifier)', () => {
    const p = perso({ classe: 'oracle', niveau: 1 })
    const [ok] = evaluerExigence(
      exigence('unparsed', { text: 'Capacité de classe mystère', implied_classes: ['oracle'] }),
      p,
      TABLES,
    )
    expect(ok).toBeNull()
  })
})

describe('cas particulier — no_class_levels (param = classes EXCLUES)', () => {
  const hit = (classes: readonly string[]): HitGating => ({
    kind: 'no_class_levels',
    param: classes,
    blocking: true,
    keyword: 'aucun niveau dans une classe dotee de panache',
    couvre_tout_le_segment: true,
  })

  it('classe du personnage DANS le param exclu -> false (et non true)', () => {
    const bretteur = perso({ classe: 'bretteur', niveau: 1 })
    const [ok] = verdictGating(hit(['bretteur']), bretteur, TABLES)
    expect(ok).toBe(false)
  })

  it('classe du personnage HORS du param exclu -> true (et non false — la règle n’est pas inversée)', () => {
    const guerrier = perso({ classe: 'guerrier', niveau: 1 })
    const [ok] = verdictGating(hit(['bretteur']), guerrier, TABLES)
    expect(ok).toBe(true)
  })
})

describe('cas particulier — caster_level / magieInaccessible', () => {
  it('false seulement si classe connue ET non-lanceuse ET race sans magie', () => {
    const guerrierHumain = perso({ classe: 'guerrier', niveau: 5 })
    expect(magieInaccessible(guerrierHumain, TABLES)).toBe(true)
  })

  it('classe connue non-lanceuse MAIS race avec magie innée -> magie NON inaccessible', () => {
    const guerrierAasimar = perso({ classe: 'guerrier', niveau: 5, race: 'aasimar' })
    expect(magieInaccessible(guerrierAasimar, TABLES)).toBe(false)
  })

  it('classe inconnue -> jamais magie inaccessible (jamais deviné)', () => {
    const inconnu = perso({ classe: 'chasseur de vampire', niveau: 5 })
    expect(magieInaccessible(inconnu, TABLES)).toBe(false)
  })
})

describe('cas particulier — classe absente de `maitrises` -> null, jamais ineligible', () => {
  it('« chasseur de vampire » est absente : verdictMaitrise renvoie null', () => {
    const p = perso({ classe: 'chasseur de vampire', niveau: 5 })
    const [ok] = verdictMaitrise({ arme: 'epee longue', categorie: 'martiale' }, p, 'maniement de l’epee longue', TABLES)
    expect(ok).toBeNull()
  })
})

describe('cas particulier — reclassement des armes naines', () => {
  it('Guerrier nain accepté sur une arme naine reclassée en arme de guerre', () => {
    const nain = perso({ classe: 'guerrier', niveau: 5, race: 'nain' })
    const [ok, motif] = verdictMaitrise({ arme: 'dorn-dergar naine', categorie: 'exotique' }, nain, 'maniement de la dorn-dergar naine', TABLES)
    expect(ok).toBe(true)
    expect(motif).toContain('nain')
  })

  it('sans les armes martiales, le reclassement racial ne suffit pas', () => {
    const sansTables: TablesMoteur = { ...TABLES, maitrises: { ...TABLES.maitrises, magicien: { armes_martiales: false, armes_simples: true, armes_specifiques: [], boucliers: false } } }
    const nain = perso({ classe: 'magicien', niveau: 5, race: 'nain' })
    const [ok] = verdictMaitrise({ arme: 'dorn-dergar naine', categorie: 'exotique' }, nain, 'maniement de la dorn-dergar naine', sansTables)
    expect(ok).toBe(false)
  })
})

describe('cas particulier — hit couvrant tout le segment, satisfait -> true', () => {
  it('le hit de gating rend l’exigence entière true, pas manual_check', () => {
    const p = perso({ classe: 'guerrier', niveau: 1, race: 'nain' })
    const req = exigence(
      'unparsed',
      {
        text: 'stabilite',
        gating: [
          { kind: 'racial_trait', param: 'stabilite', blocking: true, keyword: 'stabilite', couvre_tout_le_segment: true },
        ],
      },
      'stabilite',
    )
    const [ok] = evaluerExigence(req, p, TABLES)
    expect(ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. OrGroup : fragments écartés sauf si tous
// ---------------------------------------------------------------------------

describe('evaluerGroupeOu — fragments', () => {
  it('une option fragment est écartée si une autre option existe', () => {
    const p = perso({ classe: 'guerrier', niveau: 1 })
    const groupe: GroupeOu = {
      options: [
        exigence('level', { min: 99 }),
        exigence('unparsed', { text: 'plus', fragment: true }),
      ],
    }
    const [ok] = evaluerGroupeOu(groupe, p, TABLES)
    // La seule option non-fragment échoue -> false (pas de fragment pour masquer ça).
    expect(ok).toBe(false)
  })

  it('si TOUTES les options sont des fragments, elles sont conservées', () => {
    const p = perso({ classe: 'guerrier', niveau: 1 })
    const groupe: GroupeOu = {
      options: [
        exigence('unparsed', { text: 'familier', fragment: true }),
        exigence('unparsed', { text: 'monture', fragment: true }),
      ],
    }
    const [ok] = evaluerGroupeOu(groupe, p, TABLES)
    // Aucune des deux options fragment n'est vérifiable -> null (à vérifier), jamais false.
    expect(ok).toBeNull()
  })

  it('true si une option est true, même si une autre est null', () => {
    const p = perso({ classe: 'guerrier', niveau: 5 })
    const groupe: GroupeOu = { options: [exigence('level', { min: 1 }), exigence('unparsed', { text: 'x' })] }
    expect(evaluerGroupeOu(groupe, p, TABLES)[0]).toBe(true)
  })

  it('null si aucune option true mais une option null', () => {
    const p = perso({ classe: 'guerrier', niveau: 1 })
    const groupe: GroupeOu = { options: [exigence('level', { min: 99 }), exigence('unparsed', { text: 'x' })] }
    expect(evaluerGroupeOu(groupe, p, TABLES)[0]).toBeNull()
  })

  it('false si aucune option true et aucune null', () => {
    const p = perso({ classe: 'guerrier', niveau: 1 })
    const groupe: GroupeOu = { options: [exigence('level', { min: 99 }), exigence('level', { min: 50 })] }
    expect(evaluerGroupeOu(groupe, p, TABLES)[0]).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4. evaluerDon short-circuits on the first false
// ---------------------------------------------------------------------------

describe('evaluerDon — court-circuit', () => {
  it('la seconde exigence n’est jamais évaluée après un false', () => {
    const p = perso({ classe: 'guerrier', niveau: 1 })
    const don: DonConditions = {
      brut: 'niveau 99, Dex 13',
      effectif: 'niveau 99, Dex 13',
      exigences: [exigence('level', { min: 99 }), exigence('ability_score', { ability: 'Dex', min: 13 })],
    }

    // Spy on the module's own evaluerExigence via a wrapped catalogue call:
    // build a DonConditions whose second requirement would throw if ever
    // evaluated, proving the short-circuit rather than merely asserting the
    // final status.
    const donAvecPiege: DonConditions = {
      brut: don.brut,
      effectif: don.effectif,
      exigences: [
        exigence('level', { min: 99 }),
        {
          type: 'ability_score',
          charge: {
            ability: 'Dex',
            get min(): number {
              throw new Error('la seconde exigence a été évaluée malgré le false précédent')
            },
          },
          verif_manuelle: false,
          segment: 'piège',
        },
      ],
    }

    expect(() => evaluerDon('Don piégé', donAvecPiege, p, TABLES)).not.toThrow()
    const resultat = evaluerDon('Don piégé', donAvecPiege, p, TABLES)
    expect(resultat.statut).toBe('ineligible')
  })

  it('espion : la seconde exigence (un getter piégé) n’est jamais lue', () => {
    const espion = vi.fn(() => 1)
    const p = perso({ classe: 'guerrier', niveau: 1 })
    const don: DonConditions = {
      brut: '',
      effectif: '',
      exigences: [
        exigence('level', { min: 99 }),
        {
          type: 'level',
          charge: {
            get min(): number {
              return espion()
            },
          },
          verif_manuelle: false,
          segment: 'jamais lu',
        },
      ],
    }
    evaluerDon('Don test espion', don, p, TABLES)
    expect(espion).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 5. filtrerDons — smoke test over a tiny catalogue
// ---------------------------------------------------------------------------

describe('filtrerDons', () => {
  it('groupe et trie par statut', () => {
    const p = perso({ classe: 'guerrier', niveau: 5 })
    const catalogue: CatalogueDons = new Map<string, DonConditions>([
      ['Endurance', { brut: '', effectif: '', exigences: [] }],
      ['Trop haut niveau', { brut: '', effectif: '', exigences: [exigence('level', { min: 99 })] }],
      ['À vérifier', { brut: '', effectif: '', exigences: [exigence('unparsed', { text: 'x' })] }],
    ])
    const groupes = filtrerDons(catalogue, p, TABLES)
    expect(groupes.eligible.map((r) => r.nom_don)).toEqual(['Endurance'])
    expect(groupes.ineligible.map((r) => r.nom_don)).toEqual(['Trop haut niveau'])
    expect(groupes.manual_check.map((r) => r.nom_don)).toEqual(['À vérifier'])
  })
})

// ---------------------------------------------------------------------------
// Ancillary
// ---------------------------------------------------------------------------

describe('normaliser / bba', () => {
  it('replie les accents et la casse', () => {
    expect(normaliser('Ébène')).toBe('ebene')
  })

  it('bba lève sur une classe inconnue, sans jamais la deviner', () => {
    const p = perso({ classe: 'chasseur de vampire', niveau: 5 })
    expect(() => bba(p, TABLES)).toThrow()
  })
})
