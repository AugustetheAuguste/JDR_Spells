import { describe, expect, it } from 'vitest'

import { fusionner } from '@/lib/fiche_personnage/fusion'
import { creerFicheVide } from '@/lib/fiche_personnage/fiche-vide'
import { VERSION_SCHEMA } from '@/lib/fiche_personnage/schema'

import type { LigneFiche } from '@/lib/fiche_personnage/distant'
import type { Fiche } from '@/lib/fiche_personnage/schema'

const MAINTENANT = new Date('2026-09-07T12:00:00.000Z')

function ligneDepuis(fiche: Fiche, partiel: Partial<LigneFiche> = {}): LigneFiche {
  return {
    id_fiche: fiche.id,
    schema_version: fiche.schemaVersion,
    contenu: fiche as unknown as Record<string, unknown>,
    nom: fiche.meta.nomPersonnage,
    cree_le: fiche.meta.creeLe,
    modifie_le: fiche.meta.modifieLe,
    supprime_le: null,
    personnage_id: fiche.personnageId,
    ...partiel,
  }
}

describe('fusionner', () => {
  it('une fiche locale seule part vers le distant, sans question', () => {
    const locale = creerFicheVide('f1', '2026-09-01T00:00:00.000Z')
    const rapport = fusionner([locale], [], MAINTENANT)
    expect(rapport.aEcrireEnDistant).toHaveLength(1)
    expect(rapport.aEcrireEnDistant[0]!.id_fiche).toBe('f1')
    expect(rapport.aEcrireEnLocal).toEqual([])
    expect(rapport.conflits).toEqual([])
    expect(rapport.ignorees).toEqual([])
  })

  it('une fiche distante seule part vers le local, sans question', () => {
    const distante = creerFicheVide('f2', '2026-09-01T00:00:00.000Z')
    const rapport = fusionner([], [ligneDepuis(distante)], MAINTENANT)
    expect(rapport.aEcrireEnLocal).toHaveLength(1)
    expect(rapport.aEcrireEnLocal[0]!.id).toBe('f2')
    expect(rapport.aEcrireEnDistant).toEqual([])
  })

  it('même contenu des deux côtés, rien à faire', () => {
    const fiche = creerFicheVide('f3', '2026-09-01T00:00:00.000Z')
    const rapport = fusionner([fiche], [ligneDepuis(fiche)], MAINTENANT)
    expect(rapport.aEcrireEnLocal).toEqual([])
    expect(rapport.aEcrireEnDistant).toEqual([])
    expect(rapport.conflits).toEqual([])
    expect(rapport.ignorees).toEqual([])
  })

  it('deux contenus différents produisent un conflit et zéro écriture des deux côtés', () => {
    const locale: Fiche = {
      ...creerFicheVide('f4', '2026-09-01T00:00:00.000Z'),
      notes: 'note locale',
    }
    const distanteFiche: Fiche = {
      ...creerFicheVide('f4', '2026-09-01T00:00:00.000Z'),
      notes: 'note distante',
    }
    const rapport = fusionner([locale], [ligneDepuis(distanteFiche)], MAINTENANT)
    expect(rapport.conflits).toHaveLength(1)
    expect(rapport.conflits[0]!.id).toBe('f4')
    expect(rapport.aEcrireEnLocal).toEqual([])
    expect(rapport.aEcrireEnDistant).toEqual([])
  })

  it('une fiche locale modifiée après un supprime_le distant survit et repart en distant', () => {
    const locale: Fiche = {
      ...creerFicheVide('f5', '2026-09-01T00:00:00.000Z'),
      meta: {
        nomPersonnage: 'Survivante',
        nomJoueur: '',
        creeLe: '2026-09-01T00:00:00.000Z',
        modifieLe: '2026-09-05T00:00:00.000Z',
      },
    }
    const ligne = ligneDepuis(locale, { supprime_le: '2026-09-03T00:00:00.000Z' })
    const rapport = fusionner([locale], [ligne], MAINTENANT)
    expect(rapport.aSupprimerLocalement).toEqual([])
    expect(rapport.aEcrireEnDistant).toHaveLength(1)
    expect(rapport.aEcrireEnDistant[0]!.id_fiche).toBe('f5')
    expect(rapport.aEcrireEnDistant[0]!.supprime_le).toBeNull()
  })

  it('une suppression distante plus récente que la dernière modification locale l’emporte', () => {
    const locale: Fiche = {
      ...creerFicheVide('f6', '2026-09-01T00:00:00.000Z'),
      meta: {
        nomPersonnage: 'Effacée',
        nomJoueur: '',
        creeLe: '2026-09-01T00:00:00.000Z',
        modifieLe: '2026-09-01T00:00:00.000Z',
      },
    }
    const ligne = ligneDepuis(locale, { supprime_le: '2026-09-03T00:00:00.000Z' })
    const rapport = fusionner([locale], [ligne], MAINTENANT)
    expect(rapport.aSupprimerLocalement).toEqual(['f6'])
    expect(rapport.aEcrireEnDistant).toEqual([])
  })

  it('une fiche distante de schema_version supérieure est ignorée, jamais écrasée', () => {
    const distante = creerFicheVide('f7', '2026-09-01T00:00:00.000Z')
    const ligne = ligneDepuis(distante, { schema_version: VERSION_SCHEMA + 1 })
    const rapport = fusionner([], [ligne], MAINTENANT)
    expect(rapport.aEcrireEnLocal).toEqual([])
    expect(rapport.ignorees).toHaveLength(1)
    expect(rapport.ignorees[0]!.id).toBe('f7')
    expect(rapport.ignorees[0]!.motif).toMatch(/mettez à jour/i)
  })

  it('une fiche distante de schema_version supérieure, aussi connue localement, est ignorée sans écraser le local', () => {
    const locale = creerFicheVide('f7b', '2026-09-01T00:00:00.000Z')
    const ligne = ligneDepuis(locale, { schema_version: VERSION_SCHEMA + 1 })
    const rapport = fusionner([locale], [ligne], MAINTENANT)
    expect(rapport.aEcrireEnLocal).toEqual([])
    expect(rapport.aEcrireEnDistant).toEqual([])
    expect(rapport.ignorees).toHaveLength(1)
  })

  it('une fiche distante dont migrer() échoue est ignorée, rapportée, rien écrasé', () => {
    const ligne: LigneFiche = {
      id_fiche: 'f8',
      schema_version: 1,
      contenu: { schemaVersion: 1 }, // objet incomplet, valider() la refusera
      nom: null,
      cree_le: null,
      modifie_le: null,
      supprime_le: null,
      personnage_id: null,
    }
    const rapport = fusionner([], [ligne], MAINTENANT)
    expect(rapport.aEcrireEnLocal).toEqual([])
    expect(rapport.ignorees).toHaveLength(1)
    expect(rapport.ignorees[0]!.id).toBe('f8')
  })
})
