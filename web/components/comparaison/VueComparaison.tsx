'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { SelecteurClasses } from '@/components/comparaison/SelecteurClasses'
import { TableComparaison } from '@/components/comparaison/TableComparaison'
import { EtatVide } from '@/components/primitives/EtatVide'
import {
  comparer,
  MIN_CLASSES,
  trierParEcart,
  trierParNom,
  type Comparaison,
} from '@/lib/comparaison/ensembles'
import {
  ETAT_COMPARAISON_VIDE,
  LIBELLES_MODES,
  lireEtatComparaison,
  MODES,
  versQueryComparaison,
  type EtatComparaison,
} from '@/lib/comparaison/etat-comparaison'
import type { IndexWeb } from '@/lib/donnees/index-web'

/**
 * The comparison view.
 *
 * Same index fetch as the browse view, and deliberately the same URL — the
 * browser has `/data/index.json` cached by the time anyone gets here from the
 * spell list, so this costs nothing on the common path.
 *
 * The counters render above the table because the numbers are usually the answer:
 * "how much overlap is there between these two classes" is often the whole
 * question, and the table is the detail behind it.
 */

const LIGNES_PAR_PAGE = 200

function Compteur({
  valeur,
  libelle,
  precision,
}: {
  readonly valeur: number
  readonly libelle: string
  readonly precision?: string
}) {
  return (
    <div className="rounded-panneau border border-bord bg-surface px-3 py-2">
      <p className="m-0 font-donnees text-titre2">{valeur}</p>
      <p className="m-0 text-petit font-semibold text-encre-douce">{libelle}</p>
      {precision === undefined ? null : (
        <p className="m-0 text-micro text-encre-faible">{precision}</p>
      )}
    </div>
  )
}

