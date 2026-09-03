"""Étiquette sémantiquement chaque don via un LLM (Claude sur Amazon Bedrock)
et produit Data/dons/feat_semantics.json : « que donne ce don, où, à quel prix ».

Pourquoi un LLM ici, alors que tout le reste du dépôt est déterministe : le
tagueur par mots-clés existant (``tag_feat_categories.py``) laisse **1139 dons
sur 1417 sans aucune catégorie** (80 %), et n'a par construction aucun axe pour
« ce que le don apporte » — « gagne un bonus de +2 à X », « peut utiliser X une
fois par jour » et « ignore le malus de Y » sont trois choses différentes que
nulle liste de mots ne sépare. Le texte complet des 1417 pages (830 000
caractères, aucun don sans texte) est en revanche disponible depuis
``scrape_feat_details.py``.

Quatre garde-fous, qui sont l'essentiel du fichier :

1. **Vocabulaire fermé, imposé par le schéma de l'outil.** Des étiquettes en
   texte libre produiraient 400 quasi-doublons, c'est-à-dire pire que pas
   d'étiquettes : un filtre sur « bonus » ne trouverait ni « bonus chiffré » ni
   « bonus numérique ». Chaque axe est un enum ; le modèle ne peut pas en sortir.
2. **`effet_principal` unique + `effets_secondaires` plafonnés.** Un multi-tag
   sans limite range les dons sous huit effets à la fois et tout filtre renvoie
   tout. Un principal unique donne une facette nette, les secondaires gardent la
   complétude.
3. **Citation obligatoire.** Chaque effet doit être justifié par une phrase
   *verbatim* du texte ; ``verifier_lot`` rejette une citation absente du texte
   source. C'est ce qui rend la passe auditable au lieu d'être crue sur parole.
4. **Aucune extrapolation.** Le modèle ne juge que le texte fourni, jamais ses
   souvenirs de Pathfinder, et répond ``confiance: basse`` plutôt que de
   deviner. La catégorie officielle, quand la page l'énonce, lui est **donnée** :
   on ne fait jamais deviner ce que la source affirme.

Volontairement absent : toute note de puissance ou de « don piège ». Le
catalogue n'en contient aucune vérité terrain, et ce serait affiché comme un
fait. Le ``levier`` calculé par ``scripts/exporter_arbre_dons.py`` reste le seul
proxy de valeur honnête, parce qu'il est dérivé du graphe et non deviné.

Le script est **idempotent et reprenable** : il n'interroge que les dons absents
du fichier de sortie, qu'il réécrit à chaque lot. Un run interrompu se reprend
sans perdre ni repayer ce qui est déjà fait.

Usage :
    python scrappers/tag_feat_semantics.py --limite 100     # pilote
    python scrappers/tag_feat_semantics.py                  # tout le catalogue
    python scrappers/tag_feat_semantics.py --montrer-prompt # sans appel API
    python scrappers/tag_feat_semantics.py --force          # réétiquette tout
"""

import argparse
import json
import re
import sys
import threading
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf_dons import paths
from pf_dons.data_loader import load_catalog

REGION_DEFAUT = "eu-central-1"
MODELE_DEFAUT = "eu.anthropic.claude-opus-5"
# 10 dons par appel : assez pour amortir le prompt système (~1 500 jetons mis en
# cache), assez peu pour que le modèle traite chaque don avec attention et qu'un
# lot raté ne coûte pas cher à refaire.
DONS_PAR_LOT = 10
OUVRIERS = 4
MAX_TOKENS = 16000

# --- Vocabulaire fermé ------------------------------------------------------
# Toute valeur possible de chaque facette. Ajouter une entrée ici est le seul
# moyen d'en créer une : le schéma de l'outil interdit tout le reste.

