---
name: verify
description: Runtime verification of the web/ interface — build, serve the static export, drive it in Chromium and capture evidence. Use when verifying a change to web/ actually works in the running app, not just in tests.
---

# Vérifier l'interface web en l'exécutant

`npm run web:test` et la CI prouvent que le code compile et que les tests passent.
Ils ne prouvent pas que le site marche : tout ce qui vit **après l'hydratation**
(filtres, favoris, import/export, recherche) leur est invisible. Cette skill
décrit comment atteindre cette surface.

## 1. Construire

```bash
npm run web:build          # -> web/out/, ~3 min, 2076 pages
```

Le build est le préalable : `web/out/` est ce qu'on sert. Inutile de relancer
`web:test` — ce serait rejouer la CI.

## 2. Servir l'export

Un serveur de fichiers suffit, mais il doit reproduire deux comportements :
répertoire → `index.html` (le site est en `trailingSlash: true`) et repli sur
`404.html`. Recette utilisée et fonctionnelle :
`build/verify_harness/serve.mjs <racine> <port>` (Node pur, `127.0.0.1`).

```bash
node serve.mjs /c/Users/adoyet/Desktop/JDR_Spells/web/out 4399 &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4399/
```

`file://` ne convient pas : les pages chargent `/data/*.json` en chemin absolu.

## 3. Piloter

Playwright **n'est pas** une dépendance du dépôt, mais les navigateurs sont déjà
sur la machine. Ne pas télécharger de navigateur :

```bash
npm i playwright-core@1.62.1        # driver seul, aucun navigateur
```
```js
const EXE = join(process.env.LOCALAPPDATA, 'ms-playwright',
                 'chromium-1223', 'chrome-win64', 'chrome.exe')
await chromium.launch({ executablePath: EXE })
```

**`build/` est gitignoré en entier (`.gitignore:22`) : les harnais ci-dessous sont
jetables et ne survivent pas à un clone.** Ce n'est pas un oubli — c'est pourquoi
`drive_quatre.mjs` et ses fixtures, cités par une version antérieure de cette skill,
n'existaient plus au passage suivant. Les recettes sont donc décrites ici en
assertions, pas en chemins de fichiers : ce qui doit être affirmé se relit, un script
absent ne se relit pas. Générer les fixtures d'import dans le script lui-même
(`writeFileSync` vers `tmpdir()`) plutôt que de les chercher sur le disque.

## 4. Pièges rencontrés — les connaître fait gagner une demi-heure

- **Les résultats sont un `<table>`, pas des cartes.** Localiser les lignes avec
  `tr:has(a[href^="/sorts/"])`. Un sélecteur `article, li` ne trouve rien.
- **`locator.fill()` ne déclenche pas la recherche.** Utiliser
  `pressSequentially()` ou `keyboard.insertText()`. Le collage réel, lui,
  fonctionne — c'est un artefact du pilotage, pas un défaut.
- **`locator.check()` échoue à la première interaction** sur `/comparaison/`
  (« Clicking the checkbox did not change its state »). `click()` marche.
  Course d'hydratation côté harnais, pas côté application.
- **Les préchargements de segments RSC renvoient 404** sous un serveur statique
  nu : Next demande `/sorts/<slug>/__next.sorts.$d$slug.txt` alors que le fichier
  est émis en `__next.sorts/$d$slug.txt`. La navigation marche quand même.
  Ne pas confondre avec une panne applicative ; à vérifier séparément sur Vercel.
- **`npm run verifier:tout` construit déjà `web/out/`.** Le préfixer d'un
  `npm run web:build` double le build (~2,5 min chacun) et fait dépasser les
  10 min d'un appel d'outil. Lancer la chaîne seule, en tâche de fond.
- **Un test de `navigation.test.tsx` expire par intermittence** (délai de 5 s)
  quand la suite complète tourne sous charge ; il passe seul. Rejouer la chaîne
  avant de conclure à une régression.
- La clé `localStorage` des favoris est **`pf-sorts-favoris`**, de forme
  `{version, listes[{id_liste, nom, cree_le, modifie_le, sorts[]}], liste_active}`.