export function VueComparaison() {
  const router = useRouter()
  const parametres = useSearchParams()

  const [index, setIndex] = useState<IndexWeb | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [visibles, setVisibles] = useState(LIGNES_PAR_PAGE)

  useEffect(() => {
    let vivant = true
    fetch('/data/index.json')
      .then(async (reponse) => {
        if (!reponse.ok) throw new Error(`index.json : ${reponse.status}`)
        return (await reponse.json()) as IndexWeb
      })
      .then((charge) => {
        if (vivant) setIndex(charge)
      })
      .catch((cause: unknown) => {
        if (vivant) setErreur(cause instanceof Error ? cause.message : 'chargement impossible')
      })
    return () => {
      vivant = false
    }
  }, [])

  const etat: EtatComparaison = useMemo(
    () => (index === null ? ETAT_COMPARAISON_VIDE : lireEtatComparaison(parametres, index)),
    [parametres, index],
  )

  const comparaison: Comparaison | null = useMemo(
    () =>
      index === null || etat.classes.length < MIN_CLASSES
        ? null
        : comparer(index, etat.classes),
    [index, etat.classes],
  )

  function ecrire(suivant: EtatComparaison): void {
    const cible = `/comparaison${versQueryComparaison(suivant)}` as
      | `/comparaison?${string}`
      | '/comparaison'
    router.replace(cible)
    setVisibles(LIGNES_PAR_PAGE)
  }

  if (erreur !== null) {
    return (
      <section>
        <h1 className="m-0 font-affichage text-titre1 font-semibold">Comparer des classes</h1>
        <p className="mt-3 text-grand text-encre-douce">
          L’index des sorts n’a pas pu être chargé ({erreur}).
        </p>
      </section>
    )
  }

  if (index === null) {
    return (
      <section>
        <h1 className="m-0 font-affichage text-titre1 font-semibold">Comparer des classes</h1>
        <p aria-live="polite" className="mt-3 text-grand text-encre-douce">
          Chargement de l’index…
        </p>
      </section>
    )
  }

  const noms = new Map(index.classes.map((classe) => [classe.slug, classe.nom]))
  const nomsChoisis = etat.classes.map((slug) => noms.get(slug) ?? slug)

  return (
    <section>
      <h1 className="m-0 font-affichage text-titre1 font-semibold">Comparer des classes</h1>
      <p className="mt-1 mb-4 max-w-[68ch] text-base text-encre-douce">
        Ce que deux ou trois classes partagent, ce qui leur est propre, et surtout{' '}
        <strong>à combien de niveaux d’écart</strong> elles accèdent aux mêmes sorts.
      </p>

      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <aside>
          <SelecteurClasses
            choisies={etat.classes}
            index={index}
            surChangement={(classes) => ecrire({ ...etat, classes })}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {comparaison === null ? (
            <EtatVide
              actions={[
                {
                  libelle: 'Comparer Barde et Druide',
                  primaire: true,
                  surClic: () => ecrire({ ...etat, classes: ['barde', 'druide'] }),
                },
              ]}
              explication={
                etat.classes.length === 0
                  ? 'Choisissez deux classes pour voir ce qu’elles partagent et à quel niveau chacune y accède.'
                  : `${nomsChoisis[0]} est sélectionnée. Il en faut une seconde : une comparaison a besoin de deux listes.`
              }
              titre={
                etat.classes.length === 0
                  ? 'Aucune classe sélectionnée'
                  : 'Il manque une seconde classe'
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Compteur
                  libelle="En commun"
                  precision={`reçus par ${etat.classes.length === 2 ? 'les deux' : 'les trois'}`}
                  valeur={comparaison.partages.length}
                />
                {etat.classes.map((classe) => (
                  <Compteur
                    key={classe}
                    libelle={`Propres à ${noms.get(classe) ?? classe}`}
                    precision="parmi les classes comparées"
                    valeur={comparaison.exclusifs[classe]?.length ?? 0}
                  />
                ))}
                {etat.classes.length > 2 ? (
                  <Compteur
                    libelle="Partiels"
                    precision="deux classes sur trois"
                    valeur={comparaison.partiels.length}
                  />
                ) : null}
              </div>

              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-petit font-semibold text-encre-douce">Afficher :</span>
                {MODES.map((mode) => (
                  <button
                    aria-pressed={etat.mode === mode}
                    className={[
                      'rounded-jeton border px-2.5 py-1 text-petit',
                      etat.mode === mode
                        ? 'border-transparent bg-accent text-surface'
                        : 'border-bord-fort bg-surface text-encre hover:bg-survol',
                    ].join(' ')}
                    key={mode}
                    onClick={() => ecrire({ ...etat, mode })}
                    type="button"
                  >
                    {LIBELLES_MODES[mode]}
                  </button>
                ))}
              </div>

              {etat.mode === 'exclusifs' ? (
                <div className="flex flex-col gap-4">
                  {etat.classes.map((classe) => {
                    const propres = trierParNom(comparaison.exclusifs[classe] ?? [])
                    return (
                      <section aria-labelledby={`exclusifs-${classe}`} key={classe}>
                        <h2
                          className="m-0 mb-1.5 font-affichage text-titre3 font-semibold"
                          id={`exclusifs-${classe}`}
                        >
                          {propres.length} {propres.length === 1 ? 'sort propre' : 'sorts propres'}{' '}
                          à {noms.get(classe) ?? classe}
                        </h2>
                        {propres.length === 0 ? (
                          <p className="m-0 text-base text-encre-douce">
                            Aucun : toutes les autres classes comparées reçoivent aussi ces
                            sorts.
                          </p>
                        ) : (
                          <TableComparaison
                            classes={[classe]}
                            index={index}
                            legende={`Sorts que seule la classe ${noms.get(classe) ?? classe} reçoit parmi celles comparées`}
                            sorts={propres.slice(0, visibles)}
                          />
                        )}
                      </section>
                    )
                  })}
                </div>
              ) : (
                (() => {
                  const lignes = trierParEcart(
                    etat.mode === 'partages' ? comparaison.partages : comparaison.union,
                  )
                  if (lignes.length === 0) {
                    return (
                      <EtatVide
                        actions={[
                          {
                            libelle: 'Voir les exclusifs',
                            primaire: true,
                            surClic: () => ecrire({ ...etat, mode: 'exclusifs' }),
                          },
                        ]}
                        explication={`${nomsChoisis.join(' et ')} n’ont aucun sort en commun. Leurs listes sont disjointes.`}
                        titre="Aucun sort en commun"
                      />
                    )
                  }
                  return (
                    <>
                      <p className="m-0 text-petit text-encre-douce">
                        {lignes.length} {lignes.length === 1 ? 'sort' : 'sorts'}, du plus grand
                        écart de niveau au plus petit
                        {lignes.length > visibles ? ` — ${visibles} affichés` : ''}
                      </p>
                      <TableComparaison
                        classes={etat.classes}
                        index={index}
                        legende={`Sorts comparés entre ${nomsChoisis.join(', ')}, avec le niveau de chaque classe et l’écart`}
                        sorts={lignes.slice(0, visibles)}
                      />
                      {lignes.length > visibles ? (
                        <button
                          className="self-start rounded-jeton border border-bord-fort bg-surface px-3 py-1.5 text-petit text-encre hover:bg-survol"
                          onClick={() => setVisibles((actuel) => actuel + LIGNES_PAR_PAGE)}
                          type="button"
                        >
                          Afficher {Math.min(LIGNES_PAR_PAGE, lignes.length - visibles)} sorts de
                          plus
                        </button>
                      ) : null}
                    </>
                  )
                })()
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
