/**
 * `FiltreFacetteDon` — the three-state cycle, keyboard-reachable, and the
 * count shown beside each option (`13_UI_DONS_LIST` criteria 2 and 3).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FiltreFacetteDon } from './FiltreFacetteDon'

const COMPTES = new Map([
  ['defense', 3],
  ['social', 1],
])

describe('FiltreFacetteDon', () => {
  it('affiche le compte à côté de chaque option', () => {
    render(
      <FiltreFacetteDon
        comptes={COMPTES}
        options={['defense', 'social']}
        tags={[]}
        tagsExclus={[]}
        tagsObliges={[]}
        titre="Effet principal"
        surTags={vi.fn()}
      />,
    )
    const bouton = screen.getByRole('button', { name: /^defense/ })
    expect(bouton.textContent).toContain('3')
  })

  it('n’affiche aucune option absente de la liste fournie (compte à zéro déjà écarté par l’appelant)', () => {
    render(
      <FiltreFacetteDon
        comptes={COMPTES}
        options={['defense']}
        tags={[]}
        tagsExclus={[]}
        tagsObliges={[]}
        titre="Effet principal"
        surTags={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: /^social/ })).toBeNull()
  })

  it('le cycle OU → NON → ET → neutre est atteignable au clavier, trois activations reviennent à l’état initial', async () => {
    let etat: { tags: readonly string[]; tagsExclus: readonly string[]; tagsObliges: readonly string[] } = {
      tags: [],
      tagsExclus: [],
      tagsObliges: [],
    }
    const surTags = vi.fn((tags: readonly string[], tagsExclus: readonly string[], tagsObliges: readonly string[]) => {
      etat = { tags, tagsExclus, tagsObliges }
    })

    function Rendu() {
      return (
        <FiltreFacetteDon
          comptes={COMPTES}
          options={['defense']}
          tags={etat.tags}
          tagsExclus={etat.tagsExclus}
          tagsObliges={etat.tagsObliges}
          titre="Effet principal"
          surTags={surTags}
        />
      )
    }

    const { rerender } = render(<Rendu />)
    const bouton = () => screen.getByRole('button', { name: /^defense/ })

    bouton().focus()
    await userEvent.keyboard('{Enter}')
    rerender(<Rendu />)
    expect(etat.tags).toEqual(['defense']) // OU

    bouton().focus()
    await userEvent.keyboard('{Enter}')
    rerender(<Rendu />)
    expect(etat.tagsExclus).toEqual(['defense']) // NON

    bouton().focus()
    await userEvent.keyboard('{Enter}')
    rerender(<Rendu />)
    expect(etat.tagsObliges).toEqual(['defense']) // ET

    bouton().focus()
    await userEvent.keyboard('{Enter}')
    rerender(<Rendu />)
    // Fourth activation returns to the initial, neutral state.
    expect(etat).toEqual({ tags: [], tagsExclus: [], tagsObliges: [] })
  })
})
