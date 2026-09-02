/**
 * Tri-state feat-eligibility evaluator, ported function-for-function from
 * `src/pf_dons/engine.py` (621 lines) — same order, same French names.
 *
 * `parser.py` (337 lines of French-regex condition parsing) is NOT ported:
 * this module consumes conditions already parsed into `Exigence`/`GroupeOu`
 * by the step-06 data contract (`web/fixtures/moteur_dons.json` /
 * `data/schemas/moteur_dons.schema.json`). `engine.py` itself contains
 * exactly one regex (a deity-prefix strip) against 621 lines of dictionary
 * lookups, substring search and tri-state logic — that ratio is what makes
 * the evaluator portable and the parser not worth porting.
 *
 * THE TRI-STATE RULE — the one thing every function here must get right:
 *
 *   `Verdict` is `true` (satisfied), `false` (not satisfied) or `null`
 *   ("indéterminable" — cannot be decided with the data at hand).
 *   `null` NEVER means "false". Treating an indeterminate requirement as
 *   failed produces a false `ineligible`, which hides a feat from a player
 *   with no recourse — the single failure mode this whole repository (and
 *   its sibling `pf1_dons`) exists to prevent. A missing ability score, an
 *   unknown class, an unmodeled caster level: all `null`, never `false`.
 *
 *   - `evaluerGroupeOu`: satisfied if any option is `true`; else `null` if
 *     any option is `null`; else `false`. Fragment options (splitting
 *     artefacts like "… ou familier") are dropped first, UNLESS every
 *     option is a fragment (then keeping them is the only information
 *     left).
 *   - `evaluerDon` short-circuits to `ineligible` on the FIRST `false`
 *     requirement; otherwise it accumulates every `null` reason and returns
 *     `manual_check` if there is at least one, else `eligible`.
 *   - A gating hit whose `couvre_tout_le_segment` is `true` AND whose
 *     verdict is satisfied makes the WHOLE requirement `true` instead of
 *     falling through to `manual_check` — but only if the hit is also
 *     `blocking`.
 *   - A `false` gating hit short-circuits the entire requirement; pending
 *     (`null`) reasons always outrank satisfied (`true`) ones otherwise.
 */

import type {
  ChargeExigence,
  DonConditions,
  Exigence,
  GroupeOu,
  HitGating,
  Personnage,
  ResultatEligibilite,
  Statut,
  TablesMoteur,
  Verdict,
} from './types.js'
import { estGroupeOu } from './types'

// ---------------------------------------------------------------------------
// _normalize
// ---------------------------------------------------------------------------

/** NFKD-fold, strip combining marks, lowercase, trim. The one normalization
 * every string comparison in this module goes through — a divergent
 * normalization here silently fails a prerequisite join (a feat name, a
 * class name, a gating keyword) rather than raising. */
export function normaliser(texte: string): string {
  const decompose = texte.normalize('NFKD')
  let sansAccents = ''
  for (const caractere of decompose) {
    // Combining marks are U+0300–U+036F; the Python original strips every
    // Unicode "Mn" category character, which is exactly this block for the
    // French text this repository ever normalizes.
    const point = caractere.codePointAt(0) ?? 0
    if (point >= 0x0300 && point <= 0x036f) continue
    sansAccents += caractere
  }
  return sansAccents.toLowerCase().trim()
}

/** `name.strip().rstrip('*').strip()` — drops the repeatable-feat marker a
 * catalog name carries, mirroring `data_loader.py::clean_feat_name`. */
export function nettoyerNomDon(nom: string): string {
  return nom.trim().replace(/\*+$/, '').trim()
}

// ---------------------------------------------------------------------------
// Ordering table for SIZE requirements
// ---------------------------------------------------------------------------

const ORDRE_TAILLES = ['TP', 'P', 'M', 'G', 'TG', 'C']