EFFETS = {
    "bonus_chiffre": "donne un bonus (ou retire un malus) chiffré à une valeur de jeu",
    "nouvelle_action": "permet une action que les règles n'autorisent pas autrement",
    "manoeuvre": "améliore ou débloque une manœuvre offensive (bousculade, croc-en-jambe, désarmement, lutte, feinte, sale coup, renversement)",
    "defense": "réduit ou évite les dégâts et les effets subis (CA, RD, résistance, jets de sauvegarde défensifs)",
    "mobilite": "améliore le déplacement, le positionnement, l'escalade, la nage ou le vol",
    "economie_action": "fait coûter moins d'actions, ou accorde une attaque ou une action de plus",
    "ressource": "augmente le nombre d'utilisations quotidiennes d'une capacité déjà possédée",
    "magie_amelioree": "modifie les sorts ou pouvoirs magiques déjà possédés (métamagie, DD, NLS, portée)",
    "magie_nouvelle": "accorde des sorts ou des pouvoirs magiques que le personnage n'avait pas",
    "creation": "permet de fabriquer des objets",
    "competence": "améliore les tests de compétence ou débloque un nouvel usage d'une compétence",
    "social": "agit sur l'influence, la réputation, l'intimidation ou le déguisement",
    "compagnon": "agit sur un familier, une monture, un compagnon animal, un eidolon ou des suivants",
    "soin": "soigne, restaure ou stabilise",
    "debuff": "impose un état préjudiciable ou un malus à l'adversaire",
    "equipe": "n'a d'effet qu'avec un allié qui coopère (don d'équipe)",
    "prerequis_assoupli": "dispense d'une condition, ou fait compter une chose pour une autre",
    "meta_don": "agit sur les dons eux-mêmes (en accorde, en change les conditions, permet d'en changer)",
}

CIBLES_BONUS = [
    "jet_attaque", "degats", "CA", "jets_de_sauvegarde", "initiative",
    "competence", "DD_des_sorts", "NLS", "PV", "vitesse", "DMD", "DMO",
    "confirmation_critique",
]

CONTEXTES = {
    "melee": "combat au contact",
    "distance": "combat à distance (arcs, arbalètes, armes de jet, armes à feu)",
    "lancer_de_sorts": "lancement de sorts ou usage de pouvoirs magiques",
    "monture": "combat ou déplacement monté",
    "exploration": "voyage, survie, franchissement d'obstacles, pièges",
    "social": "interaction avec des personnages non joueurs",
    "furtivite": "discrétion, embuscade, infiltration",
    "aquatique_ou_aerien": "sous l'eau, en vol, ou en apesanteur",
    "hors_combat": "utile principalement en dehors de tout affrontement",
}

ACTIVATIONS = {
    "passif": "toujours actif, sans rien dépenser ni décider",
    "actif_illimite": "le personnage décide de s'en servir, sans limite du nombre de fois",
    "actif_limite": "usages comptés (par jour, par rencontre, par cible…)",
    "reaction": "se déclenche en réponse à l'action d'un autre (attaque au passage, action immédiate)",
    "long": "demande du temps hors combat (fabrication, rituel, entraînement)",
}

POLYVALENCES = {
    "polyvalent": "s'applique dès qu'on est dans son contexte, sans condition de déclenchement supplémentaire",
    "conditionnel": "demande une circonstance que le joueur peut en général provoquer lui-même",
    "niche": "demande une circonstance rare : type d'adversaire précis, terrain précis, ou build précis",
}

CATEGORIES_OFFICIELLES = [
    "combat", "monstre", "spectacle", "metamagie", "creation_objet",
    "style", "troupe", "mythique", "heritage", "aucune",
]

CONFIANCES = ["haute", "moyenne", "basse"]


def _enum(valeurs, description: str) -> dict:
    return {"type": "string", "enum": list(valeurs), "description": description}


