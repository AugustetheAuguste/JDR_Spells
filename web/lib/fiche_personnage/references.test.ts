/**
 * Les quatre personnages de référence — cf.
 * `build/fiche_personnage/12_PERSONNAGES_REFERENCE.md`.
 *
 * Ces tests chargent les VRAIES tables de règles publiées sous
 * `web/public/data/regles/`, jamais une fixture de substitution : le but est
 * de vérifier le moteur contre les données réellement publiées. Les valeurs
 * attendues (`attendus.json`) ont chacune été vérifiées à la main contre
 * pathfinder-fr.org ou contre une table de règles déjà sourcée du dépôt ;
 * une valeur non vérifiable est absente de ce fichier et déclarée en lacune
 * assumée dans `build/fiche_personnage/reports/12_PERSONNAGES_REFERENCE_report.md`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

import { chargerRegles, type LecteurTable, type TablesRegles } from './regles'
import { valider } from './valider'
import { classeArmure, vitesse } from './defense'
import { initiative, manoeuvreOffensive, manoeuvreDefensive } from './combat'
import { sauvegarde } from './sauvegardes'
import { serieAttaques, attaquesCompletes } from './attaques'
import { emplacementsTotaux, degreDeDifficulte } from './sorts'
import type { Fiche, Sauvegarde } from './schema'

const REGLES_DIR = join(process.cwd(), 'public', 'data', 'regles')

const lecteurReel: LecteurTable = (nomFichier) => {
  try {
    return readFileSync(join(REGLES_DIR, nomFichier), 'utf8')
  } catch {
    return null
  }
}

const FIXTURES_DIR = join(process.cwd(), 'fixtures', 'fiche_personnage')

function chargerFixture(id: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, `${id}.json`), 'utf8'))
}

const attendus = JSON.parse(readFileSync(join(FIXTURES_DIR, 'attendus.json'), 'utf8')) as Record<
  string,
  {
    classeArmure: { totale: number; contact: number; prisAuDepourvu: number }
    initiative: number
    manoeuvreOffensive: number | null
    manoeuvreDefensive: number | null
    sauvegardes: Record<Sauvegarde, number | null>
    serieAttaques: readonly (number | null)[]
    attaques: readonly { nom: string; bonus: readonly number[]; degats: number }[]
    vitesse: number
    emplacements: Record<string, number | null> | null
    degresDeDifficulte: Record<string, number> | null
  }
>

const PERSONNAGES = ['guerrier-lourd', 'roublard', 'magicien', 'moine'] as const

/** N'importe quelle contribution écartée doit porter un motif non vide — le
 * seul endroit où ce critère (n°… du plan) est vérifié transversalement. */
function verifierMotifsEcart(resultat: { readonly detail: readonly { readonly retenue: boolean; readonly motifEcart: string | null }[] }): void {
  for (const contribution of resultat.detail) {
    if (!contribution.retenue) {
      expect(contribution.motifEcart, 'une contribution écartée sans motif').not.toBeNull()
      expect(contribution.motifEcart).not.toBe('')
    }
  }
}

