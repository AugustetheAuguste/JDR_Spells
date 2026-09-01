"""Curation de `Data/dons/feat_prereq_supplements.json` : les prérequis que la page
du don énonce mais que la colonne `Conditions` du CSV ignore.

Contexte. `scrappers/tag_feat_semantics.py` produit
`Data/dons/feat_semantics_review.json` : 86 dons dont la page dédiée mentionne un
prérequis absent du catalogue. Ce fichier est un **relevé brut**, jamais
applicable tel quel — l'appliquer en bloc ne pourrait qu'ajouter des conditions,
c'est-à-dire produire exactement la sous-attribution que le principe de sûreté du
dépôt interdit. Ce script transcrit la relecture à la main de ces 86 entrées.

La question posée à chaque fragment est : **est-il quantifiable ?**

- Oui -> il part dans ``ajouts`` : une caractéristique (« Dex 17 »), un BBA
  (« bonus de base à l'attaque +1 » -> « BBA +1 »), des rangs de compétence
  (« 1 rang en Équitation »), ou un nom de don du catalogue. Ces fragments sont
  écrits **dans la syntaxe de la colonne `Conditions`**, si bien que
  `data_loader.py` n'a qu'à les concaténer aux conditions du CSV : le parser et
  le moteur les traitent ensuite sans une ligne de code spécifique.
- Non -> il part dans ``ignores``, avec le genre qui dit *pourquoi*. Rien n'est
  jeté en silence :

  ``self_reference``      le don est listé comme son propre prérequis (artefact
                          de scraping : le titre de la page relu comme une
                          condition). Une condition insatisfiable par
                          construction, donc jamais un vrai prérequis.
  ``proficiency``         « maniement de l'arme choisie » : tout personnage peut
                          choisir l'arme qu'il manie ; le dépôt ne modélise pas
                          les maniements (cf. OUTPUT_guerrier_audit_rules.md).
  ``niveau_1_uniquement`` « le personnage peut choisir ce don au niveau 1
                          uniquement » : contrainte de *moment de choix*, pas
                          d'état du personnage.
  ``contrainte_de_jeu``   matériel, encombrement, armure portée, rituel de six
                          mois… hors de portée d'une fiche de personnage.
  ``prose_permissive``    la phrase *élargit* l'accès (« un lycanthrope peut
                          prendre ce don même s'il n'en remplit pas les
                          conditions ») : l'ajouter comme condition inverserait
                          son sens.
  ``non_automatisable``   vrai prérequis, mais dont l'évaluation dépend d'un
                          choix interne au don (quelle technique, quel pouvoir,
                          quelle caractéristique de DD) : au joueur de vérifier.
  ``variante_de_source``  la page contredit le CSV au lieu de le compléter
                          (« homme-lézard » contre « homme-serpent ») : les
                          additionner fabriquerait une condition impossible.
  ``redondant``           déjà impliqué transitivement par une condition du CSV.

Usage :
    python scripts/curate_prereq_supplements.py
    python scripts/curate_prereq_supplements.py --verifier   # sans réécriture
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf1_dons import paths
from pf1_dons.data_loader import clean_feat_name, load_raw
from pf1_dons.models import OrGroup, RequirementType
from pf1_dons.parser import build_normalized_feats, parse_conditions

SOURCE = Path(paths.FEAT_SEMANTICS_REVIEW)
TARGET = Path(paths.FEAT_PREREQ_SUPPLEMENTS)

# --- La table relue -------------------------------------------------------
# Un don -> (ajouts, ignores). Les ajouts sont écrits dans la syntaxe de la
# colonne `Conditions` du CSV ; les ignores citent le fragment *verbatim* du
# fichier de revue, suivi de son genre.
CURATION: dict[str, dict[str, list]] = {
    "Aptitude magique": {
        "ajouts": [],
        "ignores": [("Aptitude magique", "self_reference")],
    },
    "Athlétisme": {
        "ajouts": [],
        "ignores": [("Athlétisme", "self_reference")],
    },
    "Combat en aveugle": {
        "ajouts": [],
        "ignores": [("Combat en aveugle", "self_reference")],
    },
    "Fraternité animale": {
        "ajouts": [],
        "ignores": [("Fraternité animale", "self_reference")],
    },
    "Rapide": {
        "ajouts": [],
        "ignores": [("Rapide", "self_reference")],
    },
    "Talent": {
        "ajouts": [],
        "ignores": [("Talent", "self_reference")],
    },
    "Maîtrise du combat défensif": {
        "ajouts": [],
        "ignores": [
            ("Maîtrise du combat défensif", "self_reference"),
            # Le CSV décrit le don non mythique (aucune condition) ; le grade
            # mythique appartient à son homonyme mythique. L'ajouter rendrait le
            # don inaccessible à tout personnage non mythique.
            ("4ème grade mythique", "variante_de_source"),
        ],
    },
    "Arme de prédilection supérieure": {
        "ajouts": ["BBA +1"],
        "ignores": [("Maniement de l’arme choisie", "proficiency")],
    },
    "Spécialisation martiale": {
        "ajouts": [],
        "ignores": [("Maniement de l’arme choisie", "proficiency")],
    },
    "Spécialisation martiale supérieure": {
        "ajouts": ["Arme de prédilection supérieure"],
        "ignores": [
            ("Maniement de l’arme choisie", "proficiency"),
            ("Arme de prédilection pour l’arme choisie", "redondant"),
        ],
    },
    "Démonstration": {
        "ajouts": [],
        "ignores": [("maniement de l’arme choisie", "proficiency")],
    },
    "Briser les défenses": {
        "ajouts": [],
        "ignores": [
            ("Arme de prédilection", "redondant"),
            ("maniement de l’arme choisie", "proficiency"),
        ],
    },
    "Frappe puissante": {
        "ajouts": ["BBA +1"],
        "ignores": [("maniement de l’arme choisie", "proficiency")],
    },
    "Frappe puissante supérieure": {
        "ajouts": [],
        "ignores": [("Arme de prédilection", "redondant")],
    },
    "Frappe mortelle": {
        "ajouts": ["Démonstration"],
        "ignores": [],
    },
    "Frappe du bouclier": {
        "ajouts": [],
        "ignores": [("Maniement du bouclier", "proficiency")],
    },
    "Maîtrise du bouclier": {
        "ajouts": ["Combat à deux armes", "Science du coup de bouclier"],
        "ignores": [("Maniement des boucliers", "proficiency")],
    },
    "Esprit elfique": {
        "ajouts": [],
        "ignores": [
            ("Le personnage peut choisir ce don au niveau 1 uniquement", "niveau_1_uniquement")
        ],
    },
    "Esprit humain": {
        "ajouts": [],
        "ignores": [
            ("Le personnage peut choisir ce don au niveau 1 uniquement", "niveau_1_uniquement")
        ],
    },
    "Crâne allongé": {
        "ajouts": [],
        "ignores": [
            (
                "Si le personnage choisit ce don après le niveau 1, il doit subir un "
                "processus douloureux de six mois",
                "contrainte_de_jeu",
            )
        ],
    },
    "Trépanation": {
        "ajouts": [],
        "ignores": [
            (
                "Posséder une trousse de premiers secours ou des instruments de "
                "chirurgien pour la trépanation totale",
                "contrainte_de_jeu",
            )
        ],
    },
    "Bond du chat infernal": {
        "ajouts": [],
        "ignores": [
            (
                "Cette capacité ne fonctionne que lorsque le personnage porte une "
                "charge légère ou inexistante.",
                "contrainte_de_jeu",
            )
        ],
    },
    "Sac vocal": {
        "ajouts": [],
        "ignores": [
            (
                "fonctionne uniquement si le personnage ne porte pas d’armure ou s’il "
                "porte une armure légère ou intermédiaire",
                "contrainte_de_jeu",
            )
        ],
    },
    "Sahir-afiyun": {
        "ajouts": [],
        "ignores": [
            (
                "Tous les sorts de sahir-afiyun nécessitent une dose de pesh comme "
                "composante matérielle",
                "contrainte_de_jeu",
            )
        ],
    },
    "Ombre druidique": {
        "ajouts": [],
        "ignores": [
            (
                "Pour prendre ce don, le personnage doit créer une effigie umbrale qui "
                "lie son âme et ses actes aux immondes pouvoirs de sa divinité.",
                "contrainte_de_jeu",
            )
        ],
    },
    "Bénédiction de guerre": {
        "ajouts": [],
        "ignores": [
            (
                "Chacune d’elles doit être liée à un domaine que sa divinité lui "
                "accorde ou à l’un des deux domaines qui représentent ses pouvoirs et "
                "penchants spirituels.",
                "contrainte_de_jeu",
            )
        ],
    },
    "Aspect bestial": {
        "ajouts": [],
        "ignores": [
            (
                "Un personnage ayant contracté la lycanthropie peut prendre ce don même "
                "s’il n’en remplit pas les conditions.",
                "prose_permissive",
            )
        ],
    },
    "Passer pour un humain": {
        "ajouts": [],
        "ignores": [
            (
                "Un halfelin peut choisir ce don mais il doit alors posséder le don "
                "Apparence enfantine",
                "prose_permissive",
            )
        ],
    },
    "Esprit tenace": {
        "ajouts": [],
        "ignores": [
            (
                "le personnage doit remplir la condition requise correspondant à la "
                "caractéristique qu’il utilise pour déterminer le DD de ses jets de "
                "sauvegarde",
                "non_automatisable",
            )
        ],
    },
    "Technique de combat divine": {
        "ajouts": [],
        "ignores": [
            (
                "Conditions avancées propres à chaque technique (par ex. Rechargement "
                "rapide, BBA +10)",
                "non_automatisable",
            )
        ],
    },
    "Extension de pouvoir magique": {
        "ajouts": [],
        "ignores": [
            (
                "Le pouvoir magique choisi doit imiter un sort dont le niveau est "
                "inférieur ou égal à la moitié du NLS de la créature (arrondi vers le "
                "bas) moins 2.",
                "non_automatisable",
            )
        ],
    },
    "Familier supérieur": {
        "ajouts": [],
        "ignores": [
            (
                "alignement compatible (ne différant pas de plus d’un cran sur chaque axe)",
                "non_automatisable",
            ),
            ("NLS profane minimal selon le familier choisi", "non_automatisable"),
        ],
    },
    "Maestro psychique": {
        "ajouts": [],
        "ignores": [
            (
                "au moins 1 rang dans les compétences associées aux extensions de "
                "compétence occultes",
                "non_automatisable",
            )
        ],
    },
    "Frappe du fléau des anges": {
        "ajouts": [],
        "ignores": [
            # « un seigneur démon » désigne un ensemble de divinités, pas une
            # divinité nommée : le gating `deity` ne sait pas le vérifier.
            ("avoir un seigneur démon comme divinité protectrice", "non_automatisable")
        ],
    },
    "Bénédiction du Destructeur": {
        "ajouts": [],
        "ignores": [("fidèle du Destructeur", "non_automatisable")],
    },
    "Marée de sang": {
        "ajouts": [],
        "ignores": [("pouvoir de frénésie inspirée par le sang", "redondant")],
    },
    "Connaissances magiques étendues": {
        "ajouts": [],
        "ignores": [
            (
                "Posséder des niveaux dans une classe de lanceur de sorts dont la liste "
                "des sorts connus est limitée",
                "redondant",
            )
        ],
    },
    "Forme animale rapide": {
        "ajouts": [],
        "ignores": [("lanceur de sorts niveau 8", "redondant")],
    },
    "Grâce supplémentaire": {
        "ajouts": [],
        "ignores": [("Capacité de classe d'imposition des mains", "redondant")],
    },
    "Horreur de l'étreinte fatale": {
        "ajouts": [],
        "ignores": [("Attaque spéciale renforcée ( constriction )", "redondant")],
    },
    "Attaque de queue": {
        "ajouts": [],
        "ignores": [("homme-lézard", "variante_de_source")],
    },
    "Compression ophidienne": {
        "ajouts": [],
        "ignores": [("Homme-lézard", "variante_de_source")],
    },
    "Magie innée": {
        "ajouts": [],
        "ignores": [("homme-lézard", "variante_de_source")],
    },
    "Queue agrippeuse": {
        "ajouts": [],
        "ignores": [("Tieffelin", "variante_de_source")],
    },
    # --- Les prérequis quantifiables ------------------------------------
    "Attaque au galop": {"ajouts": ["1 rang en Équitation"], "ignores": []},
    "Piétinement": {"ajouts": ["1 rang en Équitation"], "ignores": []},
    "Tir monté": {"ajouts": ["1 rang en Équitation"], "ignores": []},
    "Charge dévastatrice": {
        "ajouts": ["1 rang en Équitation", "Combat monté"],
        "ignores": [],
    },
    "Lame montée": {"ajouts": ["BBA +1"], "ignores": []},
    "Désarçonner": {
        "ajouts": ["For 13", "1 rang en Équitation", "Attaque en puissance", "BBA +1"],
        "ignores": [],
    },
    "Attaque en rotation": {"ajouts": ["Int 13"], "ignores": []},
    "Attaque éclair": {"ajouts": ["Dex 13", "Esquive"], "ignores": []},
    "Tir en mouvement": {"ajouts": ["Esquive"], "ignores": []},
    "Comme l'éclair": {"ajouts": ["Esquive"], "ignores": []},
    "Souplesse du serpent": {"ajouts": ["Dex 13"], "ignores": []},
    "Pieds emmêlés": {"ajouts": ["1 rang en Acrobaties"], "ignores": []},
    "Double frappe": {"ajouts": ["Dex 15"], "ignores": []},
    "Éventration à deux armes": {
        "ajouts": ["Dex 17", "Combat à deux armes"],
        "ignores": [],
    },
    "Capture de projectiles": {"ajouts": ["Science du combat à mains nues"], "ignores": []},
    "Poing de la gorgone": {"ajouts": ["Science du combat à mains nues"], "ignores": []},
    "Lutte supérieure": {
        "ajouts": ["Dex 13", "Science du combat à mains nues"],
        "ignores": [],
    },
    "Fureur de la méduse": {
        "ajouts": ["École du scorpion", "Science du combat à mains nues"],
        "ignores": [],
    },
    "Science de la bousculade": {"ajouts": ["For 13", "BBA +1"], "ignores": []},
    "Science du renversement": {"ajouts": ["For 13", "BBA +1"], "ignores": []},
    "Science de la destruction": {"ajouts": ["For 13"], "ignores": []},
    "Science de la feinte": {"ajouts": ["Int 13"], "ignores": []},
    "Science du croc-en-jambe": {"ajouts": ["Int 13"], "ignores": []},
    "Science du désarmement": {"ajouts": ["Int 13"], "ignores": []},
    "Bousculade supérieure": {"ajouts": ["For 13", "Attaque en puissance"], "ignores": []},
    "Destruction d'arme supérieure": {
        "ajouts": ["For 13", "Attaque en puissance"],
        "ignores": [],
    },
    "Renversement supérieur": {"ajouts": ["For 13", "Attaque en puissance"], "ignores": []},
    "Succession d'enchaînements": {
        "ajouts": ["For 13", "Attaque en puissance"],
        "ignores": [],
    },
    "Croc-en-jambe supérieur": {"ajouts": ["Int 13", "Expertise du combat"], "ignores": []},
    "Désarmement supérieur": {"ajouts": ["Int 13", "Expertise du combat"], "ignores": []},
    "Feinte supérieure": {"ajouts": ["Int 13", "Expertise du combat"], "ignores": []},
    "Coup déstabilisant (CM)": {"ajouts": ["Dex 13"], "ignores": []},
    "Coup repositionnant": {"ajouts": ["Science du repositionnement"], "ignores": []},
    "Repositionnement rapide": {"ajouts": ["For 13"], "ignores": []},
    "Plaquage en vol": {"ajouts": ["Science de la bousculade"], "ignores": []},
    "Feu nourri": {"ajouts": ["Tir à bout portant"], "ignores": []},
    "Science du tir de précision": {"ajouts": ["Tir à bout portant"], "ignores": []},
    "Viser juste": {
        "ajouts": ["Dex 19", "Tir à bout portant", "Tir de précision"],
        "ignores": [],
    },
    "Habitant du désert": {"ajouts": ["Con 13", "1 rang en Survie"], "ignores": []},
    "Repousser ses limites": {"ajouts": ["BBA +5"], "ignores": []},
    "Zélote du refus de mourir": {"ajouts": ["Con 17"], "ignores": []},
    "Compagnon animal vampirique": {"ajouts": ["Cha 18"], "ignores": []},
}

GENRES_IGNORES = {
    "self_reference",
    "proficiency",
    "niveau_1_uniquement",
    "contrainte_de_jeu",
    "prose_permissive",
    "non_automatisable",
    "variante_de_source",
    "redondant",
}

# Types de prérequis qu'un ajout est autorisé à produire : un ajout doit être
# *quantifiable*, donc reconnu par le parser. Un ajout qui retomberait en
# UNPARSED ou en CLASS_FEATURE_TEXT n'apporterait qu'un `manual_check` de plus,
# ce qui est précisément ce que la curation cherche à éviter.
TYPES_ATTENDUS = {
    RequirementType.ABILITY_SCORE,
    RequirementType.BBA,
    RequirementType.SKILL_RANKS,
    RequirementType.FEAT,
    RequirementType.LEVEL,
    RequirementType.CLASS_LEVEL,
}


def _noms_du_catalogue() -> set[str]:
    df = load_raw()
    return {clean_feat_name(str(nom)) for nom in df["Dons"]}


def verifier(revue: dict, noms: set[str]) -> list[str]:
    """Contrôles de cohérence entre la table curée et le fichier de revue."""
    erreurs: list[str] = []

    manquants = sorted(set(revue) - set(CURATION))
    if manquants:
        erreurs.append(f"{len(manquants)} don(s) du fichier de revue non curé(s) : {manquants}")
    # Une entrée curée qui a disparu du relevé n'est pas une erreur : un nouveau
    # passage de `tag_feat_semantics.py` compare désormais la page aux conditions
    # *augmentées*, donc un don déjà curé cesse d'y figurer. On la signale
    # seulement, pour que la table puisse être élaguée sciemment.
    en_trop = sorted(set(CURATION) - set(revue))
    if en_trop:
        print(f"NOTE    {len(en_trop)} don(s) curé(s) absent(s) du relevé : {en_trop}")

    for don, entree in CURATION.items():
        if don not in noms:
            erreurs.append(f"{don} : absent du catalogue")
        for _, genre in entree["ignores"]:
            if genre not in GENRES_IGNORES:
                erreurs.append(f"{don} : genre d'ignore inconnu « {genre} »")

    # Chaque fragment relevé doit être tranché : soit un ajout, soit un ignore.
    for don, entree in revue.items():
        curee = CURATION.get(don)
        if curee is None:
            continue
        ignores = {frag for frag, _ in curee["ignores"]}
        nb = len(curee["ajouts"]) + len(ignores)
        if nb < len(entree["prerequis_non_modelises"]):
            erreurs.append(
                f"{don} : {len(entree['prerequis_non_modelises'])} fragment(s) relevé(s) "
                f"mais {nb} tranché(s)"
            )

    # Tout ajout doit être reconnu par le parser.
    normalises = build_normalized_feats(noms)
    for don, entree in CURATION.items():
        for ajout in entree["ajouts"]:
            parsed = parse_conditions(ajout, normalises)
            reqs = parsed.requirements
            if len(reqs) != 1 or isinstance(reqs[0], OrGroup):
                erreurs.append(f"{don} : l'ajout « {ajout} » ne donne pas un prérequis unique")
                continue
            if reqs[0].type not in TYPES_ATTENDUS:
                erreurs.append(
                    f"{don} : l'ajout « {ajout} » est lu comme {reqs[0].type.value}, "
                    "donc non quantifiable"
                )
    return erreurs


def construire(revue: dict) -> dict:
    entrees = []
    for don in sorted(CURATION):
        curee = CURATION[don]
        entrees.append(
            {
                "don": don,
                "ajouts": curee["ajouts"],
                "ignores": [
                    {"fragment": frag, "genre": genre} for frag, genre in curee["ignores"]
                ],
                "conditions_catalogue": revue.get(don, {}).get("conditions_catalogue", ""),
            }
        )
    return {"entries": entrees}


def main() -> int:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument(
        "--verifier",
        action="store_true",
        help="ne contrôle que la cohérence, sans réécrire le fichier",
    )
    args = parseur.parse_args()

    revue = json.loads(SOURCE.read_text(encoding="utf-8"))
    noms = _noms_du_catalogue()

    erreurs = verifier(revue, noms)
    for erreur in erreurs:
        print(f"ERREUR  {erreur}")
    if erreurs:
        return 1

    nb_ajouts = sum(len(e["ajouts"]) for e in CURATION.values())
    nb_dons_avec_ajouts = sum(1 for e in CURATION.values() if e["ajouts"])
    print(
        f"{len(CURATION)} dons relus : {nb_dons_avec_ajouts} reçoivent des prérequis "
        f"({nb_ajouts} fragments), {len(CURATION) - nb_dons_avec_ajouts} sont écartés."
    )
    genres: dict[str, int] = {}
    for entree in CURATION.values():
        for _, genre in entree["ignores"]:
            genres[genre] = genres.get(genre, 0) + 1
    for genre, nb in sorted(genres.items(), key=lambda kv: -kv[1]):
        print(f"  {genre:22} {nb}")

    if args.verifier:
        return 0

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(
        json.dumps(construire(revue), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Écrit : {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