SCHEMA_DON = {
    "type": "object",
    "properties": {
        "nom": {
            "type": "string",
            "description": "Le nom du don, recopié exactement comme il est fourni.",
        },
        "effet_principal": _enum(
            EFFETS, "L'effet dominant du don, et lui seul. Un seul choix."
        ),
        "effets_secondaires": {
            "type": "array",
            "maxItems": 3,
            "items": _enum(EFFETS, ""),
            "description": (
                "Les autres effets réellement présents, au plus 3, sans répéter "
                "effet_principal. Liste vide si le don ne fait qu'une chose."
            ),
        },
        "cible_du_bonus": {
            "type": "array",
            "maxItems": 4,
            "items": {"type": "string", "enum": CIBLES_BONUS},
            "description": (
                "Ce que le bonus chiffré touche. Vide si le don ne donne aucun "
                "bonus chiffré."
            ),
        },
        "valeur_bonus": {
            "type": ["string", "null"],
            "description": (
                "La valeur du bonus telle que le texte l'énonce (« +2 », « +1 par "
                "4 niveaux », « 1d6 »). null si le texte ne chiffre rien."
            ),
        },
        "contexte": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": _enum(CONTEXTES, ""),
            "description": "Où ce don sert. Au plus 3, du plus au moins pertinent.",
        },
        "activation": _enum(ACTIVATIONS, "Comment le don s'active."),
        "utilisations": {
            "type": ["string", "null"],
            "description": (
                "La limite d'usage telle qu'énoncée (« 3/jour », « 1 fois par "
                "rencontre »). null si le texte n'en donne aucune."
            ),
        },
        "polyvalence": _enum(POLYVALENCES, "Étendue des situations où le don sert."),
        "resume_court": {
            "type": "string",
            "maxLength": 120,
            "description": (
                "Ce que le don apporte au joueur, en une phrase de 120 caractères "
                "maximum. Pas de texte d'ambiance, pas de reformulation du nom : "
                "l'effet mécanique. C'est la ligne qu'un joueur lira dans une liste."
            ),
        },
        "mots_cles": {
            "type": "array",
            "maxItems": 5,
            "items": {"type": "string"},
            "description": (
                "Jusqu'à 5 mots que le joueur taperait pour trouver ce don et qui "
                "ne figurent pas déjà dans son nom (« archer », « encaisser », "
                "« lutteur »). Vide plutôt que remplie de mots vagues."
            ),
        },
        "categorie_officielle": {
            "type": ["string", "null"],
            "enum": CATEGORIES_OFFICIELLES + [None],
            "description": (
                "La catégorie officielle du don. Si elle est fournie dans les "
                "données du don, la recopier. Sinon, la déduire, et n'utiliser "
                "« aucune » que si le don n'appartient visiblement à aucun type "
                "spécial."
            ),
        },
        "categorie_officielle_deduite": {
            "type": "boolean",
            "description": (
                "true si tu as déduit categorie_officielle, false si elle t'était "
                "fournie et que tu l'as recopiée."
            ),
        },
        "prerequis_non_modelises": {
            "type": "array",
            "maxItems": 6,
            "items": {"type": "string"},
            "description": (
                "Les prérequis que le TEXTE DÉTAILLÉ énonce et qui manquent aux "
                "« Conditions (catalogue) » fournies. Recopier le prérequis, pas le "
                "commenter. Liste vide si les deux sources disent la même chose — "
                "ce qui est le cas ordinaire. Ne jamais y mettre un prérequis "
                "simplement reformulé."
            ),
        },
        "citations": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": {"type": "string"},
            "description": (
                "La ou les phrases du texte fourni qui justifient effet_principal, "
                "recopiées EXACTEMENT, caractère pour caractère. Pas de coupure au "
                "milieu d'un mot, pas de reformulation."
            ),
        },
        "confiance": _enum(
            CONFIANCES,
            "haute : le texte est explicite. moyenne : il faut interpréter un peu. "
            "basse : le texte est trop vague ou renvoie ailleurs — dis-le au lieu "
            "de deviner.",
        ),
    },
    "required": [
        "nom", "effet_principal", "effets_secondaires", "cible_du_bonus",
        "valeur_bonus", "contexte", "activation", "utilisations", "polyvalence",
        "resume_court", "mots_cles", "categorie_officielle",
        "categorie_officielle_deduite", "prerequis_non_modelises", "citations",
        "confiance",
    ],
    "additionalProperties": False,
}

OUTIL = {
    "name": "enregistrer_dons",
    "description": "Enregistre l'étiquetage de chacun des dons fournis.",
    "input_schema": {
        "type": "object",
        "properties": {
            "dons": {"type": "array", "items": SCHEMA_DON},
        },
        "required": ["dons"],
        "additionalProperties": False,
    },
}


