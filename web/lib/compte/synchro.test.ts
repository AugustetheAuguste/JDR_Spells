import { describe, expect, it } from 'vitest'

import {
  fusionMuette,
  fusionner,
  instant,
  listesDisparues,
  normaliserDate,
  versEtat,
  versLignes,
  type LigneListe,
  type LigneSort,
} from '@/lib/compte/synchro'
import { VERSION_FAVORIS, type EtatFavoris, type ListeFavoris } from '@/lib/favoris/stockage'

/**
 * The merge is the only part of synchronisation that can lose data, and it is pure,
 * so it is tested as a table of examples rather than discovered on someone's phone.
 *
 * The assertions below are deliberately about *what survives*, not about internal
 * shape: every case that could drop a favourite has an explicit test, and each one
 * states the rule it defends in its name.
 */

function liste(
  id_liste: string,
  sorts: readonly string[],
  modifie_le = '2026-08-01T00:00:00.000Z',
  nom = id_liste,
  cree_le = '2026-01-01T00:00:00.000Z',
  personnage_id: string | null = null,
): ListeFavoris {
  return { id_liste, nom, cree_le, modifie_le, sorts, personnage_id }
}

function etat(listes: readonly ListeFavoris[], liste_active: string | null = null): EtatFavoris {
  return { version: VERSION_FAVORIS, listes, liste_active }
}

function ligne(
  id_liste: string,
  modifie_le: string | null = '2026-08-01T00:00:00.000Z',
  supprime_le: string | null = null,
  nom: string | null = id_liste,
  personnage_id: string | null = null,
): LigneListe {
  return {
    id_liste,
    nom,
    cree_le: '2026-01-01T00:00:00.000Z',
    modifie_le,
    supprime_le,
    personnage_id,
  }
}

function sort(id_liste: string, spell_id: string, position: number): LigneSort {
  return { id_liste, spell_id, position }
}

const VIDE = etat([])

describe('instant et normaliserDate', () => {
  it('rend le même nombre pour deux écritures du même instant', () => {
    // Le cas qui casse une comparaison de chaînes : l'horloge locale écrit `Z`,
    // PostgREST rend `+00:00`.
    expect(instant('2026-08-27T10:00:00.000Z')).toBe(instant('2026-08-27T10:00:00+00:00'))
  })

  it('traite une date absente comme la plus ancienne possible, jamais comme récente', () => {
    expect(instant(null)).toBe(0)
    expect(instant('')).toBe(0)
    expect(instant('pas une date')).toBe(0)
  })

  it('normalise vers la forme que le stockage local accepte', () => {
    expect(normaliserDate('2026-08-27T10:00:00+00:00')).toBe('2026-08-27T10:00:00.000Z')
    // Et surtout jamais la chaîne « Invalid Date », que `validerListe` refuserait.
    expect(normaliserDate('pas une date')).toBe('')
    expect(normaliserDate(null)).toBe('')
  })
})

describe('versEtat', () => {
  it('rend les sorts dans l’ordre de `position`, pas dans celui des lignes', () => {
    const distant = versEtat(
      [ligne('l1')],
      [sort('l1', 'c', 2), sort('l1', 'a', 0), sort('l1', 'b', 1)],
    )
    expect(distant.etat.listes[0]?.sorts).toEqual(['a', 'b', 'c'])
  })

  it('sépare les listes enterrées des vivantes', () => {
    const distant = versEtat(
      [ligne('l1'), ligne('l2', '2026-08-01T00:00:00.000Z', '2026-08-05T00:00:00.000Z')],
      [sort('l1', 'a', 0)],
    )
    expect(distant.etat.listes.map((l) => l.id_liste)).toEqual(['l1'])
    expect(distant.supprimees.get('l2')).toBe('2026-08-05T00:00:00.000Z')
  })

  it('ne porte aucune liste active : la sélection appartient à l’appareil', () => {
    expect(versEtat([ligne('l1')], []).etat.liste_active).toBeNull()
  })

  it('accepte un nom et des dates absents plutôt que d’écarter la liste', () => {
    const distant = versEtat(
      [
        {
          id_liste: 'l1',
          nom: null,
          cree_le: null,
          modifie_le: null,
          supprime_le: null,
          personnage_id: null,
        },
      ],
      [],
    )
    expect(distant.etat.listes[0]).toEqual({
      id_liste: 'l1',
      nom: '',
      cree_le: '',
      modifie_le: '',
      sorts: [],
      personnage_id: null,
    })
  })
})

