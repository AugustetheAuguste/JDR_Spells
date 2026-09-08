'use client'

import { useId, useState, type ReactNode } from 'react'

import { MOTS } from '@/lib/design/tokens'
import { useImprimeEnCours } from '@/lib/fiche_personnage/etatImpression'

/** One `localStorage` key per sheet, mirroring `web/lib/fiche_personnage/magasin.ts`'s
 * per-sheet key discipline: folding one sheet's sections must never touch
 * another sheet's bytes. Deliberately outside the sheet schema itself (§ plan
 * 15, "jamais dans l'URL") — fold state is not a fact of the character, it is
 * a fact of how this reader last looked at this sheet on this device. */
function clePliage(ficheId: string): string {
  return `pf-fiche-pliage:${ficheId}`
}

function lireEtatPliage(ficheId: string): Readonly<Record<string, boolean>> {
  if (typeof window === 'undefined') return {}
  try {
    const brut = window.localStorage.getItem(clePliage(ficheId))
    if (brut === null) return {}
    const analyse = JSON.parse(brut)
    if (typeof analyse !== 'object' || analyse === null) return {}
    return analyse as Record<string, boolean>
  } catch {
    return {}
  }
}

function ecrireEtatPliage(ficheId: string, etat: Readonly<Record<string, boolean>>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(clePliage(ficheId), JSON.stringify(etat))
  } catch {
    // Le pliage est un confort d'affichage, pas une donnée de jeu : un
    // stockage plein ou indisponible ne doit jamais faire échouer le rendu.
  }
}

/**
 * One collapsible domain of the sheet (identity, characteristics, combat…).
 *
 * Fold state is remembered per sheet, in `localStorage`, never in the URL —
 * it is not a shareable filter (Skill `pf-fiche-personnage`, plan 15 § 3).
 */
export function Section({
  ficheId,
  cle,
  titre,
  deplieParDefaut = false,
  children,
}: {
  readonly ficheId: string
  readonly cle: string
  readonly titre: string
  readonly deplieParDefaut?: boolean
  readonly children: ReactNode
}) {
  const idContenu = useId()
  const [deplie, setDeplie] = useState<boolean>(() => {
    const etat = lireEtatPliage(ficheId)
    return cle in etat ? (etat[cle] ?? deplieParDefaut) : deplieParDefaut
  })
  // Print forces every section open without touching the reader's own fold
  // state (`deplie`, unmodified) — see `etatImpression.ts`'s doc comment for
  // why this makes an explicit afterprint restore unnecessary.
  const impression = useImprimeEnCours()
  const effectivementDeplie = deplie || impression

  function basculer(): void {
    const prochain = !deplie
    setDeplie(prochain)
    const etat = lireEtatPliage(ficheId)
    ecrireEtatPliage(ficheId, { ...etat, [cle]: prochain })
  }

  return (
    <section className="border border-bord bg-surface print:break-inside-avoid" data-section-impression>
      <h2 className="m-0">
        <button
          aria-controls={idContenu}
          aria-expanded={effectivementDeplie}
          aria-label={effectivementDeplie ? `${MOTS.sectionReplier} ${titre}` : `${MOTS.sectionDeplier} ${titre}`}
          className="flex min-h-cible w-full items-center justify-between px-3 py-2 text-left font-affichage text-titre3 text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent print:pointer-events-none"
          id={`section-${cle}`}
          onClick={basculer}
          type="button"
        >
          {titre}
          <span aria-hidden="true" className="print:hidden">{effectivementDeplie ? '▾' : '▸'}</span>
        </button>
      </h2>
      {effectivementDeplie && <div className="px-3 py-3" id={idContenu}>{children}</div>}
    </section>
  )
}
