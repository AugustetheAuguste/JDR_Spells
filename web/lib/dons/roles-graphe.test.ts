/**
 * `lireRoles` — resolving the tree view's node/edge colours from the CSS
 * custom properties `styles/theme.css` already declares, never from a
 * literal hex written in this module.
 *
 * `getComputedStyle` is injected, never read off the implicit browser
 * global, so this stays testable under jsdom/vitest exactly like the
 * `explorateur_dons.js` precedent this ports the DECISION from (not the
 * code).
 */
import { describe, expect, it } from 'vitest'

import { COULEURS, COULEURS_NUIT } from '@/lib/design/tokens'
import { lireRoles, themeNuit } from './roles-graphe.js'

function racineAvecProprietes(proprietes: Readonly<Record<string, string>>): HTMLElement {
  const racine = document.createElement('div')
  for (const [nom, valeur] of Object.entries(proprietes)) {
    racine.style.setProperty(nom, valeur)
  }
  document.body.appendChild(racine)
  return racine
}

// Values are read off `tokens.ts` (never a literal hex here — see
// `lib/design/tokens.test.ts`'s "aucun hexadécimal hors de tokens.ts").
const PROPRIETES_JOUR = {
  '--color-surface': COULEURS.surface,
  '--color-encre': COULEURS.encre,
  '--color-encre-douce': COULEURS.encreDouce,
  '--color-bord-fort': COULEURS.bordFort,
  '--color-accent': COULEURS.accent,
}

const PROPRIETES_NUIT = {
  '--color-surface': COULEURS_NUIT.surface,
  '--color-encre': COULEURS_NUIT.encre,
  '--color-encre-douce': COULEURS_NUIT.encreDouce,
  '--color-bord-fort': COULEURS_NUIT.bordFort,
  '--color-accent': COULEURS_NUIT.accent,
}

describe('lireRoles', () => {
  it('résout les cinq rôles depuis les variables CSS de la racine, jamais un littéral', () => {
    const racine = racineAvecProprietes(PROPRIETES_JOUR)
    const roles = lireRoles(racine, (element) => globalThis.getComputedStyle(element))
    expect(roles).toEqual({
      fond: COULEURS.surface,
      texte: COULEURS.encre,
      arete: COULEURS.encreDouce,
      bord: COULEURS.bordFort,
      accent: COULEURS.accent,
    })
  })

  it('bascule de couleurs quand la racine porte les variables du thème nuit', () => {
    const jour = lireRoles(racineAvecProprietes(PROPRIETES_JOUR), (e) => globalThis.getComputedStyle(e))
    const nuit = lireRoles(racineAvecProprietes(PROPRIETES_NUIT), (e) => globalThis.getComputedStyle(e))
    expect(nuit.fond).not.toBe(jour.fond)
    expect(nuit.texte).not.toBe(jour.texte)
    expect(nuit.accent).not.toBe(jour.accent)
  })

  it('accepte un getComputedStyle injecté qui n’est pas le global implicite', () => {
    // The whole point: a component reading `window.getComputedStyle` directly
    // would not be renderable under jsdom in the way this repository tests
    // client components. A fake lecteur proves the parameter is really used.
    const racine = racineAvecProprietes(PROPRIETES_JOUR)
    let appels = 0
    const lecteurFictif = (element: Element): Pick<CSSStyleDeclaration, 'getPropertyValue'> => {
      appels += 1
      return globalThis.getComputedStyle(element)
    }
    lireRoles(racine, lecteurFictif)
    expect(appels).toBeGreaterThan(0)
  })
})

describe('themeNuit', () => {
  it('faux par défaut, sans ancêtre data-theme="nuit"', () => {
    const racine = racineAvecProprietes(PROPRIETES_JOUR)
    expect(themeNuit(racine)).toBe(false)
  })

  it('vrai sous un ancêtre data-theme="nuit"', () => {
    const hote = document.createElement('div')
    hote.setAttribute('data-theme', 'nuit')
    const racine = racineAvecProprietes(PROPRIETES_NUIT)
    hote.appendChild(racine)
    document.body.appendChild(hote)
    expect(themeNuit(racine)).toBe(true)
  })
})
