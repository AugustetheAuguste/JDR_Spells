'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Barres } from '@/components/exploration/Barres'
import { CheminForage } from '@/components/exploration/CheminForage'
import { ChoixClasse } from '@/components/exploration/ChoixClasse'
import { Donut } from '@/components/exploration/Donut'
import { FiltreTags } from '@/components/navigation/FiltreTags'
import { TableSorts } from '@/components/navigation/TableSorts'
import { EtatVide } from '@/components/primitives/EtatVide'
import type { EntreeSort, IndexWeb } from '@/lib/donnees/index-web'
import {
  AXES,
  axesDisponibles,
  axeSuggere,
  discrimine,
  forer,
  remonter,
  retirerAxe,
  type CleAxe,
} from '@/lib/exploration/axes'
import { classesChoisies } from '@/lib/exploration/classes-choisies'
import {
  EXPLORATION_VIDE,
  explorationActive,
  lireExploration,
  versFiltresExploration,
  versQueryExploration,
  versQueryTableau,
  type EtatExploration,
} from '@/lib/exploration/etat-exploration'
import { trierParNiveauPuisNom } from '@/lib/navigation/niveaux'
import { appliquerFiltres } from '@/lib/recherche/filtres'

/**
 * The exploration view: choose a class, then narrow one chart at a time.
 *
 * The same three rules as the table view, for the same reasons. The URL is the only
 * state — there is no `useState` holding a filter, so the back button undoes a
 * drill exactly the way the interface's own « remonter » does, and a link pasted
 * into a chat reopens the same wedge. The index is fetched rather than inlined,
 * because 2070 spells in the exported HTML would be paid for on every page of the
 * site. And no search engine is loaded here at all: this route narrows by clicking,
 * so MiniSearch would be weight nobody uses.
 *
 * Two deliberate choices are its own:
 *
 *   - **the axis on display is cut with its own criterion lifted.** Re-opening a
 *     question already answered has to show the wedges it was answered among, not a
 *     single full ring saying « they are all this ». So the chart is computed
 *     against `axe.retirer(etat)` while the spell list below it is computed against
 *     the real state.
 *   - **drilling pushes a history entry, adjusting the axis replaces one.** A drill
 *     is a navigation and the back button is the reader's own zoom-out; flipping
 *     between two ways of cutting the same subset is not, and ten of those would
 *     bury the drill in history.
 */

/** Above this, the remaining spells go behind a disclosure: the point of the route
 * is to narrow, and printing 500 rows under the chart makes the chart scroll away.
 * The table view is the right tool at that width, and it is linked. */
const SEUIL_LISTE = 60

