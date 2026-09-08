'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { MOTS } from '@/lib/design/tokens'

/** Au-dessus de cette largeur, la fiche reste visible et défilable derrière
 * le panneau (non modal). En dessous, le panneau couvre tout l'écran (modal)
 * — pseudo-code du plan 16. La même limite que `md:` de Tailwind (768px),
 * pour que la classe CSS et la détection JS de `aria-modal` s'accordent. */
const SEUIL_GRAND_ECRAN = 768

/**
 * The side panel that shows a spell's or a feat's full corpus text without
 * leaving the sheet (plan 16, § Objectifs 3). The one hard requirement, and
 * the reason this component exists rather than a plain link to `/sorts/…` or
 * `/dons/…` : it must never move the sheet's scroll position, on open or on
 * close.
 *
 * `role="dialog"` non-modal above the `md` breakpoint (the sheet stays
 * visible and scrollable behind the panel) and modal below it (a full-screen
 * overlay, `aria-modal="true"`), per the plan's pseudo-code. The keyboard
 * contract (Escape closes, focus returns to the trigger) is the same one
 * `DialogueSuppression.tsx` already established for this codebase — reused,
 * not reinvented.
 *
 * The scroll-preservation mechanism is deliberately NOT "prevent the browser
 * from scrolling" (e.g. `overflow: hidden` on `<body>`, a common modal
 * pattern) : that would itself move content and resize the scrollbar gutter,
 * which is its own kind of jump. Instead the panel is `position: fixed`, so
 * it never participates in document layout, and the one thing that reliably
 * moves scroll under it — a focus change — is called with
 * `{ preventScroll: true }` on every focus set by this component. The
 * `window.scrollY` memo on open and restore on close is a belt-and-suspenders
 * check for a scroll driven from outside this component (e.g. a route
 * change under the panel), not the primary mechanism.
 */
export function PanneauLateral({
  ouvert,
  titre,
  declencheur,
  urlSource,
  onFermer,
  children,
}: {
  readonly ouvert: boolean
  readonly titre: string
  readonly declencheur: HTMLElement | null
  readonly urlSource: string | null
  readonly onFermer: () => void
  readonly children: ReactNode
}) {
  const refPanneau = useRef<HTMLDivElement>(null)
  const refFermer = useRef<HTMLButtonElement>(null)
  const scrollMemorise = useRef<number | null>(null)
  // Valeur initiale lue directement (jamais recalculée par un `setState`
  // synchrone dans un effet, que `react-hooks/set-state-in-effect` refuse) :
  // `matchMedia` est absent de jsdom (les tests), d'où le défaut « grand
  // écran », qui ne change rien au critère testé ici (le défilement) ni à
  // aucune assertion d'accessibilité du panneau.
  const [grandEcran, setGrandEcran] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(`(min-width: ${SEUIL_GRAND_ECRAN}px)`).matches
      : true,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(`(min-width: ${SEUIL_GRAND_ECRAN}px)`)
    function surChangement(evenement: MediaQueryListEvent) {
      setGrandEcran(evenement.matches)
    }
    media.addEventListener('change', surChangement)
    return () => media.removeEventListener('change', surChangement)
  }, [])

  useEffect(() => {
    if (!ouvert) return

    // Mémorise la position de défilement de la fiche à l'ouverture, cf.
    // docstring du module — cette valeur sert de garde-fou à la fermeture.
    scrollMemorise.current = window.scrollY
    refFermer.current?.focus({ preventScroll: true })

    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') {
        evenement.preventDefault()
        onFermer()
        return
      }
      if (evenement.key !== 'Tab') return
      const panneau = refPanneau.current
      if (panneau === null) return
      const focusables = panneau.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const premier = focusables[0]!
      const dernier = focusables[focusables.length - 1]!
      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault()
        dernier.focus({ preventScroll: true })
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault()
        premier.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [ouvert, onFermer])

  const etaitOuvert = useRef(ouvert)
  useEffect(() => {
    if (etaitOuvert.current && !ouvert) {
      // À la fermeture, rendre le focus au déclencheur sans laisser le
      // navigateur faire défiler la fiche jusqu'à lui, puis restaurer la
      // position mémorisée à l'ouverture au cas où quelque chose d'externe
      // aurait bougé le défilement pendant que le panneau était ouvert.
      declencheur?.focus({ preventScroll: true })
      if (scrollMemorise.current !== null) {
        window.scrollTo({ top: scrollMemorise.current, left: window.scrollX })
      }
    }
    etaitOuvert.current = ouvert
  }, [ouvert, declencheur])

  if (!ouvert) return null

  return (
    <div
      className={
        grandEcran
          ? 'fixed inset-y-0 right-0 z-30 flex justify-end'
          : 'fixed inset-0 z-30 flex justify-end bg-encre/40'
      }
      // Sans fond opaque en grand écran : la fiche reste visible et
      // défilable derrière le panneau, ce qui EST la définition de non
      // modal ici — un clic hors panneau ne le ferme pas non plus, pour
      // rester cohérent avec « non modal ».
      onClick={grandEcran ? undefined : onFermer}
    >
      <div
        aria-label={titre}
        aria-modal={grandEcran ? 'false' : 'true'}
        className="h-full w-full max-w-full overflow-y-auto border-l border-bord bg-surface p-4 md:w-[42ch]"
        onClick={(evenement) => evenement.stopPropagation()}
        ref={refPanneau}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="m-0 font-affichage text-titre3 font-semibold text-encre">{titre}</h2>
          <button
            className="min-h-cible min-w-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onFermer}
            ref={refFermer}
            type="button"
          >
            {MOTS.panneauFermer}
          </button>
        </div>

        <div className="mt-3">{children}</div>

        {urlSource !== null && (
          <p className="mt-4 text-petit">
            <a className="text-accent underline hover:text-accent-survol" href={urlSource} rel="noreferrer" target="_blank">
              {MOTS.voirSurLeWiki}
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
