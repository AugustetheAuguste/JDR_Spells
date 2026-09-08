'use client'

import { useEffect, useState } from 'react'

import { chargerContratMoteurDons, type ContratCharge } from '@/lib/dons/charger-contrat'
import { evaluerDon } from '@/lib/dons/moteur'
import type { Personnage, ResultatEligibilite } from '@/lib/dons/types'
import { MOTS } from '@/lib/design/tokens'
import { ficheVersCharacter } from '@/lib/fiche_personnage/vers-character'
import type { EntreeCorpus, Fiche } from '@/lib/fiche_personnage/schema'

import { RechercheCorpus } from './RechercheCorpus'

/**
 * La liste des dons rattachés à la fiche, avec un verdict recalculé à
 * chaque rendu — jamais figé au rattachement, jamais mémorisé dans la fiche
 * (plan 16, pseudo-code § SectionDons). Un verdict stocké deviendrait faux
 * dès le premier changement de niveau, exactement le défaut que le plan
 * signale.
 */
export function SectionDons({
  fiche,
  setFiche,
  ouvrirLecture,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
  readonly ouvrirLecture: (ref: string, nom: string, declencheur: HTMLElement) => void
}) {
  const [contrat, setContrat] = useState<ContratCharge | null>(null)

  useEffect(() => {
    let vivant = true
    chargerContratMoteurDons()
      .then((charge) => {
        if (vivant) setContrat(charge)
      })
      .catch(() => {
        if (vivant) setContrat(null)
      })
    return () => {
      vivant = false
    }
  }, [])

  // Recalculé à chaque rendu, en particulier après chaque changement de
  // `fiche` (niveau, classe, dons déjà rattachés) : c'est ce que le plan 16
  // interdit de figer.
  const personnage: Personnage | null = ficheVersCharacter(fiche)

  function rattacher(entree: EntreeCorpus) {
    setFiche((f) => ({ ...f, dons: [...f.dons, entree] }))
  }

  function detacher(indice: number) {
    setFiche((f) => ({ ...f, dons: f.dons.filter((_, i) => i !== indice) }))
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="m-0 flex flex-col gap-2 p-0">
        {fiche.dons.map((don, indice) => (
          <li className="flex flex-col gap-1 border border-bord p-2" key={indice}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-corps text-encre">{don.nom}</span>
              <div className="flex gap-2">
                {(() => {
                  const ref = don.ref
                  if (don.source !== 'pathfinder-fr' || ref === null) return null
                  return (
                    <button
                      className="min-h-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      onClick={(evenement) => ouvrirLecture(ref, don.nom, evenement.currentTarget)}
                      type="button"
                    >
                      {MOTS.corpusBoutonLire}
                    </button>
                  )
                })()}
                <button
                  className="min-h-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={() => detacher(indice)}
                  type="button"
                >
                  {MOTS.corpusBoutonDetacher}
                </button>
              </div>
            </div>
            {contrat !== null && personnage !== null && (
              <VerdictLigne contrat={contrat} nomDon={don.nom} personnage={personnage} />
            )}
          </li>
        ))}
      </ul>

      <RechercheCorpus corpus="dons" personnage={personnage} surLecture={ouvrirLecture} surRattachement={rattacher} />
    </div>
  )
}

function VerdictLigne({
  contrat,
  nomDon,
  personnage,
}: {
  readonly contrat: ContratCharge
  readonly nomDon: string
  readonly personnage: Personnage
}) {
  const conditions = contrat.catalogue.get(nomDon)
  if (conditions === undefined) return null

  const resultat: ResultatEligibilite = evaluerDon(nomDon, conditions, personnage, contrat.tables)

  if (resultat.statut === 'eligible') {
    return <p className="m-0 text-petit text-encre-douce">{MOTS.corpusVerdictEligible}</p>
  }

  const estIneligible = resultat.statut === 'ineligible'
  return (
    <div className="border border-dashed border-bord-fort bg-base px-2 py-1 text-petit text-encre">
      <p className="m-0 font-semibold">
        <span aria-hidden="true">! </span>
        {estIneligible ? MOTS.corpusVerdictIneligible : MOTS.corpusVerdictManuel}
      </p>
      <p className="m-0 mt-1 text-encre-douce">
        {estIneligible ? MOTS.corpusMotifsNonRemplis : MOTS.corpusMotifsIndetermines}
      </p>
      <ul className="m-0 mt-1 list-disc pl-4">
        {resultat.motifs.map((motif, indice) => (
          <li key={indice}>{motif}</li>
        ))}
      </ul>
    </div>
  )
}
