'use client'

import { useEffect, useState } from 'react'

import type { Theme } from '@/lib/design/rampe'

/**
 * The theme in force right now, followed live.
 *
 * `rampe.ts` (§ 05, out of this step's scope) computed a night ramp, but no
 * consumer read it: `couleurTranche` still cycled `RAMPE_CATEGORIELLE` alone, so
 * `/explorer` under `data-theme="nuit"` kept drawing wedges as low as 2.33:1 on
 * the night background. `pf-web-design-system`'s "point non résolu" names exactly
 * this gap.
 *
 * Two ways to close it (`11_EXPLORATION.md` § Contexte hérité). The better one —
 * a CSS variable switched by `[data-theme]` in `theme.css`, so the chart never
 * knows the theme exists — needs variables `04_JETONS_COULEUR` did not declare,
 * and this step must not touch `theme.css` or `tokens.ts`. So this reads
 * `data-theme` on `<html>` at mount (same lazy-read pattern as
 * `BasculeTheme.themeNuitInitial`) and follows it with a `MutationObserver`,
 * because `BasculeTheme` is a sibling component, not a provider — it flips the
 * attribute directly without notifying anyone, so a reader who toggles the theme
 * while `/explorer` is open needs the wedges to repaint without a reload.
 *
 * The initial read is server-blind: prerendered HTML has no `data-theme` (the
 * inline script in `app/layout.tsx` sets it before paint, client-side only), so
 * the very first paint of a page freshly loaded in night mode is briefly the day
 * ramp until this effect runs. Written down rather than fixed, because fixing it
 * is exactly the CSS-variable route this step is not allowed to take.
 */
function themeActifInitial(): Theme {
  if (typeof document === 'undefined') return 'jour'
  return document.documentElement.dataset.theme === 'nuit' ? 'nuit' : 'jour'
}

export function useThemeActif(): Theme {
  const [theme, setTheme] = useState<Theme>(themeActifInitial)

  useEffect(() => {
    const cible = document.documentElement
    const lire = (): void => {
      setTheme(cible.dataset.theme === 'nuit' ? 'nuit' : 'jour')
    }
    lire()
    const observateur = new MutationObserver(lire)
    observateur.observe(cible, { attributeFilter: ['data-theme'], attributes: true })
    return () => observateur.disconnect()
  }, [])

  return theme
}
