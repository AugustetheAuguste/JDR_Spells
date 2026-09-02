import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import '@/styles/theme.css'
import { Fournisseurs } from '@/components/Fournisseurs'
import { BasculeTheme } from '@/components/primitives/BasculeTheme'

/**
 * Read before paint, so the reader who chose night mode never sees a flash of
 * the day palette. This is the one piece of unavoidable inline script a static
 * export can carry without becoming a server dependency — it reads
 * `localStorage`, nothing else, and `output: 'export'` still holds because
 * nothing here runs at request time.
 */
const SCRIPT_THEME = `(function(){try{var t=localStorage.getItem('pf-theme');if(t==='nuit'){document.documentElement.dataset.theme='nuit';}}catch(e){}})();`

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body>
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:flex focus:min-h-cible focus:items-center focus:rounded-jeton focus:border focus:border-accent focus:bg-accent-voile focus:px-3 focus:text-accent"
        >
          Aller au contenu
        </a>

        <header className="border-b border-bord bg-surface">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="m-0 font-affichage text-titre3 font-semibold">
              Sorts Pathfinder 1e
            </p>
            <nav
              aria-label="Sections"
              className="flex flex-wrap items-center gap-2 text-corps"
            >
              <Link
                className="flex min-h-cible min-w-cible items-center justify-center text-encre hover:text-accent"
                href="/"
              >
                Sorts
              </Link>
              <Link
                className="flex min-h-cible min-w-cible items-center justify-center text-encre hover:text-accent"
                href="/explorer"
              >
                Explorer
              </Link>
              <Link
                className="flex min-h-cible min-w-cible items-center justify-center text-encre hover:text-accent"
                href="/comparaison"
              >
                Comparer
              </Link>
              <Link
                className="flex min-h-cible min-w-cible items-center justify-center text-encre hover:text-accent"
                href="/favoris"
              >
                Favoris
              </Link>
              <Link
                className="flex min-h-cible min-w-cible items-center justify-center text-encre hover:text-accent"
                href="/compte"
              >
                Compte
              </Link>
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              {/* Charte typographique vs. libellé figé du Skill : `MOTS.source`
                  porte « source : pathfinder-fr.org », deux-points inclus. La
                  charte l'interdit en prose ; on écrit ici le libellé sans
                  éditer `MOTS` (hors périmètre, tokens.ts appartient à 04).
                  Divergence signalée dans les constats pour l'étape 16. */}
              <p className="m-0 flex min-h-cible items-center text-petit text-encre-douce">
                Source pathfinder-fr.org,{' '}
                <a
                  className="ml-1 inline-flex min-h-cible items-center text-accent underline hover:text-accent-survol"
                  href="https://www.pathfinder-fr.org/"
                  rel="noreferrer"
                  target="_blank"
                >
                  consulter le wiki
                </a>
              </p>
              <div className="flex min-h-cible min-w-cible items-center justify-center">
                <BasculeTheme />
              </div>
            </div>
          </div>
        </header>

        {/* The providers wrap the content, not the shell: they are client
            components, and hoisting them above the header would drag the whole
            static chrome into the client bundle for nothing. The composition and
            its order live in `Fournisseurs`, where a test can reach them — see the
            comment there: assembling them here is how synchronisation shipped
            without ever being mounted. */}
        <main className="mx-auto max-w-[1180px] px-4 py-5" id="contenu">
          <Fournisseurs>{children}</Fournisseurs>
        </main>

        <footer className="mt-8 flex flex-wrap items-center gap-2 border-t border-bord px-4 py-4 text-petit text-encre-douce">
          <p className="m-0 mx-auto flex min-h-cible max-w-[1180px] items-center">
            Les sorts viennent de{' '}
            <a
              className="ml-1 inline-flex min-h-cible items-center text-accent underline hover:text-accent-survol"
              href="https://www.pathfinder-fr.org/"
              rel="noreferrer"
              target="_blank"
            >
              pathfinder-fr.org
            </a>
            .
          </p>
        </footer>
      </body>
    </html>
  )
}
