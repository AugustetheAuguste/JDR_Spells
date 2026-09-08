# 12 PERSONNAGES REFERENCE — rapport

## Résumé

Quatre personnages de référence (`guerrier-lourd`, `roublard`, `magicien`,
`moine`), leurs valeurs attendues (`web/fixtures/fiche_personnage/attendus.json`),
la suite `references.test.ts` qui les vérifie contre les vraies tables de
`web/public/data/regles/`, et les trois suites transverses
(`non-cumul.test.ts`, `introuvable.test.ts`, `migration.test.ts`). 99 tests
nouveaux, tous verts ; `npm run web:test` (tests + eslint + tsc strict) rend
un code de sortie 0 sur l'ensemble du dépôt web.

**Aucune correction du moteur n'a été nécessaire.** Un seul commit a donc été
fait (`test(fiche) figer quatre personnages de reference`,
`079e7969`) — pas de second commit `fix(fiche)`.

## Limite d'environnement rencontrée

`WebFetch` vers `pathfinder-fr.org` rend systématiquement **HTTP 403** dans cet
environnement (testé sur la page du Moine). Aucune vérification directe d'une
page du wiki n'a donc été possible pendant cette étape. Conformément à la
règle du dépôt (« une lacune assumée... est un résultat acceptable ; une
invention silencieuse est un échec »), toute valeur qui aurait dû être
vérifiée sur une page non atteignable a été laissée `introuvable` plutôt
qu'inventée, et n'entre pas dans `attendus.json`. Les valeurs de règle déjà
présentes dans le dépôt sous forme de tables **déjà sourcées** par une étape
antérieure (`web/public/data/regles/*.json`, dont le `meta.sources` cite les
pages consultées) ont, elles, été utilisées et considérées comme sourcées —
ce sont elles qui font l'essentiel du sourcing de ce rapport.

## Sourcé

- `web/public/data/regles/progression_classes.json` — BBA, série d'attaques et
  bases des trois sauvegardes du Guerrier, du Roublard et du Magicien niveau 6 ;
  emplacements de sorts de base du Magicien niveau 6 (`meta.sources` cite
  `Pathfinder-RPG.Guerrier.ashx`, `.Roublard.ashx`, `.Magicien.ashx`,
  générées par `tools/regles/parser_progression_classes.py`).
- `web/public/data/regles/armures.json` — Armure de plaques (Guerrier,
  catégorie lourde, +8 CA, Dex max 0, malus -7, vitesse 9→6 m) et Armure de
  cuir cloutée (Roublard, catégorie légère, +3 CA, Dex max +5, malus -1,
  vitesse 6→6 m inchangée) — `meta.sources` cite « Tableau récapitulatif des
  armures ».
- `web/public/data/regles/modificateurs_caracteristiques.json` — bornes de
  modificateur de caractéristique, table complète, utilisée pour tous les
  scores effectifs des quatre personnages.
- `web/public/data/regles/sorts_bonus.json` — sorts en bonus pour un
  modificateur de +5 (Intelligence effective 20 du Magicien), utilisée pour
  les emplacements niveaux 1 à 3.
- `web/public/data/regles/types_bonus.json` — les cinq types de bonus réels
  (`alteration`, `parade`, `armure_naturelle`, `esquive`, `taille`), parcourus
  par `non-cumul.test.ts`.
- `data/races/races.json` — modificateurs raciaux d'ability score et vitesse
  de base de l'Humain (+2 au choix, vitesse 9 m), du Halfelin (Dex+2, Cha+2,
  For-2, taille P, vitesse 6 m) et de l'Elfe (Dex+2, Int+2, Con-2, vitesse
  9 m). Cette table n'a pas de `meta.sources` avec URL propre (structure
  plate) — transcrite telle quelle, cf. lacune ci-dessous sur le détail de sa
  provenance interne.
- Formules citées dans les docstrings déjà en place du moteur
  (`defense.ts`, `combat.ts`, `sauvegardes.ts`, `attaques.ts`, `sorts.ts`),
  elles-mêmes sourcées sur pathfinder-fr.org par les étapes 09 à 11 :
  Valeurs de combat, Manœuvres offensives, Le déroulement d'un combat,
  Lancer des sorts, Niveau de lanceur de sorts, Caractéristiques.

## Déduit

- Scores de caractéristique effectifs = base saisie + modificateur racial
  (type `racial`, hors des cinq types connus de `types_bonus.json` — retenu
  intégralement par construction du moteur, jamais bloquant).
- CA, initiative, BMO, DDM, sauvegardes, bonus d'attaque, bonus de dégâts,
  emplacements de sorts et DD calculés main dans la main avec le moteur
  lui-même à partir des tables ci-dessus (calcul vérifié deux fois : à la main
  puis par le test).
