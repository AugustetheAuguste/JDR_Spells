# Déploiement Vercel — les décisions derrière `web/vercel.json`

Ce fichier existe parce que `web/vercel.json` **ne peut pas porter de
commentaires** : le schéma de Vercel (`https://openapi.vercel.sh/vercel.json`)
déclare `additionalProperties: false`, donc toute clé inventée — même un
`_pourquoi` évidemment inerte — fait **refuser la requête de déploiement** :

```
Invalid request: should NOT have additional property `_pourquoi`.
```

Observé le 2026-08-26, sur un redéploiement bloqué. Le raisonnement vit donc ici.

## Le réglage qui n'est pas dans le dépôt, et qui décide de tout

**Root Directory = `web/`**, dans les réglages du projet Vercel. Il n'est
enregistrable nulle part dans le dépôt, et c'est le seul réglage indispensable.
Sans lui, Vercel clone la racine, n'y trouve **aucun `vercel.json`** et aucun
script `build` dans le `package.json` racine (il n'y a que `web:build`,
`data:export`, `verifier:tout`, qu'il ne connaît pas) — alors il publie le
*checkout tel quel*. Symptôme observé : build « réussi » en 3 s, « No framework
detected », 2095 fichiers HTML et 8757 « Misc » déployés (soit `cache/html/` et
`data/`, pas l'export), et **404 sur `/`** puisque la racine du dépôt n'a pas
d'`index.html`.

Conséquence à connaître : dans cet état, `cache/html/` — 2089 pages brutes de
pathfinder-fr.org — est publiquement téléchargeable. Ce n'est plus un index de
consultation qui renvoie au wiki, c'est une republication de ses octets. Corriger
*Root Directory* suffit à l'exclure, `cache/` n'entrant jamais dans le build.

## Aucun secret, par construction

`output: 'export'` : pas de fonction, pas de base, aucune variable
d'environnement. **Si un déploiement réclame un secret, c'est le symptôme qu'une
dépendance d'exécution s'est glissée quelque part**, pas une configuration à
fournir. `web/public/data/` est committé, donc le build ne touche pas à Python.

## Le cache — l'unique écart au plan, délibéré

`/_next/static/` et `/fonts/` portent un condensat dans leur nom : `immutable` y
est sûr. **`/data/*.json` NON** : leur URL est stable d'un export au suivant, et
`immutable` y servirait l'ancien index à un visiteur pendant un an après une
correction du corpus. Le plan demandait `immutable` partout ; c'est le seul
écart, et il est dans ce sens-là exprès.

## Vérifier la configuration avant de déployer

Le contrôle qui manquait — rien dans la CI ne validait ce fichier :

```bash
curl -sS -o build/vercel.schema.json https://openapi.vercel.sh/vercel.json
python - <<'EOF'
import json, jsonschema
schema = json.load(open('build/vercel.schema.json', encoding='utf-8'))
conf = json.load(open('web/vercel.json', encoding='utf-8'))
Validator = jsonschema.validators.validator_for(schema)
Validator.check_schema(schema)
print(len(list(Validator(schema).iter_errors(conf))), "erreur(s)")
EOF
```

## Ce que le déploiement doit montrer quand il est correct

| Indice | Attendu | Ce qu'on a vu en cas d'échec |
|---|---|---|
| Durée du build | ~2 min | 3 s |
| Framework | Next.js détecté | « No framework detected » |
| Journal | `Generating static pages (2076/2076)` | absent |
| Assets | ~2076 HTML issus de `out/` | 2095 HTML, 8757 Misc (le dépôt) |

## Reste non vérifié

- **Version de Node** : Vercel a choisi 24.x, et rien ne l'épingle dans le dépôt
  (aucun `engines`). Le build n'est donc pas reproductible d'une évolution de
  leur défaut à la suivante.
- **Les en-têtes de cache eux-mêmes** : jamais observés sur une réponse réelle.
- **Les préchargements de segments RSC** renvoyaient 404 sous un serveur statique
  nu en local ; à confirmer ou à écarter sur un déploiement réel.
