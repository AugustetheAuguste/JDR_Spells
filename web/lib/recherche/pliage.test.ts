/**
 * The folding vectors, pinned to literal values.
 *
 * These are the SAME vectors as `tests/test_build_alias.py::TestPliage` and
 * `tests/test_web_pliage.py`. That duplication is the point: a TypeScript port
 * of a Python function has no compiler to hold it honest, and the failure mode of
 * a divergence is silence — search returning nothing for "éclair", no error
 * anywhere. If you change one side, this file must be changed with it, and if
 * you cannot make both produce the same string, the fold is wrong.
 *
 * The vectors are literals, not `plier(x) === plier(x)` tautologies, for the same
 * reason: a test that compares an implementation to itself passes after any bug.
 */

import { describe, expect, it } from 'vitest'

import { plier, sansDiacritiques } from './pliage'

describe('plier', () => {
  it('tient les deux vecteurs nommés par le plan', () => {
    expect(plier('Éclair')).toBe('eclair')
    expect(plier("Mur d'épines")).toBe('mur d epines')
  })

  it.each([
    ['Magic Missile', 'magic missile'],
    ["MELF'S ACID ARROW", 'melf s acid arrow'],
    ['Cœur incassable', 'coeur incassable'],
    ['Détection de la magie', 'detection de la magie'],
    ['  espaces   multiples  ', 'espaces multiples'],
    ['clairaudience/clairvoyance', 'clairaudience/clairvoyance'],
  ])('plie %j en %j — vecteurs partagés avec Python', (entree, attendu) => {
    expect(plier(entree)).toBe(attendu)
  })

  it('traite les trois apostrophes comme une seule', () => {
    // U+0027, U+2019 and U+02BC all occur in wiki content. They fold to a space,
    // not to U+0027, so a user who omits the apostrophe entirely still matches.
    expect(plier("Aire de l'aigle")).toBe('aire de l aigle')
    expect(plier('Aire de l’aigle')).toBe('aire de l aigle')
    expect(plier('Aire de lʼaigle')).toBe('aire de l aigle')
  })

  it('mappe les ligatures avant NFKD, qui ne les décompose pas', () => {
    // Proof the pre-mapping is doing work and not decoration: NFKD alone leaves
    // the ligature intact, so "coeur" would never match "Cœur".
    expect('Cœur'.normalize('NFKD')).toContain('œ')
    expect(plier('Cœur')).toBe('coeur')
    expect(plier('Æther')).toBe('aether')
    expect(plier('œuf æsir')).toBe('oeuf aesir')
  })

  it('est idempotent — replier un pli ne le change pas', () => {
    // The exporter stores `nf = plier(n)` and the query is folded again before
    // matching. If folding twice differed from folding once, every stored key
    // would be one fold behind the query.
    for (const entree of ['Éclair', "Mur d'épines", 'Cœur incassable', 'Air autoritaire']) {
      expect(plier(plier(entree))).toBe(plier(entree))
    }
  })

  it('ne renvoie jamais de marque combinante', () => {
    expect(sansDiacritiques('éàüçîõ')).toBe('eaucio')
    expect(plier('Affaiblissement des énergies destructives')).not.toMatch(/\p{M}/u)
  })

  it('rend la chaîne vide sur une entrée sans lettre', () => {
    // The empty result is what `chercher` reads as "no query", so this is a
    // contract and not a curiosity: "   " must not search for anything.
    expect(plier('')).toBe('')
    expect(plier('   ')).toBe('')
    expect(plier(" ' ")).toBe('')
  })
})
