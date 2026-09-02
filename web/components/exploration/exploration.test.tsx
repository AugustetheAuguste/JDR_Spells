/**
 * The exploration view as it is seen and clicked.
 *
 * The claims here are about the screen, not the props: « la tranche non filtrable
 * n'est pas cliquable » is a statement about a disabled control with a reason
 * written beside it, and a test on the slice object would pass while the ring
 * offered a wedge leading nowhere.
 *
 * `next/navigation` is stubbed, as in `navigation.test.tsx`: the URL contract is
 * proven pure in `lib/exploration/etat-exploration.test.ts`, and what is left to
 * check here is that the view reads it and calls push/replace at the right moment —
 * push for a drill, which the back button must undo, replace for re-slicing.
 */

import { render as rendreNu, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IndexWeb } from '@/lib/donnees/index-web'
import { CHEMIN_INDEX_FIXTURE } from '@/lib/donnees/lire-index'

const INDEX = JSON.parse(readFileSync(CHEMIN_INDEX_FIXTURE, 'utf8')) as IndexWeb

const remplace = vi.fn()
const pousse = vi.fn()
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

const { VueExploration } = await import('@/components/exploration/VueExploration')
const { FournisseurFavoris } = await import('@/lib/favoris/contexte')

/** `TableSorts` carries the favourite toggle on every row and `useFavoris` throws
 * without a provider by design, so the tests mount the tree the layout mounts. */
function render(ui: Parameters<typeof rendreNu>[0]): ReturnType<typeof rendreNu> {
  return rendreNu(<FournisseurFavoris>{ui}</FournisseurFavoris>)
}

/** Mount at a given query string and wait for the fetched index to land. The wait
 * is on the heading, which every state renders — waiting for a chart would hang on
 * the states that deliberately show none. */
async function monter(query: string, index: IndexWeb = INDEX): Promise<void> {
  recherche = new URLSearchParams(query)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => index })))
  render(<VueExploration />)
  await screen.findByRole('heading', { level: 1, name: 'Explorer' })
  // The index arrives in a promise, so the first paint is the loading line. Waiting
  // for it to go is the one anchor every following state shares — a chart, a table,
  // an empty state and « vous y êtes » have no common element between them.
  await waitFor(() => {
    expect(screen.queryByText(/Chargement de l’index/)).toBeNull()
  })
}

/** The query string of the last navigation, whichever verb was used. */
function derniereCible(): string {
  const appels = [...pousse.mock.calls, ...remplace.mock.calls]
  return String(appels.at(-1)?.[0] ?? '')
}

