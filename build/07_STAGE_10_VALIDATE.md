# 07 — Étage 10 : validation des enrichissements

## Objectives

Construire `src/pf_spells/validate_enrichment.py` : schéma, conformité à la
taxonomie, et surtout **vérification des preuves** — chaque sous-chaîne
justificative doit réellement apparaître dans le texte source. Un enregistrement
qui échoue est rejeté, jamais réparé.

## Dependencies & Parallelization

- **Vague 4.** Dépend de : `02_SCHEMA_ENRICHISSEMENT` (schéma + fixtures
  d'enregistrements valides et invalides) et `04_TAXONOMIE_PASSE0`
  (vocabulaires v1).
- Tourne en parallèle de `05_STAGE_08_PREPARE_PROMPTS`. Ne dépend pas du
  générateur : il est testé sur les fixtures de l'étape 02.
- **Note d'implémentation croisée :** ce module importe
  `texte_source_canonique`, définie à l'étape 05. Si l'étape 05 n'est pas encore
  fusionnée, réimplémenter l'appel derrière une interface nommée
  `texte_source_canonique(sort) -> str` et le test de stabilité de hash garantira
  l'équivalence à la fusion. C'est la seule couture entre les deux étapes.

## Inherited Context from Dependencies

De `02_SCHEMA_ENRICHISSEMENT` :
- `schemas/enrichissement.schema.json`, `additionalProperties: false`.
- `preuves` = `{type_degats: string|null, condition_infligee: [string],
  cible_typique: string}`.
- Fixtures : 3 valides, 5 invalides sous `tests/fixtures/enrichissements/`.
- Politique des nulls : `null` = absent du source ; `[]` = vérifié, aucun.

De `04_TAXONOMIE_PASSE0` :
- `conventions/vocabulaires/*.json` en `version: "v1"` ; `tags.json` fait foi.
- Règle des 5 % : si plus de ~5 % des enregistrements portent un
  `notes_ambiguite` non nul, la taxonomie est incomplète → rapport, pas
  correction automatique.

Du dépôt : `data/sorts/<id>.json`, `data/enrichissements/<id>.json`.

## Pseudo-code

```
FONCTION valider_un(id) -> Verdict
  enr  <- data/enrichissements/<id>.json
  sort <- data/sorts/<id>.json
  src  <- texte_source_canonique(sort)

  erreurs <- []

  # 1. schéma
  erreurs += valider_schema(enr, enrichissement.schema.json)

  # 2. taxonomie
  POUR tag DANS enr.tags :
     SI tag ABSENT DE tags.json v1 -> erreur "tag hors taxonomie"
  idem pour categorie_principale, type_degats, condition_infligee, cible_typique

  # 3. PREUVES — le contrôle anti-confabulation
  SI enr.type_degats != null :
     p <- enr.preuves.type_degats
     SI p est null OU p NOT IN src -> erreur "preuve absente du source"
  SI enr.type_degats == null ET enr.preuves.type_degats != null :
     erreur "preuve fournie pour une valeur nulle"
  POUR chaque condition, une preuve correspondante doit exister dans src
  la preuve de cible_typique doit exister dans src

  # 4. cohérence de version
  SI enr.hash_source != sha256(src) -> erreur "dérive : source modifié depuis
     la génération"          # NE PAS régénérer, signaler

  # 5. verrou humain
  SI enr.verifie_par_humain ET erreurs non vide :
     verdict <- "verrouille_mais_invalide"   # à remonter en tête de rapport

  RETOURNER Verdict(id, ok = erreurs vide, erreurs, verrouille)

FONCTION principale(--only, --strict):
  verdicts <- valider_un pour chaque enrichissement présent
  ÉCRIRE build_artifacts/rapports/validation_enrichissement.json :
    {total, ok, echecs, par_type_erreur: {...},
     taux_notes_ambiguite: n_ambigu / total,
     taxonomie_incomplete: taux > 0.05,
     verrouilles_mais_invalides: [ids],
     derive_source: [ids]}
  code de sortie non nul si --strict et echecs > 0
```

## Logic Flow

1. Charger le schéma et les vocabulaires v1 une seule fois.
2. Valider chaque enregistrement présent (l'absence d'enrichissement n'est pas
   une erreur de cet étage — c'est le sujet de l'étape 08).
3. Agréger par type d'erreur : c'est ce qui pilote le réglage du prompt. Savoir
   que 200 enregistrements échouent est inutile ; savoir que 190 échouent sur
   « preuve absente du source » désigne la correction à faire.
4. Calculer le taux d'ambiguïté et lever le drapeau `taxonomie_incomplete`.
5. Sortir en non-nul sous `--strict`, utilisé en CI.

## Implementation Notes

- La comparaison de sous-chaîne se fait sur la chaîne **exacte**, sans repli sur
  les accents ni normalisation de casse. Assouplir cette comparaison est
  précisément ce qui laisserait passer une confabulation reformulée. Si le taux
  d'échec est élevé, la correction est dans le prompt (« recopie exactement »),
  pas dans le comparateur.
- Une seule tolérance admissible, à documenter si nécessaire : la normalisation
  Unicode NFC des deux côtés, parce que c'est une différence de représentation,
  pas de contenu.
- `verifie_par_humain: true` **ne dispense pas** de la validation. Un
  enregistrement verrouillé qui ne conforme plus est le cas le plus intéressant
  du rapport : il signale une dérive du schéma ou de la taxonomie sous un
  enregistrement que personne ne réécrira.
- Le validateur n'écrit **jamais** dans `data/`. Il ne corrige rien.
- Ne pas peupler de fichier `__init__` ni déclarer `__all__`.

## Verification Criteria

- Sur les fixtures de l'étape 02 : 3 valides acceptés, 5 invalides rejetés, et
  le **type d'erreur** attendu est celui rapporté pour chacun.
- Un test dédié construit un enregistrement dont `preuves.type_degats` est une
  reformulation plausible mais absente du source, et vérifie qu'il est rejeté.
- Un test vérifie qu'un enregistrement `verifie_par_humain: true` mais invalide
  apparaît dans `verrouilles_mais_invalides` et ne fait pas planter le run.
- Un test vérifie la détection de dérive : modifier le sort source, relancer,
  obtenir `derive_source`.
- `git status data/` est vide après exécution.
- Le rapport est produit et son schéma est stable (test sur les clés).

## Git Handling

- Branche : `feat/enrichissement-llm/07-validate-enrichment`.
- Commits :
  - `feat(enrich): ajouter l'étage 10 de validation`
  - `feat(enrich): vérifier les preuves par sous-chaîne exacte`
  - `test(enrich): couvrir confabulation, verrou humain et dérive de source`
- Fusion `--no-ff` en fin de Vague 4.

## Expected Outcome

Un contrôle mécanique de la confabulation, un rapport agrégé par type d'erreur
qui pilote le réglage du prompt, et une garantie que les corrections humaines
sont surveillées sans jamais être écrasées.
