/**
 * The don detail sheet's own pieces, rendered against the development fixture
 * (`web/fixtures/dons/*.json`) — the grid `11_UI_DONS_SHEET.md` asks for:
 * a don with no condition, a repeatable don, a don augmented by the hand-curated
 * supplement, a don entirely untagged by the LLM layer, and a don with more than
 * one official category.
 *
 * `PageDon` itself is not mounted here, for the same reason `PageSort` is not
 * mounted in `fiche.test.tsx`: it is an async server component that reads the
 * filesystem, and the pieces it composes are what carry the behaviour tested
 * below. `lirePropsDon`'s `null`-on-unknown-slug path is exercised directly,
 * which is exactly what makes `notFound()` reachable instead of a thrown
 * exception.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BlocConditions } from '@/components/fiche/BlocConditions'
import { BlocOptionnel } from '@/components/fiche/BlocOptionnel'
import { FacettesSemantiques } from '@/components/fiche/FacettesSemantiques'
import {
  DOSSIER_DONS_FIXTURE,
  lirePropsDon,
  type PropsDon,
} from '@/lib/donnees/don-page'
import {
  activationDe,
  ciblesBonusDe,
  categoriesDe,
  contextesDe,
  effetPrincipalDe,
  effetsSecondairesDe,
  trouverDon,
} from '@/lib/donnees/index-web-dons'
import { chargerIndexDons, CHEMIN_INDEX_DONS_FIXTURE } from '@/lib/donnees/lire-index-dons'

function fixture(slug: string): PropsDon {
  const don = lirePropsDon(slug, DOSSIER_DONS_FIXTURE)
  if (don === null) throw new Error(`fixture : don "${slug}" introuvable`)
  return don
}

const index = chargerIndexDons(CHEMIN_INDEX_DONS_FIXTURE)

/** Cas 1 — aucune condition. */
const ENDURANCE = fixture('endurance')
/** Cas 2 — répétable. */
const ATTAQUE_EN_PUISSANCE = fixture('attaque-en-puissance')
/** Cas 3 — augmenté par le supplément curé à la main. */
const VIGILANCE = fixture('vigilance')
/** Cas 4 — entièrement non étiqueté par la couche LLM. */
const VIGILANCE_INSTINCTIVE = fixture('vigilance-instinctive')
/** Cas 5 — catégorie officielle multiple (combat + sociale). */
const BLESSANT = fixture('blessant')

describe('BlocConditions — les deux blocs ne sont jamais fondus', () => {
  it('rend un intertitre distinct pour la source et pour la curation', () => {
    render(
      <>
        <BlocConditions id="a" texte="Sag 13" titre="Conditions (source)" ton="source" />
        <BlocConditions
          id="b"
          texte="1 rang en Perception"
          titre="Prérequis relevés sur la page"
          ton="curation"
        />
      </>,
    )
    expect(screen.getByText('Conditions (source)')).toBeTruthy()
    expect(screen.getByText('Prérequis relevés sur la page')).toBeTruthy()
  })

  it('le texte du supplément n’apparaît pas dans le bloc source', () => {
    // `Vigilance` a ses deux champs : "Sag 13" (source) et "1 rang en
    // Perception" (curation). Le fondre serait exactement l'erreur que
    // cette étape existe pour empêcher.
    expect(VIGILANCE.raw_conditions).toBe('Sag 13')
    expect(VIGILANCE.conditions_ajoutees).toBe('1 rang en Perception')

    const { container: source } = render(
      <BlocConditions
        id="s"
        texte={VIGILANCE.raw_conditions as string}
        titre="Conditions (source)"
        ton="source"
      />,
    )
    expect(source.textContent).not.toContain('Perception')

    const { container: curation } = render(
      <BlocConditions
        id="c"
        texte={VIGILANCE.conditions_ajoutees as string}
        titre="Prérequis relevés sur la page"
        ton="curation"
      />,
    )
    expect(curation.textContent).toContain('Perception')
  })

  it('la distinction source/curation porte une étiquette textuelle, jamais la seule couleur', () => {
    render(
      <BlocConditions id="c" texte="1 rang en Perception" titre="Prérequis" ton="curation" />,
    )
    expect(screen.getByText(/Relevé sur la page du don/)).toBeTruthy()

    render(<BlocConditions id="s" texte="Sag 13" titre="Conditions" ton="source" />)
    expect(screen.getByText(/Tel qu.écrit dans le catalogue/)).toBeTruthy()
  })

  it('un don sans condition affiche la phrase explicite, pas un bloc vide', () => {
    expect(ENDURANCE.raw_conditions).toBeNull()
    render(
      <BlocConditions
        id="s"
        texte={ENDURANCE.raw_conditions ?? 'Aucune condition : ce don est ouvert à tout personnage.'}
        titre="Conditions (source)"
        ton="source"
      />,
    )
    expect(screen.getByText(/Aucune condition/)).toBeTruthy()
  })
})

