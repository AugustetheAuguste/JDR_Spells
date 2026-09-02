"""Curation de `Data/conditions/prereq_gating.json` : nature de chaque prérequis non
attribuable à une classe.

Contexte. `Data/classes/class_ability_map.json` répond à une seule question : « ce
segment de Conditions désigne-t-il une capacité réservée à certaines
classes ? ». Ses 341 entrées `no_single_class` sont donc un fourre-tout :
traits raciaux, types de créature, anatomie, divinité, alignement,
background, maîtrise d'arme, dons… Le moteur les renvoyait toutes en
`manual_check`, ce qui produisait des listes de dons inutilisables (un
guerrier humain se voyait proposer « Ailes fiélonnes », « Attaque de
morsure », « Suivant de Torag »…).

Ce script transcrit la classification (relue à la main) de ces prérequis en
*genres de gating* exploitables par `engine.py` :

- ``racial_trait``   : nom d'un trait racial ; vérifiable contre `Data/races/races.json`
- ``creature_type``  : race / type / sous-type de créature ; vérifiable contre la race
- ``anatomy``        : partie du corps ou capacité physique innée (morsure, vol,
                       armure naturelle, RD…) ; vérifiable contre les traits raciaux
- ``spellcasting``   : nécessite de lancer des sorts / des pouvoirs magiques ;
                       vérifiable via `Data/classes/class_caster_info.json` + magie raciale
- ``deity``          : culte d'une divinité précise ; vérifiable si le personnage
                       a une divinité renseignée
- ``alignment``      : alignement requis ; vérifiable si renseigné
- ``proficiency``    : maîtrise d'une arme / d'une armure. Bloquant seulement
                       quand l'arme ou le bouclier est *nommé* (pas un choix
                       du joueur), résoluble contre
                       Data/classes/class_proficiencies.json + la race ;
                       sinon (« l'arme choisie », « le bouclier utilisé »…)
                       reste à valider à la main.
- ``feat``           : renvoie à un autre don (parfois paramétré) -> à la main
- ``background``     : élément d'historique / d'appartenance -> décision du MJ
- ``mythic``         : niveau mythique -> hors périmètre du moteur
- ``fragment``       : artefact de découpage (morceau de parenthèse, mot isolé) ;
                       ne rien en déduire
- ``generic``        : prérequis réel mais non automatisable en l'état

Seuls ``racial_trait``, ``creature_type``, ``anatomy``, ``spellcasting``,
``deity``, ``alignment`` et ``mythic`` sont *bloquants* : les autres genres
restent en `manual_check`, conformément au principe du dépôt (ne jamais
écarter silencieusement ce qu'on ne sait pas décider).

Usage : python scripts/curate_prereq_gating.py
"""

import json
import unicodedata
from pathlib import Path
import sys

# Exécutable depuis la racine du dépôt : ce script n'est pas dans le paquet.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf_dons import paths

SOURCE = Path(paths.CLASS_ABILITY_MAP)
TARGET = Path(paths.PREREQ_GATING)


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.lower().strip()


# --------------------------------------------------------------------------
# Genres attribués explicitement, mot-clé par mot-clé.
# Les listes ci-dessous sont la vérité relue ; le reste est déduit par les
# règles de préfixe de RULES, dont chaque résultat a été vérifié.
# --------------------------------------------------------------------------

# Traits raciaux : le libellé après « trait racial » est le nom du trait tel
# qu'il apparaît dans Data/races/races.json.
RACIAL_TRAIT_EXTRA = {
    "stabilite": "stabilite",
    "vision nocturne": "vision nocturne",
    "sang orque": "sang orque",
    "veule": "veule",
}

# Races, types et sous-types de créature.
CREATURE_TYPE = {
    "bourbierin": "bourbierin",
    "demi-ogre": "demi-ogre",
    "duergar; deux pouvoirs magiques utilisables une fois par jour": "duergar",
    "elementaire": "elementaire",
    "exterieur de sous-type mal": "exterieur mal",
    "exterieur non-natif de sous-type mal": "exterieur mal",
    "geant du froid": "geant du froid",
    "gnoll": "gnoll",
    "goule": "goule",
    "homme-lezard": "homme-lezard",
    "sahuagin": "sahuagin",
    "sous-type diable": "diable",
    "sous-type kyton": "kyton",
    "sous-type reptilien": "reptilien",
    "vampire": "vampire",
    "vigie": "vigie",
    "deux sous-types": "deux sous-types",
    "type humanoide": "humanoide",
    "avoir ete une goule pendant au moins 500 ans": "goule",
}

