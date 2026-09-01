# 10 — LIB FACETS URL : étendre l'état d'URL et les filtres aux dons

**Vague 3.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/10-lib-facets-url`.

## Objectives

Étendre les deux modules qui portent l'état de navigation des sorts — `etat-url.ts`
et `filtres.ts` — pour qu'ils portent aussi les facettes des dons, **sans casser
une seule URL de sort existante**.

Zéro composant écrit ici : de la bibliothèque pure et ses tests. C'est ce qui
permet à l'étape 13 (la liste) de n'écrire que du rendu.

## Dependencies & Parallelization

- **Vague 3.** Dépend de :
  - **05_WEB_INDEX_CONTRACT** — les noms des facettes et leurs vocabulaires clos.
  - **01_SKILLS** — `pf-dons-taxonomie` (les libellés français) et
    `pf-web-design-system` amendé.
- Parallèle à **08**, **09**, **11**, **12** : n'écrit que dans
  `web/lib/navigation/` et `web/lib/recherche/`. **Ne dépend pas de 09** : les
  filtres portent des noms de facette, pas des verdicts.
- **11** touche `web/app/dons/[slug]/` — disjoint. Si 11 a besoin d'un lien
  filtré, il le construit par la fonction publiée ici après fusion de la vague.

## Inherited Context from Dependencies

### `web/lib/navigation/etat-url.ts` (444 lignes) — le contrat existant

Exporte `EtatUrl`, `ETAT_VIDE`, `CLES`, `listeDe`, `analyserTags`.

Deux règles du dépôt, non négociables :

1. **L'état des filtres vit dans l'URL et nulle part ailleurs**, avec
   `{scroll: false}` à l'écriture (`CLAUDE.md` §11). Pas de `useState` miroir : un
   état dupliqué désynchronise le partage de lien.
2. **Les valeurs sont des *noms*, jamais les codes entiers** de l'index. Les codes
   sont un détail de compression interne ; une URL qui les porterait se casserait
   au prochain réexport, puisque les tables de tête peuvent se réordonner.

### Le cycle à trois états des tags — à reproduire exactement

| Forme dans l'URL | Sens |
|---|---|
| `nom` | OU (au moins un) |
| `-nom` | NON (exclure) |
| `!nom` | ET (obligatoire) |

**`!` et non `+`** : `+` se décode en espace dans une chaîne de requête, et le
préfixe serait perdu en silence. `analyserTags` implémente déjà cette lecture —
**la réutiliser**, ne pas en écrire une seconde.

### `web/lib/recherche/filtres.ts` (228 lignes)

`Filtres` porte `classe`, `classes`, `niveaux`,
`niveauSansClasse: 'refuser' | 'minimum'`, `ecoles`, `composantes`, `jets`,
`portees`, `tempsIncantation`, `typesDegats`, `tags`, `tagsExclus`,
`tagsObliges`, `conditionsInfligees` (+`Exclues`/`Obligees`), `desaccord`.
Plus `FILTRES_VIDES`.

### La collision de vocabulaire à isoler

Les vocabulaires des dons sont disjoints des 35 tags de sorts, **sauf
`bonus_chiffre`**, présent dans les deux. Les deux index sont deux fichiers, donc
la collision est inoffensive côté données — **elle devient dangereuse ici**, dans
les clés d'URL. D'où le préfixe.

### Les clés d'URL à ajouter — **toutes préfixées `dons_`**

```
?dons_effet=      effet_principal        (18 valeurs, cycle 3 états)
?dons_effet2=     effets_secondaires
?dons_cible=      cible_du_bonus
?dons_contexte=   contexte
?dons_activation= activation
?dons_polyvalence=polyvalence
?dons_categorie=  categorie_officielle
?dons_cout=       coût maximal en emplacements (entier 1..5)
?dons_statut=     eligible | manual_check | ineligible
?dons_q=          recherche plein texte
```

`dons_polyvalence` vaut `conditionnel` pour **61 %** des dons : c'est une facette
faible, mesurée comme telle. La publier quand même — la masquer serait une
décision d'UI, prise en 13 — mais ne pas la mettre en avant.

`COUTS_MAX = 5` est la constante du dépôt d'origine.

### Le comportement de comptage que les facettes doivent permettre

**OU dans une facette, ET entre facettes.** Chaque option est comptée sous toutes
les *autres* facettes (`passe(n, saufFacette, …)`), de sorte que **le compteur
d'une option prédit exactement le résultat du clic**, et les options à zéro
disparaissent. C'est l'invariant que `web/test_explorateur.js` garde dans le dépôt
d'origine, et le bug qu'il a attrapé : oublier `liste: true` sur un champ
multivalué (`categorie_officielle`) faisait annoncer 249 dons pour un filtre qui
n'en gardait aucun. **Déclarer explicitement quelles facettes sont multivaluées.**

## Pseudo-code

```
# web/lib/navigation/etat-url.ts  (étendu, pas réécrit)
CLES = { ...existant,
         donsEffet: 'dons_effet', donsEffet2: 'dons_effet2',
         donsCible: 'dons_cible', donsContexte: 'dons_contexte',
         donsActivation: 'dons_activation',
         donsPolyvalence: 'dons_polyvalence',
         donsCategorie: 'dons_categorie',
         donsCout: 'dons_cout', donsStatut: 'dons_statut', donsQ: 'dons_q' }

interface EtatUrl { ...existant; dons?: EtatUrlDons }
ETAT_VIDE.dons = { ...toutes les listes vides, cout: null, statut: [], q: '' }

