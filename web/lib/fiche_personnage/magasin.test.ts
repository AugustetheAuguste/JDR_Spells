/**
 * The store contract, tested with a hand-rolled `Storage` so the corruption
 * and quota paths are exercised rather than assumed — same technique as
 * `web/lib/favoris/stockage.test.ts`.
 *
 * One theme runs through this file: writing sheet B must never touch sheet
 * A's bytes, and a delete must always be recoverable before it happens.
 */

import { describe, expect, it } from 'vitest'

import { cle, cleSecours, creer, dupliquer, ecrire, lire, lister, restaurerSecours, supprimer } from './magasin'

const T0 = '2026-07-31T10:00:00.000Z'
const T1 = '2026-07-31T11:00:00.000Z'
const T2 = '2026-07-31T12:00:00.000Z'

function stockageFaux(initial: Record<string, string> = {}): Storage {
  const donnees = new Map(Object.entries(initial))
  return {
    get length() {
      return donnees.size
    },
    clear: () => donnees.clear(),
    getItem: (c: string) => donnees.get(c) ?? null,
    key: (indice: number) => [...donnees.keys()][indice] ?? null,
    removeItem: (c: string) => donnees.delete(c),
    setItem: (c: string, valeur: string) => {
      donnees.set(c, valeur)
    },
  } as Storage
}

function stockageQuiRefuseLecriture(): Storage {
  const stockage = stockageFaux()
  return {
    ...stockage,
    setItem: () => {
      throw new Error('quota exceeded')
    },
  } as Storage
}

describe('creer / lire / ecrire', () => {
  it('écrit une fiche sous sa propre clé, sans toucher aux autres', () => {
    const stockage = stockageFaux()
    const a = creer(stockage, 'a', T0)
    const b = creer(stockage, 'b', T0)
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)

    const ficheA = lire(stockage, 'a')
    if (ficheA === null) throw new Error('fiche a introuvable')
    const modifiee = { ...ficheA, meta: { ...ficheA.meta, nomPersonnage: 'Elara', modifieLe: T1 } }
    const clesAvant = new Set<string>()
    for (let i = 0; i < stockage.length; i += 1) {
      const c = stockage.key(i)
      if (c !== null) clesAvant.add(c)
    }

    const octetsBAvant = stockage.getItem(cle('b'))
    ecrire(stockage, modifiee)

    // La clé de B est inchangée, au caractère près.
    expect(stockage.getItem(cle('b'))).toBe(octetsBAvant)
    const ficheB = lire(stockage, 'b')
    expect(ficheB?.meta.nomPersonnage).toBe('')

    // Aucune clé nouvelle n'est apparue, hormis celles déjà connues.
    const clesApres = new Set<string>()
    for (let i = 0; i < stockage.length; i += 1) {
      const c = stockage.key(i)
      if (c !== null) clesApres.add(c)
    }
    expect(clesApres).toEqual(clesAvant)
  })

  it('refuse une écriture invalide sans rien écrire', () => {
    const stockage = stockageFaux()
    const invalide = { id: 'x' } as unknown
    const resultat = ecrire(stockage, invalide as never)
    expect(resultat.ok).toBe(false)
    expect(stockage.getItem(cle('x'))).toBeNull()
  })

  it('rend un résultat en échec, sans lever, quand le stockage refuse', () => {
    const stockage = stockageQuiRefuseLecriture()
    const resultat = creer(stockage, 'a', T0)
    expect(resultat.ok).toBe(false)
  })
})

describe('lister', () => {
  it('trie par meta.modifieLe décroissant et ignore les clés de secours', () => {
    const stockage = stockageFaux()
    creer(stockage, 'ancienne', T0)
    creer(stockage, 'recente', T0)
    const recente = lire(stockage, 'recente')
    if (recente === null) throw new Error('introuvable')
    ecrire(stockage, { ...recente, meta: { ...recente.meta, modifieLe: T2 } })
    stockage.setItem(cleSecours('fantome'), 'ne doit jamais apparaître')

    const { fiches } = lister(stockage)
    expect(fiches.map((f) => f.id)).toEqual(['recente', 'ancienne'])
  })

  it('rapporte une valeur illisible sans la supprimer ni la réparer', () => {
    const stockage = stockageFaux({ [cle('cassee')]: '{ ceci n est pas du json' })
    const { fiches, illisibles } = lister(stockage)
    expect(fiches).toEqual([])
    expect(illisibles).toHaveLength(1)
    expect(illisibles[0]?.cle).toBe(cle('cassee'))
    expect(stockage.getItem(cle('cassee'))).toBe('{ ceci n est pas du json')
  })
})

describe('supprimer / restaurerSecours', () => {
  it('écrit la copie de secours avant de retirer la clé, et restaure les mêmes octets', () => {
    const stockage = stockageFaux()
    creer(stockage, 'a', T0)
    const octetsAvant = stockage.getItem(cle('a'))

    const resultat = supprimer(stockage, 'a')
    expect(resultat.ok).toBe(true)
    expect(stockage.getItem(cle('a'))).toBeNull()
    expect(stockage.getItem(cleSecours('a'))).toBe(octetsAvant)

    const restauration = restaurerSecours(stockage, 'a')
    expect(restauration.ok).toBe(true)
    expect(stockage.getItem(cle('a'))).toBe(octetsAvant)
  })

  it('refuse de restaurer sans copie de secours', () => {
    const stockage = stockageFaux()
    const resultat = restaurerSecours(stockage, 'jamais-supprimee')
    expect(resultat.ok).toBe(false)
  })
})

describe('dupliquer', () => {
  it('copie la fiche sous un nouvel identifiant avec un marqueur dans le nom', () => {
    const stockage = stockageFaux()
    creer(stockage, 'a', T0)
    const originale = lire(stockage, 'a')
    if (originale === null) throw new Error('introuvable')
    ecrire(stockage, { ...originale, meta: { ...originale.meta, nomPersonnage: 'Elara' } })

    const resultat = dupliquer(stockage, 'a', 'a-copie', T1)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.fiche.id).toBe('a-copie')
    expect(resultat.fiche.meta.nomPersonnage).toContain('Elara')
    expect(resultat.fiche.meta.nomPersonnage).not.toBe('Elara')
    expect(lire(stockage, 'a')?.meta.nomPersonnage).toBe('Elara')
  })
})