describe('versLignes', () => {
  it('renvoie les horodatages vides en null, que la colonne timestamptz accepte', () => {
    const { listes } = versLignes(etat([liste('l1', [], '', 'Ma liste', '')]), 'u1')
    expect(listes[0]?.modifie_le).toBeNull()
    expect(listes[0]?.cree_le).toBeNull()
  })

  it('numérote les positions dans l’ordre d’insertion et n’enterre jamais', () => {
    const { listes, sorts } = versLignes(etat([liste('l1', ['a', 'b'])]), 'u1')
    expect(sorts).toEqual([
      { user_id: 'u1', id_liste: 'l1', spell_id: 'a', position: 0 },
      { user_id: 'u1', id_liste: 'l1', spell_id: 'b', position: 1 },
    ])
    expect(listes[0]?.supprime_le).toBeNull()
  })
})

describe('fusionner — rien ne se perd', () => {
  it('reçoit les listes que seul le compte possède', () => {
    const distant = versEtat([ligne('l1')], [sort('l1', 'a', 0), sort('l1', 'b', 1)])
    const rapport = fusionner(VIDE, distant)
    expect(rapport.etat.listes.map((l) => l.id_liste)).toEqual(['l1'])
    expect(rapport.listes_recues).toBe(1)
    expect(rapport.sorts_recus).toBe(2)
  })

  it('garde les listes que seul ce navigateur possède', () => {
    const rapport = fusionner(etat([liste('l1', ['a'])]), versEtat([], []))
    expect(rapport.etat.listes[0]?.sorts).toEqual(['a'])
    expect(fusionMuette(rapport)).toBe(true)
  })

  it('unit les sorts d’une liste présente des deux côtés — aucun favori n’est arbitré', () => {
    // Le cas qui condamne un dernier-écrit-gagnant sur la liste entière : `a` a été
    // ajouté ici, `b` ailleurs, et les deux doivent survivre.
    const local = etat([liste('l1', ['a'], '2026-08-10T00:00:00.000Z')])
    const distant = versEtat([ligne('l1', '2026-08-09T00:00:00.000Z')], [sort('l1', 'b', 0)])
    const rapport = fusionner(local, distant)
    expect(rapport.etat.listes[0]?.sorts).toEqual(['a', 'b'])
    expect(rapport.sorts_recus).toBe(1)
    expect(rapport.listes_fusionnees).toBe(1)
  })

  it('ne duplique pas un sort que les deux côtés connaissent déjà', () => {
    const local = etat([liste('l1', ['a', 'b'])])
    const distant = versEtat([ligne('l1')], [sort('l1', 'b', 0), sort('l1', 'a', 1)])
    const rapport = fusionner(local, distant)
    expect(rapport.etat.listes[0]?.sorts).toEqual(['a', 'b'])
    expect(fusionMuette(rapport)).toBe(true)
  })

  it('laisse le renommage au côté strictement plus récent', () => {
    const local = etat([liste('l1', [], '2026-08-01T00:00:00.000Z', 'ancien nom')])
    const distant = versEtat([ligne('l1', '2026-08-02T00:00:00.000Z', null, 'nouveau nom')], [])
    expect(fusionner(local, distant).etat.listes[0]?.nom).toBe('nouveau nom')
  })

  it('à égalité de date, garde le nom de l’appareil en main', () => {
    const local = etat([liste('l1', [], '2026-08-01T00:00:00.000Z', 'ici')])
    const distant = versEtat([ligne('l1', '2026-08-01T00:00:00.000Z', null, 'ailleurs')], [])
    expect(fusionner(local, distant).etat.listes[0]?.nom).toBe('ici')
  })

  it('garde la date de création la plus ancienne des deux', () => {
    const local = etat([liste('l1', [], '2026-08-01T00:00:00.000Z', 'l1', '2026-05-01T00:00:00.000Z')])
    const distant = versEtat(
      [{ ...ligne('l1'), cree_le: '2026-02-01T00:00:00.000Z' }],
      [],
    )
    expect(fusionner(local, distant).etat.listes[0]?.cree_le).toBe('2026-02-01T00:00:00.000Z')
  })

  it('laisse l’assignation de personnage au côté strictement plus récent, comme le nom', () => {
    const local = etat([liste('l1', [], '2026-08-01T00:00:00.000Z', 'l1', undefined, 'perso-local')])
    const distant = versEtat(
      [{ ...ligne('l1', '2026-08-02T00:00:00.000Z'), personnage_id: 'perso-distant' }],
      [],
    )
    expect(fusionner(local, distant).etat.listes[0]?.personnage_id).toBe('perso-distant')
  })
})

