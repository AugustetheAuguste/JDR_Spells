'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { ColonneStatut } from '@/components/dons/ColonneStatut'
import { SelecteurPersonnageActif } from '@/components/compte/SelecteurPersonnageActif'
import { PanneauFiltresDons } from '@/components/dons/PanneauFiltresDons'
import { PastilleCout } from '@/components/dons/PastilleCout'
import { VueArbre } from '@/components/dons/VueArbre'
import { ChampRecherche } from '@/components/primitives/ChampRecherche'
import { EtatVide } from '@/components/primitives/EtatVide'
import { type ColonneDense, TableDense } from '@/components/primitives/TableDense'
import { usePersonnageActif } from '@/lib/compte/contexte-personnages'
import { versEntreesFiltre } from '@/lib/donnees/dons-vers-entrees'
import type { EntreeDon as EntreeDonBrut, IndexDons } from '@/lib/donnees/index-web-dons'
import {
  ecrireEtatDons,
  ETAT_VIDE_DONS,
  lireEtatDons,
  versFiltresDons,
  type EtatUrlDons,
  type VocabulaireDons,
} from '@/lib/navigation/etat-url'
import { compterOptions, type EntreeDon, type FacetteDon, filtrerDons } from '@/lib/recherche/filtres'

const DELAI_FRAPPE = 80
const LIGNES_PAR_PAGE = 200

/** The tab this route shows — carried in the URL (`dons_onglet`), like the
 * rest of this view's state, never mirrored in a `useState`. Not part of
 * `EtatUrlDons`/`etat-url.ts`'s contract: that module is the frozen
 * facet/cost/status vocabulary shared with `compterOptions`, and a tab
 * selection is neither a facet nor something a count needs to know about. */
type OngletDons = 'liste' | 'arbre'

function ongletDe(parametres: URLSearchParams): OngletDons {
  return parametres.get('dons_onglet') === 'arbre' ? 'arbre' : 'liste'
}

function etatDonsActif(etat: EtatUrlDons): boolean {
  return ecrireEtatDons(etat).toString() !== ''
}

/**
 * The dons ("feats") faceted view — see `13_UI_DONS_LIST.md` for why this is a
 * fresh render on top of the wave-10 filtering library rather than a port of
 * `explorateur_dons.js`.
 *
 * The URL is the ONLY state (B7, inherited from the spell view). `etat =
 * lireEtatDons(useSearchParams(), vocabulaire)` is read on every render;
 * nothing here mirrors it in a `useState` — the one exception, exactly as in
 * `VueNavigation`, is the search box, which holds raw keystrokes between
 * renders so typing stays responsive while the URL catches up on a debounce.
 * Every write goes through the router with `{ scroll: false }`: a facet click
 * must never scroll the reader back to the top of a panel they are already
 * looking at.
 *
 * `filtrerDons`/`compterOptions` are the ONLY things this component calls to
 * decide what is shown or counted — never a second, ad hoc pass over
 * `entrees`. Recomputing a count here by any other means is exactly the
 * historical bug this view exists to not repeat.
 */
