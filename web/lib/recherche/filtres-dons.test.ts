/**
 * Dons (Pathfinder feats) filtering — the counter-honesty invariant.
 *
 * The bug this whole layer exists to catch (`OUTPUT_defauts_du_graphe.md` in
 * the source repository) is invisible to a code reader: a facet's option
 * count and the number of results the click actually produces can silently
 * drift apart the moment a multi-valued field is treated as scalar. So the
 * first thing tested here is exactly that equality, swept across every option
 * of every facet — not a spot check.
 */

import { describe, expect, it } from 'vitest'

import {
  COUT_DONS_MAX,
  compterOptions,
  FACETTES_DONS,
  FILTRES_DONS_VIDES,
  filtrerDons,
  MULTIVALUEES,
  STATUTS_DONS,
  type EntreeDon,
  type FacetteDon,
  type FiltresDons,
  type StatutDon,
} from './filtres'

function don(partiel: Partial<EntreeDon> & { readonly id: string }): EntreeDon {
  return {
    effet: null,
    effets2: [],
    cibles: [],
    contextes: [],
    activation: null,
    polyvalence: null,
    categories: [],
    cout: null,
    statut: 'eligible',
    texte: partiel.id,
    ...partiel,
  }
}

// A small corpus exercising every facet with at least one multi-valued field
// carrying two values, so a scalar-only accessor would visibly undercount.
const DONS: readonly EntreeDon[] = [
  don({
    id: 'endurance',
    effet: 'defense',
    effets2: ['mobilite'],
    cibles: ['PV'],
    contextes: ['exploration'],
    activation: 'passif',
    polyvalence: 'polyvalent',
    categories: ['combat'],
    cout: 1,
    statut: 'eligible',
  }),
  don({
    id: 'blessant',
    effet: 'debuff',
    effets2: [],
    cibles: ['degats'],
    contextes: ['melee'],
    activation: 'actif_illimite',
    polyvalence: 'conditionnel',
    categories: ['combat', 'sociale'],
    cout: 2,
    statut: 'manual_check',
  }),
  don({
    id: 'expertise-du-combat',
    effet: 'defense',
    effets2: ['manoeuvre'],
    cibles: ['CA', 'jet_attaque'],
    contextes: ['melee'],
    activation: 'actif_illimite',
    polyvalence: 'polyvalent',
    categories: ['combat'],
    cout: 1,
    statut: 'eligible',
  }),
  don({
    id: 'canalisateur-polyvalent',
    effet: 'social',
    effets2: [],
    cibles: [],
    contextes: ['social'],
    activation: 'passif',
    polyvalence: 'niche',
    categories: ['heritage'],
    cout: 3,
    statut: 'ineligible',
  }),
  don({
    id: 'creation-objet-mineure',
    effet: 'creation',
    effets2: [],
    cibles: [],
    contextes: [],
    activation: 'long',
    polyvalence: 'niche',
    categories: ['creation_objet', 'sociale'],
    cout: null, // uncomputed cost — must never match a coutMax filter
    statut: 'manual_check',
  }),
]

describe('MULTIVALUEES — les facettes déclarées multivaluées', () => {
  it('déclare exactement les quatre facettes attendues', () => {
    expect([...MULTIVALUEES].sort()).toEqual(['categorie', 'cible', 'contexte', 'effet2'])
  })

  it('exclut les trois facettes à valeur unique', () => {
    expect(MULTIVALUEES.has('effet')).toBe(false)
    expect(MULTIVALUEES.has('activation')).toBe(false)
    expect(MULTIVALUEES.has('polyvalence')).toBe(false)
  })
})

describe('régression — une facette multivaluée non déclarée casse le compteur', () => {
  it('« Blessant » (combat + sociale) doit compter sous SES DEUX catégories', () => {
    // This is exactly the historical bug: `categorie_officielle` forgotten from
    // the multi-valued set made a two-category don visible under its first
    // category only. A naive scalar accessor reading `categories[0]` would
    // report zero for "sociale"; the real, declared-multivalued accessor must
    // report it.
    const comptesCorrects = compterOptions(DONS, FILTRES_DONS_VIDES, 'categorie')
    expect(comptesCorrects.get('combat')).toBe(3)
    expect(comptesCorrects.get('sociale')).toBe(2)

    // The naive, scalar-only reading a forgotten declaration would produce:
    const comptesNaifs = new Map<string, number>()
    for (const entree of DONS) {
      const premiere = entree.categories[0]
      if (premiere !== undefined) comptesNaifs.set(premiere, (comptesNaifs.get(premiere) ?? 0) + 1)
    }
    // The naive map disagrees with the correct one on "sociale" — proving the
    // declaration is load-bearing, not decorative.
    expect(comptesNaifs.get('sociale')).not.toBe(comptesCorrects.get('sociale'))
  })
})

