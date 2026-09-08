import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ChampSaisi } from './ChampSaisi'

describe('ChampSaisi', () => {
  it('affiche un champ vide quand la valeur est null, jamais un zéro', () => {
    render(<ChampSaisi libelle="Points de vie maximum" surChangement={vi.fn()} valeur={null} />)
    expect((screen.getByLabelText('Points de vie maximum') as HTMLInputElement).value).toBe('')
  })

  it('écrit null, jamais zéro, quand le champ est vidé', async () => {
    const surChangement = vi.fn()
    render(<ChampSaisi libelle="Points de vie maximum" surChangement={surChangement} valeur={12} />)
    const champ = screen.getByLabelText('Points de vie maximum')
    await userEvent.clear(champ)
    expect(surChangement).toHaveBeenCalledWith(null)
    expect(surChangement).not.toHaveBeenCalledWith(0)
  })

  it('porte un marqueur avec un libellé accessible quand la saisie est manuelle', () => {
    render(<ChampSaisi libelle="Résistance à la magie" saisieManuelle surChangement={vi.fn()} valeur={10} />)
    expect(screen.getByTitle('Valeur saisie à la main, hors corpus')).not.toBeNull()
  })

  it('ne porte aucun marqueur quand la saisie n’est pas manuelle', () => {
    render(<ChampSaisi libelle="Résistance à la magie" surChangement={vi.fn()} valeur={10} />)
    expect(screen.queryByTitle('Valeur saisie à la main, hors corpus')).toBeNull()
  })
})
