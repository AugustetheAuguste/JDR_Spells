'use client'

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'

import { DENSITE } from '@/lib/design/tokens'

/**
 * The mobile filter drawer, sous 1024 px, décision humaine du 2026-09-01
 * (audit défaut #5).
 *
 * One `PanneauFiltres` instance, not two. From 1024 px the wrapper is the plain
 * sidebar column it always was — `lg:flex`, `lg:static` — and `ouvert` never
 * matters there because the trigger button that sets it is itself `lg:hidden`.
 * Below 1024 px it is either absent (`hidden`, which also removes it from the
 * accessibility tree — no separate `aria-hidden` needed) or a full-screen
 * dialog.
 *
 * No focus trap : the brief asks for none, un piège au clavier empêcherait le
 * focus de sortir. Escape closes it and returns focus to the button that
 * opened it — the one thing a modal dialog does need.
 */
export function TiroirFiltres({
  ouvert,
  fermer,
  boutonRef,
  children,
  id = 'tiroir-filtres',
}: {
  readonly ouvert: boolean
  readonly fermer: () => void
  /** The trigger button, so focus returns to it on close. */
  readonly boutonRef: RefObject<HTMLButtonElement | null>
  readonly children: ReactNode
  /** Matched by the trigger button's `aria-controls`. */
  readonly id?: string
}) {
  const conteneurRef = useRef<HTMLDivElement>(null)
  const titreId = useId()
  const etaitOuvert = useRef(ouvert)

  useEffect(() => {
    if (!ouvert) return
    const premierControle = conteneurRef.current?.querySelector<HTMLElement>(
      'select, input, button, a[href]',
    )
    premierControle?.focus()

    function surTouche(evenement: KeyboardEvent): void {
      if (evenement.key !== 'Escape') return
      evenement.preventDefault()
      fermer()
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [ouvert, fermer])

  useEffect(() => {
    // Only on the true -> false transition: running this on mount would steal
    // focus from wherever the page put it before the reader has done anything.
    if (etaitOuvert.current && !ouvert) boutonRef.current?.focus()
    etaitOuvert.current = ouvert
  }, [ouvert, boutonRef])

  return (
    <aside
      aria-labelledby={ouvert ? titreId : undefined}
      aria-modal={ouvert ? true : undefined}
      id={id}
      className={[
        ouvert
          ? 'fixed inset-0 z-40 flex flex-col overflow-y-auto bg-base px-4 py-4'
          : 'hidden',
        'lg:static lg:z-auto lg:flex lg:flex-col lg:gap-4 lg:overflow-visible lg:bg-transparent lg:px-0 lg:py-0',
      ].join(' ')}
      ref={conteneurRef}
      role={ouvert ? 'dialog' : undefined}
    >
      {ouvert ? (
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <p className="m-0 font-affichage text-titre3 font-semibold" id={titreId}>
            Filtrer
          </p>
          <button
            className="border border-bord-fort bg-surface px-3 text-corps text-encre hover:bg-survol"
            onClick={fermer}
            style={{ minHeight: DENSITE.cible }}
            type="button"
          >
            Fermer
          </button>
        </div>
      ) : null}
      {children}
    </aside>
  )
}
