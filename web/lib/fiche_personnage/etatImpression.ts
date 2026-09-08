'use client'

import { useSyncExternalStore } from 'react'

/**
 * Whether a print (or a print preview) is currently under way, tracked via
 * `beforeprint`/`afterprint` on `window`.
 *
 * `Section` (démonte son contenu replié, `{deplie && <div>…}`) and
 * `ValeurCalculee` (démonte son détail replié) cannot be reopened by CSS
 * alone once collapsed — there is nothing in the DOM for a `@media print`
 * rule to reveal (Skill `pf-fiche-personnage`, plan 17 § contexte hérité,
 * verified by reading both files before writing this one). Both components
 * read this hook and OR it into their own open/closed boolean, so print
 * forces everything open without ever calling `setState` on the underlying
 * fold state — nothing to restore afterwards, because nothing was mutated.
 * This is deliberately simpler than "flip a ref, then flip it back on
 * `afterprint`": there is no window where a race could leave the sheet
 * showing the wrong fold state, on screen or on paper, because the local
 * state the reader controls is never touched by printing at all.
 *
 * A single `window`-level store, not local state per component: every
 * `Section` and every `ValeurCalculee` on the page must flip in the same
 * frame, and `useSyncExternalStore` is the primitive for exactly that shape
 * — a value that lives outside React and can change between renders without
 * a parent re-rendering to push it down.
 */
let impressionEnCours = false
const abonnes = new Set<() => void>()

function definir(valeur: boolean): void {
  if (impressionEnCours === valeur) return
  impressionEnCours = valeur
  for (const notifier of abonnes) notifier()
}

function surAvantImpression(): void {
  definir(true)
}

function surApresImpression(): void {
  definir(false)
}

function sAbonner(rappel: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  if (abonnes.size === 0) {
    window.addEventListener('beforeprint', surAvantImpression)
    window.addEventListener('afterprint', surApresImpression)
  }
  abonnes.add(rappel)
  return () => {
    abonnes.delete(rappel)
    if (abonnes.size === 0) {
      window.removeEventListener('beforeprint', surAvantImpression)
      window.removeEventListener('afterprint', surApresImpression)
    }
  }
}

function lireEtat(): boolean {
  return impressionEnCours
}

function lireEtatServeur(): boolean {
  return false
}

export function useImprimeEnCours(): boolean {
  return useSyncExternalStore(sAbonner, lireEtat, lireEtatServeur)
}

/** Exposed for tests only, to drive `beforeprint`/`afterprint` without a real
 * print dialog — `window.print()` does not fire these events under jsdom. */
export function _reinitialiserPourTests(): void {
  impressionEnCours = false
  abonnes.clear()
}
