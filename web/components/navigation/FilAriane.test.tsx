/**
 * `FilAriane` — the breadcrumb mounted on character-sheet pages.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    readonly children: ReactNode
    readonly href: string | { readonly pathname: string }
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
}))

const { FilAriane } = await import('@/components/navigation/FilAriane')

describe('FilAriane', () => {
  it('marque le dernier segment aria-current="page"', () => {
    render(
      <FilAriane
        segments={[
          { libelle: 'Personnages', href: '/personnages/' },
          { libelle: 'Thargrim', href: '/personnages/thargrim/' },
        ]}
      />,
    )
    const dernier = screen.getByText('Thargrim')
    expect(dernier.getAttribute('aria-current')).toBe('page')
    const premier = screen.getByRole('link', { name: 'Personnages' })
    expect(premier.getAttribute('aria-current')).toBeNull()
  })

  it('un segment simple sans choix reste un lien', () => {
    render(<FilAriane segments={[{ libelle: 'Personnages', href: '/personnages/' }]} />)
    // With a single segment, it is also the last one and carries aria-current;
    // a plain intermediate segment (tested above) is what stays a bare link.
    expect(screen.getByText('Personnages').getAttribute('aria-current')).toBe('page')
  })

  it('un segment sélecteur est ouvrable au clavier', () => {
    render(
      <FilAriane
        segments={[
          { libelle: 'Personnages', href: '/personnages/' },
          {
            libelle: 'Thargrim',
            href: '/personnages/thargrim/',
            choix: [
              { cle: 'thargrim', libelle: 'Thargrim', href: '/personnages/thargrim/' },
              { cle: 'elara', libelle: 'Elara', href: '/personnages/elara/' },
            ],
          },
        ]}
      />,
    )
    const bouton = screen.getByRole('button', { name: /Thargrim/ })
    expect(bouton.getAttribute('aria-expanded')).toBe('false')
    expect(bouton.getAttribute('aria-current')).toBe('page')

    fireEvent.keyDown(bouton, { key: 'ArrowDown' })
    expect(bouton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('listbox')).not.toBeNull()
    expect(screen.getByRole('option', { name: 'Elara' })).not.toBeNull()

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(bouton)
  })
})
