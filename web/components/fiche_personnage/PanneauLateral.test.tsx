/**
 * Le panneau latéral. Le critère principal du plan 16 est la conservation du
 * défilement, testé en premier — voir `verify` skill § déroulé logique.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PanneauLateral } from './PanneauLateral'

function Scene({ ouvert, onFermer, urlSource = null }: { readonly ouvert: boolean; readonly onFermer: () => void; readonly urlSource?: string | null }) {
  return (
    <div>
      <div style={{ height: '4000px' }} />
      <button type="button">Déclencheur</button>
      <div style={{ height: '4000px' }} />
      <PanneauLateral
        declencheur={document.querySelector('button')}
        onFermer={onFermer}
        ouvert={ouvert}
        titre="Boule de feu"
        urlSource={urlSource}
      >
        <p>Le texte intégral du sort.</p>
      </PanneauLateral>
    </div>
  )
}

describe('PanneauLateral', () => {
  it('ne bouge pas la position de défilement à l’ouverture puis à la fermeture', async () => {
    window.scrollTo(0, 3000)
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 3000 })

    const { rerender } = render(<Scene onFermer={() => {}} ouvert={false} />)
    expect(window.scrollY).toBe(3000)

    rerender(<Scene onFermer={() => {}} ouvert />)
    expect(window.scrollY).toBe(3000)

    rerender(<Scene onFermer={() => {}} ouvert={false} />)
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Déclencheur' }))
    })
    expect(window.scrollY).toBe(3000)
  })

  it('porte role dialog et le titre', () => {
    render(<Scene onFermer={() => {}} ouvert />)
    const dialogue = screen.getByRole('dialog')
    expect(dialogue.getAttribute('aria-label')).toBe('Boule de feu')
  })

  it('Echap ferme le panneau', async () => {
    const onFermer = vi.fn()
    render(<Scene onFermer={onFermer} ouvert />)
    await userEvent.keyboard('{Escape}')
    expect(onFermer).toHaveBeenCalled()
  })

  it('rend le focus au déclencheur à la fermeture', async () => {
    const { rerender } = render(<Scene onFermer={() => {}} ouvert />)
    rerender(<Scene onFermer={() => {}} ouvert={false} />)
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Déclencheur' }))
    })
  })

  it('porte le lien vers pathfinder-fr.org quand une url source est fournie', () => {
    render(<Scene onFermer={() => {}} ouvert urlSource="https://pathfinder-fr.org/Sorts/Boule-de-feu" />)
    const lien = screen.getByRole('link', { name: 'Voir sur pathfinder-fr.org' })
    expect(lien.getAttribute('href')).toBe('https://pathfinder-fr.org/Sorts/Boule-de-feu')
  })

  it('ne rend rien quand ouvert est faux', () => {
    render(<Scene onFermer={() => {}} ouvert={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
