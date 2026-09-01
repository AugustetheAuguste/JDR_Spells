/* Explorateur de dons — composant de rendu autonome.
 *
 * Consomme tel quel le JSON produit par `scripts/exporter_arbre_dons.py`, sans
 * rien y ajouter côté Python : c'est ce fichier, et lui seul, qui porte la mise
 * en forme. Il s'embarque dans n'importe quelle page (aucun framework) ; seule
 * la vue « arbre » a besoin de Cytoscape et cytoscape-dagre, et elle se désactive
 * proprement s'ils sont absents.
 *
 *   ExplorateurDons.rendre(document.querySelector('#explorateur'), donnees)
 *
 * Il remplace l'ancien `arbre_dons.js`, qui faisait du graphe l'entrée unique.
 * C'était le mauvais ordre : un graphe répond à « d'où vient ce don », alors
 * qu'un joueur cherche d'abord « quels dons me donnent un bonus aux dégâts pour
 * deux emplacements ». La navigation à facettes est donc la vue par défaut et
 * l'arbre n'en est plus qu'une des trois.
 *
 * Trois partis pris de lisibilité :
 *
 *  - **Une facette ne propose jamais une option qui ne mène à rien.** Chaque
 *    option porte le nombre de dons qu'elle donnerait *compte tenu des autres
 *    facettes déjà posées*, et disparaît quand ce nombre tombe à zéro. Sans ça,
 *    une liste de 18 effets dont 14 sont vides est un piège à clics.
 *  - À l'intérieur d'une facette les choix s'additionnent (OU), entre facettes
 *    ils se cumulent (ET). C'est la convention de tous les navigateurs à
 *    facettes, et la seule qui rende le compte affiché prévisible.
 *  - Les dons **isolés** (ni prérequis, ni prérequis de rien) sont exclus du
 *    graphe mais pas de la liste : sans arête ils ne forment qu'un nuage de
 *    points dans le premier, alors qu'ils sont des candidats comme les autres
 *    dans la seconde.
 */

