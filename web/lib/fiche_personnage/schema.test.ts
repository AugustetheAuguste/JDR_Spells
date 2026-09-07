/**
 * Aucune fonction de calcul à tester ici, le schéma n'en porte aucune. Le
 * contrat vérifié est celui de `creerFicheVide`, cf. `fiche-vide.test.ts` en
 * complément. Ce fichier couvre la forme de l'arbre produit, sans zéro.
 */
import { describe, expect, it } from 'vitest'

import { creerFicheVide } from './fiche-vide'
import { VERSION_SCHEMA } from './schema'

function parcourirEtRefuserZero(valeur: unknown, chemin: string): void {
  if (typeof valeur === 'number') {
    expect(valeur, `zéro trouvé en ${chemin}`).not.toBe(0)
    return
  }
  if (Array.isArray(valeur)) {
    valeur.forEach((element, index) => parcourirEtRefuserZero(element, `${chemin}[${index}]`))
    return
  }
  if (typeof valeur === 'object' && valeur !== null) {
    for (const [cle, sousValeur] of Object.entries(valeur)) {
      parcourirEtRefuserZero(sousValeur, chemin === '' ? cle : `${chemin}.${cle}`)
    }
  }
}

describe('creerFicheVide, absence de zéro', () => {
  it('ne produit aucun zéro nulle part dans l’arbre', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    parcourirEtRefuserZero(fiche, '')
  })

  it('porte la version courante du schéma', () => {
    const fiche = creerFicheVide('fiche-test', '2026-09-07T00:00:00.000Z')
    expect(fiche.schemaVersion).toBe(VERSION_SCHEMA)
  })
})
