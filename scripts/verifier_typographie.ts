/**
 * Refuse la ponctuation que la charte typographique interdit dans une chaîne
 * d'interface : deux-points, point-virgule, tiret cadratin (hors marqueur de
 * donnée absente), tiret demi-cadratin, pluriel entre parenthèses.
 *
 * `scripts/verifier_a11y.ts` passe axe-core sur le HTML prérendu et ne voit pas
 * une ponctuation — un `:` dans un libellé est un texte valide pour axe. Rien
 * d'autre dans le dépôt ne relit la prose des composants.
 *
 * Ce script n'est pas un parseur TypeScript : c'est un automate sur les
 * littéraux (chaînes simples, doubles, gabarits) qui ignore les commentaires.
 * Portée : les littéraux de web/{app,components,lib}, hors fichiers de test.
 * Limite : une chaîne construite par concaténation à travers deux modules, ou
 * assemblée caractère par caractère, échappe à ce contrôle.
 *
 * Usage: tsx scripts/verifier_typographie.ts [--racine-web web]
 */

import { globSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const DOSSIERS = ['app', 'components', 'lib'] as const

interface Chaine {
  readonly texte: string
  readonly ligne: number
}

interface Motif {
  readonly id: string
  readonly aide: string
  readonly correspond: (texte: string) => boolean
}

const MOTIFS: readonly Motif[] = [
  {
    id: 'deux-points',
    aide: 'un séparateur étiquette/valeur est une structure, pas de la ponctuation',
    correspond: (texte) => / : | :/.test(texte),
  },
  {
    id: 'point-virgule',
    aide: 'deux idées, deux phrases',
    correspond: (texte) => texte.includes(';'),
  },
  {
    id: 'cadratin',
    aide: 'réservé au marqueur de donnée absente, jamais en prose',
    correspond: (texte) => texte.includes('—'),
  },
  {
    id: 'demi-cadratin',
    aide: 'aucun emploi',
    correspond: (texte) => texte.includes('–'),
  },
  {
    id: 'pluriel-paren',
    aide: 'le nombre est connu, écrivez-le',
    correspond: (texte) => /\((s|e|es)\)/.test(texte),
  },
]

/** A minimal automaton over string, comment and template-literal boundaries.
 * Not a TypeScript parser: it does not understand regex literals, JSX text
 * nodes or ASI, and it will occasionally emit a code fragment as a "string"
 * inside a template interpolation. That is an accepted trade-off — see the
 * module docstring — because the alternative is a real parser dependency. */
function extraireChaines(source: string): Chaine[] {
  const chaines: Chaine[] = []
  const n = source.length
  let i = 0
  let ligne = 1
  let etat: 'code' | 'ligne' | 'bloc' | 'chaine' | 'gabarit' = 'code'
  let quote = ''
  let tampon = ''
  let ligneDebut = 1
  // Depth counter per open `${ }` interpolation, LIFO. A '}' at depth 0 for the
  // top frame closes the interpolation and resumes the enclosing template.
  const pileGabarits: number[] = []

  while (i < n) {
    const c = source[i]

    if (etat === 'ligne') {
      if (c === '\n') { etat = 'code'; ligne++ }
      i++
      continue
    }

    if (etat === 'bloc') {
      if (c === '\n') ligne++
      if (c === '*' && source[i + 1] === '/') { etat = 'code'; i += 2; continue }
      i++
      continue
    }

    if (etat === 'code') {
      if (c === '\n') { ligne++; i++; continue }
      if (c === '/' && source[i + 1] === '/') { etat = 'ligne'; i += 2; continue }
      if (c === '/' && source[i + 1] === '*') { etat = 'bloc'; i += 2; continue }
      if (c === "'" || c === '"') {
        quote = c; tampon = ''; ligneDebut = ligne; etat = 'chaine'; i++
        continue
      }
      if (c === '`') {
        tampon = ''; ligneDebut = ligne; etat = 'gabarit'; i++
        continue
      }
      if (pileGabarits.length > 0 && c === '{') {
        pileGabarits[pileGabarits.length - 1]! += 1
        i++
        continue
      }
      if (pileGabarits.length > 0 && c === '}') {
        const profondeur = pileGabarits[pileGabarits.length - 1]!
        if (profondeur === 0) {
          pileGabarits.pop()
          tampon = ''; ligneDebut = ligne; etat = 'gabarit'
        } else {
          pileGabarits[pileGabarits.length - 1] = profondeur - 1
        }
        i++
        continue
      }
      i++
      continue
    }

    if (etat === 'chaine') {
      if (c === '\n') ligne++
      if (c === '\\') { tampon += c + (source[i + 1] ?? ''); i += 2; continue }
      if (c === quote) {
        chaines.push({ texte: tampon, ligne: ligneDebut })
        etat = 'code'
        i++
        continue
      }
      tampon += c
      i++
      continue
    }

    // etat === 'gabarit'
    if (c === '\n') ligne++
    if (c === '\\') { tampon += c + (source[i + 1] ?? ''); i += 2; continue }
    if (c === '`') {
      chaines.push({ texte: tampon, ligne: ligneDebut })
      etat = 'code'
      i++
      continue
    }
    if (c === '$' && source[i + 1] === '{') {
      chaines.push({ texte: tampon, ligne: ligneDebut })
      pileGabarits.push(0)
      etat = 'code'
      i += 2
      continue
    }
    tampon += c
    i++
  }

  return chaines
}

const MOTS_COURANTS = new Set([
  'le', 'la', 'les', 'un', 'une', 'de', 'des', 'du', 'et', 'ou', 'pas', 'sur',
  'dans', 'pour', 'aucun', 'aucune', 'vous', 'est', 'sont', 'ce', 'cette',
  'par', 'plus', 'avec', 'sans',
])

const RE_LETTRE_ACCENTUEE = /[àâäéèêëïîôöùûüÿçœæÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇŒÆ]/
const RE_CLASSE_UTILITAIRE =
  /^(text|bg|border|px|py|mt|mb|flex|grid|rounded|min-|hover:|sm:|md:|lg:)/

function estChaineInterface(texte: string): boolean {
  const contientLettreAccentuee = RE_LETTRE_ACCENTUEE.test(texte)
  const jetons = texte.toLowerCase().split(/[^a-zàâäéèêëïîôöùûüÿçœæ]+/)
  const contientMotCourant = jetons.some((jeton) => MOTS_COURANTS.has(jeton))
  if (!contientLettreAccentuee && !contientMotCourant) return false

  if (texte.includes(' ')) {
    const jetonsUtilitaires = texte
      .split(/\s+/)
      .filter((jeton) => RE_CLASSE_UTILITAIRE.test(jeton))
    if (jetonsUtilitaires.length >= 2) return false
  }

  return true
}

interface Ecart {
  readonly fichier: string
  readonly ligne: number
  readonly motif: string
  readonly aide: string
  readonly extrait: string
}

function tronquer(texte: string, max: number): string {
  const aplati = texte.replace(/\s+/g, ' ').trim()
  return aplati.length > max ? `${aplati.slice(0, max)}…` : aplati
}

async function main(argv: readonly string[]): Promise<number> {
  const rang = argv.indexOf('--racine-web')
  const racineWeb = resolve(RACINE, rang >= 0 ? (argv[rang + 1] ?? 'web') : 'web')

  const motifs = globSync(
    DOSSIERS.map((dossier) => `${dossier}/**/*.{ts,tsx}`),
    { cwd: racineWeb },
  )
  const fichiers = motifs
    .filter((chemin) => !chemin.includes('.test.'))
    .sort()

  const ecarts: Ecart[] = []
  let chainesExaminees = 0
  const fichiersAvecEcart = new Set<string>()

  for (const chemin of fichiers) {
    const cheminAbsolu = resolve(racineWeb, chemin)
    const source = readFileSync(cheminAbsolu, 'utf8')
    const cheminRelatif = relative(RACINE, cheminAbsolu).replace(/\\/g, '/')

    for (const chaine of extraireChaines(source)) {
      if (!estChaineInterface(chaine.texte)) continue
      chainesExaminees++

      for (const motif of MOTIFS) {
        if (!motif.correspond(chaine.texte)) continue
        if (motif.id === 'cadratin' && chaine.texte.trim() === '—') continue

        ecarts.push({
          fichier: cheminRelatif,
          ligne: chaine.ligne,
          motif: motif.id,
          aide: motif.aide,
          extrait: tronquer(chaine.texte, 90),
        })
        fichiersAvecEcart.add(cheminRelatif)
      }
    }
  }

  const parFichier = new Map<string, number>()
  for (const ecart of ecarts) {
    parFichier.set(ecart.fichier, (parFichier.get(ecart.fichier) ?? 0) + 1)
  }
  for (const [fichier, compte] of [...parFichier.entries()].sort()) {
    console.log(`${fichier} : ${compte} écart(s)`)
  }

  if (ecarts.length === 0) {
    console.log(
      `\nOK — ${chainesExaminees} chaînes d'interface examinées, aucun écart typographique.`,
    )
    console.log(
      'Portée, les littéraux de web/{app,components,lib}, hors fichiers de test.',
    )
    console.log(
      'Limite, une chaîne concaténée à travers deux modules échappe à ce contrôle.',
    )
    return 0
  }

  console.error(`\nÉCHEC — ${ecarts.length} écart(s) typographique(s).`)
  for (const ecart of ecarts) {
    console.error(
      `  ${ecart.fichier}:${ecart.ligne} [${ecart.motif}] ${ecart.aide} — « ${ecart.extrait} »`,
    )
  }
  console.error(
    `\n${fichiersAvecEcart.size} fichier(s) concerné(s) sur ${chainesExaminees} chaînes examinées.`,
  )
  return 1
}

process.exit(await main(process.argv))
