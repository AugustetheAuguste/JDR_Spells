import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { Section } from '@/components/fiche_personnage/Section'
import { ValeurCalculee } from '@/components/fiche_personnage/ValeurCalculee'
import type { ResultatCalcul } from '@/lib/fiche_personnage/resoudre'

import { _reinitialiserPourTests } from './etatImpression'

afterEach(() => {
  window.localStorage.clear()
  _reinitialiserPourTests()
})

const RESULTAT: ResultatCalcul = {
  total: 5,
  detail: [{ libelle: 'Bonus de base', valeur: 5, type: 'base', retenue: true, motifEcart: null }],
  manquants: [],
}

describe('useImprimeEnCours — beforeprint déplie tout, afterprint restaure exactement', () => {
  it('Section : un beforeprint déplie une section repliée, afterprint la referme', async () => {
    render(
      <Section cle="identite" ficheId="f1" titre="Identité">
        <p>Contenu de la section</p>
      </Section>,
    )
    expect(screen.queryByText('Contenu de la section')).toBeNull()

    act(() => {
      window.dispatchEvent(new Event('beforeprint'))
    })
    expect(screen.queryByText('Contenu de la section')).not.toBeNull()

    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    expect(screen.queryByText('Contenu de la section')).toBeNull()
  })

  it('Section : une section déjà dépliée par le lecteur le reste après afterprint', async () => {
    render(
      <Section cle="combat" ficheId="f2" titre="Combat">
        <p>Contenu déjà visible</p>
      </Section>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('Contenu déjà visible')).not.toBeNull()

    act(() => {
      window.dispatchEvent(new Event('beforeprint'))
    })
    expect(screen.queryByText('Contenu déjà visible')).not.toBeNull()

    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    // Restored to exactly what the reader had chosen, not folded back.
    expect(screen.queryByText('Contenu déjà visible')).not.toBeNull()
  })

  it('ValeurCalculee : beforeprint révèle le détail, afterprint le referme', () => {
    render(<ValeurCalculee libelle="Bonus total" resultat={RESULTAT} />)
    expect(screen.queryByText('Détail du calcul')).toBeNull()

    act(() => {
      window.dispatchEvent(new Event('beforeprint'))
    })
    expect(screen.queryByText('Détail du calcul')).not.toBeNull()

    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    expect(screen.queryByText('Détail du calcul')).toBeNull()
  })

  it('un afterprint sans beforeprint préalable ne casse rien (impression annulée avant l’événement)', () => {
    render(
      <Section cle="notes" ficheId="f3" titre="Notes">
        <p>Contenu</p>
      </Section>,
    )
    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    expect(screen.queryByText('Contenu')).toBeNull()
  })
})
