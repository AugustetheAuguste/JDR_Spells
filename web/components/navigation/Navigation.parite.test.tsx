/**
 * Desktop and mobile navigation read the same `ARBORESCENCE` — this suite
 * proves it by comparing the rendered `href`s of `EnteteSite`'s desktop nav
 * against `NavigationMobile`'s panel, rather than trusting that both import
 * the same module (an import that could still be fed different data).
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
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

const { EnteteSite } = await import('@/components/navigation/EnteteSite')
const { ARBORESCENCE } = await import('@/lib/navigation/arborescence')

describe('parité bureau/burger', () => {
  it('les deux surfaces exposent les mêmes href, groupe par groupe', () => {
    const { container } = render(<EnteteSite />)

    // The desktop `<nav>` is always in the DOM; the mobile panel only
    // appears once the burger is opened, so at this point the first (and
    // only) `<nav>` is the desktop one.
    const navs = container.querySelectorAll('nav')
    const navBureau = navs[0]
    if (!navBureau) throw new Error('navBureau introuvable')

    for (const groupe of ARBORESCENCE.groupes) {
      const boutonBureau = within(navBureau).getByRole('button', { name: groupe.libelle })
      fireEvent.click(boutonBureau)
      const menu = within(navBureau).getByRole('menu', { name: groupe.libelle })
      const hrefsBureau = within(menu)
        .getAllByRole('menuitem')
        .map((lien) => lien.getAttribute('href'))
      fireEvent.click(boutonBureau)

      expect(hrefsBureau).toEqual(groupe.entrees.map((e) => e.href))
    }

    // Burger panel: opening it adds a second `<nav>`, the mobile one.
    const burger = screen.getByRole('button', { name: /menu/i })
    fireEvent.click(burger)
    const navMobile = container.querySelectorAll('nav')[1]
    if (!navMobile) throw new Error('navMobile introuvable')

    for (const groupe of ARBORESCENCE.groupes) {
      const boutonAccordeon = within(navMobile).getByRole('button', { name: groupe.libelle })
      fireEvent.click(boutonAccordeon)
      const hrefsMobile = groupe.entrees.map(
        (entree) =>
          within(navMobile).getByRole('link', { name: entree.libelle }).getAttribute('href'),
      )
      expect(hrefsMobile).toEqual(groupe.entrees.map((e) => e.href))
      fireEvent.click(boutonAccordeon)
    }
  })
})
