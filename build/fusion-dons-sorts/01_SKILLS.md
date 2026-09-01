# 01 — SKILLS : créer et amender les Skills dont tout le plan dépend

**Vague 1.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/01-skills`.

## Objectives

1. Créer `pf-dons-conventions` — l'autorité **humaine** sur le corpus de dons :
   les cinq couches de gating, le principe de sûreté, les distinctions que le
   moteur ne pardonne pas.
2. Créer `pf-dons-taxonomie` — les vocabulaires clos des dons, leurs libellés
   français, et la **règle de séparation des espaces de noms** avec les tags de
   sorts.
3. Amender `pf-web-design-system` — état tri-état, rampe de coût recalculée sur
   parchemin, rôles de couleur pour Cytoscape.
4. Résoudre la collision de Skill `verify` (I8) : renommer celui de `Dons` en
   `verify-dons-python`, amender celui du web.
5. Corriger I10 : `validate_palette.js` est documenté dans `Dons/CLAUDE.md` mais
   n'existe dans aucun des deux dépôts — retirer la mention ou la remplacer par
   le contrôle réel (`tokens.test.ts`).

## Dependencies & Parallelization

- **Vague 1. Aucune dépendance.** Ce fichier ne produit que du Markdown sous
  `.claude/skills/`.
- Aucune dépendance cachée : il ne lit aucun code, n'exécute aucun test, et
  n'écrit dans aucun fichier touché par `02`, `03` ou `04`.

## Inherited Context from Dependencies

Aucune étape amont. Tout le contenu nécessaire est ci-dessous.

### Format d'un Skill dans ce dépôt (à respecter à la lettre)

`.claude/skills/<nom>/SKILL.md`, frontmatter YAML :

```
---
name: <nom-du-dossier>
description: <une phrase, ce qu'il détient, se terminant par « à charger avant … »>
---

# <nom>

