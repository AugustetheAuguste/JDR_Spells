# Étape 04 — couverture de la table d'alias anglais → français

Généré le 2026-07-31T17:39:36+00:00 par `python -m pf_spells.build_alias`.

## Couverture

| Mesure | Valeur |
|---|---|
| Sorts du corpus | 2070 |
| Sorts avec au moins un alias | 218 |
| Taux | 10.5 % |
| Clés d'alias distinctes | 225 |
| Clés visant plusieurs sorts | 4 |
| Cible v1 : sorts de niveau ≤ 4 | 162 / 1543 (10.5 %) |

« Niveau » est ici le **niveau minimum toutes classes confondues** : un
sort est de niveau 2 *pour le barde*, et « le » niveau d'un sort n'existe
pas (B4). Ce minimum ne sert qu'à trier la liste de travail.

## Alias refusés

Aucun : aucune clé ne masque un nom français.

## Sorts sans alias — la liste de travail

1852 sorts, triés par niveau minimum croissant : les sorts de
bas niveau sont les plus cherchés, donc les premiers à couvrir. Ajouter une
ligne à `web/data_sources/alias_manuel.tsv` et relancer suffit.

**À la main, jamais par un modèle de langue.** Un alias faux envoie
l'utilisateur sur le mauvais sort avec confiance ; un alias manquant le
laisse simplement chercher en français, ce qui marche.

