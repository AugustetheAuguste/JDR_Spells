'use client'

import { exporter } from '@/lib/fiche_personnage/echange'
import { MOTS } from '@/lib/design/tokens'
import type { Fiche } from '@/lib/fiche_personnage/schema'

/**
 * The only place, in the whole sheet feature, that touches the DOM to export
 * a file — `echange.exporter` stays pure (Skill `pf-fiche-personnage` § 7),
 * this component is what turns its `{ nom, contenu }` into an actual
 * download, via a throwaway `Blob` and anchor.
 */
export function BoutonExport({ fiche }: { readonly fiche: Fiche }) {
  function surClic() {
    const { nom, contenu } = exporter(fiche)
    const blob = new Blob([contenu], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = nom
    document.body.appendChild(lien)
    lien.click()
    document.body.removeChild(lien)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      className="min-h-cible min-w-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      data-imprimer-exclure
      onClick={surClic}
      type="button"
    >
      {MOTS.ficheActionExporter}
    </button>
  )
}
