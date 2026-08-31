# 04_STEP — Recherche vérifiée : accès à la magie pour TOUTES les classes (y compris hybrides/occultes)

## Objectives

Produire un document de recherche vérifié,
`build/feat-detail-and-magic-gating/OUTPUT_class_caster_ground_truth.md`,
qui tranche — avec les vraies règles Pathfinder 1re édition, pas une
heuristique par mots-clés — si CHAQUE classe connue du système a accès à la
magie (`is_caster`) et de quel type (`type`), avec une justification courte
et vérifiable pour chacune. Ce step existe parce que le plan initial ne
proposait qu'une table `GROUND_TRUTH` partielle en pseudo-code pour Step 07,
laissant les classes hybrides/occultes non vérifiées une par une — l'
utilisateur a explicitement demandé une vérification complète de toutes les
classes hybrides.

## Dependencies & Parallelization

- Wave 1. Aucune dépendance de fichier — recherche fondée sur la
  connaissance des règles Pathfinder 1e (et, si besoin, des pages de classe
  déjà scrapées dans `Data/class_features.json`, déjà présent dans le repo)
  plutôt que sur un nouveau scraping.
- Consommé par **Step 07** (curation de `Data/class_caster_info.json`), qui
  doit copier ce document tel quel dans sa table de vérité terrain, sans le
  ré-interpréter ni le deviner à nouveau.

## Inherited Context from Dependencies

Aucune. Liste exhaustive et figée des classes à couvrir — **une par une,
aucune omission tolérée** — reprise de
`pf1_dons/class_progression.py::CLASS_BBA_PROGRESSION` au moment de ce
planning :

Classes de base : `barbare`, `barde`, `druide`, `ensorceleur`, `guerrier`,
`magicien`, `moine`, `paladin`, `pretre`, `rodeur`, `roublard`.

Classes supplémentaires : `alchimiste`, `antipaladin`,
`chasseur de vampire`, `chevalier`, `conjurateur`, `inquisiteur`,
`justicier`, `magus`, `metamorphe`, `ninja`, `oracle`, `pistolier`,
`samourai`, `sorciere`.

Classes hybrides : `arcaniste`, `bretteur`, `chaman`, `chasseur`,
`enqueteur`, `lutteur`, `pretre combattant`, `sanguin`, `scalde`, `tueur`.

Classes occultes : `cinetiste`, `hypnotiseur`, `medium`, `occultiste`,
`psychiste`, `spirite`.

Alias courants : `cavalier` (alias de chevalier), `clerc` (alias de pretre).

Total : 42 clés. Si `pf1_dons/class_progression.py` a changé depuis ce
planning, relire le fichier réel et ajuster la liste — ne jamais couvrir une
liste plus courte que ce que ce fichier contient réellement au moment de
l'exécution.

## Pseudo-code

```
CLASSES_A_TRANCHER = [toutes les 42 clés listées ci-dessus]

POUR CHAQUE classe DANS CLASSES_A_TRANCHER :
    déterminer, avec les vraies règles PF1e :
      is_caster: bool
      type: "arcane" | "divine" | "psychique" | null (null si is_caster=false)
      lanceur: "complet" | "partiel" | "aucun"  (informatif, pas consommé
               tel quel par le moteur, mais utile pour la justification)
      justification: une phrase courte citant la mécanique PF1e concrète
               (ex. "progression de sorts arcaniques complète, comme
               magicien/ensorceleur" ou "aucune progression de sorts dans
               les règles de base ; purement martial")

    SI incertain après recherche (cas réellement limite, ex. une classe qui
    n'a de magie que via un ARCHÉTYPE optionnel et pas dans sa progression
    de classe de base) :
        trancher explicitement sur la CLASSE DE BASE (sans archétype), et
        noter l'archétype magique existant comme remarque à part —
        ne jamais laisser une classe sans verdict is_caster ferme.

ÉCRIRE OUTPUT_class_caster_ground_truth.md : un tableau markdown avec les
colonnes classe | is_caster | type | lanceur | justification, une ligne par
classe des 42, triées alphabétiquement, plus une section "Cas limites
notés" pour les classes où un archétype changerait la réponse.
```

