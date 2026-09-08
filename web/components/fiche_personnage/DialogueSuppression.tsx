'use client'

import { useEffect, useRef } from 'react'

import { MOTS } from '@/lib/design/tokens'

/**
 * The delete-confirmation dialog: `role="dialog"`, `aria-modal`, a trapped
 * Tab cycle, Escape cancels, and focus returned to whatever triggered it on
 * close — the same keyboard contract `MenuDeroulant.tsx` (étape 03)
 * established for the header's menus, reused here rather than reinvented.
 *
 * `declencheur` is the element the caller focused before opening (typically
 * `event.currentTarget` off the delete button that opened this dialog); it is
 * read only when `ouvert` flips back to `false`, so a caller that forgets to
 * update it before closing does not fight this effect.
 *
 * Confirmation alone is never enough (spec, notes d'implémentation): the
 * caller that renders `onConfirmer` is also the one that shows the
 * restoration offer afterwards — this component only asks and reports the
 * choice, it does not delete anything itself.
 */
export function DialogueSuppression({
  nomFiche,
  ouvert,
  declencheur,
  onAnnuler,
  onConfirmer,
}: {
  readonly nomFiche: string
  readonly ouvert: boolean
  readonly declencheur: HTMLElement | null
  readonly onAnnuler: () => void
  readonly onConfirmer: () => void
}) {
  const refBoite = useRef<HTMLDivElement>(null)
  const refAnnuler = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!ouvert) return
    // The safer default: focus starts on "Annuler", not the destructive
    // action, so an errant Enter never confirms a delete.
    refAnnuler.current?.focus()

    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') {
        evenement.preventDefault()
        onAnnuler()
        return
      }
      if (evenement.key !== 'Tab') return
      const boite = refBoite.current
      if (boite === null) return
      const focusables = boite.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const premier = focusables[0]!
      const dernier = focusables[focusables.length - 1]!
      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault()
        dernier.focus()
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault()
        premier.focus()
      }
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [ouvert, onAnnuler])

  // Runs only on the close transition — giving focus back to the trigger is
  // the dialog's job on the way out, not on the way in.
  const etaitOuvert = useRef(ouvert)
  useEffect(() => {
    if (etaitOuvert.current && !ouvert) {
      declencheur?.focus()
    }
    etaitOuvert.current = ouvert
  }, [ouvert, declencheur])

  if (!ouvert) return null

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-encre/40" data-imprimer-exclure>
      <div
        aria-labelledby="dialogue-suppression-titre"
        aria-modal="true"
        className="max-w-[40ch] border border-bord bg-surface p-4"
        ref={refBoite}
        role="dialog"
      >
        <h2 className="font-affichage text-titre3 text-encre" id="dialogue-suppression-titre">
          {MOTS.ficheConfirmerSuppressionTitre}
        </h2>
        <p className="mt-2 text-corps text-encre-douce">
          {MOTS.ficheConfirmerSuppressionTexte} « {nomFiche} ».
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="min-h-cible min-w-cible px-3 text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onAnnuler}
            ref={refAnnuler}
            type="button"
          >
            {MOTS.ficheAnnulerBouton}
          </button>
          <button
            className="min-h-cible min-w-cible bg-accent px-3 text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onConfirmer}
            type="button"
          >
            {MOTS.ficheConfirmerSuppressionBouton}
          </button>
        </div>
      </div>
    </div>
  )
}
