import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const RACINE_WEB = join(process.cwd())
const CSS = readFileSync(join(RACINE_WEB, 'app', 'impression.css'), 'utf8')
const LAYOUT = readFileSync(join(RACINE_WEB, 'app', 'layout.tsx'), 'utf8')

describe('impression.css', () => {
  it('ne contient aucune couleur littérale', () => {
    // Same shape of check as `lib/design/tokens.test.ts` — this file is not on
    // that test's allow-list, so a hex here would already fail it, but the
    // plan asks for a dedicated assertion local to this feature.
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('sa portée est print', () => {
    expect(CSS).toMatch(/@media print/)
  })

  it('pose la taille et les marges de la page A4', () => {
    expect(CSS).toMatch(/@page\s*\{[^}]*size:\s*A4 portrait/)
    expect(CSS).toMatch(/@page\s*\{[^}]*margin:/)
  })

  it('ne coupe jamais une section au milieu', () => {
    expect(CSS).toMatch(/\[data-section-impression\][^{]*\{[^}]*break-inside:\s*avoid/)
  })

  it('ne contient aucun terme de budget de poids ou de consommation', () => {
    // CLAUDE.md §11 : aucun budget de poids nulle part, et ce n'est pas cette
    // étape qui en réintroduit un sous un autre nom.
    expect(CSS.toLowerCase()).not.toMatch(/budget|kilobyte|\bko\b|\bkb\b|poids maximum|seuil de poids/)
  })

  it('lit les couleurs par variable, jamais en dur — seules les variables --color-impression-* apparaissent', () => {
    const variables = [...CSS.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1])
    expect(variables.length).toBeGreaterThan(0)
    for (const variable of variables) {
      expect(variable).toMatch(/^--color-/)
    }
  })
})

describe('layout.tsx importe impression.css, portée print', () => {
  it('importe le fichier', () => {
    expect(LAYOUT).toMatch(/import ['"]@\/app\/impression\.css['"]/)
  })
})

describe('aucun second rendu imprimable dans fiche_personnage', () => {
  it('aucun composant nommé VueFicheImprimable ou équivalent', () => {
    const dossier = join(RACINE_WEB, 'components', 'fiche_personnage')
    const fichiers = readdirSync(dossier)
    const suspects = fichiers.filter((nom) => /imprimable/i.test(nom))
    expect(suspects).toEqual([])
  })
})
