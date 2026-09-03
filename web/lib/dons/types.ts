/**
 * Types of the dons eligibility engine's data contract.
 *
 * Mirrors `data/schemas/moteur_dons.schema.json` (and its restricted
 * `web/fixtures/moteur_dons.json`) — the data contract from step 06 — NOT
 * reverse-engineered from `src/pf_dons/engine.py`. Field names stay in the
 * exact snake_case French the JSON uses, so parsing needs no key mapping.
 *
 * `Verdict` is deliberately `true | false | null`, never `boolean |
 * undefined`. `undefined` and `null` collapse into each other too easily
 * through an optional-chain (`?.`) or a `JSON.parse` of an omitted key, and
 * confusing `null` ("indéterminable") with `false` produces a false
 * `ineligible` — the exact failure mode this whole repository exists to
 * prevent. See `moteur.ts`'s module doc for the full tri-state rule set.
 */

export type Verdict = true | false | null
export type Statut = 'eligible' | 'manual_check' | 'ineligible'

/** The 13 `RequirementType` values from `src/pf_dons/models.py`. */
export type TypeExigence =
  | 'ability_score'
  | 'bba'
  | 'level'
  | 'level_exact'
  | 'class_level'
  | 'skill_ranks'
  | 'caster_level'
  | 'size'
  | 'feat'
  | 'race'
  | 'class'
  | 'class_feature_text'
  | 'unparsed'

export const TYPES_EXIGENCE: readonly TypeExigence[] = [
  'ability_score',
  'bba',
  'level',
  'level_exact',
  'class_level',
  'skill_ranks',
  'caster_level',
  'size',
  'feat',
  'race',
  'class',
  'class_feature_text',
  'unparsed',
]

/** A gating hit — one line of `data/conditions/prereq_gating.json`, attached
 * to the requirement segment it was found in, with `couvre_tout_le_segment`
 * pre-computed by the step-06 build script (mirrors `engine.py`'s own
 * comparison of `hit.keyword` against the normalized segment text). */
export interface HitGating {
  readonly kind: string
  readonly param: unknown
  readonly blocking: boolean
  readonly keyword: string
  readonly couvre_tout_le_segment: boolean
}

/** The free-form payload of a requirement. Shape depends on `type`; callers
 * narrow it themselves (via the typed getters in `moteur.ts`) rather than
 * casting, so this stays a `Record` and never an `any`. */
export type ChargeExigence = Readonly<Record<string, unknown>>

export interface Exigence {
  readonly type: TypeExigence
  readonly charge: ChargeExigence
  readonly verif_manuelle: boolean
  readonly segment: string
}

/** An OR-group: satisfied if any option is satisfied. Carries no `type` of
 * its own in the contract — its presence is signalled by `options`. */
export interface GroupeOu {
  readonly options: readonly Exigence[]
}

export type ExigenceOuGroupe = Exigence | GroupeOu

export function estGroupeOu(item: ExigenceOuGroupe): item is GroupeOu {
  return 'options' in item
}

export interface DonConditions {
  readonly brut: string
  readonly effectif: string
  readonly exigences: readonly ExigenceOuGroupe[]
}

export interface InfoLanceur {
  readonly is_caster: boolean
  readonly confidence?: string
  readonly source?: string
  readonly type?: string
}

export interface InfoMaitrise {
  readonly armes_martiales: boolean
  readonly armes_simples: boolean
  readonly armes_specifiques: readonly string[]
  readonly boucliers: boolean
}

export interface InfoMagieDon {
  readonly is_magic: boolean
  readonly matched_keywords: readonly string[]
  readonly needs_manual_check: boolean
}

export interface InfoAffiniteCreature {
  readonly creature_keywords: readonly string[]
  readonly matched_text?: string
  readonly needs_manual_check: boolean
}

export interface InfoRestrictionClasse {
  readonly classes: readonly string[]
  readonly evidence: string
  readonly confidence?: string
  readonly reason?: string | null
}

export interface InfoRace {
  readonly taille: string | null
  readonly texte_traits: string
  readonly magie_innee: boolean
}

export type Progression = 'good' | 'medium' | 'poor'

/** Every table `moteur.ts` needs to evaluate a requirement, bundled so call
 * sites never have to import the raw contract file piecemeal. All of it is
 * data published by step 06 (`data/schemas/moteur_dons.schema.json` /
 * `web/fixtures/moteur_dons.json`) — never recomputed or duplicated here. */
export interface TablesMoteur {
  readonly lanceurs: Readonly<Record<string, InfoLanceur>>
  readonly maitrises: Readonly<Record<string, InfoMaitrise>>
  readonly magie_des_dons: Readonly<Record<string, InfoMagieDon>>
  readonly affinite_creature: Readonly<Record<string, InfoAffiniteCreature>>
  readonly restriction_de_classe: Readonly<Record<string, InfoRestrictionClasse>>
  readonly races: Readonly<Record<string, InfoRace>>
  readonly armes_raciales: Readonly<Record<string, readonly string[]>>
  readonly reclassement_racial: Readonly<Record<string, string>>
  readonly progression_bba: Readonly<Record<string, Progression>>
}

/** The character to evaluate against, mirroring `engine.py::Character`.
 * Optional fields absent (not `undefined`-but-present) is what makes a
 * requirement `null` instead of guessing. */
export interface Personnage {
  readonly classe: string
  readonly niveau: number
  readonly race?: string
  readonly taille?: string
  readonly caracteristiques?: Readonly<Record<string, number>>
  /** `undefined` = "dons connus non fournis" (-> null) ; un `Set` vide =
   * "aucun don connu" (-> false pour un prérequis de don). Ne jamais
   * confondre les deux, voir `calculerVagues` dans `graphe.ts`. */
  readonly dons_connus?: ReadonlySet<string>
  readonly rangs_competence?: Readonly<Record<string, number>>
  readonly alignement?: string
  readonly divinite?: string
}

export interface ResultatEligibilite {
  readonly nom_don: string
  readonly statut: Statut
  readonly motifs: readonly string[]
}

/** One `verdicts.jsonl` record — the frozen contract from step 02
 * (`scripts/comparer_verdicts.ts`). Never omit a key. */
export interface LigneVerdict {
  readonly cle_personnage: string
  readonly nom_don: string
  readonly statut: Statut
  readonly motifs: readonly string[]
}
