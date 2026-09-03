"""Génère le contrat de données du moteur d'éligibilité (Wave 06).

Ce script est un outil de fabrication, pas un composant du pipeline
d'éligibilité: il lit le catalogue déjà analysé par `src/pf_dons/parser.py`
(qui reste la seule source de vérité pour la syntaxe française des
Conditions) et sérialise sa sortie -- ainsi que les tables de gating déjà
curées à la main -- dans `data/schemas/moteur_dons.schema.json` et un
sous-ensemble restreint dans `web/fixtures/moteur_dons.json`.

Aucune règle d'éligibilité n'est réimplémentée ici: chaque valeur publiée est
soit copiée verbatim depuis un fichier `data/**/*.json` déjà curé, soit lue
directement sur les objets `Requirement`/`OrGroup` produits par
`parse_conditions`. Les deux tables `RACE_WEAPON_PROFICIENCY` et
`RACE_WEAPON_RECLASSIFICATION` sont recopiées à la main depuis
`src/pf_dons/engine.py` (elles y sont des littéraux Python, pas dérivées).

Usage:
    python scripts/build_moteur_dons_contract.py
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from pf_dons import data_loader, paths  # noqa: E402
from pf_dons.class_progression import CLASS_BBA_PROGRESSION  # noqa: E402
from pf_dons.models import OrGroup, Requirement, RequirementType  # noqa: E402

# --- Recopiées à la main depuis src/pf_dons/engine.py (littéraux Python) ---

RACE_WEAPON_PROFICIENCY: dict[str, list[str]] = {
    "elfe": ["arc long"],
    "nain": ["marteau de guerre"],
    "halfelin": ["fronde"],
}

RACE_WEAPON_RECLASSIFICATION: dict[str, str] = {
    "nain": "naine",
}

RACE_MAGIC_KEYWORDS = [
    "comme un pouvoir magique",
    "comme des pouvoirs magiques",
    "niveau de lanceur de sorts",
]

GENRES_BLOQUANTS = [
    "racial_trait",
    "creature_type",
    "anatomy",
    "spellcasting",
    "deity",
    "alignment",
    "mythic",
    "class_ability",
    "no_class_levels",
]

GENRES_NON_BLOQUANTS = [
    "class_ability_unmapped",
    "proficiency",
    "feat",
    "background",
    "fragment",
    "generic",
]

# Sémantique du tri-état par RequirementType : ce que signifie `None`
# (jamais `False`) pour chacun des 13 types. Documentation vivante du
# principe de sûreté du dépôt : une sous-attribution (`False` à tort) est
# bien plus grave qu'une sur-attribution (`None` à tort).
SEMANTIQUE_NONE = {
    "ability_score": (
        "Aucun score de caractéristique fourni pour le personnage : "
        "indéterminable, jamais faux. Si un score EST fourni, la comparaison "
        "est déterministe (True/False)."
    ),
    "bba": (
        "BBA toujours dérivable dès que classe+niveau sont connus (via "
        "progression_bba) : ce type ne produit donc jamais None en pratique."
    ),
    "level": (
        "Niveau de personnage toujours connu par construction : ce type ne "
        "produit donc jamais None en pratique."
    ),
    "level_exact": (
        "Même remarque que level : jamais None en pratique, le niveau du "
        "personnage étant toujours renseigné."
    ),
    "class_level": (
        "Niveau toujours connu ; seule la correspondance de classe est "
        "testée, donc jamais None en pratique (True/False déterministe)."
    ),
    "skill_ranks": (
        "Rangs de compétence non fournis explicitement pour cette compétence "
        "-> indéterminable. NB : sans skill_ranks explicite, l'hypothèse "
        "optimiste (rangs = niveau) fait passer ce prérequis, ce n'est pas "
        "un None caché."
    ),
    "caster_level": (
        "La VALEUR numérique du NLS n'est jamais dérivable automatiquement "
        "-> None, sauf le cas particulier ci-dessous qui tranche en False."
    ),
    "size": (
        "Taille non fournie explicitement et race absente/inconnue -> "
        "indéterminable (aucune taille dérivable)."
    ),
    "feat": (
        "Liste des dons déjà connus non fournie pour le personnage -> "
        "indéterminable ; si elle est fournie, le test est déterministe."
    ),
    "race": (
        "Race non fournie pour le personnage -> indéterminable ; si elle "
        "est fournie, la comparaison est déterministe."
    ),
    "class": (
        "Toujours déterministe : la classe du personnage est une donnée "
        "obligatoire, jamais None en pratique."
    ),
    "class_feature_text": (
        "Texte de capacité de classe non automatisable en détail (quelle "
        "capacité précise, quel niveau) -> None, SAUF si payload.gating ou "
        "payload.implied_classes permet de trancher une classe incompatible "
        "(-> False) ou un hit de gating bloquant satisfait/insatisfait "
        "(-> True/False). Le reste (nuance interne à la classe) reste None."
    ),
    "unparsed": (
        "Segment non reconnu par aucune règle de classification -> None par "
        "défaut, avec les mêmes échappatoires (implied_classes, gating) que "
        "class_feature_text."
    ),
}

CASTER_LEVEL_FALSE_NOTE = (
    "caster_level ne résout à False QUE si la classe est connue ET "
    "explicitement non-lanceuse dans lanceurs (class_caster_info.json) ET "
    "que la race ne donne pas accès à la magie (magie_innee=false ou "
    "race absente/inconnue). Une classe absente de `lanceurs` -> toujours "
    "None, jamais deviné à False."
)

COUVRE_TOUT_LE_SEGMENT_NOTE = (
    "Un hit de gating dont couvre_tout_le_segment=true ET dont le verdict "
    "est satisfait (True) rend l'exigence entière True au lieu de retomber "
    "en manual_check ; ceci ne s'applique QUE si le hit est aussi blocking."
)

PROFICIENCY_NOTE = (
    "Sur les 31 entrées `proficiency` de `gating.entries`, seules celles "
    "dont `blocking=true` (18, arme/bouclier nommé) sont opposables ; les "
    "13 `blocking=false` restantes dépendent d'un choix du joueur non "
    "tracé et doivent rester en manual_check."
)

CHASSEUR_DE_VAMPIRE_NOTE = (
    "`chasseur de vampire` est ABSENTE de `maitrises` (comme de "
    "`lanceurs`) : aucune classe officielle Pathfinder 1e de ce nom "
    "n'existe. Absence de clé = manual_check ('classe inconnue'), jamais "
    "'aucune maîtrise/aucune magie' (qui donnerait ineligible à tort)."
)


def normalize(text: str) -> str:
    t = unicodedata.normalize("NFKD", text)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return t.lower().strip()


def slugify(name: str) -> str:
    base = normalize(name)
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    return base or "don"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def requirement_to_exigence(req: Requirement) -> dict:
    return {
        "type": req.type.value,
        "charge": req.payload,
        "verif_manuelle": req.needs_manual_check,
        "segment": req.raw_text,
    }


def or_group_to_groupe_ou(group: OrGroup) -> dict:
    return {"options": [requirement_to_exigence(o) for o in group.options]}


def req_or_group_to_json(item) -> dict:
    if isinstance(item, OrGroup):
        return or_group_to_groupe_ou(item)
    return requirement_to_exigence(item)


def annoter_couverture(exigences_json: list[dict]) -> None:
    """Ajoute `couvre_tout_le_segment` à chaque hit de gating, en place.

    Reproduit `engine.py::evaluate_requirement` : le hit "couvre tout le
    segment" quand son `keyword` est strictement égal au texte normalisé du
    segment entier (`payload["text"]`, sinon le `raw_text`).
    """
    for item in exigences_json:
        options = item.get("options")
        targets = options if options is not None else [item]
        for target in targets:
            charge = target.get("charge", {})
            gating = charge.get("gating")
            if not gating:
                continue
            texte = charge.get("text", target.get("segment", ""))
            normalized_text = normalize(texte)
            for hit in gating:
                hit["couvre_tout_le_segment"] = hit["keyword"] == normalized_text


def collect_requirement_types(exigences_json: list[dict]) -> set[str]:
    found = set()
    for item in exigences_json:
        if "options" in item:
            for opt in item["options"]:
                found.add(opt["type"])
        else:
            found.add(item["type"])
    return found


def build_full_contract() -> tuple[dict, list]:
    catalog = data_loader.load_catalog()

    gating_raw = load_json(paths.PREREQ_GATING)
    class_ability_map_raw = load_json(paths.CLASS_ABILITY_MAP)
    class_caster_info_raw = load_json(paths.CLASS_CASTER_INFO)
    class_proficiencies_raw = load_json(paths.CLASS_PROFICIENCIES)
    feat_class_restriction_raw = load_json(paths.FEAT_CLASS_RESTRICTION)
    feat_magic_info_raw = load_json(paths.FEAT_MAGIC_INFO)
    feat_creature_affinity_raw = load_json(paths.FEAT_CREATURE_AFFINITY)
    races_raw = load_json(paths.RACES)

    conditions: dict[str, dict] = {}
    aretes: list[dict] = []
    prerequis_dons: dict[str, list[list[str]]] = {}

    all_types_seen: set[str] = set()

    for row in catalog:
        slug = slugify(row.name)
        exigences_json = [req_or_group_to_json(r) for r in row.parsed.requirements]
        annoter_couverture(exigences_json)
        all_types_seen |= collect_requirement_types(exigences_json)

        conditions[slug] = {
            "brut": row.raw_conditions,
            "effectif": row.effective_conditions,
            "exigences": exigences_json,
        }

        # Graphe de prérequis : uniquement les exigences de type feat, et les
        # OrGroup dont TOUTES les options sont des noms de dons (les OU
        # mixtes -- ex. "Endurance ou 5 rangs en Survie" -- ne sont pas des
        # arêtes univoques, ils vont dans prerequis_dons quand toutes les
        # options SONT des dons).
        for req in row.parsed.requirements:
            if isinstance(req, Requirement) and req.type == RequirementType.FEAT:
                prereq_slug = slugify(req.payload["feat_name"])
                aretes.append({"de": prereq_slug, "vers": slug})
            elif isinstance(req, OrGroup):
                feat_opts = [o for o in req.options if o.type == RequirementType.FEAT]
                if feat_opts and len(feat_opts) == len(
                    [o for o in req.options if not o.payload.get("fragment")]
                ):
                    # Slugifié comme `aretes`, jamais le nom brut : le parser
                    # matche les noms de dons sans l'astérisque des
                    # répétables, alors que le nom d'affichage la porte — un
                    # nom brut ici pointerait dans le vide pour ces dons-là.
                    prerequis_dons.setdefault(slug, []).append(
                        [slugify(o.payload["feat_name"]) for o in feat_opts]
                    )

    races: dict[str, dict] = {}
    for key, entry in races_raw.items():
        parts = []
        for trait in entry.get("traits", []):
            parts.append(trait.get("name", ""))
            parts.append(trait.get("description", ""))
        texte_traits = normalize(" | ".join(parts))
        magie_innee = any(normalize(k) in texte_traits for k in RACE_MAGIC_KEYWORDS)
        races[key] = {
            "taille": entry.get("size"),
            "texte_traits": texte_traits,
            "magie_innee": magie_innee,
        }

    schema = {
        "version": 1,
        "genere_le": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "conditions": conditions,
        "aretes": aretes,
        "prerequis_dons": prerequis_dons,
        "gating": gating_raw,
        "capacites_de_classe": class_ability_map_raw,
        "lanceurs": class_caster_info_raw,
        "maitrises": class_proficiencies_raw,
        "magie_des_dons": feat_magic_info_raw,
        "affinite_creature": feat_creature_affinity_raw,
        "restriction_de_classe": feat_class_restriction_raw,
        "races": races,
        "armes_raciales": RACE_WEAPON_PROFICIENCY,
        "reclassement_racial": RACE_WEAPON_RECLASSIFICATION,
        "magie_raciale_mots_cles": RACE_MAGIC_KEYWORDS,
        "progression_bba": CLASS_BBA_PROGRESSION,
        "genres_bloquants": GENRES_BLOQUANTS,
        "genres_non_bloquants": GENRES_NON_BLOQUANTS,
        "semantique_none": SEMANTIQUE_NONE,
        "notes": {
            "caster_level_false": CASTER_LEVEL_FALSE_NOTE,
            "couvre_tout_le_segment": COUVRE_TOUT_LE_SEGMENT_NOTE,
            "proficiency": PROFICIENCY_NOTE,
            "chasseur_de_vampire": CHASSEUR_DE_VAMPIRE_NOTE,
        },
    }

    missing_types = {t.value for t in RequirementType} - all_types_seen
    print(f"[build_moteur_dons_contract] types vus dans le catalogue complet : "
          f"{len(all_types_seen)}/13 ; manquants : {sorted(missing_types)}",
          file=sys.stderr)

    return schema, catalog


# Les 24 dons de la fixture web/fixtures/moteur_dons.json, choisis pour
# couvrir chacun des cas listés dans le plan 06 (voir le commentaire de
# `build_fixture` ci-dessous pour le détail du "pourquoi" par don).
FIXTURE_SLUGS = [
    "acrobate-des-corniches",
    "allie-naturel-spontane",
    "abondance-de-revelations",
    "adversaire-familier",
    "action-feroce",
    "danse-du-derviche",
    "armure-de-predilection",
    "arme-de-predilection-superieure",
    "aide-etrange",
    "attaque-magique",
    "bebe-feerique",
    "capture",
    "couteau-de-sorciere",
    "ailes-d-ange",
    "endurance",
    "attaque-en-puissance",
    "attaque-en-finesse",
    "arme-de-predilection",
    "science-de-la-lutte",
    "combat-a-deux-armes",
    "course",
    "tir-de-precision",
    "esquive",
    "robustesse",
]


def build_fixture(schema: dict) -> dict:
    """Sous-ensemble de `schema` restreint aux 24 dons de FIXTURE_SLUGS.

    Pourquoi chacun est là (voir Verification Criteria du plan 06) :
      - acrobate-des-corniches : un OrGroup (options class_feature_text/unparsed
        toutes deux racial_trait, couvre_tout_le_segment=true).
      - allie-naturel-spontane : payload.fragment=true dans un OrGroup.
      - abondance-de-revelations : payload.implied_classes=['oracle'].
      - adversaire-familier : gating no_class_levels, couvre_tout_le_segment=true.
      - action-feroce : gating racial_trait bloquant, couvre_tout_le_segment=true.
      - danse-du-derviche : gating proficiency BLOQUANT (arme nommée : cimeterre).
      - armure-de-predilection : gating proficiency NON bloquant (choix du joueur).
      - arme-de-predilection-superieure : brut != effectif (feat_prereq_supplements
        y ajoute "BBA +1").
      - aide-etrange, attaque-magique : type caster_level (le second combine
        caster_level et un gating spellcasting bloquant).
      - bebe-feerique : type level_exact.
      - capture : type size.
      - couteau-de-sorciere : type class.
      - ailes-d-ange : type level.
      - endurance, attaque-en-puissance, attaque-en-finesse, arme-de-predilection,
        science-de-la-lutte, combat-a-deux-armes, course, tir-de-precision,
        esquive, robustesse : dons "hubs" fréquemment cités comme prérequis
        (type feat, ability_score, bba, skill_ranks), pour que `aretes` et
        `prerequis_dons` restreints à la fixture soient non triviaux (ex.
        arme-de-predilection -> arme-de-predilection-superieure,
        attaque-en-finesse -> danse-du-derviche).
    """
    slugs = set(FIXTURE_SLUGS)
    conditions = {s: schema["conditions"][s] for s in FIXTURE_SLUGS}
    aretes = [a for a in schema["aretes"] if a["de"] in slugs and a["vers"] in slugs]
    prerequis_dons = {}
    for slug in FIXTURE_SLUGS:
        alts = schema["prerequis_dons"].get(slug)
        if alts:
            prerequis_dons[slug] = alts

    fixture = dict(schema)
    fixture["conditions"] = conditions
    fixture["aretes"] = aretes
    fixture["prerequis_dons"] = prerequis_dons
    fixture["_fixture_slugs"] = FIXTURE_SLUGS
    return fixture


def main() -> None:
    schema, catalog = build_full_contract()

    out_schema = REPO_ROOT / "data" / "schemas" / "moteur_dons.schema.json"
    out_schema.parent.mkdir(parents=True, exist_ok=True)
    out_schema.write_text(
        json.dumps(schema, ensure_ascii=False, indent=2, sort_keys=False),
        encoding="utf-8",
    )
    print(f"Ecrit {out_schema} ({len(schema['conditions'])} dons)")

    fixture = build_fixture(schema)
    out_fixture = REPO_ROOT / "web" / "fixtures" / "moteur_dons.json"
    out_fixture.parent.mkdir(parents=True, exist_ok=True)
    out_fixture.write_text(
        json.dumps(fixture, ensure_ascii=False, indent=2, sort_keys=False),
        encoding="utf-8",
    )
    print(f"Ecrit {out_fixture} ({len(fixture['conditions'])} dons)")


if __name__ == "__main__":
    main()
