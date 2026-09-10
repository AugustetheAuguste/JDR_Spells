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
      data-imprimer-exclure
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
          /* The previous crescent closed on itself with a straight `Z` from
             (21.74, 16.05) back to (20.74, 13.05), which cut the lower-right
             tip clean off. This path is a single closed crescent whose every
             extent stays inside the 24x24 box. */
          <path d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" />
        )}
      </svg>
      <span className="sr-only">
        {nuit ? MOTS.themeJour : MOTS.themeNuit}
      </span>
    </button>
  )
}
