import json
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Optional

from .class_progression import get_bba
from .data_loader import FeatRow
from .models import OrGroup, Requirement, RequirementType

Status = Literal["eligible", "manual_check", "ineligible"]

with open("Data/class_caster_info.json", encoding="utf-8") as f:
    CLASS_CASTER_INFO = json.load(f)

with open("Data/feat_magic_info.json", encoding="utf-8") as f:
    FEAT_MAGIC_INFO = json.load(f)

with open("Data/feat_creature_affinity.json", encoding="utf-8") as f:
    FEAT_CREATURE_AFFINITY = json.load(f)

# Recopié littéralement depuis
# build/feat-detail-and-magic-gating/OUTPUT_vocab_and_markup_calibration.md,
# Section C — motif commun identifié pour les races à magie innée : ne pas
# recalibrer cette liste ici.
RACE_MAGIC_KEYWORDS = [
    "comme un pouvoir magique",
    "comme des pouvoirs magiques",
    "niveau de lanceur de sorts",
]

_RACES_PATH = "Data/races.json"
if Path(_RACES_PATH).exists():
    _RACES_RAW = json.loads(Path(_RACES_PATH).read_text(encoding="utf-8"))
else:
    _RACES_RAW = {}


def class_grants_magic(character_class: str) -> Optional[bool]:
    entry = CLASS_CASTER_INFO.get(_normalize(character_class))
    if entry is None:
        return None  # classe inconnue -> ne jamais deviner
    return entry["is_caster"]


def race_grants_magic(race_name: Optional[str]) -> bool:
    if race_name is None:
        return False  # absence d'info != échappatoire
    entry = _RACES_RAW.get(_normalize(race_name))
    if entry is None:
        return False  # race inconnue -> comportement conservateur
    text = _normalize(
        " ".join(trait.get("description", "") for trait in entry.get("traits", []))
    )
    return any(_normalize(keyword) in text for keyword in RACE_MAGIC_KEYWORDS)


def creature_affinity_allows(race_name: Optional[str], creature_keywords: list[str]) -> bool:
    """Un don marqué "plus courant chez les X" (page de don, hors CSV) n'a
    de sens que pour la race/créature X — comportement conservateur si la
    race du personnage est absente ou inconnue (comme race_grants_magic)."""
    race_norm = _normalize(race_name) if race_name else ""
    for keyword in creature_keywords:
        keyword_norm = _normalize(keyword).rstrip("s")
        if race_norm and (race_norm.rstrip("s") in keyword_norm or keyword_norm in race_norm.rstrip("s")):
            return True
    return False


def _normalize(text: str) -> str:
    t = unicodedata.normalize("NFKD", text)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return t.lower().strip()


@dataclass
class Character:
    character_class: str
    level: int
    race: Optional[str] = None
    size: Optional[str] = None
    ability_scores: Optional[dict[str, int]] = None
    known_feats: Optional[set[str]] = None
    skill_ranks: Optional[dict[str, int]] = None

    @property
    def bba(self) -> int:
        return get_bba(self.character_class, self.level)

    def skill_rank(self, skill: str) -> Optional[int]:
        if self.skill_ranks is not None and skill in self.skill_ranks:
            return self.skill_ranks[skill]
        if self.skill_ranks is None:
            return self.level  # hypothèse optimiste : rangs max
        return None


@dataclass
class EligibilityResult:
    feat_name: str
    status: Status
    reasons: list[str] = field(default_factory=list)


def evaluate_requirement(req: Requirement, character: Character) -> tuple[bool | None, str]:
    if req.type == RequirementType.LEVEL:
        ok = character.level >= req.payload["min"]
        return ok, f"niveau {character.level} {'>=' if ok else '<'} {req.payload['min']} requis"

    if req.type == RequirementType.BBA:
        ok = character.bba >= req.payload["min"]
        return ok, f"BBA {character.bba} {'>=' if ok else '<'} {req.payload['min']} requis"

    if req.type == RequirementType.ABILITY_SCORE:
        if character.ability_scores is None:
            return None, f"score de caractéristique non fourni ({req.raw_text})"
        score = character.ability_scores.get(req.payload["ability"])
        if score is None:
            return None, f"score de {req.payload['ability']} non fourni"
        ok = score >= req.payload["min"]
        return ok, f"{req.payload['ability']} {score} {'>=' if ok else '<'} {req.payload['min']} requis"

    if req.type == RequirementType.CASTER_LEVEL:
        return None, f"NLS {req.payload['min']} requis (non dérivable automatiquement)"

    if req.type == RequirementType.SKILL_RANKS:
        ranks = character.skill_rank(req.payload["skill"])
        if ranks is None:
            return None, f"rangs en {req.payload['skill']} non fournis"
        ok = ranks >= req.payload["ranks"]
        return ok, f"{ranks} rangs en {req.payload['skill']} {'>=' if ok else '<'} {req.payload['ranks']} requis"

    if req.type == RequirementType.FEAT:
        if character.known_feats is None:
            return None, f"dons déjà pris non fournis (requiert {req.payload['feat_name']})"
        ok = req.payload["feat_name"] in character.known_feats
        return ok, f"don prérequis {req.payload['feat_name']} {'possédé' if ok else 'non possédé'}"

    if req.type == RequirementType.SIZE:
        if character.size is None:
            return None, f"taille non fournie (requiert {req.payload['size']})"
        ok = character.size.upper() == req.payload["size"]
        return ok, f"taille {character.size} {'correspond' if ok else 'ne correspond pas'} à {req.payload['size']}"

    if req.type == RequirementType.RACE:
        if character.race is None:
            return None, f"race non fournie (requiert {req.payload['race']})"
        ok = _normalize(character.race) == req.payload["race"]
        return ok, f"race {character.race} {'correspond' if ok else 'ne correspond pas'} à {req.payload['race']}"

    if req.type == RequirementType.CLASS:
        ok = _normalize(character.character_class) == req.payload["class_name"]
        return ok, f"classe {character.character_class} {'correspond' if ok else 'ne correspond pas'} à {req.payload['class_name']}"

    # CLASS_FEATURE_TEXT et UNPARSED : jamais vérifiables automatiquement,
    # sauf si le payload indique une ou plusieurs classes impliquées
    # incompatibles avec celle du personnage.
    implied = req.payload.get("implied_classes")
    if implied:
        character_class_normalized = _normalize(character.character_class)
        if character_class_normalized not in implied:
            return False, (
                f"nécessite une capacité de classe réservée à "
                f"{'/'.join(implied)} ; {character.character_class} n'y correspond pas"
            )
        # la classe correspond à une des classes impliquées : les détails
        # précis (capacité, niveau de lanceur, etc.) restent à vérifier

    return None, f"à vérifier manuellement : {req.raw_text}"


