/**
 * Verify the engine data contract (Wave 06) against the verification
 * criteria of `build/fusion-dons-sorts/06_ENGINE_DATA_CONTRACT.md`.
 *
 * This is deliberately NOT a schema validator (there is no JSON Schema for
 * `moteur_dons.schema.json` — the file IS the frozen data, not a meta-schema
 * describing it, per the plan's own naming). What this script checks instead
 * is the set of structural invariants the plan calls out explicitly, each
 * one traceable to a concrete regression this contract exists to prevent:
 *
 *   - the 13 `RequirementType`s are all represented, and each has a
 *     documented `None` semantics in `semantique_none` — losing one silently
 *     degrades a whole category of feats to `manual_check` with no visible
 *     signal, until a "count 13, fail at 12" test like this one exists.
 *   - the `proficiency` blocking/non-blocking split IS the real
 *     `gating.entries[].blocking` field (not invented), and both a blocking
 *     and a non-blocking case are present in the fixture — otherwise the
 *     evaluator has no way to avoid treating "l'arme choisie" (a player
 *     choice) the same as "maniement du cimeterre" (a named weapon).
 *   - `brut` and `effectif` are both present and differ for at least one
 *     fixture feat — conflating them is exactly the bug `feat_prereq_supplements`
 *     was built to fix in the Python engine; the TS evaluator must not
 *     reintroduce it.
 *   - the fixture's feat slugs equal `web/fixtures/index_dons.json`'s slugs,
 *     OR that assertion is a documented, explicit skip (Wave 05 not merged
 *     yet at the time this ran).
 *   - zero regex-looking literals in the schema or fixture: the parser's
 *     337 lines of French regex are never ported, only their output is
 *     published as data.
 *
 * Usage: tsx scripts/check_moteur_contract_dons.ts [chemin/vers/fixture.json]
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHEMIN_SCHEMA = resolve(RACINE, 'data/schemas/moteur_dons.schema.json')
const CHEMIN_DEFAUT = resolve(RACINE, 'web/fixtures/moteur_dons.json')
const CHEMIN_INDEX_DONS = resolve(RACINE, 'web/fixtures/index_dons.json')

// Les 13 RequirementType de src/pf_dons/models.py — recopiés ici comme
// constante de contrôle, pas comme règle d'évaluation : ce script ne fait
// que compter, il ne réévalue rien.
const LES_13_TYPES = [
  'ability_score', 'bba', 'level', 'level_exact', 'class_level', 'skill_ranks',
  'caster_level', 'size', 'feat', 'race', 'class', 'class_feature_text', 'unparsed',
] as const

const LES_9_GENRES_BLOQUANTS = [
  'racial_trait', 'creature_type', 'anatomy', 'spellcasting', 'deity',
  'alignment', 'mythic', 'class_ability', 'no_class_levels',
] as const

const LES_6_GENRES_NON_BLOQUANTS = [
  'class_ability_unmapped', 'proficiency', 'feat', 'background', 'fragment', 'generic',
] as const

interface Exigence {
  readonly type: string
  readonly charge: Readonly<Record<string, unknown>>
  readonly verif_manuelle: boolean
  readonly segment: string
}

interface GroupeOu {
  readonly options: readonly Exigence[]
}

type ExigenceOuGroupe = Exigence | GroupeOu

function estGroupe(item: ExigenceOuGroupe): item is GroupeOu {
  return 'options' in item
}

interface GatingHit {
  readonly keyword: string
  readonly kind: string
  readonly param: unknown
  readonly blocking: boolean
  readonly couvre_tout_le_segment?: boolean
}

interface Condition {
  readonly brut: string
  readonly effectif: string
  readonly exigences: readonly ExigenceOuGroupe[]
}

interface Fixture {
  readonly version: number
  readonly genere_le: string
  readonly conditions: Readonly<Record<string, Condition>>
  readonly aretes: readonly { readonly de: string; readonly vers: string }[]
  readonly prerequis_dons: Readonly<Record<string, readonly (readonly string[])[]>>
  readonly gating: { readonly entries: readonly GatingHit[] }
  readonly maitrises: Readonly<Record<string, unknown>>
  readonly lanceurs: Readonly<Record<string, unknown>>
  readonly semantique_none: Readonly<Record<string, string>>
  readonly genres_bloquants: readonly string[]
  readonly genres_non_bloquants: readonly string[]
  readonly armes_raciales: Readonly<Record<string, readonly string[]>>
  readonly reclassement_racial: Readonly<Record<string, string>>
}

const echecs: string[] = []
function echec(message: string): void {
  echecs.push(message)
}

function toutesLesExigences(fixture: Fixture): readonly Exigence[] {
  const plat: Exigence[] = []
  for (const condition of Object.values(fixture.conditions)) {
    for (const item of condition.exigences) {
      if (estGroupe(item)) plat.push(...item.options)
      else plat.push(item)
    }
  }
  return plat
}

function toutesLesGatingHits(exigences: readonly Exigence[]): readonly GatingHit[] {
  const hits: GatingHit[] = []
  for (const ex of exigences) {
    const gating = ex.charge.gating as readonly GatingHit[] | undefined
    if (gating) hits.push(...gating)
  }
  return hits
}

/** Critère 2 : les 13 RequirementType sont tous représentés, chacun avec sa
 *  sémantique de None documentée dans `semantique_none`. */