- **Semer `localStorage` demande deux `goto`** : le premier pour obtenir une origine
  où `page.evaluate` puisse écrire, le second pour que l'application relise. Le
  magasin est lu à l'hydratation, donc écrire après coup ne se voit pas sans
  navigation.
- **`new URL(req.url()).pathname` exclut la query.** En interceptant PostgREST, la
  table est `'listes'` tout court — `startsWith('listes?')` ne matche jamais, et
  l'assertion échoue en accusant l'application. Comparer `=== 'listes'`.
- **Un `input[type=file]` masqué se pilote quand même** : `setInputFiles()` n'a pas
  besoin que l'élément soit visible, inutile de cliquer « Importer un fichier »
  d'abord.

## 5. Parcours qui valent le détour

Ce sont ceux que la CI ne voit pas :

1. **Filtres** : `#filtre-classe` → l'URL devient `?classe=barde`, l'en-tête devient
   « Niveau pour Barde ». Recharger l'URL doit restituer l'état.
2. **Recherche** : taper dans `#champ-recherche` → `?q=…`, moteur chargé à la demande.
   Insensible aux accents et à la casse (`epee` = `épée`).
3. **Favoris** : l'étoile sur une fiche → `aria-pressed`, persistance au rechargement.
4. **Import/export** : exporter, vider `localStorage`, réimporter.
   **Tester les quatre branches** : navigateur vierge / liste existante ×
   « Fusionner » / « Créer de nouvelles listes ». Elles ne se comportent pas pareil
   (cf. le défaut trouvé le 2026-08-25 : import dans un navigateur vierge laissant
   `liste_active` à `null`). Semer chaque branche, affirmer les invariants, sortir 1
   au premier échec.
   - La branche « vierge + Fusionner » est **inatteignable par l'interface** : le
     bouton est `disabled` avec un `title` qui l'explique. La preuve de cette
     branche est donc cet état-là, pas un import.
   - Deux invariants à affirmer par branche, pas seulement l'absence d'erreur :
     `liste_active` non nulle dès qu'une liste existe, et lignes rendues ==
     `ids de la liste active`. Un compte de liens non nul ne suffit pas.
   - Deux sondes qui valent les quatre branches : un fichier à **deux** listes
     (quelle liste devient active ?) et un fichier à **zéro** liste (le message
     doit dire que le fichier était vide, jamais « Import terminé »).
5. **Comparaison** : cocher deux classes → `?classes=barde,druide`, colonne d'écart.
   La quatrième case est désactivée, avec message.
6. **Sondes** : `localStorage` corrompu, fichier importé non conforme, valeurs de
   filtre absurdes dans l'URL, requête sans résultat, route inexistante.
7. **Compte et synchronisation** : le seul parcours dont le critère est **réseau et
   non visuel** — l'interface affiche volontiers « à jour » au-dessus d'une synchro
   qui n'a rien envoyé, et c'est exactement la panne du 2026-08-31
   (`docs/synchro_favoris_supabase.md`). Intercepter avec `page.route()` :
   `**/auth/v1/token**` et `**/auth/v1/user**` répondent une session factice,
   `**/auth/v1/logout**` un 204, `**/rest/v1/**` un `[]` sur `GET` et un 201 sans
   corps sur les autres. Le JWT peut être **non signé** : `supabase-js` lit `sub` et
   `exp` côté navigateur, il ne vérifie pas la signature. Intercepter et ne pas
   appeler n'est pas une commodité — la seule alternative est d'écrire dans le projet
   Supabase de production.
   - Ce qu'il faut affirmer : **déconnecté, zéro appel `/rest/v1`** (la promesse du
     § 11) ; connecté, un `GET .../listes` **puis** un `POST .../listes`, dans cet
     ordre ; « Synchroniser maintenant » en émet à son tour ; la déconnexion part en
     `?scope=local` et **jamais** `global`, qui éteindrait le téléphone.
   - Un parcours entièrement déconnecté doit voir `**/*.supabase.co/**` compter zéro
     requête. C'est ce qui prouve que monter le provider partout n'a rien armé.