def evaluate_or_group(group: OrGroup, character: Character) -> tuple[bool | None, str]:
    results = [evaluate_requirement(opt, character) for opt in group.options]
    if any(ok is True for ok, _ in results):
        return True, f"condition OU satisfaite parmi : {group.raw_text}"
    if any(ok is None for ok, _ in results):
        return None, f"condition OU à vérifier manuellement : {group.raw_text}"
    return False, f"aucune option satisfaite parmi : {group.raw_text}"


def evaluate_feat(feat: FeatRow, character: Character) -> EligibilityResult:
    manual_reasons = []
    for req in feat.parsed.requirements:
        if isinstance(req, OrGroup):
            ok, reason = evaluate_or_group(req, character)
        else:
            ok, reason = evaluate_requirement(req, character)

        if ok is False:
            return EligibilityResult(feat.name, "ineligible", [reason])
        if ok is None:
            manual_reasons.append(reason)

    status: Status = "manual_check" if manual_reasons else "eligible"

    # Un don dont les Conditions imposent déjà explicitement une race précise
    # (ex. "Ailes de tengu" : "Personnage de niveau 5, tengu") est gated de
    # façon fiable par cette RACE Requirement elle-même ; le tag magique
    # heuristique de feat_magic_info.json (souvent un faux positif provenant
    # du texte de la page wiki, sans rapport avec les Conditions réelles du
    # don) ne doit pas venir écraser ce résultat déjà déterministe.
    has_explicit_race_requirement = any(
        (isinstance(req, OrGroup) and any(opt.type == RequirementType.RACE for opt in req.options))
        or (not isinstance(req, OrGroup) and req.type == RequirementType.RACE)
        for req in feat.parsed.requirements
    )

    magic_info = FEAT_MAGIC_INFO.get(feat.name)
    if (
        not has_explicit_race_requirement
        and magic_info
        and magic_info["is_magic"]
        and not magic_info["needs_manual_check"]
    ):
        class_ok = class_grants_magic(character.character_class)
        if class_ok is False and not race_grants_magic(character.race):
            keywords = ", ".join(magic_info["matched_keywords"])
            return EligibilityResult(
                feat.name,
                "ineligible",
                [
                    f"don magique ({keywords}) ; ni la classe "
                    f"{character.character_class} ni la race "
                    f"{character.race or 'non fournie'} ne donnent accès à la magie"
                ],
            )
        # class_ok is None (classe inconnue) -> ne pas overrider, garder le
        # statut déjà calculé par la boucle de Requirement ci-dessus

    affinity_info = FEAT_CREATURE_AFFINITY.get(feat.name)
    if (
        not has_explicit_race_requirement
        and affinity_info
        and affinity_info["creature_keywords"]
        and not affinity_info["needs_manual_check"]
        and not creature_affinity_allows(character.race, affinity_info["creature_keywords"])
    ):
        return EligibilityResult(
            feat.name,
            "ineligible",
            [
                f"don pensé pour : {', '.join(affinity_info['creature_keywords'])} "
                f"(page de don) ; race {character.race or 'non fournie'} ne correspond pas"
            ],
        )

    if manual_reasons:
        return EligibilityResult(feat.name, status, manual_reasons)
    return EligibilityResult(feat.name, status, [])


def filter_feats(character: Character, catalog: list[FeatRow]) -> dict[Status, list[EligibilityResult]]:
    grouped: dict[Status, list[EligibilityResult]] = {
        "eligible": [],
        "manual_check": [],
        "ineligible": [],
    }
    for feat in catalog:
        result = evaluate_feat(feat, character)
        grouped[result.status].append(result)

    for results in grouped.values():
        results.sort(key=lambda r: r.feat_name)

    return grouped
