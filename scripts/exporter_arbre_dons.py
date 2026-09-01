"""Exporte, pour un personnage, le graphe élagué des dons qu'il peut viser.

La sortie est un JSON destiné à être rendu par ``web/explorateur_dons.js`` et
réutilisable tel quel dans un site : c'est la frontière données/rendu, aucune
mise en forme n'y figure.

Principe de l'élagage — on ne montre ni le catalogue entier (1417 dons, mur
illisible) ni les seuls dons immédiatement accessibles (on perdrait la notion de
build à construire) : on montre les dons accessibles **maintenant** plus ceux
atteignables en dépensant jusqu'à ``--slots`` emplacements de don, avec le
chemin qui y mène.

L'atteignabilité est calculée par **fermeture itérative** : on évalue le
catalogue, on suppose acquis les dons obtenus, on réévalue, et ainsi de suite.
Cette méthode réutilise ``engine.evaluate_feat`` inchangé — elle hérite donc de
tout son gating (classe, magie, race, alignement…) et gère les ``OrGroup`` sans
que rien de la logique des prérequis soit réimplémenté ici.

Usage :
    python scripts/exporter_arbre_dons.py <nom_du_personnage> [--slots N] [-o f.json]
    python scripts/exporter_arbre_dons.py --classe Guerrier --niveau 6 --race Humain
"""

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf1_dons import paths
from pf1_dons.data_loader import FeatRow, clean_feat_name, load_catalog
from pf1_dons.engine import Character, evaluate_feat, evaluate_requirement
from pf1_dons.models import OrGroup, RequirementType
from pf1_dons.persistence import load_profile

# Un don atteignable au prix de plus de 3 emplacements relève de la planification
# de campagne, pas du choix de niveau : au-delà, le graphe se remplit de branches
# que le personnage n'atteindra jamais.
SLOTS_PAR_DEFAUT = 3

ACCESSIBLE = ("eligible", "manual_check")

# Types officiels de don, tels que définis par le vocabulaire fermé de
# ``scrappers/tag_feat_semantics.py``. Sert à filtrer la catégorie scrapée : la
# rubrique « Catégorie » des pages contient deux valeurs parasites (« dons »,
# « maléfice sanglant ») qui, non filtrées, deviennent des options de facette
# qu'un seul don porte.
CATEGORIES_OFFICIELLES = frozenset(
    {
        "combat", "monstre", "spectacle", "metamagie", "creation_objet",
        "style", "troupe", "mythique", "heritage", "guerrier", "aucune",
    }
)


def _categorie_officielle(detail: dict, tags: dict) -> list[str]:
    """Type officiel du don : la page d'abord, la déduction du LLM à défaut.

    La rubrique « Catégorie » n'existe que sur 543 des 1417 pages ; s'en tenir à
    elle laissait 62 % du catalogue hors de cette facette. L'étiquetage la déduit
    pour tous, mais une valeur attestée par la source primera toujours sur une
    valeur inférée.
    """
    scrapees = [c for c in (detail.get("categories") or []) if c in CATEGORIES_OFFICIELLES]
    if scrapees:
        return sorted(set(scrapees))
    deduite = tags.get("categorie_officielle")
    return [deduite] if deduite in CATEGORIES_OFFICIELLES else []


def _prereqs_dons(feat: FeatRow) -> list[list[str]]:
    """Prérequis de type don, en liste d'alternatives.

    Un ``OrGroup`` donne une liste à plusieurs éléments (au choix), un
    prérequis simple une liste à un seul élément (obligatoire).
    """
    groupes = []
    for req in feat.parsed.requirements:
        options = req.options if isinstance(req, OrGroup) else [req]
        noms = [
            clean_feat_name(opt.payload["feat_name"])
            for opt in options
            if opt.type is RequirementType.FEAT
        ]
        if noms:
            groupes.append(noms)
    return groupes


def _avec_dons(character: Character, dons: set[str]) -> Character:
    return Character(
        character_class=character.character_class,
        level=character.level,
        race=character.race,
        size=character.size,
        ability_scores=character.ability_scores,
        known_feats=dons,
        skill_ranks=character.skill_ranks,
        alignment=character.alignment,
        deity=character.deity,
    )


