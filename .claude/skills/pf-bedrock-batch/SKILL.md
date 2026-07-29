---
name: pf-bedrock-batch
description: Conventions d'appel d'Amazon Bedrock pour l'enrichissement LLM du corpus de sorts (faits relevés sur le compte eu-central-1 le 2026-07-29 — authentification par jeton porteur, chemin on-demand obligatoire, profils d'inférence eu./global., inaccessibilité actuelle du batch, format d'enregistrement JSONL, cycle de vie d'un job, politique de reprise, gestion des secrets) — à charger avant d'écrire ou de modifier l'étage 09_enrich_llm.
---

# pf-bedrock-batch

## Quand charger ce Skill

Charger ce Skill dans **toute** étape qui parle à Bedrock, dimensionne un run,
estime un coût ou décide d'un chemin d'invocation — en pratique
**`09_enrich_llm`**, seul étage réseau de la track, et l'estimateur de coût.

Charger **`pf-enrichment-conventions`** en parallèle : il détient le contrat de
sortie (clés, preuves, provenance). Ce Skill ne traite que du **transport**.

## Statut des faits — relevé, pas supposé

Ce Skill distingue explicitement trois natures d'information. **Ne jamais
promouvoir une supposition en fait relevé.**

| Marque | Sens |
|---|---|
| **RELEVÉ 2026-07-29** | mesuré sur le compte réel, région `eu-central-1`, à cette date |
| **DOCUMENTÉ** | issu de la documentation AWS, non vérifié sur ce compte |
| **À RELEVER** | valeur inconnue de cet environnement — **interdit de la deviner** |

Méthode de relevé du 2026-07-29 : appels `boto3` directs depuis cet
environnement — `bedrock:list_inference_profiles`, `bedrock:list_foundation_models`
(inspection de `inferenceTypesSupported`), un appel **live**
`bedrock-runtime:Converse`, une sonde
`bedrock:create_model_invocation_job`, plus `sts:get_caller_identity` et
`service-quotas:list_service_quotas`.

## Environnement et authentification — RELEVÉ 2026-07-29

| Élément | État relevé |
|---|---|
| Région en usage | **`eu-central-1`** |
| Authentification | variable d'environnement **`AWS_BEARER_TOKEN_BEDROCK`** (jeton porteur) |
| Identifiants SigV4 | **absents** |
| `sts.get_caller_identity()` | **échoue** — `NoCredentialsError` |
| `service-quotas.list_service_quotas(ServiceCode="bedrock")` | **échoue** — `NoCredentialsError` |
| `bedrock-runtime.Converse` sur profil `eu.` | **réussit** (appel live) |

Le jeton porteur ouvre le **plan de données** de `bedrock-runtime`. Il n'ouvre ni
STS, ni Service Quotas, ni les API de job batch, qui exigent SigV4.

## Chemin on-demand — RELEVÉ, fonctionnel, et PAR DÉFAUT

| Fait | État |
|---|---|
| `eu.anthropic.claude-haiku-4-5-20251001-v1:0` | **profil d'inférence ACTIF** — RELEVÉ |
| Appel `Converse` sur ce profil | **réussi** — RELEVÉ ; `usage` renvoie `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheWriteInputTokens` |
| `anthropic.claude-haiku-4-5-20251001-v1:0` (id nu) | `inferenceTypesSupported == ['INFERENCE_PROFILE']` — RELEVÉ |
| Conséquence | **l'id de modèle nu NE PEUT PAS être invoqué en on-demand** |

Profils relevés comme disponibles :

| Profil | Portée |
|---|---|
| `eu.anthropic.claude-haiku-4-5-20251001-v1:0` | UE |
| `global.anthropic.claude-haiku-4-5-20251001-v1:0` | globale |

**Règle dure :** toujours passer un identifiant de **profil d'inférence**
(`eu.` ou `global.`) comme `modelId`. Passer l'id nu échoue par validation, pas
par indisponibilité — c'est une erreur de code, pas un incident.

Le champ `modele` de l'enregistrement d'enrichissement porte l'identifiant
**complet réellement invoqué**, profil inclus.

### Pourquoi le on-demand est obligatoire ici

Deux raisons cumulatives, aucune contournable dans cet environnement :

1. Un run `--limit 50` est **sous n'importe quel minimum** d'enregistrements par
   job batch (voir la section suivante) : il ne peut pas passer par batch.
2. Le batch est **actuellement injoignable** sur ce compte tel que configuré.

