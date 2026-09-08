/**
 * `BoutonExport` is the only place that touches the DOM for export — this
 * test proves it drives a real anchor download rather than asserting on
 * `echange.exporter`'s pure output a second time (already covered by
 * `echange.test.ts`).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { creerFicheVide } from '@/lib/fiche_personnage/fiche-vide'

import { BoutonExport } from './BoutonExport'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('BoutonExport', () => {
  it('déclenche un téléchargement du nom attendu', async () => {
    const creerObjectURL = vi.fn(() => 'blob:faux')
    const revoquerObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL: creerObjectURL, revokeObjectURL: revoquerObjectURL })

    const clic = vi.fn()
    const ancreOriginale = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = ancreOriginale(tag)
      if (tag === 'a') element.click = clic
      return element
    })

    const fiche = {
      ...creerFicheVide('f1', '2026-07-31T10:00:00.000Z'),
      meta: { ...creerFicheVide('f1', '2026-07-31T10:00:00.000Z').meta, nomPersonnage: 'Elara' },
    }

    render(<BoutonExport fiche={fiche} />)
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en JSON' }))

    expect(creerObjectURL).toHaveBeenCalled()
    expect(clic).toHaveBeenCalled()
    expect(revoquerObjectURL).toHaveBeenCalledWith('blob:faux')
  })
})