def calculer_vagues(
    character: Character, catalog: list[FeatRow], slots: int
) -> tuple[dict[str, int], dict[str, object]]:
    """Fermeture itérative : vague N = dons ouverts après N dons dépensés.

    Renvoie la vague de chaque don atteignable, et le résultat d'éligibilité
    obtenu à la vague où il s'ouvre (donc ses `manual_check` résiduels).
    """
    acquis = set(character.known_feats or set())
    vague_de: dict[str, int] = {}
    resultat_de: dict[str, object] = {}

    for vague in range(1, slots + 1):
        courant = _avec_dons(character, set(acquis))
        nouveaux = {}
        for feat in catalog:
            if feat.name in vague_de or feat.name in acquis:
                continue
            resultat = evaluate_feat(feat, courant)
            if resultat.status in ACCESSIBLE:
                nouveaux[feat.name] = resultat
        if not nouveaux:
            break
        for nom, resultat in nouveaux.items():
            vague_de[nom] = vague
            resultat_de[nom] = resultat
        acquis |= set(nouveaux)

    return vague_de, resultat_de


def calculer_couts(
    catalog: dict[str, FeatRow], vague_de: dict[str, int], acquis: set[str]
) -> dict[str, int]:
    """Coût exact en emplacements : taille de l'ensemble minimal de dons à prendre.

    La vague n'est qu'une borne inférieure — un don exigeant deux prérequis
    distincts de vague 1 coûte 3 emplacements, pas 2. On calcule donc la
    fermeture des prérequis manquants, en dédupliquant les branches partagées.
    """
    memo: dict[str, frozenset[str]] = {}

    def ensemble(nom: str, pile: frozenset[str]) -> frozenset[str]:
        if nom in acquis:
            return frozenset()
        if nom in memo:
            return memo[nom]
        if nom in pile or nom not in vague_de:  # cycle, ou branche inatteignable
            return frozenset({nom})

        requis = frozenset({nom})
        feat = catalog.get(nom)
        if feat is not None:
            for alternatives in _prereqs_dons(feat):
                candidats = [a for a in alternatives if a in acquis or a in vague_de]
                if not candidats:
                    continue
                # Pour un OU, on retient l'alternative la moins chère.
                requis |= min(
                    (ensemble(a, pile | {nom}) for a in candidats), key=len
                )
        memo[nom] = requis
        return requis

    return {nom: len(ensemble(nom, frozenset())) for nom in vague_de}


def construire_graphe(
    catalog: list[FeatRow], restreint_a: set[str] | None = None
) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """Arêtes « prérequis -> don », éventuellement restreintes à un sous-ensemble.

    ``restreint_a`` est ce qui distingue le graphe du **catalogue** de celui de
    la **vue** : un don dont le prérequis n'est pas retenu n'a pas de parent
    dans la vue, même s'il en a un dans le catalogue.
    """
    enfants: dict[str, set[str]] = defaultdict(set)
    parents: dict[str, set[str]] = defaultdict(set)
    for feat in catalog:
        if restreint_a is not None and feat.name not in restreint_a:
            continue
        for alternatives in _prereqs_dons(feat):
            for nom in alternatives:
                if restreint_a is not None and nom not in restreint_a:
                    continue
                enfants[nom].add(feat.name)
                parents[feat.name].add(nom)
    return enfants, parents


def calculer_leviers(noms: set[str], enfants: dict[str, set[str]]) -> dict[str, int]:
    """Levier d'un don = nombre de dons qu'il débloque, directement ou non.

    C'est le proxy de valeur le plus honnête dont on dispose : le CSV ne dit
    rien de la puissance d'un don, mais « Attaque en puissance » ouvrant 40
    dons est un fait structurel, pas une opinion.

    Le levier n'a de sens que **relativement au graphe dont il est tiré**. Sur
    le catalogue entier il mesure la place du don dans les règles ; sur la vue
    il mesure ce que le personnage débloque vraiment. Confondre les deux est ce
    qui faisait annoncer « débloque 2 dons » à un nœud qui n'en montrait aucun.
    """
    leviers = {}
    for nom in noms:
        vus, pile = set(), [nom]
        while pile:
            courant = pile.pop()
            for enfant in enfants.get(courant, ()):
                if enfant not in vus:
                    vus.add(enfant)
                    pile.append(enfant)
        leviers[nom] = len(vus)
    return leviers


