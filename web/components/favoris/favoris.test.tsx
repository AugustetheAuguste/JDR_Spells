/**
 * The rendered favourites: the toggle, the view, and the vocabulary.
 *
 * The criteria this file answers are the ones only a mounted component can:
 * « ajouter puis recharger la page : le favori persiste » is a claim about a real
 * `localStorage` round trip through the provider, and « les libellés de bouton et
 * les messages de retour emploient le même verbe » is a claim about strings on
 * screen. The pure contract lives in `lib/favoris/stockage.test.ts`.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type IndexWeb } from '@/lib/donnees/index-web'
import { CHEMIN_INDEX_FIXTURE } from '@/lib/donnees/lire-index'
import { reinitialiserCache } from '@/lib/favoris/magasin'
import { CLE_SAUVEGARDE, CLE_STOCKAGE } from '@/lib/favoris/stockage'

const INDEX = JSON.parse(readFileSync(CHEMIN_INDEX_FIXTURE, 'utf8')) as IndexWeb

const pousse = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pousse, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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

const { FournisseurFavoris } = await import('@/lib/favoris/contexte')
const { BoutonFavori } = await import('@/components/favoris/BoutonFavori')
const { VueFavoris } = await import('@/components/favoris/VueFavoris')

function poserFetch(reponse: 'index' | 'panne' = 'index'): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      reponse === 'index'
        ? { ok: true, json: async () => INDEX }
        : { ok: false, status: 500, json: async () => ({}) },
    ),
  )
}

/** Mount the toggle and wait for storage to have been read: before that it is
 * deliberately disabled, so clicking too early would test nothing. */
async function monterBouton(id_sort = 'degout'): Promise<void> {
  render(
    <FournisseurFavoris>
      <BoutonFavori id_sort={id_sort} />
    </FournisseurFavoris>,
  )
  await vi.waitFor(() => {
    expect(screen.getByRole('button')).not.toHaveProperty('disabled', true)
  })
}

async function monterVue(reponse: 'index' | 'panne' = 'index'): Promise<void> {
  poserFetch(reponse)
  render(
    <FournisseurFavoris>
      <VueFavoris />
    </FournisseurFavoris>,
  )
  await screen.findByRole('heading', { name: 'Favoris' })
}

