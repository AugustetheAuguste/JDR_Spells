# 08_STEP — Détection "don magique" par mots-clés

## Objectives

Créer `scrappers/tag_feat_magic.py` (même patron best-effort que
`scrappers/tag_feat_categories.py`) qui lit `Data/feat_details.json` et
produit `Data/feat_magic_info.json` : par don, un flag `is_magic` (le don
n'a de sens/bénéfice réel que pour un personnage ayant accès à la magie) et
`needs_manual_check` (confiance insuffisante pour trancher automatiquement).

## Dependencies & Parallelization

- Wave 3. Dépend de **Step 06** (`Data/feat_details.json`) et de **Step 03**
  (`OUTPUT_vocab_and_markup_calibration.md`, Section B — vocabulaire
  magique figé).
- Indépendant de Step 07 (fichiers différents) — peut tourner en parallèle
  de Step 09.

## Inherited Context from Dependencies

- Entrée : `Data/feat_details.json`, produit par Step 06
  (`scrappers/scrape_feat_details.py`), une entrée par don :
  `{"url", "source_detail", "description", "conditions_detail",
  "avantages_detail", "special", "normal", "raw_text", "parse_error"?}`.
  Utiliser `raw_text` comme texte d'analyse principal (toujours présent même
  si le découpage par rubrique a échoué) ; concaténer avec le nom du don.
- **Vocabulaire magique : ne pas le redéterminer ici.** Step 03
  (`OUTPUT_vocab_and_markup_calibration.md`, Section B) a déjà figé, à partir
  d'un échantillon réel de pages avec citations vérifiables, les trois
  listes `STRONG_MAGIC_KEYWORDS`, `WEAK_MAGIC_KEYWORDS`, `EXCLUSION_PHRASES`.
  Ce step DOIT reprendre ces listes telles qu'écrites dans ce document —
  pas les redéfinir ni les deviner à nouveau. Si, en parcourant l'ensemble de
  `Data/feat_details.json`, un motif magique manifestement absent des trois
  listes apparaît de façon répétée, l'ajouter est acceptable mais doit être
  noté explicitement dans le message de fin d'exécution du script comme un
  écart par rapport au document de Step 03 (pour audit humain), pas silencié.
- Convention `needs_manual_check` : même sémantique que
  `Data/feat_categories.json` (`scrappers/tag_feat_categories.py`) — `true`
  quand le tagger n'a pas assez confiance, jamais un flag "j'ai deviné, au
  pire des cas".
- Fonction `_normalize` (NFKD, strip accents, lowercase) : recopier
  localement comme le fait déjà `tag_feat_categories.py` (ne pas importer le
  package `pf1_dons`, script autonome).

## Pseudo-code

```
CONST OUT_PATH = "Data/feat_magic_info.json"
CONST CALIBRATION_DOC = "build/feat-detail-and-magic-gating/OUTPUT_vocab_and_markup_calibration.md"

# Recopiées littéralement depuis CALIBRATION_DOC, Section B — ne pas
# réinventer ces listes, seulement les transcrire en code.
STRONG_MAGIC_KEYWORDS = [ ... tel qu'écrit dans CALIBRATION_DOC ... ]
WEAK_MAGIC_KEYWORDS = [ ... tel qu'écrit dans CALIBRATION_DOC ... ]
EXCLUSION_PHRASES = [ ... tel qu'écrit dans CALIBRATION_DOC ... ]

FUNCTION classify(name, detail_entry) -> dict:
    haystack = normalize(name + " " + (detail_entry.get("raw_text") or ""))
    IF any exclusion phrase in haystack AND no strong keyword match:
        RETURN {"is_magic": false, "needs_manual_check": false, "matched_keywords": []}
    strong_matches = [kw for kw in STRONG_MAGIC_KEYWORDS if matches(kw, haystack)]
    IF strong_matches:
        RETURN {"is_magic": true, "needs_manual_check": false, "matched_keywords": strong_matches}
    weak_matches = [kw for kw in WEAK_MAGIC_KEYWORDS if kw in haystack]
    IF weak_matches:
        RETURN {"is_magic": false, "needs_manual_check": true, "matched_keywords": weak_matches}
    RETURN {"is_magic": false, "needs_manual_check": false, "matched_keywords": []}

FUNCTION main():
    details = load JSON Data/feat_details.json
    out = {}
    counts = {"is_magic": 0, "needs_manual_check": 0}
    FOR name, entry IN details.items():
        result = classify(name, entry)
        out[name] = result
        update counts
    write JSON(out, sort_keys=True, ensure_ascii=False, indent=2) to OUT_PATH
    print counts
```

## Logic Flow

1. Charger `feat_details.json` et les trois listes de mots-clés depuis
   `OUTPUT_vocab_and_markup_calibration.md` (Section B).
2. Pour chaque don, chercher des signaux forts (haute confiance de nature
   magique) dans le texte complet scrapé.
3. Si aucun signal fort mais un signal faible/ambigu, marquer
   `needs_manual_check=true` plutôt que de deviner dans un sens ou l'autre —
   ce sont ces cas que `engine.py` (Step 10) devra traiter en `manual_check`,
   jamais en `ineligible` dur.
4. Gérer explicitement les phrases d'exclusion (un don qui parle "d'objets
   magiques" au sens large sans exiger de lancer de sorts ne doit pas être
   marqué magique).

## Implementation Notes

- Ce tagger est un filtre à haute précision, pas à haut rappel : mieux vaut
  rater un don réellement magique (il retombera en `manual_check` normal,
  comportement actuel inchangé) que faire un faux positif qui bloquerait à
  tort un personnage légitime — cohérent avec la demande utilisateur de
  "restreindre" tout en respectant la philosophie existante de ne jamais
  se tromper silencieusement dans le sens strict.
- Les listes de mots-clés viennent de Step 03, déjà calibrées sur un
  échantillon réel — ce step les applique à l'ensemble du catalogue, il ne
  les invente pas. Toute extension des listes pendant ce step doit être
  justifiée et signalée (voir Inherited Context ci-dessus), pas silencieuse.
- Ne pas importer `pf1_dons` (script autonome, cohérent avec
  `tag_feat_categories.py`).

## Verification Criteria

- `python scrappers/tag_feat_magic.py` s'exécute sans erreur, produit
  `Data/feat_magic_info.json` avec une entrée par clé de
  `Data/feat_details.json`.
- Spot-check obligatoire (cas du rapport utilisateur d'origine) :
  `"Acolyte de la Nature"` → `is_magic: true, needs_manual_check: false`
  (contient un signal fort lié à la nature/domaine, selon la liste de
  Step 03) ; `"Adaptation aquatique"` → `is_magic: false` (capacité
  extraordinaire, pas magique — c'est un cas de gating racial/de capacité,
  pas magique, donc hors scope de ce flag, documenté pour Step 09).
- Un échantillon d'au moins 10 dons de combat purs connus (ex. "Attaque en
  puissance") doit ressortir `is_magic: false, needs_manual_check: false`.
- Confirme l'usage correct des listes héritées de Step 03 : toute liste
  effectivement utilisée par le script doit être traçable au document de
  calibration, sans divergence non signalée.

## Git Handling

- Branche : `feature/feat-details-tag-magic`, basée sur les branches mergées
  de Step 03 et Step 06.
- Commit : script + `Data/feat_magic_info.json` généré.
- Message : `data: tag feats as magic-dependent via keyword heuristics`

## Expected Outcome

`Data/feat_magic_info.json` fournit à Step 10 un flag par don, fiable sur les
cas nets et honnête (`needs_manual_check`) sur les cas ambigus.
