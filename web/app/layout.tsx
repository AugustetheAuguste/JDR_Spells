import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import '@/styles/theme.css'
import { MOTS } from '@/lib/design/tokens'
import { FournisseurFavoris } from '@/lib/favoris/contexte'

export const metadata: Metadata = {
  title: {
    default: 'Sorts Pathfinder 1e — corpus francophone',
    template: '%s — Sorts Pathfinder 1e',
  },
  description:
    'Les sorts de Pathfinder 1re édition en français, consultables par classe et ' +
    'par niveau. Corpus extrait du wiki communautaire pathfinder-fr.org.',
}

/**
 * The application shell.
 *
 * The link back to pathfinder-fr.org lives in the header, not buried in a footer:
 * the corpus is theirs, the site only makes it searchable (B8). It is stated
 * where it cannot be missed, and repeated on every spell page.
 */
export default function RacineLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-jeton focus:bg-accent focus:px-3 focus:py-2 focus:text-surface"
        >
          Aller au contenu
        </a>

        <header className="border-b border-bord bg-surface">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-baseline justify-between gap-3 px-4 py-3">
            <p className="m-0 font-affichage text-titre3 font-semibold">
              Sorts Pathfinder 1e
            </p>
            <nav aria-label="Sections" className="flex gap-3 text-base">
              <Link className="text-encre hover:text-accent" href="/">
                Sorts
              </Link>
              <Link className="text-encre hover:text-accent" href="/comparaison">
                Comparer
              </Link>
              <Link className="text-encre hover:text-accent" href="/favoris">
                Favoris
              </Link>
            </nav>
            <p className="m-0 text-petit text-encre-douce">
              {MOTS.source} —{' '}
              <a
                className="text-accent underline hover:text-accent-survol"
                href="https://www.pathfinder-fr.org/"
                rel="noreferrer"
                target="_blank"
              >
                consulter le wiki
              </a>
            </p>
          </div>
        </header>

        {/* The provider wraps the content, not the shell: it is a client
            component, and hoisting it above the header would drag the whole
            static chrome into the client bundle for nothing. */}
        <main className="mx-auto max-w-[1180px] px-4 py-5" id="contenu">
          <FournisseurFavoris>{children}</FournisseurFavoris>
        </main>

        <footer className="mt-8 border-t border-bord px-4 py-4 text-petit text-encre-douce">
          <p className="m-0 mx-auto max-w-[1180px]">
            Contenu de <strong>pathfinder-fr.org</strong>, wiki communautaire tenu par
            des bénévoles. Ce site n&apos;en est qu&apos;un index de consultation ; les
            pages d&apos;origine font foi.
          </p>
        </footer>
      </body>
    </html>
  )
}
