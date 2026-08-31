# 11_STEP — Dataset golden, tests et documentation

## Objectives

Ajouter des cas de régression au dataset golden couvrant le nouveau gating
magie, vérifier la suite complète, et mettre à jour `CLAUDE.md` avec les
nouveaux fichiers de données et la nouvelle règle de moteur.

## Dependencies & Parallelization

- Wave 5. Dépend de **Step 10** (le gating magie doit exister dans
  `engine.py` pour que les cas golden aient le bon `expected_status`).

## Inherited Context from Dependencies

- Format d'un cas dans `tests/golden/cases.json` (voir fichier réel) :
  ```json
  {
    "id": "<slug_unique>",
    "feat_name": "<nom exact du CSV>",
    "character": {"character_class": "...", "level": N, "race": "..."?, ...},
    "expected_status": "eligible"|"manual_check"|"ineligible",
    "note": "<explication>"
  }
  ```
- `tests/test_golden.py` charge ce fichier et paramétrise un test par entrée,
  évaluant `feat_name` (cherché dans le vrai catalogue `Data/Dons.csv`) via
  le vrai pipeline parser+engine contre `character`. Ne pas modifier ce
  fichier de test — seulement `tests/golden/cases.json`.
- Cas de gating magie confirmé au Step 10 :
  - `Guerrier` niveau 3 sur `"Acolyte de la Nature"` → `"ineligible"`.
  - `Druide` niveau 3 sur `"Acolyte de la Nature"` → ne doit pas être
    `"ineligible"` à cause du filtre magie (peut être `"eligible"` ou
    `"manual_check"` selon le reste des `Requirement` du don — déterminer la
    valeur réelle en exécutant le pipeline localement avant de l'écrire dans
    le golden, ne jamais deviner un `expected_status`).

## Pseudo-code

```
NOUVEAUX_CAS = [
    {
        "id": "acolyte_nature_guerrier_ineligible_magic_gate",
        "feat_name": "Acolyte de la Nature",
        "character": {"character_class": "Guerrier", "level": 3},
        "expected_status": "ineligible",
        "note": "Bug rapporté par l'utilisateur : don magique proposé à un"
                " Guerrier ; couvre le nouveau filtre feat_magic_info +"
                " class_caster_info introduit en Step 10.",
    },
    {
        "id": "acolyte_nature_druide_not_blocked_by_magic_gate",
        "feat_name": "Acolyte de la Nature",
        "character": {"character_class": "Druide", "level": 3},
        "expected_status": "<déterminer en exécutant le pipeline localement>",
        "note": "Un Druide a accès à la magie : le filtre magie ne doit pas"
                " le bloquer (régression guard pour ne pas sur-corriger).",
    },
    # + 1-2 cas supplémentaires piochés parmi les dons is_magic:true de
    # Data/feat_magic_info.json avec une classe non-caster connue, pour
    # élargir la couverture au-delà du seul cas rapporté.
]

FOR case IN NOUVEAUX_CAS:
    APPEND to tests/golden/cases.json (JSON array existant, garder l'ordre
    et le formatage — indentation 2 espaces, comme le fichier actuel)
```

## Logic Flow

1. Lancer manuellement le pipeline réel (`pf1_dons.data_loader.load_catalog`
   + `pf1_dons.engine.evaluate_feat`) pour chaque nouveau cas candidat, AVANT
   de l'écrire dans `cases.json`, pour connaître le vrai `expected_status` —
   ne jamais écrire une valeur supposée (c'est la règle documentée dans
   `CLAUDE.md` pour ce fichier).
2. Ajouter les cas validés à `tests/golden/cases.json`.
3. Lancer `python -m pytest` (suite complète) et confirmer 100% vert.
4. Mettre à jour `CLAUDE.md` (voir Implementation Notes).

## Implementation Notes

- Paragraphe à ajouter dans `CLAUDE.md`, à la suite de la description de
  `Data/class_ability_map.json` (section architecture, point 4) :
  > `Data/feat_links.json` (`scrappers/scrape_feat_links.py`) et
  > `Data/feat_details.json` (`scrappers/scrape_feat_details.py`) scrapent,
  > pour chaque don, sa page dédiée sur pathfinder-fr.org (description
  > complète, rubriques Spécial/Normal) — information absente du résumé
  > `Data/Dons.csv`. Le balisage HTML exact de ces rubriques et le
  > vocabulaire magique utilisés ci-dessous sont calibrés une fois pour
  > toutes dans `build/feat-detail-and-magic-gating/OUTPUT_vocab_and_markup_calibration.md`.
  > `Data/feat_magic_info.json` (`scrappers/tag_feat_magic.py`) tague par
  > mots-clés si un don est de nature magique (`is_magic`/`needs_manual_check`,
  > même convention que `feat_categories.json`). `Data/class_caster_info.json`
  > (hand-curated, patron identique à `class_ability_map.json` : draft
  > best-effort via `scripts/build_class_caster_info_seed.py`, vérité terrain
  > vérifiée pour les 42 classes, hybrides/occultes incluses, dans
  > `build/feat-detail-and-magic-gating/OUTPUT_class_caster_ground_truth.md`,
  > transcrite via `scripts/curate_class_caster_info.py`) indique par classe
  > si elle a accès à la magie. `engine.py::evaluate_feat` refuse
  > (`ineligible`) un don magique de confiance haute quand ni la classe ni la
  > race du personnage n'y donnent accès (vérifié par mots-clés sur les
  > traits raciaux déjà scrapés dans `Data/races.json`), symétrique au fix
  > `implied_classes`.
- Mentionner aussi, dans la section "Test fixtures", que
  `tests/golden/cases.json` couvre désormais le gating magie en plus des
  `RequirementType` et de `implied_classes`.
- Ajouter une ligne pointant vers la note d'analyse produite par Step 09
  (chemin exact du fichier, une fois écrit) sous une nouvelle sous-section
  courte "Pistes futures" ou équivalent, sans détailler son contenu dans
  `CLAUDE.md` (juste un pointeur).

## Verification Criteria

- `python -m pytest` : 100% des tests passent, incluant les nouveaux cas
  golden.
- `tests/golden/cases.json` reste un JSON valide (vérifier avec
  `python -c "import json; json.load(open('tests/golden/cases.json', encoding='utf-8'))"`).
- `CLAUDE.md` contient le nouveau paragraphe et référence bien les noms de
  fichiers réels produits par Steps 02-10 (pas des noms hypothétiques).

## Git Handling

- Branche : `feature/feat-details-golden-and-docs`, basée sur la branche
  mergée de Step 10.
- Commit : `tests/golden/cases.json` + `CLAUDE.md`.
- Message : `tests: cover magic-feat gating in the golden dataset; docs`

## Expected Outcome

La régression est verrouillée par un test golden reproduisant exactement le
bug rapporté, et `CLAUDE.md` documente les nouveaux fichiers/règles pour les
futurs contributeurs.