lireEtatDons(searchParams) -> EtatUrlDons     # réutilise analyserTags
ecrireEtatDons(etat) -> URLSearchParams       # omet les clés vides

# web/lib/recherche/filtres.ts
interface FiltresDons {
    effets, effetsExclus, effetsObliges,       # le trio par facette à 3 états
    ... idem pour chaque facette multivaluée
    coutMax: number | null,
    statuts: Statut[],
    q: string
}
FILTRES_DONS_VIDES
MULTIVALUEES = { effetsSecondaires, cibles, contextes, categories }  # explicite

filtrerDons(entrees, filtres) -> entrees retenues
compterOptions(entrees, filtres, saufFacette) -> Map<option, nombre>
    # applique TOUTES les facettes sauf `saufFacette`
    # => le compteur prédit exactement le résultat du clic
```

## Logic Flow

1. Lire `etat-url.ts` et `filtres.ts` **en entier**, plus
   `components/navigation/navigation.test.tsx` (522 lignes) pour la forme des
   tests attendue.
2. Étendre `CLES` et `EtatUrl` en **ajout seul** ; ne renommer aucune clé
   existante.
3. Écrire `FiltresDons`, `filtrerDons`, `compterOptions`.
4. Écrire les tests, **en commençant par l'invariant du compteur**.

## Implementation Notes

- **Ajout seul.** Une clé de sort renommée casse chaque lien partagé. Les tests
  existants sur les URLs de sorts doivent passer **sans modification** ; s'il faut
  en toucher un, c'est le signe d'une régression, pas d'un test obsolète.
- **Espaces de noms séparés** : le préfixe `dons_` est ce qui rend `bonus_chiffre`
  inoffensif dans les deux corpus. Ne pas « factoriser » les deux jeux de clés en
  un seul.
- `dons_cout` est un **entier**, pas une liste : c'est un maximum ordinal (« ce que
  je peux payer »), pas une sélection. Un `1..5` hors bornes est ignoré, pas une
  erreur — une URL bricolée ne doit pas produire d'écran blanc.
- `dons_statut` porte les **trois** valeurs du tri-état. Ne jamais rendre
  `manual_check` non sélectionnable : un `manual_check` filtré par défaut cacherait
  au joueur exactement les dons que le moteur n'a pas su trancher — la
  sous-attribution que le dépôt combat.
- **Aucun `useState` miroir de l'URL.** Les tests doivent l'assert.
- Les libellés français viennent de `pf-dons-taxonomie` (repris verbatim de la
  table `LIBELLES` de `web/explorateur_dons.js`, lignes ~45-120). Ne pas les
  retraduire : deux traductions divergentes d'un même code sont un bug d'affichage
  invisible en test.
- TypeScript strict, **aucun `any`**. Ne créer **aucun** fichier `__init__` et
  n'ajouter **aucun** `__all__`.

## Verification Criteria

1. **L'invariant du compteur**, testé sur `web/fixtures/index_dons.json` : pour
   **chaque** option de **chaque** facette, `compterOptions(...).get(option)` égale
   exactement `filtrerDons(...)` après ajout de cette option. Un test balaye toutes
   les options. C'est le bug d'origine ; aucune relecture de code ne l'attrape.
2. Aucune option à zéro n'est proposée : les compteurs nuls sont absents de la Map.
3. Les **quatre** facettes multivaluées sont déclarées dans `MULTIVALUEES`, et un
   test vérifie qu'une facette multivaluée non déclarée **échoue** — c'est
   l'oubli de `liste: true` qui annonçait 249 dons pour zéro résultat.
4. Le cycle à trois états : `dons_effet=defense`, `dons_effet=-defense`,
   `dons_effet=!defense` produisent trois `FiltresDons` distincts, et un
   aller-retour `lireEtatDons(ecrireEtatDons(e))` est **l'identité** pour 10 états
   engendrés à la main.
5. `!` est bien le préfixe ET : un test assert que `+defense` **ne** vaut **pas**
   ET (il décoderait en espace).
6. Une URL de sort existante, complète, produit un `EtatUrl` **identique** à
   celui d'avant l'étape : test de non-régression sur au moins 5 URLs réelles.
7. `ETAT_VIDE` et `FILTRES_DONS_VIDES` n'omettent **aucune** clé (scalaire absent →
   `null`, liste absente → `[]`) — un test compare les jeux de clés.
8. `dons_cout=0`, `dons_cout=9`, `dons_cout=abc` sont **ignorés** sans exception.
9. `dons_statut=manual_check` est sélectionnable et retient bien ces dons.
10. `npm --prefix web run typecheck`, `lint`, et `npm run web:test` verts, **662
    tests existants toujours passants**, aucun modifié.

## Git Handling

Branche `fusion/10-lib-facets-url` depuis `feat/fusion-dons`. Trois commits :

```
feat(web): clés d'URL des facettes de dons, préfixées pour isoler les corpus
feat(web): filtres de dons et comptage prédictif des options
test(web): l'invariant « le compteur prédit le résultat du clic »
```

Le corps du premier commit doit dire pourquoi le préfixe `dons_` existe
(`bonus_chiffre` est le seul terme commun aux deux vocabulaires) et pourquoi le
préfixe ET est `!` et non `+`.

## Expected Outcome

L'état de navigation des dons est partageable par lien, sans état dupliqué, et le
comptage des facettes est **prouvé** honnête. L'étape 13 n'a plus qu'à rendre.