export function VueExploration() {
  const router = useRouter()
  const parametres = useSearchParams()

  const [index, setIndex] = useState<IndexWeb | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  /** The slices ticked on the chart on display, not yet posed. Local rather than
   * in the URL: it is a draft, and only « Valider ce choix » turns it into a
   * criterion worth sharing in a link. Keyed by the axis and the state it is
   * drawn against, so switching axes or drilling elsewhere starts a fresh draft
   * instead of carrying stale ticks onto a chart that does not show them. */
  const [brouillon, setBrouillon] = useState<{
    readonly cle: string
    readonly valeurs: readonly string[]
  }>({ cle: '', valeurs: [] })

  useEffect(() => {
    let vivant = true
    fetch('/data/index.json')
      .then(async (reponse) => {
        if (!reponse.ok) throw new Error(`index.json : ${reponse.status}`)
        const charge = (await reponse.json()) as IndexWeb
        if (vivant) setIndex(charge)
      })
      .catch((cause: unknown) => {
        if (vivant) setErreur(cause instanceof Error ? cause.message : 'chargement impossible')
      })
    return () => {
      vivant = false
    }
  }, [])

  const etat: EtatExploration = useMemo(
    () => (index === null ? EXPLORATION_VIDE : lireExploration(parametres, index)),
    [parametres, index],
  )

  /** The spells a state selects. Passed around as a function because the view needs
   * it for several hypothetical states, not only the current one. */
  const sousEnsemble = useMemo(() => {
    return (candidat: EtatExploration): readonly EntreeSort[] => {
      if (index === null) return []
      return appliquerFiltres(index.sorts, versFiltresExploration(candidat, index))
    }
  }, [index])

  const sorts = useMemo(() => sousEnsemble(etat), [sousEnsemble, etat])

  function ecrire(suivant: EtatExploration, historique: 'push' | 'replace'): void {
    // Typed routes name the route without its trailing slash, whatever
    // `trailingSlash` then does to the emitted path.
    const cible = `/explorer${versQueryExploration(suivant)}` as
      | '/explorer'
      | `/explorer?${string}`
    if (historique === 'push') router.push(cible)
    else router.replace(cible)
  }

  if (erreur !== null) {
    return (
      <section>
        <h1 className="m-0 font-affichage text-titre1 font-semibold">Explorer</h1>
        <p className="mt-3 text-grand text-encre-douce">
          L’index des sorts n’a pas pu être chargé ({erreur}). Rechargez la page ; si
          l’erreur persiste, elle est dans le déploiement. Le corpus reste consultable sur{' '}
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
        <h1 className="m-0 font-affichage text-titre1 font-semibold">Explorer</h1>
        <p aria-live="polite" className="mt-3 text-grand text-encre-douce">
          Chargement de l’index…
        </p>
      </section>
    )
  }

  // Step one. Shown only when nothing at all is posed, so that a shared link that
  // skips the class opens on its chart rather than back at the door.
  if (etat.base.classe === null && !explorationActive(etat)) {
    return (
      <section>
        <h1 className="m-0 font-affichage text-titre1 font-semibold">Explorer</h1>
        <p className="mt-1 mb-5 max-w-[68ch] text-grand text-encre-douce">
          Choisissez une ou plusieurs classes, puis resserrez de graphique en graphique
          jusqu’au sort qu’il vous faut. Plusieurs classes montrent l’union de leurs
          sorts. Chaque clic entre d’un cran ; la flèche de retour du navigateur ressort
          du même cran.
        </p>
        <ChoixClasse
          index={index}
          surClasses={(classes) =>
            ecrire(
              {
                ...EXPLORATION_VIDE,
                base: { ...EXPLORATION_VIDE.base, classe: classes[0] ?? null },
                classesSupplementaires: classes.slice(1),
              },
              'push',
            )
          }
          // `axe` alone is enough to mean « the reader has started »: it is state, so
          // it lives in the URL, and it saves inventing a key that means nothing else.
          surSansClasse={() => ecrire({ ...EXPLORATION_VIDE, axe: 'niveau' }, 'push')}
        />
      </section>
    )
  }

  const utilisables = axesDisponibles(index, etat).filter((axe) =>
    discrimine(axe, sousEnsemble(axe.retirer(etat)), index, etat),
  )
  const suggere = axeSuggere(index, etat, sousEnsemble)
  const cleAxe: CleAxe | null =
    etat.axe !== null && utilisables.some((axe) => axe.cle === etat.axe) ? etat.axe : suggere
  const axe = cleAxe === null ? null : AXES[cleAxe]

  // The chart is cut with this axis's own answer lifted; the list below is not.
  const etatDuGraphique = axe === null ? etat : axe.retirer(etat)
  const sortsDuGraphique = axe === null ? sorts : sousEnsemble(etatDuGraphique)
  const tranches =
    axe === null ? [] : axe.decouper(sortsDuGraphique, index, etatDuGraphique)

  const classes = classesChoisies(etat)
  const nomsClasses = classes.map(
    (slug) => index.classes.find((entree) => entree.slug === slug)?.nom ?? slug,
  )
  const listes = trierParNiveauPuisNom(index, sorts, etat.base.classe)
  const queryTableau = versQueryTableau(etat)

  // Every axis accepts several ticks at once, confirmed by its own button: the
  // reader can pose « niveau 0, 1 et 2 » in one visit to the chart instead of
  // drilling three times and backing out twice.
  const multiple = axe !== null
  const cleBrouillon = axe === null ? '' : `${axe.cle}${versQueryExploration(etatDuGraphique)}`
  const selection = multiple && brouillon.cle === cleBrouillon ? brouillon.valeurs : []
  function basculer(valeur: string): void {
    const suivantes = selection.includes(valeur)
      ? selection.filter((autre) => autre !== valeur)
      : [...selection, valeur]
    setBrouillon({ cle: cleBrouillon, valeurs: suivantes })
  }
  function valider(): void {
    if (axe === null || selection.length === 0) return
    setBrouillon({ cle: '', valeurs: [] })
    ecrire(forer(etat, axe.cle, selection), 'push')
  }

  return (
    <section>
      <h1 className="m-0 font-affichage text-titre1 font-semibold">Explorer</h1>
      <p className="mt-1 mb-4 text-base text-encre-douce">
        {sorts.length} {sorts.length === 1 ? 'sort' : 'sorts'} à ce stade
        {nomsClasses.length === 0
          ? ''
          : nomsClasses.length === 1
            ? `, pour le ${nomsClasses[0]!.toLowerCase()}`
            : `, pour ${nomsClasses.map((nom) => nom.toLowerCase()).join(' ou ')}`}
        .{' '}
        <Link
          className="text-accent underline hover:text-accent-survol"
          href={{ pathname: '/', query: queryTableau.replace('?', '') }}
        >
          Voir ces sorts en tableau
        </Link>
      </p>

      <div className="mb-5">
        <CheminForage
          etat={etat}
          index={index}
          surRemonter={() => ecrire(remonter(etat), 'push')}
          surRetirerAxe={(cle) => ecrire(retirerAxe(etat, cle), 'push')}
          surRetirerClasse={() => ecrire(EXPLORATION_VIDE, 'push')}
          surRetirerTag={(tag) =>
            ecrire(
              {
                ...etat,
                base: {
                  ...etat.base,
                  tags: etat.base.tags.filter((autre) => autre !== tag),
                  tagsExclus: etat.base.tagsExclus.filter((autre) => autre !== tag),
                  tagsObliges: etat.base.tagsObliges.filter((autre) => autre !== tag),
                },
              },
              'replace',
            )
          }
          surTout={() => ecrire(EXPLORATION_VIDE, 'push')}
        />
      </div>

      {/* Standing, not a step in the drill: several tags across several families
          can be posed at once, and none of them push a history entry — a filter
          adjustment, exactly as the table route treats the same panel. */}
      {index.tags.length === 0 ? null : (
        <div className="mb-5 rounded-panneau border border-bord bg-surface px-4 py-4">
          <FiltreTags
            surTags={(tags, tagsExclus, tagsObliges) =>
              ecrire({ ...etat, base: { ...etat.base, tags, tagsExclus, tagsObliges } }, 'replace')
            }
            tags={etat.base.tags}
            tagsConnus={index.tags}
            tagsExclus={etat.base.tagsExclus}
            tagsObliges={etat.base.tagsObliges}
          />
        </div>
      )}

      {sorts.length === 0 ? (
        <EtatVide
          actions={[
            {
              libelle: 'Remonter d’un cran',
              primaire: true,
              surClic: () => ecrire(remonter(etat), 'push'),
            },
            { libelle: 'Repartir de zéro', surClic: () => ecrire(EXPLORATION_VIDE, 'push') },
          ]}
          explication="Les critères posés ne se rencontrent sur aucun sort du corpus. C’est un fait du corpus, pas une erreur : remontez d’un cran pour retrouver le dernier ensemble non vide."
          titre="Aucun sort ne réunit ces critères"
        />
      ) : axe === null ? (
        <div className="rounded-panneau border border-bord bg-surface px-4 py-5">
          <p className="m-0 font-affichage text-titre3 font-semibold">Vous y êtes.</p>
          <p className="mt-2 mb-0 max-w-[68ch] text-base text-encre-douce">
            Plus aucun découpage ne sépare ces {sorts.length}{' '}
            {sorts.length === 1 ? 'sort' : 'sorts'} : ils partagent tout ce que cette page
            sait comparer. La suite se lit sur les fiches, ci-dessous.
          </p>
        </div>
      ) : (
        <div className="rounded-panneau border border-bord bg-surface px-4 py-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 font-affichage text-titre3 font-semibold">
              {axe.question(index, etatDuGraphique)}
            </h2>
            <fieldset className="m-0 border-0 p-0">
              <legend className="sr-only">Découper par</legend>
              <div className="flex flex-wrap gap-1.5">
                {utilisables.map((autre) => (
                  <button
                    aria-pressed={autre.cle === cleAxe}
                    className={[
                      'rounded-jeton border px-2 py-1 text-petit',
                      autre.cle === cleAxe
                        ? 'border-accent bg-accent-voile text-encre'
                        : 'border-bord bg-surface text-encre-douce hover:bg-survol',
                    ].join(' ')}
                    key={autre.cle}
                    // Re-slicing the same subset is not a navigation: `replace`, so
                    // the drill stays the thing the back button undoes.
                    onClick={() => ecrire({ ...etat, axe: autre.cle }, 'replace')}
                    type="button"
                  >
                    {autre.bouton}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {(typeof axe.forme === 'function' ? axe.forme(etatDuGraphique) : axe.forme) ===
          'donut' ? (
            <Donut
              legendeTotal={sortsDuGraphique.length === 1 ? 'sort' : 'sorts'}
              multiple={multiple}
              selection={selection}
              surChoix={basculer}
              total={sortsDuGraphique.length}
              tranches={tranches}
            />
          ) : (
            <Barres
              multiple={multiple}
              selection={selection}
              surChoix={basculer}
              total={sortsDuGraphique.length}
              tranches={tranches}
            />
          )}

          {multiple ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-bord pt-3">
              <button
                className="rounded-jeton bg-accent px-3 py-1.5 text-petit font-semibold text-surface enabled:hover:bg-accent-survol disabled:cursor-not-allowed disabled:bg-bord-fort disabled:text-encre-faible"
                disabled={selection.length === 0}
                onClick={valider}
                type="button"
              >
                Valider ce choix
              </button>
              <p className="m-0 text-petit text-encre-douce">
                {selection.length === 0
                  ? 'Cochez une ou plusieurs tranches ci-dessus, puis validez — vous pouvez en poser plusieurs à la fois.'
                  : `${selection.length} ${selection.length === 1 ? 'tranche cochée' : 'tranches cochées'}.`}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {sorts.length === 0 ? null : (
        <div className="mt-5">
          {listes.length <= SEUIL_LISTE ? (
            <>
              <h2 className="m-0 mb-2 font-affichage text-titre3 font-semibold">
                {listes.length === 1 ? 'Le sort restant' : `Les ${listes.length} sorts restants`}
              </h2>
              <TableSorts classe={etat.base.classe} index={index} sorts={listes} />
            </>
          ) : (
            <details>
              <summary className="cursor-pointer text-base text-accent">
                Voir les {listes.length} sorts de cet ensemble (les {SEUIL_LISTE} premiers)
              </summary>
              <div className="mt-2">
                <TableSorts
                  classe={etat.base.classe}
                  index={index}
                  sorts={listes.slice(0, SEUIL_LISTE)}
                />
                <p className="mt-2 mb-0 text-petit text-encre-douce">
                  La liste est tronquée à {SEUIL_LISTE} lignes : resserrez encore, ou{' '}
                  <Link
                    className="text-accent underline hover:text-accent-survol"
                    href={{ pathname: '/', query: queryTableau.replace('?', '') }}
                  >
                    ouvrez ces sorts en tableau
                  </Link>
                  .
                </p>
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
