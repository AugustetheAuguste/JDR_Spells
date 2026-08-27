/**
 * The rendered navigation view.
 *
 * The criteria in this step are about what a user *sees*, so these tests assert
 * on rendered text rather than on props: « le libellé du filtre de niveau nomme
 * la classe » is a claim about a string on screen, and a test that checks the
 * label prop would pass while the header showed something else.
 *
 * `next/navigation` and `next/link` are stubbed rather than mounted with a real
 * router: the URL contract itself is proven pure in `lib/navigation/etat-url.test.ts`,
 * and what remains to check here is that the view reads that state and calls
 * push/replace at the right moments.
 */

import { render as rendreNu, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type IndexWeb } from '@/lib/donnees/index-web'
import { CHEMIN_INDEX_FIXTURE } from '@/lib/donnees/lire-index'
import { ETAT_VIDE, type EtatUrl } from '@/lib/navigation/etat-url'

const INDEX = JSON.parse(readFileSync(CHEMIN_INDEX_FIXTURE, 'utf8')) as IndexWeb
const SANS_TAGS: IndexWeb = { ...INDEX, tags: [] }

const remplace = vi.fn()
const pousse = vi.fn()
/** Asserted on every write: without it the router scrolls back to the top of the
 * document after each facet click, which is what made posting several filters a
 * round trip down the page. It is a contract, not a default. */
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

const { PanneauFiltres } = await import('@/components/navigation/PanneauFiltres')
const { TableSorts } = await import('@/components/navigation/TableSorts')
const { VueNavigation } = await import('@/components/navigation/VueNavigation')
const { FournisseurFavoris } = await import('@/lib/favoris/contexte')

/**
 * Render inside the favourites provider.
 *
 * `TableSorts` carries the favourite toggle on every row since step 09, and
 * `useFavoris` throws without a provider by design — a stub would make every
 * toggle a silent no-op. So the tests mount the same tree the layout does.
 */
function render(ui: Parameters<typeof rendreNu>[0]): ReturnType<typeof rendreNu> {
  return rendreNu(<FournisseurFavoris>{ui}</FournisseurFavoris>)
}

function poserFetch(index: IndexWeb): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.includes('alias')
        ? { ok: true, json: async () => ({ version: 1, alias: { 'disgust spell': ['degout'] } }) }
        : { ok: true, json: async () => index },
    ),
  )
}

/**
 * Mount the view and wait for the fetched index to land.
 *
 * The wait is on the class selector, not on the table: a state whose filters
 * match nothing renders an empty state and no table at all, so waiting for a
 * table would hang exactly on the empty-state tests.
 */
async function monterVue(query = '', index: IndexWeb = INDEX): Promise<void> {
  recherche = new URLSearchParams(query)
  poserFetch(index)
  render(<VueNavigation />)
  await screen.findByLabelText('Classe')
}