def _liste(d: dict) -> str:
    return "\n".join(f"  - {cle} : {desc}" for cle, desc in d.items())


PROMPT_SYSTEME = f"""Tu étiquettes les dons (feats) de Pathfinder 1re édition pour un outil de \
recherche destiné aux joueurs. Ton étiquetage sert à filtrer 1417 dons : « montre-moi les \
dons qui donnent un bonus chiffré au tir », « ceux qui débloquent une action nouvelle au \
corps à corps ». Un étiquetage approximatif rend le filtre inutilisable, un étiquetage \
prudent reste utile.

RÈGLE ABSOLUE — tu ne juges QUE le texte fourni pour chaque don. Tu ne complètes jamais \
avec ce que tu sais par ailleurs de Pathfinder, même si tu es certain de le savoir, et \
même si le texte te paraît incomplet. Si le texte ne permet pas de conclure, réponds \
`confiance: basse` : c'est une réponse juste, alors qu'une invention est une erreur qui \
sera affichée à un joueur comme un fait.

Comment choisir `effet_principal` — c'est le champ le plus important, et il est UNIQUE. \
Demande-toi : « si ce don ne faisait qu'une seule chose, laquelle ? » Départage ainsi :
  - Le don donne un bonus chiffré ET permet quelque chose de nouveau -> l'effet nouveau \
l'emporte : `bonus_chiffre` est pour les dons dont le bonus EST tout l'apport.
  - Le don fait coûter moins d'actions -> `economie_action`, même s'il en résulte plus de \
dégâts.
  - Le don améliore une manœuvre nommée -> `manoeuvre`, pas `bonus_chiffre`.
  - Le don n'agit que via un allié coopérant -> `equipe`.
  - Le don ne fait qu'accorder plus d'usages d'une capacité existante -> `ressource`.
Les autres effets réels vont dans `effets_secondaires`, au plus 3, jamais un doublon de \
`effet_principal`.

Les valeurs possibles, dont tu ne peux pas sortir :

effet_principal et effets_secondaires
{_liste(EFFETS)}

contexte
{_liste(CONTEXTES)}

activation
{_liste(ACTIVATIONS)}

polyvalence
{_liste(POLYVALENCES)}

`resume_court` est la ligne qu'un joueur lira dans une liste de résultats. Écris l'effet \
mécanique, en français, sans texte d'ambiance et sans répéter le nom du don. \
« Confère +1 d'esquive à la CA. » est bon ; « Un don utile pour se défendre. » est \
inutile ; « Le personnage esquive avec l'agilité d'un félin. » est du remplissage.

`citations` doit contenir des phrases recopiées caractère pour caractère depuis le texte \
fourni. Elles sont vérifiées automatiquement : une citation introuvable dans le texte fait \
rejeter le don entier et le fait retraiter. Recopie, ne reformule pas.

`prerequis_non_modelises` compare deux sources qu'on te donne côte à côte : les Conditions \
du catalogue, et le texte détaillé de la page. N'y mets un prérequis que si le texte \
détaillé en énonce un que les Conditions du catalogue ne mentionnent pas du tout. Le cas \
ordinaire est la liste vide. Une simple différence de formulation n'est pas un prérequis \
manquant.

Traite TOUS les dons du message, dans l'ordre, un objet par don, en recopiant `nom` \
exactement. N'en omets aucun et n'en invente aucun."""


def texte_du_don(nom: str, details: dict, conditions_csv: str | None) -> str:
    """Le bloc fourni au modèle pour un don : tout ce qu'on sait, rien de plus."""
    fiche = details.get(nom) or {}
    lignes = [f"### {nom}"]
    if fiche.get("categorie"):
        lignes.append(f"Catégorie officielle (énoncée par la page) : {fiche['categorie']}")
    else:
        lignes.append("Catégorie officielle : non énoncée par la page — à déduire.")
    lignes.append(f"Conditions (catalogue) : {conditions_csv or '(aucune)'}")
    texte = fiche.get("texte_pour_llm") or fiche.get("raw_text") or "(aucun texte)"
    lignes.append(f"Texte de la page :\n{texte}")
    return "\n".join(lignes)