function verifierLes13Types(fixture: Fixture, exigences: readonly Exigence[]): void {
  const vus = new Set(exigences.map((e) => e.type))
  const manquants = LES_13_TYPES.filter((t) => !vus.has(t))
  if (manquants.length > 0) {
    echec(
      `types de prérequis absents de la fixture (${vus.size}/13 vus) : ${manquants.join(', ')}`,
    )
  } else if (vus.size !== LES_13_TYPES.length) {
    echec(`${vus.size} types vus, 13 attendus — types inconnus non listés : ` +
      `${[...vus].filter((t) => !(LES_13_TYPES as readonly string[]).includes(t)).join(', ')}`)
  }

  const docSemantique = fixture.semantique_none ?? {}
  const nonDocumentes = LES_13_TYPES.filter((t) => !(t in docSemantique))
  if (nonDocumentes.length > 0) {
    echec(`semantique_none ne documente pas : ${nonDocumentes.join(', ')}`)
  }
}

/** Critère 3 : les 9 genres bloquants et 6 non bloquants sont énumérés, et
 *  proficiency distingue bloquant (arme nommée) / non bloquant (choix joueur)
 *  via le champ réel `gating.entries[].blocking`. */
function verifierGenresEtProficiency(fixture: Fixture, exigences: readonly Exigence[]): void {
  const bloquants = new Set(fixture.genres_bloquants ?? [])
  const nonBloquants = new Set(fixture.genres_non_bloquants ?? [])
  const manqBloq = LES_9_GENRES_BLOQUANTS.filter((g) => !bloquants.has(g))
  const manqNonBloq = LES_6_GENRES_NON_BLOQUANTS.filter((g) => !nonBloquants.has(g))
  if (manqBloq.length > 0) echec(`genres_bloquants incomplet : manque ${manqBloq.join(', ')}`)
  if (manqNonBloq.length > 0) echec(`genres_non_bloquants incomplet : manque ${manqNonBloq.join(', ')}`)
  if (bloquants.size !== 9) echec(`genres_bloquants doit compter 9 entrées, en compte ${bloquants.size}`)
  if (nonBloquants.size !== 6) echec(`genres_non_bloquants doit compter 6 entrées, en compte ${nonBloquants.size}`)

  const hits = toutesLesGatingHits(exigences)
  const proficiencyHits = hits.filter((h) => h.kind === 'proficiency')
  const bloquant = proficiencyHits.some((h) => h.blocking === true)
  const nonBloquant = proficiencyHits.some((h) => h.blocking === false)
  if (!bloquant) {
    echec(
      'aucun hit gating.kind=proficiency avec blocking=true dans la fixture ' +
        '(cas "arme nommée", ex. maniement du cimeterre)',
    )
  }
  if (!nonBloquant) {
    echec(
      'aucun hit gating.kind=proficiency avec blocking=false dans la fixture ' +
        '(cas "choix du joueur", ex. maniement de l\'arme choisie)',
    )
  }
}

