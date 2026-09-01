import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Optional

from . import paths
from .class_progression import get_bba
from .data_loader import FeatRow
from .models import OrGroup, Requirement, RequirementType

Status = Literal["eligible", "manual_check", "ineligible"]

with open(paths.CLASS_CASTER_INFO, encoding="utf-8") as f:
    CLASS_CASTER_INFO = json.load(f)

with open(paths.CLASS_PROFICIENCIES, encoding="utf-8") as f:
    CLASS_PROFICIENCIES = json.load(f)

with open(paths.FEAT_MAGIC_INFO, encoding="utf-8") as f:
    FEAT_MAGIC_INFO = json.load(f)

with open(paths.FEAT_CREATURE_AFFINITY, encoding="utf-8") as f:
    FEAT_CREATURE_AFFINITY = json.load(f)

# Dons dont seul le *texte d'avantage* révèle qu'ils sont réservés à une classe
# (ex. « ajoute les sorts suivants à sa liste de druide »), leurs Conditions
# n'en disant rien. Curé à la main : scripts/curate_feat_class_restriction.py.
with open(paths.FEAT_CLASS_RESTRICTION, encoding="utf-8") as f:
    FEAT_CLASS_RESTRICTION = json.load(f)

# Recopié littéralement depuis
# build/feat-detail-and-magic-gating/OUTPUT_vocab_and_markup_calibration.md,
# Section C — motif commun identifié pour les races à magie innée : ne pas
# recalibrer cette liste ici.
RACE_MAGIC_KEYWORDS = [
    "comme un pouvoir magique",
    "comme des pouvoirs magiques",
    "niveau de lanceur de sorts",
]

_RACES_PATH = paths.RACES
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


# Maîtrises d'armes accordées explicitement par la race, en plus de la
# classe (Data/races/races.json, trait « Armes familières ») : recopiées
# littéralement depuis
# build/armes-et-armures-de-classe/OUTPUT_class_proficiencies_ground_truth.md
# -- ne couvre que le sous-ensemble d'armes concerné par cette couche de
# gating (voir WEAPON_PROFICIENCY dans scripts/curate_prereq_gating.py).
RACE_WEAPON_PROFICIENCY: dict[str, list[str]] = {
    "elfe": ["arc long"],
    "nain": ["marteau de guerre"],
    "halfelin": ["fronde"],
}

# Races qui traitent toute arme portant cette mention dans son nom comme une
# arme de guerre (martiale) au lieu d'exotique -- reclassification, pas une
# maîtrise accordée : la classe doit encore donner accès aux armes
# martiales pour que ça compte. Seul le nain est pertinent pour le
# sous-ensemble d'armes de cette couche (« dorn-dergar naine »).
RACE_WEAPON_RECLASSIFICATION: dict[str, str] = {
    "nain": "naine",
}