describe('fusionner — les suppressions voyagent', () => {
  it('retire ici une liste supprimée ailleurs après sa dernière modification locale', () => {
    const local = etat([liste('l1', ['a'], '2026-08-01T00:00:00.000Z')])
    const distant = versEtat([ligne('l1', '2026-08-01T00:00:00.000Z', '2026-08-05T00:00:00.000Z')], [])
    const rapport = fusionner(local, distant)
    expect(rapport.etat.listes).toEqual([])
    expect(rapport.listes_supprimees).toBe(1)
  })

  it('ressuscite une liste modifiée ici après la suppression : l’édition est un choix', () => {
    const local = etat([liste('l1', ['a'], '2026-08-10T00:00:00.000Z')])
    const distant = versEtat([ligne('l1', null, '2026-08-05T00:00:00.000Z')], [])
    const rapport = fusionner(local, distant)
    expect(rapport.etat.listes.map((l) => l.id_liste)).toEqual(['l1'])
    expect(rapport.listes_supprimees).toBe(0)
  })

  it('une liste sans date locale ne résiste pas à une suppression datée', () => {
    // `instant('')` vaut 0, donc l'enterrement gagne. C'est le sens voulu : une
    // liste sans horodatage ne peut pas prétendre avoir été touchée récemment.
    const local = etat([liste('l1', ['a'], '')])
    const distant = versEtat([ligne('l1', null, '2026-08-05T00:00:00.000Z')], [])
    expect(fusionner(local, distant).etat.listes).toEqual([])
  })
})

describe('fusionner — la sélection reste locale', () => {
  it('ne déplace pas une liste active toujours présente', () => {
    const local = etat([liste('l1', []), liste('l2', [])], 'l2')
    const distant = versEtat([ligne('l1'), ligne('l3')], [])
    expect(fusionner(local, distant).etat.liste_active).toBe('l2')
  })

  it('comble le trou quand la liste active vient d’être supprimée ailleurs', () => {
    const local = etat([liste('l1', []), liste('l2', [])], 'l2')
    const distant = versEtat([ligne('l2', null, '2026-08-05T00:00:00.000Z')], [])
    const rapport = fusionner(local, distant)
    expect(rapport.etat.listes.map((l) => l.id_liste)).toEqual(['l1'])
    expect(rapport.etat.liste_active).toBe('l1')
  })

  it('active une liste reçue quand ce navigateur n’en avait aucune', () => {
    const rapport = fusionner(VIDE, versEtat([ligne('l1')], []))
    expect(rapport.etat.liste_active).toBe('l1')
  })
})

describe('listesDisparues', () => {
  it('ne signale que ce qui était là au dernier envoi et n’y est plus', () => {
    const avant = etat([liste('l1', []), liste('l2', [])])
    const apres = etat([liste('l1', []), liste('l3', [])])
    expect(listesDisparues(avant, apres)).toEqual(['l2'])
  })

  it('ne signale rien quand une liste est seulement ajoutée', () => {
    expect(listesDisparues(etat([liste('l1', [])]), etat([liste('l1', []), liste('l2', [])]))).toEqual([])
  })
})
