import json
import re
import unicodedata

from .class_progression import CLASS_BBA_PROGRESSION
from .models import OrGroup, ParsedConditions, Requirement, RequirementType

KNOWN_RACES = {
    # Races de base
    "demi-elfe", "demi-orque", "elfe", "gnome", "halfelin", "humain", "nain",
    # Races additionnelles
    "aasimar", "dhampir", "drow", "fetchelin", "gobelin", "hobgobelin",
    "homme-felin", "homme-rat", "ifrit", "kobold", "ondin", "orque",
    "oreade", "sylphe", "tengu", "tieffelin",
    # Races extraordinaires
    "aquatique", "changelin", "duergar", "grippli", "homme-poisson",
    "kitsune", "nagaji", "samsaran", "strix", "suli", "svirfneblin",
    "vanara", "vishkanya", "wayang",
    # Races monstrueuses
    "androide", "changepeau", "elfe aquatique", "gathelain", "ghoran",
    "gobelin simiesque", "kasatha", "lashunta", "syrinx", "trox",
    "triaxien", "virebois", "wivaran",
    # Races monstrueuses fréquentes en prérequis de dons (bestiaire)
    "homme-serpent", "ogre", "troll",
}

KNOWN_CLASSES = set(CLASS_BBA_PROGRESSION.keys())

with open("Data/class_ability_map.json", encoding="utf-8") as f:
    CLASS_ABILITY_MAP = json.load(f)["entries"]

# Nature (trait racial, type de créature, anatomie, incantation, divinité,
# alignement…) des prérequis que class_ability_map.json classe
# `no_single_class`. Voir scripts/curate_prereq_gating.py.
with open("Data/prereq_gating.json", encoding="utf-8") as f:
    PREREQ_GATING = json.load(f)["entries"]

# Les mots-clés très courts produiraient des faux positifs même en recherche
# par frontière de mot ("un", "int"…) : on ne les considère pas.
_MIN_GATING_KEYWORD_LEN = 5
GATING_BY_KEYWORD = {
    entry["keyword"]: entry
    for entry in PREREQ_GATING
    if entry["kind"] != "fragment" and len(entry["keyword"]) >= _MIN_GATING_KEYWORD_LEN
}
# Mots-clés que la curation a identifiés comme de purs artefacts de découpage
# ("familier", "monture", "plus"…) : dans une alternative « A ou B », une
# option réduite à un tel fragment ne doit pas rendre le groupe indécidable.
FRAGMENT_KEYWORDS = {
    entry["keyword"] for entry in PREREQ_GATING if entry["kind"] == "fragment"
}

# Suffixes comparatifs : « ou plus » n'introduit pas une alternative mais un
# plancher/plafond ("Trois attaques naturelles ou plus", "5 DV ou plus").
COMPARATIVE_SUFFIX_RE = re.compile(
    r"\s+ou\s+plus(\s+(?:petite?|grande?|eleve?e?))?\s*$", re.IGNORECASE
)

ABILITY_ABBREVIATIONS = {"For", "Dex", "Con", "Int", "Sag", "Cha"}

EMPTY_MARKERS = {"", "-", "—", "aucun", "aucune"}

LEVEL_RE = re.compile(r"niveau (\d+)", re.IGNORECASE)
# "Personnage de niveau 1 uniquement", "don uniquement disponible au niveau 1"
LEVEL_EXACT_RE = re.compile(r"niveau (\d+)\s+uniquement", re.IGNORECASE)
# "Occultiste de niveau 3", "guerrier de niveau 3" : un prérequis de niveau
# DANS une classe donnée, que LEVEL_RE seul lisait comme un simple niveau de
# personnage (rendant ces dons éligibles pour n'importe quelle classe).
CLASS_LEVEL_RE = re.compile(r"^(.+?)\s+de niveau (\d+)$", re.IGNORECASE)
# "taille P ou plus petit", "Taille TG ou plus" : à reconnaître avant le
# découpage sur " ou ", qui sinon casse la comparaison en deux options.
# S'applique au texte normalisé (sans accents).
SIZE_MAX_RE = re.compile(r"^taille (tp|p|m|g|tg|c) ou plus petite?$")
SIZE_MIN_RE = re.compile(r"^taille (tp|p|m|g|tg|c) ou plus(?: grande?)?$")
SIZE_ORDER = ["TP", "P", "M", "G", "TG", "C"]
BBA_RE = re.compile(r"BBA\s*\+?(\d+)", re.IGNORECASE)
NLS_RE = re.compile(r"NLS\s*\+?(\d+)", re.IGNORECASE)
SIZE_RE = re.compile(r"^taille (TP|P|M|G|TG)$", re.IGNORECASE)
SKILL_RANKS_RE = re.compile(r"^(\d+)\s*rangs? en (.+)$", re.IGNORECASE)
ABILITY_RE = re.compile(
    r"\b(For|Dex|Con|Int|Sag|Cha)\s+(\d+)\b", re.IGNORECASE
)

