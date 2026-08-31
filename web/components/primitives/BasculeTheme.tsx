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

  return (
    <button
      aria-pressed={nuit}
      className="border border-bord-fort px-2 py-1 text-petit text-encre hover:text-accent"
      onClick={basculer}
      type="button"
    >
      {nuit ? MOTS.themeJour : MOTS.themeNuit}
    </button>
  )
}