/** Critère 4 : couvre chaque cas structurel demandé. */
function verifierCasCouverts(fixture: Fixture, exigences: readonly Exigence[]): void {
  const auMoinsUnGroupe = Object.values(fixture.conditions).some((c) =>
    c.exigences.some((item) => estGroupe(item)),
  )
  if (!auMoinsUnGroupe) echec('aucun GroupeOu (OrGroup) dans la fixture')

  const auMoinsUnFragment = exigences.some((e) => e.charge.fragment === true)
  if (!auMoinsUnFragment) echec('aucun payload.fragment=true dans la fixture')

  const auMoinsUnImplied = exigences.some(
    (e) => Array.isArray(e.charge.implied_classes) && (e.charge.implied_classes as unknown[]).length > 0,
  )
  if (!auMoinsUnImplied) echec('aucun payload.implied_classes dans la fixture')

  const hits = toutesLesGatingHits(exigences)
  const auMoinsUnNoClassLevels = hits.some((h) => h.kind === 'no_class_levels')
  if (!auMoinsUnNoClassLevels) echec('aucun hit gating.kind=no_class_levels dans la fixture')

  const auMoinsUnCouvreBloquantSatisfaisable = hits.some(
    (h) => h.couvre_tout_le_segment === true && h.blocking === true,
  )
  if (!auMoinsUnCouvreBloquantSatisfaisable) {
    echec('aucun hit couvre_tout_le_segment=true ET blocking=true (le cas qui rend l\'exigence True)')
  }

  // "classe absente de maitrises" (cas chasseur de vampire) : une propriété
  // de la table, pas d'un don précis — il suffit que la classe reste
  // absente, jamais présente avec des listes vides (qui, elles, vaudraient
  // "aucune maîtrise", donc ineligible à tort au lieu de manual_check).
  if ('chasseur de vampire' in fixture.maitrises) {
    echec(
      '"chasseur de vampire" est présente dans maitrises — elle doit rester ' +
        "absente (classe inconnue = manual_check, jamais 'aucune maîtrise')",
    )
  }

  const auMoinsUnCasterLevel = exigences.some((e) => e.type === 'caster_level')
  if (!auMoinsUnCasterLevel) echec('aucun don de type caster_level dans la fixture')
}

/** Critère 5 : brut != effectif pour au moins un don, et les deux champs
 *  sont toujours présents (jamais confondus). */
function verifierBrutEffectif(fixture: Fixture): void {
  let auMoinsUnDiff = false
  const sansLesDeux: string[] = []
  for (const [slug, condition] of Object.entries(fixture.conditions)) {
    if (typeof condition.brut !== 'string' || typeof condition.effectif !== 'string') {
      sansLesDeux.push(slug)
      continue
    }
    if (condition.brut !== condition.effectif) auMoinsUnDiff = true
  }
  if (sansLesDeux.length > 0) {
    echec(`donnent ne portent pas brut ET effectif comme chaînes : ${sansLesDeux.join(', ')}`)
  }
  if (!auMoinsUnDiff) {
    echec(
      'aucun don de la fixture n\'a brut != effectif — feat_prereq_supplements ' +
        'ne semble pas exercé (ex. attendu : arme-de-predilection-superieure)',
    )
  }
}