(function (global) {
  "use strict";

  var COUTS_MAX = 5;
  // En dessous, une étiquette de 11px n'est plus lisible.
  var ZOOM_LISIBLE = 0.8;
  // Une voie de une ou deux entrées n'est pas une famille de dons, c'est un
  // reste de découpage : ~30 d'entre elles noieraient le menu des vraies voies.
  var VOIE_MINIMALE = 3;

  /* Libellés français des vocabulaires fermés produits par
   * `scrappers/tag_feat_semantics.py`. Les clés restent les identifiants stables
   * du JSON ; seul l'affichage est traduit ici, ce qui garde le contrat de
   * données indépendant de la langue de l'interface. */
  var LIBELLES = {
    effet_principal: {
      bonus_chiffre: "Bonus chiffré",
      nouvelle_action: "Nouvelle action",
      manoeuvre: "Manœuvre de combat",
      defense: "Défense",
      mobilite: "Mobilité",
      economie_action: "Économie d'action",
      ressource: "Ressource / usages",
      magie_amelioree: "Magie améliorée",
      magie_nouvelle: "Magie nouvelle",
      creation: "Création d'objet",
      competence: "Compétences",
      social: "Social",
      compagnon: "Compagnon / monture",
      soin: "Soins",
      debuff: "Affaiblir l'adversaire",
      equipe: "Travail d'équipe",
      prerequis_assoupli: "Prérequis assoupli",
      meta_don: "Méta-don",
    },
    cible_du_bonus: {
      jet_attaque: "Jet d'attaque",
      degats: "Dégâts",
      CA: "CA",
      jets_de_sauvegarde: "Jets de sauvegarde",
      initiative: "Initiative",
      competence: "Compétence",
      DD_des_sorts: "DD des sorts",
      NLS: "NLS",
      PV: "Points de vie",
      vitesse: "Vitesse",
      DMD: "DMD (défense de manœuvre)",
      DMO: "DMO (offense de manœuvre)",
      confirmation_critique: "Confirmation de critique",
    },
    contexte: {
      melee: "Mêlée",
      distance: "À distance",
      lancer_de_sorts: "Lancer de sorts",
      exploration: "Exploration",
      social: "Social",
      furtivite: "Furtivité",
      monture: "Monté",
      aquatique_ou_aerien: "Aquatique ou aérien",
      hors_combat: "Hors combat",
    },
    activation: {
      passif: "Passif",
      reaction: "Réaction",
      actif_illimite: "Actif, illimité",
      actif_limite: "Actif, usages limités",
      long: "Hors combat (long)",
    },
    polyvalence: {
      polyvalent: "Polyvalent",
      conditionnel: "Conditionnel",
      niche: "De niche",
    },
    categorie_officielle: {
      combat: "Combat",
      metamagie: "Métamagie",
      creation_objet: "Création d'objet",
      heritage: "Héritage",
      monstre: "Monstre",
      spectacle: "Spectacle",
      style: "Style",
      troupe: "Troupe",
      mythique: "Mythique",
      aucune: "Aucune",
    },
    statut: {
      eligible: "Éligible sans réserve",
      manual_check: "À vérifier à la main",
      acquis: "Déjà pris",
    },
  };

  function libelle(facette, valeur) {
    var table = LIBELLES[facette] || {};
    return table[valeur] || valeur;
  }

  /* Facettes déclarées une fois : le reste du fichier (construction des
   * contrôles, filtrage, comptage, réinitialisation) en est dérivé. Ajouter une
   * facette = ajouter une ligne ici, et rien d'autre. `liste: true` désigne les
   * champs multivalués du JSON. */
  var FACETTES = [
    { cle: "effet_principal", titre: "Ce que le don donne", semantique: true },
    { cle: "cible_du_bonus", titre: "Bonus portant sur", liste: true, semantique: true },
    { cle: "contexte", titre: "Contexte d'usage", liste: true, semantique: true },
    { cle: "activation", titre: "Activation", semantique: true },
    { cle: "polyvalence", titre: "Polyvalence", semantique: true },
    // `liste` est obligatoire ici : un don peut porter deux catégories
    // (« combat, spectacle »). L'oublier faisait compter le tableau entier comme
    // une valeur unique, donc une option annoncée à 249 qui n'en filtrait aucun.
    {
      cle: "categorie_officielle",
      titre: "Catégorie officielle",
      liste: true,
      semantique: true,
    },
    { cle: "statut", titre: "Statut" },
  ];

  function el(balise, classe, texte) {
    var n = document.createElement(balise);
    if (classe) n.className = classe;
    if (texte != null) n.textContent = texte;
    return n;
  }

  /* `new Option(...)` n'existe que dans un navigateur : on passe par
   * createElement, ce qui rend le composant testable hors navigateur. */
  function optionSelect(texte, valeur) {
    var o = el("option", null, texte);
    o.value = valeur;
    return o;
  }

  /* Cytoscape analyse les couleurs lui-même et n'interprète pas les variables
   * CSS : il faut donc les résoudre en amont. On lit les rôles une fois sur
   * l'élément racine, ce qui garde la feuille de style comme unique source de
   * vérité des couleurs, y compris en thème sombre. */
  var ROLES = [
    "surface-1", "text-primary", "text-secondary", "text-muted", "axis",
    "acquis", "cout-1", "cout-2", "cout-3", "cout-4", "cout-5",
  ];

  function lireRoles(racine) {
    // Via `global` et non en global nu : le composant est déjà paramétré par la
    // fenêtre, et c'est ce qui le rend testable hors navigateur (jsdom).
    var calcule = global.getComputedStyle(racine);
    var roles = {};
    ROLES.forEach(function (role) {
      roles[role] = calcule.getPropertyValue("--" + role).trim() || "#888888";
    });
    return roles;
  }

  function couleurCout(roles, cout) {
    return roles["cout-" + Math.min(Math.max(cout, 1), COUTS_MAX)];
  }

  /* L'encre d'une étiquette doit contraster avec le REMPLISSAGE du nœud, pas avec
   * la surface : la rampe du coût va du bleu très clair au bleu très foncé, donc
   * une encre fixe devient illisible à l'une de ses deux extrémités — en thème
   * sombre, du blanc atterrissait sur un nœud bleu pâle. On reste sur des encres
   * neutres (noir ou blanc), jamais sur la couleur de la série. */
  function luminance(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec((hex || "").trim());
    if (!m) return 1;
    var canaux = [1, 2, 3].map(function (i) {
      var c = parseInt(m[i], 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2];
  }

  function encrePour(fond) {
    return luminance(fond) > 0.35
      ? { encre: "#0b0b0b", halo: "#ffffff" }
      : { encre: "#ffffff", halo: "#0b0b0b" };
  }

  // Marqueur textuel doublant la couleur : « ! » = à vérifier à la main.
  function marque(noeud) {
    return noeud.statut === "manual_check" ? "!" : "";
  }

  function libelleStatut(n) {
    if (n.acquis) return "déjà pris";
    return n.statut === "manual_check"
      ? "à vérifier à la main"
      : "éligible sans réserve";
  }

  function emplacements(n) {
    return n.cout + (n.cout === 1 ? " emplacement" : " emplacements");
  }

  // Valeurs d'un don pour une facette, toujours en tableau : ça évite de
  // dupliquer chaque test selon que le champ est simple ou multivalué.
  function valeurs(n, facette) {
    if (facette.cle === "statut") return [n.acquis ? "acquis" : n.statut];
    var v = n[facette.cle];
    if (v == null || v === "") return [];
    return facette.liste ? v : [v];
  }

  function rendre(conteneur, donnees) {
    var racine = el("div", "explorateur-dons");
    conteneur.innerHTML = "";
    conteneur.appendChild(racine);

    // Doit être lu après insertion dans le document, sinon les variables CSS de
    // la feuille de style ne sont pas encore résolues.
    var roles = lireRoles(racine);

    var noeuds = donnees.noeuds;
    var parNom = {};
    noeuds.forEach(function (n) {
      parNom[n.nom] = n;
    });
    // L'étiquetage sémantique est optionnel dans l'export : sans lui, on masque
    // ses facettes plutôt que d'afficher six filtres qui ne filtrent rien.
    var etiquete = (donnees.resume.dons_etiquetes || 0) > 0;
    var facettes = FACETTES.filter(function (f) {
      return etiquete || !f.semantique;
    });
    var grapheDispo = typeof global.cytoscape === "function";

    var etat = {
      choix: {}, // cle de facette -> { valeur: true }
      coutMax: COUTS_MAX,
      voie: "",
      recherche: "",
      vue: "liste",
      selection: null,
    };
    facettes.forEach(function (f) {
      etat.choix[f.cle] = {};
    });

    /* ---------- filtrage ---------- */

    function passeRecherche(n) {
      if (!etat.recherche) return true;
      var foin = [n.nom, n.resume_court || "", (n.mots_cles || []).join(" ")]
        .join(" ")
        .toLowerCase();
      return foin.indexOf(etat.recherche) !== -1;
    }

    function passeFacette(n, f) {
      var choisis = Object.keys(etat.choix[f.cle] || {});
      if (!choisis.length) return true; // facette non posée = ne filtre pas
      var siennes = valeurs(n, f);
      return choisis.some(function (v) {
        return siennes.indexOf(v) !== -1;
      });
    }

    // `saufFacette` est ce qui rend les compteurs justes : pour compter les
    // options d'une facette, il faut appliquer toutes les autres mais pas
    // celle-là, sinon chaque option non cochée afficherait zéro.
    function passe(n, saufFacette, saufVoie) {
      if (n.cout > etat.coutMax) return false;
      if (!saufVoie && etat.voie && voieDe(n) !== etat.voie) return false;
      if (!passeRecherche(n)) return false;
      for (var i = 0; i < facettes.length; i++) {
        if (facettes[i].cle === saufFacette) continue;
        if (!passeFacette(n, facettes[i])) return false;
      }
      return true;
    }

    /* ---------- voies ---------- */

    // Les voies minuscules sont repliées sous une entrée unique. Le JSON fournit
    // déjà `voie_taille`, donc rien n'est recalculé ici.
    // Sentinelle impossible à confondre avec un nom de don : aucun n'a de
    // soulignés. Le repli des petites voies ne peut donc pas masquer une vraie.
    var PETITES = "__petites__";
    function voieDe(n) {
      if (!n.voie) return "";
      return n.voie_taille < VOIE_MINIMALE ? PETITES : n.voie;
    }

    /* ---------- ossature ---------- */

    var entete = el("div", "ed-entete");
    var p = donnees.personnage;
    var r = donnees.resume;
    entete.appendChild(el("h2", "ed-titre", "Dons à viser — " + p.label));
    entete.appendChild(
      el(
        "p",
        "ed-sous-titre",
        r.dons_retenus +
          " dons atteignables sur " +
          r.dons_catalogue +
          " · " +
          r.accessibles_maintenant +
          " prenables tout de suite · " +
          r.a_planifier +
          " à planifier sur " +
          p.slots_explores +
          " emplacements"
      )
    );
    racine.appendChild(entete);

    var barre = el("div", "ed-barre");
    var recherche = document.createElement("input");
    recherche.type = "search";
    recherche.className = "ed-recherche";
    recherche.placeholder = "nom, résumé ou mot-clé d'un don…";
    recherche.addEventListener("input", function () {
      etat.recherche = recherche.value.trim().toLowerCase();
      appliquer();
    });
    barre.appendChild(recherche);

    var onglets = el("div", "ed-onglets");
    var VUES = [
      { cle: "liste", titre: "Liste" },
      { cle: "arbre", titre: "Arbre" },
      { cle: "tableau", titre: "Tableau" },
    ];
    var boutonsVue = {};
    VUES.forEach(function (v) {
      var b = el("button", "ed-onglet", v.titre);
      b.type = "button";
      if (v.cle === "arbre" && !grapheDispo) {
        b.disabled = true;
        b.title = "Cytoscape n'est pas chargé sur cette page.";
      }
      b.addEventListener("click", function () {
        etat.vue = v.cle;
        appliquer();
      });
      boutonsVue[v.cle] = b;
      onglets.appendChild(b);
    });
    barre.appendChild(onglets);
    racine.appendChild(barre);

    var corps = el("div", "ed-corps");
    var colonneFacettes = el("div", "ed-facettes");
    var colonneCentre = el("div", "ed-centre");
    var colonneDetail = el("div", "ed-detail-colonne");
    corps.appendChild(colonneFacettes);
    corps.appendChild(colonneCentre);
    corps.appendChild(colonneDetail);
    racine.appendChild(corps);

    var compte = el("p", "ed-compte");
    colonneCentre.appendChild(compte);
    var liste = el("div", "ed-liste");
    var scene = el("div", "ed-scene");
    var graphe = el("div", "ed-graphe");
    scene.appendChild(graphe);
    var tableau = el("div", "ed-tableau");
    var vide = el(
      "div",
      "ed-vide",
      "Aucun don ne correspond à ces filtres. Élargis le coût maximum, ou retire une facette."
    );
    colonneCentre.appendChild(liste);
    colonneCentre.appendChild(scene);
    colonneCentre.appendChild(tableau);
    colonneCentre.appendChild(vide);

    var detail = el("div", "ed-detail");
    colonneDetail.appendChild(detail);

    /* ---------- facettes ---------- */

    var zonesFacette = {};

    var entetePanneau = el("div", "ed-facette");
    var titreFiltres = el("h3", null, "Filtres");
    var razTout = el("button", "ed-raz", "tout effacer");
    razTout.type = "button";
    razTout.addEventListener("click", function () {
      facettes.forEach(function (f) {
        etat.choix[f.cle] = {};
      });
      etat.coutMax = COUTS_MAX;
      etat.voie = "";
      etat.recherche = "";
      recherche.value = "";
      appliquer();
    });
    titreFiltres.appendChild(razTout);
    entetePanneau.appendChild(titreFiltres);
    colonneFacettes.appendChild(entetePanneau);

    // Coût — la facette la plus utile, et la seule qui soit ordinale : elle
    // prend un curseur (« au plus N ») et non des cases, parce que choisir
    // « coût 2 ou 4 mais pas 3 » n'a pas de sens pour un budget.
    var zoneCout = el("div", "ed-facette");
    zoneCout.appendChild(el("h3", null, "Coût maximum"));
    var curseur = document.createElement("input");
    curseur.type = "range";
    curseur.min = 1;
    curseur.max = COUTS_MAX;
    curseur.value = COUTS_MAX;
    curseur.className = "ed-curseur";
    var libCout = el("p", "ed-mesure");
    curseur.addEventListener("input", function () {
      etat.coutMax = Number(curseur.value);
      appliquer();
    });
    zoneCout.appendChild(curseur);
    zoneCout.appendChild(libCout);
    colonneFacettes.appendChild(zoneCout);

    // Voie — beaucoup de valeurs, donc une liste déroulante et non des cases.
    var zoneVoie = el("div", "ed-facette");
    zoneVoie.appendChild(el("h3", null, "Voie"));
    var selVoie = document.createElement("select");
    selVoie.className = "ed-select";
    selVoie.addEventListener("change", function () {
      etat.voie = selVoie.value;
      appliquer();
    });
    zoneVoie.appendChild(selVoie);
    colonneFacettes.appendChild(zoneVoie);

    facettes.forEach(function (f) {
      var zone = el("div", "ed-facette");
      zone.appendChild(el("h3", null, f.titre));
      var options = el("div", "ed-options");
      zone.appendChild(options);
      colonneFacettes.appendChild(zone);
      zonesFacette[f.cle] = { zone: zone, options: options };
    });

    if (!etiquete) {
      var note = el(
        "p",
        "ed-note",
        "L'étiquetage sémantique n'a pas encore tourné sur cet export : les " +
          "facettes « ce que le don donne », contexte, activation et polyvalence " +
          "sont indisponibles. Lance scrappers/tag_feat_semantics.py."
      );
      colonneFacettes.appendChild(note);
    }

    function peuplerFacettes() {
      facettes.forEach(function (f) {
        var comptes = {};
        noeuds.forEach(function (n) {
          if (!passe(n, f.cle)) return;
          valeurs(n, f).forEach(function (v) {
            comptes[v] = (comptes[v] || 0) + 1;
          });
        });
        // Une option cochée reste visible même à zéro : sinon elle disparaîtrait
        // sous le doigt de qui vient de la cocher, sans moyen de la décocher.
        Object.keys(etat.choix[f.cle]).forEach(function (v) {
          if (comptes[v] == null) comptes[v] = 0;
        });
        var cles = Object.keys(comptes).sort(function (a, b) {
          return comptes[b] - comptes[a] || libelle(f.cle, a).localeCompare(libelle(f.cle, b), "fr");
        });

        var zone = zonesFacette[f.cle];
        zone.options.innerHTML = "";
        zone.zone.hidden = cles.length === 0;
        cles.forEach(function (v) {
          var etiquette = el("label", "ed-option");
          var case_ = document.createElement("input");
          case_.type = "checkbox";
          case_.checked = !!etat.choix[f.cle][v];
          case_.addEventListener("change", function () {
            if (case_.checked) etat.choix[f.cle][v] = true;
            else delete etat.choix[f.cle][v];
            appliquer();
          });
          etiquette.appendChild(case_);
          etiquette.appendChild(el("span", "ed-option-nom", libelle(f.cle, v)));
          etiquette.appendChild(el("span", "ed-option-compte", String(comptes[v])));
          zone.options.appendChild(etiquette);
        });
      });

      // Voies : comptées comme les autres facettes (toutes contraintes sauf
      // elle-même), en repliant les plus petites.
      var comptesVoie = {};
      noeuds.forEach(function (n) {
        if (!passe(n, null, true)) return;
        var v = voieDe(n);
        if (v) comptesVoie[v] = (comptesVoie[v] || 0) + 1;
      });
      var voies = Object.keys(comptesVoie).sort(function (a, b) {
        return comptesVoie[b] - comptesVoie[a] || a.localeCompare(b, "fr");
      });
      selVoie.innerHTML = "";
      selVoie.appendChild(optionSelect("toutes les voies", ""));
      voies.forEach(function (v) {
        var nom = v === PETITES ? "petites voies (moins de " + VOIE_MINIMALE + " dons)" : v;
        selVoie.appendChild(optionSelect(nom + " (" + comptesVoie[v] + ")", v));
      });
      selVoie.value = etat.voie;
      if (selVoie.value !== etat.voie) {
        // La voie retenue n'existe plus sous les autres filtres : on la relâche
        // plutôt que de laisser un menu qui n'affiche pas ce qui est en vigueur.
        etat.voie = "";
        selVoie.value = "";
      }
    }

    /* ---------- panneau de détail ---------- */

    function lienVersDon(nom) {
      var b = el("button", "ed-lien", nom);
      b.type = "button";
      b.addEventListener("click", function () {
        if (parNom[nom]) afficherDetail(parNom[nom]);
      });
      return b;
    }

    function listeDeLiens(noms) {
      var ul = el("ul", "ed-liens");
      noms.forEach(function (nom) {
        var li = document.createElement("li");
        li.appendChild(lienVersDon(nom));
        var cible = parNom[nom];
        if (cible) li.appendChild(el("span", "ed-mesure", cible.cout + "e"));
        ul.appendChild(li);
      });
      return ul;
    }

    function afficherDetail(n) {
      etat.selection = n.nom;
      detail.innerHTML = "";
      detail.appendChild(el("p", "ed-detail-nom", n.nom));
      if (n.resume_court) detail.appendChild(el("p", "ed-resume", n.resume_court));
      detail.appendChild(el("p", "ed-sous-titre", libelleStatut(n)));

      var dl = document.createElement("dl");
      function ligne(cle, valeur) {
        if (valeur == null || valeur === "" || valeur.length === 0) return;
        dl.appendChild(el("dt", null, cle));
        dl.appendChild(el("dd", null, valeur));
      }
      ligne("Coût", emplacements(n));
      if (n.effet_principal) ligne("Effet", libelle("effet_principal", n.effet_principal));
      if ((n.effets_secondaires || []).length) {
        ligne(
          "Aussi",
          n.effets_secondaires
            .map(function (e) {
              return libelle("effet_principal", e);
            })
            .join(", ")
        );
      }
      if ((n.cible_du_bonus || []).length) {
        ligne(
          "Bonus sur",
          n.cible_du_bonus
            .map(function (c) {
              return libelle("cible_du_bonus", c);
            })
            .join(", ")
        );
      }
      ligne("Valeur", n.valeur_bonus);
      if ((n.contexte || []).length) {
        ligne(
          "Contexte",
          n.contexte
            .map(function (c) {
              return libelle("contexte", c);
            })
            .join(", ")
        );
      }
      if (n.activation) ligne("Activation", libelle("activation", n.activation));
      ligne("Usages", n.utilisations);
      if (n.polyvalence) ligne("Polyvalence", libelle("polyvalence", n.polyvalence));
      if ((n.categorie_officielle || []).length) {
        ligne("Catégorie", n.categorie_officielle.join(", "));
      }
      if (n.voie) ligne("Voie", n.voie + " (" + n.voie_taille + " dons)");
      ligne("Source", n.source);
      detail.appendChild(dl);

      if ((n.mots_cles || []).length) {
        var etiquettes = el("p", "ed-mots");
        n.mots_cles.forEach(function (m) {
          etiquettes.appendChild(el("span", "ed-mot", m));
        });
        detail.appendChild(etiquettes);
      }

      if (n.conditions && n.conditions !== "—") {
        detail.appendChild(el("h4", null, "Conditions"));
        detail.appendChild(el("p", null, n.conditions));
      }

      if ((n.prerequis_dons || []).length) {
        detail.appendChild(el("h4", null, "Exige d'abord"));
        detail.appendChild(listeDeLiens(n.prerequis_dons));
      }

      /* Le compte et la liste vont ensemble. C'est le défaut d'origine de ce
       * composant : il annonçait « débloque 2 dons » sans jamais pouvoir les
       * nommer, parce que le levier était calculé sur le catalogue entier alors
       * que l'affichage ne montrait que les dons atteignables. L'export sépare
       * désormais les deux mesures, et on montre l'écart au lieu de le taire. */
      if ((n.debloque || []).length) {
        detail.appendChild(
          el("h4", null, "Débloque directement (" + n.debloque.length + ")")
        );
        detail.appendChild(listeDeLiens(n.debloque));
      }
      if (n.levier) {
        detail.appendChild(
          el(
            "p",
            "ed-mesure",
            n.levier + " dons en aval au total, dans ce que ce personnage peut atteindre."
          )
        );
      }
      if (n.levier_catalogue > n.levier) {
        detail.appendChild(
          el(
            "p",
            "ed-mesure",
            "Dans le catalogue complet il en ouvre " +
              n.levier_catalogue +
              " : les autres sont hors de portée à ce niveau."
          )
        );
      }

      if (n.description) {
        detail.appendChild(el("h4", null, "Texte du don"));
        detail.appendChild(el("p", "ed-description", n.description));
      }

      if ((n.a_verifier || []).length) {
        var avert = el("div", "ed-avertissement");
        avert.appendChild(
          el("strong", null, "À vérifier avec ton MJ (" + n.a_verifier.length + ")")
        );
        var ul = document.createElement("ul");
        n.a_verifier.forEach(function (raison) {
          ul.appendChild(el("li", null, raison));
        });
        avert.appendChild(ul);
        detail.appendChild(avert);
      }
    }

    function detailParDefaut() {
      detail.innerHTML = "";
      detail.appendChild(el("p", "ed-detail-nom", "Aucun don sélectionné"));
      detail.appendChild(
        el(
          "p",
          "ed-sous-titre",
          "Choisis un don dans la liste, le tableau ou l'arbre pour voir son effet, " +
            "ses prérequis et ce qu'il débloque."
        )
      );
    }
    detailParDefaut();

    /* ---------- vue liste (lignes compactes) ---------- */

    function remplirListe(visibles) {
      liste.innerHTML = "";
      visibles.forEach(function (n) {
        var ligne = el("button", "ed-ligne");
        ligne.type = "button";
        if (n.nom === etat.selection) ligne.classList.add("ed-ligne--active");
        // Le coût est repris en pastille colorée : c'est la même rampe ordinale
        // que le graphe, pour qu'un don change de vue sans changer d'apparence.
        var pastille = el("span", "ed-pastille", String(n.cout));
        var fond = n.acquis ? roles["acquis"] : couleurCout(roles, n.cout);
        pastille.style.background = fond;
        pastille.style.color = encrePour(fond).encre;
        pastille.title = emplacements(n);
        ligne.appendChild(pastille);

        var texte = el("span", "ed-ligne-texte");
        var nom = el("span", "ed-ligne-nom", n.nom);
        if (marque(n)) nom.appendChild(el("span", "ed-alerte", "!"));
        texte.appendChild(nom);
        texte.appendChild(
          el(
            "span",
            "ed-ligne-resume",
            n.resume_court || n.conditions || "—"
          )
        );
        ligne.appendChild(texte);

        var meta = el("span", "ed-ligne-meta");
        if (n.effet_principal) {
          meta.appendChild(
            el("span", "ed-etiquette", libelle("effet_principal", n.effet_principal))
          );
        }
        if (n.debloque && n.debloque.length) {
          meta.appendChild(el("span", "ed-mesure", "→ " + n.debloque.length));
        }
        ligne.appendChild(meta);

        ligne.addEventListener("click", function () {
          afficherDetail(n);
          remplirListe(visibles);
        });
        liste.appendChild(ligne);
      });
    }

    /* ---------- vue tableau ---------- */

    function remplirTableau(visibles) {
      tableau.innerHTML = "";
      var t = document.createElement("table");
      var ligneEntete = t.createTHead().insertRow();
      ["Don", "Effet", "Coût", "Débloque", "Voie", "Statut", "Conditions"].forEach(
        function (c) {
          ligneEntete.appendChild(el("th", null, c));
        }
      );
      var corpsT = t.createTBody();
      visibles.forEach(function (n) {
        var tr = corpsT.insertRow();
        var cellule = tr.insertCell();
        cellule.appendChild(lienVersDon((marque(n) ? "! " : "") + n.nom));
        [
          n.effet_principal ? libelle("effet_principal", n.effet_principal) : "—",
          n.cout,
          // Le nombre affiché est celui de la liste montrée juste à côté dans le
          // panneau de détail : les deux ne peuvent plus diverger.
          n.debloque.length,
          n.voie || "—",
          libelleStatut(n),
          n.conditions || "—",
        ].forEach(function (v) {
          tr.insertCell().textContent = v;
        });
      });
      tableau.appendChild(t);
    }

    /* ---------- vue arbre ---------- */

    var cy = null;

    function styleCytoscape(roles) {
      return [
        {
          selector: "node",
          style: {
            label: "data(etiquette)",
            "background-color": "data(couleur)",
            // Anneau de 2px à la couleur de la surface : les nœuds qui se
            // chevauchent restent lisibles l'un sur l'autre.
            "border-width": 2,
            "border-color": roles["surface-1"],
            shape: "round-rectangle",
            width: "label",
            height: 22,
            padding: "6px",
            "font-size": 11,
            "font-family": 'system-ui, -apple-system, "Segoe UI", sans-serif',
            "text-valign": "center",
            "text-halign": "center",
            // Encre neutre choisie d'après le remplissage, jamais la couleur de la série.
            color: "data(encre)",
            "text-outline-width": 2,
            "text-outline-color": "data(halo)",
          },
        },
        {
          // Statut « à vérifier » : bordure en tirets, doublée du « ! » de l'étiquette.
          selector: 'node[statut = "manual_check"]',
          style: { "border-style": "dashed", "border-color": roles["text-muted"] },
        },
        {
          selector: "node[?acquis]",
          style: { "background-color": roles["acquis"], "border-style": "double" },
        },
        {
          selector: "node:selected",
          style: { "border-color": roles["text-primary"], "border-width": 3 },
        },
        { selector: "node.estompe", style: { opacity: 0.18, "text-opacity": 0.18 } },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": roles["axis"],
            "target-arrow-color": roles["axis"],
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            "curve-style": "bezier",
          },
        },
        {
          // Prérequis « au choix » (un OU dans les Conditions) : trait en tirets,
          // pour ne pas laisser croire que les deux branches sont obligatoires.
          selector: "edge[?au_choix]",
          style: { "line-style": "dashed" },
        },
        { selector: "edge.estompe", style: { opacity: 0.08 } },
        {
          selector: "edge.voisinage",
          style: { "line-color": roles["text-secondary"], width: 3 },
        },
      ];
    }

    function creerGraphe() {
      var lies = noeuds.filter(function (n) {
        return !n.isole;
      });
      cy = global.cytoscape({
        container: graphe,
        style: styleCytoscape(roles),
        wheelSensitivity: 0.2,
        elements: {
          nodes: lies.map(function (n) {
            var fond = n.acquis ? roles["acquis"] : couleurCout(roles, n.cout);
            var ink = encrePour(fond);
            return {
              data: {
                id: n.nom,
                etiquette: (marque(n) ? "! " : "") + n.nom,
                couleur: fond,
                encre: ink.encre,
                halo: ink.halo,
                statut: n.statut,
                acquis: n.acquis,
                cout: n.cout,
              },
            };
          }),
          edges: donnees.aretes
            .filter(function (a) {
              return (
                parNom[a.de] && parNom[a.vers] &&
                !parNom[a.de].isole && !parNom[a.vers].isole
              );
            })
            .map(function (a, i) {
              return {
                data: { id: "e" + i, source: a.de, target: a.vers, au_choix: a.au_choix },
              };
            }),
        },
      });

      // Survol : le voisinage direct ressort, tout le reste s'estompe. C'est la
      // lecture qui compte ici — « de quoi ce don dépend, et qu'ouvre-t-il ».
      cy.on("mouseover", "node", function (evt) {
        var proche = evt.target.closedNeighborhood();
        cy.elements().difference(proche).addClass("estompe");
        proche.edges().addClass("voisinage");
      });
      cy.on("mouseout", "node", function () {
        cy.elements().removeClass("estompe voisinage");
      });
      cy.on("tap", "node", function (evt) {
        afficherDetail(parNom[evt.target.id()]);
      });
    }

    function majGraphe(visibles) {
      if (!cy) creerGraphe();
      var gardes = {};
      visibles.forEach(function (n) {
        if (!n.isole) gardes[n.nom] = true;
      });
      var nb = 0;
      cy.batch(function () {
        cy.nodes().forEach(function (n) {
          var ok = !!gardes[n.id()];
          if (ok) nb++;
          n.style("display", ok ? "element" : "none");
        });
        cy.edges().forEach(function (a) {
          var ok = gardes[a.source().id()] && gardes[a.target().id()];
          a.style("display", ok ? "element" : "none");
        });
      });
      if (!nb) return 0;
      // Sur la seule collection visible : sinon dagre réserve la place des
      // nœuds masqués et l'arbre s'affiche troué.
      var disposition = cy.elements(":visible").layout({
        name: "dagre",
        rankDir: "LR",
        nodeSep: 14,
        rankSep: 80,
        animate: false,
        fit: true,
        padding: 24,
      });
      disposition.on("layoutstop", function () {
        // Un hub à vingt enfants produit une colonne plus haute que la scène :
        // tout faire tenir rendrait les étiquettes illisibles. On plafonne donc
        // le dézoom et on laisse le déplacement prendre le relais — un nom de
        // don qu'on ne peut pas lire ne vaut rien.
        if (cy.zoom() < ZOOM_LISIBLE) {
          cy.zoom(ZOOM_LISIBLE);
          cy.center(cy.elements(":visible"));
        }
      });
      disposition.run();
      return nb;
    }

    /* ---------- boucle d'application ---------- */

    function appliquer() {
      var visibles = noeuds.filter(function (n) {
        return passe(n, null);
      });
      visibles.sort(function (a, b) {
        return (
          a.cout - b.cout ||
          b.debloque.length - a.debloque.length ||
          a.nom.localeCompare(b.nom, "fr")
        );
      });

      peuplerFacettes();
      curseur.value = String(etat.coutMax);
      libCout.textContent = "au plus " + etat.coutMax + (etat.coutMax === 1 ? " emplacement" : " emplacements");

      VUES.forEach(function (v) {
        boutonsVue[v.cle].classList.toggle("ed-onglet--actif", v.cle === etat.vue);
      });
      if (etat.vue === "arbre" && !grapheDispo) etat.vue = "liste";
      racine.dataset.vue = etat.vue;
      liste.hidden = etat.vue !== "liste";
      scene.hidden = etat.vue !== "arbre";
      tableau.hidden = etat.vue !== "tableau";

      var dansArbre = 0;
      if (etat.vue === "liste") remplirListe(visibles);
      else if (etat.vue === "tableau") remplirTableau(visibles);
      else dansArbre = majGraphe(visibles);

      vide.hidden = !!visibles.length && (etat.vue !== "arbre" || dansArbre > 0);

      var isoles = visibles.filter(function (n) {
        return n.isole;
      }).length;
      var texte = visibles.length + " dons retenus";
      if (etat.vue === "arbre") {
        // Dire explicitement ce que l'arbre laisse de côté : un compte qui baisse
        // sans explication en changeant de vue passe pour un bug.
        texte +=
          " · " + dansArbre + " affichés dans l'arbre · " +
          isoles + " sans dépendance, donc absents du graphe (visibles en liste)";
      } else if (isoles) {
        texte += " · dont " + isoles + " sans dépendance";
      }
      compte.textContent = texte;
    }

    // Les couleurs du graphe sont résolues une fois, donc un basculement
    // clair/sombre les laisserait figées : il faut les relire.
    function rafraichirTheme() {
      roles = lireRoles(racine);
      if (cy) {
        cy.batch(function () {
          cy.nodes().forEach(function (n) {
            var fond = n.data("acquis")
              ? roles["acquis"]
              : couleurCout(roles, n.data("cout"));
            var ink = encrePour(fond);
            n.data("couleur", fond);
            n.data("encre", ink.encre);
            n.data("halo", ink.halo);
          });
        });
        cy.style().fromJson(styleCytoscape(roles)).update();
      }
      appliquer();
    }

    var media = global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)");
    if (media && media.addEventListener) {
      media.addEventListener("change", rafraichirTheme);
    }

    appliquer();
    return {
      etat: etat,
      appliquer: appliquer,
      afficherDetail: afficherDetail,
      rafraichirTheme: rafraichirTheme,
      cy: function () {
        return cy;
      },
    };
  }

  global.ExplorateurDons = { rendre: rendre };
})(window);
