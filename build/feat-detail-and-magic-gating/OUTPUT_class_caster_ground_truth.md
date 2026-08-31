# Vérité terrain : accès à la magie par classe (Pathfinder 1re édition)

Ce document tranche, classe par classe, l'accès à la magie tel que défini
par les règles Pathfinder 1re édition de base (Core Rulebook, Advanced
Player's Guide, Advanced Class Guide, Occult Adventures, Ultimate Magic /
Ultimate Combat), sans se fier à une heuristique par mots-clés. Il couvre
les 43 clés réellement présentes dans `pf1_dons/class_progression.py::CLASS_BBA_PROGRESSION`
au moment de cette recherche (la note de planification du step en indiquait
42 ; le fichier réel en contient 43 — voir la note "cavalier"/"clerc" en fin
de tableau, ils sont des alias mais possèdent chacun leur propre ligne dans
`CLASS_BBA_PROGRESSION`, ce qui porte le total réel à 43).

Aucun type autre que `arcane`/`divine`/`psychique`/`null` n'est utilisé
dans ce document.

## Table de vérité terrain

| classe | is_caster | type | lanceur | justification |
|---|---|---|---|---|
| alchimiste | true | arcane | partiel | Les formules (extraits) sont préparées depuis un carnet de formules et fonctionnent comme des sorts arcaniques à but personnel ; niveau de lanceur = niveau de classe dès le niveau 1, mais liste et emplacements limités (maximum 6e niveau) — traité comme lanceur pour ce gating (extraits = magie arcanique). |
| antipaladin | true | divine | partiel | Miroir du paladin : sorts divins à partir du niveau 4, NL = niveau de classe/2, maximum 4e niveau de sort — lanceur divin partiel classique. |
| arcaniste | true | arcane | complet | Prépare et lance des sorts arcaniques comme un magicien mais avec la flexibilité du carnet de sorts ; NL = niveau de classe dès le niveau 1, liste complète jusqu'au 9e niveau. |
| barbare | false | null | aucun | Aucune liste de sorts ni emplacement de sorts dans la classe de base ; pouvoirs de rage et capacités surnaturelles/extraordinaires uniquement, pas de magie lancée. |
| barde | true | arcane | complet | Lanceur spontané arcanique dès le niveau 1, NL = niveau de classe, liste de sorts propre (maximum 6e niveau) ; capacités de représentation bardique s'ajoutent mais ne remplacent pas la magie. |
| bretteur | false | null | aucun | Le bretteur (Swashbuckler, Advanced Class Guide) repose sur le panache et les exploits (deeds) ; aucune liste de sorts ni emplacement de sorts dans la classe de base. |
| cavalier | false | null | aucun | Alias de « chevalier » (Cavalier) : tacticien, défi et capacités d'ordre, aucune magie dans la classe de base. |
| chaman | true | divine | complet | Lanceur spontané divin dès le niveau 1 (magie spirituelle + sorts de chaman), NL = niveau de classe, liste complète jusqu'au 9e niveau. |
| chasseur | true | divine | complet | Le chasseur (Hunter, Advanced Class Guide) échange les dons de combat du rôdeur contre une pleine progression de sorts divins/naturels dès le niveau 1, NL = niveau de classe (contrairement au rôdeur, qui est un lanceur partiel). |
| chasseur de vampire | false | null | aucun | Classe martiale spécialisée dans la chasse aux créatures surnaturelles ; aucune liste de sorts ni emplacement de sorts dans sa progression de base. |
| chevalier | false | null | aucun | Cavalier : tacticien, défi (challenge) et capacités d'ordre monté ; aucune magie dans la classe de base. |
| cinetiste | false | null | aucun | Le cinétiste (Kineticist, Occult Adventures) n'a ni liste de sorts ni emplacements de sorts : ses talents élémentaires sont des capacités surnaturelles/de guerrier alimentées par le burn (points de brûlure), explicitement traitées comme non magiques au sens « lanceur de sorts » par les règles/errata officiels. |
| clerc | true | divine | complet | Alias de « prêtre » : lanceur préparé divin dès le niveau 1, NL = niveau de classe, liste complète jusqu'au 9e niveau, domaines. |
| conjurateur | true | arcane | complet | Le conjurateur (Summoner) lance des sorts arcaniques spontanément dès le niveau 1, NL = niveau de classe ; liste de sorts propre plus restreinte (maximum 6e niveau) mais progression pleine sans palier retardé. |
| druide | true | divine | complet | Lanceur préparé divin dès le niveau 1, NL = niveau de classe, liste complète jusqu'au 9e niveau, en plus du compagnon animal/forme sauvage. |
| enqueteur | true | arcane | partiel | L'enquêteur (Investigator, Advanced Class Guide) prépare des extraits comme l'alchimiste (magie arcanique personnelle) ; NL = niveau de classe dès le niveau 1 mais liste/emplacements limités (maximum 6e niveau). |
| ensorceleur | true | arcane | complet | Lanceur spontané arcanique dès le niveau 1, NL = niveau de classe, liste complète jusqu'au 9e niveau, capacités de lignage en complément. |
| guerrier | false | null | aucun | Aucune liste de sorts ni emplacement de sorts ; dons de combat bonus uniquement. |
| hypnotiseur | true | psychique | complet | L'hypnotiseur (Mesmerist, Occult Adventures) lance des sorts psychiques spontanément dès le niveau 1 via le regard hypnotique et les tours mentaux, NL = niveau de classe, liste occulte jusqu'au 6e niveau. |
| inquisiteur | true | divine | complet | Lanceur spontané divin dès le niveau 1 (liste d'inquisiteur), NL = niveau de classe, jugements et capacités martiales en complément mais magie pleine dès le départ. |
| justicier | false | null | aucun | Le justicier (Vigilante, Ultimate Intrigue) repose sur les talents de vigilant et l'identité sociale/vigilante ; la classe de base n'a pas de magie (seul un talent de vigilant spécifique à l'archétype « zélote » donne des sorts divins limités — voir Cas limites). |
| lutteur | false | null | aucun | Le lutteur (Brawler, Advanced Class Guide) est purement martial (martial flexibility, coups de lutte) ; aucune magie dans la classe de base. |
| magicien | true | arcane | complet | Lanceur préparé arcanique dès le niveau 1, NL = niveau de classe, liste complète jusqu'au 9e niveau, spécialisation d'école. |
| magus | true | arcane | complet | Le magus lance des sorts arcaniques préparés dès le niveau 1, NL = niveau de classe, liste propre jusqu'au 6e niveau, combiné au combat en armure d'arcane. |
| medium | true | psychique | complet | Le médium (Medium, Occult Adventures) lance des sorts psychiques spontanément dès le niveau 1 via la communion avec les esprits archétypaux, NL = niveau de classe, liste occulte jusqu'au 6e niveau. |
| metamorphe | false | null | aucun | Le métamorphe (Skinwalker) repose sur des aspects raciaux/de lignage bestial activés en capacités surnaturelles, pas sur une liste de sorts ; aucune magie dans la classe de base. |
| moine | false | null | aucun | Aucune liste de sorts ni emplacement de sorts ; capacités de ki (extraordinaires/surnaturelles) uniquement, pas de magie lancée. |
| ninja | false | null | aucun | Le ninja (Ultimate Combat) n'a pas de liste de sorts propre ; ses « trucs de ninja » (ninja tricks) sont majoritairement des capacités extraordinaires/surnaturelles et un petit nombre imite des effets de sorts au cas par cas (pas une progression de sorts), donc pas de statut de lanceur au sens de ce gating. |
| occultiste | true | psychique | complet | L'occultiste (Occultist, Occult Adventures) lance des sorts psychiques préparés dès le niveau 1 via la résonance d'objets implantés, NL = niveau de classe, liste occulte jusqu'au 6e niveau. |
| oracle | true | divine | complet | Lanceur spontané divin dès le niveau 1 (mystère + révélations), NL = niveau de classe, liste complète jusqu'au 9e niveau, sans préparation quotidienne (malédiction en contrepartie). |
| paladin | true | divine | partiel | Sorts divins à partir du niveau 4 seulement, NL = niveau de classe/2, maximum 4e niveau de sort — lanceur divin partiel classique (comme le rôdeur). |
| pistolier | false | null | aucun | Le pistolier (Gunslinger, Ultimate Combat) repose sur le point de grâce (grit) et les exploits d'armes à poudre ; aucune magie dans la classe de base. |
| pretre | true | divine | complet | Lanceur préparé divin dès le niveau 1, NL = niveau de classe, liste complète jusqu'au 9e niveau, domaines et canalisation d'énergie. |
| pretre combattant | true | divine | complet | Le prêtre combattant (Warpriest, Ultimate Combat) lance des sorts divins dès le niveau 1, NL = niveau de classe (comme l'inquisiteur/le chasseur, pas comme le paladin), liste jusqu'au 6e niveau, combinée à la ferveur et au combat en armure sacrée. |
| psychiste | true | psychique | complet | Lanceur spontané psychique dès le niveau 1 (discipline psychique), NL = niveau de classe, liste occulte complète jusqu'au 9e niveau (seule classe occulte à atteindre le 9e niveau de sort en base). |
| rodeur | true | divine | partiel | Sorts divins/naturels à partir du niveau 4 seulement, NL = niveau de classe/2, maximum 4e niveau de sort — lanceur divin partiel classique (contrairement au chasseur, sa variante en lanceur complet). |
| roublard | false | null | aucun | Aucune liste de sorts ni emplacement de sorts dans la classe de base ; talents de roublard (rogue talents) très variés mais pas de progression de magie native. |
| samourai | false | null | aucun | Le samouraï (Ultimate Combat) repose sur la résolution (resolve) et les capacités d'ordre ; aucune magie dans la classe de base. |
| sanguin | true | arcane | partiel | Le sanguin (Bloodrager, Advanced Class Guide) est un lanceur arcanique à mi-progression : sorts de lignage à partir du niveau 4, NL = niveau de classe/2, maximum 4e niveau de sort — même gabarit que le paladin/rôdeur mais en magie de sang arcanique lancée en rage. |
| scalde | true | arcane | complet | **Corrigé** (verdict initial `false` erroné). Le scalde (Skald, Advanced Class Guide) est bien un lanceur spontané arcanique : il lance des sorts puisés dans la liste du barde, avec sorts connus et sorts par jour, NL = niveau de classe, maximum 6e niveau — même gabarit que le barde. Le chant de rage s'ajoute à la magie, il ne la remplace pas. Preuve indépendante dans les données du dépôt : sa table de progression scrapée (`Data/class_features.json`) lui donne « tours de magie » et « écriture de parchemins » au niveau 1, exactement comme au barde. |
| sorciere | true | arcane | complet | La sorcière (Witch, Advanced Player's Guide) prépare des sorts arcaniques dès le niveau 1 via son familier-patron, NL = niveau de classe, liste complète jusqu'au 9e niveau, hexes en complément. |
| spirite | true | psychique | complet | Le spirite (Spiritualist, Occult Adventures) lance des sorts psychiques préparés dès le niveau 1 via son phantom lié, NL = niveau de classe, liste occulte jusqu'au 6e niveau. |
| tueur | false | null | aucun | Le tueur (Slayer, Advanced Class Guide) repose sur la cible étudiée (studied target) et l'attaque sournoise ; aucune magie dans la classe de base. |

## Cas limites notés

- **alchimiste** et **enquêteur** : les extraits ne sont techniquement pas
  des « sorts » au sens strict des règles (pas affectés par la
  résistance à la magie de la même façon, pas de composante verbale/
  gestuelle formelle), mais fonctionnent comme des sorts arcaniques
  personnels avec NL et carnet de formules — ce document les tranche
  explicitement `is_caster=true`, `type=arcane`, en cohérence avec la
  demande explicite du step de considérer les extraits comme un accès à
  la magie pour ce gating.
- **cinétiste** : tranché explicitement `is_caster=false`. Bien que le
  cinétiste ait un niveau de lanceur (« niveau de kinétiste ») utilisé
  pour certains calculs, il n'a ni liste de sorts, ni emplacements de
  sorts, ni sorts connus/préparés — ses talents élémentaires sont des
  capacités surnaturelles (Sp/Su selon le talent) alimentées par le burn.
  Un archétype ou un talent isolé (« Substance manipulatrice » etc.) ne
  change pas ce verdict de base.
- **justicier (Vigilante)** : la classe de base n'a pas de magie, mais
  l'archétype « zélote » (Zealot) remplace la progression de talents de
  vigilant par des sorts divins complets d'un domaine — verdict de base
  reste `is_caster=false` ; à noter séparément si des dons du catalogue
  supposent explicitement cet archétype.
- **métamorphe (Skinwalker)** : aucune magie en base ; certains aspects
  bestiaux avancés donnent des capacités surnaturelles ponctuelles
  (pas une progression de sorts), ce qui ne change pas le verdict.
- **ninja** : quelques « trucs de ninja » de haut niveau imitent des
  effets de sorts ponctuels (ex. capacités de type illusion), mais il
  n'existe aucune liste de sorts ni progression d'emplacements — verdict
  `is_caster=false` maintenu fermement, comme demandé explicitement par
  l'utilisateur.
- **chasseur (Hunter) vs rôdeur (Ranger)** : à noter que ces deux classes
  partagent un thème (nature, compagnon animal) mais diffèrent nettement
  sur l'accès à la magie — le chasseur est un lanceur complet, le rôdeur
  un lanceur partiel classique. Ne pas confondre les deux lors de la
  curation en Step 07.
- **prêtre combattant (Warpriest) vs paladin/antipaladin** : à noter que
  malgré une thématique divine martiale commune, le prêtre combattant a
  NL = niveau de classe dès le niveau 1 (lanceur complet), alors que
  paladin/antipaladin/sanguin/rôdeur sont des lanceurs partiels
  (NL = niveau de classe/2, sorts à partir du niveau 4). Ne pas les
  regrouper sous un même gabarit de "demi-lanceur divin/arcane".
- **cavalier / clerc (alias)** : ces deux clés sont des alias directs de
  « chevalier » et « prêtre » respectivement dans `CLASS_BBA_PROGRESSION`
  et portent donc le même verdict que la classe qu'elles dupliquent.
