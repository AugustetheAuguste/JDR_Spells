'use client'

import { useState } from 'react'

import { AXES, CLES_AXES, type CleAxe } from '@/lib/exploration/axes'
import { ecrirePreferenceRoue } from '@/lib/exploration/preferences-roue'

/**
 * Which wheel categories show, and in what order — a folded panel next to the
 * axis buttons, editing a draft until « Valider » commits it.
 *
 * Up/down buttons rather than drag-and-drop: reordering seven items by keyboard
 * is one predictable action per press, and drag-and-drop would be the first
 * pointer-only interaction on this route (`Donut`'s wedges are a shortcut for a
 * button list underneath, never the only way in — this keeps that discipline).
 *
 * `niveau` has no checkbox and no arrows: every question on this route starts
 * from "what level", so a wheel without it is not a lighter wheel, it is a
 * broken one.
 */
export function PersonnaliserRoue({
  ordre,
  surOrdre,
}: {
  readonly ordre: readonly CleAxe[]
  readonly surOrdre: (ordre: readonly CleAxe[]) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const reglables: readonly CleAxe[] = CLES_AXES.filter((cle) => cle !== 'niveau')
  const [brouillon, setBrouillon] = useState<readonly CleAxe[]>(ordre)

  function ouvrir(): void {
    setBrouillon(ordre)
    setOuvert(true)
  }

  function basculer(cle: CleAxe): void {
    setBrouillon((actuel) =>
      actuel.includes(cle) ? actuel.filter((autre) => autre !== cle) : [...actuel, cle],
    )
  }

  function deplacer(cle: CleAxe, sens: -1 | 1): void {
    setBrouillon((actuel) => {
      const rang = actuel.indexOf(cle)
      const suivant = rang + sens
      if (rang < 0 || suivant < 0 || suivant >= actuel.length) return actuel
      const copie = [...actuel]
      const tmp = copie[rang]!
      copie[rang] = copie[suivant]!
      copie[suivant] = tmp
      return copie
    })
  }

  function valider(): void {
    ecrirePreferenceRoue(brouillon)
    surOrdre(['niveau', ...brouillon])
    setOuvert(false)
  }

  if (!ouvert) {
    return (
      <button
        className="rounded-jeton border border-bord bg-surface px-2 py-1 text-petit text-encre-douce hover:bg-survol"
        onClick={ouvrir}
        type="button"
      >
        Personnaliser la roue
      </button>
    )
  }

  const choisis = brouillon.filter((cle) => reglables.includes(cle))
  const restants = reglables.filter((cle) => !choisis.includes(cle))

  return (
    <div className="w-full rounded-panneau border border-bord bg-surface p-3">
      <p className="m-0 mb-2 text-petit font-semibold text-encre-douce">
        Catégories de la roue
      </p>
      <p className="m-0 mb-2 text-micro text-encre-faible">
        Niveau reste toujours en premier. Cochez les autres catégories à afficher.
        Les flèches changent leur ordre.
      </p>
      <ul className="m-0 mb-3 flex list-none flex-col gap-1 p-0">
        {choisis.map((cle, rang) => (
          <li className="flex items-center gap-2" key={cle}>
            <button
              aria-pressed={true}
              className="flex flex-1 items-center gap-2 rounded-jeton border border-accent bg-accent-voile px-2 py-1 text-left text-petit text-encre"
              onClick={() => basculer(cle)}
              type="button"
            >
              <span aria-hidden="true" className="font-donnees">✓</span>
              {AXES[cle].bouton}
            </button>
            <button
              aria-label={`Monter ${AXES[cle].bouton}`}
              className="rounded-jeton border border-bord px-1.5 py-1 text-petit text-encre-douce hover:bg-survol disabled:cursor-not-allowed disabled:opacity-40"
              disabled={rang === 0}
              onClick={() => deplacer(cle, -1)}
              type="button"
            >
              ↑
            </button>
            <button
              aria-label={`Descendre ${AXES[cle].bouton}`}
              className="rounded-jeton border border-bord px-1.5 py-1 text-petit text-encre-douce hover:bg-survol disabled:cursor-not-allowed disabled:opacity-40"
              disabled={rang === choisis.length - 1}
              onClick={() => deplacer(cle, 1)}
              type="button"
            >
              ↓
            </button>
          </li>
        ))}
        {restants.map((cle) => (
          <li key={cle}>
            <button
              aria-pressed={false}
              className="flex w-full items-center gap-2 rounded-jeton border border-bord bg-surface px-2 py-1 text-left text-petit text-encre-douce hover:bg-survol"
              onClick={() => basculer(cle)}
              type="button"
            >
              <span aria-hidden="true" className="font-donnees">+</span>
              {AXES[cle].bouton}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-jeton bg-accent px-3 py-1.5 text-petit font-semibold text-surface hover:bg-accent-survol"
          onClick={valider}
          type="button"
        >
          Valider
        </button>
        <button
          className="rounded-jeton border border-bord px-3 py-1.5 text-petit text-encre-douce hover:bg-survol"
          onClick={() => setOuvert(false)}
          type="button"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
