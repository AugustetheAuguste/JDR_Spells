import { Suspense } from 'react'

import { VueNavigation } from '@/components/navigation/VueNavigation'

/**
 * The navigation route.
 *
 * A server component whose only job is to pose the Suspense boundary that
 * `useSearchParams` requires: under `output: 'export'` the shell is prerendered
 * while the query string is only known in the browser, and without the boundary
 * the build fails rather than degrading.
 */
export default function PageNavigation() {
  return (
    <Suspense
      fallback={
        <section>
          <h1 className="m-0 font-affichage text-titre1 font-semibold">Sorts</h1>
          <p className="mt-3 text-grand text-encre-douce">Chargement…</p>
        </section>
      }
    >
      <VueNavigation />
    </Suspense>
  )
}