describe('personnages de référence', () => {
  let tables: TablesRegles

  beforeAll(async () => {
    tables = await chargerRegles(lecteurReel)
    // Les cinq tables sont attendues présentes : une absence ferait échouer
    // silencieusement toute la suite si elle n'était pas nommée ici.
    expect(tables.typesBonus, 'types_bonus.json introuvable').not.toBeNull()
    expect(tables.modificateursCarac, 'modificateurs_caracteristiques.json introuvable').not.toBeNull()
    expect(tables.armures, 'armures.json introuvable').not.toBeNull()
    expect(tables.progressionClasses, 'progression_classes.json introuvable').not.toBeNull()
    expect(tables.sortsBonus, 'sorts_bonus.json introuvable').not.toBeNull()
  })

  for (const id of PERSONNAGES) {
    describe(id, () => {
      let fiche: Fiche
      const attendu = attendus[id]
      if (!attendu) throw new Error(`attendus.json ne porte aucune entrée pour ${id}`)

      beforeAll(() => {
        const brut = chargerFixture(id)
        const verdict = valider(brut)
        expect(verdict.ok, `${id} ne passe pas valider()`).toBe(true)
        if (!verdict.ok) throw new Error('fixture invalide')
        fiche = verdict.fiche
      })

      it('valide au sens de valider()', () => {
        expect(fiche).toBeDefined()
      })

      it('classe d’armure', () => {
        const resultat = classeArmure(fiche, tables)
        expect(resultat.totale.total).toBe(attendu.classeArmure.totale)
        expect(resultat.contact.total).toBe(attendu.classeArmure.contact)
        expect(resultat.prisAuDepourvu.total).toBe(attendu.classeArmure.prisAuDepourvu)
        expect(resultat.totale.detail.length).toBeGreaterThan(0)
        verifierMotifsEcart(resultat.totale)
        verifierMotifsEcart(resultat.contact)
        verifierMotifsEcart(resultat.prisAuDepourvu)
      })

      it('vitesse', () => {
        const resultat = vitesse(fiche, tables)
        expect(resultat.total).toBe(attendu.vitesse)
        expect(resultat.manquants).toEqual([])
      })

      it('initiative', () => {
        const resultat = initiative(fiche, tables)
        expect(resultat.total).toBe(attendu.initiative)
        expect(resultat.detail.length).toBeGreaterThan(0)
      })

      it('manœuvre offensive', () => {
        const resultat = manoeuvreOffensive(fiche, tables)
        expect(resultat.total).toBe(attendu.manoeuvreOffensive)
        if (attendu.manoeuvreOffensive === null) {
          expect(resultat.manquants.length).toBeGreaterThan(0)
        } else {
          expect(resultat.manquants).toEqual([])
        }
      })

      it('manœuvre défensive', () => {
        const resultat = manoeuvreDefensive(fiche, tables)
        expect(resultat.total).toBe(attendu.manoeuvreDefensive)
        if (attendu.manoeuvreDefensive === null) {
          expect(resultat.manquants.length).toBeGreaterThan(0)
        } else {
          expect(resultat.manquants).toEqual([])
        }
      })

      it('sauvegardes', () => {
        for (const quelle of ['reflexes', 'vigueur', 'volonte'] as const) {
          const resultat = sauvegarde(fiche, quelle, tables)
          expect(resultat.total).toBe(attendu.sauvegardes[quelle])
          verifierMotifsEcart(resultat)
        }
      })

      it('série d’attaques', () => {
        const serie = serieAttaques(fiche.combat.bbaBase, tables)
        expect(serie.map((r) => r.total)).toEqual(attendu.serieAttaques)
      })

      it('attaques complètes', () => {
        const completes = attaquesCompletes(fiche, tables)
        expect(completes.length).toBe(attendu.attaques.length)
        completes.forEach((complete, index) => {
          const attendue = attendu.attaques[index]
          expect(complete.attaque.nom).toBe(attendue.nom)
          expect(complete.bonusParAttaque.map((r) => r.total)).toEqual(attendue.bonus)
          expect(complete.degats.total).toBe(attendue.degats)
        })
      })

      it('emplacements de sorts', () => {
        if (attendu.emplacements === null) {
          // Lacune assumée ou non-lanceur : rien à vérifier terme à terme.
          return
        }
        const emplacements = emplacementsTotaux(fiche, tables)
        for (const [niveau, valeur] of Object.entries(attendu.emplacements)) {
          expect(emplacements.get(Number(niveau))?.total ?? null).toBe(valeur)
        }
      })

      it('degré de difficulté', () => {
        if (attendu.degresDeDifficulte === null) return
        for (const [niveau, valeur] of Object.entries(attendu.degresDeDifficulte)) {
          const resultat = degreDeDifficulte(fiche, Number(niveau), tables)
          expect(resultat.total).toBe(valeur)
        }
      })
    })
  }
})
