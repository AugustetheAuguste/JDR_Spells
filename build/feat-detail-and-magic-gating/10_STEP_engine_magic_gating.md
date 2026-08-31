# 10_STEP — Gating magie dans `engine.py`

## Objectives

Faire échouer (`ineligible` dur) l'éligibilité à un don marqué magique
(`Data/feat_magic_info.json`) quand ni la classe ni la race du personnage ne
donnent accès à la magie, en s'appuyant sur `Data/class_caster_info.json`
(Step 07) et `Data/feat_magic_info.json` (Step 08). Reste `manual_check`/
comportement inchangé pour tout cas incertain (classe inconnue,
`needs_manual_check: true` sur le don, race absente/inconnue).

## Dependencies & Parallelization

- Wave 4. Dépend de **Step 07** (`Data/class_caster_info.json`),
  **Step 08** (`Data/feat_magic_info.json`), et **Step 03**
  (`OUTPUT_vocab_and_markup_calibration.md`, Section C — vocabulaire figé
  des races à magie innée).
- N'a pas besoin de Step 09 (doc pure). Peut tourner en parallèle de Step 09
  si un agent distinct le prend en charge.

## Inherited Context from Dependencies

- `Data/class_caster_info.json` (Step 07), une entrée par classe des 42 de
  `CLASS_BBA_PROGRESSION` :
  `{"is_caster": bool, "type": "arcane"|"divine"|"psychique"|null, "confidence": "reviewed", "source": "OUTPUT_class_caster_ground_truth.md"}`.
- `Data/feat_magic_info.json` (Step 08), une entrée par don :
  `{"is_magic": bool, "needs_manual_check": bool, "matched_keywords": [...]}`.
- **`RACE_MAGIC_KEYWORDS` : ne pas le calibrer ici.** Step 03
  (`OUTPUT_vocab_and_markup_calibration.md`, Section C) a déjà figé, à partir
  du texte réel de `Data/races.json`, la liste de mots-clés indiquant qu'une
  race donne un accès inné à la magie, avec pour chaque entrée la race et
  l'extrait de texte qui la justifie (et la liste des races attendues mais
  non trouvées dans les données scrapées). Ce step DOIT reprendre cette
  liste telle qu'écrite, pas la redéfinir.
- Contrat exact actuel de `pf1_dons/engine.py` à respecter (ne pas casser) :
  - `evaluate_feat(feat: FeatRow, character: Character) -> EligibilityResult`
    (ligne ~123) : itère les `Requirement`/`OrGroup`, `False` → retour
    immédiat `"ineligible"`, `None` accumulé → `"manual_check"` en fin de
    boucle si non vide, sinon `"eligible"`.
  - `Character` (dataclass, ligne ~19) : champs `character_class: str`,
    `level: int`, `race: Optional[str]`, `size`, `ability_scores`,
    `known_feats`, `skill_ranks`. `character.character_class` est le nom de
    classe brut (pas normalisé) tel que fourni par l'appelant.
  - `_normalize(text)` (ligne ~11) : NFKD, strip accents, lowercase — à
    réutiliser pour comparer `character.character_class`/`character.race`
    aux clés de `class_caster_info.json`/`race_loader`.
  - Patron déjà en place pour un gating similaire (`implied_classes`, lignes
    ~100-110) : override d'un résultat `None` en `False` avec un message
    explicite — même esprit à reproduire, mais ici au niveau du don entier,
    pas d'un `Requirement`.
  - `FeatRow` (`pf1_dons/data_loader.py`) a un champ `.name` = nom nettoyé
    du don (clé à utiliser pour chercher dans `feat_magic_info.json`).
- `pf1_dons/race_loader.py::get_race(name)` fait un lookup accent/casse-
  insensible dans `Data/races.json` et retourne un `RaceInfo` (champ
  `.traits: list[{"name": str, "description": str}]`) ou lève/retourne selon
  l'implémentation actuelle — **lire ce fichier avant d'écrire le code** pour
  connaître le comportement exact en cas de race inconnue (exception vs.
  `None`) et s'y adapter sans le modifier.

## Pseudo-code

```
# --- chargement module-level, même patron que parser.py::CLASS_ABILITY_MAP ---
with open("Data/class_caster_info.json", encoding="utf-8") as f:
    CLASS_CASTER_INFO = json.load(f)

with open("Data/feat_magic_info.json", encoding="utf-8") as f:
    FEAT_MAGIC_INFO = json.load(f)

# Recopiée littéralement depuis OUTPUT_vocab_and_markup_calibration.md,
# Section C — ne pas réinventer cette liste, seulement la transcrire.
RACE_MAGIC_KEYWORDS = [ ... tel qu'écrit dans la Section C ... ]

FUNCTION class_grants_magic(character_class: str) -> bool | None:
    key = _normalize(character_class)
    entry = CLASS_CASTER_INFO.get(key)
    IF entry is None: RETURN None   # classe inconnue -> ne jamais deviner
    RETURN entry["is_caster"]

FUNCTION race_grants_magic(race_name: str | None) -> bool:
    IF race_name is None: RETURN False   # absence d'info != échappatoire
    TRY:
        race_info = race_loader.get_race(race_name)
    EXCEPT (unknown race): RETURN False
    text = normalize(concat of all race_info.traits[*].description)
    RETURN any keyword in RACE_MAGIC_KEYWORDS found in text

# --- modification de evaluate_feat ---
FUNCTION evaluate_feat(feat, character):
    ... (boucle Requirement/OrGroup existante, INCHANGÉE) ...
    IF status about to be returned is "ineligible":
        RETURN as-is  # un don déjà ineligible pour une autre raison reste ineligible

    magic_info = FEAT_MAGIC_INFO.get(feat.name)
    IF magic_info AND magic_info["is_magic"] AND NOT magic_info["needs_manual_check"]:
        class_ok = class_grants_magic(character.character_class)
        IF class_ok is False AND NOT race_grants_magic(character.race):
            RETURN EligibilityResult(feat.name, "ineligible",
                [f"don magique ({', '.join(magic_info['matched_keywords'])}) ;"
                 f" ni la classe {character.character_class} ni la race"
                 f" {character.race or 'non fournie'} ne donnent accès à la magie"])
        # class_ok is None (classe inconnue) -> ne pas overrider, garder le
        # statut déjà calculé par la boucle de Requirement ci-dessus

    RETURN statut déjà calculé par la boucle de Requirement ci-dessus
```