## Logic Flow

1. Traiter d'abord les classes évidentes (lanceurs complets connus, martiaux
   purs connus) pour poser un référentiel de justification cohérent.
2. Traiter ensuite, une par une et sans exception, les classes hybrides et
   occultes explicitement listées par l'utilisateur comme préoccupation
   (`bretteur`, `ninja`, `samourai` cités nommément, plus toutes les autres
   classes supplémentaires/hybrides/occultes de la liste) :
   - `antipaladin`, `paladin`, `rodeur` : lanceurs partiels divins (mécanique
     PF1e standard, à confirmer/justifier).
   - `magus`, `sanguin`, `sorciere`, `arcaniste` : lanceurs (complets ou
     partiels) arcaniques.
   - `inquisiteur`, `chaman`, `pretre combattant`, `oracle` : lanceurs divins
     (complets ou partiels selon la classe).
   - `cinetiste`, `hypnotiseur`, `medium`, `occultiste`, `psychiste`,
     `spirite` : classes occultes, presque toutes lanceuses psychiques —
     vérifier individuellement (le cinétiste par ex. utilise des points
     d'énergie plutôt que des emplacements de sorts classiques, mais reste
     considéré comme ayant accès à des capacités de nature magique/psychique
     pour ce gating — trancher explicitement `is_caster=true` ou `false`
     avec justification, ne pas laisser ambigu).
   - `bretteur`, `ninja`, `samourai`, `pistolier`, `chasseur de vampire`,
     `justicier`, `chevalier`/`cavalier`, `lutteur`, `tueur`, `chasseur`,
     `enqueteur`, `metamorphe`, `alchimiste`, `conjurateur` : classes très
     majoritairement martiales/à talents dans les règles de base — vérifier
     individuellement s'il existe une progression de sorts dans leur
     progression de CLASSE DE BASE (pas un archétype) avant de conclure
     `is_caster=false`. Noter : `alchimiste` a des "formules" (extraits) qui
     fonctionnent comme des sorts alchimiques — trancher explicitement si
     cela compte comme accès à la magie pour ce gating (probable `true`,
     type `arcane`/`alchimique`, à justifier).
3. Toute classe non couverte à la fin doit être considérée comme un échec de
   ce step — vérifier la liste de sortie contre `CLASSES_A_TRANCHER` avant
   de conclure.

## Implementation Notes

- Ceci est un step de recherche documentaire, pas de code. S'appuyer sur la
  connaissance des règles Pathfinder 1e et, en complément, sur
  `Data/class_features.json` déjà présent dans le repo (table de
  progression de capacités par classe, scrapée depuis pathfinder-fr.org)
  pour confirmer/sourcer chaque verdict plutôt que de trancher de mémoire
  seule quand un doute existe.
- Le type `"psychique"` doit être utilisé pour les classes occultes qui
  lancent des sorts psychiques (liste de sorts occulte PF1e), à distinguer
  explicitement de `"arcane"`/`"divine"`.
- Ne pas introduire de type autre que `arcane`/`divine`/`psychique`/`null`
  sans le justifier et le signaler explicitement en tête du document (Step 07
  devra alors gérer cette valeur supplémentaire).

## Verification Criteria

- Le document contient exactement 42 lignes de classe (ou le nombre réel
  trouvé dans `CLASS_BBA_PROGRESSION` au moment de l'exécution si celui-ci a
  changé), aucune omise.
- Chaque classe hybride/occulte nommément citée par l'utilisateur
  (`bretteur`, `ninja`, `samourai`) a une ligne avec un verdict ferme et une
  justification, pas un "incertain" laissé en suspens.
- Aucune ligne avec `is_caster` vide/non tranché.

## Git Handling

- Branche : `feature/feat-details-class-caster-research` (worktree dédié,
  Wave 1).
- Commit : uniquement `OUTPUT_class_caster_ground_truth.md`.
- Message : `docs: verify magic access for every class including hybrids`

## Expected Outcome

Step 07 dispose d'une table de vérité terrain complète et vérifiée pour les
42 classes, éliminant tout jugement improvisé au moment de la curation.