export function VueDons() {
  const router = useRouter()
  const parametres = useSearchParams()
  const { personnageActif } = usePersonnageActif()

  const [index, setIndex] = useState<IndexDons | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [visibles, setVisibles] = useState(LIGNES_PAR_PAGE)
  // `null` = not yet known. The arbre tab stays disabled (not absent, not a
  // crash) until this resolves — and forever, if Cytoscape genuinely is not
  // in the bundle: the list underneath is never gated on this probe.
  const [cytoscapeDisponible, setCytoscapeDisponible] = useState<boolean | null>(null)

  useEffect(() => {
    let vivant = true
    async function charger(): Promise<void> {
      const reponse = await fetch('/data/dons/index.json')
      if (!reponse.ok) throw new Error(`index.json : ${reponse.status}`)
      const charge = (await reponse.json()) as IndexDons
      if (vivant) setIndex(charge)
    }
    charger().catch((cause: unknown) => {
      if (vivant) setErreur(cause instanceof Error ? cause.message : 'chargement impossible')
    })
    return () => {
      vivant = false
    }
  }, [])

  useEffect(() => {
    let vivant = true
    import('cytoscape')
      .then(() => {
        if (vivant) setCytoscapeDisponible(true)
      })
      .catch(() => {
        if (vivant) setCytoscapeDisponible(false)
      })
    return () => {
      vivant = false
    }
  }, [])

  const vocabulaire: VocabulaireDons | null = useMemo(() => {
    if (index === null) return null
    return {
      effets: index.effets_principaux,
      // The same taxonomy as `effets` — `effets_secondaires` shares the
      // `effet_principal` vocabulary, see `index-web-dons.ts`.
      effets2: index.effets_principaux,
      cibles: index.cibles_bonus,
      contextes: index.contextes,
      activations: index.activations,
      polyvalences: index.polyvalences,
      categories: index.categories,
    }
  }, [index])

  const etat: EtatUrlDons = useMemo(
    () => (vocabulaire === null ? ETAT_VIDE_DONS : lireEtatDons(parametres, vocabulaire)),
    [parametres, vocabulaire],
  )

  // The one local copy of URL state, one-directional exactly as
  // `VueNavigation`'s: the box holds raw keystrokes so typing stays responsive
  // while the URL catches up on a debounce, reconciled from the URL during
  // render rather than in an effect (which would flash the stale value for one
  // frame on a back button).
  const [saisie, setSaisie] = useState(etat.q)
  const [qVue, setQVue] = useState(etat.q)
  if (qVue !== etat.q) {
    setQVue(etat.q)
    setSaisie(etat.q)
  }

  const onglet = ongletDe(parametres)

  function ecrire(suivant: EtatUrlDons): void {
    const params = ecrireEtatDons(suivant)
    if (onglet === 'arbre') params.set('dons_onglet', 'arbre')
    const query = params.toString()
    const cible = `/dons${query === '' ? '' : `?${query}`}` as `/dons?${string}` | '/dons'
    router.replace(cible, { scroll: false })
    setVisibles(LIGNES_PAR_PAGE)
  }

  function ecrireOnglet(suivant: OngletDons): void {
    const params = ecrireEtatDons(etat)
    if (suivant === 'arbre') params.set('dons_onglet', 'arbre')
    const query = params.toString()
    const cible = `/dons${query === '' ? '' : `?${query}`}` as `/dons?${string}` | '/dons'
    router.replace(cible, { scroll: false })
  }

  useEffect(() => {
    if (index === null || saisie === etat.q) return
    const minuteur = setTimeout(() => ecrire({ ...etat, q: saisie }), DELAI_FRAPPE)
    return () => clearTimeout(minuteur)
    // `ecrire` is stable enough for this: it closes over `router` only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie, etat, index])

  const bruts: ReadonlyMap<string, EntreeDonBrut> = useMemo(
    () => new Map((index?.dons ?? []).map((don) => [don.id, don])),
    [index],
  )

  const entrees: readonly EntreeDon[] = useMemo(
    () => (index === null ? [] : versEntreesFiltre(index)),
    [index],
  )

  // The degradation the plan requires: an index with every semantic field
  // null (no `feat_semantics.json` on this build) hides the seven semantic
  // facets rather than rendering seven empty ones. Cost is symmetrical: the
  // graph cost (step 15) and the character verdict (step 16) have not landed
  // on this branch, so their controls stay hidden rather than claim a value
  // that would just empty the whole list the moment it were touched.
  const semantiqueMasquee = useMemo(
    () =>
      entrees.every(
        (e) =>
          e.effet === null &&
          e.effets2.length === 0 &&
          e.cibles.length === 0 &&
          e.contextes.length === 0 &&
          e.activation === null &&
          e.polyvalence === null &&
          e.categories.length === 0,
      ),
    [entrees],
  )
  const coutMasque = useMemo(() => entrees.every((e) => e.cout === null), [entrees])

  const filtres = useMemo(() => versFiltresDons(etat), [etat])
  const retenus = useMemo(() => filtrerDons(entrees, filtres), [entrees, filtres])

  function compteDe(facette: FacetteDon): ReadonlyMap<string, number> {
    return compterOptions(entrees, filtres, facette)
  }

  if (erreur !== null) {
    return (
      <section>
        <h1 className="m-0 font-affichage text-titre1 font-semibold">Dons</h1>
        <p className="mt-3 text-grand text-encre-douce">
          L’index des dons n’a pas pu être chargé ({erreur}). Le catalogue reste
          consultable sur{' '}
          <a className="text-accent underline" href="https://www.pathfinder-fr.org/">
            pathfinder-fr.org
          </a>
          .
        </p>
      </section>
    )
  }

  if (index === null || vocabulaire === null) {
    return (
      <section>
        <h1 className="m-0 font-affichage text-titre1 font-semibold">Dons</h1>
        <p aria-live="polite" className="mt-3 text-grand text-encre-douce">
          Chargement de l’index…
        </p>
      </section>
    )
  }

  const colonnesBase: ColonneDense<EntreeDon>[] = [
    {
      cle: 'nom',
      entete: 'Don',
      cellule: (don) => {
        const brut = bruts.get(don.id)
        return (
          <Link
            className="text-encre underline decoration-bord-fort underline-offset-2 hover:text-accent"
            href={{ pathname: `/dons/${brut?.s ?? don.id}/` }}
          >
            {brut?.n ?? don.id}
          </Link>
        )
      },
    },
  ]

  // The semantic and cost columns degrade exactly like the panel's facets: no
  // column claiming a value the index does not carry (an all-null semantic
  // layer, or a cost nobody has computed yet).
  const colonnes: readonly ColonneDense<EntreeDon>[] = [
    ...colonnesBase,
    ...(semantiqueMasquee
      ? []
      : [
          {
            cle: 'effet',
            entete: 'Effet principal',
            secondaire: true,
            cellule: (don: EntreeDon) =>
              don.effet === null ? <span className="text-encre-faible">—</span> : don.effet,
          },
          {
            cle: 'cible',
            entete: 'Cible du bonus',
            secondaire: true,
            cellule: (don: EntreeDon) =>
              don.cibles.length === 0 ? <span className="text-encre-faible">—</span> : don.cibles.join(', '),
          },
        ]),
    // No status column at all without a character — the plan's explicit
    // rule, kept even now that a character CAN be active: the column must
    // still be absent for a visit with none selected, never present with a
    // guessed verdict.
    ...(personnageActif === null
      ? []
      : [
          {
            cle: 'statut',
            entete: 'Statut',
            cellule: (don: EntreeDon) => {
              const brut = bruts.get(don.id)
              return brut === undefined ? null : <ColonneStatut nomDon={brut.n} />
            },
          },
        ]),
    ...(coutMasque
      ? []
      : [
          {
            cle: 'cout',
            entete: 'Coût',
            alignement: 'droite' as const,
            cellule: (don: EntreeDon) => <PastilleCout cout={don.cout} />,
          },
        ]),
  ]

  return (
    <section>
      <h1 className="m-0 font-affichage text-titre1 font-semibold">Dons</h1>
      <p className="mt-1 mb-2 text-corps text-encre-douce">
        {index.dons.length} dons du corpus Pathfinder 1re édition en français.
      </p>
      <div className="mb-4">
        <SelecteurPersonnageActif />
      </div>

      <div className="mb-3 flex gap-2" role="tablist" aria-label="Vue des dons">
        <button
          aria-selected={onglet === 'liste'}
          className="rounded-jeton border border-bord-fort bg-surface px-3 py-1.5 text-petit text-encre aria-selected:bg-accent-voile aria-selected:text-accent"
          onClick={() => ecrireOnglet('liste')}
          role="tab"
          type="button"
        >
          Liste
        </button>
        <button
          aria-selected={onglet === 'arbre'}
          className="rounded-jeton border border-bord-fort bg-surface px-3 py-1.5 text-petit text-encre aria-selected:bg-accent-voile aria-selected:text-accent disabled:cursor-not-allowed disabled:text-encre-faible"
          disabled={cytoscapeDisponible !== true}
          onClick={() => ecrireOnglet('arbre')}
          role="tab"
          title={
            cytoscapeDisponible === false
              ? 'L’arbre des prérequis n’est pas disponible dans ce navigateur.'
              : undefined
          }
          type="button"
        >
          Arbre
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
        <aside aria-label="Filtres" className="flex flex-col gap-4">
          <PanneauFiltresDons
            compteDe={compteDe}
            coutMasque={coutMasque}
            etat={etat}
            semantiqueMasquee={semantiqueMasquee}
            surEtat={ecrire}
            vocabulaire={vocabulaire}
          />
          {etatDonsActif(etat) ? (
            <button
              className="self-start rounded-jeton border border-bord-fort bg-surface px-3 py-1.5 text-petit text-encre hover:bg-survol"
              onClick={() => ecrire(ETAT_VIDE_DONS)}
              type="button"
            >
              Tout effacer
            </button>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-col gap-3">
          {onglet === 'arbre' && cytoscapeDisponible === true ? (
            <VueArbre
              entrees={entrees}
              filtres={filtres}
              index={index}
              surRetourListe={() => ecrireOnglet('liste')}
            />
          ) : (
            <>
              <ChampRecherche
                aide="Le nom d’un don ou un mot de son résumé."
                etiquette="Chercher un don"
                nbResultats={retenus.length}
                placeholder="Nom de don…"
                surChangement={setSaisie}
                valeur={saisie}
              />

              {retenus.length === 0 ? (
                <EtatVide
                  actions={[
                    {
                      libelle: etat.q !== '' ? 'Retirer la recherche' : 'Tout effacer',
                      primaire: true,
                      surClic: () => ecrire(etat.q !== '' ? { ...etat, q: '' } : ETAT_VIDE_DONS),
                    },
                  ]}
                  explication="Aucun don ne réunit tous les critères posés. Retirez le filtre le plus restrictif pour élargir la liste."
                  titre="Aucun don ne correspond"
                />
              ) : (
                <>
                  <p className="m-0 text-petit text-encre-douce">
                    {retenus.length} {retenus.length === 1 ? 'don' : 'dons'}
                    {retenus.length > visibles ? ` — ${visibles} affichés` : ''}
                  </p>
                  <TableDense
                    cleDe={(don) => don.id}
                    colonnes={colonnes}
                    legende="Les dons Pathfinder 1e correspondant aux filtres posés"
                    lignes={retenus.slice(0, visibles)}
                  />
                  {retenus.length > visibles ? (
                    <button
                      className="self-center rounded-jeton border border-bord-fort bg-surface px-3 py-1.5 text-petit text-encre hover:bg-survol"
                      onClick={() => setVisibles((actuel) => actuel + LIGNES_PAR_PAGE)}
                      type="button"
                    >
                      Afficher {Math.min(LIGNES_PAR_PAGE, retenus.length - visibles)} dons de plus
                    </button>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