**Le chemin on-demand est donc le chemin par défaut de l'étage 09**, et le seul
qui soit prouvé fonctionnel à ce jour. Le chemin batch est du code d'avenir : il
ne doit pas être un prérequis au premier run.

## Batch : le quota de minimum d'enregistrements — À RELEVER

> **Cette valeur N'A PAS PU être lue depuis cet environnement.** Elle est
> **inconnue**. Aucune valeur ne doit être écrite ici sans relevé.

| Point | État |
|---|---|
| Nom du quota | « Minimum number of records per batch inference job » — DOCUMENTÉ : *the minimum number of records (JSON objects) across JSONL files in the job* (`batch-inference-data.html`) |
| Valeur par défaut | **À RELEVER** — la table de quotas publiée est tronquée et **n'expose pas** la valeur par défaut |
| Lecture programmatique | **impossible ici** — RELEVÉ 2026-07-29 : `service-quotas list_service_quotas(ServiceCode="bedrock")` échoue en `NoCredentialsError` |
| Valeur du compte | **À RELEVER** |

**Commande exacte à exécuter par quelqu'un disposant d'identifiants SigV4 réels :**

```
aws service-quotas list-service-quotas --service-code bedrock --region eu-central-1
```

À défaut : console AWS → Service Quotas → Amazon Bedrock → rechercher
`batch inference`.

La valeur relevée est **inscrite dans ce Skill avant tout run batch**. Un driver
batch écrit sans cette valeur est un driver qui devinera son seuil.

Toute mention d'un minimum « historiquement 100 » ou « 1 000 sur certains
comptes » rencontrée dans les documents de planification est une **supposition
non vérifiée**. Ne pas la recopier comme un fait.

## Batch : inaccessible sur ce compte tel que configuré — RELEVÉ 2026-07-29

Sonde `create_model_invocation_job` → **`AccessDeniedException`**,
message : *« Cross-account pass role is not allowed »*.

Autrement dit : même le quota mis de côté, **le batch est inatteignable sans un
rôle SigV4**. Conséquence de conception, à assumer telle quelle :

| Prérequis manquant | Pour quoi |
|---|---|
| Identifiants **SigV4** | appeler les API de job (`create/get/list/stop_model_invocation_job`) |
| Un **bucket S3** | entrée et sortie JSONL du job |
| Un **rôle de service** Bedrock | que Bedrock puisse lire/écrire ce bucket |

Aucun des trois n'est présent aujourd'hui. **Le chemin batch n'est donc pas
utilisable dans cet environnement en l'état.**

## Format d'un enregistrement JSONL batch — DOCUMENTÉ

Un objet JSON **compact** par ligne, dans le fichier d'entrée S3 :

```json
{"recordId": "…", "modelInput": {"anthropic_version": "bedrock-2023-05-31", "max_tokens": 1024, "system": "…", "messages": [{"role": "user", "content": "…"}]}}
```

| Champ | Règle |
|---|---|
| `recordId` | **≤ 64 caractères**, unique dans le job. Utiliser l'`id` du sort ; le tronquer/suffixer de façon **déterministe** si besoin, et journaliser la table de correspondance |
| `modelInput` | exactement le corps d'un `InvokeModel` pour le modèle visé |
| `anthropic_version` | `"bedrock-2023-05-31"` |
| `max_tokens` | obligatoire |
| `system`, `messages` | comme en on-demand |

### Deux pièges documentés, structurants

| # | Piège | Conséquence sur la conception |
|---|---|---|
| 1 | **L'ordre des enregistrements de sortie n'est PAS garanti** identique à celui de l'entrée | ne jamais apparier par index/position — **toujours** par `recordId` |
| 2 | Le batch ne supporte **NI l'appel d'outils, NI la sortie structurée / `response_format`** | le contrat JSON ne peut pas être imposé par l'API |

Le piège 2 est exactement pourquoi la track est bâtie ainsi : **le contrat JSON
est imposé par le prompt, puis vérifié post-hoc** par
`10_validate_enrichment` (schéma + vocabulaires clos + revérification des
sous-chaînes de `preuves`). Ne pas compter sur une garantie d'API qui n'existe
pas en batch.

## Cycle de vie d'un job batch — DOCUMENTÉ

```
Submitted → Validating → Scheduled → InProgress → Completed | Failed | Stopped
```

