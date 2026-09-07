/**
 * `NavigationMobile` — the burger menu with accordions for narrow viewports.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
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

const { NavigationMobile } = await import('@/components/navigation/NavigationMobile')

describe('NavigationMobile', () => {
  it('ouvre le panneau au clic sur le burger', () => {
    render(<NavigationMobile />)
    const burger = screen.getByRole('button')
    expect(burger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(burger)
    expect(burger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('navigation')).not.toBeNull()
  })

  it('ouvre un accordéon de groupe', () => {
    render(<NavigationMobile />)
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    const boutonCorpus = screen.getByRole('button', { name: 'Corpus' })
    expect(boutonCorpus.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(boutonCorpus)
    expect(boutonCorpus.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('link', { name: 'Sorts' })).not.toBeNull()
  })

  it('Échap ferme le panneau et rend le focus au burger', () => {
    render(<NavigationMobile />)
    const burger = screen.getByRole('button', { name: /menu/i })
    fireEvent.click(burger)
    expect(screen.getByRole('navigation')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(document.activeElement).toBe(burger)
  })
})
