# 07_STEP — Curation de `Data/class_caster_info.json`

## Objectives

Créer `scripts/curate_class_caster_info.py` (même patron que
`scripts/curate_class_ability_map.py`) qui transforme la recherche vérifiée
de **Step 04** (`OUTPUT_class_caster_ground_truth.md`) en
`Data/class_caster_info.json` final, committé, avec 100% des classes de
`CLASS_BBA_PROGRESSION` couvertes — hybrides et occultes inclus, sans
exception.

**Ce step n'improvise plus aucun verdict.** Contrairement à une version
précédente de ce plan, ce script n'invente pas sa propre table de vérité
terrain en pseudo-code : il encode littéralement le verdict déjà tranché et
justifié par Step 04 pour chacune des 42 classes. Le rôle de ce step est de
transcrire fidèlement ce document en JSON, avec un recoupement automatique
contre le brouillon de Step 05 pour repérer d'éventuelles surprises.

## Dependencies & Parallelization

- Wave 2. Dépend de **Step 04** (`OUTPUT_class_caster_ground_truth.md`,
  obligatoire) et de **Step 05** (`Data/class_caster_info.draft.json`,
  utilisé uniquement comme recoupement secondaire, pas comme source).
- Indépendant de Step 02/03/06 (fichiers différents) — peut tourner en
  parallèle de Step 06.

## Inherited Context from Dependencies

- Source de vérité : `build/feat-detail-and-magic-gating/OUTPUT_class_caster_ground_truth.md`
  (Step 04), un tableau markdown avec une ligne par classe :
  `classe | is_caster | type | lanceur | justification`, couvrant les 42
  classes de `CLASS_BBA_PROGRESSION` (classes de base, supplémentaires,
  hybrides, occultes, alias `cavalier`/`clerc`), plus une section "Cas
  limites notés".
- Recoupement secondaire : `Data/class_caster_info.draft.json` (Step 05),
  format par classe `{"is_caster": bool|null, "type": null, "confidence": "draft", "evidence": [...]}`.
- Liste exhaustive et figée des classes à couvrir :
  `pf1_dons/class_progression.py::CLASS_BBA_PROGRESSION` (ne rien inventer
  hors de cette liste, ne rien en omettre — même contrainte que
  `scripts/curate_class_ability_map.py::VALID_CLASSES`).

## Pseudo-code

```
CONST GROUND_TRUTH_DOC = "build/feat-detail-and-magic-gating/OUTPUT_class_caster_ground_truth.md"
CONST DRAFT_PATH = "Data/class_caster_info.draft.json"
CONST OUT_PATH = "Data/class_caster_info.json"
VALID_CLASSES = set(CLASS_BBA_PROGRESSION.keys())

FUNCTION parse_ground_truth_table(doc_text) -> dict[class_key, {"is_caster", "type", "justification"}]:
    # parser le tableau markdown de Step 04 ligne par ligne (colonnes
    # classe | is_caster | type | lanceur | justification)
    RETURN mapping class_key -> verdict, EXACTEMENT comme écrit dans le
    document — ne pas réinterpréter ni "corriger" un verdict ici ; si un
    verdict semble incohérent, c'est Step 04 qu'il faut corriger et
    ré-exécuter, pas ce script.

FUNCTION main():
    ground_truth = parse_ground_truth_table(read GROUND_TRUTH_DOC)
    draft = load JSON DRAFT_PATH  # recoupement uniquement

    missing = VALID_CLASSES - set(ground_truth.keys())
    IF missing: RAISE error listing missing classes — ne jamais compléter
        avec une valeur par défaut devinée.

    out = {}
    disagreements = []
    FOR class_key IN sorted(VALID_CLASSES):
        verdict = ground_truth[class_key]
        out[class_key] = {
            "is_caster": verdict["is_caster"],
            "type": verdict["type"],
            "confidence": "reviewed",
            "source": "OUTPUT_class_caster_ground_truth.md",
        }
        draft_entry = draft.get(class_key)
        IF draft_entry AND draft_entry["is_caster"] is not null
           AND draft_entry["is_caster"] != verdict["is_caster"]:
            disagreements.append(class_key)

    ASSERT set(out.keys()) == VALID_CLASSES  # couverture 100%
    write JSON(out, sort_keys=True, ensure_ascii=False, indent=2) to OUT_PATH
    print "désaccords draft/ground-truth (à relire, pas bloquant) :", disagreements
```

## Logic Flow

1. Parser le document markdown de Step 04 comme unique source de vérité —
   ce script ne tranche jamais un verdict lui-même.
2. Vérifier la couverture complète des 42 classes ; toute classe manquante
   dans le document de Step 04 fait échouer ce script bruyamment (retourner
   à Step 04 pour compléter, ne pas deviner ici).
3. Utiliser le brouillon de Step 05 uniquement pour lister les désaccords en
   sortie console (signal de relecture humaine, jamais une correction
   automatique du verdict de Step 04).
4. Écrire `Data/class_caster_info.json` trié, avec `"confidence": "reviewed"`
   et un champ `"source"` traçant son origine.

## Implementation Notes

- Si `parse_ground_truth_table` échoue à parser une ligne du tableau markdown
  de Step 04 (format inattendu), traiter cela comme une erreur bloquante, pas
  comme une classe à ignorer silencieusement.
- `"type"` ne peut valoir que `"arcane"`, `"divine"`, `"psychique"`, ou
  `null` (si `is_caster` est `false`) — sauf si Step 04 documente
  explicitement une valeur supplémentaire justifiée (ex. un type
  "alchimique" pour `alchimiste`), auquel cas la reprendre telle quelle et
  la signaler dans le message de fin d'exécution du script.
- Le script doit être ré-exécutable idempotent (même sortie à chaque run),
  comme `curate_class_ability_map.py`.

## Verification Criteria

- `python scripts/curate_class_caster_info.py` s'exécute sans erreur et
  produit `Data/class_caster_info.json` avec exactement les clés de
  `CLASS_BBA_PROGRESSION`, aucune manquante, aucune en trop.
- Spot-check : `"guerrier".is_caster == false`, `"magicien".is_caster == true
  and type == "arcane"`, `"pretre".is_caster == true and type == "divine"`,
  et surtout les classes explicitement demandées par l'utilisateur —
  `"bretteur"`, `"ninja"`, `"samourai"` — ont bien un verdict ferme et non
  `null`, repris tel quel du document de Step 04.
- Tout désaccord entre le draft (Step 05) et le document de Step 04 est
  listé dans la sortie console du script, pour audit humain — mais n'empêche
  pas la génération du fichier final.
- `python -m pytest` reste vert (ce fichier n'est pas encore consommé par le
  moteur à ce stade, donc aucune régression possible ici — juste vérifier
  qu'aucun import cassé n'a été introduit).

## Git Handling

- Branche : `feature/feat-details-class-caster-curate`, basée sur les
  branches mergées de Step 04 et Step 05.
- Commit : script + `Data/class_caster_info.json` (le `.draft.json` reste
  gitignored, non committé).
- Message : `data: curate the final class-to-caster-access mapping`

## Expected Outcome

`Data/class_caster_info.json` est la source de vérité committée, transcrivant
fidèlement la recherche vérifiée de Step 04 pour les 42 classes (hybrides et
occultes incluses), que Step 10 consommera pour décider si la classe d'un
personnage donne accès à la magie.