| Point | Règle |
|---|---|
| SLA | **aucun** |
| Budget de temps | prévoir jusqu'à **24 h** |
| Attente | interrogation périodique de `get_model_invocation_job`, jamais d'attente bloquante non bornée |
| Échec précoce | un rejet en `Validating` porte sur le fichier d'entrée (format, `recordId`, minimum d'enregistrements) |

## Entrée / sortie S3

| Aspect | Règle |
|---|---|
| Transport | JSONL sur **S3**, en entrée comme en sortie |
| Sortie | **un enregistrement de sortie par `recordId`** |
| Erreurs | **par enregistrement** : un `recordId` peut échouer seul, le job restant `Completed` |
| Lecture | toujours indexer la sortie par `recordId` avant traitement |

## Tarification

Le tarif batch est d'environ **50 % du tarif à la demande** pour le même modèle.

**Ne jamais coder en dur un tarif dans le dépôt.** L'autorité est
`https://aws.amazon.com/bedrock/pricing`. L'estimateur de coût prend les tarifs en
**paramètres**, avec la date de relevé dans son rapport ; un tarif figé dans le
code devient faux sans avertissement.

## Politique de reprise

| Situation | Action |
|---|---|
| Un `recordId` **absent** de la sortie | rejoué dans un **job de suivi** |
| Un `recordId` **en erreur** | rejoué dans un **job de suivi** |
| Le job entier | **jamais relancé** pour rattraper quelques enregistrements |

Un job de suivi ne contient **que** les enregistrements manquants ou en erreur.
Relancer le job complet repaie l'intégralité du corpus pour quelques unités, et
écrase des résultats déjà valides.

Côté données, la reprise s'appuie sur **`hash_source`** (voir
`pf-enrichment-conventions`) : `hash_source` inchangé ⇒ l'enrichissement est à
jour, on ne régénère pas. C'est ce qui rend l'étage 09 idempotent et les reprises
peu coûteuses.

Attention au minimum d'enregistrements : un job de suivi de 12 enregistrements
retombe **sous le seuil batch** et doit partir en **on-demand**. C'est le
comportement attendu, pas une dégradation.

## Secrets et configuration

| Règle | Détail |
|---|---|
| **Jamais de secret dans le dépôt** | ni jeton, ni clé, ni ARN de rôle, ni identifiant de compte |
| Jeton | `AWS_BEARER_TOKEN_BEDROCK`, variable d'environnement **uniquement** |
| Région | variable d'environnement (`eu-central-1` en usage) |
| Bucket S3 | variable d'environnement |
| Rôle de service | variable d'environnement |
| Absence | une variable manquante ⇒ **échec net et explicite** au démarrage, jamais de valeur par défaut silencieuse |
| Journaux | ne jamais écrire un jeton dans `reports/`, dans un message d'erreur ou dans un prompt committé |

Les prompts assemblés sont committés (`build_artifacts/prompts/`) : ils sont la
preuve de ce qui a été envoyé. **Raison de plus** pour qu'aucun secret ne
transite par un prompt.

## Anti-patterns

| # | Anti-pattern | Pourquoi ça casse |
|---|---|---|
| 1 | Invoquer `anthropic.claude-haiku-4-5-20251001-v1:0` (id nu) en on-demand | RELEVÉ : le modèle ne supporte que `INFERENCE_PROFILE` — utiliser `eu.` ou `global.` |
| 2 | Inscrire une valeur devinée pour le minimum d'enregistrements par job | elle est **À RELEVER** ; une supposition présentée comme un relevé fera dimensionner à faux |
| 3 | Faire du batch un prérequis du premier run | RELEVÉ : batch injoignable ici (`AccessDeniedException`, pass-role) — le on-demand est le défaut |
| 4 | Apparier entrée et sortie batch par position | l'ordre de sortie n'est pas garanti — apparier par `recordId` |
| 5 | Compter sur `tool_use` ou `response_format` en batch | non supportés — le contrat passe par le prompt + validation à l'étage 10 |
| 6 | Relancer un job entier pour rattraper des échecs | job de suivi ciblé uniquement |
| 7 | Coder un tarif en dur | la page de tarification AWS est l'autorité |
| 8 | Coder un jeton, un ARN ou un nom de bucket dans le dépôt | secret exfiltré ; tout passe par l'environnement |
| 9 | Attendre `get_model_invocation_job` sans borne | aucun SLA ; budget 24 h et interrogation périodique |
| 10 | Conclure d'un `NoCredentialsError` que Bedrock est indisponible | le plan de données `bedrock-runtime` fonctionne au jeton porteur — seuls STS, Service Quotas et le batch exigent SigV4 |
