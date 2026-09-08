/**
 * The card's rendering contract: a missing field is a dash, a real `0` is
 * `0`, and its three action buttons call back with the sheet they belong to.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { creerFicheVide } from '@/lib/fiche_personnage/fiche-vide'
import type { Fiche } from '@/lib/fiche_personnage/schema'

vi.mock('next/link', () => ({
  default: ({ children, href }: { readonly children: ReactNode; readonly href: { readonly pathname: string } }) => (
    <a href={href.pathname}>{children}</a>
  ),
}))

const { CarteFiche } = await import('./CarteFiche')

const T0 = '2026-07-31T10:00:00.000Z'

function ficheAvec(partiel: Partial<Fiche>): Fiche {
  return { ...creerFicheVide('f1', T0), ...partiel }
}

describe('CarteFiche', () => {
  it('affiche un tiret cadratin quand la race est absente', () => {
    render(
      <ul>
        <CarteFiche fiche={ficheAvec({})} onDupliquer={() => {}} onSupprimerDemande={() => {}} />
      </ul>,
    )
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('affiche 0, jamais un tiret, pour un niveau 0 réel', () => {
    const fiche = ficheAvec({
      identite: {
        ...creerFicheVide('f1', T0).identite,
        classes: [{ nom: 'Barde', niveau: 0, archetype: null, source: 'pathfinder-fr', ref: null }],
      },
    })
    render(
      <ul>
        <CarteFiche fiche={fiche} onDupliquer={() => {}} onSupprimerDemande={() => {}} />
      </ul>,
    )
    expect(screen.getByText('Barde 0')).not.toBeNull()
  })

  it('affiche un tiret pour un niveau absent (null)', () => {
    const fiche = ficheAvec({
      identite: {
        ...creerFicheVide('f1', T0).identite,
        classes: [{ nom: 'Barde', niveau: null, archetype: null, source: 'pathfinder-fr', ref: null }],
      },
    })
    render(
      <ul>
        <CarteFiche fiche={fiche} onDupliquer={() => {}} onSupprimerDemande={() => {}} />
      </ul>,
    )
    expect(screen.getByText('Barde —')).not.toBeNull()
  })

  it('appelle onDupliquer avec l’identifiant de la fiche', async () => {
    const onDupliquer = vi.fn()
    render(
      <ul>
        <CarteFiche fiche={ficheAvec({})} onDupliquer={onDupliquer} onSupprimerDemande={() => {}} />
      </ul>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Dupliquer' }))
    expect(onDupliquer).toHaveBeenCalledWith('f1')
  })

  it('appelle onSupprimerDemande avec la fiche', async () => {
    const onSupprimerDemande = vi.fn()
    const fiche = ficheAvec({})
    render(
      <ul>
        <CarteFiche fiche={fiche} onDupliquer={() => {}} onSupprimerDemande={onSupprimerDemande} />
      </ul>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(onSupprimerDemande).toHaveBeenCalledWith(fiche, expect.anything())
  })

  it('affiche « Personnage sans nom » quand le nom est vide', () => {
    render(
      <ul>
        <CarteFiche fiche={ficheAvec({})} onDupliquer={() => {}} onSupprimerDemande={() => {}} />
      </ul>,
    )
    expect(screen.getByText('Personnage sans nom')).not.toBeNull()
  })
})