// ---------------------------------------------------------------------------
// class_grants_magic / race_grants_magic / creature_affinity_allows
// ---------------------------------------------------------------------------

/** `null` = classe inconnue de `lanceurs` -> ne jamais deviner. */
export function classeLanceSorts(classe: string, tables: TablesMoteur): boolean | null {
  const entree = tables.lanceurs[normaliser(classe)]
  if (entree === undefined) return null
  return entree.is_caster
}

/** Conservateur : race absente/inconnue -> `false`, jamais une échappatoire. */
export function raceAccordeMagie(race: string | undefined, tables: TablesMoteur): boolean {
  if (race === undefined) return false
  const entree = tables.races[normaliser(race)]
  if (entree === undefined) return false
  return entree.magie_innee
}

/** Un don marqué « plus courant chez les X » n'a de sens que pour la
 * race/créature X — comportement conservateur si la race est absente ou
 * inconnue, symétrique à `raceAccordeMagie`. */
export function affiniteCreatureAutorise(
  race: string | undefined,
  motsClesCreature: readonly string[],
): boolean {
  const raceNorm = race ? normaliser(race) : ''
  for (const motCle of motsClesCreature) {
    const motCleNorm = normaliser(motCle).replace(/s+$/, '')
    const raceSansS = raceNorm.replace(/s+$/, '')
    if (raceNorm && (motCleNorm.includes(raceSansS) || raceSansS.includes(motCleNorm))) {
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// _proficiency_verdict
// ---------------------------------------------------------------------------

function estChaine(valeur: unknown): valeur is string {
  return typeof valeur === 'string'
}

/** Résout un prérequis « maniement de X » nommé contre `maitrises` et les
 * maîtrises raciales publiées dans `armes_raciales`/`reclassement_racial` —
 * lues depuis les données du contrat, jamais recopiées en dur ici. Sans le
 * mécanisme de reclassement, un Guerrier nain était refusé à tort sur
 * « Frappe de la vipère jaillissante » (arme naine traitée comme exotique
 * au lieu de martiale). */
export function verdictMaitrise(
  param: unknown,
  perso: Personnage,
  keyword: string,
  tables: TablesMoteur,
): readonly [Verdict, string] {
  const entree = tables.maitrises[normaliser(perso.classe)]
  const raceNorm = perso.race ? normaliser(perso.race) : undefined
  const p = (param ?? {}) as ChargeExigence

  if (estChaine(p['bouclier'])) {
    const bouclier = p['bouclier']
    const label = `maniement du bouclier (${keyword})`
    if (entree !== undefined) {
      if (entree.boucliers) {
        return [true, `${label} : ${perso.classe} a la maîtrise des boucliers`]
      }
      if (bouclier === 'targe' && entree.armes_specifiques.includes('targe')) {
        return [true, `${label} : ${perso.classe} est formé à la targe`]
      }
      return [false, `${label} ; ${perso.classe} n'a pas cette maîtrise`]
    }
    return [null, `${label} ; classe ${perso.classe} inconnue des maîtrises de classe`]
  }

  const arme = estChaine(p['arme']) ? p['arme'] : ''
  const categorie = estChaine(p['categorie']) ? p['categorie'] : ''
  const label = `maniement de ${arme} (${keyword})`

  if (entree !== undefined) {
    if (categorie === 'simple' && entree.armes_simples) {
      return [true, `${label} : ${perso.classe} a toutes les armes simples`]
    }
    if (categorie === 'martiale' && entree.armes_martiales) {
      return [true, `${label} : ${perso.classe} a toutes les armes martiales`]
    }
    if (entree.armes_specifiques.includes(arme)) {
      return [true, `${label} : accordée nommément à ${perso.classe}`]
    }
  }

  if (raceNorm !== undefined) {
    const armesRace = tables.armes_raciales[raceNorm] ?? []
    if (armesRace.includes(arme)) {
      return [true, `${label} : arme familière de la race ${perso.race}`]
    }
    const marqueur = tables.reclassement_racial[raceNorm]
    if (marqueur !== undefined && arme.includes(marqueur) && entree !== undefined && entree.armes_martiales) {
      return [
        true,
        `${label} : la race ${perso.race} la traite comme une arme de guerre, et ` +
          `${perso.classe} a les armes martiales`,
      ]
    }
  }

  if (entree !== undefined) {
    return [
      false,
      `${label} ; ni la classe ${perso.classe} ni la race ${perso.race ?? 'non fournie'} ne l'accordent`,
    ]
  }
  return [null, `${label} ; classe ${perso.classe} inconnue des maîtrises de classe`]
}

// ---------------------------------------------------------------------------
// magie_inaccessible
// ---------------------------------------------------------------------------

/** Volontairement conservateur : `true` seulement si la classe est connue ET
 * explicitement non-lanceuse ET que la race ne donne pas accès à la magie.
 * Une classe absente de `lanceurs` -> jamais deviné, cette fonction renvoie
 * alors `false` ("inaccessible" n'est PAS prouvé), ce qui laisse le
 * requirement retomber sur `null` ailleurs. */
export function magieInaccessible(perso: Personnage, tables: TablesMoteur): boolean {
  return classeLanceSorts(perso.classe, tables) === false && !raceAccordeMagie(perso.race, tables)
}

// ---------------------------------------------------------------------------
// _gating_verdict
// ---------------------------------------------------------------------------

// Long, unambiguous phrases only — a short synonym like "langue" would
// false-positive match the universal "Langues" racial trait every race has.
// Recopié littéralement depuis engine.py ; ne pas raccourcir.
const SYNONYMES_ANATOMIE: Readonly<Record<string, readonly string[]>> = {
  'attaque de morsure': ['attaque de morsure', 'arme naturelle (morsure)', 'morsure ('],
  'arme naturelle': ['arme naturelle', 'armes naturelles'],
  'attaques naturelles multiples': ['armes naturelles', 'attaques naturelles'],
  griffes: ['griffes du felin', 'arme naturelle (griffes)', 'griffes ('],
  'armure naturelle': ['armure naturelle'],
  'vitesse de vol': ['vitesse de vol', 'vol a la vitesse', 'peut voler'],
  'vitesse de nage': ['vitesse de nage', 'vitesse de deplacement a la nage'],
  'vision dans le noir': ['vision dans le noir'],
  'reduction de degats': ['reduction de degats'],
  queue: ['queue prehensile', 'arme naturelle (queue)'],
  'langue gluante': ['langue gluante'],
  'trois mains': ['trois mains'],
  'morphologie bipede': ['bipede'],
  regeneration: ['regeneration'],
  'retenir son souffle': ['retenir son souffle'],
  'attaque speciale': ['attaque speciale'],
}

// « suivant de X » / « suivant d'X » / « suivant du X » -> X
const PREFIXE_DIVINITE_RE = /^suivant\s+(?:de\s+la\s+|de\s+l'|de\s+|du\s+|des\s+|d')/

function estArray(valeur: unknown): valeur is readonly string[] {
  return Array.isArray(valeur)
}

export function verdictGating(
  hit: HitGating,
  perso: Personnage,
  tables: TablesMoteur,
): readonly [Verdict, string] {
  const { kind, param, keyword } = hit

  if (kind === 'spellcasting') {
    if (magieInaccessible(perso, tables)) {
      return [
        false,
        `prérequis d'incantation (${keyword}) ; ni la classe ${perso.classe} ni la race ` +
          `${perso.race ?? 'non fournie'} ne donnent accès à la magie`,
      ]
    }
    return [null, `prérequis d'incantation à vérifier : ${keyword}`]
  }

  if (kind === 'class_ability') {
    const classes = estArray(param) ? param : []
    if (classes.includes(normaliser(perso.classe))) {
      return [null, `capacité de classe à vérifier (${keyword})`]
    }
    return [
      false,
      `capacité de classe « ${keyword} » réservée à ${classes.join('/')} ; ${perso.classe} n'y a pas accès`,
    ]
  }

  if (kind === 'no_class_levels') {
    // `param` lists the EXCLUDED classes — treating this like
    // `implied_classes` would invert the rule ("aucun niveau dans une
    // classe dotée de panache" would come to REQUIRE being a bretteur).
    const classes = estArray(param) ? param : []
    if (classes.includes(normaliser(perso.classe))) {
      return [false, `${keyword} : ${perso.classe} est justement une de ces classes`]
    }
    return [true, `${keyword} : ${perso.classe} n'en fait pas partie`]
  }

  if (kind === 'mythic') {
    return [true, 'personnage non-mythique (les niveaux mythiques ne sont pas modélisés)']
  }

  if (kind === 'racial_trait' || kind === 'creature_type' || kind === 'anatomy') {
    const infoRace = perso.race ? tables.races[normaliser(perso.race)] : undefined
    if (infoRace === undefined) {
      return [null, `race non fournie ou inconnue (requiert : ${keyword})`]
    }
    const traits = infoRace.texte_traits
    const parametre = estChaine(param) ? param : null
    if (kind === 'creature_type' && parametre !== null && normaliser(perso.race ?? '').includes(normaliser(parametre))) {
      return [true, `race ${perso.race} correspond à ${parametre}`]
    }
    const cibles: readonly string[] =
      kind === 'anatomy'
        ? SYNONYMES_ANATOMIE[parametre ?? ''] ?? [parametre ?? keyword]
        : [parametre ?? keyword]
    if (cibles.some((cible) => normaliser(cible) !== '' && traits.includes(normaliser(cible)))) {
      return [true, `la race ${perso.race} accorde : ${parametre ?? keyword}`]
    }
    const libelle = { racial_trait: 'trait racial', creature_type: 'type/race de créature', anatomy: 'capacité physique innée' }[
      kind
    ]
    return [false, `${libelle} requis « ${parametre ?? keyword} » ; la race ${perso.race} ne l'accorde pas`]
  }

  if (kind === 'proficiency') {
    return verdictMaitrise(param, perso, keyword, tables)
  }

  if (kind === 'alignment') {
    if (perso.alignement === undefined) {
      return [null, `alignement non renseigné (requiert : ${keyword})`]
    }
    const alignement = normaliser(perso.alignement)
    if (param === null || param === undefined) {
      return [null, `contrainte d'alignement à arbitrer : ${keyword}`]
    }
    const cible = normaliser(estChaine(param) ? param : '')
    if (cible.startsWith('non-')) {
      const interdit = cible.slice(4)
      const ok = !alignement.includes(interdit)
      return [ok, `alignement ${perso.alignement} ${ok ? 'compatible' : 'incompatible'} avec ${param}`]
    }
    const ok = cible.split(' ').every((mot) => mot === '' || alignement.includes(mot))
    return [ok, `alignement ${perso.alignement} ${ok ? 'correspond' : 'ne correspond pas'} à ${param}`]
  }

  if (kind === 'deity') {
    if (perso.divinite === undefined) {
      return [null, `divinité non renseignée (requiert : ${keyword})`]
    }
    if (keyword.startsWith('ne venere pas')) {
      return [false, `le personnage vénère ${perso.divinite} ; ${keyword}`]
    }
    const divinite = normaliser(perso.divinite)
    if (keyword.startsWith('suivant de ') || keyword.startsWith("suivant d'") || keyword.startsWith('suivant du ')) {
      // Strip the prefix as a PREFIX, not as a character set — the Python
      // original once used `lstrip` here, which took a set of characters
      // rather than a substring and ate the leading "d" of "Dahak" too.
      const voulu = keyword.replace(PREFIXE_DIVINITE_RE, '').trim()
      const ok = voulu !== '' && (divinite.includes(voulu) || voulu.includes(divinite))
      return [ok, `divinité ${perso.divinite} ${ok ? 'correspond' : 'ne correspond pas'} à « ${voulu} »`]
    }
    return [true, `le personnage vénère ${perso.divinite} (${keyword})`]
  }

  return [null, `à vérifier manuellement (${kind}) : ${keyword}`]
}

// ---------------------------------------------------------------------------
// Character-derived properties (bba, tailleEffective, texteTraitsRaciaux,
// rangCompetence) — engine.py::Character's @property methods.
// ---------------------------------------------------------------------------

function progressionBbaAuNiveau(niveau: number, progression: 'good' | 'medium' | 'poor'): number {
  if (progression === 'good') return niveau
  if (progression === 'medium') return Math.floor((niveau * 3) / 4)
  return Math.floor(niveau / 2)
}

/** Throws on an unknown class, mirroring `get_bba`'s `ValueError` — the
 * Python original never guesses a BBA for a class it cannot place on the
 * good/medium/poor table. */
export function bba(perso: Personnage, tables: TablesMoteur): number {
  const progression = tables.progression_bba[normaliser(perso.classe)]
  if (progression === undefined) {
    throw new Error(`Classe inconnue: ${perso.classe}`)
  }
  return progressionBbaAuNiveau(perso.niveau, progression)
}

/** Taille explicite, sinon celle de la race. */
export function tailleEffective(perso: Personnage, tables: TablesMoteur): string | null {
  if (perso.taille !== undefined) return perso.taille.toUpperCase()
  if (perso.race === undefined) return null
  const entree = tables.races[normaliser(perso.race)]
  return entree?.taille?.toUpperCase() ?? null
}

/** Noms + descriptions des traits raciaux, déjà normalisés par le contrat
 * (`races[x].texte_traits`), ou `null` si la race est inconnue. */
export function texteTraitsRaciaux(perso: Personnage, tables: TablesMoteur): string | null {
  if (perso.race === undefined) return null
  const entree = tables.races[normaliser(perso.race)]
  return entree?.texte_traits ?? null
}

/** Hypothèse optimiste : sans `rangs_competence` explicite, renvoie le
 * niveau (rangs max) — porté tel quel, PAS "corrigé", voir le plan. */
export function rangCompetence(perso: Personnage, competence: string): number | null {
  if (perso.rangs_competence !== undefined) {
    return perso.rangs_competence[competence] ?? null
  }
  return perso.niveau
}

// ---------------------------------------------------------------------------
// evaluate_requirement
// ---------------------------------------------------------------------------

function estNombre(valeur: unknown): valeur is number {
  return typeof valeur === 'number'
}

export function evaluerExigence(exigence: Exigence, perso: Personnage, tables: TablesMoteur): readonly [Verdict, string] {
  const charge = exigence.charge

  if (exigence.type === 'level') {
    const min = estNombre(charge['min']) ? charge['min'] : 0
    const ok = perso.niveau >= min
    return [ok, `niveau ${perso.niveau} ${ok ? '>=' : '<'} ${min} requis`]
  }

  if (exigence.type === 'level_exact') {
    const exact = estNombre(charge['exact']) ? charge['exact'] : 0
    const ok = perso.niveau === exact
    return [ok, `don réservé au niveau ${exact} exactement ; le personnage est niveau ${perso.niveau}`]
  }

  if (exigence.type === 'class_level') {
    const nomClasse = estChaine(charge['class_name']) ? charge['class_name'] : ''
    const min = estNombre(charge['min']) ? charge['min'] : 0
    if (normaliser(perso.classe) !== nomClasse) {
      return [false, `requiert ${nomClasse} niveau ${min} ; ${perso.classe} n'y correspond pas`]
    }
    const ok = perso.niveau >= min
    return [ok, `${nomClasse} niveau ${perso.niveau} ${ok ? '>=' : '<'} ${min} requis`]
  }

  if (exigence.type === 'bba') {
    const min = estNombre(charge['min']) ? charge['min'] : 0
    const valeurBba = bba(perso, tables)
    const ok = valeurBba >= min
    return [ok, `BBA ${valeurBba} ${ok ? '>=' : '<'} ${min} requis`]
  }

  if (exigence.type === 'ability_score') {
    const ability = estChaine(charge['ability']) ? charge['ability'] : ''
    const min = estNombre(charge['min']) ? charge['min'] : 0
    if (perso.caracteristiques === undefined) {
      return [null, `score de caractéristique non fourni (${exigence.segment})`]
    }
    const score = perso.caracteristiques[ability]
    if (score === undefined) {
      return [null, `score de ${ability} non fourni`]
    }
    const ok = score >= min
    return [ok, `${ability} ${score} ${ok ? '>=' : '<'} ${min} requis`]
  }

  if (exigence.type === 'caster_level') {
    const min = estNombre(charge['min']) ? charge['min'] : 0
    if (magieInaccessible(perso, tables)) {
      return [
        false,
        `NLS ${min} requis ; ni la classe ${perso.classe} ni la race ${perso.race ?? 'non fournie'} ` +
          `ne donnent accès à la magie`,
      ]
    }
    return [null, `NLS ${min} requis (valeur non dérivable automatiquement)`]
  }

  if (exigence.type === 'skill_ranks') {
    const skill = estChaine(charge['skill']) ? charge['skill'] : ''
    const ranks = estNombre(charge['ranks']) ? charge['ranks'] : 0
    const rangsPerso = rangCompetence(perso, skill)
    if (rangsPerso === null) {
      return [null, `rangs en ${skill} non fournis`]
    }
    const ok = rangsPerso >= ranks
    return [ok, `${rangsPerso} rangs en ${skill} ${ok ? '>=' : '<'} ${ranks} requis`]
  }

  if (exigence.type === 'feat') {
    const nomDon = estChaine(charge['feat_name']) ? charge['feat_name'] : ''
    if (perso.dons_connus === undefined) {
      return [null, `dons déjà pris non fournis (requiert ${nomDon})`]
    }
    const ok = perso.dons_connus.has(normaliser(nomDon))
    return [ok, `don prérequis ${nomDon} ${ok ? 'possédé' : 'non possédé'}`]
  }

  if (exigence.type === 'size') {
    const taille = estChaine(charge['size']) ? charge['size'] : ''
    const comparateur = estChaine(charge['comparator']) ? charge['comparator'] : 'exact'
    const actuelle = tailleEffective(perso, tables)
    if (actuelle === null) {
      return [null, `taille non fournie (requiert ${taille})`]
    }
    if (!ORDRE_TAILLES.includes(actuelle) || !ORDRE_TAILLES.includes(taille)) {
      return [null, `taille ${perso.taille ?? actuelle} non comparable à ${taille}`]
    }
    const delta = ORDRE_TAILLES.indexOf(actuelle) - ORDRE_TAILLES.indexOf(taille)
    const ok = comparateur === 'min' ? delta >= 0 : comparateur === 'max' ? delta <= 0 : delta === 0
    const label = comparateur === 'min' ? ' ou plus grand' : comparateur === 'max' ? ' ou plus petit' : ''
    return [ok, `taille ${actuelle} ${ok ? 'correspond' : 'ne correspond pas'} à ${taille}${label}`]
  }

  if (exigence.type === 'race') {
    const race = estChaine(charge['race']) ? charge['race'] : ''
    if (perso.race === undefined) {
      return [null, `race non fournie (requiert ${race})`]
    }
    const ok = normaliser(perso.race) === race
    return [ok, `race ${perso.race} ${ok ? 'correspond' : 'ne correspond pas'} à ${race}`]
  }

  if (exigence.type === 'class') {
    const nomClasse = estChaine(charge['class_name']) ? charge['class_name'] : ''
    const ok = normaliser(perso.classe) === nomClasse
    return [ok, `classe ${perso.classe} ${ok ? 'correspond' : 'ne correspond pas'} à ${nomClasse}`]
  }

  // class_feature_text et unparsed : jamais vérifiables automatiquement dans
  // le détail, sauf si `implied_classes` ou `gating` permet de trancher.
  const impliees = charge['implied_classes']
  if (estArray(impliees) && impliees.length > 0) {
    const classeNormalisee = normaliser(perso.classe)
    if (!impliees.includes(classeNormalisee)) {
      return [
        false,
        `nécessite une capacité de classe réservée à ${impliees.join('/')} ; ` +
          `${perso.classe} n'y correspond pas`,
      ]
    }
    // La classe correspond : les détails précis restent à vérifier, on
    // continue vers le gating éventuel plutôt que de renvoyer `true` ici.
  }

  const enAttente: string[] = []
  const satisfaits: string[] = []
  const texte = estChaine(charge['text']) ? charge['text'] : exigence.segment
  const texteNormalise = normaliser(texte)
  const gating = charge['gating']
  const hits: readonly HitGating[] = Array.isArray(gating) ? (gating as readonly HitGating[]) : []
  for (const hit of hits) {
    if (!hit.blocking) continue
    const [ok, motif] = verdictGating(hit, perso, tables)
    if (ok === false) return [false, motif]
    if (ok === null) {
      enAttente.push(motif)
    } else if (hit.keyword === texteNormalise) {
      // Le mot-clé couvre tout le segment : rien d'autre à vérifier.
      satisfaits.push(motif)
    }
  }
  if (enAttente.length > 0) return [null, enAttente.join(' ; ')]
  if (satisfaits.length > 0) return [true, satisfaits[0] as string]

  return [null, `à vérifier manuellement : ${exigence.segment}`]
}

// ---------------------------------------------------------------------------
// evaluate_or_group
// ---------------------------------------------------------------------------

function estFragment(exigence: Exigence): boolean {
  return exigence.charge['fragment'] === true
}

function texteGroupe(groupe: GroupeOu): string {
  return groupe.options.map((o) => o.segment).join(' ou ')
}

export function evaluerGroupeOu(groupe: GroupeOu, perso: Personnage, tables: TablesMoteur): readonly [Verdict, string] {
  const sansFragments = groupe.options.filter((o) => !estFragment(o))
  const options = sansFragments.length > 0 ? sansFragments : groupe.options
  const resultats = options.map((o) => evaluerExigence(o, perso, tables))
  const texte = texteGroupe(groupe)

  if (resultats.some(([ok]) => ok === true)) {
    return [true, `condition OU satisfaite parmi : ${texte}`]
  }
  if (resultats.some(([ok]) => ok === null)) {
    return [null, `condition OU à vérifier manuellement : ${texte}`]
  }
  return [false, `aucune option satisfaite parmi : ${texte}`]
}

// ---------------------------------------------------------------------------
// evaluate_feat
// ---------------------------------------------------------------------------

function aUneExigenceDeRaceExplicite(don: DonConditions): boolean {
  return don.exigences.some((item) => {
    if (estGroupeOu(item)) return item.options.some((o) => o.type === 'race')
    return item.type === 'race'
  })
}

/** Évalue un don pour un personnage. `nomDon` est le nom exact du catalogue
 * (utilisé pour indexer `magie_des_dons`/`affinite_creature`/
 * `restriction_de_classe`, qui sont indexées par nom, pas par slug). */
export function evaluerDon(
  nomDon: string,
  don: DonConditions,
  perso: Personnage,
  tables: TablesMoteur,
): ResultatEligibilite {
  const motifsManuel: string[] = []

  for (const item of don.exigences) {
    const [ok, motif] = estGroupeOu(item) ? evaluerGroupeOu(item, perso, tables) : evaluerExigence(item, perso, tables)

    if (ok === false) {
      // Court-circuit : la seconde exigence n'est jamais évaluée après un
      // `false` — c'est ce qu'un espion de test vérifie explicitement.
      return { nom_don: nomDon, statut: 'ineligible', motifs: [motif] }
    }
    if (ok === null) {
      motifsManuel.push(motif)
    }
  }

  const statut: Statut = motifsManuel.length > 0 ? 'manual_check' : 'eligible'
  const aExigenceRace = aUneExigenceDeRaceExplicite(don)

  const infoMagie = tables.magie_des_dons[nomDon]
  if (aExigenceRace === false && infoMagie !== undefined && infoMagie.is_magic && !infoMagie.needs_manual_check) {
    const classeOk = classeLanceSorts(perso.classe, tables)
    if (classeOk === false && !raceAccordeMagie(perso.race, tables)) {
      const motsCles = infoMagie.matched_keywords.join(', ')
      return {
        nom_don: nomDon,
        statut: 'ineligible',
        motifs: [
          `don magique (${motsCles}) ; ni la classe ${perso.classe} ni la race ` +
            `${perso.race ?? 'non fournie'} ne donnent accès à la magie`,
        ],
      }
      // classeOk === null (classe inconnue) -> ne pas overrider, garder le
      // statut déjà calculé par la boucle d'exigences.
    }
  }

  const restriction = tables.restriction_de_classe[nomDon]
  if (restriction !== undefined && !restriction.classes.includes(normaliser(perso.classe))) {
    return {
      nom_don: nomDon,
      statut: 'ineligible',
      motifs: [
        `don réservé à ${restriction.classes.join('/')} d'après son texte d'avantage ` +
          `(« ${restriction.evidence} ») ; ${perso.classe} n'y a pas accès`,
      ],
    }
  }

  const infoAffinite = tables.affinite_creature[nomDon]
  if (
    aExigenceRace === false &&
    infoAffinite !== undefined &&
    infoAffinite.creature_keywords.length > 0 &&
    !infoAffinite.needs_manual_check &&
    !affiniteCreatureAutorise(perso.race, infoAffinite.creature_keywords)
  ) {
    return {
      nom_don: nomDon,
      statut: 'ineligible',
      motifs: [
        `don pensé pour : ${infoAffinite.creature_keywords.join(', ')} (page de don) ; race ` +
          `${perso.race ?? 'non fournie'} ne correspond pas`,
      ],
    }
  }

  return { nom_don: nomDon, statut, motifs: motifsManuel }
}

// ---------------------------------------------------------------------------
// filter_feats
// ---------------------------------------------------------------------------

/** Le catalogue à filtrer : nom de don exact -> ses conditions déjà
 * analysées (les clés du contrat sont des slugs ; passer ici un catalogue
 * déjà réindexé par nom exact, voir `graphe.ts`/`verdicts.ts` pour la
 * conversion slug <-> nom via `magie_des_dons`). */
export type CatalogueDons = ReadonlyMap<string, DonConditions>

export function filtrerDons(
  catalogue: CatalogueDons,
  perso: Personnage,
  tables: TablesMoteur,
): Readonly<Record<Statut, readonly ResultatEligibilite[]>> {
  const groupes: Record<Statut, ResultatEligibilite[]> = {
    eligible: [],
    manual_check: [],
    ineligible: [],
  }
  for (const [nomDon, don] of catalogue) {
    const resultat = evaluerDon(nomDon, don, perso, tables)
    groupes[resultat.statut].push(resultat)
  }
  for (const statut of Object.keys(groupes) as Statut[]) {
    groupes[statut].sort((a, b) => a.nom_don.localeCompare(b.nom_don))
  }
  return groupes
}
