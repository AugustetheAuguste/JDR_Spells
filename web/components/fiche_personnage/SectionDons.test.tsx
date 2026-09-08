import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { creerFicheVide } from '@/lib/fiche_personnage/fiche-vide'
import type { Fiche } from '@/lib/fiche_personnage/schema'

import { SectionDons } from './SectionDons'

vi.mock('@/lib/recherche/sources-globales', () => ({
  sourceSorts: { chercher: vi.fn().mockResolvedValue([]) },
  sourceDons: { chercher: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@/lib/dons/charger-contrat', () => ({
  chargerContratMoteurDons: vi.fn().mockResolvedValue({
    tables: {
      lanceurs: {},
      maitrises: {},
      magie_des_dons: {},
      affinite_creature: {},
      restriction_de_classe: {},
      races: {},
      armes_raciales: {},
      reclassement_racial: {},
      progression_bba: {},
    },
    catalogue: new Map([
      [
        'Endurance',
        {
          brut: 'Force 20',
          effectif: 'Force 20',
          exigences: [{ type: 'ability_score', segment: 'Force 20', verif_manuelle: false, charge: { ability: 'For', min: 20 } }],
        },
      ],
    ]),
  }),
}))

function ficheAvecClasseEtDon(): Fiche {
  const base = creerFicheVide('f1', '2026-01-01T00:00:00.000Z')
  return {
    ...base,
    identite: {
      ...base.identite,
      classes: [{ nom: 'Guerrier', niveau: 1, archetype: null, source: 'pathfinder-fr', ref: 'guerrier' }],
    },
    caracteristiques: { ...base.caracteristiques, force: { base: 10, modificateurs: [] } },
    dons: [{ nom: 'Endurance', source: 'pathfinder-fr', ref: 'endurance', note: '' }],
  }
}

describe('SectionDons', () => {
  it('affiche un don ineligible avec son verdict et un bouton de détachement, jamais un bouton désactivé', async () => {
    render(<SectionDons fiche={ficheAvecClasseEtDon()} setFiche={() => {}} ouvrirLecture={() => {}} />)
    await screen.findByText('Condition non remplie')
    const bouton = screen.getByRole('button', { name: 'Détacher' })
    expect(bouton.hasAttribute('disabled')).toBe(false)
  })

  it('recalcule le verdict après un changement de la fiche', async () => {
    const ficheForte: Fiche = {
      ...ficheAvecClasseEtDon(),
      caracteristiques: {
        ...ficheAvecClasseEtDon().caracteristiques,
        force: { base: 20, modificateurs: [] },
      },
    }
    const { rerender } = render(<SectionDons fiche={ficheAvecClasseEtDon()} setFiche={() => {}} ouvrirLecture={() => {}} />)
    await screen.findByText('Condition non remplie')

    rerender(<SectionDons fiche={ficheForte} setFiche={() => {}} ouvrirLecture={() => {}} />)
    await screen.findByText('Aucune condition en travers')
  })

  it('affiche « vérification impossible » quand la fiche n’a pas de classe, sans masquer la recherche de dons', () => {
    render(<SectionDons fiche={creerFicheVide('f1', '2026-01-01T00:00:00.000Z')} setFiche={() => {}} ouvrirLecture={() => {}} />)
    expect(screen.getByText((texte) => texte.startsWith('La vérification n’est pas possible'))).not.toBeNull()
    expect(screen.getByLabelText('Rechercher un don')).not.toBeNull()
  })
})
