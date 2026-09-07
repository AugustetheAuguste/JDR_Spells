/**
 * `MenuDeroulant` — the desktop dropdown menu for one `GroupeNav`.
 *
 * `next/navigation` and `next/link` are stubbed rather than mounted with a
 * real router, matching `navigation.test.tsx`'s convention.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

let chemin = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => chemin,
}))

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

const { MenuDeroulant } = await import('@/components/navigation/MenuDeroulant')

const GROUPE = {
  cle: 'corpus',
  libelle: 'Corpus',
  entrees: [
    { cle: 'sorts', libelle: 'Sorts', href: '/' },
    { cle: 'dons', libelle: 'Dons', href: '/dons' },
    { cle: 'explorer', libelle: 'Explorer', href: '/explorer' },
  ],
} as const

function Controle() {
  const [ouvert, setOuvert] = useState(false)
  return <MenuDeroulant groupe={GROUPE} ouvert={ouvert} surOuvrirChange={setOuvert} />
}

afterEach(() => {
  chemin = '/'
})

describe('MenuDeroulant', () => {
  it("ne s'ouvre pas au survol", () => {
    render(<Controle />)
    const bouton = screen.getByRole('button', { name: 'Corpus' })
    fireEvent.mouseOver(bouton)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it("s'ouvre au clic et bascule aria-expanded", () => {
    render(<Controle />)
    const bouton = screen.getByRole('button', { name: 'Corpus' })
    expect(bouton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(bouton)
    expect(bouton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menu')).not.toBeNull()
  })

  it('descend puis remonte avec les flèches, en cycle', () => {
    render(<Controle />)
    const bouton = screen.getByRole('button', { name: 'Corpus' })
    // Opening with the Down arrow key places the index on the first item,
    // per spec — a plain click open does not claim keyboard focus.
    fireEvent.keyDown(bouton, { key: 'ArrowDown' })
    const items = screen.getAllByRole('menuitem')
    const liste = screen.getByRole('menu')

    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(liste, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(liste, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2])
    // Cycle past the end back to the first item.
    fireEvent.keyDown(liste, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])
    // Cycle before the start back to the last item.
    fireEvent.keyDown(liste, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[2])
  })

  it('Échap ferme le menu et rend le focus au déclencheur', () => {
    render(<Controle />)
    const bouton = screen.getByRole('button', { name: 'Corpus' })
    fireEvent.click(bouton)
    const liste = screen.getByRole('menu')
    fireEvent.keyDown(liste, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(bouton)
  })

  it('un clic extérieur ferme le menu', () => {
    render(
      <div>
        <Controle />
        <button type="button">ailleurs</button>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Corpus' }))
    expect(screen.getByRole('menu')).not.toBeNull()
    fireEvent.mouseDown(screen.getByRole('button', { name: 'ailleurs' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
