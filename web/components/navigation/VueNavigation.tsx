'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { ChampRecherche } from '@/components/primitives/ChampRecherche'
import { EtatVide } from '@/components/primitives/EtatVide'
import { PanneauFiltres } from '@/components/navigation/PanneauFiltres'
import { TableSorts } from '@/components/navigation/TableSorts'
import type { EntreeSort, IndexWeb } from '@/lib/donnees/index-web'
import {
  ETAT_VIDE,
  etatActif,
  filtreLePlusRestrictif,
  LIBELLES_FILTRES,
  lireEtat,
  sansFiltre,
  versFiltres,
  versQueryString,
  type EtatUrl,
} from '@/lib/navigation/etat-url'
import { trierParNiveauPuisNom } from '@/lib/navigation/niveaux'
import { appliquerFiltres } from '@/lib/recherche/filtres'
import { construireMoteur, type Moteur, type TableAlias } from '@/lib/recherche/moteur'

/**
 * The navigation view.
 *
 * The URL is the only state (B7). `useSearchParams` is read on every render and
 * nothing here mirrors it in a `useState` — the one exception is the search box,
 * which holds the raw keystrokes so that typing stays responsive while the URL
 * catches up on a debounce. That copy is one-directional and reconciled from the
 * URL, which is what keeps the back button honest.
 *
 * The index is fetched rather than passed as props. Inlining 2070 spells into the
 * exported HTML would put the same ~800 kB into every page of the site; fetching
 * `/data/index.json` once lets it be cached like the static asset it is.
 */

const DELAI_FRAPPE = 80
const LIGNES_PAR_PAGE = 200

