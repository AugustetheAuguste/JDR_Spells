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

ABILITY_ABBREVIATIONS = {"For", "Dex", "Con", "Int", "Sag", "Cha"}

EMPTY_MARKERS = {"", "-", "—", "aucun", "aucune"}

LEVEL_RE = re.compile(r"niveau (\d+)", re.IGNORECASE)
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
    segments = re.split(r",\s*(?![^()]*\))", text)
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


def _classify_segment(segment: str, normalized_feats: dict[str, str]) -> Requirement:
    raw = segment.strip()
    normalized = _normalize(raw)

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
            payload={"size": m.group(1).upper()},
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
            payload = {"text": raw}
            implied = _find_implied_classes(normalized)
            if implied:
                payload["implied_classes"] = implied
            return Requirement(
                type=RequirementType.CLASS_FEATURE_TEXT,
                raw_text=raw,
                payload=payload,
                needs_manual_check=True,
            )

    payload = {"text": raw}
    implied = _find_implied_classes(normalized)
    if implied:
        payload["implied_classes"] = implied
    return Requirement(
        type=RequirementType.UNPARSED,
        raw_text=raw,
        payload=payload,
        needs_manual_check=True,
    )


def _parse_segment(segment: str, normalized_feats: dict[str, str]):
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