def _proficiency_verdict(param: dict, character: "Character", keyword: str) -> tuple[bool | None, str]:
    """Résout un prérequis « maniement de X » nommé (pas un choix du joueur)
    contre Data/classes/class_proficiencies.json et les maîtrises raciales.

    Volontairement conservateur, même politique que magie_inaccessible : ne
    renvoie ``False`` que si la classe est connue de class_proficiencies.json
    et ne l'accorde pas (ni elle, ni la race) ; une classe absente de la
    table renvoie ``None`` (jamais deviner).
    """
    entry = CLASS_PROFICIENCIES.get(_normalize(character.character_class))
    race_norm = _normalize(character.race) if character.race else None

    if "bouclier" in param:
        bouclier = param["bouclier"]
        label = f"maniement du bouclier ({keyword})"
        if entry is not None:
            if entry["boucliers"]:
                return True, f"{label} : {character.character_class} a la maîtrise des boucliers"
            if bouclier == "targe" and "targe" in entry["armes_specifiques"]:
                return True, f"{label} : {character.character_class} est formé à la targe"
        if entry is not None:
            return False, f"{label} ; {character.character_class} n'a pas cette maîtrise"
        return None, f"{label} ; classe {character.character_class} inconnue des maîtrises de classe"

    arme, categorie = param["arme"], param["categorie"]
    label = f"maniement de {arme} ({keyword})"

    if entry is not None:
        if categorie == "simple" and entry["armes_simples"]:
            return True, f"{label} : {character.character_class} a toutes les armes simples"
        if categorie == "martiale" and entry["armes_martiales"]:
            return True, f"{label} : {character.character_class} a toutes les armes martiales"
        if arme in entry["armes_specifiques"]:
            return True, f"{label} : accordée nommément à {character.character_class}"

    if race_norm:
        if arme in RACE_WEAPON_PROFICIENCY.get(race_norm, []):
            return True, f"{label} : arme familière de la race {character.race}"
        marker = RACE_WEAPON_RECLASSIFICATION.get(race_norm)
        if (
            marker
            and marker in arme
            and entry is not None
            and entry["armes_martiales"]
        ):
            return True, (
                f"{label} : la race {character.race} la traite comme une arme "
                f"de guerre, et {character.character_class} a les armes martiales"
            )

    if entry is not None:
        return False, (
            f"{label} ; ni la classe {character.character_class} ni la race "
            f"{character.race or 'non fournie'} ne l'accordent"
        )
    return None, f"{label} ; classe {character.character_class} inconnue des maîtrises de classe"


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
    # Renseignés, ils permettent de trancher les prérequis d'alignement
    # ("alignement Bon") et de culte ("suivant de Torag") au lieu de les
    # renvoyer systématiquement en vérification manuelle.
    alignment: Optional[str] = None
    deity: Optional[str] = None

    @property
    def bba(self) -> int:
        return get_bba(self.character_class, self.level)

    @property
    def effective_size(self) -> Optional[str]:
        """Taille explicite, sinon celle de la race (Data/races/races.json).

        Sans cela, tous les prérequis de taille restaient en vérification
        manuelle alors que la race la détermine dans la quasi-totalité des cas.
        """
        if self.size is not None:
            return self.size.upper()
        if self.race is None:
            return None
        entry = _RACES_RAW.get(_normalize(self.race))
        size = (entry or {}).get("size")
        return size.upper() if size else None

    @property
    def racial_trait_text(self) -> Optional[str]:
        """Noms + descriptions des traits raciaux, normalisés, ou None si la
        race est inconnue (auquel cas on ne conclut rien)."""
        if self.race is None:
            return None
        entry = _RACES_RAW.get(_normalize(self.race))
        if entry is None:
            return None
        parts = []
        for trait in entry.get("traits", []):
            parts.append(trait.get("name", ""))
            parts.append(trait.get("description", ""))
        return _normalize(" | ".join(parts))

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


SIZE_ORDER = ["TP", "P", "M", "G", "TG", "C"]


# « suivant de X » / « suivant d'X » / « suivant du X » -> X
_DEITY_PREFIX_RE = re.compile(r"^suivant\s+(?:de\s+la\s+|de\s+l'|de\s+|du\s+|des\s+|d')")


def magie_inaccessible(character: "Character") -> bool:
    """Le personnage n'a *aucun* accès à la magie, ni par sa classe ni par sa race.

    Volontairement conservateur : ne renvoie ``True`` que si la classe est
    connue ET explicitement non-lanceuse (`class_grants_magic() is False`, donc
    jamais pour une classe absente de `Data/classes/class_caster_info.json`).
    """
    return (
        class_grants_magic(character.character_class) is False
        and not race_grants_magic(character.race)
    )

# Genres de prérequis (Data/conditions/prereq_gating.json) que le moteur
# sait trancher.
# proficiency n'est bloquant que pour les 18 entrées à arme/bouclier nommé
# (cf. WEAPON_PROFICIENCY/SHIELD_PROFICIENCY dans
# scripts/curate_prereq_gating.py) ; les autres (choix du joueur, feat,
# background, generic…) restent en vérification manuelle : on ne devine pas.
# Les alternatives restent volontairement des expressions longues : un mot
# isolé ("langue", "nage", "vol") apparaît dans des traits raciaux sans rapport
# (le trait « Langues » de toutes les races, par exemple) et produirait des
# dons éligibles à tort.
_ANATOMY_SYNONYMS = {
    "attaque de morsure": ["attaque de morsure", "arme naturelle (morsure)", "morsure ("],
    "arme naturelle": ["arme naturelle", "armes naturelles"],
    "attaques naturelles multiples": ["armes naturelles", "attaques naturelles"],
    "griffes": ["griffes du felin", "arme naturelle (griffes)", "griffes ("],
    "armure naturelle": ["armure naturelle"],
    "vitesse de vol": ["vitesse de vol", "vol a la vitesse", "peut voler"],
    "vitesse de nage": ["vitesse de nage", "vitesse de deplacement a la nage"],
    "vision dans le noir": ["vision dans le noir"],
    "reduction de degats": ["reduction de degats"],
    "queue": ["queue prehensile", "arme naturelle (queue)"],
    "langue gluante": ["langue gluante"],
    "trois mains": ["trois mains"],
    "morphologie bipede": ["bipede"],
    "regeneration": ["regeneration"],
    "retenir son souffle": ["retenir son souffle"],
    "attaque speciale": ["attaque speciale"],
}


