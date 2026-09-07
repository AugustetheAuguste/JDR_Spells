/**
 * Export/import contract: a pure filename and a pure payload on one side, an
 * import that never overwrites silently on the other.
 */

import { describe, expect, it } from 'vitest'

import { creerFicheVide } from './fiche-vide'
import { cle, cleSecours, ecrire, lire } from './magasin'
import { exporter, importer, nomFichier } from './echange'
import type { Fiche } from './schema'

const T0 = '2026-07-31T10:00:00.000Z'

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

function ficheAvecClasses(id: string): Fiche {
  const vide = creerFicheVide(id, T0)
  return {
    ...vide,
    meta: { ...vide.meta, nomPersonnage: 'Elara Cœur-de-Lune' },
    identite: {
      ...vide.identite,
      classes: [{ nom: 'Magicien', niveau: 3, archetype: null, source: 'pathfinder-fr', ref: null }],
    },
  }
}

describe('nomFichier', () => {
  it('produit <nom>-<classe>-<niveau>.json', () => {
    const fiche = ficheAvecClasses('a')
    expect(nomFichier(fiche)).toBe('elara-coeur-de-lune-magicien-3.json')
  })

  it('retire diacritiques et ligatures (oe et accent)', () => {
    const vide = creerFicheVide('a', T0)
    const avecAccent: Fiche = { ...vide, meta: { ...vide.meta, nomPersonnage: 'Éowyn' } }
    expect(nomFichier(avecAccent)).toContain('eowyn')

    const avecLigature: Fiche = { ...vide, meta: { ...vide.meta, nomPersonnage: 'Cœlia' } }
    expect(nomFichier(avecLigature)).toContain('coelia')
  })

  it('un nom vide produit un nom de repli, jamais seulement .json', () => {
    const vide = creerFicheVide('a', T0)
    const fichier = nomFichier(vide)
    expect(fichier).not.toBe('.json')
    expect(fichier.endsWith('.json')).toBe(true)
    expect(fichier.length).toBeGreaterThan('.json'.length)
  })

  it('classe et niveau absents rendent un mot de repli lisible', () => {
    const vide = creerFicheVide('a', T0)
    const avecNom: Fiche = { ...vide, meta: { ...vide.meta, nomPersonnage: 'Sans-classe' } }
    expect(nomFichier(avecNom)).toBe('sans-classe-sans-classe-sans-niveau.json')
  })
})

describe('exporter', () => {
  it('rend un contenu JSON indenté, sans déclencher de téléchargement', () => {
    const fiche = ficheAvecClasses('a')
    const { nom, contenu } = exporter(fiche)
    expect(nom).toBe(nomFichier(fiche))
    expect(contenu.endsWith('\n')).toBe(true)
    expect(JSON.parse(contenu)).toEqual(fiche)
  })
})

describe('importer', () => {
  it('refuse un JSON invalide en nommant la position, sans rien écrire', () => {
    const stockage = stockageFaux()
    const resultat = importer(stockage, '{ pas du json')
    expect(resultat.ok).toBe(false)
    expect(stockage.length).toBe(0)
  })

  it('rend tous les refus sur une fiche invalide, sans rien écrire', () => {
    const stockage = stockageFaux()
    const texte = JSON.stringify({ schemaVersion: 1, id: 42 })
    const resultat = importer(stockage, texte)
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.motifs.length).toBeGreaterThan(0)
    expect(stockage.length).toBe(0)
  })

  it('écrase un identifiant existant après avoir écrit sa copie de secours, et le signale', () => {
    const stockage = stockageFaux()
    const existante = creerFicheVide('a', T0)
    ecrire(stockage, existante)
    const octetsAvant = stockage.getItem(cle('a'))

    const entrante = ficheAvecClasses('a')
    const resultat = importer(stockage, JSON.stringify(entrante))
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.ecrase).toBe(true)
    expect(stockage.getItem(cleSecours('a'))).toBe(octetsAvant)
    expect(lire(stockage, 'a')?.meta.nomPersonnage).toBe('Elara Cœur-de-Lune')
  })

  it('importe sous un nouvel identifiant plutôt que d’écraser, sur demande', () => {
    const stockage = stockageFaux()
    const existante = creerFicheVide('a', T0)
    ecrire(stockage, existante)

    const entrante = ficheAvecClasses('a')
    const resultat = importer(stockage, JSON.stringify(entrante), 'b')
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.ecrase).toBe(false)
    expect(resultat.fiche.id).toBe('b')
    expect(lire(stockage, 'a')?.meta.nomPersonnage).toBe('')
  })
})
