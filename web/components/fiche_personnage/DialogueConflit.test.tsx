import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DialogueConflit } from '@/components/fiche_personnage/DialogueConflit'
import { creerFicheVide } from '@/lib/fiche_personnage/fiche-vide'

import type { Conflit } from '@/lib/fiche_personnage/fusion'

function conflitDeTest(): Conflit {
  const locale = { ...creerFicheVide('f1', '2026-09-01T00:00:00.000Z'), notes: 'locale' }
  const distante = { ...creerFicheVide('f1', '2026-09-01T00:00:00.000Z'), notes: 'distante' }
  return {
    id: 'f1',
    locale,
    distante: {
      id_fiche: 'f1',
      schema_version: 1,
      contenu: distante as unknown as Record<string, unknown>,
      nom: '',
      cree_le: null,
      modifie_le: null,
      supprime_le: null,
      personnage_id: null,
    },
    motif: 'test',
  }
}

describe('DialogueConflit', () => {
  it('ne rend rien sans conflit', () => {
    const { container } = render(
      <DialogueConflit conflit={null} declencheur={null} onChoisir={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('n’a aucun choix présélectionné', () => {
    const { container } = render(
      <DialogueConflit conflit={conflitDeTest()} declencheur={null} onChoisir={() => {}} />,
    )
    const cases = container.querySelectorAll('input[type="radio"], input[type="checkbox"]')
    expect(cases).toHaveLength(0)
    // Aucun bouton ne porte `autoFocus` ou un focus initial imposé.
    expect(document.activeElement === document.body || document.activeElement === null).toBe(true)
  })

  it('ne se ferme pas seul et attend un choix explicite', async () => {
    const onChoisir = vi.fn()
    const { getByRole } = render(
      <DialogueConflit conflit={conflitDeTest()} declencheur={null} onChoisir={onChoisir} />,
    )
    expect(onChoisir).not.toHaveBeenCalled()
    await userEvent.click(getByRole('button', { name: 'Garder les deux, dupliquer la fiche' }))
    expect(onChoisir).toHaveBeenCalledWith('les_deux')
  })
})
