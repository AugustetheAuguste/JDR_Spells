/**
 * `VueDons` — the dons faceted list, rendered end to end against the frozen
 * 24-don fixture.
 *
 * The invariant that matters most here (`13_UI_DONS_LIST` criterion 1) is not
 * checkable by reading the code: the count printed beside a facet option must
 * equal the number of rows left after clicking it, for EVERY option of EVERY
 * facet, not a spot check. `compterOptions`/`filtrerDons` already prove this
 * at the library level (`filtres-dons.test.ts`); what is proven here is that
 * `VueDons` actually reads the count IT renders off the same functions,
 * rather than a second, silently divergent count of its own.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IndexDons } from '@/lib/donnees/index-web-dons'
import { CHEMIN_INDEX_DONS_FIXTURE } from '@/lib/donnees/lire-index-dons'

const INDEX = JSON.parse(readFileSync(CHEMIN_INDEX_DONS_FIXTURE, 'utf8')) as IndexDons

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
    readonly children: React.ReactNode
    readonly href: string | { readonly pathname: string }
  }) => <a href={typeof href === 'string' ? href : href.pathname}>{children}</a>,
}))

const { VueDons } = await import('./VueDons')

function poserFetch(index: IndexDons): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => index })),
  )
}

async function monterVue(query = '', index: IndexDons = INDEX): Promise<void> {
  recherche = new URLSearchParams(query)
  poserFetch(index)
  render(<VueDons />)
  await screen.findByRole('table')
}

beforeEach(() => {
  remplace.mockClear()
  pousse.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('rendu de base', () => {
  it('affiche le nombre total de dons du catalogue', async () => {
    await monterVue()
    expect(screen.getByText(`${INDEX.dons.length} dons du corpus Pathfinder 1re édition en français.`)).toBeTruthy()
  })

  it('un don sans aucune facette sémantique (« vigilance-instinctive ») apparaît quand même dans la liste', async () => {
    await monterVue()
    expect(screen.getByRole('link', { name: 'Vigilance instinctive' })).toBeTruthy()
  })
})

describe('l’invariant du compteur — toutes les options, toutes les facettes', () => {
  it('chaque compte affiché égale le nombre de lignes après un clic sur cette option', async () => {
    // One base mount, never re-rendered from the mocked router (it does not
    // actually navigate): every click below computes its `basculerTag` result
    // from this SAME neutral base state, so each is independently "select this
    // option alone from empty filters" — exactly what `compterOptions`
    // predicts. The row count is checked in a second, disposable render per
    // option, so the base mount's own buttons/labels stay valid for the next
    // iteration of the sweep.
    recherche = new URLSearchParams()
    poserFetch(INDEX)
    const base = render(<VueDons />)
    await within(base.container).findByRole('table')

    const aside = within(base.container).getByRole('complementary')
    // Every OR-state (green, "+") button rendered anywhere in the sidebar
    // carries its predicted count as trailing text — sweep them all.
    const boutons = within(aside).getAllByRole('button', { name: /\(\d+\)$/ })
    expect(boutons.length).toBeGreaterThan(0)

    for (const bouton of boutons) {
      const correspondance = /\((\d+)\)$/.exec(bouton.getAttribute('aria-label') ?? '')
      expect(correspondance).not.toBeNull()
      const attendu = Number(correspondance![1])

      await userEvent.click(bouton)
      const dernierAppel = remplace.mock.calls.at(-1)
      expect(dernierAppel).toBeDefined()
      const query = String(dernierAppel![0]).split('?')[1] ?? ''

      recherche = new URLSearchParams(query)
      poserFetch(INDEX)
      const { unmount, container } = render(<VueDons />)
      await within(container).findByRole('table')
      const lignes = within(container).getAllByRole('row').slice(1)
      expect(lignes.length, `option ${bouton.getAttribute('aria-label')}`).toBe(attendu)
      unmount()
    }

    base.unmount()
  })
})

describe('aucune option à compte zéro ne subsiste', () => {
  it('aucun bouton de facette n’affiche « (0) »', async () => {
    await monterVue()
    const aside = screen.getByRole('complementary')
    expect(within(aside).queryByRole('button', { name: /\(0\)$/ })).toBeNull()
  })
})

describe('l’écriture de l’URL', () => {
  it('un ajustement de filtre passe par replace, avec { scroll: false }', async () => {
    await monterVue()
    const aside = screen.getByRole('complementary')
    const bouton = within(aside).getAllByRole('button', { name: /\(\d+\)$/ })[0]!
    await userEvent.click(bouton)
    expect(remplace).toHaveBeenCalledWith(expect.stringContaining('/dons'), SANS_SAUT)
  })
})

describe('la dégradation sans couche sémantique', () => {
  const SANS_SEMANTIQUE: IndexDons = {
    ...INDEX,
    dons: INDEX.dons.map((don) => ({
      ...don,
      ep: null,
      es: [],
      cb: [],
      cx: [],
      ac: null,
      pv: null,
      cat: [],
    })),
  }

  it('rend sans erreur et masque toutes les facettes sémantiques', async () => {
    await monterVue('', SANS_SEMANTIQUE)
    const aside = screen.getByRole('complementary')
    for (const titre of ['Effet principal', 'Cible du bonus', 'Contexte', 'Activation', 'Catégorie officielle']) {
      expect(within(aside).queryByRole('group', { name: new RegExp(`^${titre}`) })).toBeNull()
    }
    // No semantic column either — same degradation, one level up.
    expect(screen.queryByRole('columnheader', { name: 'Effet principal' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Cible du bonus' })).toBeNull()
    // The table itself still renders every don.
    expect(screen.getAllByRole('row').length).toBe(SANS_SEMANTIQUE.dons.length + 1)
  })
})

describe('aucune colonne de statut sans personnage', () => {
  it('la colonne « Statut » n’existe pas du tout', async () => {
    await monterVue()
    expect(screen.queryByRole('columnheader', { name: /statut/i })).toBeNull()
  })
})

describe('la recherche', () => {
  it('filtre par nom', async () => {
    await monterVue()
    await userEvent.type(screen.getByLabelText('Chercher un don'), 'endurance')
    await vi.waitFor(() =>
      expect(remplace).toHaveBeenLastCalledWith('/dons?dons_q=endurance', SANS_SAUT),
    )
  })
})
