/**
 * `VueIndexFiches` mounted over the real `FournisseurFiches` and a real
 * (jsdom) `localStorage` — the sort, the search fold and the delete/restore
 * round trip are all genuine store behaviour here, not a stand-in for it.
 * Only the router and `next/link` are stubbed, exactly like
 * `navigation.test.tsx` does for the spell index.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FournisseurFiches } from '@/lib/fiche_personnage/contexte-fiches'
import { ecrire } from '@/lib/fiche_personnage/magasin'
import { creerFicheVide } from '@/lib/fiche_personnage/fiche-vide'

const remplace = vi.fn()
const pousse = vi.fn()
const SANS_SAUT = { scroll: false }
let recherche = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: remplace, push: pousse }),
  useSearchParams: () => recherche,
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    readonly children: ReactNode
    readonly href: string | { readonly pathname: string }
  }) => <a href={typeof href === 'string' ? href : href.pathname}>{children}</a>,
}))

const { VueIndexFiches } = await import('./VueIndexFiches')

function seed(id: string, nom: string, modifieLe: string): void {
  const vide = creerFicheVide(id, modifieLe)
  ecrire(window.localStorage, { ...vide, meta: { ...vide.meta, nomPersonnage: nom, modifieLe } })
}

beforeEach(() => {
  window.localStorage.clear()
  remplace.mockClear()
  pousse.mockClear()
  recherche = new URLSearchParams()
})

afterEach(() => {
  window.localStorage.clear()
})

function monter() {
  return render(
    <FournisseurFiches>
      <VueIndexFiches />
    </FournisseurFiches>,
  )
}

describe('le tri', () => {
  it('trie par date de modification décroissante', async () => {
    seed('a', 'Ancienne', '2026-01-01T00:00:00.000Z')
    seed('b', 'Récente', '2026-06-01T00:00:00.000Z')
    monter()
    // Cards' names are links; assert their rendered order, first to last.
    const liens = await screen.findAllByRole('link', { name: /Ancienne|Récente/ })
    expect(liens.map((lien) => lien.textContent)).toEqual(['Récente', 'Ancienne'])
  })
})

describe('la recherche', () => {
  // The name filter is bound to the URL (`?q=`), never to the raw keystroke —
  // same one-directional split as `VueDons`'s own field. Pre-setting the
  // mocked `useSearchParams()` result before mount is therefore how the
  // *filtering itself* is exercised; the write-side (the debounced
  // `router.replace`) is a separate concern, tested below.
  it('filtre par nom, insensible aux accents et à la casse, d’après l’URL', async () => {
    seed('a', 'Éloïse', '2026-01-01T00:00:00.000Z')
    seed('b', 'Bertrand', '2026-01-02T00:00:00.000Z')
    recherche = new URLSearchParams('q=ELOISE')
    monter()
    expect(screen.queryByRole('link', { name: 'Bertrand' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Éloïse' })).not.toBeNull()
  })

  it('écrit la requête saisie dans l’URL avec { scroll: false }, après un court délai', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    seed('a', 'Éloïse', '2026-01-01T00:00:00.000Z')
    monter()
    const champ = screen.getByLabelText('Chercher une fiche par nom')
    fireEvent.change(champ, { target: { value: 'e' } })
    await vi.advanceTimersByTimeAsync(300)
    expect(remplace).toHaveBeenCalledWith(expect.stringContaining('/personnages/?q=e'), SANS_SAUT)
    vi.useRealTimers()
  })
})

describe('la suppression et la restauration', () => {
  it('demande confirmation, et un refus ne supprime rien', async () => {
    seed('a', 'Éloïse', '2026-01-01T00:00:00.000Z')
    monter()
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByRole('dialog')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('link', { name: 'Éloïse' })).not.toBeNull()
  })

  it('après confirmation, la fiche disparaît puis la restauration la remet dans la liste', async () => {
    seed('a', 'Éloïse', '2026-01-01T00:00:00.000Z')
    monter()
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Éloïse' })).toBeNull()
    })
    const encart = screen.getByRole('status')
    await userEvent.click(within(encart).getByRole('button', { name: 'Restaurer' }))
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Éloïse' })).not.toBeNull()
    })
  })
})

describe('l’état vide et le chargement', () => {
  it('propose de créer une fiche quand aucune n’existe', () => {
    monter()
    expect(screen.getByText('Aucune fiche n’existe encore sur cet appareil.')).not.toBeNull()
  })
})
