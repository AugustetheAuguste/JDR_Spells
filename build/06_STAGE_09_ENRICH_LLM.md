# 06 — Étage 09 : génération (seul étage réseau)

## Objectives

Construire `src/pf_spells/enrich_llm.py` : envoyer les prompts assemblés à
Claude Haiku 4.5 sur Bedrock, écrire un enregistrement par sort dans
`data/enrichissements/<id>.json`, reprendre proprement, et refuser d'écraser un
enregistrement verrouillé par un humain.

Deux chemins d'exécution, pour une raison dure : **un job Bedrock batch a un
nombre minimum d'enregistrements**, ce qui interdit d'utiliser le batch pour les
runs d'itération.

## Dependencies & Parallelization

- **Vague 5.** Dépend de : `05_STAGE_08_PREPARE_PROMPTS` (les prompts et le
  manifeste), et transitivement de 02 et 04.
- Seule étape de sa vague. Elle est aussi la seule de la track à sortir sur le
  réseau, hors la passe 0 de l'étape 04.
- Bloque `09_CLI_DOCS_CLAUDE_MD`.

## Inherited Context from Dependencies

De `05_STAGE_08_PREPARE_PROMPTS` :
- `build_artifacts/prompts/<version_prompt>/<id>.json` =
  `{id, slug, hash_source, version_prompt, version_taxonomie, systeme,
    utilisateur, max_tokens}`.
- `build_artifacts/prompts/<version_prompt>/_manifeste.json` =
  `{version_prompt, version_taxonomie, n, hashs: {id: hash_source},
    construit_le}`.
- Le modèle doit répondre par un objet JSON avec exactement :
  `id, slug, resume_court, categorie_principale, tags[], roles_tactiques[],
   cible_typique, type_degats|null, condition_infligee[], preuves{},
   notes_ambiguite|null`.
  Cet étage y **ajoute** : `verifie_par_humain: false, version_prompt,
  version_taxonomie, modele, genere_le, hash_source`.

De `01_SKILLS_AND_TOOLS`, Skill `pf-bedrock-batch` :
- modelId : `anthropic.claude-haiku-4-5-20251001-v1:0` ;
  profil géo EU : `eu.anthropic.claude-haiku-4-5-20251001-v1:0`.
- Format JSONL batch : `{"recordId": …, "modelInput": {"anthropic_version":
  "bedrock-2023-05-31", "max_tokens": …, "system": …, "messages": […]}}`.
- Minimum d'enregistrements par job : **valeur relevée dans le Skill** — la
  respecter, ne pas la supposer.
- Cycle de vie : Submitted → Validating → Scheduled → InProgress → Completed /
  Failed / Stopped. Pas de SLA ; prévoir jusqu'à 24 h.
- Entrée et sortie par S3 en JSONL. Tarif batch ≈ 50 % du tarif à la demande.

## Pseudo-code

```
FONCTION principale(--mode batch|ondemand, --limit, --only, --force,
                    --version-prompt, --concurrence 8):

  manifeste <- charger le manifeste des prompts
  ids <- filtrer par --limit / --only

  # reprise et verrou
  a_faire <- []
  POUR chaque id :
     sortie <- data/enrichissements/<id>.json
     SI sortie existe :
        SI sortie.verifie_par_humain ET PAS --force -> sauter (verrouillé)
        SI sortie.hash_source == manifeste.hashs[id]
           ET sortie.version_prompt == version courante
           ET PAS --force                              -> sauter (à jour)
     a_faire += id

  SI mode == ondemand :
     exécuter avec une concurrence bornée (8 à 16)
     par appel : invoquer le modèle, écrire immédiatement le fichier
     réessais avec repli exponentiel sur throttling ; 3 essais max
  SI mode == batch :
     SI |a_faire| < minimum_batch -> ERREUR explicite proposant --mode ondemand
     écrire un JSONL, recordId = id (assaini pour Bedrock), envoyer sur S3
     créer le job, sonder son état, journaliser jobArn dans
        build_artifacts/jobs/<job>.json
     à Completed : lire le JSONL de sortie depuis S3, écrire un fichier par
        enregistrement ; collecter les recordId en erreur dans
        build_artifacts/jobs/<job>_echecs.json

FONCTION ecrire_enregistrement(id, reponse_brute, meta):
  json <- extraire l'objet JSON de la réponse (tolérer un préambule, ne PAS
          tolérer un JSON invalide -> mettre en quarantaine)
  SI json.id != id -> quarantaine "identité incohérente"
  enrichi <- {**json, verifie_par_humain: false,
              version_prompt, version_taxonomie, modele, genere_le: now_utc(),
              hash_source: meta.hash_source}
  ÉCRIRE data/enrichissements/<id>.json (écriture atomique : temp + rename)

QUARANTAINE : build_artifacts/quarantaine/<id>.json contient la réponse brute
  et la raison. Rien de douteux n'entre dans data/.
```

