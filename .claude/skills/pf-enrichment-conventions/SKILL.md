---
name: pf-enrichment-conventions
description: Conventions autoritaires de la couche d'enrichissement LLM du corpus de sorts Pathfinder-fr (arbre data/enrichissements/ entièrement régénérable, liste gelée des 16 clés, politique des nulls, champ preuves anti-confabulation, taxonomie et sa règle de coupe, provenance et hash_source, vocabulaires clos) — à charger avant de lire ou d'écrire quoi que ce soit sous data/enrichissements/, data/vues/, data/conventions/vocabulaires/ ou build_artifacts/prompts/.
---

# pf-enrichment-conventions

## Quand charger ce Skill

Charger ce Skill dans **toute** étape qui produit, valide, joint ou relit des
données enrichies : assemblage des prompts (étage 08), génération LLM (étage 09),
validation (étage 10), construction de la vue jointe, curation de la taxonomie,
écriture du schéma ou des vocabulaires.

Ce Skill est la référence **humaine**. L'autorité **machine** est ailleurs et ne
doit jamais être recopiée ici :

| Autorité machine | Détient |
|---|---|
| `data/schemas/enrichissement.schema.json` | types, cardinalités, `additionalProperties: false`, champs requis |
| `data/conventions/vocabulaires/*.json` | l'énumération réelle de chaque valeur close |