## Quand charger ce Skill
…
```

Les Skills existants (`pf-corpus-conventions`, `pf-enrichment-conventions`,
`pf-web-design-system`, `pf-bedrock-batch`) portent tous la même clause
d'autorité, à reproduire : **« Si le code et ce Skill divergent, le Skill gagne
et le code est corrigé. »**

### Contenu source de `pf-dons-conventions`

À transcrire depuis `Dons/CLAUDE.md` et les notes `Dons/build/*/OUTPUT_*.md`.
Points **non négociables**, chacun accompagné de l'erreur concrète qu'il corrige :

- **Principe de sûreté** : *une sous-attribution est bien plus grave qu'une
  sur-attribution*. Sur-attribuer ne coûte qu'un `manual_check` ; sous-attribuer
  produit un `ineligible` faux qui cache le don au joueur sans recours.
- **Les cinq couches de gating**, et le fait que chacune est **curée à la main** :
  1. `Data/classes/class_ability_map.json` — mot-clé de capacité → classes.
  2. `Data/conditions/prereq_gating.json` — 341 entrées, genre de chaque
     prérequis. `BLOCKING_KINDS` = `racial_trait`, `creature_type`, `anatomy`,
     `spellcasting`, `deity`, `alignment`, `mythic`, `class_ability`,
     `no_class_levels`. Non bloquants : `class_ability_unmapped`, `proficiency`,
     `feat`, `background`, `fragment`, `generic`.
  3. `Data/classes/class_caster_info.json` — 43 classes, accès à la magie.
     **Le scalde y était à tort non-lanceur** ; la correction est vérité terrain.
  4. `Data/dons/feat_class_restriction.json` — restriction visible *seulement*
     dans le texte d'avantage. Signal très peu spécifique (1 vrai positif pour
     49 candidats) : **jamais appliqué automatiquement**.
  5. `Data/classes/class_proficiencies.json` — 42 classes. Sur 31 entrées
     `proficiency`, **18** nomment une arme précise et sont bloquantes ; **13**
     dépendent d'un choix du joueur et restent non bloquantes **par décision,
     pas par lacune**. Ne pas franchir cette limite.
- **Classe inconnue ≠ aucune maîtrise.** `chasseur de vampire` est absente de
  `class_proficiencies.json` parce qu'aucune classe officielle de ce nom
  n'existe : elle doit donner `manual_check`, jamais `ineligible`.
- **`RACE_WEAPON_PROFICIENCY` et `RACE_WEAPON_RECLASSIFICATION`** : sans le
  second, un Guerrier nain était refusé à tort sur « Frappe de la vipère
  jaillissante ». La race peut reclasser une arme exotique en arme de guerre.
- **`_ANATOMY_SYNONYMS` doit rester en phrases longues** (« attaque de
  morsure ») : un synonyme court comme « langue » matchait le trait universel
  « Langues » et produisait des faux positifs.
- **Négations** : un segment commençant par `aucun niveau dans` produit
  `no_class_levels`, jamais `implied_classes` — sinon la règle est **inversée**
  et le moteur *exige* d'être bretteur au lieu de l'exclure.
- **`raw_conditions` ≠ `effective_conditions`.** Le premier est le texte du CSV,
  la source qu'un audit doit citer ; le second inclut
  `feat_prereq_supplements.json`. Ne jamais les confondre à l'affichage.
- **`repair_benefits` avant `filter_valid_rows`** : 127 lignes portaient
  `#ERROR!` dans `Avantages` (colonne que le moteur ne lit jamais). Les filtrer
  amputait 10 % du catalogue et cassait le graphe à ses nœuds les plus
  structurels (`Endurance`, prérequis de 15 dons). Invariant : **zéro prérequis
  de don pendant**.
- **`Character.skill_rank` est optimiste** : sans `skill_ranks` explicite il
  renvoie `level`. Défendable pour un dépistage, mais gonfle la liste.
- Les 6 entrées `class_ability_unmapped` sont le gisement de `manual_check`
  résiduel connu.

### Contenu source de `pf-dons-taxonomie`

Les 12 vocabulaires clos produits par `scrappers/tag_feat_semantics.py`, et
leurs libellés français, sont **déjà écrits** dans la table `LIBELLES` de
`Dons/web/explorateur_dons.js` (lignes ~45–120) : les reprendre verbatim.
Champs : `effet_principal` (18 valeurs, axe primaire), `effets_secondaires`,
`cible_du_bonus`, `valeur_bonus`, `contexte`, `activation`, `utilisations`,
`polyvalence`, `resume_court`, `mots_cles`, `categorie_officielle`, `confiance`.

Règles à figer dans ce Skill :

- **Les vocabulaires sont renormalisés côté client** (`normaliser_fiche`) : les
  `enum` du schéma d'outil ne sont **pas** appliqués sur le chemin Bedrock
  utilisé. Hors-vocabulaire → `None`, jamais une valeur qui pollue une facette.
- **Séparation des espaces de noms (I5)** : les tags de sorts (35) et les
  facettes de dons sont **disjoints**, sauf **`bonus_chiffre`**, présent dans les
  deux avec le même sens. Ils ne doivent **jamais** partager une clé d'URL :
  `?dons_effet=`, `?dons_cible=`, `?dons_contexte=` — jamais `?tags=`.
- **`polyvalence` est une facette faible** : `conditionnel` pour 61 % des dons.
  Ne pas la présenter comme filtre principal.
- Les clés du JSON restent les identifiants stables ; **seul l'affichage est
  traduit**, ce qui garde le contrat de données indépendant de la langue.

### Contenu de l'amendement de `pf-web-design-system`

Trois ajouts, chacun avec sa justification :

1. **État tri-état du don** (`eligible` / `manual_check` / `acquis`).
   `manual_check` est l'état **majoritaire** (236 sur 459 pour un Guerrier 6) :
   il ne peut pas être stylé comme une exception. Il passe par **bordure en
   tirets + un « ! » textuel**, **jamais par la teinte seule** — un daltonien
   doit le lire, et 51 % des lignes en dépendent.
2. **Rampe ordinale de coût** (1 à 5 emplacements). Le coût est une magnitude
   ordinale, donc **rampe séquentielle à une seule teinte**. La rampe bleue de
   `Dons/web/explorateur_dons.css` est calibrée sur un fond quasi-blanc et **ne
   tiendra pas le contraste sur le parchemin Grimoire (`#F1E7D2`, luminance
   0,805)** : la recalculer, exactement comme D8 a recalculé `evocation` et
   `transmutation`. Consigner les ratios obtenus.
3. **Rôles de couleur pour Cytoscape.** Cytoscape n'interprète pas les variables
   CSS. Les couleurs doivent être résolues depuis l'élément racine via
   `global.getComputedStyle` (jamais le global implicite du navigateur : le
   composant doit rester rendable sous jsdom). `tokens.ts` reste l'unique source
   de vérité, y compris pour le thème nuit.

### Résolution de la collision `verify` (I8)

- `Dons/.claude/skills/verify/` → recréer sous
  `JDR_Spells/.claude/skills/verify-dons-python/`, en corrigeant les chemins :
  `python -m pf_dons.cli` (et non `pf1_dons`), depuis la racine de `JDR_Spells`.
- `JDR_Spells/.claude/skills/verify/` : amender pour ajouter les routes `/dons`
  et `/dons/<slug>` à la recette de vérification en Chromium.

## Pseudo-code

```
créer .claude/skills/pf-dons-conventions/SKILL.md
    frontmatter(name, description finissant par « à charger avant … »)
    section « Quand charger ce Skill »  → toute étape lisant/écrivant data/dons/
    section « Autorité »               → clause « le Skill gagne »
    section « Principe de sûreté »
    section « Les cinq couches »       → une sous-section par couche, avec le bug corrigé
    section « Pièges qui ont mordu »   → négations, anatomie, classe inconnue, race/arme
    section « Ce qui reste non modélisé, exprès » → les 13 proficiency, class_ability_unmapped

créer .claude/skills/pf-dons-taxonomie/SKILL.md
    table des 12 champs → vocabulaire clos → libellé français
    section « Séparation des espaces de noms » → la règle ?dons_*
    section « Facettes faibles »

amender .claude/skills/pf-web-design-system/SKILL.md
    ajouter §Dons : états tri-état, rampe de coût, rôles Cytoscape
    NE PAS toucher aux valeurs existantes (école, parchemin, accent)

créer .claude/skills/verify-dons-python/SKILL.md   (depuis Dons/.claude/skills/verify)
amender .claude/skills/verify/SKILL.md             (routes /dons)
```

## Logic Flow

1. Lire les deux `CLAUDE.md` et les `OUTPUT_*.md` de `Dons/build/` pour la
   matière première ; lire un Skill existant pour le ton et la structure.
2. Écrire les deux nouveaux Skills. Chaque règle est énoncée **avec l'erreur
   qu'elle empêche** — c'est le style du dépôt et ce qui les rend obéis.
3. Amender les deux Skills existants **par ajout uniquement**.
4. Relire : aucune valeur numérique ou hexadécimale dupliquée depuis
   `tokens.ts` sans mention explicite que `tokens.ts` reste l'autorité machine.

## Implementation Notes

- **Ne recopier aucune règle déjà détenue par un autre Skill.** Les Skills du
  dépôt s'y refusent explicitement : « Ce fichier n'en recopie rien — des règles
  dupliquées divergent. » Renvoyer par référence.
- Distinguer **autorité humaine** (le Skill) et **autorité machine** (le fichier
  de données), comme le fait `pf-enrichment-conventions`.
- Langue : ces Skills sont en **français** (comme `pf-web-design-system` et
  `pf-enrichment-conventions`).
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.
- Aucun code exécutable dans cette étape. Si vous êtes tenté d'écrire un script,
  il appartient à l'étape `02`.

## Verification Criteria

1. Les cinq fichiers existent et se chargent : `Skill(skill="pf-dons-conventions")`,
   `Skill(skill="pf-dons-taxonomie")`, `Skill(skill="pf-web-design-system")`,
   `Skill(skill="verify-dons-python")`, `Skill(skill="verify")` — aucun n'échoue
   sur un frontmatter mal formé.
2. `name:` de chaque Skill est **identique** au nom de son dossier.
3. Aucun dossier `.claude/skills/verify*` en double sens : `verify` (web) et
   `verify-dons-python` (CLU Python) coexistent avec des descriptions
   distinctes qui ne se recouvrent pas.
4. `grep` des 9 `BLOCKING_KINDS` dans `pf-dons-conventions/SKILL.md` : les neuf
   apparaissent, et les 6 non bloquants aussi.
5. `grep -i "sous-attribution"` renvoie au moins un résultat dans
   `pf-dons-conventions/SKILL.md`.
6. `grep "bonus_chiffre"` dans `pf-dons-taxonomie/SKILL.md` : présent, avec la
   règle de séparation des espaces de noms à proximité.
7. Les 18 valeurs de `effet_principal` sont listées avec leur libellé français.
8. `git diff --stat` ne montre **aucun** fichier hors `.claude/skills/`.
9. `npm run web:test` toujours vert (contrôle de non-régression : cette étape ne
   doit rien casser puisqu'elle ne touche pas au code).

## Git Handling

Branche `fusion/01-skills` depuis `feat/fusion-dons`. Trois commits :

```
docs(skills): pf-dons-conventions, autorité humaine des cinq couches de gating
docs(skills): pf-dons-taxonomie, vocabulaires clos et espaces de noms disjoints
docs(skills): états tri-état, rampe de coût sur parchemin, verify dédoublé
```

Le corps de chaque commit dit **pourquoi** : par exemple, pour le troisième, que
`manual_check` est majoritaire et ne peut donc pas être un style d'exception.

## Expected Outcome

Cinq Skills en place. Toute étape ultérieure qui touche aux données des dons, à
une facette ou à une couleur peut charger son autorité au lieu de la redécouvrir
— et les 13 `proficiency` non modélisées, la limite la plus facile à franchir par
zèle, sont désormais écrites comme une décision.
