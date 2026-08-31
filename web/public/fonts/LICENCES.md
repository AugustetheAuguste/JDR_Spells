# Polices embarquées

Les fichiers de ce répertoire sont sous **SIL Open Font License 1.1**, qui
autorise la redistribution, y compris embarquée dans un site. Ils sont commis dans
le dépôt et servis depuis le même domaine : le site est une fonction pure du dépôt
(B1) et une requête vers un CDN tiers ferait dépendre le premier rendu d'un serveur
qu'on ne tient pas. `next/font` a été écarté pour la même raison — il télécharge la
police **au moment du build**, ce qui rend le build non reproductible hors ligne.

Ce sont les sous-ensembles **latin** (`unicode-range: U+0000-00FF`) tels que servis
par `fonts.gstatic.com` : ils couvrent le français accentué, `œ` et `æ` compris.

| Fichier | Police | Version | Origine |
|---|---|---|---|
| `eczar-latin-400.woff2` | Eczar 400 | v27 | Vaibhav Singh / Ek Type — OFL 1.1 |
| `eczar-latin-500.woff2` | Eczar 500 | v27 | Vaibhav Singh / Ek Type — OFL 1.1 |
| `eczar-latin-600.woff2` | Eczar 600 | v27 | Vaibhav Singh / Ek Type — OFL 1.1 |
| `eczar-latin-700.woff2` | Eczar 700 | v27 | Vaibhav Singh / Ek Type — OFL 1.1 |
| `lora-latin-400.woff2` | Lora 400 | v37 | Cyreal — OFL 1.1 |
| `lora-latin-500.woff2` | Lora 500 | v37 | Cyreal — OFL 1.1 |
| `lora-latin-600.woff2` | Lora 600 | v37 | Cyreal — OFL 1.1 |
| `lora-latin-400-italic.woff2` | Lora 400 italique | v37 | Cyreal — OFL 1.1 |
| `ibm-plex-mono-latin-400.woff2` | IBM Plex Mono 400 | v20 | IBM — OFL 1.1 |
| `ibm-plex-mono-latin-500.woff2` | IBM Plex Mono 500 | v20 | IBM — OFL 1.1 |

**2026-08-31 — passage à Eczar/Lora (Grimoire).** `fraunces-latin-var.woff2` et
`inter-latin-var.woff2` sont retirés : le système v1 « flat minimal » qui les
utilisait est remplacé par Grimoire (parchemin, direction adoptée par arbitrage
humain, voir `design/DECISIONS.md`). Eczar porte l'affichage (noms de sorts,
titres), Lora le corps ; IBM Plex Mono reste pour les données tabulaires, inchangé.
L'italique de Lora sert la citation de source et les mentions de désaccord.

Remplacer un fichier oblige à mettre à jour ce tableau : sans version ni origine
écrite, personne ne peut vérifier plus tard ce qui est servi.
