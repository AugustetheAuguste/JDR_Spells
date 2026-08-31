/**
 * Which wheel categories are offered, and in what order — a personal display
 * preference, not a filter.
 *
 * Stored in `localStorage`, the same surface `BasculeTheme` uses for the
 * day/night choice: this does not narrow the corpus, two readers with the same
 * URL still see the same spells, so it has no business in the query string —
 * consistent with the rule that the URL is the sole authority on *filter* state
 * (`etat-url.ts`). Read lazily on the client only; the server-rendered shell
 * falls back to `ORDRE_PAR_DEFAUT` until hydration, exactly as the theme script
 * in `app/layout.tsx` is what actually avoids a flash there — no such script is
 * needed here because an ordering difference for one render frame is not a
 * flash of the wrong colour, it is invisible.
 */

import { CLES_AXES, type CleAxe } from '@/lib/exploration/axes'

export const CLE_STOCKAGE_ROUE = 'explorer.roue.v1'

/** Niveau first (it is pinned — see `PersonnaliserRoue`), then the two axes the
 * rework was asked for by name, ahead of the three pre-existing ones. */
export const ORDRE_PAR_DEFAUT: readonly CleAxe[] = ['niveau', 'portee', 'degats']

/** Read the stored order, validated against the live axis table. Unknown or
 * missing entries are dropped rather than fatal — the same discipline as
 * `lireEtat` for a hand-edited URL, applied to `localStorage` instead: a
 * corrupted or stale value falls back to the default rather than crashing the
 * route. `niveau` is always present and always first, whatever was stored. */
export function lirePreferenceRoue(): readonly CleAxe[] {
  if (typeof window === 'undefined') return ORDRE_PAR_DEFAUT
  const brut = window.localStorage.getItem(CLE_STOCKAGE_ROUE)
  if (brut === null) return ORDRE_PAR_DEFAUT
  let valeurs: unknown
  try {
    valeurs = JSON.parse(brut)
  } catch {
    return ORDRE_PAR_DEFAUT
  }
  if (!Array.isArray(valeurs)) return ORDRE_PAR_DEFAUT
  const connus = new Set<string>(CLES_AXES)
  const vus = new Set<CleAxe>()
  const propres: CleAxe[] = []
  for (const valeur of valeurs) {
    if (typeof valeur !== 'string' || !connus.has(valeur) || vus.has(valeur as CleAxe)) continue
    vus.add(valeur as CleAxe)
    propres.push(valeur as CleAxe)
  }
  return ['niveau', ...propres.filter((cle) => cle !== 'niveau')]
}

/** Persist the order. `niveau` is written back at the head even if the caller
 * forgot to pin it — the same guarantee `lirePreferenceRoue` gives on read, kept
 * symmetric so a value round-trips unchanged. */
export function ecrirePreferenceRoue(ordre: readonly CleAxe[]): void {
  if (typeof window === 'undefined') return
  const sansNiveau = ordre.filter((cle) => cle !== 'niveau')
  window.localStorage.setItem(
    CLE_STOCKAGE_ROUE,
    JSON.stringify(['niveau', ...sansNiveau]),
  )
}
