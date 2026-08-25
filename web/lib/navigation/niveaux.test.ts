/**
 * The level model, which is the point of this step.
 *
 * The fixture was chosen for this: `degout` is level 2 for the bard and 3 for the
 * druid, `attirance` is 9 for the druid and 6 for the occultist. Those are not
 * edge cases contrived for a test — they are the ordinary shape of the corpus, and
 * an interface that shows one number for them is wrong at the table.
 */

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { type EntreeSort, type IndexWeb } from '@/lib/donnees/index-web'
import { CHEMIN_INDEX_FIXTURE } from '@/lib/donnees/lire-index'
import { niveauMinimum } from '@/lib/recherche/filtres'

import { LIBELLE_SANS_CLASSE, libelleNiveau, niveauAffiche, trierParNiveauPuisNom } from './niveaux'

const INDEX = JSON.parse(readFileSync(CHEMIN_INDEX_FIXTURE, 'utf8')) as IndexWeb

function sortDe(id: string): EntreeSort {
  const trouve = INDEX.sorts.find((sort) => sort.id === id)
  if (trouve === undefined) throw new Error(`fixture sans ${id}`)
  return trouve
}

const DEGOUT = sortDe('degout')

describe('le même sort a deux niveaux selon la classe', () => {
  it('« Dégoût » est niveau 2 pour le barde et 3 pour le druide', () => {
    // The assertion the whole data model exists for. If this ever collapses to
    // one number, the interface has started lying.
    expect(DEGOUT.niv).toEqual({ barde: 2, druide: 3, occultiste: 2 })
    expect(niveauAffiche(INDEX, DEGOUT, 'barde').valeur).toBe(2)
    expect(niveauAffiche(INDEX, DEGOUT, 'druide').valeur).toBe(3)
  })

  it('« Attirance » est niveau 9 pour le druide et 6 pour l’occultiste', () => {
    const attirance = sortDe('attirance')
    expect(niveauAffiche(INDEX, attirance, 'druide').valeur).toBe(9)
    expect(niveauAffiche(INDEX, attirance, 'occultiste').valeur).toBe(6)
  })

  it('rend null pour une classe qui ne reçoit pas le sort', () => {
    // null, rendered as an em dash. A 0 here would read as an orison.
    expect(niveauAffiche(INDEX, sortDe('talisman-instrumental'), 'barde').valeur).toBeNull()
  })
})

describe('le libellé nomme la classe, ou dit qu’il n’y en a pas', () => {
  it('nomme la classe choisie', () => {
    expect(libelleNiveau(INDEX, 'barde')).toBe('Niveau pour Barde')
    expect(libelleNiveau(INDEX, 'occultiste')).toBe('Niveau pour Occultiste')
  })

  it('dit explicitement « toutes classes » sans classe choisie', () => {
    // Not « Niveau », which would read as a property of the spell.
    expect(libelleNiveau(INDEX, null)).toBe(LIBELLE_SANS_CLASSE)
    expect(libelleNiveau(INDEX, null)).toMatch(/toutes classes/)
  })

  it('retombe sur le slug pour une classe hors table plutôt que d’effacer l’info', () => {
    expect(libelleNiveau(INDEX, 'magus')).toBe('Niveau pour magus')
  })
})

