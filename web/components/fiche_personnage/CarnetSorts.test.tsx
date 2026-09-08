import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { creerFicheVide } from '@/lib/fiche_personnage/fiche-vide'
import type { Fiche } from '@/lib/fiche_personnage/schema'

import { CarnetSorts } from './CarnetSorts'

vi.mock('@/lib/recherche/sources-globales', () => ({
  sourceSorts: { chercher: vi.fn().mockResolvedValue([]) },
  sourceDons: { chercher: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@/lib/fiche_personnage/charger-corpus', () => ({
  chargerPropsSort: vi.fn().mockResolvedValue({
    statut: 'ok',
    props: {
      niveaux_par_classe: { barde: { nom: 'Barde', niveau: 2 }, magicien: { nom: 'Magicien', niveau: 3 } },
    },
  }),
  chargerPropsDon: vi.fn().mockResolvedValue({ statut: 'absent' }),
}))

function ficheAvecSortConnu(): Fiche {
  const base = creerFicheVide('f1', '2026-01-01T00:00:00.000Z')
  return {
    ...base,
    sorts: {
      ...base.sorts,
      sortsConnus: [{ nom: 'Boule de feu', source: 'pathfinder-fr', ref: 'boule-de-feu', note: '' }],
    },
  }
}

describe('CarnetSorts', () => {
  it('n’a aucun compteur ni case à cocher', () => {
    render(<CarnetSorts fiche={creerFicheVide('f1', '2026-01-01T00:00:00.000Z')} ouvrirLecture={() => {}} setFiche={() => {}} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    // Aucun texte de dénombrement du style « 3/5 » ou « il reste ».
    expect(screen.queryByText(/reste/i)).toBeNull()
  })

  it('affiche le niveau d’un sort rattaché par classe, jamais un en-tête « Niveau » nu', async () => {
    render(<CarnetSorts fiche={ficheAvecSortConnu()} ouvrirLecture={() => {}} setFiche={() => {}} />)
    await screen.findByText('Barde')
    expect(screen.getByText('Magicien')).not.toBeNull()
    // Le titre de la section porte "Niveaux par classe", jamais "Niveau" seul.
    const titres = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    for (const titre of titres) {
      expect(titre).not.toBe('Niveau')
    }
  })

  it('propose les trois modes descriptifs et une option « aucun mode »', () => {
    render(<CarnetSorts fiche={creerFicheVide('f1', '2026-01-01T00:00:00.000Z')} ouvrirLecture={() => {}} setFiche={() => {}} />)
    expect(screen.getByText('Préparé')).not.toBeNull()
    expect(screen.getByText('Spontané')).not.toBeNull()
    expect(screen.getByText('Usage limité par jour')).not.toBeNull()
  })

  it('n’affiche pas la liste des sorts préparés quand le mode n’est pas préparé', () => {
    render(<CarnetSorts fiche={creerFicheVide('f1', '2026-01-01T00:00:00.000Z')} ouvrirLecture={() => {}} setFiche={() => {}} />)
    expect(screen.queryByText('Sorts préparés')).toBeNull()
  })
})
