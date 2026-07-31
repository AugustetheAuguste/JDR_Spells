/**
 * The TypeScript port of `plier` from `src/pf_spells/web_pliage.py`.
 *
 * This is the single most load-bearing function in the interface, and the reason
 * is that its failure mode is silence. The exporter folds every spell name into
 * `nf`; the client folds every keystroke before matching. If the two folds ever
 * disagree by one character, search stops working on every accented word — half
 * a French corpus — and nothing throws, nothing logs, nothing turns red. The
 * search box simply returns nothing for "éclair" and a user concludes the spell
 * is missing.
 *
 * That is why the two implementations are pinned by *identical test vectors*:
 * `tests/test_build_alias.py` and `lib/recherche/pliage.test.ts` assert the same
 * inputs produce the same outputs, character for character. Changing the fold
 * means changing both, plus re-running the export — never one alone.
 *
 * Kept free of any React import so it can be tested without mounting anything.
 */

/** Ligatures must be mapped *before* NFKD, which does not decompose them:
 * "Cœur" would otherwise keep its œ and never match a query typed "coeur". Same
 * pre-mapping, and same reason, as step 2 of the `id` slug algorithm. */
const LIGATURES: ReadonlyArray<readonly [RegExp, string]> = [
  [/œ/g, 'oe'],
  [/Œ/g, 'oe'],
  [/æ/g, 'ae'],
  [/Æ/g, 'ae'],
]

/** U+2019 (typographic) and U+02BC (modifier letter) both appear as apostrophes
 * in wiki content. They fold to a *space*, not to U+0027, so that "Mur d'épines"
 * and "Mur depines" collapse onto the same token run — someone typing fast omits
 * the apostrophe entirely. */
const APOSTROPHES = /['’ʼ]/g

const ESPACES = /\s+/g

/** Combining marks, as left behind by NFKD. The equivalent of Python's
 * `unicodedata.combining` test: `\p{M}` is the Unicode Mark general category. */
const MARQUES = /\p{M}/gu

/** Drop combining marks via NFKD — the counterpart of `sans_diacritiques`. */
export function sansDiacritiques(texte: string): string {
  return texte.normalize('NFKD').replace(MARQUES, '')
}

/**
 * Fold `texte` into a search key: lowercase, no diacritics, apostrophes become
 * spaces, whitespace collapsed.
 *
 * Mirrors `plier` in `src/pf_spells/web_pliage.py` exactly. The order of
 * operations is part of the contract, not an implementation detail.
 */
export function plier(texte: string): string {
  let resultat = texte
  for (const [motif, remplacement] of LIGATURES) {
    resultat = resultat.replace(motif, remplacement)
  }
  resultat = resultat.replace(APOSTROPHES, ' ')
  return sansDiacritiques(resultat).toLowerCase().replace(ESPACES, ' ').trim()
}
