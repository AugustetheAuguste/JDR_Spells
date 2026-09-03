'use client'

import { useState } from 'react'

import { MOTS } from '@/lib/design/tokens'

const CLE_STOCKAGE = 'pf-theme'

/** Read once, lazily, at mount — not in an effect: the attribute is already
 * correct by the time this component hydrates (the inline script in
 * `app/layout.tsx` set it before paint), so there is nothing to synchronise,
 * only an initial value to read. */
function themeNuitInitial(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.theme === 'nuit'
}

/**
 * Day/night toggle. Deliberately not a context provider: the composition rule
 * in `Fournisseurs.tsx` is about the three data providers that throw outside
 * their tree (session, favourites, sync). This component owns no shared state a
 * second component could need — it reads and writes `document.documentElement`
 * and `localStorage` directly, the same surface the inline script in
 * `app/layout.tsx` touches before paint. Mounting it twice would be harmless.
 */
export function BasculeTheme() {
  const [nuit, setNuit] = useState(themeNuitInitial)

  const basculer = () => {
    const prochain = !nuit
    setNuit(prochain)
    if (prochain) {
      document.documentElement.dataset.theme = 'nuit'
      window.localStorage.setItem(CLE_STOCKAGE, 'nuit')
    } else {
      delete document.documentElement.dataset.theme
      window.localStorage.setItem(CLE_STOCKAGE, 'jour')
    }
  }

  // `aria-pressed`, not `aria-checked`: this is a single toggle button (one
  // control, one boolean), not a member of a `switch`/`radiogroup` role, and
  // `aria-pressed` is the attribute a plain `<button>` exposes for exactly that
  // shape (WAI-ARIA "button (pressed)" pattern).
  //
  // `min-h-cible min-w-cible` puts the button at the 44px real-control floor
  // (`DENSITE.cible`) the Skill sets — audit defect #7 lists this control by
  // name. No transition is attached, so `prefers-reduced-motion` has nothing to
  // gate here.
  //
  // The visible label text moved to `sr-only`: the header collapses this
  // control to an icon (crescent moon in day mode, offered as the action to
  // take), but the hit target stays 44px and the control stays named for a
  // screen reader.
  return (
    <button
      aria-pressed={nuit}
      className="flex min-h-cible min-w-cible items-center justify-center border border-bord-fort text-encre hover:text-accent"
      onClick={basculer}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        {nuit ? (
          <circle cx="12" cy="12" r="5" />
        ) : (
          <path d="M20.742 13.045a8.088 8.088 0 0 1-2.077.273c-4.492 0-8.135-3.643-8.135-8.135 0-.712.093-1.403.267-2.06a.5.5 0 0 0-.67-.588A9.94 9.94 0 0 0 3.5 12.058c0 5.523 4.477 10 10 10a9.94 9.94 0 0 0 8.918-5.51.5.5 0 0 0-.676-.503Z" />
        )}
      </svg>
      <span className="sr-only">
        {nuit ? MOTS.themeJour : MOTS.themeNuit}
      </span>
    </button>
  )
}
