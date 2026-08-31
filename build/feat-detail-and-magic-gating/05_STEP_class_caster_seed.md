# 05_STEP — Seed du mapping classe → accès à la magie

## Objectives

Créer `scripts/build_class_caster_info_seed.py` (même dossier et même patron
que `scripts/build_class_ability_map_seed.py`) qui produit un brouillon
`Data/class_caster_info.draft.json` (gitignored) proposant, pour chaque
classe connue de `pf1_dons/class_progression.py::CLASS_BBA_PROGRESSION`, si
elle a accès à la magie et de quel type.

**Rôle de ce brouillon revu à la baisse** : depuis l'ajout de
**Step 04** (recherche vérifiée `OUTPUT_class_caster_ground_truth.md`, qui
tranche les 42 classes avec les vraies règles PF1e, hybrides/occultes
incluses), ce script n'est plus la source de vérité — Step 04 l'est. Ce
draft reste utile uniquement comme **recoupement automatique** : Step 07
doit signaler tout désaccord entre ce draft et `OUTPUT_class_caster_ground_truth.md`
comme un signal à vérifier, jamais comme une raison de préférer le draft.

## Dependencies & Parallelization

- Wave 1. Aucune dépendance fonctionnelle (lit uniquement des fichiers déjà
  existants : `Data/class_features.json`, `pf1_dons/class_progression.py`).
- Peut tourner en parallèle de Step 02 dans un worktree séparé.

## Inherited Context from Dependencies

Aucune (fichiers déjà présents dans le repo) :
- `pf1_dons/class_progression.py::CLASS_BBA_PROGRESSION` : dict classe
  normalisée (accents retirés, minuscules) → `"good"|"medium"|"poor"`. C'est
  la liste exhaustive des classes connues du système (`KNOWN_CLASSES` dans
  `pf1_dons/parser.py` en est directement dérivé).
- `Data/class_features.json` (produit par `extract_class_features.py`) :
  progression de capacités de classe par niveau, scrapée depuis
  pathfinder-fr.org. Structure à inspecter par le subagent avant d'écrire le
  script (lire le fichier réel — ne pas supposer un schéma).

## Pseudo-code

```
CONST OUT_PATH = "Data/class_caster_info.draft.json"

CONST SPELLCASTING_KEYWORDS = [
    "sorts connus", "emplacements de sorts", "sorts par jour",
    "lanceur de sorts", "liste de sorts", "niveau de lanceur de sorts",
    "orientation arcane", "domaine", "mystère", "école de prédilection",
    # etc. — mots-clés typiques des tableaux de progression de classes
    # lanceuses de sorts en français Pathfinder ; à affiner en lisant
    # réellement class_features.json pour quelques classes connues
    # lanceuses (magicien, pretre, ensorceleur, druide, barde, oracle...)
    # et non-lanceuses (guerrier, barbare, moine, roublard...) pour calibrer.
]

FUNCTION guess_caster(class_key, class_features_entry) -> dict:
    text = normalized concatenation of everything textual in
           class_features_entry (nom des capacités, en-têtes de colonnes de
           table si présents)
    is_caster = any keyword in SPELLCASTING_KEYWORDS found in text
    RETURN {
        "is_caster": is_caster,
        "type": null,   # "arcane"|"divine"|"psychique"|"autre" — laissé à la
                         # curation manuelle, pas déductible avec confiance
                         # par mots-clés seuls
        "confidence": "draft",
        "evidence": [liste des mots-clés effectivement trouvés],
    }

FUNCTION main():
    class_features = load JSON Data/class_features.json
    out = {}
    FOR class_key IN sorted(CLASS_BBA_PROGRESSION.keys()):
        entry = class_features.get(class_key)  # gérer absence proprement
        out[class_key] = guess_caster(class_key, entry) if entry else
            {"is_caster": null, "type": null, "confidence": "draft",
             "evidence": [], "note": "no class_features.json entry found"}
    write JSON(out, sort_keys=True, ensure_ascii=False, indent=2) to OUT_PATH
    print summary: N classes marquées is_caster=true, M false, K incertaines
```

## Logic Flow

1. Lire la liste figée des classes connues (`CLASS_BBA_PROGRESSION`).
2. Pour chacune, chercher dans `Data/class_features.json` des indices
   textuels de capacité de lancer des sorts.
3. Écrire un brouillon best-effort, chaque entrée taguée `"confidence": "draft"`
   pour signaler explicitement qu'elle n'est qu'un recoupement automatique
   secondaire face à Step 04, jamais consommée telle quelle par `engine.py`.

## Implementation Notes

- Ce script ne doit PAS être importé par `pf1_dons` (autonome, comme
  `scripts/build_class_ability_map_seed.py`).
- Le fichier de sortie est un **brouillon jetable** : l'ajouter au
  `.gitignore` (vérifier le pattern existant pour `*.draft.json`, déjà en
  place pour `Data/class_ability_map.draft.json` — réutiliser le même
  pattern générique si présent, sinon ajouter une ligne dédiée).
- Ne pas essayer de deviner le `"type"` (arcanique/divine/psychique) par
  mots-clés seuls : le laisser `null` dans le draft — la vérité terrain
  arcane/divine/psychique vient de Step 04, pas de ce script.
- Le but de ce script est de fournir un second signal automatique
  indépendant pour Step 07, pas de remplacer la recherche vérifiée de
  Step 04 — un rappel `is_caster` faux positif/négatif est acceptable dans
  le draft tant qu'il est visible et review-able.

## Verification Criteria

- `python scripts/build_class_caster_info_seed.py` s'exécute sans erreur et
  produit `Data/class_caster_info.draft.json` avec une entrée par classe de
  `CLASS_BBA_PROGRESSION` (aucune classe manquante).
- Spot-check manuel : `"magicien"`, `"pretre"`, `"ensorceleur"`, `"druide"`,
  `"barde"`, `"oracle"` doivent avoir `is_caster: true` dans le draft ;
  `"guerrier"`, `"barbare"`, `"moine"`, `"roublard"` doivent avoir
  `is_caster: false`. Si l'heuristique se trompe sur ces cas évidents,
  corriger les `SPELLCASTING_KEYWORDS` avant de considérer l'étape terminée
  (le draft n'a pas besoin d'être parfait sur les cas ambigus, mais doit
  être correct sur les cas évidents pour être un recoupement utile à Step 07).

## Git Handling

- Branche : `feature/feat-details-class-caster-seed` (worktree dédié, Wave 1).
- Commit : uniquement le script (`Data/class_caster_info.draft.json` reste
  gitignored, non committé).
- Message : `data: seed a draft class-to-caster-access mapping`

## Expected Outcome

Un brouillon exploitable par Step 07 comme second signal de recoupement,
en complément (jamais en remplacement) de la vérité terrain vérifiée
produite par Step 04.
