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
 * and fails AA outright, so the fill is what lightened, not the text.
 *
 * `alerte` uses the disagreement colour, which is informational rather than an
 * error: a divergence between a class list and a spell page is a recorded fact
 * of the corpus, not a fault.
 *
 * The `accent` tone's text is `encreDouce`, not `accent` itself, even though
 * the border still carries the accent hue: `accent` text measures 4.48:1 on
 * `accentVoile` in the night palette, under the 4.5:1 AA floor by a hair
 * (`tokens.ts` never asserted this pairing — only accent-on-`base`). Both
 * tokens already exist; this étape has no authority to retare `accentVoile`
 * night in `tokens.ts` (owned by étape 04), so the fix stays inside this
 * component and picks a text colour that clears AA on every fill Badge paints,
 * in both themes (7.19:1 day, 8.87:1 night).
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
    accent: 'border-accent bg-accent-voile text-encre-douce',
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
