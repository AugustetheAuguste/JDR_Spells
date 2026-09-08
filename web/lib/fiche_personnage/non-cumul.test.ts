/**
 * La règle de non cumul, éprouvée sur les types réellement présents dans
 * `web/public/data/regles/types_bonus.json` — jamais une liste recopiée à la
 * main (critère de vérification n°6 du plan de l'étape 12).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { chargerRegles, type LecteurTable, type TypeBonus } from './regles'
import { resoudre } from './resoudre'
import type { Modificateur } from './schema'

const REGLES_DIR = join(process.cwd(), 'public', 'data', 'regles')
const lecteurReel: LecteurTable = (nomFichier) => {
  try {
    return readFileSync(join(REGLES_DIR, nomFichier), 'utf8')
  } catch {
    return null
  }
}

function modificateur(type: string, valeur: number, libelle: string): Modificateur {
  return { libelle, valeur, type, origine: 'test', sourceUrl: null, saisieManuelle: true }
}

describe('resoudre, non cumul', () => {
  it('types_bonus.json est chargeable et non vide', async () => {
    const tables = await chargerRegles(lecteurReel)
    expect(tables.typesBonus).not.toBeNull()
    expect((tables.typesBonus as readonly TypeBonus[]).length).toBeGreaterThan(0)
  })

  it('un type inconnu de la table retient tout et le déclare manquant', () => {
    const resultat = resoudre([modificateur('type_inexistant', 3, 'a'), modificateur('type_inexistant', 5, 'b')], [])
    expect(resultat.detail.every((c) => c.retenue)).toBe(true)
    expect(resultat.manquants).toContain('type_inexistant')
  })

  it('un type dont cumulable vaut null retient tout et le déclare manquant', () => {
    const typesBonus: readonly TypeBonus[] = [{ cle: 'indecis', libelle: 'Indécis', cumulable: null, note: '' }]
    const resultat = resoudre([modificateur('indecis', 3, 'a'), modificateur('indecis', 5, 'b')], typesBonus)
    expect(resultat.detail.every((c) => c.retenue)).toBe(true)
    expect(resultat.manquants).toContain('indecis')
  })

  it('types_bonus.json ne porte que des types cumulable=true ou null, jamais false : le cas false est éprouvé synthétiquement ci-dessous', async () => {
    const tables = await chargerRegles(lecteurReel)
    const typesBonus = tables.typesBonus as readonly TypeBonus[]
    // Constat, pas une assertion de règle : documente pourquoi ce test ne
    // peut pas parcourir un cas `cumulable: false` réel de la table publiée.
    expect(typesBonus.some((t) => t.cumulable === false)).toBe(false)
  })

  const brutTypesBonus = JSON.parse(readFileSync(join(REGLES_DIR, 'types_bonus.json'), 'utf8')) as {
    readonly donnees: { readonly types: readonly TypeBonus[] }
  }
  const TYPES_REELS = brutTypesBonus.donnees.types

  describe.each(TYPES_REELS.map((t) => [t] as const))('type réel %o', (type: TypeBonus) => {
      it('cumulable=true : tous les bonus du même type sont retenus', () => {
        if (type.cumulable !== true) return
        const resultat = resoudre([modificateur(type.cle, 2, 'a'), modificateur(type.cle, 3, 'b')], [type])
        expect(resultat.detail.every((c) => c.retenue)).toBe(true)
        expect(resultat.total).toBe(5)
      })

      it('cumulable=false : seul le meilleur bonus et le pire malus sont retenus', () => {
        if (type.cumulable !== false) return
        const resultat = resoudre(
          [modificateur(type.cle, 2, 'petit'), modificateur(type.cle, 5, 'grand'), modificateur(type.cle, -3, 'malus')],
          [type],
        )
        const retenus = resultat.detail.filter((c) => c.retenue)
        expect(retenus.map((c) => c.libelle).sort()).toEqual(['grand', 'malus'].sort())
        const ecarte = resultat.detail.find((c) => c.libelle === 'petit')
        expect(ecarte?.retenue).toBe(false)
        expect(ecarte?.motifEcart).not.toBeNull()
        expect(ecarte?.motifEcart).not.toBe('')
      })

      it('cumulable=null : tout est retenu et le type figure dans manquants', () => {
        if (type.cumulable !== null) return
        const resultat = resoudre([modificateur(type.cle, 2, 'a'), modificateur(type.cle, 3, 'b')], [type])
        expect(resultat.detail.every((c) => c.retenue)).toBe(true)
        expect(resultat.manquants).toContain(type.cle)
      })
    },
  )
})
