'use client'

import Link from 'next/link'
import { useState } from 'react'

import { BasculeTheme } from '@/components/primitives/BasculeTheme'
import { MenuDeroulant } from '@/components/navigation/MenuDeroulant'
import { NavigationMobile } from '@/components/navigation/NavigationMobile'
import { RechercheGlobale } from '@/components/navigation/RechercheGlobale'
import { ARBORESCENCE } from '@/lib/navigation/arborescence'
import { MOTS } from '@/lib/design/tokens'

/**
 * The whole header, client-side because a click-driven dropdown needs it —
 * see `app/layout.tsx` for why the shell around this stays a server
 * component instead of the whole page turning client.
 *
 * "One menu open at a time" (spec) lives here, not inside `MenuDeroulant`:
 * the open group's key is state on this component, passed down, so opening
 * one group's menu is what closes any other's.
 */
export function EnteteSite() {
  const [groupeOuvert, setGroupeOuvert] = useState<string | null>(null)

  return (
    <header className="border-b border-bord bg-surface" data-imprimer-exclure>
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="m-0 font-affichage text-titre3 font-semibold">Sorts Pathfinder 1e</p>

        <nav aria-label={MOTS.navigationPrincipale} className="hidden flex-wrap items-center gap-2 text-corps md:flex">
          {ARBORESCENCE.groupes.map((groupe) => (
            <MenuDeroulant
              groupe={groupe}
              key={groupe.cle}
              ouvert={groupeOuvert === groupe.cle}
              surOuvrirChange={(ouvert) => setGroupeOuvert(ouvert ? groupe.cle : null)}
            />
          ))}
          {ARBORESCENCE.simples.map((entree) => (
            <Link
              className="flex min-h-cible min-w-cible items-center justify-center text-encre hover:text-accent"
              href={{ pathname: entree.href }}
              key={entree.cle}
            >
              {entree.libelle}
            </Link>
          ))}
        </nav>

        <NavigationMobile />

        <div className="flex items-center gap-2">
          {/* Hidden below `md`: the burger panel (`NavigationMobile`) carries
              its own copy in that range, and the desktop-nav breakpoint is
              the right one to switch on — this zone otherwise stays visible
              at every width (compte, theme), which would double the field on
              a narrow viewport instead of relocating it. */}
          <div className="hidden md:block">
            <RechercheGlobale />
          </div>
          <nav aria-label="Compte">
            <Link
              className="flex min-h-cible min-w-cible items-center justify-center text-encre hover:text-accent"
              href="/compte"
            >
              Compte
            </Link>
          </nav>
          <BasculeTheme />
        </div>
      </div>
    </header>
  )
}
