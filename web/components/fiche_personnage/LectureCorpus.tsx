'use client'

import { useEffect, useState } from 'react'

import { BlocConditions } from '@/components/fiche/BlocConditions'
import { BlocTechnique, lignesTechniques } from '@/components/fiche/BlocTechnique'
import { Description } from '@/components/fiche/Description'
import { LienSource } from '@/components/fiche/LienSource'
import { NiveauxParClasse } from '@/components/fiche/NiveauxParClasse'
import { chargerPropsDon, chargerPropsSort, type ResultatChargement } from '@/lib/fiche_personnage/charger-corpus'
import type { PropsDon } from '@/lib/donnees/don-page'
import type { PropsSort } from '@/lib/donnees/sort-page'

/**
 * The panel's content : the corpus text itself, verbatim, no reformulation
 * and no truncation (plan 16, notes d'implémentation). Reuses the existing
 * detail-page components as-is (`BlocTechnique`, `Description`,
 * `BlocConditions`, `NiveauxParClasse`, `LienSource`) rather than
 * re-rendering the text a second way.
 */
export function LectureCorpus({ corpus, refCorpus }: { readonly corpus: 'sorts' | 'dons'; readonly refCorpus: string }) {
  const [sort, setSort] = useState<ResultatChargement<PropsSort>>({ statut: 'chargement' })
  const [don, setDon] = useState<ResultatChargement<PropsDon>>({ statut: 'chargement' })

  // Chaque ouverture du panneau démonte ce composant (`VueFiche.tsx` ne le
  // rend que quand un panneau est ouvert) : l'état initial `chargement`
  // suffit, remettre `sort`/`don` à `chargement` ici serait un second
  // `setState` synchrone dans l'effet, que `react-hooks/set-state-in-effect`
  // refuse et qui ne changerait rien à l'affichage.
  useEffect(() => {
    let vivant = true
    if (corpus === 'sorts') {
      chargerPropsSort(refCorpus).then((resultat) => {
        if (vivant) setSort(resultat)
      })
    } else {
      chargerPropsDon(refCorpus).then((resultat) => {
        if (vivant) setDon(resultat)
      })
    }
    return () => {
      vivant = false
    }
  }, [corpus, refCorpus])

  if (corpus === 'sorts') {
    if (sort.statut === 'chargement') return <p className="text-encre-douce">Chargement du sort.</p>
    if (sort.statut === 'absent' || sort.statut === 'echec') {
      return <p className="text-encre-douce">Le texte de ce sort n’a pas pu être chargé.</p>
    }
    const props = sort.props
    return (
      <div className="flex flex-col gap-4">
        <BlocTechnique lignes={lignesTechniques(props)} />
        <NiveauxParClasse niveaux={props.niveaux_par_classe} />
        <Description id="lecture-description" texte={props.description} titre="Description" />
        <LienSource url={props.url_source} />
      </div>
    )
  }

  if (don.statut === 'chargement') return <p className="text-encre-douce">Chargement du don.</p>
  if (don.statut === 'absent' || don.statut === 'echec') {
    return <p className="text-encre-douce">Le texte de ce don n’a pas pu être chargé.</p>
  }
  const props = don.props
  return (
    <div className="flex flex-col gap-4">
      {props.raw_conditions !== null && (
        <BlocConditions id="lecture-conditions" texte={props.raw_conditions} titre="Conditions" ton="source" />
      )}
      {props.conditions_ajoutees !== null && (
        <BlocConditions id="lecture-conditions-ajoutees" texte={props.conditions_ajoutees} titre="Conditions relevées sur la page" ton="curation" />
      )}
      {props.avantages !== null && (
        <section aria-labelledby="lecture-avantages">
          <h2 className="m-0 font-affichage text-titre3 font-semibold" id="lecture-avantages">
            Avantages
          </h2>
          <p className="mt-2 max-w-[68ch] text-corps">{props.avantages}</p>
        </section>
      )}
      {props.special !== null && (
        <section aria-labelledby="lecture-special">
          <h2 className="m-0 font-affichage text-titre3 font-semibold" id="lecture-special">
            Spécial
          </h2>
          <p className="mt-2 max-w-[68ch] text-corps">{props.special}</p>
        </section>
      )}
      {props.normal !== null && (
        <section aria-labelledby="lecture-normal">
          <h2 className="m-0 font-affichage text-titre3 font-semibold" id="lecture-normal">
            Normal
          </h2>
          <p className="mt-2 max-w-[68ch] text-corps">{props.normal}</p>
        </section>
      )}
      {props.url_source !== null && <LienSource url={props.url_source} />}
    </div>
  )
}
