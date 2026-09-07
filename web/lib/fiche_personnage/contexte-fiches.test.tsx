/**
 * The context contract: `useFiches()` throws outside its provider, and the
 * provider itself surfaces what the store already guarantees (chargement,
 * illisibles) rather than reimplementing it.
 */

import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FournisseurFiches, useFiches } from './contexte-fiches'
import { PREFIXE } from './magasin'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
})

function Sonde() {
  const { chargement, fiches } = useFiches()
  return <p data-testid="etat">{chargement ? 'chargement' : `pret:${fiches.length}`}</p>
}

describe('useFiches', () => {
  it('lève hors de FournisseurFiches', () => {
    // React logs the error to the console; the throw itself is what matters.
    const consoleErreur = console.error
    console.error = () => {}
    expect(() => render(<Sonde />)).toThrow('useFiches hors de FournisseurFiches')
    console.error = consoleErreur
  })
})

describe('FournisseurFiches', () => {
  it('charge la liste des fiches existantes au montage', async () => {
    window.localStorage.setItem(
      `${PREFIXE}a`,
      JSON.stringify({
        schemaVersion: 1,
        id: 'a',
        personnageId: null,
        meta: { nomPersonnage: '', nomJoueur: '', creeLe: '2026-01-01T00:00:00.000Z', modifieLe: '2026-01-01T00:00:00.000Z' },
        identite: { race: null, classes: [], alignement: '', divinite: '', taille: '', langues: [] },
        caracteristiques: {
          force: { base: null, modificateurs: [] },
          dexterite: { base: null, modificateurs: [] },
          constitution: { base: null, modificateurs: [] },
          intelligence: { base: null, modificateurs: [] },
          sagesse: { base: null, modificateurs: [] },
          charisme: { base: null, modificateurs: [] },
        },
        combat: { bbaBase: null, pvMax: null, vitesseBase: null, resistanceMagie: null },
        defense: { armure: null, bouclier: null, modificateursCA: [] },
        sauvegardes: {
          reflexes: { base: null, modificateurs: [] },
          vigueur: { base: null, modificateurs: [] },
          volonte: { base: null, modificateurs: [] },
        },
        attaques: [],
        competences: [],
        dons: [],
        aptitudes: [],
        sorts: { mode: null, caracteristiqueIncantation: null, niveauLanceur: null, emplacementsParNiveau: [], sortsConnus: [], sortsPrepares: [] },
        equipement: [],
        notes: '',
      }),
    )

    const { getByTestId } = render(
      <FournisseurFiches>
        <Sonde />
      </FournisseurFiches>,
    )

    await waitFor(() => {
      expect(getByTestId('etat').textContent).toBe('pret:1')
    })
  })
})