export function VueNavigation() {
  const router = useRouter()
  const parametres = useSearchParams()

  const [index, setIndex] = useState<IndexWeb | null>(null)
  const [alias, setAlias] = useState<TableAlias | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [visibles, setVisibles] = useState(LIGNES_PAR_PAGE)

  useEffect(() => {
    let vivant = true
    async function charger(): Promise<void> {
      // The alias table is optional: without it search still works in French,
      // so a failure there must not take the whole view down with it.
      const [reponseIndex, reponseAlias] = await Promise.all([
        fetch('/data/index.json'),
        fetch('/data/alias.json').catch(() => null),
      ])
      if (!reponseIndex.ok) throw new Error(`index.json : ${reponseIndex.status}`)
      const chargeIndex = (await reponseIndex.json()) as IndexWeb
      const chargeAlias =
        reponseAlias !== null && reponseAlias.ok ? ((await reponseAlias.json()) as TableAlias) : null
      if (!vivant) return
      setIndex(chargeIndex)
      setAlias(chargeAlias)
    }
    charger().catch((cause: unknown) => {
      if (vivant) setErreur(cause instanceof Error ? cause.message : 'chargement impossible')
    })
    return () => {
      vivant = false
    }
  }, [])

  const etat: EtatUrl = useMemo(
    () => (index === null ? ETAT_VIDE : lireEtat(parametres, index)),
    [parametres, index],
  )

  // The one local copy of URL state, and it is one-directional: the box holds raw
  // keystrokes so typing stays responsive while the URL catches up on a debounce.
  // Reconciliation happens DURING render, not in an effect — a `setState` in an
  // effect renders twice and shows the stale value for one frame, which on a back
  // button is visible as the old query flashing in the field.
  const [saisie, setSaisie] = useState(etat.q)
  const [qVue, setQVue] = useState(etat.q)
  if (qVue !== etat.q) {
    // A back button, a pasted link or a cleared filter wins over the local copy.
    setQVue(etat.q)
    setSaisie(etat.q)
  }

  const moteur: Moteur | null = useMemo(
    () => (index === null ? null : construireMoteur(index, alias)),
    [index, alias],
  )

  function ecrire(suivant: EtatUrl, historique: 'replace' | 'push' = 'replace'): void {
    // `typedRoutes` accepts a route followed by a query string, which is exactly
    // what this is: the path is the literal '/', the state is the query.
    const cible = `/${versQueryString(suivant)}` as `/?${string}` | '/'
    // `replace` for filter adjustments, `push` for a class change: ten filter
    // clicks that each add a history entry make the back button useless.
    if (historique === 'push') router.push(cible)
    else router.replace(cible)
    setVisibles(LIGNES_PAR_PAGE)
  }

  useEffect(() => {
    if (index === null || saisie === etat.q) return
    const minuteur = setTimeout(() => ecrire({ ...etat, q: saisie }), DELAI_FRAPPE)
    return () => clearTimeout(minuteur)
    // `ecrire` is stable enough for this: it closes over `router` only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie, etat, index])

  const { resultats, viaAlias } = useMemo(() => {
    if (index === null) return { resultats: [] as EntreeSort[], viaAlias: new Set<string>() }
    const filtres = versFiltres(etat, index)
    const trouves = etat.q === '' ? null : (moteur?.chercher(etat.q, 2070) ?? null)
    if (trouves === null) {
      return {
        resultats: trierParNiveauPuisNom(index, appliquerFiltres(index.sorts, filtres), etat.classe),
        viaAlias: new Set<string>(),
      }
    }
    // With a query, the search order IS the ranking; filters cull it without
    // re-sorting, or the relevance the engine computed would be thrown away.
    const parId = new Map(index.sorts.map((sort) => [sort.id, sort]))
    const ordonnes = trouves
      .map((resultat) => parId.get(resultat.id))
      .filter((sort): sort is EntreeSort => sort !== undefined)
    return {
      resultats: appliquerFiltres(ordonnes, filtres),
      viaAlias: new Set(trouves.filter((r) => r.via === 'alias').map((r) => r.id)),
    }
  }, [index, moteur, etat])

  if (erreur !== null) {
    return (
      <section>
        <h1 className="m-0 font-affichage text-titre1 font-semibold">Sorts</h1>
        <p className="mt-3 text-grand text-encre-douce">
          L’index des sorts n’a pas pu être chargé ({erreur}). Le corpus reste consultable
          sur{' '}
          <a className="text-accent underline" href="https://www.pathfinder-fr.org/">
            pathfinder-fr.org
          </a>
          .
        </p>
      </section>
    )
  }

  if (index === null) {
    return (
      <section>
        <h1 className="m-0 font-affichage text-titre1 font-semibold">Sorts</h1>
        <p aria-live="polite" className="mt-3 text-grand text-encre-douce">
          Chargement de l’index…
        </p>
      </section>
    )
  }

  const coupable = filtreLePlusRestrictif(etat)

  return (
    <section>
      <h1 className="m-0 font-affichage text-titre1 font-semibold">Sorts</h1>
      <p className="mt-1 mb-4 text-base text-encre-douce">
        {index.sorts.length} sorts du wiki francophone.{' '}
        <span className="text-encre-faible">
          Un niveau n’existe que relativement à une classe.
        </span>
      </p>

      <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
        <aside className="flex flex-col gap-4">
          <PanneauFiltres
            etat={etat}
            index={index}
            surClasse={(classe) => ecrire({ ...etat, classe }, 'push')}
            surEtat={(suivant) => ecrire(suivant)}
          />
          {etatActif(etat) ? (
            <button
              className="self-start rounded-jeton border border-bord-fort bg-surface px-3 py-1.5 text-petit text-encre hover:bg-survol"
              onClick={() => ecrire(ETAT_VIDE, 'push')}
              type="button"
            >
              Tout effacer
            </button>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-col gap-3">
          <ChampRecherche
            aide="Le nom français ou anglais. Les accents et les apostrophes sont optionnels."
            nbResultats={resultats.length}
            surChangement={setSaisie}
            valeur={saisie}
          />

          {resultats.length === 0 ? (
            <EtatVide
              actions={
                coupable === null
                  ? [{ libelle: 'Voir tous les sorts', primaire: true, surClic: () => ecrire(ETAT_VIDE) }]
                  : [
                      {
                        libelle: `Retirer ${LIBELLES_FILTRES[coupable]}`,
                        primaire: true,
                        surClic: () => ecrire(sansFiltre(etat, coupable)),
                      },
                      { libelle: 'Tout effacer', surClic: () => ecrire(ETAT_VIDE) },
                    ]
              }
              explication={
                coupable === null
                  ? 'Aucun sort ne correspond, et aucun filtre n’est posé — l’index est peut-être vide.'
                  : `Aucun sort ne réunit tous les critères posés. Le plus restrictif est ${LIBELLES_FILTRES[coupable]}.`
              }
              titre="Aucun sort ne correspond"
            />
          ) : (
            <>
              <p className="m-0 text-petit text-encre-douce">
                {resultats.length} {resultats.length === 1 ? 'sort' : 'sorts'}
                {resultats.length > visibles ? ` — ${visibles} affichés` : ''}
              </p>
              <TableSorts
                classe={etat.classe}
                index={index}
                sorts={resultats.slice(0, visibles)}
                viaAlias={viaAlias}
              />
              {/* Paging rather than a virtualizer: a windowed table breaks
                  Ctrl+F, and Ctrl+F is how people actually use a long list.
                  200 rows render well under a frame; the button is the escape
                  hatch for the rare full-corpus browse. */}
              {resultats.length > visibles ? (
                <button
                  className="self-center rounded-jeton border border-bord-fort bg-surface px-3 py-1.5 text-petit text-encre hover:bg-survol"
                  onClick={() => setVisibles((actuel) => actuel + LIGNES_PAR_PAGE)}
                  type="button"
                >
                  Afficher {Math.min(LIGNES_PAR_PAGE, resultats.length - visibles)} sorts de plus
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