# Anatomie / capacités physiques innées.
ANATOMY = {
    "arme naturelle": "arme naturelle",
    "armes naturelles": "arme naturelle",
    "armure naturelle": "armure naturelle",
    "attaque de morsure": "attaque de morsure",
    "deux armes naturelles de griffe": "griffes",
    "doit posseder une queue": "queue",
    "langue gluante": "langue gluante",
    "morphologie bipede": "morphologie bipede",
    "possede une attaque speciale": "attaque speciale",
    "pouvoir regeneration": "regeneration",
    "pouvoir retenir son souffle": "retenir son souffle",
    "pouvoir vision dans le noir": "vision dans le noir",
    "reduction de degats": "reduction de degats",
    "trois attaques naturelles": "attaques naturelles multiples",
    "trois mains": "trois mains",
    "vision dans le noir": "vision dans le noir",
    "vision dans le noir (18m)": "vision dans le noir",
    "vitesse de nage naturelle": "vitesse de nage",
    "vitesse de vol": "vitesse de vol",
}

# Prérequis d'incantation (sorts ou pouvoirs magiques).
SPELLCASTING_EXTRA = {
    "convocation de monstres",
    "de blessure spontanement",
    "des oraisons",
    "detection de la loi",
    "detection du bien",
    "detection du mal",
    "detection du mal comme un sort",
    "dissipation supreme",
    "divination",
    "lanceur de sorts profanes",
    "lumiere du jour comme pouvoir magique",
    "ou detection de la magie",
    "plusieurs pouvoirs magiques raciaux",
    "possession spirituelle supreme",
    "poussee hydraulique comme pouvoir magique",
    "pouvoir magique avec un nls de 6",
    "pouvoir magique avec un nls de 10",
    "pouvoir magique du registre de la malediction",
    "pouvoir magique racial lumieres dansantes",
    "pouvoir magique racial tenebres",
    "profanation",
    "telepathie comme un sort",
    "traversee des ombres comme pouvoir magique",
    "un pouvoir magique",
    "une hallucination",
    "capacite surnaturelle telepathie",
    "convocation d'allies naturels comme pouvoir magique",
}

ALIGNMENT = {
    "aligenement divergeant au maximum d'un cran de celui du dieu": None,
    "alignement bon": "bon",
    "alignement chaotique": "chaotique",
    "alignement chaotique neutre": "chaotique neutre",
    "alignement loyal": "loyal",
    "alignement loyal mauvais": "loyal mauvais",
    "alignement mauvais": "mauvais",
    "alignement neutre mauvais": "neutre mauvais",
    "alignement non-bon": "non-bon",
    "alignement non-loyal": "non-loyal",
    "doit etre loyal bon": "loyal bon",
}

DEITY_EXTRA = {
    "doit venerer une divinite",
    "doit venerer une unique divinite tutelaire qui possede une technique de combat divine etablie",
    "doit venerer et recevoir des sorts d'une divinite",
    "ne venere pas de divinite",
    "venere et recoit des sorts d'une divinite",
    "necromancienou pretre d'alignement neutre (voir texte)",
    "d'un demi-dieu",
    "d'un dieu exterieur",
    "d'un duc infernal",
    "d'un malebranche",
    "d'une quasi divinite fielonne",
    "d'une reine catin",
}

BACKGROUND = {
    "addict au pesh",
    "affinite avec l'enclave de la reine-sorciere",
    "affinite avec la dictature militaire atheiste des royaumes independants",
    "affinite avec le dernier rempart",
    "doit avoir ete un esclave de galere",
    "le personnage doit etre",
    "le personnage doit etre d'une classe sociale defavorisee",
    "membre d'une tribu clanique",
    "membre de la guilde des empoisonneurs",
    "membre des chercheurs de merveilles",
    "membre du regiment de diamant",
    "sait parler la langue de la terre des pharaons et son ancetre",
    "suivant de la voie de la nature",
    "survivre a dix seances de torture",
}

MYTHIC = {"personnage non-mythique uniquement"}

