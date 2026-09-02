/**
 * `VueArbre` — the prerequisite-tree tab, end to end against the REAL
 * `public/data/dons/moteur.json`/`index.json` (a curated 31-don view carved
 * out of the real 1417-feat catalogue), with Cytoscape/dagre mocked to a
 * recording fake — jsdom has no canvas worth exercising, so what is proven
 * here is that `VueArbre` feeds Cytoscape the right ELEMENTS/STYLE and reads
 * back the right EVENTS, not that Cytoscape itself draws correctly.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IndexDons } from '@/lib/donnees/index-web-dons'
import { construireVueArbre } from '@/lib/dons/graphe-vue'
import { catalogueDepuisMoteur, type DonneesGrapheMoteur } from '@/lib/dons/graphe-catalogue'
import { FILTRES_DONS_VIDES, type EntreeDon, type StatutDon } from '@/lib/recherche/filtres'

const RACINE = process.cwd()
const MOTEUR = JSON.parse(readFileSync(join(RACINE, 'public', 'data', 'dons', 'moteur.json'), 'utf8')) as DonneesGrapheMoteur
const INDEX = JSON.parse(readFileSync(join(RACINE, 'public', 'data', 'dons', 'index.json'), 'utf8')) as IndexDons

// --- A recording fake for cytoscape + cytoscape-dagre --------------------

interface InstanceFictive {
  readonly options: Record<string, unknown>
  readonly gestionnaires: Map<string, ((evenement: unknown) => void)[]>
  readonly noeudsBascules: { selecteur: string; actif: boolean }[]
  readonly destroy: () => void
  readonly getElementById: (id: string) => { data: (cle: string, valeur?: unknown) => unknown }
  readonly nodes: () => { toggleClass: (classe: string, actif: boolean) => void }
  readonly zoom: () => number
}

let derniereInstance: InstanceFictive | null = null

function creerInstanceFictive(options: Record<string, unknown>): InstanceFictive {
  const gestionnaires = new Map<string, ((evenement: unknown) => void)[]>()
  const donneesParId = new Map<string, Map<string, unknown>>()
  const instance: InstanceFictive = {
    options,
    gestionnaires,
    noeudsBascules: [],
    destroy: vi.fn(),
    getElementById: (id: string) => ({
      data: (cle: string, valeur?: unknown) => {
        const carte = donneesParId.get(id) ?? new Map<string, unknown>()
        if (valeur !== undefined) carte.set(cle, valeur)
        donneesParId.set(id, carte)
        return carte.get(cle)
      },
    }),
    nodes: () => ({
      toggleClass: (classe: string, actif: boolean) => {
        instance.noeudsBascules.push({ selecteur: classe, actif })
      },
    }),
    zoom: () => 1,
  }
  return instance
}

function enregistrerGestionnaire(
  instance: InstanceFictive,
  evenement: string,
  gestionnaire: (evenement: unknown) => void,
): void {
  const liste = instance.gestionnaires.get(evenement) ?? []
  liste.push(gestionnaire)
  instance.gestionnaires.set(evenement, liste)
}

vi.mock('cytoscape', () => {
  const fabrique = vi.fn((options: Record<string, unknown>) => {
    const instance = creerInstanceFictive(options)
    // `.on(evenement, [selecteur,] gestionnaire)` — the component uses both
    // the two-arg form (`'zoom'`) and the three-arg delegated form
    // (`'tap', 'node'`).
    const surEcoute = vi.fn((evenement: string, a: unknown, b?: unknown) => {
      const gestionnaire = (typeof b === 'function' ? b : a) as (e: unknown) => void
      enregistrerGestionnaire(instance, evenement, gestionnaire)
    })
    Object.assign(instance, { on: surEcoute })
    derniereInstance = instance
    return instance
  })
  return { default: Object.assign(fabrique, { use: vi.fn() }) }
})

vi.mock('cytoscape-dagre', () => ({ default: {} }))

// --- Test fixture: a real 31-don view carved out of the 1417-feat catalogue

const RACINE_HUB = 'expertise-du-combat'
const ENFANTS_RETENUS = [
  'aide-rapide',
  'attaque-en-groupe',
  'attaque-en-rotation',
  'balayage-au-baton',
  'bousculade-tourbillonnante',
  'briser-la-garde',
  'chasseur-des-mers',
  'coup-de-degagement',
  'coup-desarmant',
  'coup-desequilibrant',
  'coup-destabilisant',
  'coup-repositionnant',
  'croc-en-jambe-au-baton',
  'croc-en-jambe-superieur',
  'dard-du-papillon',
  'degagement-flamboyant',
  'desarmement-sale',
  'desarmement-superieur',
  'detournement-offensif',
  'detournement-redirige',
  'detournement-tactique',
  'echange-trompeur',
  'entrainer-au-sol',
  'feinte-a-deux-armes',
] as const

const ISOLES_REELS = ['a-terre-a-cheval', 'abondance-de-revelations', 'absorption-rageuse'] as const

// A real AND-prerequisite pair, both leaves in the catalogue: "Assaut
// mystique" requires BOTH "Combat en aveugle" AND "Science de l'initiative"
// — cost 3, not 2 (criterion 6), verified against the real graph, not a toy.
const COUT_TROIS = ['assaut-mystique', 'combat-en-aveugle', 'science-de-l-initiative'] as const

const MANUAL_CHECK_ID = 'aide-rapide'

function entree(id: string, statut: StatutDon = 'eligible'): EntreeDon {
  return {
    id,
    effet: null,
    effets2: [],
    cibles: [],
    contextes: [],
    activation: null,
    polyvalence: null,
    categories: [],
    cout: null,
    statut,
    texte: id,
  }
}

const ENTREES: readonly EntreeDon[] = [
  entree(RACINE_HUB),
  ...ENFANTS_RETENUS.map((id) => entree(id, id === MANUAL_CHECK_ID ? 'manual_check' : 'eligible')),
  ...ISOLES_REELS.map((id) => entree(id)),
  ...COUT_TROIS.map((id) => entree(id)),
]

const RETENUS_IDS = new Set(ENTREES.map((e) => e.id))
const CATALOGUE = catalogueDepuisMoteur(MOTEUR)
const VUE_ATTENDUE = construireVueArbre(CATALOGUE, RETENUS_IDS)

function poserFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => MOTEUR })),
  )
}

const { VueArbre } = await import('./VueArbre')

async function monter(): Promise<void> {
  poserFetch()
  render(
    <VueArbre
      entrees={ENTREES}
      filtres={FILTRES_DONS_VIDES}
      index={INDEX}
      surRetourListe={surRetourListe}
    />,
  )
  await screen.findByTestId('canevas-cytoscape')
  // The canevas div renders as soon as the graph data is ready, but
  // Cytoscape itself mounts through a dynamic `import()` — a real async
  // gap. Every assertion here needs the FAKE instance to actually exist.
  await waitFor(() => expect(derniereInstance).not.toBeNull())
}

const surRetourListe = vi.fn()

beforeEach(() => {
  surRetourListe.mockClear()
  derniereInstance = null
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('rendu du graphe', () => {
  it('envoie à Cytoscape exactement les nœuds retenus qui ont une arête, jamais les isolés', async () => {
    await monter()
    expect(derniereInstance).not.toBeNull()
    const elements = derniereInstance?.options.elements as { data: { id: string; source?: string } }[]
    const idsNoeuds = new Set(elements.filter((e) => e.data.source === undefined).map((e) => e.data.id))
    for (const isole of ISOLES_REELS) expect(idsNoeuds.has(isole)).toBe(false)
    expect(idsNoeuds.has(RACINE_HUB)).toBe(true)
    expect(idsNoeuds.has('aide-rapide')).toBe(true)
  })

  it('utilise un layout dagre, de haut en bas', async () => {
    await monter()
    expect(derniereInstance?.options.layout).toMatchObject({ name: 'dagre', rankDir: 'TB' })
  })
})

describe('le bandeau des dons isolés', () => {
  it('nomme le nombre exact de dons isolés et renvoie vers la liste', async () => {
    await monter()
    expect(screen.getByText(new RegExp(`${ISOLES_REELS.length} dons isolés`))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /revenir à la liste/i }))
    expect(surRetourListe).toHaveBeenCalledTimes(1)
  })
})

describe('le panneau de détail — ce qu’il annonce, il le montre', () => {
  it('affiche le coût, le levier de la vue, le levier catalogue, et la liste debloque exacte, sur chaque nœud retenu avec arête', async () => {
    await monter()
    const gestionnairesTap = derniereInstance?.gestionnaires.get('tap') ?? []
    expect(gestionnairesTap.length).toBeGreaterThan(0)
    const gestionnaire = gestionnairesTap[0] as (e: unknown) => void

    const noeudsAvecArete = [...VUE_ATTENDUE.noeuds.values()].filter((n) => !VUE_ATTENDUE.isoles.includes(n.id))
    expect(noeudsAvecArete.length).toBeGreaterThanOrEqual(24)

    for (const attendu of noeudsAvecArete) {
      act(() => {
        gestionnaire({ target: { id: () => attendu.id } })
      })
      const panneau = screen.getByRole('complementary')
      expect(within(panneau).getByTestId('detail-levier').textContent).toBe(String(attendu.levier))
      expect(within(panneau).getByTestId('detail-levier-catalogue').textContent).toBe(
        String(attendu.levierCatalogue),
      )
      for (const enfantId of attendu.debloque) {
        const nomEnfant = INDEX.dons.find((d) => d.id === enfantId)?.n ?? enfantId
        expect(within(panneau).getByText(nomEnfant)).toBeTruthy()
      }
    }
  })

  it('« Assaut mystique » (deux prérequis distincts, tous requis) coûte 3, pas 2', async () => {
    await monter()
    const gestionnaire = (derniereInstance?.gestionnaires.get('tap') ?? [])[0] as (e: unknown) => void
    act(() => {
      gestionnaire({ target: { id: () => 'assaut-mystique' } })
    })
    const panneau = screen.getByRole('complementary')
    expect(within(panneau).getByTestId('detail-cout').textContent).toBe('3')
  })

  it('signale explicitement quand le levier catalogue dépasse le levier de la vue', async () => {
    await monter()
    const gestionnaire = (derniereInstance?.gestionnaires.get('tap') ?? [])[0] as (e: unknown) => void
    const racine = VUE_ATTENDUE.noeuds.get(RACINE_HUB)
    expect(racine?.levierCatalogue ?? 0).toBeGreaterThan(racine?.levier ?? 0)
    act(() => {
      gestionnaire({ target: { id: () => RACINE_HUB } })
    })
    const panneau = screen.getByRole('complementary')
    expect(within(panneau).getByText(/ouvre plus loin/)).toBeTruthy()
    expect(within(panneau).getByText(/pas une mesure de puissance/)).toBeTruthy()
  })
})

describe('les voies', () => {
  it('sont triées par taille décroissante et repliées d’office sous VOIE_MINIMALE', async () => {
    await monter()
    const boutons = screen.getAllByRole('button', { expanded: undefined as unknown as boolean }).filter((b) =>
      /^Voie /.test(b.textContent ?? ''),
    )
    const tailles = boutons.map((b) => Number(/— (\d+) dons/.exec(b.textContent ?? '')?.[1] ?? 0))
    expect(tailles).toEqual([...tailles].sort((a, b) => b - a))

    for (const bouton of boutons) {
      const taille = Number(/— (\d+) dons/.exec(bouton.textContent ?? '')?.[1] ?? 0)
      const ouvert = bouton.getAttribute('aria-expanded') === 'true'
      if (taille < 3) expect(ouvert).toBe(false)
      else expect(ouvert).toBe(true)
    }
  })
})

describe('le zoom illisible', () => {
  it('masque les libellés sous ZOOM_LISIBLE en basculant la classe labels-masques', async () => {
    await monter()
    const gestionnairesZoom = derniereInstance?.gestionnaires.get('zoom') ?? []
    expect(gestionnairesZoom.length).toBeGreaterThan(0)
    const instance = derniereInstance as InstanceFictive
    const gestionnaire = gestionnairesZoom[0] as (e: unknown) => void
    act(() => {
      gestionnaire({ cy: { zoom: () => 0.5, nodes: instance.nodes } })
    })
    expect(instance.noeudsBascules.at(-1)).toEqual({ selecteur: 'labels-masques', actif: true })
    act(() => {
      gestionnaire({ cy: { zoom: () => 1, nodes: instance.nodes } })
    })
    expect(instance.noeudsBascules.at(-1)).toEqual({ selecteur: 'labels-masques', actif: false })
  })
})

describe('le statut manual_check', () => {
  it('porte une bordure en tirets et un « ! » dans le libellé, jamais la teinte seule', async () => {
    await monter()
    const instance = derniereInstance as InstanceFictive
    expect(instance.getElementById(MANUAL_CHECK_ID).data('statutManuel')).toBe(true)
    expect(instance.getElementById(MANUAL_CHECK_ID).data('label')).toMatch(/^! /)
  })
})
