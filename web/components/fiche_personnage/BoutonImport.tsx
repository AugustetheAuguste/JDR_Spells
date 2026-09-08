'use client'

import { useRef, useState } from 'react'

import { useFiches } from '@/lib/fiche_personnage/contexte-fiches'
import { MOTS } from '@/lib/design/tokens'

/**
 * Reads a chosen file as text and hands it to `useFiches().importer` — the
 * context wraps `echange.importer` with the real `localStorage`, so this
 * component never touches the store directly (spec, `web/components` note).
 *
 * A refusal shows every motive returned, not just the first — an import that
 * rejected a file for two reasons and only printed one would leave a reader
 * guessing at the other. An overwrite is reported too, with the rescue-copy
 * mention, since `echange.importer` never overwrites silently.
 */
export function BoutonImport() {
  const { importer } = useFiches()
  const [refus, setRefus] = useState<readonly string[] | null>(null)
  const [ecrase, setEcrase] = useState(false)
  const refEntree = useRef<HTMLInputElement>(null)

  async function surChangement(evenement: React.ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0]
    evenement.target.value = ''
    if (fichier === undefined) return
    const texte = await fichier.text()
    const resultat = await importer(texte)
    if (!resultat.ok) {
      setRefus(resultat.motifs)
      setEcrase(false)
      return
    }
    setRefus(null)
    setEcrase(resultat.ecrase)
  }

  return (
    <div>
      <button
        className="min-h-cible min-w-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={() => refEntree.current?.click()}
        type="button"
      >
        {MOTS.ficheActionImporter}
      </button>
      <input
        accept="application/json"
        aria-hidden="true"
        className="sr-only"
        onChange={(evenement) => {
          void surChangement(evenement)
        }}
        ref={refEntree}
        tabIndex={-1}
        type="file"
      />

      {refus !== null && (
        <div className="mt-2 border border-bord p-2" role="alert">
          <p className="text-petit font-medium text-encre">{MOTS.ficheImportRefusTitre}</p>
          <ul className="mt-1 list-disc pl-4 text-petit text-encre-douce">
            {refus.map((motif) => (
              <li key={motif}>{motif}</li>
            ))}
          </ul>
        </div>
      )}

      {ecrase && (
        <p className="mt-2 text-petit text-encre-douce" role="status">
          {MOTS.ficheImportEcraseTexte}
        </p>
      )}
    </div>
  )
}
