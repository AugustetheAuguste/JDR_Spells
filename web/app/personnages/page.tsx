import { Suspense } from 'react'

import { VueIndexFiches } from '@/components/fiche_personnage/VueIndexFiches'

/**
 * The sheet index. `VueIndexFiches` is a client component (it reads
 * `localStorage` through `useFiches()` and the URL through
 * `useSearchParams()`), mounted here inside the `Suspense` boundary that
 * `useSearchParams` requires under `output: 'export'` — same pattern as
 * `app/dons/page.tsx` and `app/page.tsx` for the spell list, since the query
 * string is only known in the browser, not at prerender time.
 */
export const metadata = {
  title: 'Mes fiches',
  description: 'La liste de vos fiches de personnage, sur cet appareil.',
}

export default function PagePersonnages() {
  return (
    <Suspense fallback={<p className="max-w-[80ch] text-corps text-encre-douce">Chargement…</p>}>
      <VueIndexFiches />
    </Suspense>
  )
}