# Renvois à d'autres dons (paramétrés ou non) : l'éligibilité dépend des dons
# déjà pris, ce que le moteur sait déjà traiter quand le nom est reconnu ;
# ici le libellé ne correspond pas exactement à une entrée du catalogue.
FEAT = {
    "conducteur de talent avec le type de vehicule choisi",
    "contacts avec la pegre (voir texte)",
    "coassement terrifiant",
    "creation d'armes et armures magiques",
    "deux dons d'ecole",
    "deux dons de malefice sanglant",
    "don pour les critiques",
    "ecole renforcee (divination)",
    "ecole renforcee (enchantement)",
    "ecole renforcee (illusion)",
    "ecole renforcee (invocation)",
    "ecole renforcee (n'importe)",
    "ecole renforcee (necromancie)",
    "ecole renforcee (transmutation)",
    "ecriture de parchemins",
    "extension de zone d'effet",
    "pistage",
    "preparation de potions",
    "ou reflexes surhumains",
    "ou reflexes surhumains; trait racial porte-poisse halfelin",
    "science de l'initative",
    "science de l’entrainement",
    "science du combat a mains nues et science de la lutte",
    "science du combat a mains nues.",
    "trois dons de metamagie",
    "trois dons de spectacle",
    "un don de critique",
    "un don de metamagie",
    "un don de spectacle",
    "talent (acrobaties)",
    "talent (connaissances [n'importe])",
    "talent (diplomatie)",
    "talent (discretion)",
    "talent (escamotage)",
    "talent (intimidation)",
    "talent (linguistique)",
    "talent (vol)",
    "talent avec la capacite de classe du lignage choisi (voir texte)",
    "talent de maitre roublard maitre du deguisement",
    "talent de roublard magie mineure",
    "talent social grande renommee",
    "talents de roublard magie mineure et magie majeure",
    "augmentation d'intensite",
}

# Maîtrise d'arme / d'armure : dépend de l'équipement et du choix du joueur.
PROFICIENCY_EXTRA = {
    "port de l'armure",
    "du bouclier utilise",
    "formation au port de l'armure choisie",
    "formation au port de l’armure choisie",
    "l'arme utilisee est en materiau primitif",
    "specialisation au bouclier avec le bouclier choisi",
    "specialisation martiale (baton)",
    "specialisation martiale avec l'arme a distance choisie",
}

# Maîtrise d'arme *nommée* (pas un choix du joueur) : résoluble contre
# Data/classes/class_proficiencies.json + les traits raciaux (arc long chez
# l'elfe, marteau de guerre chez le nain, fronde chez l'halfelin, et la
# reclassification exotique -> martiale des armes « naines » chez le nain).
# Catégorie officielle des armes (simple/martiale/exotique) vérifiée contre
# d20pfsrd.com le 2026-09-01 ; voir
# build/armes-et-armures-de-classe/OUTPUT_class_proficiencies_ground_truth.md.
WEAPON_PROFICIENCY = {
    "maniement d'une arme de siege": ("arme de siege", "exotique"),
    "maniement d'une arme exotique (armes a feu)": ("arme a feu", "exotique"),
    "maniement d'une arme exotique (chaine cloutee)": ("chaine cloutee", "exotique"),
    "maniement d'une arme exotique (epee de duel)": ("epee de duel", "exotique"),
    "maniement d'une arme exotique (falcata)": ("falcata", "exotique"),
    "maniement d'une arme exotique (filet)": ("filet", "exotique"),
    "maniement d'une arme exotique (lasso)": ("lasso", "exotique"),
    "maniement d'une arme exotique (sabre dentele)": ("sabre dentele", "exotique"),
    "maniement de l'arc long": ("arc long", "martiale"),
    "maniement de la dorn-dergar naine": ("dorn-dergar naine", "exotique"),
    "maniement de la fronde": ("fronde", "simple"),
    "maniement des pointes pour armure": ("pointes pour armure", "exotique"),
    "maniement du cimeterre": ("cimeterre", "martiale"),
    "maniement du fouet": ("fouet", "exotique"),
    "maniement du marteau": ("marteau", "simple"),
    "maniement du marteau de guerre": ("marteau de guerre", "martiale"),
}

