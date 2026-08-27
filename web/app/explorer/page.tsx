import type { Metadata } from 'next'
import { Suspense } from 'react'

import { VueExploration } from '@/components/exploration/VueExploration'

export const metadata: Metadata = {
  title: 'Explorer',
  description:
    'Choisir une classe, puis resserrer graphique après graphique — niveau, famille ' +
    'd’effet, école — jusqu’au sort cherché. Corpus extrait de pathfinder-fr.org.',
}

/**
 * The exploration route.
 *
 * A server component whose only job is the Suspense boundary `useSearchParams`
 * requires: under `output: 'export'` the shell is prerendered while the query
 * string is only known in the browser, and without the boundary the build fails
 * rather than degrading — which is the good outcome.
 */
export default function PageExploration() {
  return (
    <Suspense
      fallback={
        <section>
          <h1 className="m-0 font-affichage text-titre1 font-semibold">Explorer</h1>
          <p className="mt-3 text-grand text-encre-douce">Chargement…</p>
        </section>
      }
    >
      <VueExploration />
    </Suspense>
  )
}
