'use client'

import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { useFiches } from '@/lib/fiche_personnage/contexte-fiches'

/**
 * Creates one empty sheet on mount, then redirects to it.
 *
 * `creer()` is async, so this has to run from an effect — but a bare
 * setState-in-effect on mount is exactly what `react-hooks/set-state-in-effect`
 * exists to catch, and React's dev Strict Mode double-invokes an effect on
 * mount regardless. A `useRef` latch guards against that double call: the
 * *second* invocation sees the latch already set and does nothing, so a
 * double mount still produces exactly one sheet (spec, notes
 * d'implémentation — "le bug évident de cette étape").
 *
 * There is no local state to set after the `await`: on success this redirects
 * immediately via `router.replace`, and on failure it redirects back to the
 * index — either way nothing here is left mounted long enough to render a
 * second state, so there is nothing for the lint rule to flag.
 */
export default function PageNouvellePersonnage() {
  const router = useRouter()
  const { creer } = useFiches()
  const dejaLancee = useRef(false)

  useEffect(() => {
    if (dejaLancee.current) return
    dejaLancee.current = true

    async function creerEtRediriger(): Promise<void> {
      const resultat = await creer('')
      if (resultat.ok) {
        router.replace(`/personnages/fiche/?id=${encodeURIComponent(resultat.fiche.id)}` as Route, {
          scroll: false,
        })
      } else {
        router.replace('/personnages/' as Route, { scroll: false })
      }
    }

    void creerEtRediriger()
  }, [creer, router])

  return null
}
