/**
 * The axes, and the two claims the whole route rests on.
 *
 * The first is that a partition axis really partitions: its slices sum to the
 * subset. If that ever stops holding, the donut is drawing wedges of a circle that
 * does not add up, and no amount of correct geometry saves it.
 *
 * The second is that nothing is discarded silently (CLAUDE.md § 3). The 297 spells
 * whose saving throw the source declines to state have to appear in the chart, and
 * they have to be un-clickable, because no filter can name that absence.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { IndexWeb } from '@/lib/donnees/index-web'
import {
  AXES,
  axesDisponibles,
  axeSuggere,
  CLES_AXES,
  discrimine,
  forer,
  remonter,
  retirerAxe,
} from '@/lib/exploration/axes'
import {
  EXPLORATION_VIDE,
  versFiltresExploration,
  type EtatExploration,
} from '@/lib/exploration/etat-exploration'
import { appliquerFiltres } from '@/lib/recherche/filtres'

// The real export, not a fixture: the claims below are about this corpus's shape —
// 297 spells with no saving throw, a bard list that spans levels 0 to 6 — and a
// hand-written stub would only assert what the stub was built to say.
const INDEX = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'data', 'index.json'), 'utf8'),
) as IndexWeb

const AVEC_BARDE: EtatExploration = {
  ...EXPLORATION_VIDE,
  base: { ...EXPLORATION_VIDE.base, classe: 'barde' },
}

function sousEnsemble(etat: EtatExploration) {
  return appliquerFiltres(INDEX.sorts, versFiltresExploration(etat, INDEX))
}

// The level axis's form depends on how many classes are chosen — a function, not
// a fixed value — so every check below resolves it against the one-class state
// these tests otherwise share.
function forme(cle: (typeof CLES_AXES)[number], etat: EtatExploration): 'donut' | 'barres' {
  const f = AXES[cle].forme
  return typeof f === 'function' ? f(etat) : f
}

const PARTITIONS = CLES_AXES.filter((cle) => forme(cle, AVEC_BARDE) === 'donut')
const RECOUVREMENTS = CLES_AXES.filter((cle) => forme(cle, AVEC_BARDE) === 'barres')

describe('les axes de partition partitionnent', () => {
  it.each(PARTITIONS)('%s : les tranches totalisent le sous-ensemble', (cle) => {
    const sorts = sousEnsemble(AVEC_BARDE)
    const tranches = AXES[cle].decouper(sorts, INDEX, AVEC_BARDE)
    const somme = tranches.reduce((total, tranche) => total + tranche.nb, 0)
    expect(somme).toBe(sorts.length)
  })

  it.each(RECOUVREMENTS)('%s est déclaré en barres, pas en camembert', (cle) => {
    // A tag axis summed to more than the subset would draw wedges claiming a share
    // of the circle they do not have. The form is the fix, and it is asserted here
    // so that flipping it back is a failing test rather than a wrong chart.
    expect(forme(cle, AVEC_BARDE)).toBe('barres')
  })

  it('le niveau passe en barres dès que plusieurs classes sont choisies', () => {
    const deuxClasses: EtatExploration = { ...AVEC_BARDE, classesSupplementaires: ['druide'] }
    expect(forme('niveau', deuxClasses)).toBe('barres')
  })
})

describe('ce que la source ne dit pas est montré, jamais cliquable', () => {
  it('les sorts sans jet de sauvegarde ont leur tranche, non filtrable', () => {
    const sansJet: IndexWeb = {
      ...INDEX,
      sorts: [...INDEX.sorts.slice(0, 3).map((sort) => ({ ...sort, j: null }))],
    }
    const tranches = AXES.sauvegarde.decouper(sansJet.sorts, sansJet, EXPLORATION_VIDE)
    const absente = tranches.find((tranche) => tranche.valeur === null)
    expect(absente?.nb).toBe(3)
    expect(absente?.libelle).toContain('Non renseigné')
  })

  it('une tranche non filtrable ne compte pas comme un choix', () => {
    // Two slices are the floor for offering an axis, and one of them being an
    // absence would send the reader to a wedge they cannot enter.
    const unSeulJet: IndexWeb = {
      ...INDEX,
      sorts: INDEX.sorts.map((sort, rang) => ({ ...sort, j: rang % 2 === 0 ? 0 : null })),
    }
    expect(
      discrimine(AXES.sauvegarde, unSeulJet.sorts, unSeulJet, EXPLORATION_VIDE),
    ).toBe(false)
  })

  it('les sorts sans portée ont leur tranche, non filtrable', () => {
    const sansPortee: IndexWeb = {
      ...INDEX,
      sorts: [...INDEX.sorts.slice(0, 3).map((sort) => ({ ...sort, p: null }))],
    }
    const tranches = AXES.portee.decouper(sansPortee.sorts, sansPortee, EXPLORATION_VIDE)
    const absente = tranches.find((tranche) => tranche.valeur === null)
    expect(absente?.nb).toBe(3)
    expect(absente?.libelle).toContain('Non renseignée')
  })

  it('les sorts sans type de dégâts ont leur tranche, non filtrable', () => {
    const sansDegats: IndexWeb = {
      ...INDEX,
      sorts: [...INDEX.sorts.slice(0, 3).map((sort) => ({ ...sort, td: null }))],
    }
    const tranches = AXES.degats.decouper(sansDegats.sorts, sansDegats, EXPLORATION_VIDE)
    const absente = tranches.find((tranche) => tranche.valeur === null)
    expect(absente?.nb).toBe(3)
    expect(absente?.libelle).toContain('Non renseigné')
  })
})

describe('portée et type de dégâts posent et retirent leur propre critère', () => {
  it('portee : poser rejoint EtatUrl.portees, retirer le vide', () => {
    const pose = AXES.portee.poser(EXPLORATION_VIDE, ['Personnelle'])
    expect(pose.base.portees).toEqual(['Personnelle'])
    expect(AXES.portee.pose(pose)).toBe(true)
    expect(AXES.portee.retirer(pose).base.portees).toEqual([])
  })

  it('degats : poser rejoint EtatUrl.typesDegats, retirer le vide', () => {
    const pose = AXES.degats.poser(EXPLORATION_VIDE, ['feu'])
    expect(pose.base.typesDegats).toEqual(['feu'])
    expect(AXES.degats.pose(pose)).toBe(true)
    expect(AXES.degats.retirer(pose).base.typesDegats).toEqual([])
  })
})

describe('l’axe du niveau', () => {
  it('nomme la classe dans le libellé parlé, jamais un niveau nu', () => {
    // « Niveau 2 » alone means nothing in this corpus: a spell is level 2 *for the
    // bard*. The spoken label is the one a screen reader reads out, so it carries
    // the class even though the heading above the chart also does.
    const tranches = AXES.niveau.decouper(sousEnsemble(AVEC_BARDE), INDEX, AVEC_BARDE)
    expect(tranches.length).toBeGreaterThan(1)
    for (const tranche of tranches) {
      expect(tranche.libelleAccessible).toContain('Barde')
    }
  })

  it('classe les niveaux par ordre croissant, pas par effectif', () => {
    const tranches = AXES.niveau.decouper(sousEnsemble(AVEC_BARDE), INDEX, AVEC_BARDE)
    const valeurs = tranches
      .filter((tranche) => tranche.valeur !== null)
      .map((tranche) => Number(tranche.valeur))
    expect(valeurs).toEqual([...valeurs].sort((a, b) => a - b))
  })

  it('le niveau 0 est un niveau — il a sa tranche', () => {
    const oraisons: IndexWeb = {
      ...INDEX,
      sorts: INDEX.sorts.slice(0, 2).map((sort) => ({ ...sort, niv: { barde: 0 } })),
    }
    const tranches = AXES.niveau.decouper(oraisons.sorts, oraisons, AVEC_BARDE)
    expect(tranches[0]?.valeur).toBe('0')
    expect(tranches[0]?.nb).toBe(2)
  })

  it('sans classe, le libellé dit que le nombre est un plancher', () => {
    const tranches = AXES.niveau.decouper(
      sousEnsemble(EXPLORATION_VIDE),
      INDEX,
      EXPLORATION_VIDE,
    )
    expect(tranches[0]?.libelleAccessible.toLowerCase()).toContain('toutes classes')
  })
})

describe('poser, remonter, retirer', () => {
  it('forer pose le critère et inscrit l’axe au bout du parcours', () => {
    const apres = forer(AVEC_BARDE, 'niveau', ['2'])
    expect(apres.base.niveaux).toEqual([2])
    expect(apres.parcours).toEqual(['niveau'])
    // The axis is released so the next question can be suggested again.
    expect(apres.axe).toBeNull()
  })

  it('répondre deux fois à la même question ne duplique pas le cran', () => {
    const apres = forer(forer(AVEC_BARDE, 'niveau', ['2']), 'niveau', ['3'])
    expect(apres.base.niveaux).toEqual([3])
    expect(apres.parcours).toEqual(['niveau'])
  })

  it('remonter défait le dernier cran et rouvre ce graphique', () => {
    const deux = forer(forer(AVEC_BARDE, 'niveau', ['2']), 'ecole', ['evocation'])
    const avant = remonter(deux)
    expect(avant.base.ecoles).toEqual([])
    expect(avant.base.niveaux).toEqual([2])
    expect(avant.parcours).toEqual(['niveau'])
    // Shown again, rather than moving the reader on to another question.
    expect(avant.axe).toBe('ecole')
  })

  it('remonter sur un parcours vide ne change rien', () => {
    expect(remonter(AVEC_BARDE)).toEqual(AVEC_BARDE)
  })

  it('retirer un cran du milieu garde les suivants', () => {
    const deux = forer(forer(AVEC_BARDE, 'niveau', ['2']), 'ecole', ['evocation'])
    const sansNiveau = retirerAxe(deux, 'niveau')
    expect(sansNiveau.base.niveaux).toEqual([])
    expect(sansNiveau.base.ecoles).toEqual(['evocation'])
    expect(sansNiveau.parcours).toEqual(['ecole'])
  })
})

describe('la suggestion du prochain axe', () => {
  it('propose le niveau en premier, une fois la classe choisie', () => {
    expect(axeSuggere(INDEX, AVEC_BARDE, sousEnsemble)).toBe('niveau')
  })

  it('ne propose pas un axe déjà posé', () => {
    const apres = forer(AVEC_BARDE, 'niveau', ['1'])
    expect(axeSuggere(INDEX, apres, sousEnsemble)).not.toBe('niveau')
  })

  it('finit par ne plus rien proposer — et c’est un état, pas une panne', () => {
    // One spell left: no axis can cut it in two, so the view says « vous y êtes »
    // instead of drawing a ring of one slice.
    const unSort: EtatExploration = {
      ...AVEC_BARDE,
      base: { ...AVEC_BARDE.base, classe: 'barde', niveaux: [1] },
    }
    const reduit = (etat: EtatExploration) => sousEnsemble(etat).slice(0, 1)
    expect(axeSuggere(INDEX, unSort, reduit)).toBeNull()
  })

  it('un axe qui ne réduit rien n’est pas proposé', () => {
    // Two bars, both full width: every spell carries both components, so
    // clicking either leaves the same list. Two slices are the floor, not the
    // whole test.
    const codes = ['V', 'S'].map((composante) => INDEX.composantes.indexOf(composante))
    const memesComposantes = INDEX.sorts.slice(0, 3).map((sort) => ({ ...sort, c: codes }))
    expect(discrimine(AXES.composante, memesComposantes, INDEX, EXPLORATION_VIDE)).toBe(false)
  })

  it('aucun axe n’est proposé au-delà de ceux disponibles', () => {
    const sansJets: IndexWeb = { ...INDEX, jets: [] }
    const cles = axesDisponibles(sansJets, AVEC_BARDE).map((axe) => axe.cle)
    expect(cles).not.toContain('sauvegarde')
    expect(cles).toContain('niveau')
  })
})
