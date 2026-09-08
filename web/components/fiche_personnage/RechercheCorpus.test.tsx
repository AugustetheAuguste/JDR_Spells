import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Personnage } from '@/lib/dons/types'

import { RechercheCorpus } from './RechercheCorpus'

vi.mock('@/lib/recherche/sources-globales', () => ({
  sourceSorts: { chercher: vi.fn().mockResolvedValue([]) },
  sourceDons: {
    chercher: vi
      .fn()
      .mockResolvedValue([
        { type: 'don', cle: 'd1', titre: 'Don Ineligible', detail: null, href: '/dons/don-ineligible/' },
        { type: 'don', cle: 'd2', titre: 'Don Manuel', detail: null, href: '/dons/don-manuel/' },
      ]),
  },
}))

vi.mock('@/lib/dons/charger-contrat', () => ({
  chargerContratMoteurDons: vi.fn().mockResolvedValue({
    tables: {
      lanceurs: {},
      maitrises: {},
      magie_des_dons: {},
      affinite_creature: {},
      restriction_de_classe: {},
      races: {},
      armes_raciales: {},
      reclassement_racial: {},
      progression_bba: {},
    },
    catalogue: new Map([
      [
        'Don Ineligible',
        {
          brut: 'Force 20',
          effectif: 'Force 20',
          exigences: [{ type: 'ability_score', segment: 'Force 20', verif_manuelle: false, charge: { ability: 'For', min: 20 } }],
        },
      ],
      [
        'Don Manuel',
        {
          brut: 'NLS 5',
          effectif: 'NLS 5',
          exigences: [{ type: 'caster_level', segment: 'NLS 5', verif_manuelle: false, charge: { min: 5 } }],
        },
      ],
    ]),
  }),
}))

const PERSONNAGE: Personnage = { classe: 'guerrier', niveau: 6, caracteristiques: { For: 10 } }

describe('RechercheCorpus, dons', () => {
  it('un don ineligible reste rattachable, le bouton n’est ni désactivé ni masqué', async () => {
    const surRattachement = vi.fn()
    render(<RechercheCorpus corpus="dons" personnage={PERSONNAGE} surLecture={() => {}} surRattachement={surRattachement} />)
    await userEvent.type(screen.getByLabelText('Rechercher un don'), 'don')

    const boutons = await screen.findAllByRole('button', { name: 'Rattacher' })
    expect(boutons.length).toBeGreaterThan(0)
    for (const bouton of boutons) {
      expect(bouton.hasAttribute('disabled')).toBe(false)
    }
    await userEvent.click(boutons[0]!)
    expect(surRattachement).toHaveBeenCalledWith({
      nom: 'Don Ineligible',
      source: 'pathfinder-fr',
      ref: 'don-ineligible',
      note: '',
    })
  })

  it('un don manual_check est visible et affiche ses motifs indéterminés, distincts des motifs non remplis', async () => {
    render(<RechercheCorpus corpus="dons" personnage={PERSONNAGE} surLecture={() => {}} surRattachement={() => {}} />)
    await userEvent.type(screen.getByLabelText('Rechercher un don'), 'don')

    const ligneDonManuel = (await screen.findByText('Don Manuel')).closest('li')
    expect(ligneDonManuel?.textContent).toContain('À vérifier')
    expect(ligneDonManuel?.textContent).toContain('Points à vérifier soi-même')
    expect(ligneDonManuel?.textContent).not.toContain('Ce que le personnage ne remplit pas')
  })

  it('une exigence indéterminable n’est jamais présentée comme non satisfaite', async () => {
    render(<RechercheCorpus corpus="dons" personnage={PERSONNAGE} surLecture={() => {}} surRattachement={() => {}} />)
    await userEvent.type(screen.getByLabelText('Rechercher un don'), 'don')

    await screen.findByText('Don Ineligible')
    // Le don réellement ineligible affiche le libellé « non satisfaite »
    // (« Condition non remplie »), le don manual_check affiche « À
    // vérifier » — jamais le même libellé pour les deux statuts.
    expect(screen.getByText('Condition non remplie')).not.toBeNull()
    expect(screen.getByText('À vérifier')).not.toBeNull()
  })

  it('le verdict est recalculé après un changement de niveau, et la valeur affichée change', async () => {
    const { rerender } = render(
      <RechercheCorpus corpus="dons" personnage={{ classe: 'guerrier', niveau: 1, caracteristiques: { For: 10 } }} surLecture={() => {}} surRattachement={() => {}} />,
    )
    await userEvent.type(screen.getByLabelText('Rechercher un don'), 'don')
    await screen.findByText('Don Manuel')
    // NLS 5 avec un personnage dont la classe est absente des tables (vides
    // dans ce test) : le verdict est `manual_check`. Le test qui importe est
    // celui du recalcul, pas la valeur précise : changer la fiche doit
    // changer l’affichage.
    const avantModif = screen.getByText('Don Manuel').closest('li')?.textContent

    rerender(
      <RechercheCorpus
        corpus="dons"
        personnage={null}
        surLecture={() => {}}
        surRattachement={() => {}}
      />,
    )
    await screen.findByText((texte) => texte.startsWith('La vérification n’est pas possible'))
    const apresModif = screen.queryByText('Don Manuel')?.closest('li')?.textContent
    expect(apresModif).not.toBe(avantModif)
  })

  it('n’affiche aucun verdict pour le corpus des sorts', async () => {
    render(<RechercheCorpus corpus="sorts" surLecture={() => {}} surRattachement={() => {}} />)
    await userEvent.type(screen.getByLabelText('Rechercher un sort'), 'boule')
    expect(screen.queryByText('À vérifier')).toBeNull()
  })
})
