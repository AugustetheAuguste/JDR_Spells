/**
 * The tree view's colour resolution — `couleurCout`/`feuilleDeStyle` — never
 * a literal hex in this file (grep target for criterion 10): every value
 * traces back to `lib/design/tokens.ts` via `lireRoles`/`RAMPE_COUT`.
 */
import { describe, expect, it } from 'vitest'

import { couleurCout, feuilleDeStyle } from './VueArbre'
import { COULEURS, COULEURS_NUIT, RAMPE_COUT, RAMPE_COUT_NUIT } from '@/lib/design/tokens'
import { lireRoles } from '@/lib/dons/roles-graphe'

// Values are read off `tokens.ts` (never a literal hex here — see
// `lib/design/tokens.test.ts`'s "aucun hexadécimal hors de tokens.ts").
const PROPRIETES_JOUR: Readonly<Record<string, string>> = {
  '--color-surface': COULEURS.surface,
  '--color-encre': COULEURS.encre,
  '--color-encre-douce': COULEURS.encreDouce,
  '--color-bord-fort': COULEURS.bordFort,
  '--color-accent': COULEURS.accent,
}

const PROPRIETES_NUIT: Readonly<Record<string, string>> = {
  '--color-surface': COULEURS_NUIT.surface,
  '--color-encre': COULEURS_NUIT.encre,
  '--color-encre-douce': COULEURS_NUIT.encreDouce,
  '--color-bord-fort': COULEURS_NUIT.bordFort,
  '--color-accent': COULEURS_NUIT.accent,
}

function racineAvecProprietes(proprietes: Readonly<Record<string, string>>): HTMLElement {
  const racine = document.createElement('div')
  for (const [nom, valeur] of Object.entries(proprietes)) racine.style.setProperty(nom, valeur)
  return racine
}

const LECTEUR = (element: Element) => globalThis.getComputedStyle(element)

describe('couleurCout', () => {
  it('lit RAMPE_COUT/RAMPE_COUT_NUIT — jamais un littéral recalculé ici', () => {
    const roles = lireRoles(racineAvecProprietes(PROPRIETES_JOUR), LECTEUR)
    expect(couleurCout(1, roles, false)).toBe(RAMPE_COUT[0])
    expect(couleurCout(5, roles, false)).toBe(RAMPE_COUT[4])
    expect(couleurCout(3, roles, true)).toBe(RAMPE_COUT_NUIT[2])
  })

  it('un coût non calculé retombe sur le fond neutre, jamais un littéral', () => {
    const roles = lireRoles(racineAvecProprietes(PROPRIETES_JOUR), LECTEUR)
    expect(couleurCout(null, roles, false)).toBe(roles.fond)
  })
})

describe('rafraichirTheme — les couleurs changent bien avec le thème', () => {
  it('la feuille de style du graphe change de couleurs entre jour et nuit', () => {
    const rolesJour = lireRoles(racineAvecProprietes(PROPRIETES_JOUR), LECTEUR)
    const rolesNuit = lireRoles(racineAvecProprietes(PROPRIETES_NUIT), LECTEUR)

    const feuilleJour = feuilleDeStyle(rolesJour)
    const feuilleNuit = feuilleDeStyle(rolesNuit)

    function proprieteDuBloc(
      feuille: ReturnType<typeof feuilleDeStyle>,
      selecteur: string,
      propriete: string,
    ): unknown {
      const bloc = feuille.find((b) => b.selector === selecteur)
      const style = (bloc as { style?: Record<string, unknown> } | undefined)?.style
      return style?.[propriete]
    }

    expect(proprieteDuBloc(feuilleJour, 'node', 'background-color')).not.toBe(
      proprieteDuBloc(feuilleNuit, 'node', 'background-color'),
    )
    expect(proprieteDuBloc(feuilleJour, 'edge', 'line-color')).not.toBe(
      proprieteDuBloc(feuilleNuit, 'edge', 'line-color'),
    )
  })
})
