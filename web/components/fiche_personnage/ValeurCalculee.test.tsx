import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { ResultatCalcul } from '@/lib/fiche_personnage/resoudre'

import { ValeurCalculee } from './ValeurCalculee'

const RESULTAT_INTROUVABLE: ResultatCalcul = {
  total: null,
  detail: [],
  manquants: ['types_bonus'],
}

const RESULTAT_TOTAL: ResultatCalcul = {
  total: 5,
  detail: [
    { libelle: 'Bonus de base', valeur: 3, type: 'base', retenue: true, motifEcart: null },
    {
      libelle: 'Bonus d’altération mineur',
      valeur: 1,
      type: 'alteration',
      retenue: false,
      motifEcart: 'supplanté par « Bonus d’altération majeur »',
    },
    { libelle: 'Bonus d’altération majeur', valeur: 2, type: 'alteration', retenue: true, motifEcart: null },
  ],
  manquants: [],
}

describe('ValeurCalculee', () => {
  it('affiche le mot introuvable et liste les manquants quand le total est null', () => {
    render(<ValeurCalculee libelle="Classe d’armure" resultat={RESULTAT_INTROUVABLE} />)
    expect(screen.getByText('introuvable')).not.toBeNull()
    expect(screen.getByText('types_bonus')).not.toBeNull()
  })

  it('propose une saisie manuelle quand un gestionnaire est fourni', async () => {
    const onSaisir = vi.fn()
    render(<ValeurCalculee libelle="Classe d’armure" onSaisirManuellement={onSaisir} resultat={RESULTAT_INTROUVABLE} />)
    await userEvent.click(screen.getByRole('button', { name: 'Saisir une valeur' }))
    expect(onSaisir).toHaveBeenCalled()
  })

  it('ne montre pas le détail avant un clic, et le montre après', async () => {
    render(<ValeurCalculee libelle="Bonus total" resultat={RESULTAT_TOTAL} />)
    expect(screen.queryByText('Détail du calcul')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Afficher le détail' }))
    expect(screen.queryByText('Détail du calcul')).not.toBeNull()
  })

  it('n’affiche pas le détail par un simple survol', async () => {
    render(<ValeurCalculee libelle="Bonus total" resultat={RESULTAT_TOTAL} />)
    await userEvent.hover(screen.getByText('5'))
    expect(screen.queryByText('Détail du calcul')).toBeNull()
  })

  it('affiche le motifEcart d’une contribution non retenue comme du texte lisible', async () => {
    render(<ValeurCalculee libelle="Bonus total" resultat={RESULTAT_TOTAL} />)
    await userEvent.click(screen.getByRole('button', { name: 'Afficher le détail' }))
    expect(screen.getByText(/supplanté par/)).not.toBeNull()
    expect(screen.getByText(/Non retenue/)).not.toBeNull()
  })
})
