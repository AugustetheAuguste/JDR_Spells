/**
 * `sourceFiches` reads its `lireFiches` callback fresh on every `chercher` —
 * there is no cache to test the absence of, only that the callback is what
 * decides the result and that the fold matches accents/case like every
 * other search box.
 */
import { describe, expect, it } from 'vitest'

import { creerFicheVide } from '@/lib/fiche_personnage/fiche-vide'
import type { Fiche } from '@/lib/fiche_personnage/schema'

import { sourceFiches } from './source-fiches'

function ficheAvecNom(id: string, nom: string): Fiche {
  const vide = creerFicheVide(id, '2026-01-01T00:00:00.000Z')
  return { ...vide, meta: { ...vide.meta, nomPersonnage: nom } }
}

describe('sourceFiches', () => {
  it('filtre par nom, insensible aux accents et à la casse', async () => {
    const fiches = [ficheAvecNom('a', 'Éloïse'), ficheAvecNom('b', 'Bertrand')]
    const source = sourceFiches(() => fiches)
    const resultats = await source.chercher('ELOISE', 5)
    expect(resultats.map((r) => r.cle)).toEqual(['a'])
    expect(resultats[0]?.href).toBe('/personnages/fiche/?id=a')
  })

  it('rend le mot « Personnage sans nom » pour une fiche sans nom, jamais une chaîne vide', async () => {
    const fiches = [ficheAvecNom('a', '')]
    const source = sourceFiches(() => fiches)
    // An empty query never matches — same contract as the other sources.
    const resultatsVide = await source.chercher('', 5)
    expect(resultatsVide).toEqual([])
  })

  it("relit lireFiches à chaque appel, jamais un instantané mis en cache", async () => {
    let fiches: readonly Fiche[] = [ficheAvecNom('a', 'Un')]
    const source = sourceFiches(() => fiches)
    expect((await source.chercher('un', 5)).map((r) => r.cle)).toEqual(['a'])
    fiches = [ficheAvecNom('a', 'Un'), ficheAvecNom('b', 'Une autre')]
    expect((await source.chercher('un', 5)).map((r) => r.cle).sort()).toEqual(['a', 'b'])
  })

  it("l'ordre place fiches après sorts et dons", () => {
    const source = sourceFiches(() => [])
    expect(source.ordre).toBe(2)
    expect(source.type).toBe('fiche')
  })

  it('hrefTousLesResultats pointe vers /personnages/?q=', () => {
    const source = sourceFiches(() => [])
    expect(source.hrefTousLesResultats('elara')).toBe('/personnages/?q=elara')
  })
})