def _gating_verdict(hit: dict, character: Character) -> tuple[bool | None, str]:
    kind, param = hit["kind"], hit["param"]
    keyword = hit["keyword"]

    if kind == "spellcasting":
        if magie_inaccessible(character):
            return False, (
                f"prérequis d'incantation ({keyword}) ; ni la classe "
                f"{character.character_class} ni la race "
                f"{character.race or 'non fournie'} ne donnent accès à la magie"
            )
        return None, f"prérequis d'incantation à vérifier : {keyword}"

    if kind == "class_ability":
        classes = param or []
        if _normalize(character.character_class) in classes:
            return None, f"capacité de classe à vérifier ({keyword})"
        return False, (
            f"capacité de classe « {keyword} » réservée à {'/'.join(classes)} ; "
            f"{character.character_class} n'y a pas accès"
        )

    if kind == "no_class_levels":
        classes = param or []
        if _normalize(character.character_class) in classes:
            return False, (
                f"{keyword} : {character.character_class} est justement une de "
                f"ces classes"
            )
        return True, f"{keyword} : {character.character_class} n'en fait pas partie"

    if kind == "mythic":
        # Le moteur ne modélise pas les niveaux mythiques : un personnage est
        # non-mythique, donc le prérequis « non-mythique uniquement » est tenu.
        return True, "personnage non-mythique (les niveaux mythiques ne sont pas modélisés)"

    if kind in ("racial_trait", "creature_type", "anatomy"):
        traits = character.racial_trait_text
        if traits is None:
            return None, f"race non fournie ou inconnue (requiert : {keyword})"
        if kind == "creature_type" and _normalize(param or "") in _normalize(character.race or ""):
            return True, f"race {character.race} correspond à {param}"
        needles = (
            _ANATOMY_SYNONYMS.get(param, [param or keyword])
            if kind == "anatomy"
            else [param or keyword]
        )
        if any(_normalize(n) and _normalize(n) in traits for n in needles):
            return True, f"la race {character.race} accorde : {param or keyword}"
        label = {
            "racial_trait": "trait racial",
            "creature_type": "type/race de créature",
            "anatomy": "capacité physique innée",
        }[kind]
        return False, (
            f"{label} requis « {param or keyword} » ; la race "
            f"{character.race} ne l'accorde pas"
        )

    if kind == "proficiency":
        return _proficiency_verdict(param, character, keyword)

    if kind == "alignment":
        if character.alignment is None:
            return None, f"alignement non renseigné (requiert : {keyword})"
        alignment = _normalize(character.alignment)
        if param is None:
            return None, f"contrainte d'alignement à arbitrer : {keyword}"
        target = _normalize(param)
        if target.startswith("non-"):
            forbidden = target[4:]
            ok = forbidden not in alignment
            return ok, (
                f"alignement {character.alignment} "
                f"{'compatible' if ok else 'incompatible'} avec {param}"
            )
        ok = all(word in alignment for word in target.split())
        return ok, (
            f"alignement {character.alignment} "
            f"{'correspond' if ok else 'ne correspond pas'} à {param}"
        )

    if kind == "deity":
        if character.deity is None:
            return None, f"divinité non renseignée (requiert : {keyword})"
        if keyword.startswith("ne venere pas"):
            return False, f"le personnage vénère {character.deity} ; {keyword}"
        deity = _normalize(character.deity)
        if keyword.startswith(("suivant de ", "suivant d'", "suivant du ")):
            # `lstrip` prend un *ensemble de caractères*, pas un préfixe :
            # « suivant de dahak » -> « de dahak » -> lstrip("de'u ") mangeait
            # aussi le « d » de Dahak et rendait « ahak ». Retirer le préfixe
            # comme un préfixe.
            wanted = _DEITY_PREFIX_RE.sub("", keyword).strip()
            ok = bool(wanted) and (wanted in deity or deity in wanted)
            return ok, (
                f"divinité {character.deity} "
                f"{'correspond' if ok else 'ne correspond pas'} à « {wanted} »"
            )
        return True, f"le personnage vénère {character.deity} ({keyword})"

    return None, f"à vérifier manuellement ({kind}) : {keyword}"


