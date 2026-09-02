/**
 * The rendered comparison view.
 *
 * The criteria of this step are claims about what a user sees — « une colonne de
 * niveau par classe sélectionnée », « un état vide qui demande une seconde
 * classe », « une quatrième est refusée avec un message explicite » — so these
 * tests assert on rendered roles and text. The set logic is proven pure in
 * `lib/comparaison/ensembles.test.ts`; what remains here is whether the view
 * shows it and writes the URL.
 *
 * `next/navigation` and `next/link` are stubbed, same as the navigation tests.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type IndexWeb } from '@/lib/donnees/index-web'
import { CHEMIN_INDEX_FIXTURE, CHEMIN_INDEX_REEL } from '@/lib/donnees/lire-index'

const INDEX = JSON.parse(readFileSync(CHEMIN_INDEX_FIXTURE, 'utf8')) as IndexWeb
/** The fixture carries three classes, which is exactly the ceiling — so the
 * fourth-pick refusal needs the real 19-class index to have a fourth pick at all. */
const REEL = JSON.parse(readFileSync(CHEMIN_INDEX_REEL, 'utf8')) as IndexWeb

function coche(element: HTMLElement): boolean {
  return (element as HTMLInputElement).checked
}

const remplace = vi.fn()
/** See the browse route's test: `scroll: false` is a contract, not a default. */
const SANS_SAUT = { scroll: false }
let recherche = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: remplace, push: vi.fn() }),
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

const { VueComparaison } = await import('@/components/comparaison/VueComparaison')
const { TableComparaison } = await import('@/components/comparaison/TableComparaison')

function poserFetch(index: IndexWeb = INDEX): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => index })),
  )
}

/** Mount and wait for the fetched index: the selector is present in every state,
 * including the empty one, so it is the only safe thing to wait on. */
async function monter(query = '', index: IndexWeb = INDEX): Promise<void> {
  recherche = new URLSearchParams(query)
  poserFetch(index)
  render(<VueComparaison />)
  await screen.findByRole('group', { name: /Classes à comparer/ })
}

