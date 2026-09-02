import { Suspense } from 'react'

import { VueDons } from '@/components/dons/VueDons'

/**
 * The dons ("feats") navigation route — `13_UI_DONS_LIST`.
 *
 * A server component whose only job is the `Suspense` boundary
 * `useSearchParams` requires: under `output: 'export'` this shell is
 * prerendered while the query string is only known in the browser, exactly
 * `app/page.tsx`'s pattern for the spell list.
 */
export default function PageDons() {
  return (
    <Suspense
      fallback={
        <section>
          <h1 className="m-0 font-affichage text-titre1 font-semibold">Dons</h1>
          <p className="mt-3 text-grand text-encre-douce">Chargement…</p>
        </section>
      }
    >
      <VueDons />
    </Suspense>
  )
}
