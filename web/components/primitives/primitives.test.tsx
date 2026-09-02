/**
 * The six primitives, exercised in every state the design system names.
 *
 * What is load-bearing here is not that they render — it is the accessibility
 * floor the Skill imposes and that no amount of visual review catches:
 *
 *   - every interactive element is reachable and operable from the keyboard. The
 *     search field is bound to `/`, the table row to Enter and Space. A row with
 *     `onClick` and no `tabIndex` looks identical in a screenshot and is dead to
 *     a keyboard user.
 *   - colour is never the sole carrier of information. Each pastille carries its
 *     school's name, in text, even in the square-only variant.
 *   - a gap in the corpus renders as an em dash, never as an invented value.
 *   - the disagreement marker informs and does not accuse: it names both sources
 *     and says the wiki is the authority.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Badge } from '@/components/primitives/Badge'
import { ChampRecherche } from '@/components/primitives/ChampRecherche'
import { EtatVide } from '@/components/primitives/EtatVide'
import { MarqueurDesaccord } from '@/components/primitives/MarqueurDesaccord'
import { PastilleEcole } from '@/components/primitives/PastilleEcole'
import { TableDense } from '@/components/primitives/TableDense'
import { COULEURS, COULEURS_NUIT, ECOLES, LIBELLES_ECOLES } from '@/lib/design/tokens'

/** WCAG 2.1 relative luminance and contrast — the same formula as
 * `lib/design/tokens.test.ts`, kept local rather than imported because that
 * file is étape 04's territory, not this one's. */
function luminance(hex: string): number {
  const canal = (paire: string): number => {
    const valeur = Number.parseInt(paire, 16) / 255
    return valeur <= 0.03928 ? valeur / 12.92 : ((valeur + 0.055) / 1.055) ** 2.4
  }
  const brut = hex.replace('#', '')
  return (
    0.2126 * canal(brut.slice(0, 2)) +
    0.7152 * canal(brut.slice(2, 4)) +
    0.0722 * canal(brut.slice(4, 6))
  )
}