beforeEach(() => {
  window.localStorage.clear()
  // The snapshot cache is module-level, so it outlives a component tree: without
  // this, test N+1 would read test N's parse.
  reinitialiserCache()
  pousse.mockClear()
  poserFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('le bouton de bascule', () => {
  it('emploie le même verbe du bouton au message de retour', async () => {
    await monterBouton()
    const bouton = screen.getByRole('button')
    expect(bouton.getAttribute('title')).toBe('Ajouter aux favoris')
    await userEvent.click(bouton)
    // Same verb, next tense: « Ajouter » → « Ajouté », then « Retirer ».
    expect(screen.getByText('Ajouté aux favoris')).toBeTruthy()
    expect(screen.getByRole('button').getAttribute('title')).toBe('Retirer des favoris')
  })

  it('porte l’état dans aria-pressed, pas seulement dans une couleur', async () => {
    await monterBouton()
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it('ne prétend rien avant d’avoir lu le stockage', () => {
    // The pre-ready state is not observable through `render`, which flushes
    // effects inside `act`. It is observable by rendering the markup the way the
    // export does — with no browser at all — which is exactly the case the guard
    // exists for: the prerendered HTML must not claim « pas en favori ».
    const html = renderToStaticMarkup(
      <FournisseurFavoris>
        <BoutonFavori id_sort="degout" />
      </FournisseurFavoris>,
    )
    expect(html).toContain('Lecture des favoris en cours')
    expect(html).toContain('disabled')
    expect(html).not.toContain('Ajouté aux favoris')
  })

  it('persiste : après rechargement, le favori est encore là', async () => {
    const premier = render(
      <FournisseurFavoris>
        <BoutonFavori id_sort="degout" />
      </FournisseurFavoris>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /Ajouter aux favoris/ }))
    expect(window.localStorage.getItem(CLE_STOCKAGE)).toContain('degout')

    // Unmounting and remounting is what a page reload is, from here.
    premier.unmount()
    render(
      <FournisseurFavoris>
        <BoutonFavori id_sort="degout" />
      </FournisseurFavoris>,
    )
    expect(
      (await screen.findByRole('button', { name: /Retirer des favoris/ })).getAttribute(
        'aria-pressed',
      ),
    ).toBe('true')
  })

  it('crée la liste par défaut au premier clic, sans la demander', async () => {
    await monterBouton()
    await userEvent.click(screen.getByRole('button', { name: /Ajouter aux favoris/ }))
    const enregistre = JSON.parse(window.localStorage.getItem(CLE_STOCKAGE) as string) as {
      readonly listes: readonly { readonly nom: string; readonly sorts: readonly string[] }[]
    }
    expect(enregistre.listes).toHaveLength(1)
    expect(enregistre.listes[0]?.nom).toBe('Ma liste')
    expect(enregistre.listes[0]?.sorts).toEqual(['degout'])
  })

  it('en version compacte, garde un nom accessible', async () => {
    render(
      <FournisseurFavoris>
        <BoutonFavori compact id_sort="degout" />
      </FournisseurFavoris>,
    )
    // The star is aria-hidden, so the accessible name comes from the sr-only text.
    expect(await screen.findByRole('button', { name: 'Ajouter aux favoris' })).toBeTruthy()
  })
})

describe('la vue des favoris', () => {
  it('dit que le stockage est local et sans synchronisation', async () => {
    await monterVue()
    expect(screen.getByText(/dans ce navigateur seulement/)).toBeTruthy()
    expect(screen.getByText(/aucune synchronisation entre appareils/)).toBeTruthy()
  })

  it('sur une liste vide, explique comment en remplir une', async () => {
    await monterVue()
    expect(screen.getByText('Liste vide')).toBeTruthy()
    expect(screen.getByText(/L’étoile sur une fiche de sort/)).toBeTruthy()
  })

  it('rend le contenu de la liste active avec les niveaux par classe', async () => {
    window.localStorage.setItem(
      CLE_STOCKAGE,
      JSON.stringify({
        version: 1,
        listes: [{ id_liste: 'l1', nom: 'Mon barde', sorts: ['degout'], cree_le: '', modifie_le: '' }],
        liste_active: 'l1',
      }),
    )
    await monterVue()
    const ligne = (await screen.findByRole('link', { name: 'Dégoût' })).closest('tr')
    const cellules = within(ligne as HTMLElement).getAllByRole('cell')
    // A level always names its class (B4): never a bare number here either.
    expect(cellules[2]?.textContent).toBe('Barde 2 · Druide 3 · Occultiste 2')
  })

  it('signale un id inconnu, le garde, et ne casse pas la table', async () => {
    window.localStorage.setItem(
      CLE_STOCKAGE,
      JSON.stringify({
        version: 1,
        listes: [
          {
            id_liste: 'l1',
            nom: 'A',
            sorts: ['degout', 'sort-renomme-par-une-correction'],
            cree_le: '',
            modifie_le: '',
          },
        ],
        liste_active: 'l1',
      }),
    )
    await monterVue()
    expect(await screen.findByText(/1 inconnu\(s\)/)).toBeTruthy()
    expect(screen.getByText(/Ils sont/)).toBeTruthy()
    expect(screen.getByText(/sort-renomme-par-une-correction/)).toBeTruthy()
    // And it is still in storage: reporting is not pruning.
    expect(window.localStorage.getItem(CLE_STOCKAGE)).toContain(
      'sort-renomme-par-une-correction',
    )
  })

  it('reste lisible quand l’index ne charge pas : les ids sont la donnée', async () => {
    window.localStorage.setItem(
      CLE_STOCKAGE,
      JSON.stringify({
        version: 1,
        listes: [{ id_liste: 'l1', nom: 'A', sorts: ['degout'], cree_le: '', modifie_le: '' }],
        liste_active: 'l1',
      }),
    )
    await monterVue('panne')
    expect(await screen.findByText('degout')).toBeTruthy()
  })

  it('annonce un stockage corrompu et nomme la clé de sauvegarde', async () => {
    window.localStorage.setItem(CLE_STOCKAGE, '{pas du json')
    await monterVue()
    const alerte = screen.getByRole('alert')
    expect(alerte.textContent).toContain('illisibles')
    expect(alerte.textContent).toContain(CLE_SAUVEGARDE)
    expect(window.localStorage.getItem(CLE_SAUVEGARDE)).toBe('{pas du json')
  })

  it('annonce une version illisible sans prétendre l’avoir migrée', async () => {
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ version: 42, listes: [] }))
    await monterVue()
    expect(screen.getByRole('alert').textContent).toContain('version')
    expect(screen.getByRole('alert').textContent).toContain('42')
  })

  it('demande confirmation avant de supprimer une liste', async () => {
    window.localStorage.setItem(
      CLE_STOCKAGE,
      JSON.stringify({
        version: 1,
        listes: [{ id_liste: 'l1', nom: 'A', sorts: ['degout'], cree_le: '', modifie_le: '' }],
        liste_active: 'l1',
      }),
    )
    await monterVue()
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la liste' }))
    const dialogue = screen.getByRole('alertdialog', { name: 'Confirmer la suppression' })
    expect(dialogue.textContent).toContain('définitif')
    // Cancelling changes nothing.
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Annuler' }))
    expect(window.localStorage.getItem(CLE_STOCKAGE)).toContain('degout')

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la liste' }))
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))
    expect(window.localStorage.getItem(CLE_STOCKAGE)).not.toContain('degout')
  })

  it('renomme la liste active', async () => {
    window.localStorage.setItem(
      CLE_STOCKAGE,
      JSON.stringify({
        version: 1,
        listes: [{ id_liste: 'l1', nom: 'A', sorts: [], cree_le: '', modifie_le: '' }],
        liste_active: 'l1',
      }),
    )
    await monterVue()
    await userEvent.click(screen.getByRole('button', { name: 'Renommer' }))
    const champ = screen.getByLabelText('Nouveau nom')
    await userEvent.clear(champ)
    await userEvent.type(champ, 'Mon oracle')
    // Two buttons read « Renommer » — the one that opens the form and the one
    // that submits it. Same verb throughout is the rule, so scope the query.
    const formulaire = champ.closest('form') as HTMLElement
    await userEvent.click(within(formulaire).getByRole('button', { name: 'Renommer' }))
    expect(window.localStorage.getItem(CLE_STOCKAGE)).toContain('Mon oracle')
  })

  it('crée une seconde liste et permet d’en changer', async () => {
    await monterVue()
    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle liste' }))
    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle liste' }))
    const selecteur = screen.getByLabelText('Liste') as HTMLSelectElement
    expect(selecteur.options).toHaveLength(2)
  })
})

