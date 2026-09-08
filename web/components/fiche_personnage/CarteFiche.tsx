'use client'

import type { Route } from 'next'
import Link from 'next/link'

import { MOTS } from '@/lib/design/tokens'
import type { Fiche } from '@/lib/fiche_personnage/schema'

import { BoutonExport } from './BoutonExport'

/**
 * One sheet card in the index grid: name, race, one line per class with its
 * level, and the four actions (open, duplicate, export, delete).
 *
 * A missing field renders as an em dash, never a zero or an empty string
 * (Skill `pf-fiche-personnage` § 3) — a level of `0` (a real value, cf.
 * CLAUDE.md § 11) prints as `0`, only `null` prints as the dash.
 *
 * The route `/personnages/fiche/` does not exist yet (étape 15). `typedRoutes`
 * (`next.config.ts`) rejects an untyped literal at `next build` time, so the
 * href is asserted into `Route` here — the same cast `RechercheGlobale.tsx`
 * already uses for the same reason.
 */
export function CarteFiche({
  fiche,
  onDupliquer,
  onSupprimerDemande,
}: {
  readonly fiche: Fiche
  readonly onDupliquer: (id: string) => void
  readonly onSupprimerDemande: (fiche: Fiche, evenement: React.MouseEvent<HTMLElement>) => void
}) {
  const nom = fiche.meta.nomPersonnage.trim() === '' ? MOTS.ficheSansNom : fiche.meta.nomPersonnage
  const href = `/personnages/fiche/?id=${encodeURIComponent(fiche.id)}` as Route

  return (
    <li className="border border-bord bg-surface p-3">
      <Link
        className="font-affichage text-titre3 text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        href={href}
      >
        {nom}
      </Link>

      <p className="mt-1 text-petit text-encre-douce">{fiche.identite.race?.nom ?? '—'}</p>

      <ul className="mt-1 text-petit text-encre-douce">
        {fiche.identite.classes.length === 0 ? (
          <li>—</li>
        ) : (
          fiche.identite.classes.map((classeFiche, indice) => (
            <li key={`${classeFiche.nom}-${indice}`}>
              {classeFiche.nom} {classeFiche.niveau === null ? '—' : classeFiche.niveau}
            </li>
          ))
        )}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2" data-imprimer-exclure>
        <button
          className="min-h-cible min-w-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => onDupliquer(fiche.id)}
          type="button"
        >
          {MOTS.ficheActionDupliquer}
        </button>
        <BoutonExport fiche={fiche} />
        <button
          className="min-h-cible min-w-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={(evenement) => onSupprimerDemande(fiche, evenement)}
          type="button"
        >
          {MOTS.ficheActionSupprimer}
        </button>
      </div>
    </li>
  )
}