function contraste(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

describe('PastilleEcole', () => {
  it.each(ECOLES)('%s écrit son nom, la couleur n’est jamais seule', (ecole) => {
    render(<PastilleEcole ecole={ecole} />)
    expect(screen.getByText(LIBELLES_ECOLES[ecole])).toBeTruthy()
  })

  it('la variante puce garde une étiquette accessible', () => {
    // The square alone is only legitimate beside a written name, but it still
    // needs its own label: a screen reader gets nothing from a coloured span.
    render(<PastilleEcole ecole="illusion" variante="puce" />)
    expect(screen.getByRole('img', { name: LIBELLES_ECOLES.illusion })).toBeTruthy()
  })

  it('une école absente rend un tiret, pas une valeur inventée', () => {
    render(<PastilleEcole ecole={null} />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('le carré rend un contour bordFort — necromancie est invisible sans lui en thème nuit', () => {
    // Audit defect #18: `necromancie` on the night `base` measures ~1.5:1,
    // close to invisible. The nine fills are not duplicated
    // for the night palette (`design/DECISIONS.md`); a 1px `bordFort` outline
    // is the fix kept, in both themes, so this test does not gate on
    // `data-theme` — the outline is unconditional.
    const { container } = render(<PastilleEcole ecole="necromancie" />)
    const carre = container.querySelector('[aria-hidden="true"]')
    expect(carre?.className).toContain('border-bord-fort')
  })

  it('la variante puce rend aussi le contour', () => {
    render(<PastilleEcole ecole="necromancie" variante="puce" />)
    const carre = screen.getByRole('img', { name: LIBELLES_ECOLES.necromancie })
    expect(carre.className).toContain('border-bord-fort')
  })
})

describe('Badge', () => {
  it.each(['neutre', 'accent', 'alerte', 'donnees'] as const)('ton %s rend son contenu', (ton) => {
    render(<Badge ton={ton}>niveau 3</Badge>)
    expect(screen.getByText('niveau 3')).toBeTruthy()
  })

  // Badge always paints its own opaque fill (`bg-*` in every tone), so the
  // background its text sits on is exactly the fill listed per tone below —
  // never a caller's page background showing through. These are the only
  // fills a `Badge` can actually receive; a hypothetical fifth fill is not
  // measured because it does not exist (`CoucheEnrichissement.tsx`,
  // `TableComparaison.tsx`, `VueFavoris.tsx`, `PanneauFiltres.tsx`,
  // `TableSorts.tsx`, `MarqueurDesaccord.tsx` are the callers read to build
  // this list).
  it.each([
    ['neutre', COULEURS.encreDouce, COULEURS.base, COULEURS_NUIT.encreDouce, COULEURS_NUIT.base],
    [
      'accent',
      COULEURS.encreDouce,
      COULEURS.accentVoile,
      COULEURS_NUIT.encreDouce,
      COULEURS_NUIT.accentVoile,
    ],
    [
      'alerte',
      COULEURS.desaccord,
      COULEURS.desaccordVoile,
      COULEURS_NUIT.desaccord,
      COULEURS_NUIT.desaccordVoile,
    ],
    ['donnees', COULEURS.encre, COULEURS.surface, COULEURS_NUIT.encre, COULEURS_NUIT.surface],
  ])('ton %s tient 4,5:1 sur son propre fond, jour et nuit', (_ton, fgJour, bgJour, fgNuit, bgNuit) => {
    expect(contraste(fgJour, bgJour)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(fgNuit, bgNuit)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('TableDense', () => {
  interface Ligne {
    readonly slug: string
    readonly nom: string
    readonly portee: string | null
  }

  const lignes: readonly Ligne[] = [
    { slug: 'boule-de-feu', nom: 'Boule de feu', portee: 'longue' },
    { slug: 'lumiere', nom: 'Lumière', portee: null },
  ]

  const colonnes = [
    { cle: 'nom', entete: 'Sort', cellule: (l: Ligne) => l.nom },
    {
      cle: 'portee',
      entete: 'Portée',
      secondaire: true,
      cellule: (l: Ligne) => l.portee ?? '—',
    },
  ] as const

  it('rend un en-tête, une légende et une ligne par entrée', () => {
    render(
      <TableDense colonnes={colonnes} cleDe={(l) => l.slug} legende="Sorts" lignes={lignes} />,
    )
    expect(screen.getByRole('columnheader', { name: 'Sort' })).toBeTruthy()
    expect(screen.getByText('Sorts')).toBeTruthy()
    expect(screen.getAllByRole('row')).toHaveLength(3) // en-tête + deux lignes
  })

  it('une donnée absente rend un tiret', () => {
    render(
      <TableDense colonnes={colonnes} cleDe={(l) => l.slug} legende="Sorts" lignes={lignes} />,
    )
    const ligne = screen.getByRole('row', { name: /Lumière/ })
    expect(within(ligne).getByText('—')).toBeTruthy()
  })

  it('une ligne activable est atteignable au clavier', () => {
    const active = vi.fn()
    render(
      <TableDense
        cleDe={(l) => l.slug}
        colonnes={colonnes}
        legende="Sorts"
        lignes={lignes}
        surLigneActivee={active}
      />,
    )
    const ligne = screen.getByRole('row', { name: /Boule de feu/ })
    // Without tabIndex the row is invisible to Tab, and the whole list becomes
    // mouse-only. The attribute is the guarantee.
    expect(ligne.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(ligne, { key: 'Enter' })
    fireEvent.keyDown(ligne, { key: ' ' })
    expect(active).toHaveBeenCalledTimes(2)
    fireEvent.click(ligne)
    expect(active).toHaveBeenCalledTimes(3)
  })

  it('une ligne non activable n’entre pas dans l’ordre de tabulation', () => {
    render(
      <TableDense colonnes={colonnes} cleDe={(l) => l.slug} legende="Sorts" lignes={lignes} />,
    )
    for (const ligne of screen.getAllByRole('row')) {
      expect(ligne.getAttribute('tabindex')).toBeNull()
    }
  })

  it('une table vide rend son en-tête sans planter', () => {
    render(<TableDense colonnes={colonnes} cleDe={(l) => l.slug} legende="Sorts" lignes={[]} />)
    expect(screen.getAllByRole('row')).toHaveLength(1)
  })
})

describe('ChampRecherche', () => {
  it('est étiqueté et remonte la saisie', () => {
    const change = vi.fn()
    render(<ChampRecherche surChangement={change} valeur="" />)
    const champ = screen.getByLabelText('Chercher un sort')
    fireEvent.change(champ, { target: { value: 'boule' } })
    expect(change).toHaveBeenCalledWith('boule')
  })

  it('« / » place le focus dans le champ', () => {
    render(<ChampRecherche surChangement={vi.fn()} valeur="" />)
    const champ = screen.getByLabelText('Chercher un sort')
    expect(document.activeElement).not.toBe(champ)
    fireEvent.keyDown(document.body, { key: '/' })
    expect(document.activeElement).toBe(champ)
  })

  it('« / » reste tapable dans un champ déjà focalisé', () => {
    // Otherwise the shortcut would make the slash untypable anywhere on the page.
    const change = vi.fn()
    render(<ChampRecherche surChangement={change} valeur="" />)
    const champ = screen.getByLabelText('Chercher un sort')
    champ.focus()
    fireEvent.keyDown(champ, { key: '/' })
    expect(change).not.toHaveBeenCalled()
  })

  it('Échap vide une recherche en cours', () => {
    const change = vi.fn()
    render(<ChampRecherche surChangement={change} valeur="boule" />)
    fireEvent.keyDown(screen.getByLabelText('Chercher un sort'), { key: 'Escape' })
    expect(change).toHaveBeenCalledWith('')
  })

  it('le bouton Effacer n’apparaît que quand il y a quelque chose à effacer', () => {
    const { unmount } = render(<ChampRecherche surChangement={vi.fn()} valeur="" />)
    expect(screen.queryByRole('button', { name: 'Effacer' })).toBeNull()
    unmount()
    render(<ChampRecherche surChangement={vi.fn()} valeur="boule" />)
    expect(screen.getByRole('button', { name: 'Effacer' })).toBeTruthy()
  })

  it('le nombre de résultats est annoncé poliment', () => {
    render(<ChampRecherche nbResultats={12} surChangement={vi.fn()} valeur="boule" />)
    expect(screen.getByText('12 sorts correspondent.')).toBeTruthy()
  })
})

describe('EtatVide', () => {
  it('propose toujours une sortie, et elle est actionnable', () => {
    const retirer = vi.fn()
    render(
      <EtatVide
        actions={[{ libelle: 'Retirer les filtres', primaire: true, surClic: retirer }]}
        explication="Trois filtres sont posés."
        titre="Aucun sort ne correspond à « firebal »."
      />,
    )
    expect(screen.getByText('Aucun sort ne correspond à « firebal ».')).toBeTruthy()
    expect(screen.getByText('Trois filtres sont posés.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retirer les filtres' }))
    expect(retirer).toHaveBeenCalledOnce()
  })

  it('rend chaque action proposée', () => {
    render(
      <EtatVide
        actions={[
          { libelle: 'Retirer les filtres', surClic: vi.fn() },
          { libelle: 'Chercher dans toutes les classes', surClic: vi.fn() },
        ]}
        titre="Aucun résultat"
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})

describe('MarqueurDesaccord', () => {
  const desaccord = {
    classe: 'Barde',
    slug: 'barde',
    niveau_liste: 2,
    niveau_page: 3,
  } as const

  it('ne rend rien quand les sources concordent', () => {
    // The corpus as committed has zero of these. Rendering an empty panel on
    // every one of 2070 spell pages would be a permanent visual lie.
    const { container } = render(<MarqueurDesaccord desaccords={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('nomme les deux sources et laisse le wiki faire foi', () => {
    render(<MarqueurDesaccord desaccords={[desaccord]} />)
    const encart = screen.getByRole('region', {
      name: 'Désaccord de niveau entre les sources',
    })
    expect(within(encart).getByText('Barde')).toBeTruthy()
    expect(encart.textContent).toContain('la liste de classe dit')
    expect(encart.textContent).toContain('la page du sort dit')
    expect(encart.textContent).toContain('jamais corrigé ici')
    // It informs, it does not accuse: no error vocabulary anywhere in it.
    expect(encart.textContent).not.toMatch(/erreur|conflit|incohérence/i)
  })

  it('un niveau manquant reste un tiret, jamais un zéro', () => {
    render(<MarqueurDesaccord desaccords={[{ ...desaccord, niveau_page: null }]} />)
    const encart = screen.getByRole('region', {
      name: 'Désaccord de niveau entre les sources',
    })
    expect(within(encart).getByText('—')).toBeTruthy()
    expect(encart.textContent).not.toContain('dit 0')
  })

  it('la variante puce résume sans détailler', () => {
    render(<MarqueurDesaccord desaccords={[desaccord]} variante="puce" />)
    expect(screen.getByText('désaccord')).toBeTruthy()
    expect(screen.queryByRole('region')).toBeNull()
  })
})
