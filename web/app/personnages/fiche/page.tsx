import { Suspense } from 'react'

import { VueFiche } from '@/components/fiche_personnage/VueFiche'

/**
 * The single character-sheet route. A query parameter (`?id=`), never a
 * dynamic segment — `output: 'export'` has no server to resolve one at
 * request time (plan `15_UI_FICHE.md` § contexte du dépôt).
 *
 * `useSearchParams` needs a Suspense boundary at build time under static
 * export, same shape as `app/comparaison/page.tsx`.
 */
export const metadata = {
  title: 'Fiche de personnage',
  description: 'Une fiche de personnage Pathfinder 1e, chaque total ouvrable pour montrer d’où il vient.',
}

export default function PageFiche() {
  return (
    <Suspense fallback={null}>
      <VueFiche />
    </Suspense>
  )
}