| Niveau min. | Sort | id |
|---|---|---|
| 0 | Allié involontaire | `allie-involontaire` |
| 0 | Aspect de fée hantée | `aspect-de-fee-hantee` |
| 0 | Assistance divine | `assistance-divine` |
| 0 | Berceuse | `berceuse` |
| 0 | Brise | `brise` |
| 0 | Choc | `choc` |
| 0 | Convocation d'instrument | `convocation-d-instrument` |
| 0 | Destruction de mort-vivant | `destruction-de-mort-vivant` |
| 0 | Diplomatie améliorée | `diplomatie-amelioree` |
| 0 | Détection d'importance psychique | `detection-d-importance-psychique` |
| 0 | Détremper | `detremper` |
| 0 | Fatigue | `fatigue` |
| 0 | Hébétement | `hebetement` |
| 0 | Illumination | `illumination` |
| 0 | Inspection | `inspection` |
| 0 | Manipulation à distance | `manipulation-a-distance` |
| 0 | Message | `message` |
| 0 | Paroles de la tombe | `paroles-de-la-tombe` |
| 0 | Prestidigitation | `prestidigitation` |
| 0 | Projectile télékinétique | `projectile-telekinetique` |
| 0 | Psalmodie du scribe | `psalmodie-du-scribe` |
| 0 | Putréfaction de l'eau et de la nourriture | `putrefaction-de-l-eau-et-de-la-nourriture` |
| 0 | Pénombre | `penombre` |
| 0 | Racine | `racine` |
| 0 | Rayon de givre | `rayon-de-givre` |
| 0 | Repérage | `reperage` |
| 0 | Résistance | `resistance` |
| 0 | Saignement | `saignement` |
| 0 | Scoop | `scoop` |
| 0 | Signature magique | `signature-magique` |
| 0 | Signe de l'aube | `signe-de-l-aube` |
| 0 | Étincelles | `etincelles` |
| 1 | Abondance de munitions | `abondance-de-munitions` |
| 1 | Action interdite | `action-interdite` |
| 1 | Adaptation culturelle | `adaptation-culturelle` |
| 1 | Adoration | `adoration` |
| 1 | Aiguillon persuasif | `aiguillon-persuasif` |
| 1 | Ailes puissantes | `ailes-puissantes` |
| 1 | Alarme d'invisibilité | `alarme-d-invisibilite` |
| 1 | Alignement indétectable | `alignement-indetectable` |
| 1 | Allègement d'objet | `allegement-d-objet` |
| 1 | Altération d'instrument de musique | `alteration-d-instrument-de-musique` |
| 1 | Altération vocale | `alteration-vocale` |
| 1 | Anathème | `anatheme` |
| 1 | Anticipation du danger | `anticipation-du-danger` |
| 1 | Apaisement des animaux | `apaisement-des-animaux` |
| 1 | Apaisement des esprits | `apaisement-des-esprits` |
| 1 | Aphasie | `aphasie` |
| 1 | Appel d'arme | `appel-d-arme` |
| 1 | Appel d'un animal | `appel-d-un-animal` |
| 1 | Appel des esprits | `appel-des-esprits` |
| 1 | Appel du chevalier | `appel-du-chevalier` |
| 1 | Arc de gravité | `arc-de-gravite` |
| 1 | Arc-bâton | `arc-baton` |
| 1 | Arme boomerang | `arme-boomerang` |
| 1 | Arme d'ombre | `arme-d-ombre` |
| 1 | Arme déguisée | `arme-deguisee` |
| 1 | Arme désespérée | `arme-desesperee` |
| 1 | Arme improvisée raffinée | `arme-improvisee-raffinee` |
| 1 | Arme infaillible | `arme-infaillible` |
| 1 | Arme magique | `arme-magique` |
| 1 | Arme protectrice | `arme-protectrice` |
| 1 | Armes contre le mal | `armes-contre-le-mal` |
| 1 | Armure de glace | `armure-de-glace` |
| 1 | Armure gardienne | `armure-gardienne` |
| 1 | Armure épineuse | `armure-epineuse` |
| 1 | Ascèse | `ascese` |
| 1 | Aspect du faucon | `aspect-du-faucon` |
| 1 | Aspect du rossignol | `aspect-du-rossignol` |
| 1 | Aura magique | `aura-magique` |
| 1 | Avancée assurée | `avancee-assuree` |
| 1 | Bafouiller | `bafouiller` |
| 1 | Baguettarme | `baguettarme` |
| 1 | Baie nourricière | `baie-nourriciere` |
| 1 | Barbe de fer | `barbe-de-fer` |
| 1 | Barrière étourdissante | `barriere-etourdissante` |
| 1 | Blessure légère | `blessure-legere` |
| 1 | Blocage mental | `blocage-mental` |
| 1 | Bouche magique | `bouche-magique` |
| 1 | Bouclier d'onde | `bouclier-d-onde` |
| 1 | Bouclier d'éclats | `bouclier-d-eclats` |
| 1 | Bouclier de défense | `bouclier-de-defense` |
| 1 | Bouclier de foudre | `bouclier-de-foudre` |
| 1 | Bouclier de pierre | `bouclier-de-pierre` |
| 1 | Bouclier entropique | `bouclier-entropique` |
| 1 | Bouffée d'intuition | `bouffee-d-intuition` |
| 1 | Boule de boue | `boule-de-boue` |
| 1 | Boulette | `boulette` |
| 1 | Bras long | `bras-long` |
| 1 | Bricolage alchimique | `bricolage-alchimique` |
| 1 | Brillance miroir | `brillance-miroir` |
| 1 | Brise-destructeur | `brise-destructeur` |
| 1 | Briser les liens | `briser-les-liens` |
| 1 | Briser les lignes ennemies | `briser-les-lignes-ennemies` |
| 1 | Broussaille distrayante | `broussaille-distrayante` |
| 1 | Brume de dissimulation | `brume-de-dissimulation` |
| 1 | Brume de rêves | `brume-de-reves` |
| 1 | Bulle d'air | `bulle-d-air` |
| 1 | Bénédiction d'arme | `benediction-d-arme` |
| 1 | Bénédiction de l'eau | `benediction-de-l-eau` |
| 1 | Bénédiction du guet | `benediction-du-guet` |
| 1 | Bénédiction karmique | `benediction-karmique` |
| 1 | Calme illusoire | `calme-illusoire` |
| 1 | Caméléon | `cameleon` |
| 1 | Capacitance corporelle | `capacitance-corporelle` |
| 1 | Caresse de la mer | `caresse-de-la-mer` |
| 1 | Cassé | `casse` |
| 1 | Chance de l'artisan | `chance-de-l-artisan` |
| 1 | Changement de fonction | `changement-de-fonction` |
| 1 | Chant du labeur | `chant-du-labeur` |
| 1 | Charge de fourmi | `charge-de-fourmi` |
| 1 | Charger un objet | `charger-un-objet` |
| 1 | Charmant cadeau | `charmant-cadeau` |
| 1 | Choisis ton poison | `choisis-ton-poison` |
| 1 | Cierge de mort | `cierge-de-mort` |
| 1 | Climat de confiance | `climat-de-confiance` |
| 1 | Colère | `colere` |
| 1 | Combattant pris au dépourvu | `combattant-pris-au-depourvu` |
| 1 | Communication sécurisée | `communication-securisee` |
| 1 | Communion avec les oiseaux | `communion-avec-les-oiseaux` |
| 1 | Confirmation d'identité | `confirmation-d-identite` |
| 1 | Connaissances du Borgne | `connaissances-du-borgne` |
| 1 | Connaître son ennemi | `connaitre-son-ennemi` |
| 1 | Conscience accrue | `conscience-accrue` |
| 1 | Contact corrosif | `contact-corrosif` |
| 1 | Convocation d'alliés mineur | `convocation-d-allies-mineur` |
| 1 | Convocation de monstre mineur | `convocation-de-monstre-mineur` |
| 1 | Cor de poursuite | `cor-de-poursuite` |
| 1 | Corbeau meurtrier | `corbeau-meurtrier` |
| 1 | Corde animée | `corde-animee` |
| 1 | Corde d'échardes | `corde-d-echardes` |
| 1 | Corps caoutchouteux | `corps-caoutchouteux` |
| 1 | Couleurs dansantes | `couleurs-dansantes` |
| 1 | Coup au but | `coup-au-but` |
| 1 | Coup mental I | `coup-mental-i` |
| 1 | Crachat adhésif | `crachat-adhesif` |
| 1 | Cri perçant | `cri-percant` |
| 1 | Crime de situation | `crime-de-situation` |
| 1 | Crâne de sentinelle | `crane-de-sentinelle` |
| 1 | Cécité nocturne | `cecite-nocturne` |
| 1 | Cœur incassable | `coeur-incassable` |
| 1 | Dague de stalactite | `dague-de-stalactite` |
| 1 | Dard de nausée | `dard-de-nausee` |
| 1 | Diagnostic | `diagnostic` |
| 1 | Disparition | `disparition` |
| 1 | Disque flottant | `disque-flottant` |
| 1 | Dissimulation d'objet | `dissimulation-d-objet` |
| 1 | Dissimuler la magie | `dissimuler-la-magie` |
| 1 | Dissipation de la fièvre | `dissipation-de-la-fievre` |
| 1 | Dragon d'artifice | `dragon-d-artifice` |
| 1 | Décomposition de cadavre | `decomposition-de-cadavre` |
| 1 | Défi du héros | `defi-du-heros` |
| 1 | Défier le mal | `defier-le-mal` |
| 1 | Défoliant | `defoliant` |
| 1 | Déguisement décrépi | `deguisement-decrepi` |
| 1 | Déjà vu | `deja-vu` |
| 1 | Démarche aérienne | `demarche-aerienne` |
| 1 | Désarmement brûlant | `desarmement-brulant` |
| 1 | Désir anormal | `desir-anormal` |
| 1 | Détection de la Loi | `detection-de-la-loi` |
| 1 | Détection de la faune ou de la flore | `detection-de-la-faune-ou-de-la-flore` |
| 1 | Détection des aberrations | `detection-des-aberrations` |
| 1 | Détection des charmes | `detection-des-charmes` |
| 1 | Détection des collets et des fosses | `detection-des-collets-et-des-fosses` |
| 1 | Détection des fidèles | `detection-des-fideles` |
| 1 | Détection du Chaos | `detection-du-chaos` |
| 1 | Détermination inébranlable | `determination-inebranlable` |
| 1 | Eau améliorée | `eau-amelioree` |
| 1 | Effacement | `effacement` |
| 1 | Emprunt de compétence | `emprunt-de-competence` |
| 1 | Enchevêtrement | `enchevetrement` |
| 1 | Endurance aux énergies destructives | `endurance-aux-energies-destructives` |
| 1 | Excavation expéditive | `excavation-expeditive` |
| 1 | Exploiter la beauté intérieure | `exploiter-la-beaute-interieure` |
| 1 | Fabrication de balles | `fabrication-de-balles` |
| 1 | Fabrication de déguisement | `fabrication-de-deguisement` |
| 1 | Faveur conditionnelle | `faveur-conditionnelle` |
| 1 | Façonnage de cadavre | `faconnage-de-cadavre` |
| 1 | Façonnage de la neige | `faconnage-de-la-neige` |
| 1 | Festin onirique | `festin-onirique` |
| 1 | Feuille morte | `feuille-morte` |
| 1 | Fierté illusoire | `fierte-illusoire` |
| 1 | Final salvateur | `final-salvateur` |
| 1 | Flambée de sang | `flambee-de-sang` |
| 1 | Flèche de ki | `fleche-de-ki` |
| 1 | Flèche du Borgne | `fleche-du-borgne` |
| 1 | Fou rire | `fou-rire` |
| 1 | Fouette-lame | `fouette-lame` |
| 1 | Frappe miroir | `frappe-miroir` |
| 1 | Fuite aérienne | `fuite-aerienne` |
| 1 | Gloire dépréciée | `gloire-depreciee` |
| 1 | Gloire partagée | `gloire-partagee` |
| 1 | Gourdin magique | `gourdin-magique` |
| 1 | Graisse | `graisse` |
| 1 | Grand pas | `grand-pas` |
| 1 | Grandes illuminations | `grandes-illuminations` |
| 1 | Grappin opportun | `grappin-opportun` |
| 1 | Grâce | `grace` |
| 1 | Grâce des néréides | `grace-des-nereides` |
| 1 | Grâce urbaine | `grace-urbaine` |
| 1 | Gueule acide | `gueule-acide` |
| 1 | Guérison des morts-vivants | `guerison-des-morts-vivants` |
| 1 | Guérison diabolique | `guerison-diabolique` |
| 1 | Hallucination auditive | `hallucination-auditive` |
| 1 | Halo indésirable | `halo-indesirable` |
| 1 | Horreur onirique | `horreur-onirique` |
| 1 | Hostilité forcée | `hostilite-forcee` |
| 1 | Hurlement du chasseur | `hurlement-du-chasseur` |
| 1 | Hypnose | `hypnose` |
| 1 | Hébétement de monstre | `hebetement-de-monstre` |
| 1 | Implantation de pensées | `implantation-de-pensees` |
| 1 | Imprécation | `imprecation` |
| 1 | Incantation assurée | `incantation-assuree` |
| 1 | Infatigable poursuivant | `infatigable-poursuivant` |
| 1 | Injonction | `injonction` |
| 1 | Innocence | `innocence` |
| 1 | Inspiration opportune | `inspiration-opportune` |
| 1 | Instant de gloire | `instant-de-gloire` |
| 1 | Interrogatoire | `interrogatoire` |
| 1 | Javeline épineuse | `javeline-epineuse` |
| 1 | Jeunesse apparente | `jeunesse-apparente` |
| 1 | Jitterbug | `jitterbug` |
| 1 | Jouer d'un instrument | `jouer-d-un-instrument` |
| 1 | Jugement par anticipation | `jugement-par-anticipation` |
| 1 | Lame éblouissante | `lame-eblouissante` |
| 1 | Lames de plomb | `lames-de-plomb` |
| 1 | Langue de miel | `langue-de-miel` |
| 1 | Lanterne dansante | `lanterne-dansante` |
| 1 | Lecture d'objet | `lecture-d-objet` |
| 1 | Lecture de la météo | `lecture-de-la-meteo` |
| 1 | Lecture psychique | `lecture-psychique` |
| 1 | Lecture rapide | `lecture-rapide` |
| 1 | Libération | `liberation` |
| 1 | Lien de vie | `lien-de-vie` |
| 1 | Lien mental | `lien-mental` |
| 1 | Limite infranchissable | `limite-infranchissable` |
| 1 | Litanie de faiblesse | `litanie-de-faiblesse` |
| 1 | Litanie de paresse | `litanie-de-paresse` |
| 1 | Maladresse | `maladresse` |
| 1 | Malchance de l'artisan | `malchance-de-l-artisan` |
| 1 | Malédiction de l'eau | `malediction-de-l-eau` |
| 1 | Malédiction des ondins | `malediction-des-ondins` |
| 1 | Manteau d'ombre | `manteau-d-ombre` |
| 1 | Marque de chasse | `marque-de-chasse` |
| 1 | Mauvais présage | `mauvais-presage` |
| 1 | Maîtrise des marids | `maitrise-des-marids` |
| 1 | Menteur compulsif | `menteur-compulsif` |
| 1 | Mixture pour bombe ciblée | `mixture-pour-bombe-ciblee` |
| 1 | Modification des vents | `modification-des-vents` |
| 1 | Mondanité | `mondanite` |
| 1 | Monture | `monture` |
| 1 | Monture de guerre | `monture-de-guerre` |
| 1 | Montée d'adrénaline | `montee-d-adrenaline` |
| 1 | Morsure du froid | `morsure-du-froid` |
| 1 | Morsure magique | `morsure-magique` |
| 1 | Mot de fermeté | `mot-de-fermete` |
| 1 | Mouvement flou | `mouvement-flou` |
| 1 | Mâchoire féroce | `machoire-feroce` |
| 1 | Mémorisation de page | `memorisation-de-page` |
| 1 | Métal solaire | `metal-solaire` |
| 1 | Note tangible | `note-tangible` |
| 1 | Négation de l'arôme | `negation-de-l-arome` |
| 1 | Offrande exigée | `offrande-exigee` |
| 1 | Ordre assassin | `ordre-assassin` |
| 1 | Ordre libérateur | `ordre-liberateur` |
| 1 | Ouvert/fermé | `ouvert-ferme` |
| 1 | Paix forcée | `paix-forcee` |
| 1 | Panacée universelle | `panacee-universelle` |
| 1 | Panse bouillante | `panse-bouillante` |
| 1 | Paranoïa | `paranoia` |
| 1 | Paroles secrètes | `paroles-secretes` |
| 1 | Partage de la langue | `partage-de-la-langue` |
| 1 | Passage sans traces | `passage-sans-traces` |
| 1 | Perception de la magie des esprits | `perception-de-la-magie-des-esprits` |
| 1 | Perception de la mort | `perception-de-la-mort` |
| 1 | Perception des proches | `perception-des-proches` |
| 1 | Perdre la piste | `perdre-la-piste` |
| 1 | Perspicacité tactique | `perspicacite-tactique` |
| 1 | Petite brise | `petite-brise` |
| 1 | Petites fractures | `petites-fractures` |
| 1 | Pierre magique | `pierre-magique` |
| 1 | Pistage des traces | `pistage-des-traces` |
| 1 | Planer | `planer` |
| 1 | Plumage d'hiver | `plumage-d-hiver` |
| 1 | Poing béni | `poing-beni` |
| 1 | Poing de pierre | `poing-de-pierre` |
| 1 | Poing invincible de la terre | `poing-invincible-de-la-terre` |
| 1 | Point de ralliement | `point-de-ralliement` |
| 1 | Poison masqué | `poison-masque` |
| 1 | Poisson-singe | `poisson-singe` |
| 1 | Poudre affaiblie | `poudre-affaiblie` |
| 1 | Poudre mouillée | `poudre-mouillee` |
| 1 | Poussée hydraulique | `poussee-hydraulique` |
| 1 | Projectile de toile | `projectile-de-toile` |
| 1 | Projection télempathique | `projection-telempathique` |
| 1 | Protection contre le vol | `protection-contre-le-vol` |
| 1 | Protection de la bannière | `protection-de-la-banniere` |
| 1 | Quintessence | `quintessence` |
| 1 | Racontar | `racontar` |
| 1 | Ralentissement du poison | `ralentissement-du-poison` |
| 1 | Rayon de fièvre | `rayon-de-fievre` |
| 1 | Rechargement de la magie innée | `rechargement-de-la-magie-innee` |
| 1 | Regain d'assurance | `regain-d-assurance` |
| 1 | Rendre un jugement | `rendre-un-jugement` |
| 1 | Renforcer l'armement | `renforcer-l-armement` |
| 1 | Repli expéditif | `repli-expeditif` |
| 1 | Requiem pour les fantômes | `requiem-pour-les-fantomes` |
| 1 | Restauration de cadavre | `restauration-de-cadavre` |
| 1 | Retardement des maladies | `retardement-des-maladies` |
| 1 | Revigorer | `revigorer` |
| 1 | River le regard | `river-le-regard` |
| 1 | Réaction négative | `reaction-negative` |
| 1 | Régénération d'eidolon mineure | `regeneration-d-eidolon-mineure` |
| 1 | Réparation improvisée | `reparation-improvisee` |
| 1 | Sabot du tonnerre | `sabot-du-tonnerre` |
| 1 | Sages murmures | `sages-murmures` |
| 1 | Sanctification de cadavre | `sanctification-de-cadavre` |
| 1 | Sang fantôme | `sang-fantome` |
| 1 | Sceau contre les maléfices | `sceau-contre-les-malefices` |
| 1 | Sceau de colle | `sceau-de-colle` |
| 1 | Se hérisser | `se-herisser` |
| 1 | Sens surdéveloppés | `sens-surdeveloppes` |
| 1 | Silence forcé | `silence-force` |
| 1 | Sombres murmures | `sombres-murmures` |
| 1 | Sommeil réparateur | `sommeil-reparateur` |
| 1 | Stratégie de repli | `strategie-de-repli` |
| 1 | Tir longue distance | `tir-longue-distance` |
| 1 | Toucher de combustion | `toucher-de-combustion` |
| 1 | Toucher endothermique | `toucher-endothermique` |
| 1 | Toucher hémorragique | `toucher-hemorragique` |
| 1 | Transfert de tatouage | `transfert-de-tatouage` |
| 1 | Trou de mémoire | `trou-de-memoire` |
| 1 | Trébucher dans un trou | `trebucher-dans-un-trou` |
| 1 | Ventriloquie | `ventriloquie` |
| 1 | Verrouillage | `verrouillage` |
| 1 | Vieillesse apparente | `vieillesse-apparente` |
| 1 | Vigueur du pesh | `vigueur-du-pesh` |
| 1 | Visage du dévoreur | `visage-du-devoreur` |
| 1 | Voile d'énergie positive | `voile-d-energie-positive` |
| 1 | Voile du paradis | `voile-du-paradis` |
| 1 | Voir l'alignement | `voir-l-alignement` |
| 1 | Vol de soins | `vol-de-soins` |
| 1 | Vulnérabilité aux maléfices | `vulnerabilite-aux-malefices` |
| 1 | Vérité d'Abadar | `verite-d-abadar` |
| 1 | Écho des pensées | `echo-des-pensees` |
| 1 | Éclats déchirants | `eclats-dechirants` |
| 1 | Équité | `equite` |
| 1 | Œil du mitrailleur | `oeil-du-mitrailleur` |
| 1 | Œil vigilant | `oeil-vigilant` |
| 1 | Œuf empoisonné | `oeuf-empoisonne` |
| 2 | Abri de toile | `abri-de-toile` |
| 2 | Accorder la grâce | `accorder-la-grace` |
| 2 | Accorder une intuition | `accorder-une-intuition` |
| 2 | Accoutrement honteux | `accoutrement-honteux` |
| 2 | Accélération du poison | `acceleration-du-poison` |
| 2 | Affliction imaginaire | `affliction-imaginaire` |
| 2 | Aide | `aide` |
| 2 | Alarme sélective | `alarme-selective` |
| 2 | Allegro | `allegro` |
| 2 | Allié compatissant | `allie-compatissant` |
| 2 | Ami de la forêt | `ami-de-la-foret` |
| 2 | Ami du feu | `ami-du-feu` |
| 2 | Amplificateur sensoriel | `amplificateur-sensoriel` |
| 2 | Amélioration de piège | `amelioration-de-piege` |
| 2 | Analyse d'aura | `analyse-d-aura` |
| 2 | Ancre d'ombre | `ancre-d-ombre` |
| 2 | Animation des morts mineure | `animation-des-morts-mineure` |
| 2 | Anticipation des pensées | `anticipation-des-pensees` |
| 2 | Apparence charnue | `apparence-charnue` |
| 2 | Appel cacophonique | `appel-cacophonique` |
| 2 | Appel des pierres | `appel-des-pierres` |
| 2 | Apprentissage par le sang | `apprentissage-par-le-sang` |
| 2 | Arc brûlant | `arc-brulant` |
| 2 | Arme alignée | `arme-alignee` |
| 2 | Arme boomerang (partagé) | `arme-boomerang-partage` |
| 2 | Arme de cautérisation | `arme-de-cauterisation` |
| 2 | Arme de glace maudite | `arme-de-glace-maudite` |
| 2 | Arme de glace sacrée | `arme-de-glace-sacree` |
| 2 | Arme merveilleuse | `arme-merveilleuse` |
| 2 | Arme polyvalente | `arme-polyvalente` |
| 2 | Arme spirituelle | `arme-spirituelle` |
| 2 | Armure de sang | `armure-de-sang` |
| 2 | Armure instantanée | `armure-instantanee` |
| 2 | Armure sans effort | `armure-sans-effort` |
| 2 | Arrangement de cadavre | `arrangement-de-cadavre` |
| 2 | Aspect animal | `aspect-animal` |
| 2 | Aspect de l'ours | `aspect-de-l-ours` |
| 2 | Assemblage par télékinésie | `assemblage-par-telekinesie` |
| 2 | Assistant de chargement | `assistant-de-chargement` |
| 2 | Aura de bravoure supérieure | `aura-de-bravoure-superieure` |
| 2 | Aura de l'insignifiant | `aura-de-l-insignifiant` |
| 2 | Auras élargies | `auras-elargies` |
| 2 | Avancée offensive | `avancee-offensive` |
| 2 | Avantage du martyr | `avantage-du-martyr` |
| 2 | Baiser de la goule | `baiser-de-la-goule` |
| 2 | Bandes de protection | `bandes-de-protection` |
| 2 | Barrière mentale I | `barriere-mentale-i` |
| 2 | Barrière protectrice | `barriere-protectrice` |
| 2 | Biographie du sang | `biographie-du-sang` |
| 2 | Blessure modérée | `blessure-moderee` |
| 2 | Blessure sympathique | `blessure-sympathique` |
| 2 | Blocage cognitif | `blocage-cognitif` |
| 2 | Blocage émotionnel | `blocage-emotionnel` |
| 2 | Bouche cousue | `bouche-cousue` |
| 2 | Bouclier de balles | `bouclier-de-balles` |
| 2 | Bouclier de rêves | `bouclier-de-reves` |
| 2 | Bouclier des pensées I | `bouclier-des-pensees-i` |
| 2 | Bouclier pare-balles | `bouclier-pare-balles` |
| 2 | Bouclier sacré | `bouclier-sacre` |
| 2 | Boule de goudron | `boule-de-goudron` |
| 2 | Bourrasque | `bourrasque` |
| 2 | Bredouillement | `bredouillement` |
| 2 | Briser le silence | `briser-le-silence` |
| 2 | Bruit pénible | `bruit-penible` |
| 2 | Brume crépusculaire | `brume-crepusculaire` |
| 2 | Brume hantée | `brume-hantee` |
| 2 | Bénédiction de chance et de résolution | `benediction-de-chance-et-de-resolution` |
| 2 | Bénédiction de vie et de courage | `benediction-de-vie-et-de-courage` |
| 2 | Cacher le camp | `cacher-le-camp` |
| 2 | Cachette-miroir | `cachette-miroir` |
| 2 | Cacophonie | `cacophonie` |
| 2 | Cacophonie distrayante | `cacophonie-distrayante` |
| 2 | Cadeau empoisonné | `cadeau-empoisonne` |
| 2 | Canalisation de vie | `canalisation-de-vie` |
| 2 | Caresse élémentaire | `caresse-elementaire` |
| 2 | Carreau de peur | `carreau-de-peur` |
| 2 | Catatonie | `catatonie` |
| 2 | Chant de footing | `chant-de-footing` |
| 2 | Charge de fourmi (partagé) | `charge-de-fourmi-partage` |
| 2 | Chasser les esprits | `chasser-les-esprits` |
| 2 | Chien de chasse | `chien-de-chasse` |
| 2 | Choc mental | `choc-mental` |
| 2 | Chute de température | `chute-de-temperature` |
| 2 | Chute renversante | `chute-renversante` |
| 2 | Châtiment de l'Héritière | `chatiment-de-l-heritiere` |
| 2 | Clairaudience/clairvoyance | `clairaudience-clairvoyance` |
| 2 | Coeur dévasté | `coeur-devaste` |
| 2 | Collet | `collet` |
| 2 | Communication avec les apparitions | `communication-avec-les-apparitions` |
| 2 | Communion ancestrale | `communion-ancestrale` |
| 2 | Compression | `compression` |
| 2 | Concentration du dénicheur de pièges | `concentration-du-denicheur-de-pieges` |
| 2 | Conduit étrange | `conduit-etrange` |
| 2 | Confession | `confession` |
| 2 | Confession écarlate | `confession-ecarlate` |
| 2 | Consécration | `consecration` |
| 2 | Contact défigurant | `contact-defigurant` |
| 2 | Contact gelé | `contact-gele` |
| 2 | Contrôle de la vermine | `controle-de-la-vermine` |
| 2 | Contrôle mineur des morts-vivants | `controle-mineur-des-morts-vivants` |
| 2 | Convocation d'alliés naturels II | `convocation-d-allies-naturels-ii` |
| 2 | Convocation d'eidolon | `convocation-d-eidolon` |
| 2 | Convocation de cacodaémon | `convocation-de-cacodaemon` |
| 2 | Copain de boue | `copain-de-boue` |
| 2 | Coup mental II | `coup-mental-ii` |
| 2 | Coup tonitruant | `coup-tonitruant` |
| 2 | Cri sonique | `cri-sonique` |
| 2 | Croissance d'épines | `croissance-d-epines` |
| 2 | Création de carte au trésor | `creation-de-carte-au-tresor` |
| 2 | Création de fosse | `creation-de-fosse` |
| 2 | Cécité/surdité | `cecite-surdite` |
| 2 | Cœur de l'ennemi | `coeur-de-l-ennemi` |
| 2 | De la soie à l'acier | `de-la-soie-a-l-acier` |
| 2 | Discours captivant | `discours-captivant` |
| 2 | Disque de pierre | `disque-de-pierre` |
| 2 | Dissimuler la magie (partagé) | `dissimuler-la-magie-partage` |
| 2 | Distorsion du bois | `distorsion-du-bois` |
| 2 | Distorsion spatiale | `distorsion-spatiale` |
| 2 | Déblocage | `deblocage` |
| 2 | Décharge défensive | `decharge-defensive` |
| 2 | Déformation corporelle | `deformation-corporelle` |
| 2 | Dégoût | `degout` |
| 2 | Déguisement fantomatique | `deguisement-fantomatique` |
| 2 | Déguiser autrui | `deguiser-autrui` |
| 2 | Démarche du caméléon | `demarche-du-cameleon` |
| 2 | Démarche décalibrée | `demarche-decalibree` |
| 2 | Détection de l'invisibilité | `detection-de-l-invisibilite` |
| 2 | Détection de la magie suprême | `detection-de-la-magie-supreme` |
| 2 | Détection de paysage mental | `detection-de-paysage-mental` |
| 2 | Détection des angoisses | `detection-des-angoisses` |
| 2 | Détection des désirs | `detection-des-desirs` |
| 2 | Détection faussée | `detection-faussee` |
| 2 | Eau rouge | `eau-rouge` |
| 2 | Eaux de folie | `eaux-de-folie` |
| 2 | Effet placebo | `effet-placebo` |
| 2 | Effroi | `effroi` |
| 2 | Empathie de la meute | `empathie-de-la-meute` |
| 2 | Enchevêtrement flamboyant | `enchevetrement-flamboyant` |
| 2 | Enchevêtrement répugnant | `enchevetrement-repugnant` |
| 2 | Endurance aux énergies destructives (partagé) | `endurance-aux-energies-destructives-partage` |
| 2 | Engin de siège magique | `engin-de-siege-magique` |
| 2 | Engouement téméraire | `engouement-temeraire` |
| 2 | Ennui oppressant | `ennui-oppressant` |
| 2 | Entrave de terre | `entrave-de-terre` |
| 2 | Entremise | `entremise` |
| 2 | Entrer dans une image | `entrer-dans-une-image` |
| 2 | Enveloppement des pensées | `enveloppement-des-pensees` |
| 2 | Erreur malencontreuse | `erreur-malencontreuse` |
| 2 | Erreur tactique | `erreur-tactique` |
| 2 | Espace sacré | `espace-sacre` |
| 2 | Esprit endormi | `esprit-endormi` |
| 2 | Esprit investigateur | `esprit-investigateur` |
| 2 | Esprit protecteur | `esprit-protecteur` |
| 2 | Examen approfondi | `examen-approfondi` |
| 2 | Expression du psychonaute | `expression-du-psychonaute` |
| 2 | Faim de la goule | `faim-de-la-goule` |
| 2 | Fardeau de l'oracle | `fardeau-de-l-oracle` |
| 2 | Faux souvenir | `faux-souvenir` |
| 2 | Façonnage du bois | `faconnage-du-bois` |
| 2 | Festin de cendres | `festin-de-cendres` |
| 2 | Feu de camp abrité | `feu-de-camp-abrite` |
| 2 | Flammes du fidèle | `flammes-du-fidele` |
| 2 | Flexibilité extrême | `flexibilite-extreme` |
| 2 | Flottabilité | `flottabilite` |
| 2 | Flou | `flou` |
| 2 | Flèche de loi | `fleche-de-loi` |
| 2 | Flèche sacrée | `fleche-sacree` |
| 2 | Folle hallucination | `folle-hallucination` |
| 2 | Fouet affaiblissant | `fouet-affaiblissant` |
| 2 | Fouet d'araignées | `fouet-d-araignees` |
| 2 | Fouet de la rivière | `fouet-de-la-riviere` |
| 2 | Fouet fantôme | `fouet-fantome` |
| 2 | Foulée urbaine | `foulee-urbaine` |
| 2 | Fracassement | `fracassement` |
| 2 | Frappe douloureuse | `frappe-douloureuse` |
| 2 | Frappes fébriles | `frappes-febriles` |
| 2 | Frissonnement du temps | `frissonnement-du-temps` |
| 2 | Froid pénétrant | `froid-penetrant` |
| 2 | Fureur de Rovagug | `fureur-de-rovagug` |
| 2 | Fureur solaire | `fureur-solaire` |
| 2 | Fustiger | `fustiger` |
| 2 | Férocité du blaireau | `ferocite-du-blaireau` |
| 2 | Grâce du Pugwampi | `grace-du-pugwampi` |
| 2 | Guide | `guide` |
| 2 | Habileté en selle | `habilete-en-selle` |
| 2 | Hallucination audiovisuelle | `hallucination-audiovisuelle` |
| 2 | Haricot magique | `haricot-magique` |
| 2 | Horreur onirique suprême | `horreur-onirique-supreme` |
| 2 | Hurlement d'agonie | `hurlement-d-agonie` |
| 2 | Hurlement perçant | `hurlement-percant` |
| 2 | Hypercognition | `hypercognition` |
| 2 | Hypnose des animaux | `hypnose-des-animaux` |
| 2 | Idiotie | `idiotie` |
| 2 | Immolation spontanée | `immolation-spontanee` |
| 2 | Implantation de lecture factice | `implantation-de-lecture-factice` |
| 2 | Imprégner d'aura | `impregner-d-aura` |
| 2 | Infliger des souffrances | `infliger-des-souffrances` |
| 2 | Injection | `injection` |
| 2 | Insinuation du ça I | `insinuation-du-ca-i` |
| 2 | Inspiration galante | `inspiration-galante` |
| 2 | Instrument d'agonie | `instrument-d-agonie` |
| 2 | Interaction anonyme | `interaction-anonyme` |
| 2 | Intuition de l'ennemi | `intuition-de-l-ennemi` |
| 2 | Invective cuisante | `invective-cuisante` |
| 2 | Jauge de sort | `jauge-de-sort` |
| 2 | L'esprit dépasse la matière | `l-esprit-depasse-la-matiere` |
| 2 | La mort venue d'en bas | `la-mort-venue-d-en-bas` |
| 2 | Lame de feu | `lame-de-feu` |
| 2 | Lamentation des derniers jours d'été | `lamentation-des-derniers-jours-d-ete` |
| 2 | Lance de lumière | `lance-de-lumiere` |
| 2 | Lance de pureté | `lance-de-purete` |
| 2 | Lancer un duel psychique | `lancer-un-duel-psychique` |
| 2 | Langage caché | `langage-cache` |
| 2 | Langage codé | `langage-code` |
| 2 | Langue élémentaire | `langue-elementaire` |
| 2 | Lanternes macabres | `lanternes-macabres` |
| 2 | Les yeux du séducteur | `les-yeux-du-seducteur` |
| 2 | Lien sacré | `lien-sacre` |
| 2 | Lien vital avec le compagnon | `lien-vital-avec-le-compagnon` |
| 2 | Litanie d'enchevêtrement | `litanie-d-enchevetrement` |
| 2 | Litanie d'éloquence | `litanie-d-eloquence` |
| 2 | Litanie de défense | `litanie-de-defense` |
| 2 | Litanie de prévention | `litanie-de-prevention` |
| 2 | Litanie de vertu | `litanie-de-vertu` |
| 2 | Livre ouvert | `livre-ouvert` |
| 2 | Loup fantomatique | `loup-fantomatique` |
| 2 | Lueurs hypnotiques | `lueurs-hypnotiques` |
| 2 | Lumière de l'Héritière | `lumiere-de-l-heritiere` |
| 2 | Lévitation hostile | `levitation-hostile` |
| 2 | Main spectrale | `main-spectrale` |
| 2 | Malédiction | `malediction` |
| 2 | Manteau de calme | `manteau-de-calme` |
| 2 | Marche sur l'onde | `marche-sur-l-onde` |
| 2 | Marche sur l'onde (partagé) | `marche-sur-l-onde-partage` |
| 2 | Marionnette de peau | `marionnette-de-peau` |
| 2 | Messager verrouillé | `messager-verrouille` |
| 2 | Misérable pitié | `miserable-pitie` |
| 2 | Mixture pour bombe d'ombre | `mixture-pour-bombe-d-ombre` |
| 2 | Modification d'apparence | `modification-d-apparence` |
| 2 | Monture (partagé) | `monture-partage` |
| 2 | Mur de vent | `mur-de-vent` |
| 2 | Mâchoires d'acier | `machoires-d-acier` |
| 2 | Métal brûlant | `metal-brulant` |
| 2 | Métal gelé | `metal-gele` |
| 2 | Nappe de brouillard | `nappe-de-brouillard` |
| 2 | Nappe de glace | `nappe-de-glace` |
| 2 | Nodule explosif | `nodule-explosif` |
| 2 | Nuage euphorisant | `nuage-euphorisant` |
| 2 | Nuée grouillante | `nuee-grouillante` |
| 2 | Orbe en fusion | `orbe-en-fusion` |
| 2 | Os protecteur | `os-protecteur` |
| 2 | Pacte vital | `pacte-vital` |
| 2 | Panoplie du champion | `panoplie-du-champion` |
| 2 | Paria | `paria` |
| 2 | Parole animale | `parole-animale` |
| 2 | Partage de la langue (partagé) | `partage-de-la-langue-partage` |
| 2 | Partage des souvenirs | `partage-des-souvenirs` |
| 2 | Passager clandestin | `passager-clandestin` |
| 2 | Peau en fer | `peau-en-fer` |
| 2 | Perception des indices | `perception-des-indices` |
| 2 | Perception du sang | `perception-du-sang` |
| 2 | Perturbation profane | `perturbation-profane` |
| 2 | Pied aérien | `pied-aerien` |
| 2 | Pistage d'un navire | `pistage-d-un-navire` |
| 2 | Piste de la rose | `piste-de-la-rose` |
| 2 | Piste olfactive | `piste-olfactive` |
| 2 | Piège illusoire | `piege-illusoire` |
| 2 | Piège indétectable | `piege-indetectable` |
| 2 | Piège à feu | `piege-a-feu` |
| 2 | Plaie au visage | `plaie-au-visage` |
| 2 | Poigne sûre | `poigne-sure` |
| 2 | Poison pernicieux | `poison-pernicieux` |
| 2 | Portail fragile | `portail-fragile` |
| 2 | Possession spirituelle d'objet inférieure | `possession-spirituelle-d-objet-inferieure` |
| 2 | Potion de tatouage | `potion-de-tatouage` |
| 2 | Poudre instable | `poudre-instable` |
| 2 | Poudre stable | `poudre-stable` |
| 2 | Poumons d'Aboleth | `poumons-d-aboleth` |
| 2 | Pourparlers du Faiseur de paix | `pourparlers-du-faiseur-de-paix` |
| 2 | Poussière du crépuscule | `poussiere-du-crepuscule` |
| 2 | Poussière scintillante | `poussiere-scintillante` |
| 2 | Prison de lumière | `prison-de-lumiere` |
| 2 | Profanation | `profanation` |
| 2 | Protection contre la Loi (partagé) | `protection-contre-la-loi-partage` |
| 2 | Protection contre le Bien (partagé) | `protection-contre-le-bien-partage` |
| 2 | Protection contre le Chaos (partagé) | `protection-contre-le-chaos-partage` |
| 2 | Protection contre le Mal (partagé) | `protection-contre-le-mal-partage` |
| 2 | Protection contre les projectiles | `protection-contre-les-projectiles` |
| 2 | Protection d'autrui | `protection-d-autrui` |
| 2 | Protection de livre | `protection-de-livre` |
| 2 | Protection des organes vitaux | `protection-des-organes-vitaux` |
| 2 | Protection du compagnon | `protection-du-compagnon` |
| 2 | Présence cachée | `presence-cachee` |
| 2 | Préservation des morts | `preservation-des-morts` |
| 2 | Puanteur amplifiée | `puanteur-amplifiee` |
| 2 | Pur dégoût | `pur-degout` |
| 2 | Purulence | `purulence` |
| 2 | Pyrotechnie | `pyrotechnie` |
| 2 | Pénombre protectrice | `penombre-protectrice` |
| 2 | Rage | `rage` |
| 2 | Rage jalouse | `rage-jalouse` |
| 2 | Rage morte-vivante | `rage-morte-vivante` |
| 2 | Rage sanguinaire | `rage-sanguinaire` |
| 2 | Ramollissement de la terre et de la pierre | `ramollissement-de-la-terre-et-de-la-pierre` |
| 2 | Rapetissement d'animal | `rapetissement-d-animal` |
| 2 | Rapidité | `rapidite` |
| 2 | Rapport | `rapport` |
| 2 | Rayon aveuglant | `rayon-aveuglant` |
| 2 | Rayon de réprimande | `rayon-de-reprimande` |
| 2 | Recherche de pensées | `recherche-de-pensees` |
| 2 | Recul excessif | `recul-excessif` |
| 2 | Regard brûlant | `regard-brulant` |
| 2 | Rejeter la faute | `rejeter-la-faute` |
| 2 | Renforcer l'armement (partagé) | `renforcer-l-armement-partage` |
| 2 | Reproche déchirant | `reproche-dechirant` |
| 2 | Repérer les faiblesses | `reperer-les-faiblesses` |
| 2 | Restauration d'eidolon mineure | `restauration-d-eidolon-mineure` |
| 2 | Restauration de pouvoir mythique | `restauration-de-pouvoir-mythique` |
| 2 | Retardement de la douleur | `retardement-de-la-douleur` |
| 2 | Rocher magique | `rocher-magique` |
| 2 | Rupture mythique | `rupture-mythique` |
| 2 | Rythme naturel | `rythme-naturel` |
| 2 | Réflexes accrus | `reflexes-accrus` |
| 2 | Régression ancestrale | `regression-ancestrale` |
| 2 | Résistance à la corruption | `resistance-a-la-corruption` |
| 2 | Réverbération cinétique | `reverberation-cinetique` |
| 2 | Révélation | `revelation` |
| 2 | Sacrifice du paladin | `sacrifice-du-paladin` |
| 2 | Sacrifice partagé | `sacrifice-partage` |
| 2 | Sang adhésif | `sang-adhesif` |
| 2 | Sang bouillant | `sang-bouillant` |
| 2 | Sangsue psychique | `sangsue-psychique` |
| 2 | Savoir du chasseur | `savoir-du-chasseur` |
| 2 | Savoir manier une arme | `savoir-manier-une-arme` |
| 2 | Sceau de fuite | `sceau-de-fuite` |
| 2 | Scrupule | `scrupule` |
| 2 | Sculpture de simulacre | `sculpture-de-simulacre` |
| 2 | Sens aiguisés | `sens-aiguises` |
| 2 | Sentier de la gloire | `sentier-de-la-gloire` |
| 2 | Serment de justice | `serment-de-justice` |
| 2 | Shuriken de feu | `shuriken-de-feu` |
| 2 | Silence | `silence` |
| 2 | Sillage de lumière | `sillage-de-lumiere` |
| 2 | Simulacre de vie | `simulacre-de-vie` |
| 2 | Soldats de la nature | `soldats-de-la-nature` |
| 2 | Son étouffé | `son-etouffe` |
| 2 | Songe mineur | `songe-mineur` |
| 2 | Souffle de feu | `souffle-de-feu` |
| 2 | Sphère de bourrasques | `sphere-de-bourrasques` |
| 2 | Sphère de feu | `sphere-de-feu` |
| 2 | Suggestion | `suggestion` |
| 2 | Suppression des charmes et de la coercition | `suppression-des-charmes-et-de-la-coercition` |
| 2 | Surmonter l'affliction | `surmonter-l-affliction` |
| 2 | Symbole de miroir | `symbole-de-miroir` |
| 2 | Table silencieuse | `table-silencieuse` |
| 2 | Terreur miasmatique | `terreur-miasmatique` |
| 2 | Tir par ricochet | `tir-par-ricochet` |
| 2 | Toile d'araignée | `toile-d-araignee` |
| 2 | Torche révélatrice | `torche-revelatrice` |
| 2 | Tout se mange | `tout-se-mange` |
| 2 | Transfert de puissance élémentaire | `transfert-de-puissance-elementaire` |
| 2 | Transfert de voie | `transfert-de-voie` |
| 2 | Transformation de maître | `transformation-de-maitre` |
| 2 | Transmission alchimique | `transmission-alchimique` |
| 2 | Transmutation de potion en poison | `transmutation-de-potion-en-poison` |
| 2 | Transport d'objet | `transport-d-objet` |
| 2 | Traquer l'aura | `traquer-l-aura` |
| 2 | Trident de la nature | `trident-de-la-nature` |
| 2 | Vague | `vague` |
| 2 | Venin latent | `venin-latent` |
| 2 | Vent de murmures | `vent-de-murmures` |
| 2 | Vie scellée | `vie-scellee` |
| 2 | Vigueur du juste | `vigueur-du-juste` |
| 2 | Violent nuage d'orage | `violent-nuage-d-orage` |
| 2 | Vision dans le noir | `vision-dans-le-noir` |
| 2 | Vision végétale | `vision-vegetale` |
| 2 | Vocabulaire savant | `vocabulaire-savant` |
| 2 | Voile nain | `voile-nain` |
| 2 | Vol de souffle | `vol-de-souffle` |
| 2 | Vol de voix | `vol-de-voix` |
| 2 | Vomir une nuée | `vomir-une-nuee` |
| 2 | Vérole | `verole` |
| 2 | Zèle contagieux | `zele-contagieux` |
| 2 | Écailles épineuses | `ecailles-epineuses` |
| 2 | Éclat du chaos | `eclat-du-chaos` |
| 2 | Écuyer spirituel | `ecuyer-spirituel` |
| 2 | Élévation du sol | `elevation-du-sol` |
| 2 | Épiphanie livresque | `epiphanie-livresque` |
| 2 | Éruption de flèches | `eruption-de-fleches` |
| 2 | Éternuement de feu | `eternuement-de-feu` |
| 2 | Évolution mineure | `evolution-mineure` |
| 2 | Œil de faucon | `oeil-de-faucon` |
| 2 | Œil du chasseur | `oeil-du-chasseur` |
| 3 | Abri | `abri` |
| 3 | Absorption de toxine | `absorption-de-toxine` |
| 3 | Accompagnement exquis | `accompagnement-exquis` |
| 3 | Action conditionnée | `action-conditionnee` |
| 3 | Affaiblissement des énergies destructives | `affaiblissement-des-energies-destructives` |
| 3 | Affûtage | `affutage` |
| 3 | Agonie | `agonie` |
| 3 | Air autoritaire | `air-autoritaire` |
| 3 | Ambassadeur animal | `ambassadeur-animal` |
| 3 | Amplification d'élixir | `amplification-d-elixir` |
| 3 | Anatomie morte-vivante I | `anatomie-morte-vivante-i` |
| 3 | Ancre dimensionnelle | `ancre-dimensionnelle` |
| 3 | Animal anthropomorphe | `animal-anthropomorphe` |
| 3 | Anneau scindé | `anneau-scinde` |
| 3 | Aperçu lucide | `apercu-lucide` |
| 3 | Appel d'un esprit | `appel-d-un-esprit` |
| 3 | Appel des nixes | `appel-des-nixes` |
| 3 | Appel du néant | `appel-du-neant` |
| 3 | Appendices monstrueux | `appendices-monstrueux` |
| 3 | Arme alignée (partagé) | `arme-alignee-partage` |
| 3 | Arme magique suprême | `arme-magique-supreme` |
| 3 | Armes muettes | `armes-muettes` |
| 3 | Armure impie | `armure-impie` |
| 3 | Armure revenante | `armure-revenante` |
| 3 | Armure sainte | `armure-sainte` |
| 3 | Aspect animal supérieur | `aspect-animal-superieur` |
| 3 | Aspect du cerf | `aspect-du-cerf` |
| 3 | Assassin imaginaire | `assassin-imaginaire` |
| 3 | Assaut concerté | `assaut-concerte` |
| 3 | Attraction féérique | `attraction-feerique` |
| 3 | Aura d'archon | `aura-d-archon` |
| 3 | Aura de cannibalisme | `aura-de-cannibalisme` |
| 3 | Aura magique suprême | `aura-magique-supreme` |
| 3 | Aura élémentaire | `aura-elementaire` |
| 3 | Bagou | `bagou` |
| 3 | Baiser du vampire | `baiser-du-vampire` |
| 3 | Balle dédiée | `balle-dediee` |
| 3 | Bannir les faux-semblants | `bannir-les-faux-semblants` |
| 3 | Baroud des champions | `baroud-des-champions` |
| 3 | Barrière explosive | `barriere-explosive` |
| 3 | Barrière mentale II | `barriere-mentale-ii` |
| 3 | Barrière étourdissante suprême | `barriere-etourdissante-supreme` |
| 3 | Blessure grave | `blessure-grave` |
| 3 | Bouclier de défense suprême | `bouclier-de-defense-supreme` |
| 3 | Bouclier de feu | `bouclier-de-feu` |
| 3 | Bouclier des pensées II | `bouclier-des-pensees-ii` |
| 3 | Brouillage synaptique | `brouillage-synaptique` |
| 3 | Brouillard des tertres | `brouillard-des-tertres` |
| 3 | Bulle de vie | `bulle-de-vie` |
| 3 | Bénédiction de la taupe | `benediction-de-la-taupe` |
| 3 | Canaliser la vigueur | `canaliser-la-vigueur` |
| 3 | Canaliser le don | `canaliser-le-don` |
| 3 | Cercle magique contre la Loi | `cercle-magique-contre-la-loi` |
| 3 | Cercle magique contre le Chaos | `cercle-magique-contre-le-chaos` |
| 3 | Cercle thaumaturgique | `cercle-thaumaturgique` |
| 3 | Chagrin écrasant | `chagrin-ecrasant` |
| 3 | Char fantôme | `char-fantome` |
| 3 | Chaîne de perdition | `chaine-de-perdition` |
| 3 | Cheveux étrangleurs | `cheveux-etrangleurs` |
| 3 | Chœur hanté | `choeur-hante` |
| 3 | Clignotement | `clignotement` |
| 3 | Coeur du métal | `coeur-du-metal` |
| 3 | Communication à distance | `communication-a-distance` |
| 3 | Comparaison méticuleuse | `comparaison-meticuleuse` |
| 3 | Compensation rétributive | `compensation-retributive` |
| 3 | Comètes vengeresses | `cometes-vengeresses` |
| 3 | Conducteur fantôme | `conducteur-fantome` |
| 3 | Confusion | `confusion` |
| 3 | Contact absorbant | `contact-absorbant` |
| 3 | Contagion | `contagion` |
| 3 | Contrariété des géants | `contrariete-des-geants` |
| 3 | Contrefaçon instantanée | `contrefacon-instantanee` |
| 3 | Contrôle des créatures convoquées | `controle-des-creatures-convoquees` |
| 3 | Convocation d'alliés naturels III | `convocation-d-allies-naturels-iii` |
| 3 | Convocation de cacodaémon suprême | `convocation-de-cacodaemon-supreme` |
| 3 | Convocation de créature totémique | `convocation-de-creature-totemique` |
| 3 | Convocation de diligence | `convocation-de-diligence` |
| 3 | Convocation de gardien ancestral | `convocation-de-gardien-ancestral` |
| 3 | Corde brillante | `corde-brillante` |
| 3 | Corps épineux | `corps-epineux` |
| 3 | Coup mental III | `coup-mental-iii` |
| 3 | Coupe de poussière | `coupe-de-poussiere` |
| 3 | Coursier fantôme (partagé) | `coursier-fantome-partage` |
| 3 | Crachat venimeux | `crachat-venimeux` |
| 3 | Creusement | `creusement` |
| 3 | Cri strident | `cri-strident` |
| 3 | Crochet de force | `crochet-de-force` |
| 3 | Croissance végétale | `croissance-vegetale` |
| 3 | Crâne ricanant | `crane-ricanant` |
| 3 | Création de gemme spirituelle | `creation-de-gemme-spirituelle` |
| 3 | Création mineure | `creation-mineure` |
| 3 | Divination | `divination` |
| 3 | Domination d'animal | `domination-d-animal` |
| 3 | Don des langues (partagé) | `don-des-langues-partage` |
| 3 | Double terrifiant | `double-terrifiant` |
| 3 | Déchaînement de débris | `dechainement-de-debris` |
| 3 | Déchirure du déguisement | `dechirure-du-deguisement` |
| 3 | Déformation douloureuse | `deformation-douloureuse` |
| 3 | Déguisement ajustable | `deguisement-ajustable` |
| 3 | Démarche aérienne de groupe | `demarche-aerienne-de-groupe` |
| 3 | Démarche du caméléon suprême | `demarche-du-cameleon-supreme` |
| 3 | Déplacement | `deplacement` |
| 3 | Désespoir foudroyant | `desespoir-foudroyant` |
| 3 | Détection de la scrutation | `detection-de-la-scrutation` |
| 3 | Détection du mensonge | `detection-du-mensonge` |
| 3 | Effacement d'impression | `effacement-d-impression` |
| 3 | Efforts coordonnés | `efforts-coordonnes` |
| 3 | Empire végétal | `empire-vegetal` |
| 3 | Empoisonnement | `empoisonnement` |
| 3 | Emprunt de chance | `emprunt-de-chance` |
| 3 | Enchevêtrement épineux | `enchevetrement-epineux` |
| 3 | Ennemi des enchantements | `ennemi-des-enchantements` |
| 3 | Ennemi du moment | `ennemi-du-moment` |
| 3 | Esprit malveillant | `esprit-malveillant` |
| 3 | Exilé par la nature | `exile-par-la-nature` |
| 3 | Extinction des feux | `extinction-des-feux` |
| 3 | Faim vampirique | `faim-vampirique` |
| 3 | Faux alibi | `faux-alibi` |
| 3 | Faux avenir | `faux-avenir` |
| 3 | Feu du jugement | `feu-du-jugement` |
| 3 | Final purificateur | `final-purificateur` |
| 3 | Final revigorant | `final-revigorant` |
| 3 | Flot obsidien | `flot-obsidien` |
| 3 | Flèche de l'aube | `fleche-de-l-aube` |
| 3 | Flèches enflammées | `fleches-enflammees` |
| 3 | Fléchettes d'argent | `flechettes-d-argent` |
| 3 | Fonts de magie des esprits | `fonts-de-magie-des-esprits` |
| 3 | Formation tactique | `formation-tactique` |
| 3 | Forme de bébé | `forme-de-bebe` |
| 3 | Forme de vermine I | `forme-de-vermine-i` |
| 3 | Fosse hérissée de pieux | `fosse-herissee-de-pieux` |
| 3 | Fouet d'ego I | `fouet-d-ego-i` |
| 3 | Fractionnement des soins et des blessures | `fractionnement-des-soins-et-des-blessures` |
| 3 | Furie flexible | `furie-flexible` |
| 3 | Fusion dans la pierre | `fusion-dans-la-pierre` |
| 3 | Geyser d'air | `geyser-d-air` |
| 3 | Glace insidieuse | `glace-insidieuse` |
| 3 | Glyphe de maléfice | `glyphe-de-malefice` |
| 3 | Goutte d'orchidée | `goutte-d-orchidee` |
| 3 | Grand pas suprême | `grand-pas-supreme` |
| 3 | Griffes sanglantes | `griffes-sanglantes` |
| 3 | Guérison de destrier | `guerison-de-destrier` |
| 3 | Hallucination complexe | `hallucination-complexe` |
| 3 | Harmonie profane | `harmonie-profane` |
| 3 | Hébétement de groupe | `hebetement-de-groupe` |
| 3 | Héroïsme insipide | `heroisme-insipide` |
| 3 | Image dérobée | `image-derobee` |
| 3 | Immobilisation de morts-vivants | `immobilisation-de-morts-vivants` |
| 3 | Infatigables poursuivants | `infatigables-poursuivants` |
| 3 | Infestation fongique | `infestation-fongique` |
| 3 | Innombrables yeux | `innombrables-yeux` |
| 3 | Insectes espions | `insectes-espions` |
| 3 | Insinuation du ça II | `insinuation-du-ca-ii` |
| 3 | Invasion d'orties | `invasion-d-orties` |
| 3 | Isoler | `isoler` |
| 3 | Juggernaut mortel | `juggernaut-mortel` |
| 3 | Jumeau de ficelle | `jumeau-de-ficelle` |
| 3 | Jumeau de vomi | `jumeau-de-vomi` |
| 3 | Lame de sombre triomphe | `lame-de-sombre-triomphe` |
| 3 | Lame de triomphe éclatant | `lame-de-triomphe-eclatant` |
| 3 | Lame du crépuscule | `lame-du-crepuscule` |
| 3 | Lame spirituelle | `lame-spirituelle` |
| 3 | Lame éblouissante de groupe | `lame-eblouissante-de-groupe` |
| 3 | Lecture du destin | `lecture-du-destin` |
| 3 | Lien mental avec le compagnon | `lien-mental-avec-le-compagnon` |
| 3 | Linceul de foudre | `linceul-de-foudre` |
| 3 | Litanie de fuite | `litanie-de-fuite` |
| 3 | Litanie de vision | `litanie-de-vision` |
| 3 | Loin des yeux | `loin-des-yeux` |
| 3 | Lumière argentée | `lumiere-argentee` |
| 3 | Main rouge de l'assassin | `main-rouge-de-l-assassin` |
| 3 | Malédiction conditionnelle | `malediction-conditionnelle` |
| 3 | Malédiction de dégoût | `malediction-de-degout` |
| 3 | Malédiction de négation magique | `malediction-de-negation-magique` |
| 3 | Manipulation des sons | `manipulation-des-sons` |
| 3 | Manoeuvre télékinétique | `manoeuvre-telekinetique` |
| 3 | Manteau de colère | `manteau-de-colere` |
| 3 | Manteau de vent | `manteau-de-vent` |
| 3 | Marionnette martiale | `marionnette-martiale` |
| 3 | Marque d'évidente morale | `marque-d-evidente-morale` |
| 3 | Marque fantôme | `marque-fantome` |
| 3 | Marques d'interdiction | `marques-d-interdiction` |
| 3 | Message suggestif | `message-suggestif` |
| 3 | Mission | `mission` |
| 3 | Mixture pour bombe à décharge de foudre | `mixture-pour-bombe-a-decharge-de-foudre` |
| 3 | Modification d'aura | `modification-d-aura` |
| 3 | Mordre la main de son maître | `mordre-la-main-de-son-maitre` |
| 3 | Morsure magique suprême | `morsure-magique-supreme` |
| 3 | Mur de nausées | `mur-de-nausees` |
| 3 | Mur de saumure | `mur-de-saumure` |
| 3 | Murmure sacré | `murmure-sacre` |
| 3 | Murmures dorés | `murmures-dores` |
| 3 | Mépris absolu | `mepris-absolu` |
| 3 | Métamorphose du familier | `metamorphose-du-familier` |
| 3 | Narcissisme suffisant | `narcissisme-suffisant` |
| 3 | Natation aérienne | `natation-aerienne` |
| 3 | Nuage nauséabond | `nuage-nauseabond` |
| 3 | Nuit de lames | `nuit-de-lames` |
| 3 | Nuée de crocs | `nuee-de-crocs` |
| 3 | Nuée distordante | `nuee-distordante` |
| 3 | Négation de l'invisibilité | `negation-de-l-invisibilite` |
| 3 | Négligence | `negligence` |
| 3 | Onde de feu | `onde-de-feu` |
| 3 | Orbe aqueux | `orbe-aqueux` |
| 3 | Panoplie magique | `panoplie-magique` |
| 3 | Parangon soudain | `parangon-soudain` |
| 3 | Partage des sens | `partage-des-sens` |
| 3 | Pattes d'araignée (partagé) | `pattes-d-araignee-partage` |
| 3 | Peau résineuse | `peau-resineuse` |
| 3 | Perturbation des invocations | `perturbation-des-invocations` |
| 3 | Petite sirène | `petite-sirene` |
| 3 | Physique monstrueux I | `physique-monstrueux-i` |
| 3 | Pied ancré | `pied-ancre` |
| 3 | Pieux de glace | `pieux-de-glace` |
| 3 | Pistage aérien | `pistage-aerien` |
| 3 | Piste de feu | `piste-de-feu` |
| 3 | Piège ectoplasmique | `piege-ectoplasmique` |
| 3 | Piège à arme | `piege-a-arme` |
| 3 | Placage trompeur | `placage-trompeur` |
| 3 | Pluie de grenouilles | `pluie-de-grenouilles` |
| 3 | Pluie de plomb | `pluie-de-plomb` |
| 3 | Poignée de vipères | `poignee-de-viperes` |
| 3 | Poing de force | `poing-de-force` |
| 3 | Poings éthérés | `poings-etheres` |
| 3 | Poison illusoire | `poison-illusoire` |
| 3 | Porte sur un paysage mental | `porte-sur-un-paysage-mental` |
| 3 | Porte-bonheur | `porte-bonheur` |
| 3 | Possession de marionnette | `possession-de-marionnette` |
| 3 | Possession spirituelle | `possession-spirituelle` |
| 3 | Projectile empoisonné | `projectile-empoisonne` |
| 3 | Projection implantée | `projection-implantee` |
| 3 | Protection contre les projectiles (partagé) | `protection-contre-les-projectiles-partage` |
| 3 | Protection contre les énergies destructives (partagé) | `protection-contre-les-energies-destructives-partage` |
| 3 | Protection des fidèles | `protection-des-fideles` |
| 3 | Protégé de la saison | `protege-de-la-saison` |
| 3 | Puanteur de la proie | `puanteur-de-la-proie` |
| 3 | Puissantes mâchoires | `puissantes-machoires` |
| 3 | Pulsation synaptique | `pulsation-synaptique` |
| 3 | Rabougrissement des plantes | `rabougrissement-des-plantes` |
| 3 | Rafale du bélier | `rafale-du-belier` |
| 3 | Ralentissement du poison (partagé) | `ralentissement-du-poison-partage` |
| 3 | Rancune | `rancune` |
| 3 | Rapetissement de groupe | `rapetissement-de-groupe` |
| 3 | Rature | `rature` |
| 3 | Rayon d'épuisement | `rayon-d-epuisement` |
| 3 | Représailles | `represailles` |
| 3 | Représailles enchantées | `represailles-enchantees` |
| 3 | Requiem pour les fantômes de groupe | `requiem-pour-les-fantomes-de-groupe` |
| 3 | Respiration d'air | `respiration-d-air` |
| 3 | Restauration d'eidolon | `restauration-d-eidolon` |
| 3 | Revigorer de groupe | `revigorer-de-groupe` |
| 3 | Rune de protection | `rune-de-protection` |
| 3 | Rune de solidité | `rune-de-solidite` |
| 3 | Runes explosives | `runes-explosives` |
| 3 | Réduction d'objet | `reduction-d-objet` |
| 3 | Régression | `regression` |
| 3 | Régénération d'eidolon | `regeneration-d-eidolon` |
| 3 | Répulsif | `repulsif` |
| 3 | Réservoir de résilience | `reservoir-de-resilience` |
| 3 | Réservoir draconique | `reservoir-draconique` |
| 3 | Résistance aux énergies destructives (partagé) | `resistance-aux-energies-destructives-partage` |
| 3 | Résistance à l'âge mineure | `resistance-a-l-age-mineure` |
| 3 | Rétrocognition | `retrocognition` |
| 3 | Sables changeants | `sables-changeants` |
| 3 | Sables du temps | `sables-du-temps` |
| 3 | Sabot du tonnerre suprême | `sabot-du-tonnerre-supreme` |
| 3 | Sabotage de créature artificielle | `sabotage-de-creature-artificielle` |
| 3 | Sadomasochisme | `sadomasochisme` |
| 3 | Salut du sang | `salut-du-sang` |
| 3 | Sangsue de ki | `sangsue-de-ki` |
| 3 | Saut du bouffon | `saut-du-bouffon` |
| 3 | Sceau du serpent | `sceau-du-serpent` |
| 3 | Science du lien de vie | `science-du-lien-de-vie` |
| 3 | Secret dévoilé | `secret-devoile` |
| 3 | Sentier de nénuphars | `sentier-de-nenuphars` |
| 3 | Sentinelle de sang | `sentinelle-de-sang` |
| 3 | Sieste | `sieste` |
| 3 | Silence respectueux | `silence-respectueux` |
| 3 | Sillage nauséabond | `sillage-nauseabond` |
| 3 | Simulacre de vie supérieur | `simulacre-de-vie-superieur` |
| 3 | Singes fous | `singes-fous` |
| 3 | Sonde mentale | `sonde-mentale` |
| 3 | Sonder l'histoire | `sonder-l-histoire` |
| 3 | Songe | `songe` |
| 3 | Sphère d'invisibilité | `sphere-d-invisibilite` |
| 3 | Sphère de protection | `sphere-de-protection` |
| 3 | Suggestion programmée | `suggestion-programmee` |
| 3 | Symbole de fou-rire | `symbole-de-fou-rire` |
| 3 | Symbole de guérison | `symbole-de-guerison` |
| 3 | Symbole de lenteur | `symbole-de-lenteur` |
| 3 | Symbole de révélation | `symbole-de-revelation` |
| 3 | Synesthésie | `synesthesie` |
| 3 | Séquestration des souvenirs | `sequestration-des-souvenirs` |
| 3 | Sœur du partage | `soeur-du-partage` |
| 3 | Talisman instrumental | `talisman-instrumental` |
| 3 | Tambours tonnants | `tambours-tonnants` |
| 3 | Tempête de cendres | `tempete-de-cendres` |
| 3 | Tentacules noirs | `tentacules-noirs` |
| 3 | Terrible remords | `terrible-remords` |
| 3 | Texte illusoire | `texte-illusoire` |
| 3 | Thaumaturgie associative | `thaumaturgie-associative` |
| 3 | Tir aveuglant | `tir-aveuglant` |
| 3 | Tornade de sable | `tornade-de-sable` |
| 3 | Torrent hydraulique | `torrent-hydraulique` |
| 3 | Transe guerrière | `transe-guerriere` |
| 3 | Transfert d'auras | `transfert-d-auras` |
| 3 | Transfert de régénération | `transfert-de-regeneration` |
| 3 | Transfert divin | `transfert-divin` |
| 3 | Transport d'animal | `transport-d-animal` |
| 3 | Traîtrise illusoire | `traitrise-illusoire` |
| 3 | Témoin | `temoin` |
| 3 | Vengeance de l'amoureux | `vengeance-de-l-amoureux` |
| 3 | Vents capricieux | `vents-capricieux` |
| 3 | Vision dans le noir (partagé) | `vision-dans-le-noir-partage` |
| 3 | Vision des auras | `vision-des-auras` |
| 3 | Vision infernale | `vision-infernale` |
| 3 | Vision à travers la pierre | `vision-a-travers-la-pierre` |
| 3 | Vive perspective | `vive-perspective` |
| 3 | Voile répugnant | `voile-repugnant` |
| 3 | Voir à travers un miroir de l'Enclave | `voir-a-travers-un-miroir-de-l-enclave` |
| 3 | Voleuse préhensile | `voleuse-prehensile` |
| 3 | Vélocité du zéphyr | `velocite-du-zephyr` |
| 3 | Écailles épineuses supérieures | `ecailles-epineuses-superieures` |
| 3 | Échange d'esprits | `echange-d-esprits` |
| 3 | Échange d'objet | `echange-d-objet` |
| 3 | Éclairs d'obscurité aveuglante | `eclairs-d-obscurite-aveuglante` |
| 3 | Élan de rapidité | `elan-de-rapidite` |
| 3 | Épreuve de l'acide et du feu | `epreuve-de-l-acide-et-du-feu` |
| 3 | Équipage de squelettes | `equipage-de-squelettes` |
| 3 | Éruption de pustules | `eruption-de-pustules` |
| 3 | Éther condensé | `ether-condense` |
| 3 | Étrange fièvre | `etrange-fievre` |
| 3 | Évolution | `evolution` |
| 4 | Absolution | `absolution` |
| 4 | Accorder la grâce du champion | `accorder-la-grace-du-champion` |
| 4 | Action interdite supérieure | `action-interdite-superieure` |
| 4 | Adaptation planaire | `adaptation-planaire` |
| 4 | Annulation d'enchantement | `annulation-d-enchantement` |
| 4 | Antidétection (partagé) | `antidetection-partage` |
| 4 | Apaisement de créatures artificielles | `apaisement-de-creatures-artificielles` |
| 4 | Appel du tueur planaire | `appel-du-tueur-planaire` |
| 4 | Appel purifié | `appel-purifie` |
| 4 | Arme colérique | `arme-colerique` |
| 4 | Aspect du loup | `aspect-du-loup` |
| 4 | Atavisme | `atavisme` |
| 4 | Aura de funeste destin | `aura-de-funeste-destin` |
| 4 | Aura de mise à mort | `aura-de-mise-a-mort` |
| 4 | Balle dédiée supérieure | `balle-dediee-superieure` |
| 4 | Barrière mentale III | `barriere-mentale-iii` |
| 4 | Baume empoisonné | `baume-empoisonne` |
| 4 | Blessure critique | `blessure-critique` |
| 4 | Bombe boursouflée | `bombe-boursouflee` |
| 4 | Bosquet reposant | `bosquet-reposant` |
| 4 | Bouclier de l'aube | `bouclier-de-l-aube` |
| 4 | Bouclier des pensées III | `bouclier-des-pensees-iii` |
| 4 | Boule de feu contrôlée | `boule-de-feu-controlee` |
| 4 | Boule de foudre | `boule-de-foudre` |
| 4 | Bris d'os | `bris-d-os` |
| 4 | Brise-magie mineur | `brise-magie-mineur` |
| 4 | Broderie | `broderie` |
| 4 | Brouillard dense | `brouillard-dense` |
| 4 | Brume de vitriol | `brume-de-vitriol` |
| 4 | Bénédiction de Baphomet | `benediction-de-baphomet` |
| 4 | Bénédiction de chance et de résolution de groupe | `benediction-de-chance-et-de-resolution-de-groupe` |
| 4 | Bénédiction de ferveur | `benediction-de-ferveur` |
| 4 | Bénédiction de la salamandre | `benediction-de-la-salamandre` |
| 4 | Caresse vaseuse | `caresse-vaseuse` |
| 4 | Cassé supérieur | `casse-superieur` |
| 4 | Cauchemar | `cauchemar` |
| 4 | Chaleur curative | `chaleur-curative` |
| 4 | Chant du Royaume elfique | `chant-du-royaume-elfique` |
| 4 | Charge télékinétique | `charge-telekinetique` |
| 4 | Charme-personne de groupe | `charme-personne-de-groupe` |
| 4 | Chaîne cloutée des ombres | `chaine-cloutee-des-ombres` |
| 4 | Chevaucher les vagues | `chevaucher-les-vagues` |
| 4 | Chien de garde | `chien-de-garde` |
| 4 | Châtiment des abominations | `chatiment-des-abominations` |
| 4 | Châtiment sacré | `chatiment-sacre` |
| 4 | Colonne de feu | `colonne-de-feu` |
| 4 | Colère partagée | `colere-partagee` |
| 4 | Communication sécurisée suprême | `communication-securisee-supreme` |
| 4 | Communion avec la nature | `communion-avec-la-nature` |
| 4 | Conseil onirique | `conseil-onirique` |
| 4 | Contact avec les plans | `contact-avec-les-plans` |
| 4 | Contact calcificateur | `contact-calcificateur` |
| 4 | Contact mutagène | `contact-mutagene` |
| 4 | Contempler de loin | `contempler-de-loin` |
| 4 | Contrat | `contrat` |
| 4 | Contrôle de l'eau | `controle-de-l-eau` |
| 4 | Convocation d'accusateur | `convocation-d-accusateur` |
| 4 | Convocation d'alliés naturels IV | `convocation-d-allies-naturels-iv` |
| 4 | Convocation d'ombres | `convocation-d-ombres` |
| 4 | Convocation d'un vol d'aigle | `convocation-d-un-vol-d-aigle` |
| 4 | Convocation de ceustodaémon | `convocation-de-ceustodaemon` |
| 4 | Coquille anti-créatures intangibles | `coquille-anti-creatures-intangibles` |
| 4 | Coquille antiplantes | `coquille-antiplantes` |
| 4 | Corps élémentaire I | `corps-elementaire-i` |
| 4 | Corruption consumée | `corruption-consumee` |
| 4 | Coup mental IV | `coup-mental-iv` |
| 4 | Coup retentissant | `coup-retentissant` |
| 4 | Couronne de lames | `couronne-de-lames` |
| 4 | Courroux de l'ordre | `courroux-de-l-ordre` |
| 4 | Cri | `cri` |
| 4 | Croissance animale | `croissance-animale` |
| 4 | Création de paysage mental | `creation-de-paysage-mental` |
| 4 | Création majeure | `creation-majeure` |
| 4 | Créature artificielle incassable | `creature-artificielle-incassable` |
| 4 | Damnation | `damnation` |
| 4 | Danse des cent coupures | `danse-des-cent-coupures` |
| 4 | Dispense de Charon | `dispense-de-charon` |
| 4 | Dispersion des sièges | `dispersion-des-sieges` |
| 4 | Dissipation de la magie primordiale | `dissipation-de-la-magie-primordiale` |
| 4 | Don ancestral | `don-ancestral` |
| 4 | Don des profondeurs | `don-des-profondeurs` |
| 4 | Dysfonctionnement | `dysfonctionnement` |
| 4 | Débilité | `debilite` |
| 4 | Dénonciation | `denonciation` |
| 4 | Détonation | `detonation` |
| 4 | Détonation discordante | `detonation-discordante` |
| 4 | Effacement de l'esprit | `effacement-de-l-esprit` |
| 4 | Effigie majestueuse | `effigie-majestueuse` |
| 4 | Embourbement | `embourbement` |
| 4 | Endurance de l'ours de groupe | `endurance-de-l-ours-de-groupe` |
| 4 | Engin de siège magique supérieur | `engin-de-siege-magique-superieur` |
| 4 | Enveloppe éthérée | `enveloppe-etheree` |
| 4 | Esprit de l'arc | `esprit-de-l-arc` |
| 4 | Estoc sonore | `estoc-sonore` |
| 4 | Examen des rêves | `examen-des-reves` |
| 4 | Explosion de gloire | `explosion-de-gloire` |
| 4 | Exécution | `execution` |
| 4 | Faux-semblant | `faux-semblant` |
| 4 | Festin de terreur | `festin-de-terreur` |
| 4 | Final héroïque | `final-heroique` |
| 4 | Flammes de la vengeance | `flammes-de-la-vengeance` |
| 4 | Fléau d'insectes | `fleau-d-insectes` |
| 4 | Flétrissement végétal | `fletrissement-vegetal` |
| 4 | Force de taureau de groupe | `force-de-taureau-de-groupe` |
| 4 | Force décuplée | `force-decuplee` |
| 4 | Forme cendrée brûlante | `forme-cendree-brulante` |
| 4 | Forme de vermine II | `forme-de-vermine-ii` |
| 4 | Forme du nuage | `forme-du-nuage` |
| 4 | Forme liquide | `forme-liquide` |
| 4 | Forme miasmatique | `forme-miasmatique` |
| 4 | Forme véritable | `forme-veritable` |
| 4 | Formule universelle | `formule-universelle` |
| 4 | Forteresse intellectuelle I | `forteresse-intellectuelle-i` |
| 4 | Fosse acide | `fosse-acide` |
| 4 | Fouet d'ego II | `fouet-d-ego-ii` |
| 4 | Fouet de la bouche de l’enfer | `fouet-de-la-bouche-de-l-enfer` |
| 4 | Frappe de la corneille sanglante | `frappe-de-la-corneille-sanglante` |
| 4 | Frappe douloureuse de groupe | `frappe-douloureuse-de-groupe` |
| 4 | Frappe percutante | `frappe-percutante` |
| 4 | Fusion avec le familier | `fusion-avec-le-familier` |
| 4 | Gardien de la foi | `gardien-de-la-foi` |
| 4 | Geyser | `geyser` |
| 4 | Grand banquet | `grand-banquet` |
| 4 | Grâce féline de groupe | `grace-feline-de-groupe` |
| 4 | Guérison diabolique supérieure | `guerison-diabolique-superieure` |
| 4 | Hallucination scénarisée | `hallucination-scenarisee` |
| 4 | Halo de gloire | `halo-de-gloire` |
| 4 | Havresombre | `havresombre` |
| 4 | Hurlement primitif | `hurlement-primitif` |
| 4 | Image de foudre | `image-de-foudre` |
| 4 | Immortalité | `immortalite` |
| 4 | Immunité contre les sorts | `immunite-contre-les-sorts` |
| 4 | Impasse égarée | `impasse-egaree` |
| 4 | Infestation de vers | `infestation-de-vers` |
| 4 | Infliger des souffrances de groupe | `infliger-des-souffrances-de-groupe` |
| 4 | Inhalation absorbante | `inhalation-absorbante` |
| 4 | Injonction suprême | `injonction-supreme` |
| 4 | Insinuation du ça III | `insinuation-du-ca-iii` |
| 4 | Instinct criminel | `instinct-criminel` |
| 4 | Interrogatoire supérieur | `interrogatoire-superieur` |
| 4 | Jet de flammes | `jet-de-flammes` |
| 4 | Juxtaposition hostile | `juxtaposition-hostile` |
| 4 | Lamentation du lâche | `lamentation-du-lache` |
| 4 | Le roi et la tour | `le-roi-et-la-tour` |
| 4 | Leurre | `leurre` |
| 4 | Lien avec l'invocateur | `lien-avec-l-invocateur` |
| 4 | Lien des esprits combatifs | `lien-des-esprits-combatifs` |
| 4 | Lien télépathique | `lien-telepathique` |
| 4 | Litanie de folie | `litanie-de-folie` |
| 4 | Litanie de tonnerre | `litanie-de-tonnerre` |
| 4 | Litanie de vengeance | `litanie-de-vengeance` |
| 4 | Lueur d'arc-en-ciel | `lueur-d-arc-en-ciel` |
| 4 | Lumière du jugement | `lumiere-du-jugement` |
| 4 | Main ectoplasmique | `main-ectoplasmique` |
| 4 | Malédiction du paria | `malediction-du-paria` |
| 4 | Malédiction du sommeil brûlant | `malediction-du-sommeil-brulant` |
| 4 | Malédiction du vieux loup de mer | `malediction-du-vieux-loup-de-mer` |
| 4 | Malédiction majeure | `malediction-majeure` |
| 4 | Manteau de guêpes | `manteau-de-guepes` |
| 4 | Marche dans les airs | `marche-dans-les-airs` |
| 4 | Marque de la justice | `marque-de-la-justice` |
| 4 | Marque du dieu reptile | `marque-du-dieu-reptile` |
| 4 | Marque noire | `marque-noire` |
| 4 | Marque supérieure | `marque-superieure` |
| 4 | Marteau arboricole | `marteau-arboricole` |
| 4 | Marteau du Mort | `marteau-du-mort` |
| 4 | Marteau du chaos | `marteau-du-chaos` |
| 4 | Maîtrise élémentaire | `maitrise-elementaire` |
| 4 | Menottes scellées | `menottes-scellees` |
| 4 | Miroir de déplacement | `miroir-de-deplacement` |
| 4 | Mixture pour bombe de vipère | `mixture-pour-bombe-de-vipere` |
| 4 | Modification de mémoire | `modification-de-memoire` |
| 4 | Mur de cécité/surdité | `mur-de-cecite-surdite` |
| 4 | Mur de son | `mur-de-son` |
| 4 | Mur illusoire | `mur-illusoire` |
| 4 | Mythes et légendes | `mythes-et-legendes` |
| 4 | Mémoire ancestrale | `memoire-ancestrale` |
| 4 | Mémorisation | `memorisation` |
| 4 | Métamorphe ajustable | `metamorphe-ajustable` |
| 4 | Métamorphose funeste | `metamorphose-funeste` |
| 4 | Nage dans la terre | `nage-dans-la-terre` |
| 4 | Nourrir la haine | `nourrir-la-haine` |
| 4 | Nuage de toile | `nuage-de-toile` |
| 4 | Nuée de papier | `nuee-de-papier` |
| 4 | Objet fantomatique mineur | `objet-fantomatique-mineur` |
| 4 | Ombre du doute | `ombre-du-doute` |
| 4 | Pacte avec la terre | `pacte-avec-la-terre` |
| 4 | Paix forcée suprême | `paix-forcee-supreme` |
| 4 | Parchemin de prévoyance | `parchemin-de-prevoyance` |
| 4 | Pas de l'ombre | `pas-de-l-ombre` |
| 4 | Peau de pierre (partagé) | `peau-de-pierre-partage` |
| 4 | Perception des pensées | `perception-des-pensees` |
| 4 | Physique monstrueux II | `physique-monstrueux-ii` |
| 4 | Pierre de suppression | `pierre-de-suppression` |
| 4 | Pierre divinatoire | `pierre-divinatoire` |
| 4 | Pierres acérées | `pierres-acerees` |
| 4 | Pistage infaillible | `pistage-infaillible` |
| 4 | Piéger un esprit | `pieger-un-esprit` |
| 4 | Pleine lune | `pleine-lune` |
| 4 | Poison écrasant | `poison-ecrasant` |
| 4 | Porte-peste | `porte-peste` |
| 4 | Possession | `possession` |
| 4 | Possession spirituelle d'objet | `possession-spirituelle-d-objet` |
| 4 | Poussière d'étoile | `poussiere-d-etoile` |
| 4 | Projection d'ombre | `projection-d-ombre` |
| 4 | Pronostic | `pronostic` |
| 4 | Protection contre la mort | `protection-contre-la-mort` |
| 4 | Protection contre les pièges | `protection-contre-les-pieges` |
| 4 | Présage débilitant | `presage-debilitant` |
| 4 | Prévoyance du mort | `prevoyance-du-mort` |
| 4 | Puissance divine | `puissance-divine` |
| 4 | Pulsation synaptique suprême | `pulsation-synaptique-supreme` |
| 4 | Pulsion de jalousie | `pulsion-de-jalousie` |
| 4 | Rappel de compagnon animal | `rappel-de-compagnon-animal` |
| 4 | Refuge du mage | `refuge-du-mage` |
| 4 | Regard du vide | `regard-du-vide` |
| 4 | Rejet de la Loi | `rejet-de-la-loi` |
| 4 | Rejet du Bien | `rejet-du-bien` |
| 4 | Rejet du Chaos | `rejet-du-chaos` |
| 4 | Rejet du Mal | `rejet-du-mal` |
| 4 | Renvoi | `renvoi` |
| 4 | Repentir forcé | `repentir-force` |
| 4 | Repos éternel | `repos-eternel` |
| 4 | Représentation de virtuose | `representation-de-virtuose` |
| 4 | Retenir la main | `retenir-la-main` |
| 4 | Rivière de vent | `riviere-de-vent` |
| 4 | Rouille | `rouille` |
| 4 | Ruse du renard de groupe | `ruse-du-renard-de-groupe` |
| 4 | Réapprovisionnement en ki | `reapprovisionnement-en-ki` |
| 4 | Réceptacle de l'oracle | `receptacle-de-l-oracle` |
| 4 | Réincarnation | `reincarnation` |
| 4 | Réparation rapide | `reparation-rapide` |
| 4 | Réprimande | `reprimande` |
| 4 | Réprobation | `reprobation` |
| 4 | Résistance à l'Affadissement | `resistance-a-l-affadissement` |
| 4 | Résistance à l'âge | `resistance-a-l-age` |
| 4 | Rêve vagabond | `reve-vagabond` |
| 4 | Sacrifice | `sacrifice` |
| 4 | Sagesse du hibou de groupe | `sagesse-du-hibou-de-groupe` |
| 4 | Sanctuaire secret | `sanctuaire-secret` |
| 4 | Sang caustique | `sang-caustique` |
| 4 | Sanglantes représailles | `sanglantes-represailles` |
| 4 | Sceau daémonique | `sceau-daemonique` |
| 4 | Sceau de protection contre les morts-vivants | `sceau-de-protection-contre-les-morts-vivants` |
| 4 | Sentier de la damnation | `sentier-de-la-damnation` |
| 4 | Sentier de la gloire suprême | `sentier-de-la-gloire-supreme` |
| 4 | Serment de paix | `serment-de-paix` |
| 4 | Serment de sacrifice | `serment-de-sacrifice` |
| 4 | Simulacre mineur | `simulacre-mineur` |
| 4 | Sommeil de l'amnésique | `sommeil-de-l-amnesique` |
| 4 | Somnambulisme | `somnambulisme` |
| 4 | Souffle de dragon | `souffle-de-dragon` |
| 4 | Sphère d'isolement | `sphere-d-isolement` |
| 4 | Sphère de feu suprême | `sphere-de-feu-supreme` |
| 4 | Sphère de force d'urgence | `sphere-de-force-d-urgence` |
| 4 | Splendeur de l'aigle de groupe | `splendeur-de-l-aigle-de-groupe` |
| 4 | Substitution d'énergie destructive | `substitution-d-energie-destructive` |
| 4 | Surcharge synaptique | `surcharge-synaptique` |
| 4 | Symbole de douleur | `symbole-de-douleur` |
| 4 | Symbole de persuasion | `symbole-de-persuasion` |
| 4 | Symbole de sceau | `symbole-de-sceau` |
| 4 | Symbole de scrutation | `symbole-de-scrutation` |
| 4 | Symbole de sommeil | `symbole-de-sommeil` |
| 4 | Symbole de terreur | `symbole-de-terreur` |
| 4 | Symbole fatal | `symbole-fatal` |
| 4 | Sérénité | `serenite` |
| 4 | Tempête volcanique | `tempete-volcanique` |
| 4 | Tranchant du croisé | `tranchant-du-croise` |
| 4 | Transfert de sorts | `transfert-de-sorts` |
| 4 | Transfert de vol | `transfert-de-vol` |
| 4 | Transformation | `transformation` |
| 4 | Transplantation faciale | `transplantation-faciale` |
| 4 | Traque spectrale | `traque-spectrale` |
| 4 | Traçage de téléportation | `tracage-de-teleportation` |
| 4 | Traîtrise illusoire suprême | `traitrise-illusoire-supreme` |
| 4 | Trinquer à la liberté | `trinquer-a-la-liberte` |
| 4 | Triple aspect | `triple-aspect` |
| 4 | Trouver la proie | `trouver-la-proie` |
| 4 | Télékinésie martiale | `telekinesie-martiale` |
| 4 | Téléportation factice | `teleportation-factice` |
| 4 | Ténèbres maudites | `tenebres-maudites` |
| 4 | Vague de criminalité | `vague-de-criminalite` |
| 4 | Venin conditionné | `venin-conditionne` |
| 4 | Vermine géante | `vermine-geante` |
| 4 | Vigueur persistante | `vigueur-persistante` |
| 4 | Violent nuage d'orage suprême | `violent-nuage-d-orage-supreme` |
| 4 | Vision dans le noir supérieure | `vision-dans-le-noir-superieure` |
| 4 | Vol d'arcane | `vol-d-arcane` |
| 4 | Vol de pouvoir | `vol-de-pouvoir` |
| 4 | Vol supérieur | `vol-superieur` |
| 4 | Voyage par les arbres | `voyage-par-les-arbres` |
| 4 | Vérité | `verite` |
| 4 | Zone de flammes instables | `zone-de-flammes-instables` |
| 4 | Zone de silence | `zone-de-silence` |
| 4 | Âme d'aigle | `ame-d-aigle` |
| 4 | Écholocalisation | `echolocalisation` |
| 4 | Éclat intenable | `eclat-intenable` |
| 4 | Éclats éthérés | `eclats-etheres` |
| 4 | Énergie négative | `energie-negative` |
| 4 | Épée impie | `epee-impie` |
| 4 | Épée sainte | `epee-sainte` |
| 4 | Équipage invisible | `equipage-invisible` |
| 4 | Étreinte du Monde féerique | `etreinte-du-monde-feerique` |
| 4 | Éveiller les dévorés | `eveiller-les-devores` |
| 4 | Évolution supérieure | `evolution-superieure` |
| 5 | Absorption de sort | `absorption-de-sort` |
| 5 | Allègement d'objet de groupe | `allegement-d-objet-de-groupe` |
| 5 | Anatomie morte-vivante II | `anatomie-morte-vivante-ii` |
| 5 | Appel cacophonique de groupe | `appel-cacophonique-de-groupe` |
| 5 | Appel de la tempête | `appel-de-la-tempete` |
| 5 | Arc électrique | `arc-electrique` |
| 5 | Arme destructrice | `arme-destructrice` |
| 5 | Armée du Roi goule | `armee-du-roi-goule` |
| 5 | Asile psychique | `asile-psychique` |
| 5 | Assimilation retardée | `assimilation-retardee` |
| 5 | Aura d'avidité | `aura-d-avidite` |
| 5 | Avancée offensive suprême | `avancee-offensive-supreme` |
| 5 | Bannissement | `bannissement` |
| 5 | Barde d'ombre | `barde-d-ombre` |
| 5 | Barrière mentale IV | `barriere-mentale-iv` |
| 5 | Blessure légère de groupe | `blessure-legere-de-groupe` |
| 5 | Bouclier d'ombre vampirique | `bouclier-d-ombre-vampirique` |
| 5 | Bouclier des pensées IV | `bouclier-des-pensees-iv` |
| 5 | Bouclier involontaire | `bouclier-involontaire` |
| 5 | Broyage psychique I | `broyage-psychique-i` |
| 5 | Brume mentale | `brume-mentale` |
| 5 | Brume mortelle | `brume-mortelle` |
| 5 | Bâton serpent | `baton-serpent` |
| 5 | Bénédiction du chasseur | `benediction-du-chasseur` |
| 5 | Champ de force | `champ-de-force` |
| 5 | Chant assourdissant | `chant-assourdissant` |
| 5 | Chant de discorde | `chant-de-discorde` |
| 5 | Chaînes intangibles | `chaines-intangibles` |
| 5 | Chirurgie psychique | `chirurgie-psychique` |
| 5 | Coffre secret | `coffre-secret` |
| 5 | Contagion supérieure | `contagion-superieure` |
| 5 | Contrat intermédiaire | `contrat-intermediaire` |
| 5 | Contrôle des vents | `controle-des-vents` |
| 5 | Convocation d'alliés naturels V | `convocation-d-allies-naturels-v` |
| 5 | Convocation d'hôte infernal | `convocation-d-hote-infernal` |
| 5 | Convocation de kamis | `convocation-de-kamis` |
| 5 | Convocation de pudding noir | `convocation-de-pudding-noir` |
| 5 | Corps d'ombre | `corps-d-ombre` |
| 5 | Corps élémentaire II | `corps-elementaire-ii` |
| 5 | Corrosion | `corrosion` |
| 5 | Coup mental V | `coup-mental-v` |
| 5 | Creuser un passage | `creuser-un-passage` |
| 5 | Cri ki | `cri-ki` |
| 5 | Création de demi-plan mineure | `creation-de-demi-plan-mineure` |
| 5 | Dard vengeur | `dard-vengeur` |
| 5 | Dissimulation suprême | `dissimulation-supreme` |
| 5 | Don de maléfice | `don-de-malefice` |
| 5 | Double illusoire | `double-illusoire` |
| 5 | Déclaration | `declaration` |
| 5 | Engeance de génie | `engeance-de-genie` |
| 5 | Ennemi amical | `ennemi-amical` |
| 5 | Enveloppement éthéré | `enveloppement-ethere` |
| 5 | Extase | `extase` |
| 5 | Extraction du demi-sang | `extraction-du-demi-sang` |
| 5 | Final étourdissant | `final-etourdissant` |
| 5 | Force du colosse | `force-du-colosse` |
| 5 | Forme de poussière | `forme-de-poussiere` |
| 5 | Forme de vase I | `forme-de-vase-i` |
| 5 | Forme végétale I | `forme-vegetale-i` |
| 5 | Forteresse intellectuelle II | `forteresse-intellectuelle-ii` |
| 5 | Fosse affamée | `fosse-affamee` |
| 5 | Fouet d'ego III | `fouet-d-ego-iii` |
| 5 | Fouet de l'astradaémon | `fouet-de-l-astradaemon` |
| 5 | Fouet de mille-pattes | `fouet-de-mille-pattes` |
| 5 | Fuite du barde | `fuite-du-barde` |
| 5 | Fustiger de groupe | `fustiger-de-groupe` |
| 5 | Glace bénie | `glace-benie` |
| 5 | Glace maudite | `glace-maudite` |
| 5 | Glyphe de maléfice suprême | `glyphe-de-malefice-supreme` |
| 5 | Gorgée de poison | `gorgee-de-poison` |
| 5 | Grâce défensive | `grace-defensive` |
| 5 | Guérison des morts-vivants de groupe | `guerison-des-morts-vivants-de-groupe` |
| 5 | Immunité contre les sorts (partagé) | `immunite-contre-les-sorts-partage` |
| 5 | Insinuation du ça IV | `insinuation-du-ca-iv` |
| 5 | Jet d'acide | `jet-d-acide` |
| 5 | Lames de vent | `lames-de-vent` |
| 5 | Lien de vie supérieur | `lien-de-vie-superieur` |
| 5 | Légende substantielle | `legende-substantielle` |
| 5 | Magie des ombres | `magie-des-ombres` |
| 5 | Main interposée | `main-interposee` |
| 5 | Manteau de rêves | `manteau-de-reves` |
| 5 | Manteau des guerriers magiques | `manteau-des-guerriers-magiques` |
| 5 | Marche dans les airs (partagé) | `marche-dans-les-airs-partage` |
| 5 | Marteau de réparation | `marteau-de-reparation` |
| 5 | Membre fantôme | `membre-fantome` |
| 5 | Mixture pour bombe languide | `mixture-pour-bombe-languide` |
| 5 | Mort rampante | `mort-rampante` |
| 5 | Mur de fer | `mur-de-fer` |
| 5 | Mur ectoplasmique | `mur-ectoplasmique` |
| 5 | Musique des sphères | `musique-des-spheres` |
| 5 | Nappe de goudron | `nappe-de-goudron` |
| 5 | Note pétrifiante | `note-petrifiante` |
| 5 | Objet fantomatique majeur | `objet-fantomatique-majeur` |
| 5 | Pacte de mort | `pacte-de-mort` |
| 5 | Parole résonnante | `parole-resonnante` |
| 5 | Physique monstrueux III | `physique-monstrueux-iii` |
| 5 | Pilier de vie | `pilier-de-vie` |
| 5 | Possession d'objet | `possession-d-objet` |
| 5 | Possession spirituelle d'objet suprême | `possession-spirituelle-d-objet-supreme` |
| 5 | Poursuite divine | `poursuite-divine` |
| 5 | Prison de glace | `prison-de-glace` |
| 5 | Projection astrale mineure | `projection-astrale-mineure` |
| 5 | Protection contre la mort-vivance | `protection-contre-la-mort-vivance` |
| 5 | Purification | `purification` |
| 5 | Pénitence | `penitence` |
| 5 | Quête | `quete` |
| 5 | Refouler un souvenir | `refouler-un-souvenir` |
| 5 | Rendre un jugement supérieur | `rendre-un-jugement-superieur` |
| 5 | Repos revigorant | `repos-revigorant` |
| 5 | Réalité subjective | `realite-subjective` |
| 5 | Régression primale | `regression-primale` |
| 5 | Régénération d'eidolon supérieure | `regeneration-d-eidolon-superieure` |
| 5 | Résistance à l'âge supérieure | `resistance-a-l-age-superieure` |
| 5 | Sanctification | `sanctification` |
| 5 | Sanctification maléfique | `sanctification-malefique` |
| 5 | Serpent de feu | `serpent-de-feu` |
| 5 | Simulacre | `simulacre` |
| 5 | Siphon magique | `siphon-magique` |
| 5 | Suffocation | `suffocation` |
| 5 | Symbole d'étourdissement | `symbole-d-etourdissement` |
| 5 | Symbole de faiblesse | `symbole-de-faiblesse` |
| 5 | Synesthésie de groupe | `synesthesie-de-groupe` |
| 5 | Tapisserie de fables | `tapisserie-de-fables` |
| 5 | Terre affamée | `terre-affamee` |
| 5 | Tir d'énergie à l'arme de siège | `tir-d-energie-a-l-arme-de-siege` |
| 5 | Toile fantasmagorique | `toile-fantasmagorique` |
| 5 | Tornade de sable suprême | `tornade-de-sable-supreme` |
| 5 | Tour de volonté de fer I | `tour-de-volonte-de-fer-i` |
| 5 | Transfert d'affliction | `transfert-d-affliction` |
| 5 | Transformation résurgente | `transformation-resurgente` |
| 5 | Transmission d'esprit | `transmission-d-esprit` |
| 5 | Transmutation de la boue en pierre | `transmutation-de-la-boue-en-pierre` |
| 5 | Traversée des ombres | `traversee-des-ombres` |
| 5 | Téléportation par cristal de glace | `teleportation-par-cristal-de-glace` |
| 5 | Tête explosive | `tete-explosive` |
| 5 | Vagues de fatigue | `vagues-de-fatigue` |
| 5 | Vengeance pour outrage | `vengeance-pour-outrage` |
| 5 | Village voilé | `village-voile` |
| 5 | Vol de sort | `vol-de-sort` |
| 5 | Zèle inébranlable | `zele-inebranlable` |
| 5 | Échapper au temps | `echapper-au-temps` |
| 5 | Épidémie de rumeurs | `epidemie-de-rumeurs` |
| 5 | Éveil | `eveil` |
| 5 | Éveil de créature artificielle | `eveil-de-creature-artificielle` |
| 5 | Œil indiscret | `oeil-indiscret` |
| 6 | Adaptation planaire de groupe | `adaptation-planaire-de-groupe` |
| 6 | Aire de l'aigle | `aire-de-l-aigle` |
| 6 | Aliénation mentale | `alienation-mentale` |
| 6 | Allié majeur d'outreplan | `allie-majeur-d-outreplan` |
| 6 | Analyse d'enchantement | `analyse-d-enchantement` |
| 6 | Anatomie morte-vivante III | `anatomie-morte-vivante-iii` |
| 6 | Animation d'objets | `animation-d-objets` |
| 6 | Annihilation de mort-vivant | `annihilation-de-mort-vivant` |
| 6 | Appel de créature artificielle | `appel-de-creature-artificielle` |
| 6 | Arc-en-ciel embrasé | `arc-en-ciel-embrase` |
| 6 | Attirance | `attirance` |
| 6 | Attraction féérique majeure | `attraction-feerique-majeure` |
| 6 | Aura de mise à mort suprême | `aura-de-mise-a-mort-supreme` |
| 6 | Aversion | `aversion` |
| 6 | Barrière de lames | `barriere-de-lames` |
| 6 | Barrière mentale V | `barriere-mentale-v` |
| 6 | Blasphème | `blaspheme` |
| 6 | Blessure modérée de groupe | `blessure-moderee-de-groupe` |
| 6 | Bois de fer | `bois-de-fer` |
| 6 | Bond dimensionnel | `bond-dimensionnel` |
| 6 | Bouclier de la Fleur de l'Aube suprême | `bouclier-de-la-fleur-de-l-aube-supreme` |
| 6 | Bouclier des pensées V | `bouclier-des-pensees-v` |
| 6 | Brise-magie | `brise-magie` |
| 6 | Broyage psychique II | `broyage-psychique-ii` |
| 6 | Brume acide | `brume-acide` |
| 6 | Bâton à sort | `baton-a-sort` |
| 6 | Carillon d'amplification | `carillon-d-amplification` |
| 6 | Cercle de mort | `cercle-de-mort` |
| 6 | Cercle de téléportation | `cercle-de-teleportation` |
| 6 | Charme-monstre de groupe | `charme-monstre-de-groupe` |
| 6 | Chaînes de feu | `chaines-de-feu` |
| 6 | Chêne animé | `chene-anime` |
| 6 | Complainte des chevaliers victorieux | `complainte-des-chevaliers-victorieux` |
| 6 | Conduit étrange suprême | `conduit-etrange-supreme` |
| 6 | Contrat suprême | `contrat-supreme` |
| 6 | Contrôle de créature artificielle | `controle-de-creature-artificielle` |
| 6 | Convocation d'alliés géants I | `convocation-d-allies-geants-i` |
| 6 | Convocation d'alliés naturels VI | `convocation-d-allies-naturels-vi` |
| 6 | Convocation d'érodaémon | `convocation-d-erodaemon` |
| 6 | Convocation de méladaémon | `convocation-de-meladaemon` |
| 6 | Coquille antivie | `coquille-antivie` |
| 6 | Corps élémentaire III | `corps-elementaire-iii` |
| 6 | Coup mental VI | `coup-mental-vi` |
| 6 | Cri suprême | `cri-supreme` |
| 6 | Création de demi-plan | `creation-de-demi-plan` |
| 6 | Création de paysage mental suprême | `creation-de-paysage-mental-supreme` |
| 6 | Damnation de la mémoire | `damnation-de-la-memoire` |
| 6 | Dangereux final | `dangereux-final` |
| 6 | Danse des mille coupures | `danse-des-mille-coupures` |
| 6 | Danse irrésistible | `danse-irresistible` |
| 6 | Domination universelle | `domination-universelle` |
| 6 | Décret | `decret` |
| 6 | Dédale | `dedale` |
| 6 | Défense magique | `defense-magique` |
| 6 | Emprunt temporel | `emprunt-temporel` |
| 6 | Ennemi contondant | `ennemi-contondant` |
| 6 | Entrave | `entrave` |
| 6 | Entrave de terre de groupe | `entrave-de-terre-de-groupe` |
| 6 | Exigence | `exigence` |
| 6 | Flamme contagieuse | `flamme-contagieuse` |
| 6 | Forme de géant I | `forme-de-geant-i` |
| 6 | Forme de vase II | `forme-de-vase-ii` |
| 6 | Forme draconique I | `forme-draconique-i` |
| 6 | Forme sonique | `forme-sonique` |
| 6 | Forme végétale II | `forme-vegetale-ii` |
| 6 | Forteresse intellectuelle III | `forteresse-intellectuelle-iii` |
| 6 | Fouet d'ego IV | `fouet-d-ego-iv` |
| 6 | Fouet de fourmis | `fouet-de-fourmis` |
| 6 | Froide frappe de glace | `froide-frappe-de-glace` |
| 6 | Germes de feu | `germes-de-feu` |
| 6 | Glissement de terrain | `glissement-de-terrain` |
| 6 | Glyphe de garde suprême | `glyphe-de-garde-supreme` |
| 6 | Hallucination programmée | `hallucination-programmee` |
| 6 | Héroïsme insipide suprême | `heroisme-insipide-supreme` |
| 6 | Immobilisation de personne de groupe | `immobilisation-de-personne-de-groupe` |
| 6 | Insectes espions suprême | `insectes-espions-supreme` |
| 6 | Inspiration brillante | `inspiration-brillante` |
| 6 | Interdiction | `interdiction` |
| 6 | Interdiction du fou | `interdiction-du-fou` |
| 6 | Joueur de flûte | `joueur-de-flute` |
| 6 | Jumeau | `jumeau` |
| 6 | Juxtaposition hostile supérieure | `juxtaposition-hostile-superieure` |
| 6 | Leurre suprême | `leurre-supreme` |
| 6 | Localisation suprême | `localisation-supreme` |
| 6 | Main impérieuse | `main-imperieuse` |
| 6 | Manteau de doutes | `manteau-de-doutes` |
| 6 | Mauvais œil | `mauvais-oeil` |
| 6 | Message suggestif de groupe | `message-suggestif-de-groupe` |
| 6 | Mise à mal | `mise-a-mal` |
| 6 | Mixture pour bombe d'emprisonnement | `mixture-pour-bombe-d-emprisonnement` |
| 6 | Mordre la main de son maître de groupe | `mordre-la-main-de-son-maitre-de-groupe` |
| 6 | Mot de rappel | `mot-de-rappel` |
| 6 | Nuage incendiaire | `nuage-incendiaire` |
| 6 | Orientation | `orientation` |
| 6 | Parole du Chaos | `parole-du-chaos` |
| 6 | Parole sacrée | `parole-sacree` |
| 6 | Peau de nuée | `peau-de-nuee` |
| 6 | Physique monstrueux IV | `physique-monstrueux-iv` |
| 6 | Pierres commères | `pierres-commeres` |
| 6 | Porteur de peste | `porteur-de-peste` |
| 6 | Possession spirituelle suprême | `possession-spirituelle-supreme` |
| 6 | Poudre d'escampette | `poudre-d-escampette` |
| 6 | Projection d'image | `projection-d-image` |
| 6 | Protection contre les sorts | `protection-contre-les-sorts` |
| 6 | Présence écrasante | `presence-ecrasante` |
| 6 | Prévoyance | `prevoyance` |
| 6 | Purulence de groupe | `purulence-de-groupe` |
| 6 | Pétrification | `petrification` |
| 6 | Rayon de feu infernal | `rayon-de-feu-infernal` |
| 6 | Remémoration | `rememoration` |
| 6 | Réincarnation d'espion | `reincarnation-d-espion` |
| 6 | Résonance | `resonance` |
| 6 | Résurrection temporaire | `resurrection-temporaire` |
| 6 | Saluqi spectral | `saluqi-spectral` |
| 6 | Sceau de poussière | `sceau-de-poussiere` |
| 6 | Sirocco | `sirocco` |
| 6 | Souffle de la banshie | `souffle-de-la-banshie` |
| 6 | Sphère glaciale | `sphere-glaciale` |
| 6 | Statue | `statue` |
| 6 | Symbole d'aliénation mentale | `symbole-d-alienation-mentale` |
| 6 | Symbole de débauche | `symbole-de-debauche` |
| 6 | Symbole de lutte | `symbole-de-lutte` |
| 6 | Symbole de vulnérabilité | `symbole-de-vulnerabilite` |
| 6 | Tempête de peste | `tempete-de-peste` |
| 6 | Terraformation | `terraformation` |
| 6 | Tir d'énergie à l'arme de siège supérieur | `tir-d-energie-a-l-arme-de-siege-superieur` |
| 6 | Tour de volonté de fer II | `tour-de-volonte-de-fer-ii` |
| 6 | Tranquillité euphorique | `tranquillite-euphorique` |
| 6 | Transfert d'âme | `transfert-d-ame` |
| 6 | Transformation martiale | `transformation-martiale` |
| 6 | Transmutation de la pierre en chair | `transmutation-de-la-pierre-en-chair` |
| 6 | Traverser l'espace | `traverser-l-espace` |
| 6 | Traversée onirique | `traversee-onirique` |
| 6 | Téléportation perfide | `teleportation-perfide` |
| 6 | Vagues d'extase | `vagues-d-extase` |
| 6 | Vagues d'épuisement | `vagues-d-epuisement` |
| 6 | Vengeance fantasmagorique | `vengeance-fantasmagorique` |
| 6 | Vent divin | `vent-divin` |
| 6 | Verrou dimensionnel | `verrou-dimensionnel` |
| 6 | Vie scellée suprême | `vie-scellee-supreme` |
| 6 | Vision de folie | `vision-de-folie` |
| 6 | Voie des vents | `voie-des-vents` |
| 6 | Voie végétale | `voie-vegetale` |
| 6 | Voile | `voile` |
| 6 | Échec annoncé | `echec-annonce` |
| 6 | Éloignement du bois | `eloignement-du-bois` |
| 6 | Épidémie | `epidemie` |
| 6 | Éruption ectoplasmique | `eruption-ectoplasmique` |
| 7 | Animation des plantes | `animation-des-plantes` |
| 7 | Anneau de repli féérique | `anneau-de-repli-feerique` |
| 7 | Arbres de siège | `arbres-de-siege` |
| 7 | Blessure grave de groupe | `blessure-grave-de-groupe` |
| 7 | Bombardement élémentaire | `bombardement-elementaire` |
| 7 | Brandon | `brandon` |
| 7 | Broyage psychique III | `broyage-psychique-iii` |
| 7 | Bâton sylvanien | `baton-sylvanien` |
| 7 | Cage de force | `cage-de-force` |
| 7 | Canon arcanique | `canon-arcanique` |
| 7 | Cercle de clarté | `cercle-de-clarte` |
| 7 | Cinglement magique | `cinglement-magique` |
| 7 | Contrôle des morts-vivants | `controle-des-morts-vivants` |
| 7 | Contrôle du climat | `controle-du-climat` |
| 7 | Convocation d'alliés géants II | `convocation-d-allies-geants-ii` |
| 7 | Convocation d'alliés naturels VII | `convocation-d-allies-naturels-vii` |
| 7 | Convocation d'ombres suprême | `convocation-d-ombres-supreme` |
| 7 | Corps de glace | `corps-de-glace` |
| 7 | Corps élémentaire IV | `corps-elementaire-iv` |
| 7 | Destruction | `destruction` |
| 7 | Double du familier | `double-du-familier` |
| 7 | Dépense | `depense` |
| 7 | Déviation | `deviation` |
| 7 | Esprit impénétrable | `esprit-impenetrable` |
| 7 | Forme de vase III | `forme-de-vase-iii` |
| 7 | Forme draconique II | `forme-draconique-ii` |
| 7 | Forme végétale III | `forme-vegetale-iii` |
| 7 | Fouet d'ego V | `fouet-d-ego-v` |
| 7 | Hallucination permanente | `hallucination-permanente` |
| 7 | Inversion de la gravité | `inversion-de-la-gravite` |
| 7 | Invocation instantanée | `invocation-instantanee` |
| 7 | Manoir somptueux | `manoir-somptueux` |
| 7 | Métamorphose suprême | `metamorphose-supreme` |
| 7 | Oubliette aliénante | `oubliette-alienante` |
| 7 | Piège de téléportation | `piege-de-teleportation` |
| 7 | Poigne agrippeuse | `poigne-agrippeuse` |
| 7 | Porte de phase | `porte-de-phase` |
| 7 | Présage traumatisant | `presage-traumatisant` |
| 7 | Rassemblement du signifer | `rassemblement-du-signifer` |
| 7 | Rayon de soleil | `rayon-de-soleil` |
| 7 | Rayons prismatiques | `rayons-prismatiques` |
| 7 | Refuge | `refuge` |
| 7 | Rempart | `rempart` |
| 7 | Résurrection | `resurrection` |
| 7 | Résurrection factice | `resurrection-factice` |
| 7 | Sphère téléguidée | `sphere-teleguidee` |
| 7 | Tempête de feu | `tempete-de-feu` |
| 7 | Tour de volonté de fer III | `tour-de-volonte-de-fer-iii` |
| 7 | Transmutation du métal en bois | `transmutation-du-metal-en-bois` |
| 7 | Tâche noire | `tache-noire` |
| 7 | Téléportation d'objet | `teleportation-d-objet` |
| 7 | Ténèbres voraces | `tenebres-voraces` |
| 7 | Vents cinglants | `vents-cinglants` |
| 7 | Vision magique suprême | `vision-magique-supreme` |
| 7 | Vision mystique | `vision-mystique` |
| 7 | Voile lunaire | `voile-lunaire` |
| 7 | Vortex | `vortex` |
| 7 | Épée de force | `epee-de-force` |
| 7 | Éruption caustique | `eruption-caustique` |
| 8 | Absorption de sort suprême | `absorption-de-sort-supreme` |
| 8 | Anatomie morte-vivante IV | `anatomie-morte-vivante-iv` |
| 8 | Animation suspendue | `animation-suspendue` |
| 8 | Aspect terrifiant | `aspect-terrifiant` |
| 8 | Atavisme de groupe | `atavisme-de-groupe` |
| 8 | Aura maudite | `aura-maudite` |
| 8 | Aura sacrée | `aura-sacree` |
| 8 | Bilocation | `bilocation` |
| 8 | Blessure critique de groupe | `blessure-critique-de-groupe` |
| 8 | Bouclier de la Loi | `bouclier-de-la-loi` |
| 8 | Brise-magie suprême | `brise-magie-supreme` |
| 8 | Broyage psychique IV | `broyage-psychique-iv` |
| 8 | Brume sanglante | `brume-sanglante` |
| 8 | Cicatrice magique | `cicatrice-magique` |
| 8 | Clone | `clone` |
| 8 | Contrôle des plantes | `controle-des-plantes` |
| 8 | Convocation d'alliés géants III | `convocation-d-allies-geants-iii` |
| 8 | Convocation d'alliés naturels VIII | `convocation-d-allies-naturels-viii` |
| 8 | Crevasse dévastatrice | `crevasse-devastatrice` |
| 8 | Création de mort-vivant dominant | `creation-de-mort-vivant-dominant` |
| 8 | Cyclone | `cyclone` |
| 8 | Esprit impénétrable (partagé) | `esprit-impenetrable-partage` |
| 8 | Explosion de lumière | `explosion-de-lumiere` |
| 8 | Flétrissure | `fletrissure` |
| 8 | Forme de géant II | `forme-de-geant-ii` |
| 8 | Forme draconique III | `forme-draconique-iii` |
| 8 | Immunité contre les sorts suprême | `immunite-contre-les-sorts-supreme` |
| 8 | Invocation instantanée suprême | `invocation-instantanee-supreme` |
| 8 | Légion de la tombe | `legion-de-la-tombe` |
| 8 | Magie des ombres suprême | `magie-des-ombres-supreme` |
| 8 | Manteau du Chaos | `manteau-du-chaos` |
| 8 | Manteau marin | `manteau-marin` |
| 8 | Moment de prescience | `moment-de-prescience` |
| 8 | Motif scintillant | `motif-scintillant` |
| 8 | Mur de lave | `mur-de-lave` |
| 8 | Mur prismatique | `mur-prismatique` |
| 8 | Métamorphose animale | `metamorphose-animale` |
| 8 | Métamorphose universelle | `metamorphose-universelle` |
| 8 | Neuf vies | `neuf-vies` |
| 8 | Nuées d'orage | `nuees-d-orage` |
| 8 | Orbe du néant | `orbe-du-neant` |
| 8 | Passage dans l'éther | `passage-dans-l-ether` |
| 8 | Poing serré | `poing-serre` |
| 8 | Pronostic suprême | `pronostic-supreme` |
| 8 | Ravageur d'âme | `ravageur-d-ame` |
| 8 | Rayon polaire | `rayon-polaire` |
| 8 | Réceptacle divin | `receptacle-divin` |
| 8 | Symbole de dissipation | `symbole-de-dissipation` |
| 8 | Séquestration | `sequestration` |
| 8 | Tour de volonté de fer IV | `tour-de-volonte-de-fer-iv` |
| 8 | Tremblement de terre | `tremblement-de-terre` |
| 8 | Écran | `ecran` |
| 8 | Éloignement du métal et de la pierre | `eloignement-du-metal-et-de-la-pierre` |
| 8 | Œil indiscret suprême | `oeil-indiscret-supreme` |
| 9 | Antimagie du Dieu défunt | `antimagie-du-dieu-defunt` |
| 9 | Appel de rejeton | `appel-de-rejeton` |
| 9 | Arbres de siège supérieur | `arbres-de-siege-superieur` |
| 9 | Arrêt du temps | `arret-du-temps` |
| 9 | Ascension | `ascension` |
| 9 | Attraction féérique suprême | `attraction-feerique-supreme` |
| 9 | Broyage psychique V | `broyage-psychique-v` |
| 9 | Capture d'âme | `capture-d-ame` |
| 9 | Changement de forme | `changement-de-forme` |
| 9 | Chevaucher la foudre | `chevaucher-la-foudre` |
| 9 | Conversion canope | `conversion-canope` |
| 9 | Convocation d'alliés naturels IX | `convocation-d-allies-naturels-ix` |
| 9 | Convocation de derghodaémon | `convocation-de-derghodaemon` |
| 9 | Convocation de froghémoth | `convocation-de-froghemoth` |
| 9 | Convocation de thanadaémon | `convocation-de-thanadaemon` |
| 9 | Convocation de ver vénérable | `convocation-de-ver-venerable` |
| 9 | Corps enflammé | `corps-enflamme` |
| 9 | Création de demi-plan supérieure | `creation-de-demi-plan-superieure` |
| 9 | Disjonction | `disjonction` |
| 9 | Diviser l'esprit | `diviser-l-esprit` |
| 9 | Délivrance | `delivrance` |
| 9 | Emprisonnement | `emprisonnement` |
| 9 | Enceinte parfaite du mercenaire | `enceinte-parfaite-du-mercenaire` |
| 9 | Ennemi subconscient | `ennemi-subconscient` |
| 9 | Fléau des cavaliers | `fleau-des-cavaliers` |
| 9 | Forme akashique | `forme-akashique` |
| 9 | Grand tertre | `grand-tertre` |
| 9 | Guérison suprême de groupe | `guerison-supreme-de-groupe` |
| 9 | Heurt de pierres | `heurt-de-pierres` |
| 9 | Image psychique | `image-psychique` |
| 9 | Immobilisation de monstre de groupe | `immobilisation-de-monstre-de-groupe` |
| 9 | Immunité contre les sorts suprême (partagé) | `immunite-contre-les-sorts-supreme-partage` |
| 9 | Implosion | `implosion` |
| 9 | Invocation héroïque | `invocation-heroique` |
| 9 | Localité égarée | `localite-egaree` |
| 9 | Main broyeuse | `main-broyeuse` |
| 9 | Manoir resplendissant | `manoir-resplendissant` |
| 9 | Microcosme | `microcosme` |
| 9 | Miracle | `miracle` |
| 9 | Mur de suppression | `mur-de-suppression` |
| 9 | Nuit polaire | `nuit-polaire` |
| 9 | Nuée d'élémentaires | `nuee-d-elementaires` |
| 9 | Phalange de bois | `phalange-de-bois` |
| 9 | Plainte d'outre-tombe | `plainte-d-outre-tombe` |
| 9 | Portail | `portail` |
| 9 | Prison de glace de groupe | `prison-de-glace-de-groupe` |
| 9 | Projection astrale | `projection-astrale` |
| 9 | Prémonition | `premonition` |
| 9 | Reflets d'ombre | `reflets-d-ombre` |
| 9 | Récupération | `recuperation` |
| 9 | Résurrection factice suprême | `resurrection-factice-supreme` |
| 9 | Sphère prismatique | `sphere-prismatique` |
| 9 | Suffocation de groupe | `suffocation-de-groupe` |
| 9 | Tempête télékinétique | `tempete-telekinetique` |
| 9 | Tempête vengeresse | `tempete-vengeresse` |
| 9 | Terre maudite | `terre-maudite` |
| 9 | Tour de volonté de fer V | `tour-de-volonte-de-fer-v` |
| 9 | Transmutation du sang en acide | `transmutation-du-sang-en-acide` |
| 9 | Tsunami | `tsunami` |
| 9 | Téléportation interplanétaire | `teleportation-interplanetaire` |
| 9 | Vague mondiale | `vague-mondiale` |
| 9 | Vents de la vengeance | `vents-de-la-vengeance` |
| 9 | Voyage onirique | `voyage-onirique` |
| 9 | Âme parasite | `ame-parasite` |
| 9 | Échange d'esprits majeur | `echange-d-esprits-majeur` |