describe('BlocOptionnel — aucun intertitre au-dessus d’un contenu vide', () => {
  it("ne rend rien pour Spécial/Normal quand la source n'en porte pas (Vigilance instinctive)", () => {
    expect(VIGILANCE_INSTINCTIVE.special).toBeNull()
    expect(VIGILANCE_INSTINCTIVE.normal).toBeNull()

    const { container: special } = render(
      <BlocOptionnel id="titre-special" texte={VIGILANCE_INSTINCTIVE.special} titre="Spécial" />,
    )
    expect(special.innerHTML).toBe('')

    const { container: normal } = render(
      <BlocOptionnel id="titre-normal" texte={VIGILANCE_INSTINCTIVE.normal} titre="Normal" />,
    )
    expect(normal.innerHTML).toBe('')
  })

  it('rend le titre et le texte quand la source en porte un (Endurance a un « Normal »)', () => {
    expect(ENDURANCE.normal).not.toBeNull()
    render(<BlocOptionnel id="titre-normal" texte={ENDURANCE.normal} titre="Normal" />)
    expect(screen.getByText('Normal')).toBeTruthy()
    expect(screen.getByText(ENDURANCE.normal as string)).toBeTruthy()
  })
})

describe('FacettesSemantiques — dégradation propre du don entièrement non étiqueté', () => {
  it('ne plante pas et ne rend aucune section pour un don sans aucune facette', () => {
    const entree = trouverDon(index, VIGILANCE_INSTINCTIVE.slug)
    expect(entree).not.toBeNull()
    if (entree === null) return

    expect(effetPrincipalDe(index, entree)).toBeNull()
    expect(activationDe(index, entree)).toBeNull()
    expect(categoriesDe(index, entree)).toEqual([])

    const { container } = render(
      <FacettesSemantiques
        activation={activationDe(index, entree)}
        categories={categoriesDe(index, entree)}
        ciblesBonus={ciblesBonusDe(index, entree)}
        contextes={contextesDe(index, entree)}
        effetPrincipal={effetPrincipalDe(index, entree)}
        effetsSecondaires={effetsSecondairesDe(index, entree)}
        valeurBonus={entree.vb}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('rend les deux catégories officielles d’un don qui en porte plusieurs (Blessant)', () => {
    const entree = trouverDon(index, BLESSANT.slug)
    expect(entree).not.toBeNull()
    if (entree === null) return

    const categories = categoriesDe(index, entree)
    expect(categories.length).toBeGreaterThanOrEqual(2)

    render(
      <FacettesSemantiques
        activation={activationDe(index, entree)}
        categories={categories}
        ciblesBonus={ciblesBonusDe(index, entree)}
        contextes={contextesDe(index, entree)}
        effetPrincipal={effetPrincipalDe(index, entree)}
        effetsSecondaires={effetsSecondairesDe(index, entree)}
        valeurBonus={entree.vb}
      />,
    )
    for (const categorie of categories) {
      expect(screen.getByText(categorie)).toBeTruthy()
    }
  })

  it('ne montre jamais la polyvalence : facette faible, jamais mise en avant', () => {
    render(
      <FacettesSemantiques
        activation={null}
        categories={[]}
        ciblesBonus={[]}
        contextes={[]}
        effetPrincipal="test"
        effetsSecondaires={[]}
        valeurBonus={null}
      />,
    )
    expect(screen.queryByText(/polyvalence/i)).toBeNull()
  })
})

describe('le don répétable (Attaque en puissance*)', () => {
  it("porte l'astérisque dans le nom, absent du slug", () => {
    expect(ATTAQUE_EN_PUISSANCE.repetable).toBe(true)
    expect(ATTAQUE_EN_PUISSANCE.nom.endsWith('*')).toBe(true)
    expect(ATTAQUE_EN_PUISSANCE.slug.endsWith('*')).toBe(false)
  })
})

describe('un slug inconnu', () => {
  it('renvoie null (donc `notFound()`), jamais une exception', () => {
    expect(() => lirePropsDon('don-qui-n-existe-pas', DOSSIER_DONS_FIXTURE)).not.toThrow()
    expect(lirePropsDon('don-qui-n-existe-pas', DOSSIER_DONS_FIXTURE)).toBeNull()
  })
})
