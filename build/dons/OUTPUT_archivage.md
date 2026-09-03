# Checklist d'archivage du dépôt d'origine `Dons`

**Ce document est une checklist. Elle n'a PAS été exécutée. Le dépôt
`C:\Users\adoyet\Desktop\Dons` n'a été ni touché, ni archivé, ni supprimé.**
L'archivage de ce dépôt est une action irréversible, hors du dépôt cible
`JDR_Spells`, et attend une confirmation humaine explicite avant d'être menée
— conformément au plan de l'étape 17 (`17_DOCS_AND_DECOMMISSION.md`, section
« Implementation Notes »).

## Pourquoi une checklist, pas une exécution

La fusion (`feat/fusion-dons`) a importé le corpus des dons dans
`JDR_Spells`. Le dépôt `Dons` d'origine reste, à ce stade, la seule copie
git de l'historique pré-fusion tel qu'il existait avant les `git mv` de
l'étape 04. Archiver (ou supprimer) ce dépôt avant d'avoir vérifié que cet
historique est bien préservé côté `JDR_Spells` serait une perte de
traçabilité irréversible pour un gain nul — cette étape ne le fait donc pas.

## À vérifier avant toute décision d'archivage

1. **Historique git préservé par les `git mv` de l'étape 04.**
   ```
   git log --follow src/pf_dons/engine.py
   ```
   doit remonter jusqu'à l'historique antérieur à la fusion (les commits du
   dépôt `Dons` d'origine sur `pf1_dons/engine.py`), pas seulement au commit
   d'import. Si `--follow` s'arrête au commit de fusion, l'historique n'a
   **pas** été préservé et l'archivage ne doit pas avoir lieu avant
   correction.

2. **139 tests des dons collectés.** Le plan cite ce chiffre comme repère de
   l'état antérieur du dépôt ; `build/dons/OUTPUT_parite_python_ts.md`
   (étape 14) documente que la suite `tests/dons/` a grandi depuis et compte
   désormais 165 tests passés. Vérifier :
   ```
   PYTHONPATH=src python -m pytest tests/dons -q
   ```
   et confirmer que le nombre collecté est **au moins** 139 (165 attendu à ce
   jour), tous verts, avant d'archiver — un compte inférieur signalerait une
   perte de couverture entre les deux dépôts.

3. **Parité verte, profil complet.** Le garde de parité Python/TypeScript
   (§15 du `CLAUDE.md` fusionné) doit être au vert sur le profil `complet`,
   pas seulement `rapide` :
   ```
   PROFIL=complet npm run dons:parite
   ```
   attendu : `0 régression(s), 0 relâchement(s)`. Un profil `rapide` vert
   seul ne couvre que 42 des 1260 personnages du banc de test complet et ne
   suffit pas à garantir l'absence de divergence.

4. **`npm run verifier:tout` entièrement vert**, y compris `web:build`,
   `web:verifier`, `web:test`, `check:data` et les contrats de dons — un
   dépôt cible qui ne construit pas ne doit jamais devenir la seule copie
   du corpus des dons.

5. **Aucune fonctionnalité du dépôt `Dons` restée non portée** : en
   particulier confirmer que `Dons/web/` (l'explorateur vanilla JS,
   `explorateur_dons.js`/`.css`, remplacé par `/dons` en Next.js) n'a plus
   de contenu qui ne soit pas déjà couvert par `web/components/dons/` et
   `web/lib/dons/` côté `JDR_Spells` — sinon l'archivage emporterait une
   fonctionnalité jamais fusionnée.

6. **Confirmation humaine explicite et datée**, consignée dans
   `DECISIONS.md` de `JDR_Spells`, avant toute action sur le dépôt `Dons`.
   Cette checklist ne constitue pas cette confirmation.

## Ce que « archiver » signifierait, une fois la confirmation obtenue

(Pour référence uniquement — non exécuté à cette étape.)

- Rendre le dépôt `Dons` lecture seule (protection de branche / mode
  archive côté hébergeur), plutôt que le supprimer, pour garder
  l'historique git accessible même si `--follow` s'avérait incomplet côté
  `JDR_Spells`.
- Ne supprimer aucun fichier local avant d'avoir vérifié un accès distant
  (remote/backup) intact.
- Mettre à jour toute documentation externe (README, liens) qui pointerait
  encore vers `Dons` comme dépôt actif.

## État réel à la clôture de l'étape 17

- Checklist rédigée : **oui** (ce document).
- Checklist exécutée : **non**.
- Dépôt `Dons` touché par cette étape : **non** — aucune écriture, aucune
  suppression, aucun `git mv`/`git rm` n'y a été effectué. Seule exception,
  hors de ce dépôt et hors du périmètre `git` : le rapport de l'étape 17
  déposé dans `Dons/build/fusion-dons-sorts/reports/`, qui est un livrable
  de coordination, pas une modification du dépôt lui-même.
- Décision d'archivage : **en attente d'un accord humain explicite**, non
  donné à ce stade.
