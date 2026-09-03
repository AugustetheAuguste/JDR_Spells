'use client'

import type { Core, ElementDefinition, EventObject, StylesheetJsonBlock } from 'cytoscape'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { IndexDons } from '@/lib/donnees/index-web-dons'
import { RAMPE_COUT, RAMPE_COUT_NUIT } from '@/lib/design/tokens'
import { catalogueDepuisMoteur, type DonneesGrapheMoteur } from '@/lib/dons/graphe-catalogue'
import {
  construireVueArbre,
  labelLisibleAuZoom,
  VOIE_MINIMALE,
  type NoeudArbre,
  type VueArbreDonnees,
} from '@/lib/dons/graphe-vue'
import { lireRoles, themeNuit, type RolesGraphe } from '@/lib/dons/roles-graphe'
import { filtrerDons, type EntreeDon, type FiltresDons } from '@/lib/recherche/filtres'

type EtatChargement = 'chargement' | 'pret' | 'indisponible' | 'erreur'

/** Resolve a node's fill from the SAME ordinal ramp `PastilleCout` uses
 * (`RAMPE_COUT`/`RAMPE_COUT_NUIT`) — recomputing a second cost→colour
 * mapping for Cytoscape would let the two diverge, exactly the mistake
 * `15_UI_GRAPH.md` calls out. */
export function couleurCout(cout: number | null, roles: RolesGraphe, nuit: boolean): string {
  if (cout === null) return roles.fond
  const rampe = nuit ? RAMPE_COUT_NUIT : RAMPE_COUT
  return rampe[Math.min(Math.max(cout, 1), rampe.length) - 1] as string
}

function elementsCytoscape(
  vue: VueArbreDonnees,
  nomDe: ReadonlyMap<string, string>,
  roles: RolesGraphe,
  nuit: boolean,
): readonly ElementDefinition[] {
  const noeuds: ElementDefinition[] = []
  const aretes: ElementDefinition[] = []
  for (const [id, noeud] of vue.noeuds) {
    if (vue.isoles.includes(id)) continue
    const nom = nomDe.get(id) ?? id
    noeuds.push({
      data: {
        id,
        // `manual_check` is never carried by colour alone — a literal "!" in
        // the label, the same convention `MarqueurStatut` uses.
        label: nom,
        cout: noeud.cout,
      },
      style: { 'background-color': couleurCout(noeud.cout, roles, nuit) },
    })
    for (const enfant of noeud.debloque) {
      if (!vue.noeuds.has(enfant)) continue
      aretes.push({ data: { id: `${id}->${enfant}`, source: id, target: enfant } })
    }
  }
  return [...noeuds, ...aretes]
}

