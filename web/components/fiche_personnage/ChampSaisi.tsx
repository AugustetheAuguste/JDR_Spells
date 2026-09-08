'use client'

import { useId } from 'react'

import { MOTS } from '@/lib/design/tokens'

/**
 * A single numeric input, backing one field of the sheet.
 *
 * The zero trap (Skill `pf-fiche-personnage` § 3, plan 15 notes
 * d'implémentation) lives entirely in `surChangement`: an emptied field calls
 * back with `null`, never `Number('')` (which is `0`). `valeur === null`
 * renders an empty input, never `0`.
 *
 * When `saisieManuelle` is true, a discreet marker sits next to the label
 * with an accessible explanation (`aria-label`) that the value comes from a
 * manual entry rather than the corpus — never colour alone.
 */
export function ChampSaisi({
  libelle,
  valeur,
  surChangement,
  saisieManuelle = false,
}: {
  readonly libelle: string
  readonly valeur: number | null
  readonly surChangement: (valeur: number | null) => void
  readonly saisieManuelle?: boolean
}) {
  const idChamp = useId()

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1 text-petit text-encre-douce" htmlFor={idChamp}>
        {libelle}
        {saisieManuelle && (
          <span aria-label={MOTS.champSaisiManuellementMarqueur} className="text-accent" title={MOTS.champSaisiManuellementMarqueur}>
            *
          </span>
        )}
      </label>
      <input
        className="min-h-cible w-24 border border-bord-fort bg-surface px-2 text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent print:hidden"
        id={idChamp}
        onChange={(evenement) => {
          const texte = evenement.target.value
          if (texte.trim() === '') {
            surChangement(null)
            return
          }
          const nombre = Number(texte)
          surChangement(Number.isNaN(nombre) ? null : nombre)
        }}
        type="number"
        value={valeur === null ? '' : valeur}
      />
      {/* Print alternative: a field is a rendered fact on paper, never a box
          inviting a hand-filled answer (plan 17, notes d'implémentation) — an
          empty value prints as an em dash, not as blank space that reads as
          "fill this in". */}
      <span aria-hidden="true" className="hidden border-b border-encre px-1 font-mono text-encre print:inline">
        {valeur === null ? '—' : valeur}
      </span>
    </div>
  )
}