Si ce Skill et ces fichiers divergent, **les fichiers gagnent pour les valeurs**,
et **ce Skill gagne pour les règles** (politique des nulls, règle des preuves,
régénérabilité de l'arbre). Toute divergence constatée est corrigée, pas
contournée.

Le Skill **`pf-corpus-conventions`** reste chargé en parallèle : il détient
l'algorithme de slug, le vocabulaire des 21 clés de la Phase 1, les règles
d'encodage et la politique des nulls d'origine. Ce Skill n'en recopie rien.

## Règle d'or

> **Cette track n'écrit JAMAIS dans `data/sorts/`.**

`data/sorts/<id>.json` est la sortie de la Phase 1 et l'**entrée en lecture
seule** de cette track : aucun outil d'enrichissement ne l'ouvre en écriture, ne
le réordonne, ne lui ajoute de clé, ni ne « corrige » un champ au passage. Les 21
clés existantes ne sont ni renommées ni étendues. La raison n'est pas qu'un humain
y ferait autorité, c'est la séparation des étages : un enrichissement qui
retoucherait sa propre source rendrait `hash_source` incohérent et toute preuve
invérifiable. Ce qui est produit par cette track vit dans un arbre parallèle.

Corollaire : **`data/vues/` et `data/enrichissements/` sont dérivés.** Une
correction se fait en amont — texte source, prompt, taxonomie — puis on
**régénère**. Une édition directe dans l'un ou l'autre est perdue à la
régénération suivante, donc inutile.

## Arbre de sortie

```
data/sorts/<id>.json                     # Phase 1 — LECTURE SEULE pour cette track
data/enrichissements/<id>.json           # étage 09 — la couche LLM
data/vues/sorts_enrichis/<id>.json       # vue jointe, DÉRIVÉE, jamais éditée
data/conventions/vocabulaires/*.json     # vocabulaires clos (autorité machine)
data/schemas/enrichissement.schema.json  # contrat (autorité machine)
build_artifacts/prompts/                 # prompts assemblés, committés (preuve + rejeu)
reports/                                 # rapports et anomalies des étages 08/09/10
```

| Règle | Détail |
|---|---|
| Nom de fichier | `data/enrichissements/<id>.json` est exactement l'`id` + `.json` |
| `id` | **identique** à celui de `data/sorts/<id>.json`, jamais recalculé localement |
| `slug` | dérivé par l'algorithme de slug de `pf-corpus-conventions`, sans variante |
| Jointure | uniquement sur `id`. Jamais sur `nom`, jamais sur l'URL, jamais sur l'ordre des fichiers |
| Orphelin | un `id` d'enrichissement absent de `data/index/` est une **erreur**, pas un avertissement |

## Vocabulaire des clés d'enrichissement — liste gelée

Ensemble **clos**. Aucune clé n'est ajoutée, retirée ou renommée sans passer par
le schéma. Ordre canonique = de haut en bas dans ce tableau. **Aucune clé n'est
jamais omise** : un fichier d'enrichissement porte toujours les 16 clés.

| Clé | Type | Cardinalité / contrainte | Source |
|---|---|---|---|
| `id` | string | doit exister dans `data/index/` | corpus |
| `slug` | string | algorithme de `pf-corpus-conventions` | corpus |
| `resume_court` | string | 1 phrase, longueur ≤ 160 | LLM |
| `categorie_principale` | string (enum) | valeur **unique** ← `vocabulaires/categories.json` | LLM |
| `tags` | array[string (enum)] | **2..6**, uniques ← `vocabulaires/tags.json` | LLM |
| `roles_tactiques` | array[string (enum)] | **1..3** ← `combat` \| `exploration` \| `social` \| `utilitaire` | LLM |
| `cible_typique` | string (enum) | `soi` \| `allie` \| `ennemi` \| `zone` \| `objet` | LLM |
| `type_degats` | string (enum) **ou** `null` | ← `vocabulaires/types_degats.json` | LLM |
| `condition_infligee` | array[string (enum)] | **0..4** ← `vocabulaires/conditions.json` | LLM |
| `preuves` | object | `{type_degats: string\|null, condition_infligee: array[string], cible_typique: string}` | LLM |
| `notes_ambiguite` | string **ou** `null` | prose libre, français accentué | LLM |
| `version_prompt` | string | ex. `"p1.0"` | provenance |
| `version_taxonomie` | string | ex. `"taxonomie_v2"` | provenance |
| `modele` | string | identifiant **complet** du modèle (profil d'inférence inclus) | provenance |
| `genere_le` | string | date-heure ISO 8601 **UTC** | provenance |
| `hash_source` | string | sha256 **hex** du texte source canonique | provenance |

`additionalProperties: false` dans le schéma est ce qui empêche le modèle
d'inventer un champ que personne n'a demandé. Ne pas l'assouplir.

## Politique des nulls

Reprise **à l'identique** de `pf-corpus-conventions` — s'y référer pour la règle
générale ; ce qui suit en est l'application à cette couche.

| Écriture | Sens exact |
|---|---|
| `null` | **absent du source** : le texte canonique ne porte pas l'information |
| `[]` | **vérifié, aucun** : le texte a été lu, il n'y a rien à lister |
| clé omise | **interdit** — jamais |

Trois valeurs à ne pas confondre, sous peine de polluer les statistiques de la
curation de taxonomie :

| Situation | Écriture correcte |
|---|---|
| Le sort ne fait pas de dégâts | `type_degats: null` + `preuves.type_degats: null` |
| Le sort n'inflige aucune condition, c'est vérifié | `condition_infligee: []` |
| Le modèle n'a pas su trancher | valeur au mieux **+** `notes_ambiguite` renseigné |

`notes_ambiguite` n'est pas un substitut de `null` : il documente une hésitation,
pas une absence.

## Le champ `preuves` — le dispositif anti-confabulation

C'est le mécanisme mécanique par lequel l'invention devient **détectable**, et
non une simple annotation de confort.

| Règle | Détail |
|---|---|
| Nature | une **sous-chaîne EXACTE** du texte source canonique |
| Interdit | reformuler, paraphraser, résumer, traduire, recasser, normaliser les espaces, corriger une faute du wiki |
| Accents | conservés **verbatim** — la citation est du français accentué, copié tel quel |
| Vérification | l'étage 10 **revérifie** la sous-chaîne : `preuve in texte_source_canonique`, comparaison littérale |
| Échec | une preuve introuvable = enregistrement **rejeté**, journalisé dans `reports/` |
| Non nul sans preuve | `type_degats` non nul avec `preuves.type_degats: null` est un rejet |

Les deux moitiés sont nécessaires : le schéma exige la **présence** du champ,
l'étage 10 en vérifie la **véracité**. L'une sans l'autre ne protège de rien.

## Pas de verrou de relecture — `data/enrichissements/` est régénérable

**Il n'existe aucune clé de relecture et aucun verrou d'écrasement.** Les 16 clés
du contrat sont toutes produites par la machine, et l'étage 09 **remplace** un
enregistrement existant sans condition ni `--force`.

| Acteur | Comportement |
|---|---|
| Générateur (étage 09) | régénère et remplace, sans consulter l'état précédent |
| Validateur (étage 10) | contrôle **tous** les enregistrements, intégralement, sans exemption |
| Vue (dérivée) | régénérée à partir de l'état courant |

Conséquence à avoir en tête, elle n'est pas atténuée ailleurs : **une correction
apportée à la main dans `data/enrichissements/` est perdue à la régénération
suivante.** Ce n'est pas un accident du code, c'est le contrat. Un enregistrement
qui sort faux se corrige en amont — prompt, taxonomie, ou texte source — puis on
régénère ; on ne le rattrape pas dans le fichier de sortie.

L'arbre est donc entièrement dérivable de `data/sorts/` plus les conventions
gelées : `hash_source` et la provenance suffisent à savoir si un enregistrement
est à jour.

## Provenance obligatoire

Cinq champs, toujours renseignés, jamais `null` :
`version_prompt`, `version_taxonomie`, `modele`, `genere_le`, `hash_source`.

### `hash_source`

`hash_source` = **sha256 hexadécimal du texte source canonique**, celui-là même
qui a été assemblé à l'étage 08 et envoyé au modèle.

| Règle | Détail |
|---|---|
| Assemblage | une fonction **unique**, `texte_source_canonique(sort)`, définie à l'étage 08 |
| Partage | l'étage 10 appelle **la même** fonction, jamais une réimplémentation |
| Pourquoi | la même chaîne des deux côtés, sinon **toutes** les preuves échouent — la vérification de sous-chaîne n'a de sens que sur une chaîne identique au bit près |
| Encodage du hash | UTF-8 de la chaîne canonique, `hashlib.sha256(...).hexdigest()` |
| Usage | clé de reprise : `hash_source` inchangé ⇒ inutile de régénérer ; changé ⇒ l'enrichissement est périmé |

Toute évolution de `texte_source_canonique` change tous les hashes : c'est une
décision explicite, elle se prend en connaissance de cause et se journalise.

## Vocabulaires clos

Ils vivent **uniquement** dans `data/conventions/vocabulaires/*.json` :
`categories.json`, `tags.json`, `roles_tactiques.json`, `cibles.json`,
`types_degats.json`, `conditions.json`.

Aucune liste de valeurs closes n'est dupliquée en dur ailleurs — ni dans le
schéma, ni dans le code, ni dans ce Skill. Une liste dupliquée divergera.

Format d'un fichier de vocabulaire :

```json
{
  "version": "v0",
  "valeurs": [
    {
      "cle": "attaque_directe",
      "definition_fr": "…",
      "exemples_positifs": ["…", "…"],
      "exemples_negatifs": ["…", "…"]
    }
  ]
}
```

| Champ | Règle |
|---|---|
| `version` | obligatoire, au format `vN` ; `version_taxonomie` vaut `taxonomie_v<max>` sur **les six** listes, jamais sur `tags.json` seule — c'est ce qui distingue deux passes menées contre des listes différentes. Une seule source : `etiquette_taxonomie()` |
| `cle` | snake_case, **sans accent** — c'est un identifiant, pas du contenu |
| `definition_fr` | français accentué verbatim ; sert de définition au prompt |
| `exemples_positifs` | ≥ 2, tirés du corpus réel (ou de la fixture), **jamais de mémoire** |
| `exemples_negatifs` | ≥ 2, cas voisins que la clé ne couvre **pas** — c'est ce qui trace la frontière |

## Les tags — GELÉS en `v1` le 2026-07-29

**35 tags**, liste close, dans `data/conventions/vocabulaires/tags.json`
(`version: "v1"`). C'est la seule autorité sur les tags admissibles : un tag hors
de cette liste est un **rejet** à l'étage 10, jamais une suggestion.

Elle est **dérivée par machine, sans curation humaine**. Sa légitimité vient
d'une règle de coupe déterministe et rejouable, pas d'une signature :

| Étage | Artefact | Rôle |
|---|---|---|
| Échantillon | `build_artifacts/echantillon_taxo.json` | 200 sorts stratifiés, 85 strates, 9 écoles, niveaux 0–9 |
| Passe 0 | `build_artifacts/taxo_passe0/<id>.json` | proposition **libre** (aucune liste imposée), température 0, un fichier par sort, texte envoyé conservé |
| Agrégat | `build_artifacts/taxo_passe0_agrege.csv` | 1 278 usages → 1 121 étiquettes brutes distinctes, triées par occurrences |
| Regroupement | `data/conventions/taxo_groupes.json` | 54 groupes candidats (regex sur l'étiquette pliée) |
| Coupe | `data/conventions/vocabulaires/tags.json` | les **35** groupes couvrant **≥ 10 sorts** de l'échantillon — exactement, ni choisis ni écartés à la main |

Chaque entrée porte `definition_fr`, 2+ `exemples_positifs` et 2+
`exemples_negatifs`. **Les exemples sont des noms de sorts réels du corpus**,
tirés mécaniquement, jamais composés par le modèle.

`tests/test_taxo_passe0.py` rejoue la coupe et échoue si la liste cesse d'être
exactement l'ensemble des groupes au-dessus du seuil — donc un tag ajouté à la
main casse la suite. **Faire évoluer la taxonomie = éditer `taxo_groupes.json` ou
le seuil, puis recouper une v2.** Jamais retoucher `tags.json` directement.

Ordre de rejeu, hors ligne sauf la passe 0 :

```
python -m pf_spells.taxo_passe0    # RÉSEAU, ~200 appels payants, reprise par présence
python -m pf_spells.taxo_agregat   # hors ligne, rejouable, CSV byte-identique
```

La passe 0 refuse de partir si l'empreinte de corpus de l'échantillon ne
correspond plus à `data/sorts/` : un tirage périmé ferait payer 200 appels pour
décrire un corpus qui a bougé.

### La règle du seuil d'ambiguïté — 50 % depuis le 2026-07-31

Le seuil en vigueur est `SEUIL_AMBIGUITE` dans
`src/pf_spells/validate_enrichment.py`, et c'est lui qui fait foi ; le lire plutôt
que recopier un chiffre ici.

| Mesure | Seuil | Conséquence |
|---|---|---|
| Part d'enregistrements avec `notes_ambiguite` non nul | **≤ seuil** | la taxonomie est jugée suffisante |
| Idem | **> seuil** | la taxonomie est **insuffisante** : couper une `taxonomie_v2`, la geler, régénérer |

**Le seuil valait 5 % jusqu'au 2026-07-31**, où il a été porté à 50 % par
arbitrage humain après relecture des 950 notes de la passe `p1.4`/`p1.5` une à
une. Le motif n'est pas de faire taire l'alerte mais le décompte du § 4.1 de
`docs/enrichissement.md` : 891 des 950 notes glosent un choix par ailleurs valide,
donc la mesure lisait la formulation du prompt et non un manque des listes.

**Ce que le relèvement coûte, et qui doit être dit :** à 50 % la mesure ne détecte
plus une régression de l'ambiguïté avant que le taux ne double presque. C'est
précisément ce que l'ancienne valeur protégeait. Qui resserre un jour la
formulation du champ doit rabaisser le seuil dans le même commit.

**Ce que la règle interdit toujours** : desserrer le seuil pour rendre un critère
vert. Le relèvement du 2026-07-31 est un arbitrage documenté sur des données
relues, pas un précédent autorisant l'ajustement du seuil à la mesure.

**Cette règle a joué le 2026-07-30.** La passe complète a mis 120 sorts sur 2070
(5,8 %) en quarantaine ; les listes ont donc été élargies, pas la contrainte
relâchée. `categories.json` et `conditions.json` sont passées en **v2** —
`coercition`, `metamorphose`, `dissipation` d'un côté, `nauseeux`, `fatigue`,
`epuise`, `fievreux` de l'autre — et les 120 seuls ont été ré-interrogés
(~0,35 $) : **+98, soit 2048/2070 = 98,9 %**. `tags.json` n'a pas bougé.

Ce que cette passe a établi, et qui vaut pour la prochaine :

- **Un taux de rejet qui ne bouge pas quand on durcit l'instruction accuse les
  listes, pas le prompt.** Ici 12 → 10 sur 100 : reformuler ne crée pas la case
  manquante, et chaque tentative est une passe payée. Compter les rejets **par
  clé manquante** d'abord.
- **N'ajouter que les manques à masse réelle** (32, 28, 9 sorts), et laisser la
  queue de 1–5 occurrences en quarantaine — le reliquat de 1,1 % ne partage
  aucun manque commun, c'est le point d'arrêt.
- **Ne jamais remapper une réponse du modèle vers une clé valide** : c'est un
  jugement de jeu déguisé en sortie de modèle.
- **Deux listes closes ne partagent jamais une clé** : le modèle voyait
  `charme_ou_coercition` dans les tags et en déduisait une catégorie homonyme.
  D'où `coercition`, délibérément distinct.
- **Le fourre-tout reste en dernier** (`utilitaire`) : l'ordre est lu comme une
  précédence.
- **Élargir une énumération ne périme rien** : les 1950 enregistrements v1
  valident contre le schéma v2. Seule la provenance doit les distinguer.

Au-delà du seuil, on **corrige la taxonomie**, on ne relâche pas la contrainte.
**Le modèle n'improvise jamais une valeur** : il choisit dans la liste close, ou
il documente son hésitation dans `notes_ambiguite`. Une valeur hors vocabulaire
est un rejet à l'étage 10, pas une suggestion.

## Format et encodage

Voir `pf-corpus-conventions` pour la règle générale. Application ici :

| Aspect | Règle |
|---|---|
| Clés | français, `snake_case`, **sans accent** (`condition_infligee`) |
| Valeurs de contenu | accentuées **verbatim** ; jamais de translittération |
| Retrait d'accents | **uniquement** dans l'algorithme de slug `id` |
| `.json` | `indent=2`, clés en ordre canonique, **newline final** |
| `.jsonl` | un objet compact par ligne, `separators=(',', ':')`, terminé par `\n` |
| Encodage | UTF-8 **sans BOM**, `json.dump(..., ensure_ascii=False)` |
| Fins de ligne | **LF** partout, y compris sur win32 |
| Décodage | UTF-8 **explicite**, jamais de détection automatique |
| **U+FFFD** | présence n'importe où = **corruption décisive** : échouer bruyamment, immédiatement, ne rien écrire |

## Les trois nouveaux étages du pipeline

```
08_prepare_prompts   →   09_enrich_llm   →   10_validate_enrichment
   hors ligne              RÉSEAU              hors ligne
```

| Étage | Rôle | Réseau | Idempotent |
|---|---|---|---|
| `08_prepare_prompts` | assemble `texte_source_canonique`, calcule `hash_source`, écrit les prompts dans `build_artifacts/prompts/` | **non** | oui |
| `09_enrich_llm` | appelle le modèle, écrit `data/enrichissements/<id>.json` | **OUI — seul étage réseau de la track** | oui (reprise par `hash_source`) |
| `10_validate_enrichment` | schéma + vocabulaires + **revérification des sous-chaînes de `preuves`** ; sortie non nulle si FAIL | **non** | oui |

Aucun autre module de cette track n'accède au réseau. Un étage 08 ou 10 qui
ouvrirait une connexion est un bug de conception, pas une optimisation.

## Anti-patterns

**Ne reproduire aucun de ceux-ci.**

| # | Anti-pattern | Pourquoi ça casse |
|---|---|---|
| 1 | Écrire, réordonner ou « corriger » `data/sorts/*.json` | viole la règle d'or ; détruit des éditions humaines autoritaires |
| 2 | Éditer `data/vues/` à la main | dérivé : la correction est perdue à la régénération suivante |
| 3 | Paraphraser une `preuve` (même « juste les espaces ») | la vérification de sous-chaîne de l'étage 10 échoue |
| 4 | Réimplémenter `texte_source_canonique` côté 10 | deux chaînes divergentes ⇒ 100 % des preuves échouent |
| 5 | Corriger à la main un fichier de `data/enrichissements/` | l'arbre est régénérable : la correction est perdue au run suivant ; corriger le prompt ou la taxonomie |
| 6 | Réintroduire une clé de relecture ou un verrou d'écrasement | le contrat est à 16 clés, toutes machine ; `additionalProperties: false` rejette la 17ᵉ |
| 7 | Omettre une clé au lieu d'écrire `null` / `[]` | casse la forme uniforme auditable à l'œil |
| 8 | Confondre `type_degats: null` et `notes_ambiguite` | « pas de dégâts » ≠ « je n'ai pas su » ; fausse la mesure des 5 % |
| 9 | Recopier une liste de valeurs closes en dur (schéma, code, prompt figé) | elle divergera de `data/conventions/vocabulaires/` |
| 10 | Laisser le modèle inventer un tag hors vocabulaire | rejet à l'étage 10 ; la taxonomie se corrige, la contrainte ne se relâche pas |
| 11 | Recalculer l'`id` d'un enrichissement au lieu de reprendre celui du corpus | la jointure sur `id` casse silencieusement |
| 12 | Tolérer un U+FFFD « isolé » | c'est une corruption d'encodage, jamais un caractère de contenu |