# Maîtrise de bouclier *nommée* : « generique » couvre les boucliers légers
# et lourds (Data/classes/class_proficiencies.json:boucliers) ; « targe »
# n'est accordée qu'aux classes qui l'ont dans leur armes_specifiques (ex.
# bretteur, qui n'a pas la maîtrise générique des boucliers).
SHIELD_PROFICIENCY = {
    "maniement d'un bouclier": "generique",
    "maniement de la targe": "targe",
}

# Artefacts de découpage : morceaux de parenthèse ou mots isolés.
FRAGMENT = {
    "bouclier)", "chant)", "d'eau; capacite de classe explosion cinetique",
    "de feu", "de la faune", "de l'eau", "de rodeur; frappe decisive",
    "domaine", "domaine de la flore", "du baton de jet halfelin", "du feu",
    "exterieur)", "familier", "imposition des mains", "int", "monture",
    "mystere", "nature)", "ou de la terre", "ou monture", "ou ondin",
    "ou orque", "ou pouvoir etreinte", "plus", "plus petit", "un",
    "un eidolon", "un familier", "une monture speciale", "chant de rage",
    "combat etudie", "frappe etudiee", "reserve de ki", "utilisation des poisons",
    "detection du mal comme un sort",
}

GENERIC = {
    "1 rang dans une connaissances au choix",
    "5 dv",
    "6 dv",
    "5 rangs dans la competence choisie",
    "5 rangs dans un artisanat",
    "en profession (ingenieur de siege)",
    "une profession au choix",
    "assez haut niveau (voir texte)",
    "voir special",
    "voir texte",
    "bonus de base a l’attaque +1",
    "bonus de base de vigueur +4",
    "bonus de base de vigueur +8",
    "bonus de base de volonte +4",
    "10 niveaux dans une classe qui confere un compagnon animal",
}


def classify(keyword: str) -> tuple[str, str | None]:
    """Renvoie (kind, param) pour un mot-clé normalisé."""
    if keyword in FRAGMENT:
        return "fragment", None
    if keyword in CREATURE_TYPE:
        return "creature_type", CREATURE_TYPE[keyword]
    if keyword in ANATOMY:
        return "anatomy", ANATOMY[keyword]
    if keyword in ALIGNMENT:
        return "alignment", ALIGNMENT[keyword]
    if keyword in MYTHIC:
        return "mythic", None
    if keyword in BACKGROUND:
        return "background", None
    if keyword in DEITY_EXTRA:
        return "deity", None
    if keyword in FEAT:
        return "feat", None
    if keyword in SPELLCASTING_EXTRA:
        return "spellcasting", None
    if keyword in PROFICIENCY_EXTRA:
        return "proficiency", None
    if keyword in WEAPON_PROFICIENCY:
        arme, categorie = WEAPON_PROFICIENCY[keyword]
        return "proficiency", {"arme": arme, "categorie": categorie}
    if keyword in SHIELD_PROFICIENCY:
        return "proficiency", {"bouclier": SHIELD_PROFICIENCY[keyword]}
    if keyword in GENERIC:
        return "generic", None
    if keyword in RACIAL_TRAIT_EXTRA:
        return "racial_trait", RACIAL_TRAIT_EXTRA[keyword]

    # Règles de préfixe (chaque résultat a été relu sur la liste complète).
    if keyword.startswith("trait racial "):
        return "racial_trait", keyword[len("trait racial "):]
    if keyword.startswith("traits raciaux "):
        return "racial_trait", keyword[len("traits raciaux "):]
    if keyword.startswith(("suivant de ", "suivant d'", "suivant du ")):
        return "deity", None
    if keyword.startswith(("capacite a lancer", "capacite a preparer des sorts",
                           "capacite a utiliser des pouvoirs magiques",
                           "capacite a creer des tenebres magiques",
                           "capacite a utilise un effet de metamorphose",
                           "capacite a utiliser une variante de canalisation",
                           "capacite a utiliser un pouvoir magique")):
        return "spellcasting", None
    if keyword.startswith("maniement "):
        return "proficiency", None
    if keyword.startswith("arme de predilection"):
        return "feat", None
    if keyword.startswith(("canalisation d'energie", "canalisation d’energie")):
        return "class_ability_unmapped", None
    if keyword.startswith(("capacite de classe", "capacites de classe",
                           "capacite a eveiller", "capacite a commencer",
                           "capacite a obtenir", "capacite a jouer",
                           "capacite esquive", "aucun niveau dans une classe",
                           "archetype de classe", "arcane de magus",
                           "astuce de maitre ninja", "aspect bestial",
                           "attaque sournoise", "attaque speciale eventration",
                           "decouverte d'alchimiste", "exploit ", "explosion ",
                           "fantome avec", "frappe cachee", "frappe etudiee ",
                           "lignage ", "malefice ", "pouvoir de rage",
                           "pouvoir eventration", "pouvoir frenesie",
                           "pouvoir rochers", "regard impudent",
                           "representation bardique", "reserve d'inspiration",
                           "sens des pieges", "toucher de corruption",
                           "acces au pouvoir majeur", "attaque en puissance;",
                           "incantation rapide;", "combat a deux armes;",
                           "expertise du combat;")):
        return "class_ability_unmapped", None
    return "generic", None