describe('l’import', () => {
  function fichier(contenu: unknown): File {
    return new File([JSON.stringify(contenu)], 'favoris.json', { type: 'application/json' })
  }

  async function poserListeActive(sorts: readonly string[]): Promise<void> {
    window.localStorage.setItem(
      CLE_STOCKAGE,
      JSON.stringify({
        version: 1,
        listes: [{ id_liste: 'l1', nom: 'A', sorts, cree_le: '', modifie_le: '' }],
        liste_active: 'l1',
      }),
    )
    await monterVue()
  }

  it('ne modifie rien avant un choix explicite, puis fusionne sans rien perdre', async () => {
    await poserListeActive(['deja'])
    await userEvent.upload(
      screen.getByLabelText('Fichier de favoris à importer'),
      fichier({ version: 1, listes: [{ id_liste: 'x', nom: 'X', sorts: ['neuf', 'deja'] }] }),
    )
    const dialogue = await screen.findByRole('alertdialog', {
      name: 'Choisir le mode d’import',
    })
    expect(dialogue.textContent).toContain('Rien n’a encore changé')
    // Storage untouched while the question is open.
    expect(window.localStorage.getItem(CLE_STOCKAGE)).not.toContain('neuf')

    await userEvent.click(
      within(dialogue).getByRole('button', { name: /Fusionner avec la liste active/ }),
    )
    const enregistre = window.localStorage.getItem(CLE_STOCKAGE) as string
    expect(enregistre).toContain('neuf')
    expect(enregistre).toContain('deja')
    const compte = await screen.findByText(/Import terminé/)
    expect(compte.textContent).toContain('1 id(s) ajouté(s)')
    expect(compte.textContent).toContain('1 déjà présent(s)')
  })

  it('en mode nouvelle liste, laisse la liste active intacte', async () => {
    await poserListeActive(['deja'])
    await userEvent.upload(
      screen.getByLabelText('Fichier de favoris à importer'),
      fichier({ version: 1, listes: [{ id_liste: 'x', nom: 'Importée', sorts: ['neuf'] }] }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Créer de nouvelles listes' }),
    )
    const enregistre = JSON.parse(window.localStorage.getItem(CLE_STOCKAGE) as string) as {
      readonly liste_active: string
      readonly listes: readonly { readonly sorts: readonly string[] }[]
    }
    expect(enregistre.liste_active).toBe('l1')
    expect(enregistre.listes[0]?.sorts).toEqual(['deja'])
    expect(enregistre.listes[1]?.sorts).toEqual(['neuf'])
  })

  it('refuse un fichier illisible en le disant, sans rien modifier', async () => {
    await poserListeActive(['deja'])
    await userEvent.upload(
      screen.getByLabelText('Fichier de favoris à importer'),
      new File(['{pas du json'], 'x.json', { type: 'application/json' }),
    )
    expect(await screen.findByText(/n’est pas du JSON lisible/)).toBeTruthy()
    expect(window.localStorage.getItem(CLE_STOCKAGE)).toContain('deja')
  })

  it('refuse une version inconnue en le disant, sans rien modifier', async () => {
    await poserListeActive(['deja'])
    await userEvent.upload(
      screen.getByLabelText('Fichier de favoris à importer'),
      fichier({ version: 99, listes: [] }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: /Fusionner avec la liste active/ }),
    )
    expect(screen.getByText(/pas une liste de favoris en version 1/)).toBeTruthy()
    expect(window.localStorage.getItem(CLE_STOCKAGE)).toContain('deja')
  })

  it('offre l’export du fichier depuis la liste active', async () => {
    await poserListeActive(['degout'])
    expect(screen.getByRole('button', { name: 'Exporter en JSON' })).toBeTruthy()
  })
})