describe('le titre dit toujours ce que le nombre veut dire', () => {
  it('avec une classe, il nomme la classe', () => {
    expect(niveauAffiche(INDEX, DEGOUT, 'barde').titre).toBe('Niveau pour Barde : 2')
  })

  it('sans classe, il dit le plancher ET donne la table complète', () => {
    // The number shown is a floor; the reader has to be able to see what of.
    const affiche = niveauAffiche(INDEX, DEGOUT, null)
    expect(affiche.valeur).toBe(2)
    expect(affiche.relatifAUneClasse).toBe(false)
    expect(affiche.titre).toContain(LIBELLE_SANS_CLASSE)
    expect(affiche.titre).toContain('Barde 2')
    expect(affiche.titre).toContain('Druide 3')
    expect(affiche.titre).toContain('Occultiste 2')
  })

  it('marque comme relatif seulement quand une classe est choisie', () => {
    expect(niveauAffiche(INDEX, DEGOUT, 'barde').relatifAUneClasse).toBe(true)
    expect(niveauAffiche(INDEX, DEGOUT, null).relatifAUneClasse).toBe(false)
  })

  it('le dit franchement quand aucune classe ne reçoit le sort', () => {
    const orphelin: EntreeSort = { ...DEGOUT, niv: {} }
    const affiche = niveauAffiche(INDEX, orphelin, null)
    expect(affiche.valeur).toBeNull()
    expect(affiche.titre).toMatch(/Aucune classe/)
  })
})

describe('niveauMinimum', () => {
  it('traverse toutes les classes', () => {
    expect(niveauMinimum(DEGOUT)).toBe(2)
    expect(niveauMinimum(sortDe('attirance'))).toBe(6)
  })

  it('renvoie null, jamais 0, pour un sort sans classe', () => {
    // Mirrors `niveau_minimum` in `build_alias.py`, and for the same reason: 0 is
    // a real level and would sort the spell to the top.
    expect(niveauMinimum({ ...DEGOUT, niv: {} })).toBeNull()
  })

  it('rend 0 quand 0 est le vrai minimum', () => {
    expect(niveauMinimum(sortDe('detection-de-la-magie'))).toBe(0)
  })
})

describe('trierParNiveauPuisNom', () => {
  it('trie par niveau de la classe choisie, puis par nom', () => {
    const tries = trierParNiveauPuisNom(INDEX, INDEX.sorts, 'barde')
    const niveaux = tries
      .map((sort) => sort.niv['barde'] ?? Number.POSITIVE_INFINITY)
      .filter((n) => Number.isFinite(n))
    expect([...niveaux]).toEqual([...niveaux].sort((a, b) => a - b))
  })

  it('change d’ordre quand la classe change', () => {
    // The proof that the sort is class-relative and not a fixed order dressed up.
    const parBarde = trierParNiveauPuisNom(INDEX, INDEX.sorts, 'barde').map((s) => s.id)
    const parDruide = trierParNiveauPuisNom(INDEX, INDEX.sorts, 'druide').map((s) => s.id)
    expect(parBarde).not.toEqual(parDruide)
  })

  it('range les sorts sans niveau à la fin, pas au début', () => {
    // Unknown at the top of a level-ordered list looks like level 0.
    const tries = trierParNiveauPuisNom(INDEX, INDEX.sorts, 'barde')
    const premierSans = tries.findIndex((sort) => sort.niv['barde'] === undefined)
    const dernierAvec = tries.reduce(
      (dernier, sort, position) => (sort.niv['barde'] === undefined ? dernier : position),
      -1,
    )
    expect(premierSans).toBeGreaterThan(dernierAvec)
  })

  it('collationne les noms en français', () => {
    // « Éclair » sorts after « Eau » in French and before it by code point; the
    // corpus is full of accented initials, so this is not a nicety.
    const sorts: EntreeSort[] = [
      { ...DEGOUT, id: 'z', n: 'Zone', niv: { barde: 1 } },
      { ...DEGOUT, id: 'e', n: 'Éclair', niv: { barde: 1 } },
      { ...DEGOUT, id: 'a', n: 'Eau', niv: { barde: 1 } },
    ]
    expect(trierParNiveauPuisNom(INDEX, sorts, 'barde').map((s) => s.n)).toEqual([
      'Eau',
      'Éclair',
      'Zone',
    ])
  })

  it('ne mute pas l’entrée', () => {
    const avant = INDEX.sorts.map((sort) => sort.id)
    trierParNiveauPuisNom(INDEX, INDEX.sorts, 'druide')
    expect(INDEX.sorts.map((sort) => sort.id)).toEqual(avant)
  })
})