export function feuilleDeStyle(roles: RolesGraphe): StylesheetJsonBlock[] {
  return [
    {
      selector: 'node',
      style: {
        'background-color': roles.fond,
        color: roles.texte,
        'border-color': roles.bord,
        'border-width': 1,
        label: 'data(label)',
        'font-size': 10,
        'text-valign': 'bottom',
      },
    },
    {
      selector: 'node[statutManuel]',
      style: { 'border-style': 'dashed', 'border-width': 2 },
    },
    { selector: 'edge', style: { 'line-color': roles.arete, 'target-arrow-color': roles.arete, 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', width: 1.5 } },
    { selector: 'node:selected', style: { 'border-color': roles.accent, 'border-width': 3 } },
    { selector: '.labels-masques', style: { label: '' } },
  ]
}

/**
 * The prerequisite-tree tab — `15_UI_GRAPH`. Cytoscape/dagre are imported
 * DYNAMICALLY, inside an effect, never at module scope: this file is a
 * client component, but `output: 'export'` still prerenders it once on the
 * server, and neither library tolerates running without a real `document`.
 */
export function VueArbre({
  entrees,
  filtres,
  index,
  surRetourListe,
}: {
  readonly entrees: readonly EntreeDon[]
  readonly filtres: FiltresDons
  readonly index: IndexDons
  readonly surRetourListe: () => void
}) {
  const conteneurRef = useRef<HTMLDivElement | null>(null)
  const canevasRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)

  const [etat, setEtat] = useState<EtatChargement>('chargement')
  const [moteur, setMoteur] = useState<DonneesGrapheMoteur | null>(null)
  const [selection, setSelection] = useState<string | null>(null)
  const [voiesReplacees, setVoiesReplacees] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    let vivant = true
    async function charger(): Promise<void> {
      const reponse = await fetch('/data/dons/moteur.json')
      if (!reponse.ok) throw new Error(`moteur.json : ${reponse.status}`)
      const charge = (await reponse.json()) as DonneesGrapheMoteur
      if (vivant) setMoteur(charge)
    }
    charger().catch(() => {
      if (vivant) setEtat('erreur')
    })
    return () => {
      vivant = false
    }
  }, [])

  const retenus = useMemo(() => filtrerDons(entrees, filtres), [entrees, filtres])
  const nomDe = useMemo(() => {
    const carte = new Map<string, string>()
    for (const don of index.dons) carte.set(don.id, don.n)
    return carte
  }, [index])
  const statutDe = useMemo(() => {
    const carte = new Map<string, EntreeDon['statut']>()
    for (const entree of entrees) carte.set(entree.id, entree.statut)
    return carte
  }, [entrees])

  const vueArbre: VueArbreDonnees | null = useMemo(() => {
    if (moteur === null) return null
    const catalogue = catalogueDepuisMoteur(moteur)
    return construireVueArbre(catalogue, new Set(retenus.map((d) => d.id)))
  }, [moteur, retenus])

  // Mount / tear down Cytoscape once the graph data is ready. Re-run when
  // `vueArbre` changes (a new filter set) rather than mutating the existing
  // instance's elements — the view is small enough per `voie` that a fresh
  // render is simpler and provably correct, at the cost of a layout re-run
  // the plan asks to MEASURE, not to budget against a fixed number.
  useEffect(() => {
    if (vueArbre === null || canevasRef.current === null) return
    const donnees = vueArbre
    let vivant = true
    let instance: Core | null = null

    async function monter(): Promise<void> {
      let cytoscapeModule: typeof import('cytoscape')
      let dagreExtension: unknown
      try {
        ;[cytoscapeModule, dagreExtension] = await Promise.all([
          import('cytoscape').then((m) => m.default ?? m),
          import('cytoscape-dagre').then((m) => (m as { default: unknown }).default ?? m),
        ]) as [typeof import('cytoscape'), unknown]
      } catch {
        if (vivant) setEtat('indisponible')
        return
      }
      if (!vivant || canevasRef.current === null) return

      const cytoscapeAvecDagre = cytoscapeModule as unknown as {
        (options: Record<string, unknown>): Core
        use: (extension: unknown) => void
      }
      cytoscapeAvecDagre.use(dagreExtension)

      const racine = conteneurRef.current ?? canevasRef.current
      const roles = lireRoles(racine, (element) => globalThis.getComputedStyle(element))
      const nuit = themeNuit(racine)

      const cy = cytoscapeAvecDagre({
        container: canevasRef.current,
        elements: elementsCytoscape(donnees, nomDe, roles, nuit) as unknown[],
        style: feuilleDeStyle(roles) as unknown[],
        layout: { name: 'dagre', rankDir: 'TB' },
      })

      for (const [id] of donnees.noeuds) {
        if (statutDe.get(id) === 'manual_check') {
          cy.getElementById(id).data('statutManuel', true)
          cy.getElementById(id).data('label', `! ${nomDe.get(id) ?? id}`)
        }
      }

      cy.on('zoom', (evenement: EventObject) => {
        const visible = labelLisibleAuZoom(evenement.cy.zoom())
        evenement.cy.nodes().toggleClass('labels-masques', !visible)
      })
      cy.on('tap', 'node', (evenement: EventObject) => {
        setSelection(evenement.target.id())
      })

      instance = cy
      cyRef.current = cy
      setEtat('pret')
    }

    monter().catch(() => {
      if (vivant) setEtat('erreur')
    })

    return () => {
      vivant = false
      instance?.destroy()
      cyRef.current = null
    }
    // `nomDe`/`statutDe` are derived from stable props on every render this
    // effect cares about; omitting them from deps would re-mount Cytoscape
    // needlessly on every keystroke elsewhere on the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vueArbre])

  const noeudSelectionne: NoeudArbre | null = selection === null ? null : vueArbre?.noeuds.get(selection) ?? null

  if (etat === 'erreur') {
    return (
      <p className="mt-3 text-grand text-encre-douce">
        Le graphe des prérequis n’a pas pu être chargé. La liste reste consultable dans l’autre onglet.
      </p>
    )
  }

  if (etat === 'indisponible') {
    return (
      <p className="mt-3 text-grand text-encre-douce">
        L’arbre des prérequis n’est pas disponible dans ce navigateur. La liste reste pleinement utilisable — c’est
        l’équivalent accessible de cette vue.
      </p>
    )
  }

  if (vueArbre === null) {
    return (
      <p aria-live="polite" className="mt-3 text-grand text-encre-douce">
        Chargement du graphe…
      </p>
    )
  }

  const voiesTriees = [...vueArbre.voies.entries()]

  return (
    <div ref={conteneurRef} className="flex flex-col gap-4">
      {vueArbre.isoles.length > 0 ? (
        <p className="m-0 text-petit text-encre-douce">
          {vueArbre.isoles.length} {vueArbre.isoles.length === 1 ? 'don isolé ne figure pas ici' : 'dons isolés ne figurent pas ici'}
          {' — '}
          <button className="text-accent underline" onClick={surRetourListe} type="button">
            revenir à la liste
          </button>
          .
        </p>
      ) : null}

      <div ref={canevasRef} className="h-[32rem] w-full border border-bord bg-surface" data-testid="canevas-cytoscape" />

      {noeudSelectionne !== null ? (
        <PanneauDetailNoeud
          nom={nomDe.get(noeudSelectionne.id) ?? noeudSelectionne.id}
          noeud={noeudSelectionne}
          nomDe={nomDe}
        />
      ) : null}

      <section aria-label="Voies (familles de dons)">
        {voiesTriees.map(([hub, membres]) => (
          <VoiePliable
            key={hub}
            hub={hub}
            membres={membres}
            nomDe={nomDe}
            ouverte={membres.length >= VOIE_MINIMALE ? !voiesReplacees.has(hub) : voiesReplacees.has(hub)}
            surBascule={() =>
              setVoiesReplacees((precedent) => {
                const suivant = new Set(precedent)
                if (suivant.has(hub)) suivant.delete(hub)
                else suivant.add(hub)
                return suivant
              })
            }
          />
        ))}
      </section>
    </div>
  )
}

function PanneauDetailNoeud({
  nom,
  noeud,
  nomDe,
}: {
  readonly nom: string
  readonly noeud: NoeudArbre
  readonly nomDe: ReadonlyMap<string, string>
}) {
  return (
    <aside aria-label={`Détail de ${nom}`} className="border border-bord-fort bg-surface p-3">
      <h2 className="m-0 font-affichage text-titre3 font-semibold">{nom}</h2>
      <dl className="mt-2 grid grid-cols-2 gap-1 text-petit">
        <dt className="text-encre-douce">Coût</dt>
        <dd data-testid="detail-cout">{noeud.cout ?? '—'}</dd>
        <dt className="text-encre-douce">Débloque (dans la vue)</dt>
        <dd data-testid="detail-levier">{noeud.levier}</dd>
        <dt className="text-encre-douce">Débloque (catalogue entier)</dt>
        <dd data-testid="detail-levier-catalogue">{noeud.levierCatalogue}</dd>
      </dl>
      {noeud.levierCatalogue > noeud.levier ? (
        <p className="mt-2 text-petit text-encre-douce">
          Ce don ouvre plus loin que ce que tu vois d’ici : {noeud.levierCatalogue} dons au total dans le catalogue,
          contre {noeud.levier} dans cette vue.
        </p>
      ) : null}
      <p className="mt-2 text-micro text-encre-faible">
        Nombre de dons débloqués, pas une mesure de puissance.
      </p>
      {noeud.debloque.length > 0 ? (
        <>
          <p className="mt-2 mb-1 text-petit font-medium">Débloque directement :</p>
          <ul className="m-0 list-disc pl-4 text-petit">
            {noeud.debloque.map((id) => (
              <li key={id}>{nomDe.get(id) ?? id}</li>
            ))}
          </ul>
        </>
      ) : null}
    </aside>
  )
}

function VoiePliable({
  hub,
  membres,
  nomDe,
  ouverte,
  surBascule,
}: {
  readonly hub: string
  readonly membres: readonly string[]
  readonly nomDe: ReadonlyMap<string, string>
  readonly ouverte: boolean
  readonly surBascule: () => void
}) {
  return (
    <div className="border-b border-bord py-2">
      <button
        aria-expanded={ouverte}
        className="flex w-full items-center justify-between text-left text-petit font-medium"
        onClick={surBascule}
        type="button"
      >
        <span>
          Voie « {nomDe.get(hub) ?? hub} » — {membres.length} dons
        </span>
        <span aria-hidden="true">{ouverte ? '▾' : '▸'}</span>
      </button>
      {ouverte ? (
        <ul className="m-0 mt-1 list-disc pl-4 text-petit">
          {membres.map((id) => (
            <li key={id}>{nomDe.get(id) ?? id}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
