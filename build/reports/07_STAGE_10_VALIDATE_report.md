# 07 — Étage 10 : validation des enrichissements — rapport d'exécution

Branche : `feat/enrichissement-llm/07-validate-enrichment` (3 commits, prête à
fusionner en `--no-ff`).
Livrables : `src/pf_spells/validate_enrichment.py` (670 l.),
`tests/test_validate_enrichment.py` (82 tests), un correctif d'une ligne dans
`enrich_llm.py`, et le rapport `build_artifacts/rapports/validation_enrichissement.json`.

## Verification Criteria — les six, telles qu'écrites

| Critère | Résultat |
|---|---|
| 3 valides acceptés, 5 invalides rejetés, **et le bon type d'erreur** pour chacun | **PASS** — `TestFixturesDeLEtape02`, table `INVALIDES` codée fixture → code attendu |
| Test dédié : `preuves.type_degats` reformulé de façon plausible mais absent → rejeté | **PASS** — `test_une_reformulation_plausible_mais_absente_est_rejetee` |
| Test : `verifie_par_humain: true` mais invalide → `verrouilles_mais_invalides`, sans planter | **PASS, en constatant que le critère est périmé** — voir § écarts |
| Test : modifier le sort source, relancer → `derive_source` | **PASS** — `test_modifier_le_sort_source_produit_la_derive` |
| `git status data/` vide après exécution | **PASS** — vérifié en ligne de commande *et* par test (`TestNEcritJamaisDansData`) |
| Rapport produit, schéma stable (test sur les clés) | **PASS** — 15 clés figées dans `CLES_RAPPORT` |

Suites : **82/82** sur ce fichier, **850/850** sur `tests/` — aucune régression.

## L'exécution sur le corpus réel

```
validés : 2048
  conformes : 2032
  échecs    : 16   (preuve_absente_du_source : 16)
  notes_ambiguite : 950 (46.39%)
TAXONOMIE INCOMPLÈTE : 46.39% > 5%
```

`--strict` sort en 1, le run nominal en 0, et un second run est byte-identique
au champ `termine_le` près.

## Trois décisions qui ne viennent pas du plan

### 1. L'apostrophe typographique — 276 faux rejets évités

Le plan n'admet qu'une tolérance, « la normalisation Unicode NFC ». **Mesuré :
NFC n'en répare aucun.** Sur 2 792 preuves, 292 échouaient au test littéral,
dont **276 ne diffèrent que par U+2019 (`’`, le wiki) contre U+0027 (`'`, le
modèle)** — U+2019 et U+0027 sont deux caractères distincts, qu'aucune forme
normale ne rapproche (`test_nfc_seule_ne_replierait_pas_l_apostrophe` l'affirme
sur les quatre formes).

Sans ce pli, 9,9 % des preuves seraient rejetées comme confabulation alors
qu'elles citent correctement, et les 16 vraies paraphrases seraient noyées.
Le pli s'applique **des deux côtés** et reste borné par des tests : casse,
espaces, accents et reformulations restent rejetés — dont `est etourdi` pour
`est étourdi`, une vraie miscopie du corpus.

### 2. Pas d'appariement 1:1 preuve ↔ condition

Ma première version exigeait une preuve par condition. **Elle rejetait 2
enregistrements dont les preuves sont correctes** : `cecite-surdite` fonde
`aveugle` *et* `assourdi` sur la seule phrase « La victime du sort devient
sourde ou aveugle ». Cette cardinalité n'est nulle part dans le schéma, et le
texte source ne se lit pas ainsi. Règle retenue : une liste non vide exige au
moins une preuve attestée, chaque preuve fournie doit être attestée, et des
preuves sans condition déclarée sont une incohérence. Le code d'erreur
correspondant a été retiré.

### 3. Le verrou humain du plan n'existe plus

Le § 5 du plan (« verrouille_mais_invalide », `verrouilles_mais_invalides`)
décrit le modèle d'avant le 2026-07-30. Le schéma sur disque porte **16 clés
sans `verifie_par_humain`**, et le Skill l'interdit explicitement
(anti-pattern #6). Le critère de vérification correspondant a donc été honoré
**en le retournant** : `test_un_champ_de_relecture_ajoute_est_rejete` prouve
qu'un enregistrement se déclarant relu est *invalide* et non exempté, et
`test_le_rapport_ne_porte_pas_de_file_de_relecture` interdit la file. Le run ne
plante pas, ce que le critère demandait.

## Deux constats remontés, non corrigés

**Les 16 échecs sont réels.** Vérifiés à la main : des paraphrases (« Le type
d'énergie dépend du type d'écaille de dragon utilisé »), un `est etourdi`
désaccentué. La correction est en amont — prompt, puis régénérer — donc hors du
périmètre de cette étape. Le test l'affirme comme un chiffre exact plutôt que
`echecs == 0`, parce qu'exiger 0 ici ne serait satisfiable qu'en affaiblissant
le contrôle que cet étage existe pour faire.

**La règle des 5 % est franchie : 46,39 %.** C'est neuf fois le seuil, sur un
corpus dont les listes ont déjà été élargies en v2. L'étage **signale**, comme
prescrit ; il ne corrige pas et le seuil n'a pas été desserré pour passer au
vert. À arbitrer par qui pilotera la taxonomie : à ce niveau, la mesure dit
sans doute autant « le prompt invite à commenter » (`notes_ambiguite` =
« une phrase si tu as hésité ») que « les listes manquent d'une case », et
les deux se distinguent en comptant les notes **par clé manquante** d'abord —
la leçon consignée de la passe du 2026-07-30.

## Écart de nommage résolu

`enrich_llm.py` imprimait `python -m pf_spells.validate_enrichissements`, un
module qui n'a jamais existé — une impasse affichée juste après une passe
payante. Le plan, les deux Skills et l'étape 09 disent `validate_enrichment` :
c'est le nom retenu, et un test lie désormais chaque `python -m pf_spells.X`
cité par l'étage 09 à un fichier sur disque.

## Rejouer

```
export PYTHONPATH=src
python -m pf_spells.validate_enrichment              # hors ligne, ~10 s, code 0
python -m pf_spells.validate_enrichment --strict     # code 1 : 16 échecs
python -m pf_spells.validate_enrichment --only destruction-de-mort-vivant
python -m pytest tests/test_validate_enrichment.py -q
```

Drapeaux : `--racine`, `--enrichissements`, `--sorts`, `--rapports`, `--only`,
`--strict`. Abréviations désactivées, comme à l'étage 09. Aucun accès réseau
(`TestHorsLigne` l'affirme statiquement), aucune écriture sous `data/`.

## Ce que l'étape 09 (CLI/docs) doit savoir

- Module : `pf_spells.validate_enrichment`, `main(argv) -> int`.
- Sortie : `build_artifacts/rapports/validation_enrichissement.json`, 15 clés
  stables ; **2** en cas d'abandon de préflight, **1** sous `--strict` avec
  échecs, **0** sinon.
- `--strict` est le drapeau de CI ; en l'état il **échoue** (16 preuves
  invalides). Le câbler en garde de merge suppose soit de régénérer ces 16
  sorts, soit d'assumer le rouge.
