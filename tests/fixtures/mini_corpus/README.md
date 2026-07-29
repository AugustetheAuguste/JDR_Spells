# mini_corpus — fixture **GELÉE**

Douze sorts réels, copiés **verbatim** (octet pour octet) depuis `data/sorts/`
du vrai corpus, plus un `data/index/` et un `data/classes.json` réduits et
cohérents avec ces douze sorts. L'arbre reproduit la disposition du dépôt, si
bien que tout consommateur qui accepte une `racine` peut pointer ici :

```
tests/fixtures/mini_corpus/
  data/classes.json                  (15 classes citées par les 12 sorts)
  data/index/sorts_uniques.jsonl     (12 lignes)
  data/index/carte_doublons.json     (recomptée sur les 12)
  data/index/sorts_exclusifs.json    (recompté sur les 12)
  data/sorts/<id>.json               (12 fichiers, 21 clés chacun)
```

## Elle ne se régénère JAMAIS

La fixture est **gelée**. Aucun test ne la reconstruit, ne la réécrit, ni ne la
recopie depuis `data/`. Règle du plan (`build/01_SKILLS_AND_TOOLS.md`, §
*Implementation Notes*), citée mot pour mot :

> La fixture est copiée puis **gelée** : un test qui casse parce que le vrai
> corpus a bougé est un mauvais test. Documenter qu'elle ne se régénère pas.

Conséquence pratique : si `tests/test_mini_corpus_fixture.py::TestCopieVerbatim`
échoue, cela signifie que le **vrai corpus** a changé sous la fixture. Ce n'est
pas à la fixture de suivre. Deux issues, et deux seulement : (1) la
modification du corpus était involontaire — la corriger ; (2) elle était
légitime — alors un humain dégèle sciemment la fixture, régénère, relit la
sélection ci-dessous et met ce README à jour, y compris le sha ci-dessous.

`tools/build_mini_corpus.py` documente la provenance de la sélection. Ce n'est
pas un outil de pipeline : il refuse de tourner sans `--confirmer-degel`, il
n'est appelé par aucun test et il ne doit jamais l'être.

## Commit source

Copiée depuis le commit `6d5f23b0a827388b9c4a6c042d48478742206894`
(branche `feat/enrichissement-llm/01-skills-outils`), corpus de 2070 sorts.

## Sélection — 12 ids et critères couverts

Choix déterministe : couverture gloutonne des critères, ids itérés par ordre
alphabétique, aucun tirage aléatoire. Chaque sort couvre plusieurs critères ;
chaque critère est couvert par au moins un sort.

| id | critères couverts |
|---|---|
| `absorption-d-energie` | niveau 9 · à dégâts · zone · apostrophe · accent · mythique nul |
| `alarme-d-invisibilite` | **Abjuration** · sans dégâts · zone · désaccord liste/page · apostrophe · accent · mythique nul |
| `animation-des-morts` | à dégâts · **description longue avec tableau** (4256 signes) · **bloc mythique non nul** |
| `arc-baton` | **Transmutation** · sans dégâts · portée personnelle · désaccord · accent · **trait d'union** · mythique nul |
| `arret-du-temps` | niveau 9 · Transmutation · à dégâts · portée personnelle · accent · bloc mythique non nul |
| `aura-d-avidite` | Abjuration · sans dégâts · zone · personnelle · apostrophe · accent · bloc mythique non nul |
| `controle-de-l-eau` | Transmutation · sans dégâts · zone · désaccord · apostrophe · accent · mythique nul |
| `destruction-de-mort-vivant` | **niveau 0** · à dégâts · zone · trait d'union · mythique nul |
| `lamentation-des-derniers-jours-d-ete` | Abjuration · à dégâts · zone · désaccord · apostrophe · accent · mythique nul |
| `resistance-a-l-age` | Transmutation · sans dégâts · personnelle · désaccord · apostrophe · accent · mythique nul |
| `resistance-a-l-age-mineure` | Transmutation · sans dégâts · personnelle · désaccord · apostrophe · accent · mythique nul |
| `voile-d-energie-positive` | Abjuration · sans dégâts · zone · personnelle · apostrophe · accent · mythique nul |

Récapitulatif des critères du plan, tous couverts : niveau 0
(`destruction-de-mort-vivant`), niveau 9 (`absorption-d-energie`,
`arret-du-temps`), écoles opposées Abjuration / Transmutation, sort à dégâts,
sort sans dégâts, sort de zone, sort à portée personnelle, description longue
avec tableau (`animation-des-morts`), désaccord liste/page connu
(`concordance` non `true`), apostrophe, accent et trait d'union dans le `nom`,
et les deux faces du bloc `mythique` (non nul et nul).

Aucun des douze ids ne porte de suffixe de collision `-2`/`-3` : pour chacun,
`id == slugify(nom)` exactement. Le choix a été fait ainsi volontairement, pour
ne pas mêler la question des collisions à celle de la fixture.

## Règles d'encodage

Aucun fichier de cet arbre — README compris — ne doit contenir **U+FFFD**
le caractère de remplacement Unicode. Sa présence est une corruption, pas une donnée. Tous les fichiers sont
en UTF-8 sans BOM, en LF ; les `.json` en `indent=2` avec saut de ligne final,
les `.jsonl` compacts, une ligne par enregistrement, `ensure_ascii=False`.
