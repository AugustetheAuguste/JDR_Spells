# Polices embarquées

Les quatre fichiers de ce répertoire sont sous **SIL Open Font License 1.1**, qui
autorise la redistribution, y compris embarquée dans un site. Ils sont commis dans
le dépôt et servis depuis le même domaine : le site est une fonction pure du dépôt
(B1) et une requête vers un CDN tiers ferait dépendre le premier rendu d'un serveur
qu'on ne tient pas. `next/font` a été écarté pour la même raison — il télécharge la
police **au moment du build**, ce qui rend le build non reproductible hors ligne.

Ce sont les sous-ensembles **latin** (`unicode-range: U+0000-00FF`) tels que servis
par `fonts.gstatic.com` : ils couvrent le français accentué, `œ` et `æ` compris.

| Fichier | Police | Version | Origine |
|---|---|---|---|
| `fraunces-latin-var.woff2` | Fraunces (variable, `opsz` 9–144, `wght` 400–700) | v38 | Undercase Type — OFL 1.1 |
| `inter-latin-var.woff2` | Inter (variable, `wght` 400–700) | v20 | Rasmus Andersson — OFL 1.1 |
| `ibm-plex-mono-latin-400.woff2` | IBM Plex Mono 400 | v20 | IBM — OFL 1.1 |
| `ibm-plex-mono-latin-500.woff2` | IBM Plex Mono 500 | v20 | IBM — OFL 1.1 |

Remplacer un fichier oblige à mettre à jour ce tableau : sans version ni origine
écrite, personne ne peut vérifier plus tard ce qui est servi.
