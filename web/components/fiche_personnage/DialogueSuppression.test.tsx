/**
 * The delete dialog's a11y contract: role, aria-modal, a trapped Tab cycle,
 * Escape cancels, and focus goes back to whatever triggered it once it
 * closes.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DialogueSuppression } from './DialogueSuppression'

function Scene({ ouvert, onAnnuler, onConfirmer }: { readonly ouvert: boolean; readonly onAnnuler: () => void; readonly onConfirmer: () => void }) {
  return (
    <div>
      <button type="button">Déclencheur</button>
      <DialogueSuppression
        declencheur={document.querySelector('button')}
        nomFiche="Elara"
        onAnnuler={onAnnuler}
        onConfirmer={onConfirmer}
        ouvert={ouvert}
      />
    </div>
  )
}

describe('DialogueSuppression', () => {
  it('porte role dialog et aria-modal, et répète le nom de la fiche', () => {
    render(<Scene onAnnuler={() => {}} onConfirmer={() => {}} ouvert />)
    const dialogue = screen.getByRole('dialog')
    expect(dialogue.getAttribute('aria-modal')).toBe('true')
    expect(dialogue.textContent).toContain('Elara')
  })

  it('Echap appelle onAnnuler', async () => {
    const onAnnuler = vi.fn()
    render(<Scene onAnnuler={onAnnuler} onConfirmer={() => {}} ouvert />)
    await userEvent.keyboard('{Escape}')
    expect(onAnnuler).toHaveBeenCalled()
  })

  it('appelle onConfirmer sur le bouton de confirmation', async () => {
    const onConfirmer = vi.fn()
    render(<Scene onAnnuler={() => {}} onConfirmer={onConfirmer} ouvert />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))
    expect(onConfirmer).toHaveBeenCalled()
  })

  it('ne rend rien quand ouvert est faux', () => {
    render(<Scene onAnnuler={() => {}} onConfirmer={() => {}} ouvert={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('rend le focus au déclencheur à la fermeture', async () => {
    const { rerender } = render(<Scene onAnnuler={() => {}} onConfirmer={() => {}} ouvert />)
    rerender(<Scene onAnnuler={() => {}} onConfirmer={() => {}} ouvert={false} />)
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Déclencheur' }))
    })
  })
})