# Capacités de classe que `class_ability_map.json` avait laissées
# `no_single_class` par prudence mais qui sont bel et bien réservées à des
# classes identifiables (règles Pathfinder 1e). `parser.py` les ajoute aux
# `implied_classes`, ce qui rend le don inéligible pour les autres classes.
# Les capacités dont l'attribution reste incertaine ne figurent PAS ici et
# restent en vérification manuelle.
CLASS_ABILITY_OVERRIDES = {
    "acces au pouvoir majeur des benedictions": ["pretre combattant"],
    "archetype de classe collectionneur": ["alchimiste"],
    "armure sacree": ["paladin"],
    "capacite a commencer une representation par une action de mouvement": ["barde", "scalde"],
    "capacite de classe benedictions": ["pretre combattant"],
    "capacite de classe bombes": ["alchimiste"],
    "capacite de classe bonus spirituel": ["medium"],
    "capacite de classe courage": ["barde", "scalde"],
    "capacite de classe defi": ["cavalier", "samourai"],
    "capacite de classe ennemi jure": ["rodeur", "inquisiteur"],
    "capacite de classe ennemi jure (dragon)": ["rodeur", "inquisiteur"],
    "capacite de classe entrainement aux armes": ["guerrier"],
    "capacite de classe entrainement aux armures": ["guerrier"],
    "capacite de classe environnement de predilection (desert)": ["rodeur"],
    "capacite de classe flexibilite martialle": ["lutteur"],
    "capacite de classe instruments": ["occultiste"],
    "capacite de classe ki alcoolise": ["moine"],
    "capacite de classe pieges": ["rodeur"],
    "capacite de classe pouvoir spirituel mineur": ["medium"],
    "capacite de classe recherche de pieges": ["roublard", "ninja", "enqueteur", "tueur"],
    "capacites de classe benedictions et canalisaiton d'energie": ["pretre combattant"],
    "explosion simple de froid": ["cinetiste"],
    "toucher de corruption": ["antipaladin"],

    # --- Deuxième vague de curation (audit multi-classes niveau 6) ---
    # Chaque attribution ci-dessous est corroborée par une preuve tirée du
    # dépôt (table de progression scrapée ou page de don), pas de mémoire seule.

    # « Attaque imprévisible » = Impromptu Sneak Attack, talent de roublard
    # évolué (l'anglais de la page de don le confirme : "Impromptu sneak
    # attack class feature"). Le ninja et le tueur puisent dans la liste de
    # talents de roublard, d'où les trois classes — même convention que
    # « attaque sournoise ».
    "capacite de classe attaque imprevisible": ["roublard", "ninja", "tueur"],

    # « Palpation curative » et « imposition des mains » sont deux traductions
    # françaises de *lay on hands* : Data/classes/class_features.json donne
    # « imposition des mains » au paladin (niveau 2) et « palpation curative
    # (mineure) » à l'hypnotiseur (niveau 3).
    "capacite de classe palpation curative": ["paladin", "hypnotiseur"],

    # Data/classes/class_features.json : « Compréhension des sorts 1/jour » au
    # niveau 5 du scalde.
    "capacite de classe comprehension des sorts": ["scalde"],

    # Classes dont la progression de base accorde un familier (pacte magique
    # / lignage / patron). Le conjurateur en est exclu : il a un eidolon.
    "capacite de classe familier": ["magicien", "ensorceleur", "sorciere", "arcaniste", "magus"],
    "capacite a obtenir un familier": ["magicien", "ensorceleur", "sorciere", "arcaniste", "magus"],
    "capacite de classe convocation de familier": ["magicien", "ensorceleur", "sorciere", "arcaniste", "magus"],

    # « Frappe cachée » est la capacité du justicier (Vigilante) ; la page de
    # « Combines d'équipement » la cite en parallèle de l'attaque sournoise.
    "frappe cachee +2d8": ["justicier"],

    # Les chakras viennent d'un archétype de moine (page « Adepte du chakra » :
    # « réserve de ki de feu-serpent », « quand le personnage maintient ses
    # chakras »). Le ki n'existe que chez le moine.
    "capacite a eveiller le chakra racine": ["moine"],
    "capacite a eveiller le chakra du cœur": ["moine"],
    "capacite a eveiller le chakra couronne": ["moine"],

    # Page « Renvoi de l'insaisissable » : « Cible insaisissable, Expertise du
    # combat, moine fluide 12 » — archétype de moine.
    "capacite de classe cible insaisissable": ["moine"],
}