def evaluate_requirement(req: Requirement, character: Character) -> tuple[bool | None, str]:
    if req.type == RequirementType.LEVEL:
        ok = character.level >= req.payload["min"]
        return ok, f"niveau {character.level} {'>=' if ok else '<'} {req.payload['min']} requis"

    if req.type == RequirementType.LEVEL_EXACT:
        ok = character.level == req.payload["exact"]
        return ok, (
            f"don réservé au niveau {req.payload['exact']} exactement ; "
            f"le personnage est niveau {character.level}"
        )

    if req.type == RequirementType.CLASS_LEVEL:
        if _normalize(character.character_class) != req.payload["class_name"]:
            return False, (
                f"requiert {req.payload['class_name']} niveau {req.payload['min']} ; "
                f"{character.character_class} n'y correspond pas"
            )
        ok = character.level >= req.payload["min"]
        return ok, (
            f"{req.payload['class_name']} niveau {character.level} "
            f"{'>=' if ok else '<'} {req.payload['min']} requis"
        )

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
        # Un NLS (niveau de lanceur de sorts) exige d'être lanceur de sorts.
        # La valeur exacte reste non dérivable, mais l'*absence totale* d'accès
        # à la magie, elle, tranche : un guerrier n'aura jamais de NLS 1.
        if magie_inaccessible(character):
            return False, (
                f"NLS {req.payload['min']} requis ; ni la classe "
                f"{character.character_class} ni la race "
                f"{character.race or 'non fournie'} ne donnent accès à la magie"
            )
        return None, f"NLS {req.payload['min']} requis (valeur non dérivable automatiquement)"

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
        actual = character.effective_size
        if actual is None:
            return None, f"taille non fournie (requiert {req.payload['size']})"
        comparator = req.payload.get("comparator", "exact")
        wanted = req.payload["size"]
        if actual not in SIZE_ORDER or wanted not in SIZE_ORDER:
            return None, f"taille {character.size} non comparable à {wanted}"
        delta = SIZE_ORDER.index(actual) - SIZE_ORDER.index(wanted)
        ok = {"exact": delta == 0, "min": delta >= 0, "max": delta <= 0}[comparator]
        label = {"exact": "", "min": " ou plus grand", "max": " ou plus petit"}[comparator]
        return ok, (
            f"taille {actual} {'correspond' if ok else 'ne correspond pas'} "
            f"à {wanted}{label}"
        )

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

    # Prérequis non liés à une classe (trait racial, type de créature,
    # anatomie, incantation, alignement, divinité) :
    # Data/conditions/prereq_gating.json dit lesquels sont vérifiables, et sur
    # quoi.
    pending: list[str] = []
    satisfied: list[str] = []
    normalized_text = _normalize(req.payload.get("text", req.raw_text))
    for hit in req.payload.get("gating", []):
        if not hit.get("blocking"):
            continue
        ok, reason = _gating_verdict(hit, character)
        if ok is False:
            return False, reason
        if ok is None:
            pending.append(reason)
        elif hit["keyword"] == normalized_text:
            # Le mot-clé couvre tout le segment : rien d'autre à vérifier.
            satisfied.append(reason)
    if pending:
        return None, " ; ".join(pending)
    if satisfied:
        return True, satisfied[0]

    return None, f"à vérifier manuellement : {req.raw_text}"


def evaluate_or_group(group: OrGroup, character: Character) -> tuple[bool | None, str]:
    # Une option réduite à un fragment de découpage ("… ou familier" dans
    # « Capacité de classe compagnon animal ou familier ») ne porte aucune
    # information : la retenir rendrait tout le groupe indécidable.
    options = [opt for opt in group.options if not opt.payload.get("fragment")] or group.options
    results = [evaluate_requirement(opt, character) for opt in options]
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

    restriction = FEAT_CLASS_RESTRICTION.get(feat.name)
    if restriction and _normalize(character.character_class) not in restriction["classes"]:
        return EligibilityResult(
            feat.name,
            "ineligible",
            [
                f"don réservé à {'/'.join(restriction['classes'])} d'après son "
                f"texte d'avantage (« {restriction['evidence']} ») ; "
                f"{character.character_class} n'y a pas accès"
            ],
        )

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
