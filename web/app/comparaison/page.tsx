import { Suspense } from 'react'

import { VueComparaison } from '@/components/comparaison/VueComparaison'

/**
 * The class comparison route.
 *
 * Same shape as the browse route, and for the same reason: `useSearchParams`
 * needs a Suspense boundary under `output: 'export'`, since the shell is
 * prerendered at build time while the query string only exists in the browser.
 */
export const metadata = {
  title: 'Comparer des classes',
  description:
    'Ce que deux ou trois classes de Pathfinder 1e partagent, ce qui leur est propre, et à combien de niveaux d’écart elles accèdent aux mêmes sorts.',
}

export default function PageComparaison() {
  return (
    <Suspense
      fallback={
        <section>
          <h1 className="m-0 font-affichage text-titre1 font-semibold">
            Comparer des classes
          </h1>
          <p className="mt-3 text-grand text-encre-douce">Chargement…</p>
        </section>
      }
    >
      <VueComparaison />
    </Suspense>
  )
}
