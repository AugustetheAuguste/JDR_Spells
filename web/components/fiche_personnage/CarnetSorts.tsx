'use client'

import { useEffect, useState } from 'react'

import { NiveauxParClasse } from '@/components/fiche/NiveauxParClasse'
import { MOTS } from '@/lib/design/tokens'
import { chargerPropsSort, type ResultatChargement } from '@/lib/fiche_personnage/charger-corpus'
import type { EntreeCorpus, Fiche, ModeCarnetSorts } from '@/lib/fiche_personnage/schema'
import type { PropsSort } from '@/lib/donnees/sort-page'

import { RechercheCorpus } from './RechercheCorpus'

const MODES: readonly { readonly valeur: ModeCarnetSorts; readonly libelle: string; readonly texte: string }[] = [
  { valeur: 'prepare', libelle: MOTS.sortsModePrepareLibelle, texte: MOTS.sortsModePrepareTexte },
  { valeur: 'spontane', libelle: MOTS.sortsModeSpontaneLibelle, texte: MOTS.sortsModeSpontaneTexte },
  { valeur: 'usageLimite', libelle: MOTS.sortsModeUsageLimiteLibelle, texte: MOTS.sortsModeUsageLimiteTexte },
]

/**
 * Le carnet de sorts : le choix du mode, purement descriptif (il ne compte
 * rien), et les listes de sorts connus et préparés — chacune avec son
 * niveau PAR CLASSE, jamais un scalaire (plan 16, critère 9). Aucun
 * compteur, aucune case à cocher, aucune notion de reste (critère 11).
 */
export function CarnetSorts({
  fiche,
  setFiche,
  ouvrirLecture,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
  readonly ouvrirLecture: (ref: string, nom: string, declencheur: HTMLElement) => void
}) {
  function choisirMode(mode: ModeCarnetSorts | null) {
    setFiche((f) => ({ ...f, sorts: { ...f.sorts, mode } }))
  }

  function rattacherConnu(entree: EntreeCorpus) {
    setFiche((f) => ({ ...f, sorts: { ...f.sorts, sortsConnus: [...f.sorts.sortsConnus, entree] } }))
  }

  function detacherConnu(indice: number) {
    setFiche((f) => ({ ...f, sorts: { ...f.sorts, sortsConnus: f.sorts.sortsConnus.filter((_, i) => i !== indice) } }))
  }

  function rattacherPrepare(entree: EntreeCorpus) {
    setFiche((f) => ({ ...f, sorts: { ...f.sorts, sortsPrepares: [...f.sorts.sortsPrepares, entree] } }))
  }

  function detacherPrepare(indice: number) {
    setFiche((f) => ({ ...f, sorts: { ...f.sorts, sortsPrepares: f.sorts.sortsPrepares.filter((_, i) => i !== indice) } }))
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 flex flex-col gap-2 border border-bord p-2">
        <legend className="px-1 text-petit font-semibold text-encre-douce">Mode d’incantation</legend>
        {MODES.map((mode) => (
          <label className="flex items-start gap-2 text-corps text-encre" key={mode.valeur}>
            <input
              checked={fiche.sorts.mode === mode.valeur}
              onChange={() => choisirMode(mode.valeur)}
              type="radio"
            />
            <span>
              <span className="font-semibold">{mode.libelle}</span>
              <br />
              <span className="text-petit text-encre-douce">{mode.texte}</span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-2 text-corps text-encre">
          <input checked={fiche.sorts.mode === null} onChange={() => choisirMode(null)} type="radio" />
          <span className="text-petit text-encre-douce">{MOTS.sortsModeAucunLibelle}</span>
        </label>
      </fieldset>

      <div>
        <p className="m-0 font-affichage text-titre3 font-semibold text-encre">{MOTS.sortsConnusTitre}</p>
        <ListeSorts entrees={fiche.sorts.sortsConnus} onDetacher={detacherConnu} ouvrirLecture={ouvrirLecture} />
        <RechercheCorpus corpus="sorts" surLecture={ouvrirLecture} surRattachement={rattacherConnu} />
      </div>

      {fiche.sorts.mode === 'prepare' && (
        <div>
          <p className="m-0 font-affichage text-titre3 font-semibold text-encre">{MOTS.sortsPreparesTitre}</p>
          <ListeSorts entrees={fiche.sorts.sortsPrepares} onDetacher={detacherPrepare} ouvrirLecture={ouvrirLecture} />
          <RechercheCorpus corpus="sorts" surLecture={ouvrirLecture} surRattachement={rattacherPrepare} />
        </div>
      )}
    </div>
  )
}

function ListeSorts({
  entrees,
  onDetacher,
  ouvrirLecture,
}: {
  readonly entrees: readonly EntreeCorpus[]
  readonly onDetacher: (indice: number) => void
  readonly ouvrirLecture: (ref: string, nom: string, declencheur: HTMLElement) => void
}) {
  if (entrees.length === 0) {
    return <p className="mt-1 text-petit text-encre-douce">{MOTS.sortsAucunSortRattache}</p>
  }
  return (
    <ul className="m-0 mt-2 flex flex-col gap-3 p-0">
      {entrees.map((sort, indice) => (
        <li className="flex flex-col gap-2 border border-bord p-2" key={indice}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-corps text-encre">{sort.nom}</span>
            <div className="flex gap-2">
              {sort.source === 'pathfinder-fr' && sort.ref !== null && (
                <button
                  className="min-h-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={(evenement) => ouvrirLecture(sort.ref as string, sort.nom, evenement.currentTarget)}
                  type="button"
                >
                  {MOTS.corpusBoutonLire}
                </button>
              )}
              <button
                className="min-h-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => onDetacher(indice)}
                type="button"
              >
                {MOTS.corpusBoutonDetacher}
              </button>
            </div>
          </div>
          {sort.source === 'pathfinder-fr' && sort.ref !== null && <NiveauxDuSort slug={sort.ref} />}
        </li>
      ))}
    </ul>
  )
}

/** Charge le sort par son slug pour n'afficher le niveau que par classe —
 * jamais un scalaire (plan 16, critère 9), en réutilisant `NiveauxParClasse`
 * tel quel plutôt que de refaire ce rendu une seconde fois. */
function NiveauxDuSort({ slug }: { readonly slug: string }) {
  const [resultat, setResultat] = useState<ResultatChargement<PropsSort>>({ statut: 'chargement' })

  useEffect(() => {
    let vivant = true
    chargerPropsSort(slug).then((r) => {
      if (vivant) setResultat(r)
    })
    return () => {
      vivant = false
    }
  }, [slug])

  if (resultat.statut !== 'ok') return null
  return <NiveauxParClasse niveaux={resultat.props.niveaux_par_classe} />
}
