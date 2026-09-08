import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { Section } from './Section'

afterEach(() => {
  window.localStorage.clear()
})

describe('Section', () => {
  it('porte aria-expanded et aria-controls cohérents', () => {
    render(
      <Section cle="identite" ficheId="f1" titre="Identité">
        <p>Contenu</p>
      </Section>,
    )
    const bouton = screen.getByRole('button')
    expect(bouton.getAttribute('aria-expanded')).toBe('false')
    expect(bouton.getAttribute('aria-controls')).not.toBeNull()
  })

  it('se déplie au clic et affiche son contenu', async () => {
    render(
      <Section cle="identite" ficheId="f1" titre="Identité">
        <p>Contenu de la section</p>
      </Section>,
    )
    expect(screen.queryByText('Contenu de la section')).toBeNull()
    await userEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('Contenu de la section')).not.toBeNull()
  })

  it('mémorise le pliage par fiche entre deux montages', async () => {
    const { unmount } = render(
      <Section cle="combat" ficheId="f2" titre="Combat">
        <p>Contenu</p>
      </Section>,
    )
    await userEvent.click(screen.getByRole('button'))
    unmount()

    render(
      <Section cle="combat" ficheId="f2" titre="Combat">
        <p>Contenu</p>
      </Section>,
    )
    expect(screen.queryByText('Contenu')).not.toBeNull()
  })

  it('ne mélange pas le pliage de deux fiches différentes', async () => {
    const { unmount } = render(
      <Section cle="combat" ficheId="fA" titre="Combat">
        <p>Contenu</p>
      </Section>,
    )
    await userEvent.click(screen.getByRole('button'))
    unmount()

    render(
      <Section cle="combat" ficheId="fB" titre="Combat">
        <p>Contenu</p>
      </Section>,
    )
    expect(screen.queryByText('Contenu')).toBeNull()
  })
})