beforeEach(() => {
  remplace.mockClear()
  pousse.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('l’étape du choix de classe', () => {
  it('ouvre sur les classes, pas sur un graphique', async () => {
    await monter('')
    expect(screen.getByRole('checkbox', { name: /Barde/ })).toBeTruthy()
    expect(screen.queryByRole('img', { hidden: true })).toBeNull()
  })

  it('choisir une classe coche la carte, et « Valider » navigue', async () => {
    await monter('')
    await userEvent.click(screen.getByRole('checkbox', { name: /Barde/ }))
    expect(pousse).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Valider ce choix' }))
    expect(pousse).toHaveBeenCalledTimes(1)
    expect(derniereCible()).toContain('classe=barde')
  })

  it('plusieurs classes cochées à la fois donnent l’union de leurs sorts', async () => {
    await monter('')
    await userEvent.click(screen.getByRole('checkbox', { name: /Barde/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Druide/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Valider ce choix' }))
    expect(derniereCible()).toContain('classe=barde')
    expect(derniereCible()).toContain('classes=druide')
  })

  it('on peut explorer sans classe — et le lien porte alors son sens', async () => {
    await monter('')
    await userEvent.click(screen.getByRole('button', { name: /sans choisir de classe/i }))
    expect(derniereCible()).toContain('axe=niveau')
  })

  it('un lien partagé sans classe ouvre sur son graphique, pas à la porte', async () => {
    await monter('axe=ecole')
    expect(screen.queryByRole('button', { name: /sans choisir de classe/i })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: /école/i })).toBeTruthy()
  })
})

describe('le graphique et le forage', () => {
  it('nomme la classe au-dessus des niveaux — jamais un « Niveau » nu', async () => {
    await monter('classe=barde')
    const [titre] = screen.getAllByRole('heading', { level: 2 })
    expect(titre?.textContent).toContain('Barde')
  })

  it('chaque tranche est un vrai contrôle, avec son effectif', async () => {
    await monter('classe=barde')
    const tranches = screen.getAllByRole('checkbox', { name: /Niveau \d.*sorts/ })
    expect(tranches.length).toBeGreaterThan(1)
  })

  it('cocher une tranche puis valider pose le critère et empile une entrée d’historique', async () => {
    await monter('classe=barde')
    const [premiere] = screen.getAllByRole('checkbox', { name: /Niveau \d.*sorts/ })
    await userEvent.click(premiere as HTMLElement)
    expect(pousse).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Valider ce choix' }))
    expect(pousse).toHaveBeenCalledTimes(1)
    expect(derniereCible()).toMatch(/niveau=\d/)
    expect(derniereCible()).toContain('parcours=niveau')
  })

  it('plusieurs tranches cochées à la fois posent plusieurs niveaux', async () => {
    await monter('classe=barde')
    const tranches = screen.getAllByRole('checkbox', { name: /Niveau \d.*sorts/ })
    await userEvent.click(tranches[0] as HTMLElement)
    await userEvent.click(tranches[1] as HTMLElement)
    await userEvent.click(screen.getByRole('button', { name: 'Valider ce choix' }))
    expect(derniereCible()).toMatch(/niveau=\d(%2C|,|-)\d/)
  })

  it('changer de découpage remplace l’entrée, il ne l’empile pas', async () => {
    // Ten flips between two ways of cutting the same subset would otherwise bury
    // the drill the back button is supposed to undo.
    await monter('classe=barde')
    await userEvent.click(screen.getByRole('button', { name: 'Portée' }))
    expect(pousse).not.toHaveBeenCalled()
    expect(remplace).toHaveBeenCalledTimes(1)
    expect(derniereCible()).toContain('axe=portee')
  })

  it('le découpage affiché est signalé aux technologies d’assistance', async () => {
    await monter('classe=barde&axe=ecole')
    expect(screen.getByRole('button', { name: 'École' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'Niveau' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('une question déjà répondue se rouvre sur les tranches d’origine', async () => {
    // Cut with its own answer lifted: otherwise re-opening « quel niveau ? » shows
    // one full ring saying « ils sont tous de ce niveau », which is no chart at all.
    await monter('classe=barde&niveau=1&parcours=niveau&axe=niveau')
    const tranches = screen.getAllByRole('checkbox', { name: /Niveau \d.*sorts/ })
    expect(tranches.length).toBeGreaterThan(1)
  })

  it('un découpage à recouvrement dit qu’il se recouvre', async () => {
    await monter('classe=barde&axe=composante')
    expect(screen.getByText(/ne font pas 100/)).toBeTruthy()
  })
})

describe('ce que la source ne dit pas', () => {
  it('la tranche non renseignée est montrée, désactivée, avec sa raison', async () => {
    // Five of the bard's spells in the fixture carry no saving throw at all, as in
    // the corpus: the case is the data's, not a construction.
    await monter('classe=barde&axe=sauvegarde')
    const item = screen.getByText(/Non renseigné/).closest('li')
    expect(item).not.toBeNull()
    expect(within(item as HTMLElement).queryByRole('button')).toBeNull()
    expect(item?.textContent).toContain('Non filtrable')
  })
})

describe('remonter, retirer, repartir', () => {
  it('le chemin montre les crans dans l’ordre où ils ont été posés', async () => {
    await monter('classe=barde&niveau=2&ecoles=enchantement&parcours=ecole,niveau')
    const puces = screen.getAllByRole('listitem').map((item) => item.textContent ?? '')
    expect(puces[0]).toContain('Barde')
    expect(puces[1]).toContain('Enchantement')
    expect(puces[2]).toContain('Niveau 2')
  })

  it('remonter défait le dernier cran, et rien d’autre', async () => {
    await monter('classe=barde&niveau=2&ecoles=enchantement&parcours=ecole,niveau')
    await userEvent.click(screen.getByRole('button', { name: /Remonter d’un cran/ }))
    const cible = derniereCible()
    expect(cible).toContain('ecoles=enchantement')
    expect(cible).not.toContain('niveau=2')
  })

  it('la croix d’une puce retire ce cran-là, où qu’il soit dans le chemin', async () => {
    await monter('classe=barde&niveau=2&ecoles=enchantement&parcours=ecole,niveau')
    await userEvent.click(screen.getByRole('button', { name: /Retirer Enchantement/ }))
    const cible = derniereCible()
    expect(cible).toContain('niveau=2')
    expect(cible).not.toContain('ecoles=')
  })

  it('un critère venu du lien est montré comme tel, et retirable pareil', async () => {
    // A URL copied out of the table view knows nothing of a parcours. Its criteria
    // filter identically; what they are not is a step the reader took.
    await monter('classe=barde&ecoles=evocation')
    expect(screen.getByText(/repris du lien/)).toBeTruthy()
  })

  it('sans critère posé, il n’y a rien à remonter — le bouton n’existe pas', async () => {
    await monter('classe=barde')
    expect(screen.queryByRole('button', { name: /Remonter d’un cran/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Repartir de zéro/ })).toBeTruthy()
  })
})

describe('les impasses ont un état, pas un écran vide', () => {
  it('un ensemble vide explique et propose de remonter', async () => {
    await monter('classe=barde&niveau=9')
    expect(screen.getByText(/Aucun sort ne réunit ces critères/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Remonter d’un cran/ }).length).toBeGreaterThan(0)
  })

  it('quand plus rien ne sépare les sorts, la page le dit', async () => {
    const unSeul: IndexWeb = { ...INDEX, sorts: INDEX.sorts.slice(0, 1) }
    await monter('classe=barde', unSeul)
    expect(screen.getByText('Vous y êtes.')).toBeTruthy()
  })

  it('le lien vers le tableau part avec les mêmes critères', async () => {
    await monter('classe=barde&niveau=1')
    const lien = screen.getByRole('link', { name: /Voir ces sorts en tableau/ })
    expect(lien.getAttribute('href')).toBe('/')
  })
})
