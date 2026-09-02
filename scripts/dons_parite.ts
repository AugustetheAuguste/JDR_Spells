/**
 * Orchestre le harnais de parité Python/TypeScript des verdicts d'éligibilité
 * aux dons : vide les deux dumps puis lance le différentiel — la cible
 * `npm run dons:parite`.
 *
 * Écrit en TypeScript plutôt qu'en shell (`${PROFIL:-rapide}` dans un script
 * `package.json`) parce que `npm` choisit `cmd.exe` comme shell par défaut
 * sous Windows, qui ne comprend pas l'expansion de paramètre POSIX — le
 * profil est donc résolu ici, en JS, une fois pour toutes, puis passé en
 * argument déjà littéral aux deux producteurs et au différentiel.
 *
 * Profil : `rapide` par défaut (boucle de rétroaction locale, 42 personnages
 * × 1417 dons = 59 514 cellules) ; `complet` si `PROFIL=complet` est présent
 * dans l'environnement (la CI le pose explicitement, 1260 × 1417 = 1 785 420
 * cellules).
 */

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function executer(commande: string, args: readonly string[]): void {
  const resultat = spawnSync(commande, args, { cwd: RACINE, stdio: 'inherit', shell: true })
  if (resultat.error) {
    console.error(`ÉCHEC — impossible de lancer ${commande} : ${resultat.error.message}`)
    process.exit(1)
  }
  const code = resultat.status ?? 1
  if (code !== 0) process.exit(code)
}

function main(): number {
  const profil = process.env.PROFIL === 'complet' ? 'complet' : 'rapide'
  const chemPython = resolve(RACINE, 'build/verdicts/python.jsonl')
  const chemTs = resolve(RACINE, 'build/verdicts/ts.jsonl')

  console.log(`— parité des dons, profil « ${profil} » —`)

  executer('python', ['tools/dons/vider_verdicts.py', '--profil', profil, '-o', chemPython])
  executer('npx', ['tsx', 'scripts/vider_verdicts_ts.ts', '--profil', profil, '-o', chemTs])
  executer('npx', ['tsx', 'scripts/comparer_verdicts.ts', chemPython, chemTs])

  return 0
}

process.exit(main())