def _normalise_citation(texte: str) -> str:
    """Comparaison indulgente sur la forme, stricte sur le fond.

    Les apostrophes et guillemets typographiques, les espaces insécables et les
    accents sont normalisés : un modèle qui recopie « l'épée » avec une
    apostrophe droite n'invente rien. Le reste doit correspondre.
    """
    plat = unicodedata.normalize("NFKD", texte)
    plat = "".join(c for c in plat if not unicodedata.combining(c))
    plat = plat.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", plat).strip().lower()


def normaliser_fiche(fiche: dict) -> dict:
    """Ramène chaque champ dans son vocabulaire fermé.

    Les enums du schéma d'outil ne sont **pas** appliqués côté Bedrock : sur les
    1417 dons, une quinzaine de valeurs sont sorties du vocabulaire, et toujours
    en empruntant à un autre axe — `activation: "conditionnel"` (une valeur de
    polyvalence), `effets_secondaires: "furtivite"` (une valeur de contexte). Une
    valeur hors vocabulaire n'est pas une erreur bénigne : elle crée une option de
    facette qui ne correspond à aucune définition, donc un filtre dont personne ne
    sait ce qu'il sélectionne. On l'écarte plutôt que de l'afficher.

    Les champs simples hors vocabulaire tombent à ``None``, ce que le rendu sait
    traiter (la facette masque simplement le don) ; les listes sont épurées.
    """
    fiche = dict(fiche)
    if fiche.get("effet_principal") not in EFFETS:
        fiche["effet_principal"] = None
    if fiche.get("activation") not in ACTIVATIONS:
        fiche["activation"] = None
    if fiche.get("polyvalence") not in POLYVALENCES:
        fiche["polyvalence"] = None
    if fiche.get("confiance") not in CONFIANCES:
        fiche["confiance"] = "moyenne"
    for cle, vocabulaire in (
        ("effets_secondaires", EFFETS),
        ("cible_du_bonus", CIBLES_BONUS),
        ("contexte", CONTEXTES),
    ):
        valeurs = fiche.get(cle) or []
        if not isinstance(valeurs, list):
            valeurs = []
        # `dict.fromkeys` déduplique en gardant l'ordre du modèle, qui range le
        # plus important en premier — l'interface affiche cet ordre tel quel.
        fiche[cle] = [v for v in dict.fromkeys(valeurs) if v in vocabulaire]
    return fiche


def verifier_lot(fiches: list[dict], attendus: dict[str, str]) -> tuple[dict, list[str]]:
    """Ne garde que les fiches vérifiables. Renvoie (retenues, noms à refaire).

    Le schéma de l'outil garantit déjà les enums et les plafonds ; ce qu'il ne
    peut pas garantir, et qu'on contrôle ici, c'est que le don réponde bien au
    nom demandé et que ses citations existent vraiment dans le texte source.
    """
    retenues, a_refaire = {}, []
    vus = set()
    for fiche in fiches:
        # Le schéma contraint la *forme* des objets, pas le fait que le modèle
        # mette bien des objets dans le tableau : un lot sur dix y a glissé une
        # chaîne nue, et l'attribut manquant faisait tomber tout le run. Une
        # entrée non conforme se traite comme un don absent — il sera redemandé.
        if not isinstance(fiche, dict):
            continue
        nom = (fiche.get("nom") or "").strip()
        if nom not in attendus or nom in vus:
            continue  # don inventé, ou répété : on l'ignore, il sera redemandé
        vus.add(nom)
        source = _normalise_citation(attendus[nom])
        citations = fiche.get("citations") or []
        if not citations or any(
            _normalise_citation(c) not in source for c in citations
        ):
            a_refaire.append(nom)
            continue
        secondaires = [
            e for e in (fiche.get("effets_secondaires") or [])
            if e != fiche.get("effet_principal")
        ]
        fiche["effets_secondaires"] = secondaires[:3]
        retenues[nom] = normaliser_fiche(fiche)
    a_refaire.extend(nom for nom in attendus if nom not in vus)
    return retenues, a_refaire