CLASS_FEATURE_KEYWORDS = [
    "capacité de classe",
    "capacité à lancer",
    "capacité à",
    "suivant de",
    "suivant d'",
    "trait racial",
    "aucun niveau dans",
    "extérieur",
]


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.lower().strip()


def _split_top_level(text: str) -> list[str]:
    # Le point-virgule sépare aussi des prérequis indépendants
    # ("Cha 13; BBA +5 ou 5 rangs en Représentation...") : sans lui, tout le
    # segment tombait en UNPARSED.
    segments = re.split(r"[,;]\s*(?![^()]*\))", text)
    return [s.strip() for s in segments if s.strip()]


def _find_implied_classes(normalized_text: str) -> list[str] | None:
    literal = {
        cls for cls in KNOWN_CLASSES
        if re.search(rf"\b{re.escape(cls)}\b", normalized_text)
    }
    keyword_hits: set[str] = set()
    for entry in CLASS_ABILITY_MAP:
        if entry["keyword"] in normalized_text:
            keyword_hits |= set(entry["classes"])
    result = sorted(literal | keyword_hits)
    return result or None


def _find_gating(normalized_text: str) -> list[dict] | None:
    """Nature des prérequis reconnus dans un segment inclassable.

    Renvoie une liste de ``{"kind", "param", "blocking", "keyword"}`` (voir
    ``Data/prereq_gating.json``) que ``engine.py`` sait confronter à la race,
    à la classe, à l'alignement ou à la divinité du personnage.
    """
    hits = []
    for keyword, entry in GATING_BY_KEYWORD.items():
        if re.search(rf"(?<!\w){re.escape(keyword)}(?!\w)", normalized_text):
            hits.append(
                {
                    "kind": entry["kind"],
                    "param": entry["param"],
                    "blocking": entry["blocking"],
                    "keyword": keyword,
                }
            )
    if not hits:
        return None
    # Un mot-clé plus long est plus spécifique : en cas de recouvrement
    # ("vision dans le noir" vs "vision dans le noir (18m)"), on garde le plus
    # long pour éviter de bloquer deux fois sur le même prérequis.
    hits.sort(key=lambda h: -len(h["keyword"]))
    kept: list[dict] = []
    for hit in hits:
        if any(hit["keyword"] in k["keyword"] for k in kept):
            continue
        kept.append(hit)
    return kept


