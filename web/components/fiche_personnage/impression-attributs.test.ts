import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const RACINE_WEB = join(process.cwd())

function lire(...segments: string[]): string {
  return readFileSync(join(RACINE_WEB, ...segments), 'utf8')
}

describe('attributs de données d’impression — mobilier cité par le plan 17', () => {
  it('VueFiche.tsx porte l’attribut racine data-fiche-impression', () => {
    expect(lire('components', 'fiche_personnage', 'VueFiche.tsx')).toMatch(/data-fiche-impression/)
  })

  it.each([
    ['EnteteSite.tsx (header du site)', ['components', 'navigation', 'EnteteSite.tsx']],
    ['FilAriane.tsx (fil d’Ariane)', ['components', 'navigation', 'FilAriane.tsx']],
    ['BasculeTheme.tsx (bascule de thème)', ['components', 'primitives', 'BasculeTheme.tsx']],
    ['layout.tsx (pied de page et lien d’évitement)', ['app', 'layout.tsx']],
    ['BoutonExport.tsx', ['components', 'fiche_personnage', 'BoutonExport.tsx']],
    ['BoutonImport.tsx', ['components', 'fiche_personnage', 'BoutonImport.tsx']],
    ['DialogueSuppression.tsx (suppression)', ['components', 'fiche_personnage', 'DialogueSuppression.tsx']],
    ['CarteFiche.tsx (barre d’actions, dupliquer, supprimer)', ['components', 'fiche_personnage', 'CarteFiche.tsx']],
  ])('%s porte data-imprimer-exclure', (_nom, segments) => {
    expect(lire(...segments)).toMatch(/data-imprimer-exclure/)
  })

  it('layout.tsx porte deux occurrences distinctes (lien d’évitement et pied de page)', () => {
    const texte = lire('app', 'layout.tsx')
    const occurrences = texte.match(/data-imprimer-exclure/g) ?? []
    expect(occurrences.length).toBeGreaterThanOrEqual(2)
  })
})
