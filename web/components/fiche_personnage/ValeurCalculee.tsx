'use client'

import { useId, useState } from 'react'

import { MOTS } from '@/lib/design/tokens'
import type { ResultatCalcul } from '@/lib/fiche_personnage/resoudre'

/**
 * Displays one total computed by the engine, its detail expandable on click
 * only (Skill `pf-fiche-personnage`, notes d'implémentation § plan 15 — never
 * on hover, the decision is deliberate for touch users).
 *
 * `resultat.total === null` means introuvable (§3 tri-état, never a silent
 * zero): the missing entries are listed and a manual entry is proposed via
 * `onSaisirManuellement`, when the caller supplies one — some totals (a
 * derived value with no single field to fill) have none.
 *
 * A discarded contribution is barred visually AND carries its `motifEcart` as
 * literal text, because `text-decoration: line-through` is invisible to a
 * screen reader (plan 15, notes d'implémentation).
 */
export function ValeurCalculee({
  libelle,
  resultat,
  onSaisirManuellement,
}: {
  readonly libelle: string
  readonly resultat: ResultatCalcul
  readonly onSaisirManuellement?: () => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const idDetail = useId()

  if (resultat.total === null) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-encre-douce">{libelle}</span>
          <span className="font-mono text-base text-encre-faible">{MOTS.valeurIntrouvable}</span>
        </div>
        {resultat.manquants.length > 0 && (
          <div className="text-petit text-encre-faible">
            <span>{MOTS.valeurManquants}</span>
            <ul className="m-0 list-none p-0">
              {resultat.manquants.map((manquant) => (
                <li key={manquant}>{manquant}</li>
              ))}
            </ul>
          </div>
        )}
        {onSaisirManuellement && (
          <button
            className="min-h-cible w-fit border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onSaisirManuellement}
            type="button"
          >
            {MOTS.valeurSaisirManuellement}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="text-encre-douce">{libelle}</span>
        <span aria-describedby={ouvert ? idDetail : undefined} className="font-mono text-base text-encre">
          {resultat.total}
        </span>
        <button
          aria-expanded={ouvert}
          className="min-h-cible px-1 text-petit text-accent underline hover:text-accent-survol focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => setOuvert((valeur) => !valeur)}
          type="button"
        >
          {ouvert ? MOTS.valeurReplierDetail : MOTS.valeurDeplierDetail}
        </button>
      </div>

      {ouvert && (
        <div className="border border-bord bg-surface p-2 text-petit" id={idDetail}>
          <p className="m-0 font-semibold text-encre">{MOTS.valeurDetailTitre}</p>
          <ul className="m-0 list-none p-0">
            {resultat.detail.map((contribution, indice) => (
              <li className="flex flex-col" key={`${contribution.libelle}-${indice}`}>
                <span className={contribution.retenue ? 'text-encre' : 'text-encre-faible line-through'}>
                  {contribution.libelle}, {contribution.valeur >= 0 ? '+' : ''}
                  {contribution.valeur}, {contribution.type}
                </span>
                {!contribution.retenue && (
                  <span className="text-encre-faible">
                    {MOTS.valeurContributionNonRetenue}
                    {contribution.motifEcart ? `, ${contribution.motifEcart}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
