# Contribuer au site — branches, environnement, boucle de travail

Ce fichier vaut pour le travail sur **`web/`** : nouvelles fonctionnalités et
correctifs de l'interface. Le pipeline Python obéit à `CLAUDE.md` et aux Skills,
qui gardent l'autorité sur le corpus.

## 1. Le tronc, et ce qu'il déclenche

**`main` est le tronc et Vercel en déploie la production.** Une poussée sur `main`
est donc une mise en production : il n'y a pas d'étape de validation entre les
deux, et c'est le seul fait à retenir de tout ce fichier.

Corollaires :

- **On ne travaille jamais sur `main`.** Une branche par sujet, fusionnée par PR.
- Toute autre branche produit un **déploiement de prévisualisation** Vercel, à son
  URL propre. C'est là qu'on regarde une fonctionnalité avant de la fusionner —
  pas en local seulement, parce que le local ne rejoue pas `output: 'export'`
  servi en fichiers plats (§ 5).
- La CI tourne sur toute PR, et sur les poussées vers `main`. Un tronc rouge est
  le seul état qu'on découvre trop tard ; c'est pourquoi il est déclenché deux fois.

## 2. Nommer une branche

`<type>/<sujet-court-en-francais>`, tirets, sans accent — le préfixe est repris
des branches existantes, il n'est pas nouveau :

| Préfixe | Pour |
|---|---|
| `feat/` | une fonctionnalité visible du site |
| `fix/` | un bug, un budget dépassé, un déploiement cassé |
| `docs/` | de la documentation seule |
| `chore/` | outillage, CI, dépendances — rien que l'utilisateur voie |
| `refactor/` | code déplacé sans changement de comportement |

Une branche = un sujet. `fix/vercel-json-schema` a porté deux correctifs de
déploiement successifs et une PR a été fusionnée avant que le second n'arrive :
la branche par défaut est restée cassée alors que la PR était verte. **Un sujet
fusionné, une branche refermée.**

Les messages de commit suivent la même grammaire : `type(portee): sujet à
l'infinitif`, en français, la ligne de corps expliquant **pourquoi**.

## 3. Installer l'environnement

Node est épinglé par **`.nvmrc` (24)** et par `engines` dans les deux
`package.json` — la CI lit le même fichier, il n'y a donc plus de version de Node
implicite. Python : 3.11.

```bash
nvm use                      # ou fnm use — lit .nvmrc
npm ci                       # outils de vérification, à la racine
npm --prefix web ci          # le site
python -m pip install -r requirements.txt
```

`npm ci` et non `npm install` : c'est le lockfile qui rend le build
reproductible. Aucun secret n'est nécessaire, ici comme au déploiement — s'il en
faut un, c'est le symptôme d'une dépendance d'exécution, pas une variable à
fournir (`docs/deploiement.md`).

## 4. La boucle de travail

```bash
git switch main && git pull          # partir du tronc à jour, toujours
git switch -c feat/mon-sujet
npm --prefix web run dev             # http://localhost:3000
```

Avant de pousser :

```bash
npm run web:test                     # vitest + eslint + tsc
```

Avant d'ouvrir la PR — la chaîne complète, dans l'ordre où la CI la lance :

```bash
npm run verifier:tout
```

Elle coûte ~3 min et évite l'aller-retour rouge sur la PR. Elle enchaîne le
contrat de données, la dérive, les tests, le build des 2 076 pages, les budgets
et l'accessibilité.

## 5. Ce que le local ne dit pas

Trois défauts ne se voient **jamais** sous `next dev`, et ce sont ceux qui
cassent la production :

- **Une dépendance d'exécution** (route d'API, `cookies()`, rendu dynamique) :
  `next dev` l'exécute sans broncher, `output: 'export'` la refuse au build.
  D'où `npm run web:build` avant toute PR qui touche à un composant serveur.
- **Le comportement en fichiers plats** : les URL sans barre finale, les 404, les
  préchargements RSC. `docs/deploiement.md` les liste comme non vérifiés.
  Regarder la prévisualisation Vercel, pas seulement `localhost`.
- **Les budgets.** Ils sont bloquants exprès, et mesurés en **brotli** — ce que
  Vercel sert réellement. Le JS client est budgété en deux lignes distinctes,
  parce que 95 % du poids d'une page est du framework et qu'un total unique
  mesurait la version de Next plutôt que ce dépôt :
  - le **socle** commun aux quatre routes (React + routeur Next) est à
    **161,1 kB** sur 175 ; aucun code applicatif ne le fera baisser, et il ne
    bouge que sur mise à jour du framework — un dépassement est un événement à
    examiner, pas à absorber ;
  - l'**applicatif** par route est à **9,3 kB** au plus (navigation) sur 25.
    C'est la ligne qu'une PR peut réellement déplacer, donc celle à surveiller :
    elle admet une vraie fonctionnalité, elle refuse une bibliothèque d'UI
    empaquetée.

  La recherche est chargée à la demande (5,4 kB brotli hors du payload initial)
  et `verifier_build.ts` échoue si l'`import()` dynamique redevient statique —
  une régression qui compile, passe les tests et ne se voit nulle part ailleurs.

## 6. Les règles du site qu'on ne rediscute pas

Elles sont dans `CLAUDE.md` § 11 et dans la Skill `pf-web-design-system`. Les
quatre qui reviennent le plus souvent en revue :

1. **Le niveau est relatif à la classe.** `niv` est une table classe→niveau,
   jamais un scalaire ; « le » niveau d'un sort n'existe pas. Le niveau 0 est
   réel, une absence est un tiret cadratin, jamais un `0`.
2. **`web/public/data/` est dérivé et committé.** Une retouche à la main sera
   écrasée : corriger `data/`, puis `npm run data:export`.
3. **L'état des filtres vit dans l'URL** et nulle part ailleurs — pas de
   `useState` parallèle qui puisse en diverger.
4. **Le slug est l'URL publique.** Le changer casse des liens externes ; les
   favoris tiennent des `id` exprès.

Et côté style : TypeScript strict, aucun `any`, aucune couleur hors
`lib/design/tokens.ts`, vocabulaire figé dans `MOTS`.

## 7. Fusionner

PR vers `main`, CI verte, prévisualisation regardée. Puis **fusionner sur GitHub**
et supprimer la branche distante dans la même opération — c'est ce qui évite la
douzaine de branches mortes qu'on a dû élaguer une fois déjà.

Vérifier que la fusion a bien emporté le dernier commit : une PR fusionnée trop
tôt laisse un tronc cassé avec une PR verte à côté.

## 8. Quand un déploiement échoue

`docs/deploiement.md` d'abord : il consigne les échecs déjà rencontrés et leur
cause exacte (`outputDirectory`, *Root Directory*, la clé inventée que le schéma
refuse). Deux réglages décident de tout et **ne sont pas dans le dépôt** —
*Root Directory* = `web/` et *Output Directory* laissé au défaut. Un symptôme
identique à l'un de ceux du fichier vient presque toujours de là.
