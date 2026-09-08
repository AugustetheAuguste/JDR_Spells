/**
 * `RechercheGlobale` — the header's unified search field.
 *
 * Uses fake `SourceGlobale`s passed in as a prop rather than the real
 * `sources-globales.ts`: the laziness contract of the real sources (no
 * fetch, no MiniSearch import, before the first keystroke) is asserted on
 * its own in `lib/recherche/sources-globales.test.ts`. This suite is only
 * about what the component does with whatever sources it is given —
 * grouping, keyboard navigation, the empty state, the barre oblique
 * shortcut.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ResultatGlobal, SourceGlobale } from '@/lib/recherche/sources-globales'

const pousse = vi.fn()
const SANS_SAUT = { scroll: false }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pousse }),
}))

const { RechercheGlobale } = await import('@/components/navigation/RechercheGlobale')

function resultat(partiel: Partial<ResultatGlobal> & { readonly cle: string }): ResultatGlobal {
  return { type: 'sort', titre: partiel.cle, detail: null, href: `/sorts/${partiel.cle}/`, ...partiel }
}

const SOURCE_SORTS: SourceGlobale = {
  type: 'sort',
  libelle: 'Sorts',
  ordre: 0,
  libelleTousLesResultats: 'Voir tous les sorts',
  hrefTousLesResultats: (requete) => `/?q=${requete}`,
  chercher: async (requete) =>
    requete === 'feu'
      ? [resultat({ cle: 'boule-de-feu', titre: 'Boule de feu', type: 'sort', href: '/sorts/boule-de-feu/' })]
      : [],
}

const SOURCE_DONS: SourceGlobale = {
  type: 'don',
  libelle: 'Dons',
  ordre: 1,
  libelleTousLesResultats: 'Voir tous les dons',
  hrefTousLesResultats: (requete) => `/dons?q=${requete}`,
  chercher: async (requete) =>
    requete === 'feu'
      ? [
          resultat({
            cle: 'endurance-au-feu',
            titre: 'Endurance au feu',
            type: 'don',
            href: '/dons/endurance-au-feu/',
          }),
        ]
      : [],
}

const SOURCE_VIDE: SourceGlobale = {
  type: 'don',
  libelle: 'Dons',
  ordre: 1,
  libelleTousLesResultats: 'Voir tous les dons',
  hrefTousLesResultats: (requete) => `/dons?q=${requete}`,
  chercher: async () => [],
}

async function taper(champ: HTMLElement, texte: string) {
  fireEvent.change(champ, { target: { value: texte } })
  // The debounce is 150ms; advance past it inside `act` via the fake clock.
  await vi.advanceTimersByTimeAsync(200)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  pousse.mockClear()
})

describe('RechercheGlobale', () => {
  it('groupe les resultats par source, avec un en-tete par groupe', async () => {
    render(<RechercheGlobale sources={[SOURCE_SORTS, SOURCE_DONS]} />)
    const champ = screen.getByRole('combobox')
    await taper(champ, 'feu')

    await waitFor(() => expect(screen.getByRole('listbox')).not.toBeNull())
    expect(screen.getByRole('group', { name: 'Sorts' })).not.toBeNull()
    expect(screen.getByRole('group', { name: 'Dons' })).not.toBeNull()
    expect(screen.getByRole('option', { name: 'Boule de feu' })).not.toBeNull()
    expect(screen.getByRole('option', { name: 'Endurance au feu' })).not.toBeNull()
  })

  it('un groupe sans resultat est absent', async () => {
    render(<RechercheGlobale sources={[SOURCE_SORTS, SOURCE_VIDE]} />)
    const champ = screen.getByRole('combobox')
    await taper(champ, 'feu')

    await waitFor(() => expect(screen.getByRole('group', { name: 'Sorts' })).not.toBeNull())
    expect(screen.queryByRole('group', { name: 'Dons' })).toBeNull()
  })

  it('les flèches parcourent les résultats à travers les groupes', async () => {
    render(<RechercheGlobale sources={[SOURCE_SORTS, SOURCE_DONS]} />)
    const champ = screen.getByRole('combobox')
    await taper(champ, 'feu')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))

    const [premiere, seconde] = screen.getAllByRole('option')
    if (premiere === undefined || seconde === undefined) throw new Error('options manquantes')
    fireEvent.keyDown(champ, { key: 'ArrowDown' })
    expect(premiere.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(champ, { key: 'ArrowDown' })
    expect(seconde.getAttribute('aria-selected')).toBe('true')
    // Cycles back to the first result past the last group's last result.
    fireEvent.keyDown(champ, { key: 'ArrowDown' })
    expect(premiere.getAttribute('aria-selected')).toBe('true')
  })

  it('Entrée navigue vers le résultat actif, sans saut de défilement', async () => {
    render(<RechercheGlobale sources={[SOURCE_SORTS, SOURCE_DONS]} />)
    const champ = screen.getByRole('combobox')
    await taper(champ, 'feu')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))

    fireEvent.keyDown(champ, { key: 'ArrowDown' })
    fireEvent.keyDown(champ, { key: 'Enter' })
    expect(pousse).toHaveBeenCalledWith('/sorts/boule-de-feu/', SANS_SAUT)
  })

  it('Échap referme la liste puis, au second appui, vide la requête', async () => {
    render(<RechercheGlobale sources={[SOURCE_SORTS, SOURCE_DONS]} />)
    const champ = screen.getByRole('combobox') as HTMLInputElement
    await taper(champ, 'feu')
    await waitFor(() => expect(screen.getByRole('listbox')).not.toBeNull())

    fireEvent.keyDown(champ, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(champ.value).toBe('feu')

    fireEvent.keyDown(champ, { key: 'Escape' })
    expect(champ.value).toBe('')
  })

  it('affiche un message sobre quand rien ne correspond', async () => {
    render(<RechercheGlobale sources={[SOURCE_VIDE]} />)
    const champ = screen.getByRole('combobox')
    await taper(champ, 'zzz-introuvable')

    await waitFor(() => expect(screen.getByText(/Aucun résultat/)).not.toBeNull())
  })

  it('le raccourci barre oblique donne le focus au champ depuis le document', () => {
    render(
      <div>
        <RechercheGlobale sources={[SOURCE_SORTS, SOURCE_DONS]} />
        <button type="button">ailleurs</button>
      </div>,
    )
    const champ = screen.getByRole('combobox') as HTMLInputElement
    screen.getByRole('button', { name: 'ailleurs' }).focus()
    expect(document.activeElement).not.toBe(champ)

    fireEvent.keyDown(document, { key: '/' })
    expect(document.activeElement).toBe(champ)
  })

  it("le raccourci barre oblique ne fait rien si le focus est déjà dans un champ, qui reçoit le caractère", () => {
    render(
      <div>
        <RechercheGlobale sources={[SOURCE_SORTS, SOURCE_DONS]} />
        <input aria-label="autre champ" type="text" />
      </div>,
    )
    const autreChamp = screen.getByRole('textbox', { name: 'autre champ' }) as HTMLInputElement
    autreChamp.focus()

    fireEvent.keyDown(autreChamp, { key: '/' })
    // The shortcut must not have claimed focus or the keystroke.
    expect(document.activeElement).toBe(autreChamp)
    fireEvent.change(autreChamp, { target: { value: '/' } })
    expect(autreChamp.value).toBe('/')
  })

  it('retire son écouteur de la barre oblique au démontage', () => {
    const { unmount } = render(<RechercheGlobale sources={[SOURCE_SORTS, SOURCE_DONS]} />)
    unmount()
    // No component is left to react — this must not throw, and no field
    // exists any more to receive focus.
    expect(() => fireEvent.keyDown(document, { key: '/' })).not.toThrow()
  })
})

describe('sourceFiches branchée dans la recherche globale', () => {
  it('rend un groupe Fiches quand une fiche correspond', async () => {
    const { sourceFiches } = await import('@/lib/recherche/source-fiches')
    const { creerFicheVide } = await import('@/lib/fiche_personnage/fiche-vide')
    const fiche = {
      ...creerFicheVide('f1', '2026-01-01T00:00:00.000Z'),
      meta: { ...creerFicheVide('f1', '2026-01-01T00:00:00.000Z').meta, nomPersonnage: 'Elara' },
    }
    render(<RechercheGlobale sources={[sourceFiches(() => [fiche])]} />)
    await taper(screen.getByRole('combobox'), 'elara')

    await waitFor(() => expect(screen.getByRole('listbox')).not.toBeNull())
    expect(screen.getByRole('group', { name: 'Fiches' })).not.toBeNull()
    expect(screen.getByRole('option', { name: 'Elara' })).not.toBeNull()
  })

  it("ne rend aucun groupe Fiches quand aucune fiche n'existe", async () => {
    const { sourceFiches } = await import('@/lib/recherche/source-fiches')
    render(<RechercheGlobale sources={[sourceFiches(() => [])]} />)
    await taper(screen.getByRole('combobox'), 'elara')

    await waitFor(() => expect(screen.getByText('Aucun résultat.')).not.toBeNull())
    expect(screen.queryByRole('group', { name: 'Fiches' })).toBeNull()
  })
})
