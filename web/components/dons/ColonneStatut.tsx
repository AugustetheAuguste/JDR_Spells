'use client'

import { useEffect, useState } from 'react'

import { MarqueurStatut } from '@/components/dons/MarqueurStatut'
import { usePersonnageActif } from '@/lib/compte/contexte-personnages'
import { chargerContratMoteurDons, type ContratCharge } from '@/lib/dons/charger-contrat'
import { estGroupeOu } from '@/lib/dons/types'
import { evaluerDon } from '@/lib/dons/moteur'
import { versCharacter } from '@/lib/dons/vers-character'

/** True if any requirement of the feat (top-level or inside an OR-group) is a
 * `skill_ranks` check — the one prerequisite type `Character.skill_rank`
 * answers *optimistically* (see the module doc on `versCharacter`'s sibling,
 * `16_CHARACTER_BINDING.md`'s "point à arbitrer"). Without `skill_ranks`
 * explicitly set, every rank prerequisite reads as satisfied, so a feat
 * gated on one needs this explicit "optimiste" label rather than a silent
 * `eligible`. */
function reposeSurDesRangsDeCompetence(contrat: ContratCharge, nomDon: string): boolean {
  const conditions = contrat.catalogue.get(nomDon)
  if (conditions === undefined) return false
  return conditions.exigences.some((item) =>
    estGroupeOu(item)
      ? item.options.some((option) => option.type === 'skill_ranks')
      : item.type === 'skill_ranks',
  )
}

/**
 * The status column's cell — per-row so a page of 200 rows amortizes one
 * fetch of the engine contract (`chargerContratMoteurDons`, cached at module
 * scope) rather than paying it 200 times.
 *
 * Renders nothing (not even `MarqueurStatut`) when no character is active:
 * the plan's own rule for `VueDons.tsx` is that the column is ABSENT without
 * a character, never present with a guessed verdict — this component keeps
 * that rule at the cell level so the column definition stays a one-line
 * conditional on `personnageActif`.
 */
export function ColonneStatut({ nomDon }: { readonly nomDon: string }) {
  const { personnageActif } = usePersonnageActif()
  const [contrat, setContrat] = useState<ContratCharge | null>(null)

  useEffect(() => {
    let vivant = true
    chargerContratMoteurDons()
      .then((charge) => {
        if (vivant) setContrat(charge)
      })
      .catch(() => {
        /* La colonne reste vide pour cette ligne ; `VueDons` a déjà son
         * propre message d’erreur pour un index absent. */
      })
    return () => {
      vivant = false
    }
  }, [])

  if (personnageActif === null || contrat === null) return null

  const conditions = contrat.catalogue.get(nomDon)
  if (conditions === undefined) {
    return (
      <span className="text-micro text-encre-faible" title="Ce don n’a pas de conditions dans le contrat moteur.">
        —
      </span>
    )
  }

  const perso = versCharacter(personnageActif)
  const resultat = evaluerDon(nomDon, conditions, perso, contrat.tables)
  const optimiste = reposeSurDesRangsDeCompetence(contrat, nomDon)

  return (
    <span className="inline-flex flex-col gap-0.5" title={resultat.motifs.join(' · ') || undefined}>
      <MarqueurStatut statut={resultat.statut} />
      {optimiste ? (
        <span className="text-micro text-encre-faible">
          optimiste — rangs de compétence supposés au niveau du personnage, faute de
          rangs réels saisis
        </span>
      ) : null}
    </span>
  )
}
