/**
 * Client-side fetch of one spell's or one feat's full props, by slug —
 * `fetch('/data/sorts/<slug>.json')` / `fetch('/data/dons/<slug>.json')`,
 * the same static JSON `lirePropsSort`/`lirePropsDon` read off disk at build
 * time (`@/lib/donnees/sort-page`, `@/lib/donnees/don-page`), but reachable
 * from a client component : those two modules import `node:fs` at module
 * scope, so importing anything but their *types* from a client component is
 * a build error (see their own docstrings). Only `import type` crosses that
 * boundary here, which the codebase already does elsewhere
 * (`NiveauxParClasse.tsx`, `CoucheEnrichissement.tsx`).
 */

import type { PropsDon } from '@/lib/donnees/don-page'
import type { PropsSort } from '@/lib/donnees/sort-page'

export type ResultatChargement<T> =
  | { readonly statut: 'chargement' }
  | { readonly statut: 'ok'; readonly props: T }
  | { readonly statut: 'absent' }
  | { readonly statut: 'echec' }

export async function chargerPropsSort(slug: string): Promise<ResultatChargement<PropsSort>> {
  try {
    const reponse = await fetch(`/data/sorts/${slug}.json`)
    if (reponse.status === 404) return { statut: 'absent' }
    if (!reponse.ok) return { statut: 'echec' }
    return { statut: 'ok', props: (await reponse.json()) as PropsSort }
  } catch {
    return { statut: 'echec' }
  }
}

export async function chargerPropsDon(slug: string): Promise<ResultatChargement<PropsDon>> {
  try {
    const reponse = await fetch(`/data/dons/${slug}.json`)
    if (reponse.status === 404) return { statut: 'absent' }
    if (!reponse.ok) return { statut: 'echec' }
    return { statut: 'ok', props: (await reponse.json()) as PropsDon }
  } catch {
    return { statut: 'echec' }
  }
}
