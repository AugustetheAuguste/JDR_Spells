import unicodedata
from dataclasses import dataclass, field
from typing import Literal, Optional

from .class_progression import get_bba
from .data_loader import FeatRow
from .models import OrGroup, Requirement, RequirementType

Status = Literal["eligible", "manual_check", "ineligible"]


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

    # CLASS_FEATURE_TEXT et UNPARSED : jamais vérifiables automatiquement
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

    if manual_reasons:
        return EligibilityResult(feat.name, "manual_check", manual_reasons)
    return EligibilityResult(feat.name, "eligible", [])


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