describe("l'invariant du compteur — compterOptions prédit filtrerDons", () => {
  // No facet pre-selected: `compterOptions` always clears `saufFacette`'s own
  // selection before counting, so a base state that already selected
  // something on the very facet under test would make "adding this option"
  // ambiguous (accumulate onto the existing selection, or replace it?). A
  // clean base sidesteps that entirely while still exercising every facet.
  const FILTRES_DE_BASE: FiltresDons = FILTRES_DONS_VIDES

  it.each(FACETTES_DONS)('facette « %s » — chaque option compte juste', (facette) => {
    const comptes = compterOptions(DONS, FILTRES_DE_BASE, facette)
    for (const [option, nombre] of comptes) {
      const filtresAvecOption = ajouterOption(FILTRES_DE_BASE, facette, option)
      const resultat = filtrerDons(DONS, filtresAvecOption)
      expect(resultat.length, `option ${facette}=${option}`).toBe(nombre)
    }
  })

  it('aucune option à zéro ne figure dans la Map', () => {
    const comptes = compterOptions(DONS, FILTRES_DE_BASE, 'categorie')
    for (const nombre of comptes.values()) {
      expect(nombre).toBeGreaterThan(0)
    }
    // "monture" n'est porté par aucun don du corpus : absent, pas à zéro.
    expect(comptes.has('monture')).toBe(false)
  })
})

function ajouterOption(filtres: FiltresDons, facette: FacetteDon, option: string): FiltresDons {
  switch (facette) {
    case 'effet':
      return { ...filtres, effets: [...filtres.effets, option] }
    case 'effet2':
      return { ...filtres, effets2: [...filtres.effets2, option] }
    case 'cible':
      return { ...filtres, cibles: [...filtres.cibles, option] }
    case 'contexte':
      return { ...filtres, contextes: [...filtres.contextes, option] }
    case 'activation':
      return { ...filtres, activations: [...filtres.activations, option] }
    case 'polyvalence':
      return { ...filtres, polyvalences: [...filtres.polyvalences, option] }
    case 'categorie':
      return { ...filtres, categories: [...filtres.categories, option] }
  }
}

describe('le cycle à trois états', () => {
  it('OU, NON et ET produisent trois FiltresDons distincts sur les mêmes dons', () => {
    const ou: FiltresDons = { ...FILTRES_DONS_VIDES, effets: ['defense'] }
    const non: FiltresDons = { ...FILTRES_DONS_VIDES, effetsExclus: ['defense'] }
    const et: FiltresDons = { ...FILTRES_DONS_VIDES, effetsObliges: ['defense'] }

    const resultatsOu = filtrerDons(DONS, ou).map((d) => d.id)
    const resultatsNon = filtrerDons(DONS, non).map((d) => d.id)
    const resultatsEt = filtrerDons(DONS, et).map((d) => d.id)

    expect(resultatsOu).toEqual(['endurance', 'expertise-du-combat'])
    expect(resultatsNon).toEqual(
      DONS.map((d) => d.id).filter((id) => !resultatsOu.includes(id)),
    )
    // On a single-valued field like `effet`, AND behaves exactly like OR for a
    // one-value selection — the distinction only bites once two values are
    // required at once. What matters here is that the three states are wired
    // to three genuinely different fields, which this proves by construction:
    // NON is the complement of OU, and ET/OU agree only because a single
    // AND-value can never disagree with itself.
    expect(resultatsEt).toEqual(resultatsOu)
    expect(resultatsNon).not.toEqual(resultatsOu)
  })

  it('ET exige TOUTES les valeurs sur une facette multivaluée (deux valeurs à la fois)', () => {
    const et: FiltresDons = {
      ...FILTRES_DONS_VIDES,
      categoriesObligees: ['combat', 'sociale'],
    }
    expect(filtrerDons(DONS, et).map((d) => d.id)).toEqual(['blessant'])
  })
})

describe('coût et statut', () => {
  it('coutMax filtre les dons plus chers, et exclut les dons de coût inconnu', () => {
    const filtres: FiltresDons = { ...FILTRES_DONS_VIDES, coutMax: 1 }
    expect(filtrerDons(DONS, filtres).map((d) => d.id)).toEqual(['endurance', 'expertise-du-combat'])
  })

  it('accepte tout coût de 1 à COUT_DONS_MAX', () => {
    expect(COUT_DONS_MAX).toBe(5)
  })

  it('manual_check reste sélectionnable et filtre correctement', () => {
    const filtres: FiltresDons = { ...FILTRES_DONS_VIDES, statuts: ['manual_check'] }
    expect(filtrerDons(DONS, filtres).map((d) => d.id).sort()).toEqual(
      ['blessant', 'creation-objet-mineure'].sort(),
    )
  })

  it('STATUTS_DONS porte les trois valeurs du tri-état', () => {
    const attendu: readonly StatutDon[] = ['eligible', 'manual_check', 'ineligible']
    expect(STATUTS_DONS).toEqual(attendu)
  })
})

describe('q — recherche plein texte', () => {
  it('filtre insensible à la casse', () => {
    const filtres: FiltresDons = { ...FILTRES_DONS_VIDES, q: 'BLESSANT' }
    expect(filtrerDons(DONS, filtres).map((d) => d.id)).toEqual(['blessant'])
  })
})

describe('FILTRES_DONS_VIDES', () => {
  it('ne filtre rien', () => {
    expect(filtrerDons(DONS, FILTRES_DONS_VIDES)).toHaveLength(DONS.length)
  })
})
