'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import type { GroupeNav } from '@/lib/navigation/arborescence'

/**
 * One desktop dropdown menu for a single `GroupeNav`.
 *
 * Opens on click only, never on hover — an explicit decision (spec §3): a
 * hover-opened menu is unreachable by touch and steals focus from a pointer
 * user who was only passing over the header on the way to something else.
 *
 * `ouvert`/`surOuvrirChange` are controlled from the parent (`EnteteSite`) so
 * that opening one group's menu can close any other's — "one menu open at a
 * time" has to live above any single instance of this component to be true
 * of the two of them together.
 */
export function MenuDeroulant({
  groupe,
  ouvert,
  surOuvrirChange,
}: {
  readonly groupe: GroupeNav
  readonly ouvert: boolean
  readonly surOuvrirChange: (ouvert: boolean) => void
}) {
  const [index, setIndex] = useState<number>(-1)
  const refBouton = useRef<HTMLButtonElement>(null)
  const refListe = useRef<HTMLUListElement>(null)
  const refRacine = useRef<HTMLDivElement>(null)
  const idListe = useId()
  const pathname = usePathname()

  // A route change closes any open menu — following a link is the moment the
  // menu's job is done, and leaving it open would float a stale panel over
  // whatever page just loaded. Guarded by a ref (not just the `[pathname]`
  // dependency) so the first render — where there is no previous pathname to
  // have changed from — never calls setState at all.
  const refDernierChemin = useRef(pathname)
  useEffect(() => {
    if (refDernierChemin.current === pathname) return
    refDernierChemin.current = pathname
    surOuvrirChange(false)
    setIndex(-1)
    // `surOuvrirChange` is stable identity-wise across renders in practice,
    // but including it would refire on every parent render regardless of
    // route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Outside click closes the menu without requiring the pointer to land on a
  // specific dismiss control.
  useEffect(() => {
    if (!ouvert) return
    function surClicExterieur(evenement: MouseEvent) {
      if (!refRacine.current) return
      if (!refRacine.current.contains(evenement.target as Node)) {
        surOuvrirChange(false)
        setIndex(-1)
      }
    }
    document.addEventListener('mousedown', surClicExterieur)
    return () => document.removeEventListener('mousedown', surClicExterieur)
  }, [ouvert, surOuvrirChange])

  // Once an item is highlighted by keyboard, keep DOM focus in sync with it —
  // this is what makes arrow navigation move the visible focus outline rather
  // than just an internal counter.
  useEffect(() => {
    if (!ouvert || index < 0) return
    const item = refListe.current?.querySelectorAll('[role="menuitem"]')[index] as
      | HTMLElement
      | undefined
    item?.focus()
  }, [ouvert, index])

  function ouvrirEtPlacer(dernierIndex: boolean) {
    surOuvrirChange(true)
    setIndex(dernierIndex ? groupe.entrees.length - 1 : 0)
  }

  function surToucheBouton(evenement: React.KeyboardEvent<HTMLButtonElement>) {
    if (evenement.key === 'ArrowDown' || evenement.key === 'Enter' || evenement.key === ' ') {
      evenement.preventDefault()
      ouvrirEtPlacer(false)
    } else if (evenement.key === 'ArrowUp') {
      evenement.preventDefault()
      ouvrirEtPlacer(true)
    }
  }

  function surToucheListe(evenement: React.KeyboardEvent<HTMLUListElement>) {
    const dernier = groupe.entrees.length - 1
    switch (evenement.key) {
      case 'ArrowDown':
        evenement.preventDefault()
        setIndex((i) => (i >= dernier ? 0 : i + 1))
        break
      case 'ArrowUp':
        evenement.preventDefault()
        setIndex((i) => (i <= 0 ? dernier : i - 1))
        break
      case 'Home':
        evenement.preventDefault()
        setIndex(0)
        break
      case 'End':
        evenement.preventDefault()
        setIndex(dernier)
        break
      case 'Escape':
        evenement.preventDefault()
        surOuvrirChange(false)
        setIndex(-1)
        refBouton.current?.focus()
        break
      // Tab is left alone on purpose: no `preventDefault`, so focus moves on
      // naturally to whatever is next and the menu just closes behind it.
      case 'Tab':
        surOuvrirChange(false)
        setIndex(-1)
        break
      default:
        break
    }
  }

  return (
    <div className="relative" ref={refRacine}>
      <button
        aria-controls={idListe}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        className="flex min-h-cible items-center justify-center px-2 text-corps text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={() => {
          if (ouvert) {
            surOuvrirChange(false)
            setIndex(-1)
          } else {
            surOuvrirChange(true)
          }
        }}
        onKeyDown={surToucheBouton}
        ref={refBouton}
        type="button"
      >
        {groupe.libelle}
      </button>

      {ouvert && (
        <ul
          aria-label={groupe.libelle}
          className="absolute left-0 top-full z-10 min-w-[10rem] border border-bord bg-surface py-1 text-corps"
          id={idListe}
          onKeyDown={surToucheListe}
          ref={refListe}
          role="menu"
        >
          {groupe.entrees.map((entree, i) => (
            <li key={entree.cle} role="none">
              <Link
                className="block min-h-cible px-3 py-1 text-encre hover:bg-accent-voile hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                href={{ pathname: entree.href }}
                onFocus={() => setIndex(i)}
                role="menuitem"
                tabIndex={-1}
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