## Logic Flow

1. Garde d'entrée : le manifeste existe, sa `version_taxonomie` correspond à
   `tags.json` v1. Sinon, arrêt — on ne génère pas contre une taxonomie périmée.
2. Calculer l'ensemble à faire, **afficher l'estimation de coût** via
   `tools/estimate_cost.py` et demander confirmation au-delà d'un seuil.
3. Exécuter le chemin choisi.
4. Écrire un résumé de run : `build_artifacts/rapports/run_<horodatage>.json`
   avec compte réussi / quarantaine / verrouillé / sauté.
5. Rappeler en fin de run qu'il faut lancer l'étage 10 : cet étage ne valide pas.

## Implementation Notes

- **Séparation stricte génération / validation.** Cet étage écrit ce que le
  modèle a répondu, plus la provenance. Il ne juge pas le contenu. L'étage 10
  juge. Mélanger les deux rend impossible de mesurer le taux d'échec réel du
  prompt.
- Écriture atomique obligatoire : un run interrompu ne doit pas laisser de JSON
  tronqué dans `data/enrichissements/`.
- Le verrou humain se vérifie **avant** l'appel, pas après : inutile de payer
  pour un enregistrement qu'on refusera d'écrire.
- Identifiants AWS uniquement par variables d'environnement / rôle. Aucun secret
  dans le dépôt, aucun bucket en dur : région et bucket en configuration.
- Plafond de dépense : au moins un garde-fou local (nombre max
  d'enregistrements par run, confirmation interactive), et un budget AWS côté
  compte. A8 prévoit 5 à 10 passes complètes ; c'est le moment de les rendre
  peu coûteuses à répéter, pas de les rendre irréversibles.
- Ne pas peupler de fichier `__init__` ni déclarer `__all__`.

## Verification Criteria

- Test hors ligne avec un client Bedrock simulé : 12 prompts de fixture →
  12 fichiers écrits, avec les 6 champs de provenance corrects.
- Relance sans `--force` : 0 appel réseau émis (compteur du client simulé à 0).
- Un enregistrement marqué `verifie_par_humain: true` n'est pas réécrit sans
  `--force`, et le run le comptabilise comme « verrouillé ».
- Une réponse JSON malformée simulée part en quarantaine et n'atteint pas
  `data/enrichissements/`.
- `--mode batch` avec un nombre d'enregistrements sous le minimum échoue avec un
  message qui nomme le minimum et propose `--mode ondemand`.
- Une interruption simulée en cours d'écriture ne laisse aucun fichier tronqué.
- Sur le corpus réel : un run complet produit ~2 070 fichiers, et l'étage 10
  rapporte un taux d'échec exploitable (l'objectif de réglage est < 5 %).

## Git Handling

- Branche : `feat/enrichissement-llm/06-enrich-llm`.
- Commits :
  - `feat(enrich): ajouter le chemin on-demand avec concurrence bornée`
  - `feat(enrich): ajouter le chemin Bedrock batch et la reprise par job`
  - `feat(enrich): mettre en quarantaine les réponses non conformes`
  - `test(enrich): couvrir reprise, verrou humain et quarantaine hors ligne`
- Les enregistrements produits sur le corpus complet sont committés en un commit
  de données séparé : `data(enrich): générer les enrichissements v1 (p1.0)`.
- Fusion `--no-ff` en fin de Vague 5.

## Expected Outcome

Une génération reprenable, bornée en coût, qui respecte le verrou humain, isole
les réponses douteuses hors de `data/`, et laisse le jugement de qualité à
l'étage suivant.