- Constat notable pendant la vérification à la main : le bonus de taille
  appliqué au **bonus d'attaque** (`attaques.ts`) vient de la même table que
  celui de la **CA** (`MODIFICATEURS_TAILLE_CA`, Petit = +1), et non de la
  table dédiée aux manœuvres (`MODIFICATEURS_TAILLE_MANOEUVRE`, Petit = -1)
  utilisée par le BMO/DDM. Une première version de `attendus.json` pour le
  Roublard avait mélangé les deux tables (bonus d'attaque à 3 au lieu de 5) ;
  l'erreur a été trouvée par le premier lancement des tests, **avant** tout
  passage au vert, et corrigée dans `attendus.json` en citant le code source
  exact de `attaques.ts` qui partage la table de la CA — pas une correction
  après coup d'un attendu déjà vert, cf. critère de vérification n°7.
- BBA et sauvegardes de base du Magicien/Guerrier/Roublard : lus directement
  dans `progression_classes.json`, jamais recalculés d'une formule.

## Inventé

- Répartition des 42 caractéristiques (les seize valeurs de base du tableau
  du plan) : imposées par l'énoncé de l'étape, pas une invention de cette
  étape.
- Choix d'équipement ordinaire : Armure de plaques pour le Guerrier, Armure
  de cuir cloutée pour le Roublard, aucune armure pour le Magicien et le
  Moine ; une arme par personnage (Épée longue, Épée courte, Dague) — choix
  de personnage légitimes ici (cf. Notes d'implémentation du plan).
- Choix du +2 racial humain « au choix » : Force pour le Guerrier, Sagesse
  pour le Moine — choix de construction de personnage, pas une règle.
- Points de vie maximum saisis arbitrairement pour chaque personnage (valeur
  de choix de joueur/dé, jamais recalculée depuis le dé de vie, cf. docstring
  de `pointsDeVieMaximum`) : hors de `attendus.json`, non vérifiés contre une
  règle puisqu'ils n'en dérivent pas.
- Dé de dégâts, plage de critique et portée des trois armes (Épée longue,
  Épée courte, Dague) : valeurs SRD usuelles transcrites de mémoire, **non
  vérifiées** sur pathfinder-fr.org (WebFetch inatteignable, aucune table
  d'armes locale déjà sourcée dans le dépôt). Ces champs sont requis par le
  schéma (`Attaque.des`, `.critique`, `.portee`) mais ne sont lus par aucune
  fonction du moteur ici testée (le moteur ne recalcule jamais le dé, cf.
  docstring d'`attaques.ts`) : ils n'entrent donc dans aucune assertion
  d'`attendus.json`. Signalé explicitement pour que l'étape 15 (ou une
  relecture humaine) sache qu'ils restent à vérifier avant tout affichage en
  tant que valeur de règle.

## Lacunes assumées

- **Le Moine n'a pas de table de progression** :
  `web/public/data/regles/progression_classes.json` porte `progression: null`
  pour `moine` (page non capturée aux étapes 05/06 — anomalie déjà présente
  dans le dépôt, hors du périmètre de cette étape). Une vérification directe
  de `Pathfinder-RPG.Moine.ashx` a été tentée via `WebFetch` et a échoué
  (HTTP 403). Consécutivement, `combat.bbaBase` et les trois bases de
  sauvegarde du Moine restent `null` dans sa fixture, et `manoeuvreOffensive`,
  `manoeuvreDefensive`, les trois `sauvegardes` et `serieAttaques` sont
  déclarés `introuvable` dans `attendus.json` plutôt que devinés.
- **Le bonus de CA sans armure du Moine et sa non-réduction de vitesse**,
  capacités de classe distinctives visées par le plan pour ce personnage, ne
  sont **pas** représentées dans la fixture : leur type de bonus exact et
  leur existence même n'ont pas pu être vérifiés (même blocage HTTP 403). La
  fixture du Moine ne teste donc, pour la défense, que le chemin générique
  « aucune armure portée » du moteur (`classeArmure`/`vitesse`), pas la règle
  spécifique au Moine. C'est une lacune du personnage de référence par
  rapport à l'intention du plan, assumée et documentée ici plutôt que
  masquée par une valeur inventée.
- **Dé/critique/portée des trois armes** : cf. § Inventé, non vérifiés,
  hors `attendus.json`.
- **`data/races/races.json` n'a pas de `meta.sources`** propre (structure
  plate, contrairement aux tables sous `web/public/data/regles/`) : ses
  valeurs sont utilisées ici comme si elles étaient déjà sourcées par
  l'étape qui les a produites, sans reconfirmation indépendante sur
  pathfinder-fr.org dans cette étape (blocage HTTP 403).
- **Compétences** : `rangs` est laissé `null` pour toutes les compétences des
  quatre fixtures (aucune compétence saisie du tout, en fait), par construction
  du plan (« expose la limite optimiste... sans l'importer ») — `totalCompetence`
  rend systématiquement `introuvable`, couvert par `introuvable.test.ts` mais
  absent de `attendus.json` et de `references.test.ts` (aucune clé
  `competences` dans `attendus.json`, contrairement au gabarit du plan qui la
  prévoyait — omise plutôt que remplie de zéros).
- **Type `racial` des modificateurs de caractéristique** : absent des cinq
  types de `types_bonus.json`. Le moteur le traite comme un type inconnu :
  il retient intégralement la valeur et l'ajoute à ses `manquants` internes.
  Vérification faite que cette liste de `manquants` interne à
  `valeurEffectiveCaracteristique`/`resoudre` n'est **jamais** propagée par
  les fonctions de plus haut niveau testées ici quand leur total n'est pas
  `null` (elles ne recopient les `manquants` de la caractéristique que sur
  l'échec) : les 99 tests le confirment, `manquants` reste vide sur toute
  grandeur dont le total est un nombre.

## Critères de vérification du plan — statut

1. `npm run web:test` passe (tests, lint, tsc strict) — **fait**, code 0.
2. Les quatre fixtures passent `valider()` avec `ok: true` — **fait**,
   vérifié dans `references.test.ts` (`beforeAll` de chaque `describe`).
3. Chaque fixture porte dans `notes` la liste des URL/tables consultées —
   **fait**, avec la réserve HTTP 403 documentée dans chaque fixture
   concernée (Guerrier, Roublard, Magicien, Moine).
4. `attendus.json` ne contient aucune valeur non vérifiée — **fait** :
   toute grandeur non vérifiable (Moine : BMO/DDM/sauvegardes/série
   d'attaques) est absente du fichier, listée en lacune ci-dessus.
5. `introuvable.test.ts` couvre toutes les fonctions publiques du moteur,
   avec comparaison automatique aux exports des huit modules — **fait**
   (`FONCTIONS_COUVERTES` comparé dynamiquement à `Object.entries(module)`
   pour chacun des huit modules ; échoue si une fonction exportée n'y figure
   pas). Nuance assumée : la comparaison vérifie la **présence** de chaque
   fonction dans la liste couverte, pas que chacune reçoive nécessairement
   une assertion « total nul » dédiée — certaines (ex. `normaliserTaille`,
   `convertirAbreviationCaracteristique`) ne suivent pas le contrat
   `{total, detail, manquants}` et sont couvertes par construction plutôt que
   par un test `introuvable` direct.
6. `non-cumul.test.ts` itère sur les types réels de `types_bonus.json`,
   jamais une liste recopiée à la main — **fait** (`TYPES_REELS` lu depuis
   le fichier). Constat documenté dans le test lui-même : aucun type réel de
   la table publiée n'a `cumulable: false` aujourd'hui ; ce cas est donc
   éprouvé synthétiquement dans le même fichier, pas sur un type réel.
7. Aucun attendu modifié après un premier passage vert — **fait** : la seule
   correction d'`attendus.json` (bonus d'attaque du Roublard, cf. § Déduit)
   a eu lieu **avant** le premier passage vert de la suite complète, sur la
   base d'une relecture du code source de `attaques.ts`, pas d'un
   ajustement pour faire passer le test.
8. Bloc de traçabilité à quatre parties — **fait**, ci-dessus.
9. Aucun chemin hors du dépôt — **fait**, vérifié par relecture des fixtures
   et des tests (aucune URL ni chemin absolu hors de
   `C:\Users\...\JDR_Spells` ou de `pathfinder-fr.org`).

## Fichiers créés

- `web/fixtures/fiche_personnage/guerrier-lourd.json`
- `web/fixtures/fiche_personnage/roublard.json`
- `web/fixtures/fiche_personnage/magicien.json`
- `web/fixtures/fiche_personnage/moine.json`
- `web/fixtures/fiche_personnage/attendus.json`
- `web/lib/fiche_personnage/references.test.ts`
- `web/lib/fiche_personnage/non-cumul.test.ts`
- `web/lib/fiche_personnage/introuvable.test.ts`
- `web/lib/fiche_personnage/migration.test.ts`

Commit : `079e7969` — `test(fiche) figer quatre personnages de reference`.
Aucun second commit `fix(fiche)` : le moteur n'a nécessité aucune correction.