def _classify_segment(segment: str, normalized_feats: dict[str, str]) -> Requirement:
    raw = segment.strip()
    normalized = _normalize(raw)

    m = LEVEL_EXACT_RE.search(normalized)
    if m:
        return Requirement(
            type=RequirementType.LEVEL_EXACT,
            raw_text=raw,
            payload={"exact": int(m.group(1))},
        )

    # "<classe> de niveau N" avant LEVEL_RE : sinon la classe est ignorée et
    # le don devient éligible pour tout le monde.
    m = CLASS_LEVEL_RE.match(normalized)
    if m and m.group(1).strip() in KNOWN_CLASSES:
        return Requirement(
            type=RequirementType.CLASS_LEVEL,
            raw_text=raw,
            payload={"class_name": m.group(1).strip(), "min": int(m.group(2))},
        )

    m = LEVEL_RE.search(raw)
    if m:
        return Requirement(
            type=RequirementType.LEVEL,
            raw_text=raw,
            payload={"min": int(m.group(1))},
        )

    m = BBA_RE.search(raw)
    if m:
        return Requirement(
            type=RequirementType.BBA,
            raw_text=raw,
            payload={"min": int(m.group(1))},
        )

    m = NLS_RE.search(raw)
    if m:
        return Requirement(
            type=RequirementType.CASTER_LEVEL,
            raw_text=raw,
            payload={"min": int(m.group(1))},
        )

    m = SIZE_RE.match(raw)
    if m:
        return Requirement(
            type=RequirementType.SIZE,
            raw_text=raw,
            payload={"size": m.group(1).upper(), "comparator": "exact"},
        )

    m = SKILL_RANKS_RE.match(raw)
    if m:
        return Requirement(
            type=RequirementType.SKILL_RANKS,
            raw_text=raw,
            payload={"skill": m.group(2).strip(), "ranks": int(m.group(1))},
        )

    m = ABILITY_RE.search(raw)
    if m and m.group(1).capitalize() in ABILITY_ABBREVIATIONS:
        return Requirement(
            type=RequirementType.ABILITY_SCORE,
            raw_text=raw,
            payload={"ability": m.group(1).capitalize(), "min": int(m.group(2))},
        )

    cleaned = raw.rstrip("*").strip()
    feat_name = normalized_feats.get(normalized) or normalized_feats.get(_normalize(cleaned))
    if feat_name:
        return Requirement(
            type=RequirementType.FEAT,
            raw_text=raw,
            payload={"feat_name": feat_name},
        )

    if normalized in KNOWN_RACES:
        return Requirement(
            type=RequirementType.RACE,
            raw_text=raw,
            payload={"race": normalized},
        )

    if normalized in KNOWN_CLASSES:
        return Requirement(
            type=RequirementType.CLASS,
            raw_text=raw,
            payload={"class_name": normalized},
        )

    for keyword in CLASS_FEATURE_KEYWORDS:
        if _normalize(keyword) in normalized:
            return Requirement(
                type=RequirementType.CLASS_FEATURE_TEXT,
                raw_text=raw,
                payload=_enrich_payload(raw, normalized),
                needs_manual_check=True,
            )

    return Requirement(
        type=RequirementType.UNPARSED,
        raw_text=raw,
        payload=_enrich_payload(raw, normalized),
        needs_manual_check=True,
    )


def _enrich_payload(raw: str, normalized: str) -> dict:
    payload: dict = {"text": raw}
    implied = _find_implied_classes(normalized)

    # Prérequis négatif : « Aucun niveau dans une classe dotée de panache »
    # exige de NE PAS être bretteur. Le déclarer en implied_classes inversait
    # la règle (le don n'était offert qu'aux bretteurs, seuls exclus en fait).
    if normalized.startswith("aucun niveau dans"):
        gating = _find_gating(normalized) or []
        excluded = sorted(
            {cls for hit in gating if hit["kind"] == "no_class_levels" for cls in (hit["param"] or [])}
            | set(implied or [])
        )
        if excluded:
            payload["gating"] = [
                {
                    "kind": "no_class_levels",
                    "param": excluded,
                    "blocking": True,
                    "keyword": normalized,
                }
            ]
        return payload

    if implied:
        payload["implied_classes"] = implied
    gating = _find_gating(normalized)
    if gating:
        payload["gating"] = gating
    if not gating and normalized in FRAGMENT_KEYWORDS:
        payload["fragment"] = True
    return payload


def _parse_segment(segment: str, normalized_feats: dict[str, str]):
    # Les comparaisons de taille contiennent un " ou " qui n'est pas une
    # alternative ("taille P ou plus petit") : les traiter avant le découpage.
    normalized = _normalize(segment)
    for pattern, comparator in ((SIZE_MAX_RE, "max"), (SIZE_MIN_RE, "min")):
        m = pattern.match(normalized)
        if m:
            return Requirement(
                type=RequirementType.SIZE,
                raw_text=segment.strip(),
                payload={"size": m.group(1).upper(), "comparator": comparator},
            )

    # « X ou plus » = plancher sur X, pas une alternative entre « X » et
    # « plus » (ce dernier étant un fragment vide de sens).
    stripped = COMPARATIVE_SUFFIX_RE.sub("", segment).strip()
    if stripped and stripped != segment.strip():
        segment = stripped

    or_parts = re.split(r"\s+ou\s+", segment, flags=re.IGNORECASE)
    if len(or_parts) > 1:
        options = [_classify_segment(part, normalized_feats) for part in or_parts]
        return OrGroup(options=options, raw_text=segment)
    return _classify_segment(segment, normalized_feats)


def build_normalized_feats(known_feat_names: set[str]) -> dict[str, str]:
    return {_normalize(f): f for f in known_feat_names}


def parse_conditions(text: str, normalized_feats: dict[str, str]) -> ParsedConditions:
    normalized_whole = _normalize(text)
    if normalized_whole in EMPTY_MARKERS:
        return ParsedConditions(requirements=[])

    segments = _split_top_level(text)
    requirements = [_parse_segment(seg, normalized_feats) for seg in segments]
    return ParsedConditions(requirements=requirements)
