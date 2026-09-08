/**
 * The assembled sheet view: loading, an unknown id, autosave debounced to one
 * write, the breadcrumb, and the structural ban on any consumption/weight
 * wording anywhere in this directory's rendered output or source.
 *
 * `next/navigation` and `next/link` are stubbed the same way
 * `comparaison.test.tsx` stubs them, and network reads of `/data/regles/*`
 * are stubbed to empty tables — this suite is about the shell, not the
 * engine, which already has its own tests.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { creerFicheVide } from '@/lib/fiche_personnage/fiche-vide'
import { ecrire } from '@/lib/fiche_personnage/magasin'
import { FournisseurFiches } from '@/lib/fiche_personnage/contexte-fiches'

let recherche = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
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

const { VueFiche } = await import('./VueFiche')

function poserFetchVide(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })),
  )
}

beforeEach(() => {
  window.localStorage.clear()
  recherche = new URLSearchParams()
  poserFetchVide()
})

afterEach(() => {
  window.localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('VueFiche', () => {
  it('affiche un état clair quand l’identifiant est absent, jamais un formulaire vide', () => {
    render(
      <FournisseurFiches>
        <VueFiche />
      </FournisseurFiches>,
    )
    expect(screen.queryByLabelText('Nom du personnage')).toBeNull()
    expect(screen.getByText('aucune fiche sous cet identifiant')).not.toBeNull()
  })

  it('affiche un état clair pour un identifiant inconnu, jamais un formulaire vide', () => {
    recherche = new URLSearchParams({ id: 'inconnu' })
    render(
      <FournisseurFiches>
        <VueFiche />
      </FournisseurFiches>,
    )
    expect(screen.queryByLabelText('Nom du personnage')).toBeNull()
    expect(screen.getByText('aucune fiche sous cet identifiant')).not.toBeNull()
  })

  it('affiche la fiche existante, sans bouton d’enregistrement', async () => {
    const maintenant = '2026-07-31T10:00:00.000Z'
    const fiche = { ...creerFicheVide('f1', maintenant), meta: { ...creerFicheVide('f1', maintenant).meta, nomPersonnage: 'Elara' } }
    ecrire(window.localStorage, fiche)
    recherche = new URLSearchParams({ id: 'f1' })

    render(
      <FournisseurFiches>
        <VueFiche />
      </FournisseurFiches>,
    )

    await waitFor(() => {
      expect((screen.getByLabelText('Nom du personnage') as HTMLInputElement).value).toBe('Elara')
    })
    expect(screen.queryByRole('button', { name: /enregistrer/i })).toBeNull()
  })

  it('porte le nom de la fiche en dernier segment du fil d’Ariane, avec aria-current', async () => {
    const maintenant = '2026-07-31T10:00:00.000Z'
    const fiche = { ...creerFicheVide('f1', maintenant), meta: { ...creerFicheVide('f1', maintenant).meta, nomPersonnage: 'Elara' } }
    ecrire(window.localStorage, fiche)
    recherche = new URLSearchParams({ id: 'f1' })

    render(
      <FournisseurFiches>
        <VueFiche />
      </FournisseurFiches>,
    )

    await waitFor(() => {
      const courant = screen.getByText('Elara', { selector: '[aria-current="page"]' })
      expect(courant).not.toBeNull()
    })
  })

  it('propose les autres fiches dans le sélecteur du fil d’Ariane', async () => {
    const maintenant = '2026-07-31T10:00:00.000Z'
    ecrire(window.localStorage, { ...creerFicheVide('f1', maintenant), meta: { ...creerFicheVide('f1', maintenant).meta, nomPersonnage: 'Elara' } })
    ecrire(window.localStorage, { ...creerFicheVide('f2', maintenant), meta: { ...creerFicheVide('f2', maintenant).meta, nomPersonnage: 'Bram' } })
    recherche = new URLSearchParams({ id: 'f1' })

    render(
      <FournisseurFiches>
        <VueFiche />
      </FournisseurFiches>,
    )

    await waitFor(() => screen.getByRole('button', { name: /Elara/ }))
    await userEvent.click(screen.getByRole('button', { name: /Elara/ }))
    expect(screen.getByRole('option', { name: 'Bram' })).not.toBeNull()
  })

  it('enregistre une seule fois après une rafale de frappes, après le délai de repos', async () => {
    const maintenant = '2026-07-31T10:00:00.000Z'
    ecrire(window.localStorage, creerFicheVide('f1', maintenant))
    recherche = new URLSearchParams({ id: 'f1' })

    render(
      <FournisseurFiches>
        <VueFiche />
      </FournisseurFiches>,
    )

    const champ = await screen.findByLabelText('Nom du personnage')
    const ecritureCombat = vi.spyOn(Storage.prototype, 'setItem')

    await userEvent.type(champ, 'Elara')

    await new Promise((resoudre) => setTimeout(resoudre, 2000))

    const ecrituresDeCetteFiche = ecritureCombat.mock.calls.filter(([cle]) => cle === 'pf-fiche:f1')
    expect(ecrituresDeCetteFiche.length).toBe(1)
  })

  it('n’a aucun terme de consommation ni de poids dans le code de fiche_personnage', () => {
    const dossier = join(process.cwd(), 'components', 'fiche_personnage')
    const interdits = [
      'emplacement dépensé',
      'points de vie actuels',
      'pv actuel',
      'bouton de repos',
      'décompte de munitions',
      'munitions',
      'carte d’action',
      "carte d'action",
      'poids',
      'charge portée',
    ]
    for (const fichier of readdirSync(dossier)) {
      if (!fichier.endsWith('.tsx') || fichier.endsWith('.test.tsx')) continue
      const contenu = readFileSync(join(dossier, fichier), 'utf8').toLowerCase()
      for (const terme of interdits) {
        expect(contenu.includes(terme)).toBe(false)
      }
    }
  })
})