## Logic Flow

1. Charger les deux nouvelles tables JSON une fois, au niveau module (comme
   `CLASS_ABILITY_MAP` dans `parser.py`), et la liste `RACE_MAGIC_KEYWORDS`
   héritée de Step 03/Section C.
2. Laisser la logique existante d'`evaluate_feat` tourner à l'identique
   d'abord — c'est la boucle sur les `Requirement`/`OrGroup` du don, non
   affectée par ce step.
3. Seulement si le statut obtenu N'EST PAS déjà `"ineligible"`, appliquer le
   nouveau filtre magie : si le don est magique avec confiance
   (`is_magic=true`, `needs_manual_check=false`) et que ni la classe ni la
   race du personnage ne donnent accès à la magie, forcer `"ineligible"`
   avec une raison explicite.
4. Si la classe est inconnue de `class_caster_info.json` (ne devrait pas
   arriver puisque cette table couvre les 42 classes de
   `CLASS_BBA_PROGRESSION` en entier, mais rester défensif), ne jamais
   transformer un `"eligible"`/`"manual_check"` existant en `"ineligible"`
   sur la base d'une supposition.

## Implementation Notes

- Ne PAS toucher à `evaluate_requirement`/`evaluate_or_group` : ce gating est
  un post-traitement au niveau du don entier dans `evaluate_feat`, pas un
  nouveau `RequirementType` (le CSV ne contient jamais l'info magique dans
  ses conditions — elle vient exclusivement de `feat_magic_info.json`, donné
  externe au parsing).
- `filter_feats` (ligne ~141) n'a besoin d'aucune modification : il appelle
  déjà `evaluate_feat` par don.
- `RACE_MAGIC_KEYWORDS` est entièrement héritée de Step 03/Section C — si
  une race listée par Step 03 comme "attendue mais non trouvée dans les
  données scrapées" est rencontrée à l'exécution, `race_grants_magic` doit
  renvoyer `False` pour elle (comportement conservateur, cohérent avec
  l'absence de preuve), pas lever d'erreur.
- Vérifier si `race_loader.get_race` lève une exception ou retourne `None`/
  un objet vide pour une race inconnue, et adapter `race_grants_magic` à ce
  comportement réel (ne pas supposer).
- Le message de raison ajouté à `EligibilityResult.reasons` doit rester en
  français, cohérent avec tous les autres messages du fichier.

## Verification Criteria

- `python -m pytest tests/test_engine.py` reste entièrement vert (aucune
  régression sur les cas existants qui ne concernent pas la magie).
- Nouveau test manuel (ou dans `tests/test_engine.py`) : un personnage
  `Guerrier` niveau 3 évalué sur `"Acolyte de la Nature"` doit retourner
  `"ineligible"` (le cas exact rapporté par l'utilisateur).
- Un personnage `Druide` niveau 3 évalué sur `"Acolyte de la Nature"` ne doit
  PAS être forcé en `"ineligible"` par ce nouveau filtre (peut rester
  `"manual_check"` si d'autres `Requirement` du don restent indéterminés —
  seul le filtre magie ne doit pas être la cause d'un blocage pour cette
  classe).
- Un don avec `needs_manual_check: true` dans `feat_magic_info.json` ne doit
  jamais être forcé en `"ineligible"` par ce filtre, quelle que soit la
  classe.
- Confirme l'usage correct de la liste héritée de Step 03/Section C :
  `RACE_MAGIC_KEYWORDS` telle qu'implémentée doit être traçable au document
  de calibration, sans divergence non signalée.

## Git Handling

- Branche : `feature/feat-details-magic-gating`, basée sur les branches
  mergées de Step 03, Step 07 et Step 08.
- Commit : modifications de `pf1_dons/engine.py` uniquement (les données
  sont déjà committées par les steps précédents).
- Message : `engine: fail magic feats for non-caster classes/races`

## Expected Outcome

`engine.py::evaluate_feat` refuse maintenant explicitement un don magique à
un personnage structurellement incapable d'en bénéficier, sans jamais
deviner sur les cas incertains — corrige directement le bug rapporté
("Acolyte de la Nature" proposé à un Guerrier).
