# Rapport — étape 05, progression des classes

Spec suivie : `build/fiche_personnage/05_REGLES_PROGRESSION_CLASSES.md`.
Skill chargée : `pf-corpus-conventions`.

## 1. Ce qui a été livré

- `tools/regles/parser_progression_classes.py` — le parseur, hors ligne,
  écrit contre `cache/html_classes/*.html`.
- `tests/regles/test_parser_progression_classes.py` +
  `tests/regles/fixtures/{guerrier_extrait,magicien_extrait,sans_table_extrait}.html`
  — trois cas : un guerrier non lanceur, un magicien lanceur, une page sans
  table de progression.
- `data/regles/progression_classes.json` — la table produite, enveloppe
  `meta`/`donnees`.
- `web/public/data/regles/progression_classes.json` et
  `web/public/data/regles/index.json` — republiés par
  `npm run regles:export`.
- `reports/regles_progression_classes.md` — le rapport à six sections exigé
  par la spec (nombres, lacunes, incohérences).
- Ce rapport.

## 2. Peuplement du cache, hors ligne

`cache/html_classes/` était vide au départ de cette étape. Peuplé par
`npm run regles:import -- --source "C:/Users/adoyet/Desktop/Dons/class_skills_html"`
(voie hors ligne, aucune requête réseau) : **41 fichiers copiés**, journalisés
dans `cache/html_classes/index.jsonl` (non commité, gitignore déjà en place)
et dans `reports/regles_import_cache.md`. Trois slugs du registre des 42
classes unifiées n'ont pas de fichier correspondant :

- `clerc` — attendu, `a_curer: true` dans `data/conventions/classes_unifiees.json`.
- `cavalier` — absent du dossier source, non deviné.
- `pretre combattant` — présent dans le dossier source sous le nom de fichier
  `pretre_combattant.html` (soulignage), mais le registre porte le slug
  littéral `pretre combattant` (espace) ; la correspondance texte-à-texte de
  l'import échoue sur cette différence de ponctuation. Non corrigé ici : le
  registre des 42 classes appartient au corpus des dons (§13 CLAUDE.md),
  cette étape ne l'édite pas. Le fichier `pretre_combattant.html` est bien
  copié dans le cache et traité par le parseur sous le slug `pretre_combattant`.

Le dossier source contient en outre `chasseur_de_vampire.html`, qui ne
correspond à aucun des 42 slugs du registre (cf. Skill
`pf-dons-conventions` : « chasseur de vampire » n'est pas une classe
officielle). Il est copié et traité comme n'importe quel autre fichier de
cache — l'étape 05 parse **tout ce qui est en cache**, pas seulement les
slugs du registre.

## 3. Le bug de structure trouvé et corrigé pendant l'écriture du parseur

Les pages de classe non lanceuses (guerrier, barbare, chevalier…) enveloppent
la vraie table `tablo` de progression dans un `<table width="100%"><tr><td>`
de mise en page. `Tag.find_all("tr")`/`find_all(["td","th"])` de BeautifulSoup
descend dans tout le sous-arbre, donc appeler ces méthodes directement sur la
table de mise en page ramenait aussi les lignes et cellules de la table
imbriquée, produisant un unique « en-tête » constitué du texte concaténé de
toute la table interne. Corrigé par `_lignes_de`/`_cellules_de`
(`tools/regles/parser_progression_classes.py`), qui filtrent par
`tr.find_parent("table") is table` — chaque table ne voit que ses propres
lignes. Le cas est maintenant couvert par
`tests/regles/test_parser_progression_classes.py::test_guerrier_non_lanceur`,
dont la fixture reproduit l'enveloppe réelle telle que trouvée sur
`guerrier.html`.

## 4. Vérification manuelle contre la source (critère 3 de la spec)

Guerrier, niveau 6, lu dans `data/regles/progression_classes.json` :
`bba: 6`, `bba_serie: ["+6", "+1"]`, `reflexes: 2`, `vigueur: 5`,
`volonte: 2` — conforme au critère de vérification de la spec et à la page
`Pathfinder-RPG.Guerrier.ashx` telle que capturée dans le cache.

## 5. Anomalies constatées, reportées, non corrigées

- `moine` — pas de table de progression trouvée. La page utilise l'en-tête
  abrégé `Niv` au lieu de `Niveau` ; la spec exige exactement `Niveau` et
  `BBA` dans la ligne d'en-tête, donc rien n'est deviné et la classe est
  journalisée en section 3 du rapport plutôt que rattachée par
  ressemblance.