def calculer_voies(
    noms: set[str],
    leviers: dict[str, int],
    parents: dict[str, set[str]],
) -> dict[str, str]:
    """Étiquette chaque don par sa « voie » : le hub racine dont il descend.

    Sans ça, la composante géante s'affiche en un seul bloc et n'apprend rien.
    Le hub dominant (celui de plus fort levier parmi les ancêtres racines)
    redonne le découpage qu'un joueur a en tête : voie de la lutte, du tir…

    Calculé **sur le graphe de la vue**, jamais sur le catalogue : une voie
    nommée d'après un don que le personnage ne peut pas atteindre étiquetait ses
    dons d'un nom qui n'apparaissait nulle part à l'écran.
    """
    voies = {}
    for nom in noms:
        ancetres, pile = set(), [nom]
        while pile:
            courant = pile.pop()
            for parent in parents.get(courant, ()):
                if parent not in ancetres:
                    ancetres.add(parent)
                    pile.append(parent)
        racines = [a for a in ancetres if not parents.get(a)]
        if racines:
            voies[nom] = max(racines, key=lambda n: (leviers.get(n, 0), n))
        elif leviers.get(nom):
            voies[nom] = nom  # racine elle-même, et elle a des descendants
    return voies


def construire_export(
    character: Character, label: str, catalog: list[FeatRow], slots: int
) -> dict:
    par_nom = {f.name: f for f in catalog}
    acquis = set(character.known_feats or set())
    vague_de, resultat_de = calculer_vagues(character, catalog, slots)
    couts = calculer_couts(par_nom, vague_de, acquis)

    retenus = set(vague_de) | acquis

    # Deux graphes, et c'est délibéré. Celui du catalogue dit la place du don
    # dans les règles ; celui de la vue dit ce que ce personnage-ci débloque.
    # Les mélanger produisait un nœud affiché seul qui annonçait « débloque 2
    # dons » : les deux étaient hors de sa portée, donc absents de l'écran.
    enfants_cat, _ = construire_graphe(catalog)
    enfants_vue, parents_vue = construire_graphe(catalog, retenus)
    leviers_cat = calculer_leviers({f.name for f in catalog}, enfants_cat)
    leviers_vue = calculer_leviers(retenus, enfants_vue)
    voies = calculer_voies(retenus, leviers_vue, parents_vue)
    tailles_voie = Counter(v for v in voies.values() if v)

    details = {}
    if paths.FEAT_DETAILS.exists():
        details = json.loads(paths.FEAT_DETAILS.read_text(encoding="utf-8"))
    semantiques = {}
    if paths.FEAT_SEMANTICS.exists():
        semantiques = json.loads(paths.FEAT_SEMANTICS.read_text(encoding="utf-8"))

    noeuds = []
    for nom in sorted(retenus):
        feat = par_nom.get(nom)
        resultat = resultat_de.get(nom)
        detail = details.get(nom) or {}
        tags = semantiques.get(nom) or {}
        enfants_atteignables = sorted(enfants_vue.get(nom, ()))
        noeuds.append(
            {
                "nom": nom,
                "acquis": nom in acquis,
                # "accessible" = prenable dès maintenant ; "a_planifier" = il faut
                # d'abord dépenser des emplacements sur ses prérequis.
                "statut": resultat.status if resultat else "acquis",
                "vague": vague_de.get(nom, 0),
                "cout": couts.get(nom, 0),
                # `levier` = ce que le don débloque **dans cette vue**, donc ce que
                # le graphe montre effectivement. `levier_catalogue` = le fait
                # structurel, toutes portées confondues. L'écart entre les deux est
                # une information en soi (« ce don ouvre plus loin que tu ne vois »).
                "levier": leviers_vue.get(nom, 0),
                "levier_catalogue": leviers_cat.get(nom, 0),
                # La liste, pas seulement le compte : annoncer « débloque 6 dons »
                # sans pouvoir les nommer n'est pas une information exploitable.
                "debloque": enfants_atteignables,
                "prerequis_dons": sorted(parents_vue.get(nom, ())),
                "voie": voies.get(nom),
                "voie_taille": tailles_voie.get(voies.get(nom), 0),
                # Isolé = sans aucune arête dans le graphe exporté. Défini sur la
                # vue, sinon des dons annoncés « liés » s'affichaient en points
                # solitaires au milieu du graphe.
                "isole": not enfants_vue.get(nom) and not parents_vue.get(nom),
                "source": feat.source if feat else None,
                # Les conditions telles que le moteur les a évaluées : CSV plus
                # les ajouts curés depuis la page du don (feat_prereq_supplements).
                "conditions": feat.effective_conditions if feat else None,
                "conditions_ajoutees": list(feat.prereq_supplements) if feat else [],
                "avantages": (feat.benefits if feat else None),
                "description": detail.get("description"),
                "categorie_officielle": _categorie_officielle(detail, tags),
                # Étiquetage sémantique (scrappers/tag_feat_semantics.py). Absent
                # tant que la passe n'a pas tourné : l'export reste valide sans.
                "effet_principal": tags.get("effet_principal"),
                "effets_secondaires": tags.get("effets_secondaires") or [],
                "cible_du_bonus": tags.get("cible_du_bonus") or [],
                "valeur_bonus": tags.get("valeur_bonus"),
                "contexte": tags.get("contexte") or [],
                "activation": tags.get("activation"),
                "utilisations": tags.get("utilisations"),
                "polyvalence": tags.get("polyvalence"),
                "resume_court": tags.get("resume_court"),
                "mots_cles": tags.get("mots_cles") or [],
                "a_verifier": [r for r in (resultat.reasons if resultat else [])],
            }
        )

    aretes = []
    for nom in sorted(retenus):
        feat = par_nom.get(nom)
        if feat is None:
            continue
        for alternatives in _prereqs_dons(feat):
            au_choix = len(alternatives) > 1
            for prereq in alternatives:
                if prereq in retenus:
                    aretes.append({"de": prereq, "vers": nom, "au_choix": au_choix})

    return {
        "personnage": {
            "label": label,
            "classe": character.character_class,
            "niveau": character.level,
            "race": character.race,
            "dons_acquis": sorted(acquis),
            "slots_explores": slots,
        },
        "noeuds": noeuds,
        "aretes": aretes,
        # Les voies, déjà comptées et triées : le rendu n'a pas à recalculer
        # l'agrégat pour peupler un menu, et peut regrouper les plus petites
        # sans rien redériver.
        "voies": [
            {"nom": nom, "dons": taille}
            for nom, taille in sorted(
                tailles_voie.items(), key=lambda kv: (-kv[1], kv[0])
            )
        ],
        "resume": {
            "dons_catalogue": len(catalog),
            "dons_retenus": len(noeuds),
            "accessibles_maintenant": sum(1 for n in noeuds if n["vague"] == 1),
            "a_planifier": sum(1 for n in noeuds if n["vague"] > 1),
            "isoles": sum(1 for n in noeuds if n["isole"]),
            "dons_etiquetes": sum(1 for n in noeuds if n["effet_principal"]),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", nargs="?", help="personnage déjà sauvegardé")
    parser.add_argument("--classe")
    parser.add_argument("--niveau", type=int)
    parser.add_argument("--race")
    parser.add_argument(
        "--slots",
        type=int,
        default=SLOTS_PAR_DEFAUT,
        help=f"emplacements de don à explorer en avant (défaut : {SLOTS_PAR_DEFAUT})",
    )
    parser.add_argument("-o", "--output", help="fichier JSON de sortie")
    args = parser.parse_args()

    if args.name:
        profile = load_profile(args.name)
        character = profile.to_character()
        label = f"{profile.name} ({profile.character_class} {profile.level})"
    elif args.classe and args.niveau:
        character = Character(
            character_class=args.classe, level=args.niveau, race=args.race
        )
        label = f"{args.classe} niveau {args.niveau}" + (
            f", {args.race}" if args.race else ""
        )
    else:
        parser.error("fournir un nom de personnage, ou --classe et --niveau")

    export = construire_export(character, label, load_catalog(), args.slots)
    texte = json.dumps(export, ensure_ascii=False, indent=2)

    if args.output:
        Path(args.output).write_text(texte, encoding="utf-8")
        resume = export["resume"]
        print(
            f"Écrit : {args.output} — {resume['dons_retenus']} dons retenus sur "
            f"{resume['dons_catalogue']} ({resume['accessibles_maintenant']} accessibles "
            f"maintenant, {resume['a_planifier']} à planifier), {len(export['aretes'])} liens"
        )
    else:
        sys.stdout.write(texte)


if __name__ == "__main__":
    main()