beforeEach(() => {
  remplace.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('le sélecteur de classes', () => {
  it('propose une case par classe de l’index, les 19 du corpus réel', async () => {
    await monter('', REEL)
    const groupe = screen.getByRole('group', { name: /Classes à comparer/ })
    expect(within(groupe).getAllByRole('checkbox')).toHaveLength(19)
    expect(REEL.classes).toHaveLength(19)
  })

  it('coche exactement les classes de l’URL', async () => {
    await monter('?classes=barde,druide')
    expect(coche(screen.getByRole('checkbox', { name: 'Barde' }))).toBe(true)
    expect(coche(screen.getByRole('checkbox', { name: 'Druide' }))).toBe(true)
    expect(coche(screen.getByRole('checkbox', { name: 'Occultiste' }))).toBe(false)
  })

  it('écrit la sélection dans l’URL, l’URL étant la seule source d’état', async () => {
    await monter('?classes=barde')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Druide' }))
    expect(remplace).toHaveBeenCalledWith('/comparaison?classes=barde%2Cdruide', SANS_SAUT)
  })

  it('refuse une quatrième classe avec un message explicite, sans avaler le clic', async () => {
    await monter('?classes=barde,druide,occultiste', REEL)
    const quatrieme = screen.getByRole('checkbox', { name: 'Paladin' })
    // Disabled rather than a swallowed click: an ignored interaction reads as a
    // broken selector.
    expect((quatrieme as HTMLInputElement).disabled).toBe(true)
    expect(
      screen.getByText(/Trois classes sélectionnées, le maximum/),
    ).toBeTruthy()
    await userEvent.click(quatrieme)
    expect(remplace).not.toHaveBeenCalled()
  })

  it('laisse décocher une classe quand le maximum est atteint', async () => {
    await monter('?classes=barde,druide,occultiste')
    const case_ = screen.getByRole('checkbox', { name: 'Druide' })
    expect((case_ as HTMLInputElement).disabled).toBe(false)
    await userEvent.click(case_)
    expect(remplace).toHaveBeenCalledWith('/comparaison?classes=barde%2Coccultiste', SANS_SAUT)
  })
})

describe('l’état vide', () => {
  it('sans sélection, demande deux classes et offre un chemin', async () => {
    await monter()
    expect(screen.getByText('Aucune classe sélectionnée')).toBeTruthy()
    expect(screen.getByText(/Choisissez deux classes/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Comparer Barde et Druide/ }))
    expect(remplace).toHaveBeenCalledWith('/comparaison?classes=barde%2Cdruide', SANS_SAUT)
  })

  it('avec une seule classe, dit qu’il en faut une seconde et nomme celle qui est prise', async () => {
    await monter('?classes=barde')
    expect(screen.getByText('Il manque une seconde classe')).toBeTruthy()
    expect(screen.getByText(/Barde est sélectionnée/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('les compteurs, rendus avant la table', () => {
  it('chiffre les partagés, les propres de chaque classe et les partiels', async () => {
    await monter('?classes=barde,druide,occultiste')
    // Read off the fixture: 5 shared by all three, 4 partial.
    expect(screen.getByText('En commun').previousElementSibling?.textContent).toBe('5')
    expect(screen.getByText('Partiels').previousElementSibling?.textContent).toBe('4')
    for (const classe of ['Barde', 'Druide', 'Occultiste']) {
      expect(screen.getByText(`Propres à ${classe}`)).toBeTruthy()
    }
  })

  it('n’annonce pas de partiels à deux classes : la case n’existe pas', async () => {
    await monter('?classes=barde,druide')
    expect(screen.queryByText('Partiels')).toBeNull()
  })

  it('place les compteurs avant la table dans l’ordre du document', async () => {
    await monter('?classes=barde,druide,occultiste')
    const compteur = screen.getByText('En commun')
    const table = screen.getByRole('table')
    expect(compteur.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })
})

describe('la table des partagés', () => {
  it('porte une colonne de niveau par classe sélectionnée, nommée par la classe', async () => {
    await monter('?classes=barde,druide,occultiste')
    for (const classe of ['Barde', 'Druide', 'Occultiste']) {
      expect(screen.getByRole('columnheader', { name: classe })).toBeTruthy()
    }
    expect(screen.getByRole('columnheader', { name: 'Écart' })).toBeTruthy()
    // No bare « Niveau » header: a level belongs to a class (B4).
    expect(screen.queryByRole('columnheader', { name: /^Niveau$/ })).toBeNull()
  })

  it('n’a que deux colonnes de niveau pour deux classes', async () => {
    await monter('?classes=barde,druide')
    expect(screen.queryByRole('columnheader', { name: 'Occultiste' })).toBeNull()
  })

  it('affiche pour un même sort le niveau propre à chaque classe', async () => {
    await monter('?classes=barde,druide,occultiste')
    const ligne = screen.getByRole('link', { name: 'Dégoût' }).closest('tr')
    const cellules = within(ligne as HTMLElement).getAllByRole('cell')
    // Sort, école, barde, druide, occultiste, écart.
    expect(cellules[2]?.textContent).toBe('2')
    expect(cellules[3]?.textContent).toBe('3')
    expect(cellules[4]?.textContent).toBe('2')
    expect(cellules[5]?.textContent).toBe('+1')
  })

  it('trie par écart décroissant et met en tête le plus grand différentiel', async () => {
    await monter('?classes=druide,occultiste&mode=tous')
    const lignes = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    // « Attirance » : druide 9, occultiste 6 — the widest spread in the fixture.
    expect(within(lignes[0] as HTMLElement).getByRole('link').textContent).toBe('Attirance')
    expect(
      within(lignes[0] as HTMLElement).getAllByRole('cell').at(-1)?.textContent,
    ).toBe('+3')
  })

  it('renvoie vers la fiche du sort', async () => {
    await monter('?classes=barde,druide,occultiste')
    expect(screen.getByRole('link', { name: 'Dégoût' }).getAttribute('href')).toBe(
      '/sorts/degout/',
    )
  })

  it('porte l’écart en chiffre et en texte, jamais par la seule couleur du badge', async () => {
    await monter('?classes=druide,occultiste&mode=tous')
    const lignes = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    const cellule = within(lignes[0] as HTMLElement).getAllByRole('cell').at(-1) as HTMLElement
    expect(cellule.textContent).toBe('+3')
    expect(cellule.querySelector('[title]')?.getAttribute('title')).toMatch(/3 niveaux d’écart/)
  })

  it('marque d’un tiret, jamais d’un 0, la classe qui ne reçoit pas le sort', async () => {
    // 0 is a real level (orisons), so an absence can never be printed as 0.
    render(
      <TableComparaison
        classes={['barde', 'druide']}
        index={INDEX}
        legende="test"
        sorts={[
          {
            sort: INDEX.sorts.find((sort) => sort.s === 'allie-involontaire')!,
            niveaux: { barde: 0 },
            ecart: null,
          },
        ]}
      />,
    )
    const cellules = screen.getAllByRole('cell')
    expect(cellules[2]?.textContent).toBe('0')
    expect(cellules[3]?.textContent).toBe('—')
    expect(cellules[4]?.textContent).toBe('—')
  })
})

describe('les modes', () => {
  it('groupe les boutons d’affichage sous un nom accessible « Afficher », sans deux-points', async () => {
    await monter('?classes=barde,druide')
    const groupe = screen.getByRole('group', { name: 'Afficher' })
    expect(within(groupe).getByRole('button', { name: 'Sorts partagés' })).toBeTruthy()
    expect(screen.queryByText('Afficher :')).toBeNull()
  })

  it('affiche le mode courant comme actif et écrit le changement dans l’URL', async () => {
    await monter('?classes=barde,druide')
    expect(
      screen.getByRole('button', { name: 'Sorts partagés' }).getAttribute('aria-pressed'),
    ).toBe('true')
    await userEvent.click(screen.getByRole('button', { name: 'Sorts exclusifs' }))
    expect(remplace).toHaveBeenCalledWith(
      '/comparaison?classes=barde%2Cdruide&mode=exclusifs',
      SANS_SAUT,
    )
  })

  it('en mode exclusifs, donne une section par classe avec son compte', async () => {
    await monter('?classes=barde,druide,occultiste&mode=exclusifs')
    // Fixture: bard 8 exclusives among the three, druid 6, occultist 1.
    expect(screen.getByRole('heading', { name: '8 sorts propres à Barde' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '6 sorts propres à Druide' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '1 sort propre à Occultiste' })).toBeTruthy()
    expect(within(screen.getAllByRole('table')[2] as HTMLElement).getByRole('link').textContent)
      .toBe('Talisman instrumental')
  })

  it('en mode tous, montre l’union — y compris un sort qu’une seule classe reçoit', async () => {
    await monter('?classes=barde,druide,occultiste&mode=tous')
    expect(screen.getByRole('link', { name: 'Talisman instrumental' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dégoût' })).toBeTruthy()
  })
})

describe('le chargement et la panne', () => {
  it('annonce le chargement avant l’arrivée de l’index', () => {
    recherche = new URLSearchParams()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    )
    render(<VueComparaison />)
    expect(screen.getByText(/Chargement de l’index/)).toBeTruthy()
  })

  it('dit que l’index n’a pas pu être chargé plutôt que de rester vide', async () => {
    recherche = new URLSearchParams()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    )
    render(<VueComparaison />)
    expect(await screen.findByText(/n’a pas pu être chargé/)).toBeTruthy()
  })
})