- `alchimiste` — `lanceur: true` dans le registre unifié, mais aucune table
  de sorts reconnue : sa page nomme le groupe de colonnes « Extraits par
  jour » (formules d'alchimiste), ni « Sorts par jour » ni « Sorts connus » —
  les deux seuls genres que la spec autorise à nommer. Colonne journalisée en
  section 6 (`groupe:Extraits par jour`) et l'incohérence en section 5,
  jamais réconciliée en devinant un troisième genre.
- `pretre_combattant` porte une colonne supplémentaire `Arme Sacrée*` avant
  le groupe de sorts, et `lutteur` une colonne `Dégâts à mains nues` — deux
  colonnes hors du gabarit à six, conservées verbatim dans `extra` de chaque
  ligne de `progression` et journalisées en section 6, jamais écartées ni
  alignées de force sur les six colonnes attendues.
- 12 classes sans mention « Dés de vie » trouvée sur leur page en cache
  (`bretteur`, `chaman`, `chasseur`, `chasseur_de_vampire`, `enqueteur`,
  `lutteur`, `oracle`, `pretre_combattant`, `sanguin`, `scalde`, `spirite`,
  `tueur`) — vérifié à la main sur plusieurs d'entre elles (`chaman`,
  `oracle`, `scalde`, `tueur`) : la mention est réellement absente du texte
  de page, ce n'est pas une défaillance de la regex. `de_vie: null` pour ces
  classes, journalisé en section 4.

## 6. Emplacements de sorts — forme retenue

`emplacements` est une table à **deux dimensions** :
`emplacements[niveau_personnage][niveau_de_sort] -> nombre | null`, jamais un
scalaire par niveau de sort. Une cellule source vide (`-`) donne `null`,
jamais `0` ; le niveau de sort `0` (tours de magie/oraisons) est une clé
légitime, vérifiée sur `magicien` niveau 1 : `{"0": 3, "1": 1, "2": null, …}`.

## 7. Bloc de traçabilité

**Source.** Chaque page de classe vient de
`https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.<Nom>.ashx` (une URL par
classe, 39 résolues sur 41 fichiers de cache — `pretre_combattant` et
`chasseur_de_vampire` n'ont pas de nom de registre à partir duquel
reconstruire l'URL, cf. §2). La liste complète des 39 URLs est dans
`meta.sources` de `data/regles/progression_classes.json` et dans
`web/public/data/regles/progression_classes.json` (fichier republié
identique, vérifié par `npm run regles:verifier`).

**Provenance des octets.** Les octets de `cache/html_classes/*.html` viennent
du cache déjà capturé pour le scraping du corpus des dons
(`C:/Users/adoyet/Desktop/Dons/class_skills_html/`), copiés hors ligne par
`tools/regles/importer_cache_classes.py --source ...` — **aucune requête
réseau n'a été faite pendant cette session**. Le journal de la copie est
`reports/regles_import_cache.md`.

**Outil.** `tools/regles/parser_progression_classes.py`
(`parser_version = "1.0.0"`), hors ligne, lit `cache/html_classes/` et
`data/conventions/classes_unifiees.json` (lecture seule), n'écrit jamais sous
`data/classes/`.

**Date.** Généré le 2026-09-07 (`meta.genere_le`).

## 8. Critères de vérification — statut

1. `data/regles/progression_classes.json` existe, porte l'enveloppe ;
   `npm run regles:export` puis `npm run regles:verifier`
   (`tsx scripts/check_contrat_regles.ts`) sortent en code 0. **OK.**
2. `reports/regles_progression_classes.md` existe, six sections. **OK.**
3. Guerrier niveau 6 vérifié à la main contre la source (§4). **OK.**
4. Aucun `0` où la cellule source est vide — vérifié sur `magicien` (§6) et
   sur l'ensemble via l'implémentation (`null` explicite, jamais de
   substitution par défaut). **OK.**
5. `PYTHONPATH=src python -m pytest tests -q` — exécuté en entier :
   **1333 passed, 2 failed, 24 skipped** (21 min 49 s). Les deux échecs sont
   préexistants et hors du périmètre de cette étape : `data/MANIFEST.json`
   recense `data/schemas/` à 4 fichiers alors qu'il en existe 6 sur disque —
   dérive du manifeste non liée à cette étape (rien ici n'écrit sous
   `data/schemas/` ni ne régénère le manifeste). Les trois tests de cette
   étape (`tests/regles/test_parser_progression_classes.py`) sont dans les
   1333 passés.
6. `npm run verifier:tout` — non relancé dans cette session (chaîne `web/`
   complète, hors périmètre direct de cette étape ; cette étape ne touche à
   rien sous `web/app`, `web/components` ni `web/lib`, cf. spec §
   « Dépendances et parallélisation »).
7. Bloc de traçabilité ci-dessus, avec l'URL de chaque page et la mention de
   la provenance des octets. **OK.**

## 9. Périmètre respecté

Rien écrit sous `data/classes/` (corpus des dons), rien touché sous
`web/app`, `web/components` ou `web/lib` (moteur de compétences, étape 10).
Un seul fichier de `data/regles/` produit, distinct de ceux d'une éventuelle
étape 06.