/** Critère 6 : jointure par slug avec l'index de l'étape 05, ou skip documenté. */
function verifierJointureIndexDons(fixture: Fixture): void {
  if (!existsSync(CHEMIN_INDEX_DONS)) {
    console.log(
      `SKIP : ${relative(RACINE, CHEMIN_INDEX_DONS)} absent (étape 05 non encore ` +
        'fusionnée dans cette branche) — jointure par slug non vérifiée. ' +
        'À activer dès la fusion de la vague 05 : comparer les Object.keys ' +
        'de `fixture.conditions` à ceux de `index_dons.json`.',
    )
    return
  }
  const indexDons = JSON.parse(readFileSync(CHEMIN_INDEX_DONS, 'utf8')) as {
    readonly dons?: readonly { readonly slug: string }[]
  }
  const slugsIndex = new Set((indexDons.dons ?? []).map((d) => d.slug))
  const slugsFixture = new Set(Object.keys(fixture.conditions))
  const manquantsDansFixture = [...slugsIndex].filter((s) => !slugsFixture.has(s))
  const enTropDansFixture = [...slugsFixture].filter((s) => !slugsIndex.has(s))
  if (manquantsDansFixture.length > 0 || enTropDansFixture.length > 0) {
    echec(
      `slugs de moteur_dons.json != slugs de index_dons.json ` +
        `(manquants: ${manquantsDansFixture.join(', ') || 'aucun'} ; ` +
        `en trop: ${enTropDansFixture.join(', ') || 'aucun'})`,
    )
  }
}

/** Critère 7 : aucune regex n'apparaît dans le schéma ni la fixture. */
function verifierAucuneRegex(chemin: string, brut: string, nom: string): void {
  const doubleBackslash = (brut.match(/\\\\/g) ?? []).length
  const nonCapturant = (brut.match(/\(\?:/g) ?? []).length
  if (doubleBackslash > 0) {
    echec(`${nom} (${relative(RACINE, chemin)}) contient ${doubleBackslash} occurrence(s) de '\\\\\\\\' (metacaractère regex échappé)`)
  }
  if (nonCapturant > 0) {
    echec(`${nom} (${relative(RACINE, chemin)}) contient ${nonCapturant} occurrence(s) de '(?:' (groupe non capturant)`)
  }
}

function main(argv: readonly string[]): number {
  const argument = argv[2]
  const cheminFixture = argument === undefined ? CHEMIN_DEFAUT : resolve(process.cwd(), argument)

  let brutFixture: string
  let brutSchema: string
  try {
    brutFixture = readFileSync(cheminFixture, 'utf8')
    brutSchema = readFileSync(CHEMIN_SCHEMA, 'utf8')
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur)
    console.error(`ÉCHEC : fichier illisible — ${detail}`)
    return 1
  }

  let fixture: Fixture
  try {
    fixture = JSON.parse(brutFixture) as Fixture
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur)
    console.error(`ÉCHEC : JSON invalide (fixture) — ${detail}`)
    return 1
  }

  verifierAucuneRegex(CHEMIN_SCHEMA, brutSchema, 'schéma')
  verifierAucuneRegex(cheminFixture, brutFixture, 'fixture')

  const exigences = toutesLesExigences(fixture)

  verifierLes13Types(fixture, exigences)
  verifierGenresEtProficiency(fixture, exigences)
  verifierCasCouverts(fixture, exigences)
  verifierBrutEffectif(fixture)
  verifierJointureIndexDons(fixture)

  console.log(`fixture     : ${relative(RACINE, cheminFixture).replaceAll('\\', '/')}`)
  console.log(`dons        : ${Object.keys(fixture.conditions).length}`)
  console.log(`exigences   : ${exigences.length}`)
  console.log(`arêtes      : ${fixture.aretes.length}`)

  if (echecs.length > 0) {
    console.error(`\nÉCHEC — ${echecs.length} contrôle(s) en défaut :`)
    for (const message of echecs) console.error(`  - ${message}`)
    return 1
  }

  console.log('\nOK — contrat du moteur (Wave 06) respecté.')
  return 0
}

process.exit(main(process.argv))
