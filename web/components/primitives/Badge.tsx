import type { ReactNode } from 'react'

/**
 * A small label with a tone.
 *
 * Four tones and no more. `accent` is the single accent colour, so it means one
 * thing — "active, or chosen by you" — and spending it on decoration would leave
 * nothing to signal that state.
 *
 * `accent` is a pale wash carrying dark accent text rather than white on a solid
 * fill. No text on this site is white: black on the solid accent measures 2.7:1
 * and fails AA outright, so the fill is what lightened, not the text. `alerte` uses the disagreement colour, which is
 * informational rather than an error: a divergence between a class list and a
 * spell page is a recorded fact of the corpus, not a fault.
 */
export function Badge({
  children,
  ton = 'neutre',
  titre,
}: {
  readonly children: ReactNode
  readonly ton?: 'neutre' | 'accent' | 'alerte' | 'donnees'
  readonly titre?: string
}) {
  const tons = {
    neutre: 'border-bord bg-base text-encre-douce',
    accent: 'border-accent bg-accent-voile text-accent',
    alerte: 'border-transparent bg-desaccord-voile text-desaccord',
    donnees: 'border-bord bg-surface font-donnees text-encre',
  } as const

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-jeton border px-1.5 py-0.5 text-micro font-medium whitespace-nowrap ${tons[ton]}`}
      {...(titre === undefined ? {} : { title: titre })}
    >
      {children}
    </span>
  )
}