# Prérequis que la curation a reclassés : `class_ability_map.json` les avait
# étiquetés comme des capacités de classe alors que les pages de dons montrent
# qu'ils n'en sont pas. Les laisser en `class_ability_unmapped` les maintenait
# en vérification manuelle pour tout le monde, à tort.
KIND_RECLASSIFICATION = {
    # Page « Frénésie du sang supérieure » : « frénésie inspirée par le sang,
    # sahuagin » — capacité de la créature sahuagin, pas d'une classe.
    "pouvoir frenesie inspiree par le sang": ("racial_trait", "frenesie inspiree par le sang"),
    # Page « Rocher fumant » : « BBA +11, rochers surchauffés », capacité des
    # créatures lanceuses de rochers (géants), pas d'une classe.
    "pouvoir rochers surchauffes": ("racial_trait", "rochers surchauffes"),
    # Page « À terre à cheval » : « Conditions. Bond du lancier » — c'est un
    # don prérequis, pas une capacité de classe.
    "capacite de classe bond du lancier": ("feat", None),
}

# Prérequis négatifs : le personnage doit N'AVOIR AUCUN niveau dans une
# classe dotée de la capacité citée. C'est donc l'inverse d'implied_classes.
NO_CLASS_LEVELS = {
    "aucun niveau dans une classe dotee d'ennemis jures": ["rodeur", "inquisiteur"],
    "aucun niveau dans une classe dotee d'audace": ["bretteur"],
    "aucun niveau dans une classe dotee d'inspiration": ["enqueteur"],
    "aucun niveau dans une classe dotee d'imitation animale": ["druide", "chasseur"],
    "aucun niveau dans une classe dotee de panache": ["bretteur"],
}

BLOCKING_KINDS = {
    "racial_trait", "creature_type", "anatomy", "spellcasting",
    "deity", "alignment", "mythic", "class_ability", "no_class_levels",
}


def main() -> None:
    entries = json.loads(SOURCE.read_text(encoding="utf-8"))["entries"]
    out = []
    for entry in entries:
        if entry["disposition"] != "no_single_class":
            continue
        keyword = entry["keyword"]
        kind, param = classify(keyword)
        if keyword in CLASS_ABILITY_OVERRIDES:
            kind, param = "class_ability", CLASS_ABILITY_OVERRIDES[keyword]
        elif keyword in NO_CLASS_LEVELS:
            kind, param = "no_class_levels", NO_CLASS_LEVELS[keyword]
        elif keyword in KIND_RECLASSIFICATION:
            kind, param = KIND_RECLASSIFICATION[keyword]
        out.append(
            {
                "keyword": keyword,
                "kind": kind,
                "param": param,
                "blocking": kind in BLOCKING_KINDS
                or (kind == "proficiency" and isinstance(param, dict)),
                "source_raw_examples": entry.get("source_raw_examples", []),
            }
        )
    out.sort(key=lambda e: e["keyword"])
    TARGET.write_text(
        json.dumps({"entries": out}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )

    counts: dict[str, int] = {}
    for entry in out:
        counts[entry["kind"]] = counts.get(entry["kind"], 0) + 1
    print(f"{TARGET} : {len(out)} entrées")
    for kind, count in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {kind:<24}: {count}")


if __name__ == "__main__":
    main()
