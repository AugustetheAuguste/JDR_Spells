'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import { RechercheGlobale } from '@/components/navigation/RechercheGlobale'
import { ARBORESCENCE } from '@/lib/navigation/arborescence'
import { MOTS } from '@/lib/design/tokens'

/**
 * Burger menu with accordions, for narrow viewports.
 *
 * Reads the same `ARBORESCENCE` the desktop dropdowns read — see that
 * module's docstring for why there is exactly one tree.
 *
 * The bureau/mobile split is Tailwind width classes only (`hidden md:flex` on
 * the sibling nav, `md:hidden` here), never a JS viewport measurement: a
 * static export has to render something correct before hydration runs, and a
 * `window.innerWidth` check has no answer at that point.
 */
export function NavigationMobile() {
  const [ouvert, setOuvert] = useState(false)
  const [accordeonOuvert, setAccordeonOuvert] = useState<string | null>(null)
  const refBouton = useRef<HTMLButtonElement>(null)
  const idPanneau = useId()
  const pathname = usePathname()

  const refDernierChemin = useRef(pathname)
  useEffect(() => {
    if (refDernierChemin.current === pathname) return
    refDernierChemin.current = pathname
    setOuvert(false)
    setAccordeonOuvert(null)
  }, [pathname])

  useEffect(() => {
    if (!ouvert) return
    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') {
        setOuvert(false)
        refBouton.current?.focus()
      }
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [ouvert])

  return (
    <div className="md:hidden">
      <button
        aria-controls={idPanneau}
        aria-expanded={ouvert}
        aria-label={ouvert ? MOTS.fermerLeMenu : MOTS.ouvrirLeMenu}
        className="flex min-h-cible min-w-cible items-center justify-center border border-bord-fort text-encre hover:text-accent"
        onClick={() => setOuvert((v) => !v)}
        ref={refBouton}
        type="button"
      >
        <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {ouvert ? (
            <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeWidth={2} />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeWidth={2} />
          )}
        </svg>
      </button>

      {ouvert && (
        <nav aria-label={MOTS.navigationPrincipale} className="border-t border-bord bg-surface" id={idPanneau}>
          <div className="px-3 py-2">
            <RechercheGlobale />
          </div>
          <ul className="flex flex-col">
            {ARBORESCENCE.groupes.map((groupe) => {
              const idContenu = `${idPanneau}-${groupe.cle}`
              const groupeOuvert = accordeonOuvert === groupe.cle
              return (
                <li key={groupe.cle}>
                  <button
                    aria-controls={idContenu}
                    aria-expanded={groupeOuvert}
                    className="flex min-h-cible w-full items-center justify-between px-3 text-left text-corps text-encre hover:text-accent"
                    onClick={() => setAccordeonOuvert(groupeOuvert ? null : groupe.cle)}
                    type="button"
                  >
                    {groupe.libelle}
                  </button>
                  {groupeOuvert && (
                    <ul id={idContenu}>
                      {groupe.entrees.map((entree) => (
                        <li key={entree.cle}>
                          <Link
                            className="flex min-h-cible items-center px-6 text-corps text-encre hover:text-accent"
                            href={{ pathname: entree.href }}
                          >
                            {entree.libelle}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
            {ARBORESCENCE.simples.map((entree) => (
              <li key={entree.cle}>
                <Link
                  className="flex min-h-cible items-center px-3 text-corps text-encre hover:text-accent"
                  href={{ pathname: entree.href }}
                >
                  {entree.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
