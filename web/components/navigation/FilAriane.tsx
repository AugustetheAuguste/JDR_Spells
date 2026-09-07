'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import type { EntreeNav } from '@/lib/navigation/arborescence'
import { MOTS } from '@/lib/design/tokens'

/** A plain segment, or a segment that can switch to a sibling via a
 * dropdown — the last segment on a character-sheet page (the sheet's own
 * name), so a reader can jump to another sheet without going back through
 * the index. */
export type SegmentAriane =
  | { readonly libelle: string; readonly href: string; readonly choix?: undefined }
  | { readonly libelle: string; readonly href: string; readonly choix: readonly EntreeNav[] }

/**
 * The breadcrumb for character-sheet pages.
 *
 * Not mounted in the layout (CLAUDE.md-adjacent note in the spec): only the
 * sheet pages know the current sheet's name, so they mount this themselves,
 * one level below the header. The last segment always carries
 * `aria-current="page"`.
 *
 * A segment with `choix` renders as a click-driven dropdown, reusing the same
 * keyboard pattern `MenuDeroulant` established at étape 03 (open on click or
 * Enter/Space/ArrowDown, close on Escape or outside click) rather than a
 * native `<select>` — a native select's keyboard behaviour differs from every
 * other menu in the header, and this is a UI decision, not a form control.
 */
export function FilAriane({ segments }: { readonly segments: readonly SegmentAriane[] }) {
  return (
    <nav aria-label={MOTS.ariane} className="text-petit text-encre-douce">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
        {segments.map((segment, i) => {
          const dernier = i === segments.length - 1
          return (
            <li className="flex items-center gap-1" key={segment.href}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {segment.choix !== undefined ? (
                <SegmentSelecteur dernier={dernier} segment={segment} />
              ) : dernier ? (
                <span aria-current="page" className="text-encre">
                  {segment.libelle}
                </span>
              ) : (
                <Link className="text-encre-douce underline hover:text-accent" href={{ pathname: segment.href }}>
                  {segment.libelle}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** The selector segment: a button showing the current label, a listbox of
 * siblings on click. Mirrors `MenuDeroulant`'s open/close/keyboard contract
 * rather than re-deriving it, so the header and the breadcrumb behave
 * identically to a keyboard user. */
function SegmentSelecteur({
  segment,
  dernier,
}: {
  readonly segment: { readonly libelle: string; readonly href: string; readonly choix: readonly EntreeNav[] }
  readonly dernier: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const refRacine = useRef<HTMLDivElement>(null)
  const refBouton = useRef<HTMLButtonElement>(null)
  const idListe = useId()

  useEffect(() => {
    if (!ouvert) return
    function surClicExterieur(evenement: MouseEvent) {
      if (!refRacine.current) return
      if (!refRacine.current.contains(evenement.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', surClicExterieur)
    return () => document.removeEventListener('mousedown', surClicExterieur)
  }, [ouvert])

  function surToucheBouton(evenement: React.KeyboardEvent<HTMLButtonElement>) {
    if (evenement.key === 'ArrowDown' || evenement.key === 'Enter' || evenement.key === ' ') {
      evenement.preventDefault()
      setOuvert(true)
    } else if (evenement.key === 'Escape' && ouvert) {
      evenement.preventDefault()
      setOuvert(false)
    }
  }

  return (
    <div className="relative inline-block" ref={refRacine}>
      <button
        aria-controls={idListe}
        aria-current={dernier ? 'page' : undefined}
        aria-expanded={ouvert}
        aria-haspopup="listbox"
        className="inline-flex min-h-cible items-center gap-1 px-1 text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={() => setOuvert((v) => !v)}
        onKeyDown={surToucheBouton}
        ref={refBouton}
        type="button"
      >
        {segment.libelle}
        <span aria-hidden="true">▾</span>
      </button>

      {ouvert && (
        <ul
          className="absolute left-0 top-full z-10 min-w-[10rem] border border-bord bg-surface py-1 text-corps"
          id={idListe}
          onKeyDown={(evenement) => {
            if (evenement.key === 'Escape') {
              evenement.preventDefault()
              setOuvert(false)
              refBouton.current?.focus()
            }
          }}
          role="listbox"
        >
          {segment.choix.map((entree) => (
            <li key={entree.cle} role="option" aria-selected={entree.href === segment.href}>
              <Link
                className="block min-h-cible px-3 py-1 text-encre hover:bg-accent-voile hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                href={{ pathname: entree.href }}
                onClick={() => setOuvert(false)}
              >
                {entree.libelle}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

