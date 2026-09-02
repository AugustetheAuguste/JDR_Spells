/**
 * `VueArbre` without Cytoscape available — its own file because `vi.mock`
 * is file-scoped and static: this is the ONE test file where the mocked
 * `cytoscape` module fails to load, simulating the browser (or bundle) that
 * does not carry it. `VueArbre.test.tsx` covers the working path.
 */
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import type { IndexDons } from '@/lib/donnees/index-web-dons'
import { FILTRES_DONS_VIDES, type EntreeDon } from '@/lib/recherche/filtres'

vi.mock('cytoscape', () => {
  throw new Error('cytoscape est absent de ce bundle')
})

const RACINE = process.cwd()
const MOTEUR = JSON.parse(readFileSync(join(RACINE, 'public', 'data', 'dons', 'moteur.json'), 'utf8'))
const INDEX = JSON.parse(readFileSync(join(RACINE, 'public', 'data', 'dons', 'index.json'), 'utf8')) as IndexDons

const { VueArbre } = await import('./VueArbre')

function entree(id: string): EntreeDon {
  return {
    id,
    effet: null,
    effets2: [],
    cibles: [],
    contextes: [],
    activation: null,
    polyvalence: null,
    categories: [],
    cout: null,
    statut: 'eligible',
    texte: id,
  }
}

describe('VueArbre sans Cytoscape', () => {
  it('affiche un message explicite et ne plante jamais', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => MOTEUR })),
    )
    render(
      <VueArbre
        entrees={[entree('expertise-du-combat'), entree('aide-rapide')]}
        filtres={FILTRES_DONS_VIDES}
        index={INDEX}
        surRetourListe={() => {}}
      />,
    )
    await screen.findByText(/n’est pas disponible dans ce navigateur/)
    expect(screen.queryByTestId('canevas-cytoscape')).toBeNull()
    vi.unstubAllGlobals()
  })
})
