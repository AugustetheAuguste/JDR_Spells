/**
 * `BoutonImport` never talks to `localStorage` directly — it hands the read
 * text to `useFiches().importer` and shows exactly what comes back. This is
 * therefore a contract test against a stubbed context, not the store.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const importer = vi.fn()

vi.mock('@/lib/fiche_personnage/contexte-fiches', () => ({
  useFiches: () => ({ importer }),
}))

const { BoutonImport } = await import('./BoutonImport')

function fichierFaux(texte: string, nom = 'fiche.json'): File {
  const fichier = new File([texte], nom, { type: 'application/json' })
  return fichier
}

describe('BoutonImport', () => {
  it('affiche tous les refus et ne signale aucun ajout sur un import invalide', async () => {
    importer.mockResolvedValueOnce({ ok: false, motifs: ['motif un', 'motif deux'] })
    render(<BoutonImport />)

    const entree = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(entree, fichierFaux('pas du json'))

    expect(await screen.findByText('motif un')).not.toBeNull()
    expect(screen.getByText('motif deux')).not.toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('signale un écrasement sur un import qui remplace une fiche existante', async () => {
    importer.mockResolvedValueOnce({ ok: true, fiche: {}, ecrase: true })
    render(<BoutonImport />)

    const entree = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(entree, fichierFaux('{}'))

    const encart = await screen.findByRole('status')
    expect(encart.textContent).toContain('copie de secours')
  })
})
