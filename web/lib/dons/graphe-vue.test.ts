/**
 * `construireVueArbre` — the three invariants of the source repository's
 * actual bug (`15_UI_GRAPH.md`: "94 nœuds à levier surévalué, 13 nœuds sans
 * arête, 2 voies nommées d'après un don non retenu" → "désormais 0/0/0"),
 * checked against the REAL 1417-feat `moteur.json`, not a hand-built toy —
 * the whole point being that this held even at catalogue scale, not only on
 * a three-node fixture.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

const ESPION_CONSTRUIRE_GRAPHE = vi.fn()

vi.mock('./graphe.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./graphe.js')>()
  ESPION_CONSTRUIRE_GRAPHE.mockImplementation(original.construireGraphe)
  return { ...original, construireGraphe: ESPION_CONSTRUIRE_GRAPHE }
})

const { catalogueDepuisMoteur } = await import('./graphe-catalogue.js')
type DonneesGrapheMoteur = import('./graphe-catalogue.js').DonneesGrapheMoteur

const CHEMIN_MOTEUR = join(process.cwd(), 'public', 'data', 'dons', 'moteur.json')

function chargerDonneesMoteur(): DonneesGrapheMoteur {
  return JSON.parse(readFileSync(CHEMIN_MOTEUR, 'utf8')) as DonneesGrapheMoteur
}

/** A restricted "view" standing in for a filtered/character-restricted list:
 * "Expertise du combat" plus HALF of its direct children (by construction,
 * omitting the rest) — the exact shape of the historical bug, where a don's
 * catalogue-wide leverage exceeds what its view's own graph shows. */
function vueRestreinte(donnees: DonneesGrapheMoteur): ReadonlySet<string> {
  const racine = 'expertise-du-combat'
  const enfants = donnees.aretes.filter((a) => a.de === racine).map((a) => a.vers)
  const moitie = enfants.slice(0, Math.floor(enfants.length / 2))
  return new Set([racine, ...moitie])
}

describe('construireVueArbre — invariants 0/0/0, sur le catalogue réel', () => {
  it('zéro nœud à levier surévalué, zéro nœud sans arête, zéro voie hors-vue', async () => {
    const donnees = chargerDonneesMoteur()
    const catalogue = catalogueDepuisMoteur(donnees)
    const retenus = vueRestreinte(donnees)
    expect(retenus.size).toBeGreaterThan(10) // la vue restreinte est non triviale

    const { construireVueArbre } = await import('./graphe-vue.js')
    const vue = construireVueArbre(catalogue, retenus)

    let nbLevierSurevalue = 0
    let nbSansArete = 0
    let nbVoieHorsVue = 0

    for (const [id, noeud] of vue.noeuds) {
      const enfantsVue = vue.enfantsVue.get(id)?.size ?? 0
      const parentsVue = [...vue.enfantsVue.entries()].some(([, ens]) => ens.has(id))
      const aUneArete = enfantsVue > 0 || parentsVue
      // Levier "surévalué" = positif alors que la vue ne montre aucune arête
      // pour ce nœud — exactement le symptôme d'origine.
      if (noeud.levier > 0 && !aUneArete) nbLevierSurevalue += 1
      if (!aUneArete && noeud.levier > 0) nbSansArete += 1
    }
    for (const hub of vue.voies.keys()) {
      if (!retenus.has(hub)) nbVoieHorsVue += 1
    }

    expect(nbLevierSurevalue).toBe(0)
    expect(nbSansArete).toBe(0)
    expect(nbVoieHorsVue).toBe(0)

    // L'écart n'est pas caché : la racine, restreinte à la moitié de ses
    // enfants, ouvre moins DANS LA VUE que dans tout le catalogue.
    const racine = vue.noeuds.get('expertise-du-combat')
    expect(racine).toBeDefined()
    expect(racine?.levierCatalogue ?? 0).toBeGreaterThan(racine?.levier ?? 0)
  })

  it('construireGraphe est appelé exactement deux fois — un seul appel refait le bug', async () => {
    ESPION_CONSTRUIRE_GRAPHE.mockClear()
    const donnees = chargerDonneesMoteur()
    const catalogue = catalogueDepuisMoteur(donnees)
    const retenus = vueRestreinte(donnees)

    const { construireVueArbre } = await import('./graphe-vue.js')
    construireVueArbre(catalogue, retenus)

    // Un seul appel — l'« optimisation » qui fusionnerait catalogue et vue —
    // ferait échouer cette assertion, exactement le garde-fou voulu.
    expect(ESPION_CONSTRUIRE_GRAPHE).toHaveBeenCalledTimes(2)
    expect(ESPION_CONSTRUIRE_GRAPHE).toHaveBeenNthCalledWith(1, catalogue)
    expect(ESPION_CONSTRUIRE_GRAPHE).toHaveBeenNthCalledWith(2, catalogue, retenus)
  })

  it('les dons isolés de la vue portent une voie nulle et aucune arête', async () => {
    const donnees = chargerDonneesMoteur()
    const catalogue = catalogueDepuisMoteur(donnees)
    // Une vue volontairement composée d'un hub connecté et d'un don sans
    // aucune arête dans tout le catalogue (voir `graphe-catalogue.test.ts`
    // pour la même idée à petite échelle).
    const inAretes = new Set<string>()
    for (const a of donnees.aretes) {
      inAretes.add(a.de)
      inAretes.add(a.vers)
    }
    const isole = Object.keys(donnees.levier_catalogue).find((slug) => !inAretes.has(slug))
    expect(isole).toBeDefined()

    const { construireVueArbre } = await import('./graphe-vue.js')
    const vue = construireVueArbre(catalogue, new Set([isole as string, 'expertise-du-combat']))

    expect(vue.isoles).toContain(isole)
    expect(vue.noeuds.get(isole as string)?.voie).toBeNull()
    expect(vue.noeuds.get(isole as string)?.debloque).toEqual([])
  })
})
