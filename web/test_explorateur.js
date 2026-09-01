/* Test headless de l'explorateur, à lancer avec Node et jsdom :
 *
 *   npm install jsdom          # une fois, depuis la racine du dépôt
 *   node web/test_explorateur.js build/g6.json
 *
 * Ce que ce test garde, et pourquoi il vaut la peine d'exister : les deux erreurs
 * qui ont motivé cette réécriture étaient des **incohérences entre ce qui est
 * annoncé et ce qui est montré** (« débloque 2 dons » sur un nœud sans enfant
 * visible). Un tel écart ne se voit pas en relisant le code, seulement en
 * comparant les deux nombres après rendu. On vérifie donc, sur des données
 * réelles, que chaque compteur de facette prédit exactement le nombre de dons
 * obtenu quand on clique dessus — c'est la promesse centrale de l'interface.
 */

const fs = require("fs");
const path = require("path");
let JSDOM;
try {
  JSDOM = require("jsdom").JSDOM;
} catch (e) {
  console.error("jsdom manquant. Depuis la racine du dépôt : npm install jsdom");
  process.exit(2);
}

const chemin = process.argv[2] || "build/g6.json";
const donnees = JSON.parse(fs.readFileSync(chemin, "utf-8"));

const dom = new JSDOM(
  `<!doctype html><html><head><style>${fs.readFileSync(
    path.join(__dirname, "explorateur_dons.css"),
    "utf-8"
  )}</style></head><body><div id="cible"></div></body></html>`,
  { pretendToBeVisual: true }
);
global.window = dom.window;
global.document = dom.window.document;
// Cytoscape n'est pas chargé : c'est voulu, on teste ici la dégradation propre
// de la vue « arbre » en même temps que le reste.
require(path.join(__dirname, "explorateur_dons.js"));

const cible = document.getElementById("cible");
const app = window.ExplorateurDons.rendre(cible, donnees);

let echecs = 0;
function verifie(nom, condition, detail) {
  if (condition) {
    console.log("  ok   " + nom);
  } else {
    echecs++;
    console.log("  ECHEC " + nom + (detail ? " — " + detail : ""));
  }
}

const racine = cible.firstChild;
const lignes = () => racine.querySelectorAll(".ed-ligne").length;
const compteAffiche = () =>
  Number(/^(\d+)/.exec(racine.querySelector(".ed-compte").textContent)[1]);

console.log("Données : " + chemin + " — " + donnees.noeuds.length + " dons\n");

console.log("Rendu initial");
verifie("des lignes sont rendues", lignes() > 0, lignes() + " lignes");
verifie(
  "le compte annoncé égale le nombre de lignes",
  compteAffiche() === lignes(),
  compteAffiche() + " annoncés vs " + lignes() + " lignes"
);
verifie(
  "la vue arbre est désactivée sans Cytoscape",
  racine.querySelectorAll(".ed-onglet")[1].disabled
);

/* La promesse des compteurs : cocher une option doit donner exactement le nombre
 * qu'elle affichait. C'est le test qui aurait attrapé le défaut d'origine. */
console.log("\nFidélité des compteurs de facette");
const facettes = racine.querySelectorAll(".ed-facette");
let verifiees = 0;
facettes.forEach(function (facette) {
  const titre = facette.querySelector("h3").textContent.replace("tout effacer", "").trim();
  const options = facette.querySelectorAll(".ed-option");
  if (!options.length) return;
  for (let i = 0; i < Math.min(options.length, 3); i++) {
    const option = options[i];
    const attendu = Number(option.querySelector(".ed-option-compte").textContent);
    const nomOption = option.querySelector(".ed-option-nom").textContent;
    const cocher = option.querySelector("input");
    cocher.checked = true;
    cocher.dispatchEvent(new window.Event("change"));
    const obtenu = lignes();
    verifie(
      titre + " / " + nomOption + " : " + attendu + " annoncés",
      obtenu === attendu,
      obtenu + " obtenus"
    );
    verifiees++;
    // On décoche via l'élément courant : peupler les facettes a reconstruit le DOM.
    const rendu = Array.from(racine.querySelectorAll(".ed-option")).find(
      (o) => o.querySelector(".ed-option-nom").textContent === nomOption && o.querySelector("input").checked
    );
    if (rendu) {
      rendu.querySelector("input").checked = false;
      rendu.querySelector("input").dispatchEvent(new window.Event("change"));
    }
  }
});
/* Le seuil dépend de l'export : sans étiquetage sémantique, seule la facette
 * « Statut » a des options, et exiger dix vérifications ferait échouer le test
 * pour une raison qui n'est pas un défaut du composant. */
const attenduOptions = donnees.resume.dons_etiquetes > 0 ? 10 : 2;
verifie(
  "au moins " + attenduOptions + " options vérifiées" +
    (attenduOptions === 2 ? " (export sans étiquetage sémantique)" : ""),
  verifiees >= attenduOptions,
  verifiees + " vérifiées"
);

console.log("\nCumul des facettes (ET entre facettes)");
const avant = lignes();
app.etat.coutMax = 1;
app.appliquer();
const apres = lignes();
verifie("réduire le coût max réduit la liste", apres < avant, avant + " -> " + apres);
verifie(
  "aucun don au-delà du coût max",
  Array.from(racine.querySelectorAll(".ed-pastille")).every(
    (p) => Number(p.textContent) <= 1
  )
);
app.etat.coutMax = 5;
app.appliquer();
verifie("le coût max restauré rétablit la liste", lignes() === avant);

console.log("\nPanneau de détail : le compte égale la liste");
// C'est le défaut d'origine, retesté à l'endroit exact où il se voyait.
let testesDetail = 0;
donnees.noeuds
  .filter((n) => n.levier > 0)
  .slice(0, 40)
  .forEach(function (n) {
    app.afficherDetail(n);
    const titre = Array.from(racine.querySelectorAll(".ed-detail h4")).find((h) =>
      h.textContent.startsWith("Débloque directement")
    );
    if (!n.debloque.length) {
      verifie("« " + n.nom + " » sans enfant n'annonce rien", !titre);
      testesDetail++;
      return;
    }
    const annonce = Number(/\((\d+)\)/.exec(titre.textContent)[1]);
    const listes = racine.querySelectorAll(".ed-detail .ed-liens");
    const montres = listes[listes.length - 1].querySelectorAll("li").length;
    verifie(
      "« " + n.nom + " » : annonce " + annonce + ", montre " + montres,
      annonce === montres && annonce === n.debloque.length
    );
    testesDetail++;
  });
verifie("des dons à levier ont été testés", testesDetail >= 10, testesDetail + " testés");

console.log("\nRecherche");
app.etat.recherche = "puissance";
app.appliquer();
verifie("la recherche filtre", lignes() > 0 && lignes() < avant, lignes() + " résultats");
app.etat.recherche = "zzzzinexistant";
app.appliquer();
verifie("une recherche sans résultat affiche le message de vide", lignes() === 0 && !racine.querySelector(".ed-vide").hidden);

console.log(
  "\n" + (echecs ? echecs + " ECHEC(S)" : "Tout est passé.")
);
process.exit(echecs ? 1 : 0);
