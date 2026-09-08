/**
 * The create-and-redirect route: a double mount (React Strict Mode) must
 * still create exactly one sheet, and the reader ends up redirected to it.
 */
import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const remplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: remplace, push: vi.fn() }),
}))

const { FournisseurFiches } = await import('@/lib/fiche_personnage/contexte-fiches')
const PageNouvellePersonnage = (await import('./page')).default

const SANS_SAUT = { scroll: false }

beforeEach(() => {
  window.localStorage.clear()
  remplace.mockClear()
})

afterEach(() => {
  window.localStorage.clear()
})

describe('PageNouvellePersonnage', () => {
  it('crée une seule fiche même sous double montage, puis redirige vers elle', async () => {
    render(
      <StrictMode>
        <FournisseurFiches>
          <PageNouvellePersonnage />
        </FournisseurFiches>
      </StrictMode>,
    )

    await vi.waitFor(() => {
      expect(remplace).toHaveBeenCalledTimes(1)
    })

    const clesFiches: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const cle = window.localStorage.key(i)
      if (cle !== null && cle.startsWith('pf-fiche:')) clesFiches.push(cle)
    }
    expect(clesFiches).toHaveLength(1)
    expect(remplace).toHaveBeenCalledWith(expect.stringContaining('/personnages/fiche/?id='), SANS_SAUT)
  })
})