def etiqueter_lot(client, modele: str, blocs: dict[str, str]) -> list[dict]:
    """Un appel API pour un lot de dons. Renvoie les fiches brutes."""
    message = "\n\n".join(blocs.values())
    reponse = client.messages.create(
        model=modele,
        max_tokens=MAX_TOKENS,
        # Point de césure du cache : le prompt système est identique pour les
        # ~140 appels, seuls les dons changent. Bedrock refuse le cache_control
        # de haut niveau, il faut donc le poser explicitement ici.
        system=[
            {
                "type": "text",
                "text": PROMPT_SYSTEME,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        tools=[OUTIL],
        tool_choice={"type": "tool", "name": OUTIL["name"]},
        messages=[{"role": "user", "content": message}],
    )
    fiches = []
    for bloc in reponse.content:
        if bloc.type == "tool_use":
            fiches.extend(bloc.input.get("dons") or [])
    return fiches


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limite", type=int, help="n'étiqueter que N dons (pilote)")
    parser.add_argument("--modele", default=MODELE_DEFAUT)
    parser.add_argument("--region", default=REGION_DEFAUT)
    parser.add_argument("--lot", type=int, default=DONS_PAR_LOT)
    parser.add_argument("--ouvriers", type=int, default=OUVRIERS)
    parser.add_argument(
        "--force", action="store_true", help="réétiqueter même les dons déjà faits"
    )
    parser.add_argument(
        "--normaliser",
        action="store_true",
        help="réappliquer les vocabulaires fermés au fichier existant, sans appel API",
    )
    parser.add_argument(
        "--montrer-prompt",
        action="store_true",
        help="afficher le prompt système et un lot d'exemple, sans appeler l'API",
    )
    args = parser.parse_args()

    details = json.loads(paths.FEAT_DETAILS.read_text(encoding="utf-8"))
    # Conditions *augmentées* (CSV + ajouts curés dans
    # feat_prereq_supplements.json) : c'est à celles-là que la page doit être
    # comparée, sinon le relevé `prerequis_non_modelises` re-signalerait
    # indéfiniment des prérequis déjà intégrés au moteur.
    conditions = {f.name: f.effective_conditions for f in load_catalog()}

    # Le catalogue fait foi pour la liste des dons ; les pages scrapées la
    # complètent. Un don du CSV sans page reste étiquetable via ses Conditions.
    noms = sorted(set(conditions) | set(details))
    blocs = {n: texte_du_don(n, details, conditions.get(n)) for n in noms}

    if args.montrer_prompt:
        print(PROMPT_SYSTEME)
        print("\n" + "=" * 70 + "\nEXEMPLE DE MESSAGE UTILISATEUR\n" + "=" * 70)
        print("\n\n".join(list(blocs.values())[: args.lot]))
        return

    sortie = paths.FEAT_SEMANTICS
    acquis = {}
    if sortie.exists() and not args.force:
        acquis = json.loads(sortie.read_text(encoding="utf-8"))

    # Passe hors ligne : réapplique les vocabulaires au fichier déjà produit, sans
    # aucun appel API. Elle évite de réétiqueter 1417 dons pour rattraper une
    # quinzaine de valeurs égarées, et elle est idempotente.
    if args.normaliser:
        avant = json.dumps(acquis, sort_keys=True)
        acquis = {nom: normaliser_fiche(f) for nom, f in acquis.items()}
        apres = json.dumps(acquis, sort_keys=True)
        sortie.write_text(
            json.dumps(acquis, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        print(
            f"Normalisé : {len(acquis)} dons — "
            + ("aucun changement." if avant == apres else "fichier modifié.")
        )
        return

    restants = [n for n in noms if n not in acquis]
    if args.limite:
        restants = restants[: args.limite]
    if not restants:
        print(f"Rien à faire : {len(acquis)} dons déjà étiquetés dans {sortie}.")
        return

    print(
        f"À étiqueter : {len(restants)} dons sur {len(noms)} "
        f"({len(acquis)} déjà faits) — modèle {args.modele}, lots de {args.lot}"
    )

    from anthropic import AnthropicBedrock

    client = AnthropicBedrock(aws_region=args.region)
    lots = [restants[i : i + args.lot] for i in range(0, len(restants), args.lot)]

    verrou = threading.Lock()
    compteur = {"lots": 0, "dons": 0, "refaire": 0, "echecs": 0}

    def traiter(lot: list[str]) -> None:
        attendus = {n: blocs[n] for n in lot}
        # La vérification est dans le `try` avec l'appel : une réponse mal formée
        # est un mode de défaillance du modèle comme un autre, et laisser
        # l'exception sortir d'ici la faisait remonter par `pool.map` et tuer le
        # run entier — 8 lots réussis perdus pour un neuvième malformé.
        try:
            fiches = etiqueter_lot(client, args.modele, attendus)
            retenues, a_refaire = verifier_lot(fiches, attendus)
        except Exception as exc:  # noqa: BLE001 - un lot raté n'arrête pas le run
            with verrou:
                compteur["echecs"] += 1
                print(
                    f"  ECHEC lot ({len(lot)} dons) : {type(exc).__name__} {exc}",
                    flush=True,
                )
            return
        with verrou:
            acquis.update(retenues)
            compteur["lots"] += 1
            compteur["dons"] += len(retenues)
            compteur["refaire"] += len(a_refaire)
            # Écriture après chaque lot : un run interrompu ne perd rien.
            sortie.write_text(
                json.dumps(acquis, ensure_ascii=False, indent=2, sort_keys=True),
                encoding="utf-8",
            )
            # `flush` explicite : la sortie d'un run de 140 lots part souvent dans
            # un tube ou un fichier, où Python bufferise et ne montre plus rien
            # avant la fin — or c'est justement pendant qu'il tourne qu'on veut
            # voir la progression et les rejets.
            print(
                f"  [{compteur['lots']}/{len(lots)}] {len(retenues)} retenus"
                + (f", {len(a_refaire)} à refaire" if a_refaire else ""),
                flush=True,
            )

    def executer(groupes: list[list[str]]) -> None:
        # Premier lot seul : il écrit le cache du prompt système, dont les suivants
        # profitent. Lancés tous ensemble, ils l'écriraient chacun de leur côté.
        traiter(groupes[0])
        if len(groupes) > 1:
            with ThreadPoolExecutor(max_workers=args.ouvriers) as pool:
                list(pool.map(traiter, groupes[1:]))

    executer(lots)

    # Repli don par don. L'échec observé est **collectif et reproductible** : sur
    # un run complet, deux lots ont vu leurs dix fiches rejetées, et les mêmes
    # vingt dons repassés seuls ont tous été retenus du premier coup. Ce n'est
    # donc pas le don qui résiste mais le lot — le modèle dérive sur un groupe
    # entier. Réessayer à l'identique reproduirait le lot ; on l'éclate.
    manquants = [n for n in restants if n not in acquis]
    if manquants and args.lot > 1:
        print(
            f"\nRepli : {len(manquants)} dons repris un par un "
            "(un lot rejeté en bloc réussit isolément).",
            flush=True,
        )
        lots = [[n] for n in manquants]
        compteur["lots"] = 0
        executer(lots)

    revue = {
        nom: {
            "prerequis_non_modelises": f["prerequis_non_modelises"],
            "conditions_catalogue": conditions.get(nom),
            "conditions_page": (details.get(nom) or {}).get("conditions_detail"),
        }
        for nom, f in sorted(acquis.items())
        if f.get("prerequis_non_modelises")
    }
    paths.FEAT_SEMANTICS_REVIEW.write_text(
        json.dumps(revue, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(
        f"\nÉtiquetés : {len(acquis)}/{len(noms)} — {compteur['refaire']} à refaire, "
        f"{compteur['echecs']} lots en échec"
    )
    print(f"Écrit : {sortie}")
    print(f"Écrit : {paths.FEAT_SEMANTICS_REVIEW} ({len(revue)} dons à relire à la main)")
    manquants = [n for n in noms if n not in acquis]
    if manquants:
        print(f"Non étiquetés ({len(manquants)}) — relancer le script pour les reprendre.")


if __name__ == "__main__":
    main()