beforeEach(() => {
  remplace.mockClear()
  pousse.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('le niveau à l’écran est relatif à la classe', () => {
  it('nomme la classe dans l’en-tête de colonne', async () => {
    await monterVue('classe=barde')
    expect(screen.getByRole('columnheader', { name: 'Niveau pour Barde' })).toBeTruthy()
  })

  it('sans classe, l’en-tête dit explicitement « toutes classes »', async () => {
    // The criterion, checked on rendered text: without a class the column must
    // not read « Niveau », as if the level were a property of the spell.
    await monterVue('')
    const entete = screen.getByRole('columnheader', { name: /toutes classes/i })
    // The header is a sort button now, so it carries a direction glyph after the
    // label. What matters is that the label still names the class-free reading.
    expect(entete.textContent).toContain('Niveau le plus bas, toutes classes')
    expect(screen.queryByRole('columnheader', { name: /^Niveau$/ })).toBeNull()
  })

  it('affiche deux niveaux différents pour le même sort selon la classe', async () => {
    // « Dégoût » : 2 for the bard, 3 for the druid. Rendered, not computed.
    for (const [classe, attendu] of [
      ['barde', '2'],
      ['druide', '3'],
    ] as const) {
      recherche = new URLSearchParams(`classe=${classe}`)
      poserFetch(INDEX)
      const { unmount } = render(<VueNavigation />)
      await screen.findByRole('table')
      const ligne = screen.getByRole('link', { name: 'Dégoût' }).closest('tr')
      expect(ligne).not.toBeNull()
      const cellules = within(ligne as HTMLElement).getAllByRole('cell')
      expect(cellules[1]?.textContent).toBe(attendu)
      unmount()
    }
  })

  it('restreint la liste aux sorts que la classe reçoit', async () => {
    await monterVue('classe=occultiste')
    // 6 spells in the fixture are on the occultist's list; « Aire de l'aigle »
    // (druid only) is not one of them.
    const lignes = screen.getAllByRole('row').slice(1)
    expect(lignes).toHaveLength(
      INDEX.sorts.filter((sort) => sort.niv['occultiste'] !== undefined).length,
    )
    expect(screen.queryByRole('link', { name: "Aire de l'aigle" })).toBeNull()
  })

  it('affiche un tiret cadratin, pas un zéro, pour un niveau absent', async () => {
    const { container } = render(
      <TableSorts
        classe="barde"
        index={INDEX}
        sorts={[INDEX.sorts.find((s) => s.id === 'talisman-instrumental')!]}
      />,
    )
    expect(within(container).getAllByRole('cell')[1]?.textContent).toBe('—')
  })

  it('le titre de la cellule dit ce que le nombre veut dire', async () => {
    await monterVue('')
    const ligne = screen.getByRole('link', { name: 'Dégoût' }).closest('tr') as HTMLElement
    const cellule = within(ligne).getAllByRole('cell')[1] as HTMLElement
    expect(cellule.querySelector('[title]')?.getAttribute('title')).toContain('Barde 2')
  })
})

describe('l’état d’URL', () => {
  it('restitue exactement l’état d’une URL collée', async () => {
    await monterVue('classe=druide&niveau=3&ecoles=enchantement')
    expect((screen.getByLabelText('Classe') as HTMLSelectElement).value).toBe('druide')
    expect((screen.getByRole('checkbox', { name: 'Niveau 3' }) as HTMLInputElement).checked).toBe(
      true,
    )
    expect(
      (screen.getByRole('checkbox', { name: /enchantement/i }) as HTMLInputElement).checked,
    ).toBe(true)
    expect(screen.getByRole('link', { name: 'Dégoût' })).toBeTruthy()
  })

  it('un ajustement de filtre passe par replace, sans entrée d’historique', async () => {
    await monterVue('classe=barde')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Niveau 2' }))
    expect(remplace).toHaveBeenCalledWith('/?classe=barde&niveau=2', SANS_SAUT)
    expect(pousse).not.toHaveBeenCalled()
  })

  it('un changement de classe passe par push : c’est une navigation', async () => {
    // Ten filter clicks that each add a history entry make the back button
    // useless; a class change is the one thing worth going back to.
    await monterVue('')
    await userEvent.selectOptions(screen.getByLabelText('Classe'), 'druide')
    expect(pousse).toHaveBeenCalledWith('/?classe=druide', SANS_SAUT)
    expect(remplace).not.toHaveBeenCalled()
  })

  it('écrit la recherche dans l’URL après la frappe', async () => {
    // Real timers and a `waitFor`, not fake ones: the debounce is 80 ms, so
    // waiting for it costs nothing, and `vi.useFakeTimers()` here leaked into
    // every later test in the file — each one then timed out at 5 s.
    await monterVue('')
    await userEvent.type(screen.getByLabelText('Chercher un sort'), 'degout')
    await vi.waitFor(() => expect(remplace).toHaveBeenLastCalledWith('/?q=degout', SANS_SAUT))
  })

  it('« Tout effacer » ramène à la route nue', async () => {
    await monterVue('classe=barde&niveau=1')
    await userEvent.click(screen.getByRole('button', { name: 'Tout effacer' }))
    expect(pousse).toHaveBeenCalledWith('/', SANS_SAUT)
  })

  it('n’offre pas « Tout effacer » quand rien n’est filtré', async () => {
    await monterVue('')
    expect(screen.queryByRole('button', { name: 'Tout effacer' })).toBeNull()
  })
})

describe('la section des tags', () => {
  it('groupe les tags et n’ouvre un groupe que sur demande', async () => {
    await monterVue('')
    // Folded by default: thirty-five tags at once is an inventory, not a filter.
    const groupe = screen.getByRole('button', { name: /Chiffres et jets/ })
    expect(groupe.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(groupe)
    expect(groupe.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: /^Bonus chiffré/ })).toBeTruthy()
  })

  it('ouvre d’emblée le groupe qui porte un tag posé', async () => {
    // A shared link must never hide its own filters behind a closed fold.
    await monterVue('tags=bonus_chiffre')
    expect(
      screen.getByRole('button', { name: /Chiffres et jets/ }).getAttribute('aria-expanded'),
    ).toBe('true')
  })

  it('un premier clic exige le tag', async () => {
    await monterVue('')
    await userEvent.click(screen.getByRole('button', { name: /Chiffres et jets/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Bonus chiffré/ }))
    expect(remplace).toHaveBeenCalledWith('/?tags=bonus_chiffre', SANS_SAUT)
  })

  it('un second clic exclut le tag au lieu de le relâcher', async () => {
    await monterVue('tags=bonus_chiffre')
    await userEvent.click(screen.getByRole('button', { name: /^Bonus chiffré/ }))
    expect(remplace).toHaveBeenCalledWith('/?tags=-bonus_chiffre', SANS_SAUT)
  })

  it('un troisième clic ne filtre plus', async () => {
    await monterVue('tags=-bonus_chiffre')
    await userEvent.click(screen.getByRole('button', { name: /^Bonus chiffré/ }))
    expect(remplace).toHaveBeenCalledWith('/', SANS_SAUT)
  })

  it('n’est pas rendue du tout quand index.tags est vide', async () => {
    // No empty section and no explanatory error: an empty filter group invites
    // the user to hunt for a control that is not there.
    await monterVue('', SANS_TAGS)
    expect(screen.queryByText(/^Tags$/)).toBeNull()
  })

  it('ignore un tag présent dans l’URL quand la couche est absente', async () => {
    await monterVue('tags=bonus_chiffre', SANS_TAGS)
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  })
})

describe('le tri par colonne', () => {
  const entetePortee = (): HTMLElement =>
    screen.getByRole('columnheader', { name: /Portée/ })

  it('un clic trie sur la colonne cliquée', async () => {
    await monterVue('')
    expect(entetePortee().getAttribute('aria-sort')).toBe('none')
    await userEvent.click(screen.getByRole('button', { name: /Portée/ }))
    expect(remplace).toHaveBeenCalledWith('/?tri=portee', SANS_SAUT)
  })

  it('un second clic inverse le sens', async () => {
    await monterVue('tri=portee')
    expect(entetePortee().getAttribute('aria-sort')).toBe('ascending')
    await userEvent.click(screen.getByRole('button', { name: /Portée/ }))
    expect(remplace).toHaveBeenCalledWith('/?tri=-portee', SANS_SAUT)
  })

  it('un troisième clic rend au tableau son ordre par niveau', async () => {
    // The way back: without it, only « Tout effacer » — which also drops every
    // filter — could restore the level order.
    await monterVue('tri=-portee')
    expect(entetePortee().getAttribute('aria-sort')).toBe('descending')
    await userEvent.click(screen.getByRole('button', { name: /Portée/ }))
    expect(remplace).toHaveBeenCalledWith('/', SANS_SAUT)
  })

  it('écarte une colonne que l’URL ne sait pas nommer', async () => {
    await monterVue('tri=couleur-preferee')
    expect(entetePortee().getAttribute('aria-sort')).toBe('none')
  })
})

describe('l’état vide', () => {
  it('nomme le filtre le plus restrictif et propose de le retirer', async () => {
    await monterVue('classe=barde&niveau=9')
    expect(screen.getByText('Aucun sort ne correspond')).toBeTruthy()
    const bouton = screen.getByRole('button', { name: 'Retirer le niveau' })
    await userEvent.click(bouton)
    expect(remplace).toHaveBeenCalledWith('/?classe=barde', SANS_SAUT)
  })

  it('nomme la recherche quand c’est elle qui vide la liste', async () => {
    recherche = new URLSearchParams('q=xyzzyquux')
    poserFetch(INDEX)
    render(<VueNavigation />)
    expect(await screen.findByText('Aucun sort ne correspond')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retirer la recherche' })).toBeTruthy()
  })

  it('offre toujours une porte de sortie dans l’état vide lui-même', async () => {
    // Scoped to the empty state: the sidebar also carries a « Tout effacer », and
    // the point here is that the empty state is not a dead end on its own.
    await monterVue('classe=barde&niveau=9')
    const bloc = screen.getByText('Aucun sort ne correspond').closest('div') as HTMLElement
    expect(within(bloc).getByRole('button', { name: 'Tout effacer' })).toBeTruthy()
  })
})

describe('la recherche dans la vue', () => {
  it('trouve un sort par son nom sans accent', async () => {
    await monterVue('q=degout')
    expect(screen.getByRole('link', { name: 'Dégoût' })).toBeTruthy()
  })

  it('signale un sort atteint par son alias anglais', async () => {
    await monterVue('q=disgust spell')
    const ligne = screen.getByRole('link', { name: 'Dégoût' }).closest('tr') as HTMLElement
    expect(within(ligne).getByText('alias')).toBeTruthy()
  })

  it('rend la liste avant que le moteur ne soit chargé, sans attendre', async () => {
    // The engine is imported dynamically (~11 kB gzipped, and useless before the
    // index lands), so there is a moment where the index is there and the engine is
    // not. Browsing must work in that moment: only a query needs the engine. The
    // two tests above cover the other half — once loaded, it really searches, alias
    // path included, which is impossible unless the dynamic import resolved.
    await monterVue('classe=barde')
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  })
})

describe('le désaccord de niveau', () => {
  it('est signalé dans la table, sans être présenté comme une erreur', async () => {
    // « Détection de la magie » carries d: true in the fixture. The wording must
    // not accuse: a divergence is a recorded fact of the corpus.
    await monterVue('')
    const ligne = screen
      .getByRole('link', { name: 'Détection de la magie' })
      .closest('tr') as HTMLElement
    const marqueur = within(ligne).getByText('désaccord')
    expect(marqueur).toBeTruthy()
    expect(marqueur.getAttribute('title')).not.toMatch(/erreur|faute|incorrect/i)
  })

  it('le filtre des désaccords ne garde que ceux-là', async () => {
    await monterVue('desaccords=1')
    const lignes = screen.getAllByRole('row').slice(1)
    expect(lignes).toHaveLength(INDEX.sorts.filter((sort) => sort.d).length)
    expect(screen.getByRole('link', { name: 'Détection de la magie' })).toBeTruthy()
  })
})

describe('l’accessibilité', () => {
  it('rend les filtres atteignables au clavier, comme cases natives', async () => {
    await monterVue('')
    for (const nom of ['Niveau 0', 'Composante V']) {
      const case_ = screen.getByRole('checkbox', { name: nom })
      expect(case_.tagName).toBe('INPUT')
      expect(case_.getAttribute('type')).toBe('checkbox')
    }
  })

  it('coche un filtre à la barre d’espace', async () => {
    await monterVue('classe=barde')
    screen.getByRole('checkbox', { name: 'Niveau 1' }).focus()
    await userEvent.keyboard(' ')
    expect(remplace).toHaveBeenCalledWith('/?classe=barde&niveau=1', SANS_SAUT)
  })

  it('groupe chaque filtre sous une légende annoncée', async () => {
    await monterVue('')
    for (const nom of ['École', 'Composantes', 'Jet de sauvegarde', 'Signalements']) {
      expect(screen.getByRole('group', { name: nom })).toBeTruthy()
    }
  })

  it('donne à la table une légende qui dit de quoi le niveau dépend', async () => {
    await monterVue('classe=barde')
    expect(screen.getByRole('table').querySelector('caption')?.textContent).toContain(
      'niveau pour cette classe',
    )
  })

  it('annonce le nombre de résultats', async () => {
    await monterVue('classe=barde')
    const attendu = INDEX.sorts.filter((sort) => sort.niv['barde'] !== undefined).length
    expect(screen.getByText(`${attendu} sorts correspondent.`)).toBeTruthy()
  })
})

describe('le panneau de filtres, isolé', () => {
  function monterPanneau(etat: EtatUrl, index: IndexWeb = INDEX) {
    const surEtat = vi.fn()
    const surClasse = vi.fn()
    render(
      <PanneauFiltres etat={etat} index={index} surClasse={surClasse} surEtat={surEtat} />,
    )
    return { surEtat, surClasse }
  }

  it('canonise l’ordre des écoles quel que soit l’ordre des clics', async () => {
    // Two users filtering the same way must be able to share the same link.
    const { surEtat } = monterPanneau({ ...ETAT_VIDE, ecoles: ['evocation'] })
    await userEvent.click(screen.getByRole('checkbox', { name: /abjuration/i }))
    expect(surEtat).toHaveBeenCalledWith(
      expect.objectContaining({ ecoles: ['abjuration', 'evocation'] }),
    )
  })

  it('explique pourquoi le niveau a besoin d’une classe quand aucune n’est choisie', async () => {
    monterPanneau(ETAT_VIDE)
    expect(screen.getByText(/n’a pas de niveau en soi/)).toBeTruthy()
  })

  it('pose la classe avant le niveau dans l’ordre du document', async () => {
    // The hierarchy on screen has to state the dependency in the data: the level
    // filter below only means something relative to the class above it.
    monterPanneau(ETAT_VIDE)
    const classe = screen.getByLabelText('Classe')
    const niveau = screen.getByRole('group', { name: /toutes classes/ })
    expect(classe.compareDocumentPosition(niveau) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
