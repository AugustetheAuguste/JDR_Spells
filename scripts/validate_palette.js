#!/usr/bin/env node
/**
 * Validate the ordinal (sequential, single-hue) ramps declared in
 * `web/lib/design/tokens.ts`, in both the day and the night palette.
 *
 * Why this exists as its own script rather than a vitest case: the plan for
 * `13_UI_DONS_LIST` calls it out by name (`node scripts/validate_palette.js
 * --ordinal`), meant to be runnable on its own, outside the test runner, the
 * same way a designer would sanity-check a new step before it ever reaches a
 * component. It reads `tokens.ts` by regex rather than importing it, so this
 * plain Node script needs no TypeScript toolchain to run.
 *
 * `--ordinal` checks the two rules a sequential magnitude ramp must hold that
 * a categorical one (`RAMPE_CATEGORIELLE`) must NOT:
 *   1. monotonic luminance — each step strictly darker (day) / lighter (night)
 *      than the last, so "more" always reads as "further along the ramp";
 *   2. every step clears the 3:1 graphical-object floor (WCAG 1.4.11) against
 *      the surface it sits on, in the palette it belongs to.
 *
 * Without `--ordinal` the script only reports the extracted ramps — a bare
 * sanity check, useful while wiring a new one in.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHEMIN_TOKENS = path.join(RACINE, 'web', 'lib', 'design', 'tokens.ts')

/** WCAG 2.1 relative luminance. */
function luminance(hex) {
  const canal = (paire) => {
    const valeur = Number.parseInt(paire, 16) / 255
    return valeur <= 0.03928 ? valeur / 12.92 : ((valeur + 0.055) / 1.055) ** 2.4
  }
  const brut = hex.replace('#', '')
  const r = canal(brut.slice(0, 2))
  const g = canal(brut.slice(2, 4))
  const b = canal(brut.slice(4, 6))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Pull `export const NOM = [ ... ] as const` (an array of quoted hex strings)
 * out of `tokens.ts`'s source text. */
function extraireRampe(source, nom) {
  const motif = new RegExp(`export const ${nom} = \\[([^\\]]*)\\]`, 'm')
  const trouve = motif.exec(source)
  if (trouve === null) throw new Error(`rampe introuvable dans tokens.ts : ${nom}`)
  return [...trouve[1].matchAll(/#[0-9a-fA-F]{3,8}/g)].map((m) => m[0])
}

function extraireBloc(source, nomConst) {
  const motif = new RegExp(`export const ${nomConst} = \\{([\\s\\S]*?)\\n\\} as const`, 'm')
  const trouve = motif.exec(source)
  if (trouve === null) throw new Error(`bloc introuvable dans tokens.ts : ${nomConst}`)
  return trouve[1]
}

function extraireCouleur(bloc, nom) {
  const motif = new RegExp(`\\b${nom}:\\s*'(#[0-9a-fA-F]{3,8})'`, 'm')
  const trouve = motif.exec(bloc)
  if (trouve === null) throw new Error(`couleur introuvable : ${nom}`)
  return trouve[1]
}

function verifierMonotone(rampe, nomRampe, sensAttendu) {
  const echecs = []
  for (let i = 1; i < rampe.length; i += 1) {
    const precedente = luminance(rampe[i - 1])
    const courante = luminance(rampe[i])
    const ok = sensAttendu === 'descendant' ? courante < precedente : courante > precedente
    if (!ok) {
      echecs.push(
        `${nomRampe}[${i - 1}→${i}] luminance non ${sensAttendu} (${precedente.toFixed(3)} → ${courante.toFixed(3)})`,
      )
    }
  }
  return echecs
}

function verifierPlancherGraphique(rampe, nomRampe, surface) {
  const echecs = []
  rampe.forEach((teinte, i) => {
    const ratio = contraste(teinte, surface)
    if (ratio < 3) {
      echecs.push(`${nomRampe}[${i}] (${teinte}) contraste ${ratio.toFixed(2)}:1 sur ${surface} — sous le plancher 3:1`)
    }
  })
  return echecs
}

function main(argv) {
  const ordinal = argv.includes('--ordinal')
  const source = fs.readFileSync(CHEMIN_TOKENS, 'utf8')

  const rampeJour = extraireRampe(source, 'RAMPE_COUT')
  const rampeNuit = extraireRampe(source, 'RAMPE_COUT_NUIT')
  const surfaceJour = extraireCouleur(extraireBloc(source, 'COULEURS'), 'surface')
  const surfaceNuit = extraireCouleur(extraireBloc(source, 'COULEURS_NUIT'), 'surface')

  console.log(`RAMPE_COUT (jour)  : ${rampeJour.join(' ')}`)
  console.log(`RAMPE_COUT_NUIT    : ${rampeNuit.join(' ')}`)

  if (!ordinal) {
    console.log('\n(--ordinal non demandé : extraction seule, aucune règle vérifiée.)')
    return 0
  }

  const echecs = [
    // Day: step 1 lightest, step 5 darkest — luminance strictly descending.
    ...verifierMonotone(rampeJour, 'RAMPE_COUT', 'descendant'),
    // Night: re-anchored so the ramp still reads "least→most" against a dark
    // background, by getting LIGHTER as the step advances — see tokens.ts.
    ...verifierMonotone(rampeNuit, 'RAMPE_COUT_NUIT', 'ascendant'),
    ...verifierPlancherGraphique(rampeJour, 'RAMPE_COUT', surfaceJour),
    ...verifierPlancherGraphique(rampeNuit, 'RAMPE_COUT_NUIT', surfaceNuit),
  ]

  if (echecs.length > 0) {
    console.error(`\nÉCHEC — rampe ordinale invalide :`)
    for (const message of echecs) console.error(`  - ${message}`)
    return 1
  }

  console.log('\nOK — rampe ordinale monotone et lisible (plancher 3:1), jour et nuit.')
  return 0
}

process.exit(main(process.argv.slice(2)))

