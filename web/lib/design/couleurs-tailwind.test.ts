/**
 * The garde that `tokens.test.ts` never had: it checks for a hex outside
 * `tokens.ts`, but `text-white` is not a hex, so it walked straight through
 * `elements.tsx:151` and shipped a button that fails AA at 2.86:1 in the night
 * theme (audit UI/UX 2026-09, étape 14, defect #1). This test closes that gap
 * by refusing any default Tailwind colour utility anywhere in `web/`, not
 * just in the account routes this étape owns.
 *
 * Scope: every `.ts`/`.tsx` file under `web/`, excluding build output and this
 * file's own pattern definition (which has to spell the forbidden names to
 * search for them).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const RACINE_WEB = join(process.cwd())

const DOSSIERS_EXCLUS = new Set(['node_modules', '.next', 'out', 'coverage'])

/** Same utility prefixes and colour families as the brief's audit grep. */
const MOTIF_COULEUR_DEFAUT =
  /\b(?:text|bg|border|ring|decoration|divide|outline|shadow)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[0-9]{2,3})?\b/g

function listerFichiers(dossier: string): string[] {
  const resultat: string[] = []
  for (const entree of readdirSync(dossier)) {
    if (DOSSIERS_EXCLUS.has(entree)) continue
    const chemin = join(dossier, entree)
    const infos = statSync(chemin)
    if (infos.isDirectory()) {
      resultat.push(...listerFichiers(chemin))
    } else if (/\.(tsx?|css)$/.test(entree) && chemin !== __filename) {
      resultat.push(chemin)
    }
  }
  return resultat
}

describe('aucune couleur Tailwind par defaut', () => {
  it('ne trouve aucun text-white ni aucune autre couleur Tailwind par defaut dans web/', () => {
    const fichiers = listerFichiers(RACINE_WEB)
    const trouvailles: string[] = []
    for (const chemin of fichiers) {
      const contenu = readFileSync(chemin, 'utf8')
      const correspondances = contenu.match(MOTIF_COULEUR_DEFAUT)
      if (correspondances !== null) {
        trouvailles.push(`${relative(RACINE_WEB, chemin)}: ${correspondances.join(', ')}`)
      }
    }
    expect(trouvailles).toEqual([])
  })
})
