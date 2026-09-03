import unicodedata

Progression = str  # "good" | "medium" | "poor"

CLASS_BBA_PROGRESSION: dict[str, Progression] = {
    # Classes de base
    "barbare": "good",
    "barde": "medium",
    "druide": "medium",
    "ensorceleur": "poor",
    "guerrier": "good",
    "magicien": "poor",
    "moine": "medium",
    "paladin": "good",
    "pretre": "medium",
    "rodeur": "good",
    "roublard": "medium",
    # Classes supplémentaires
    "alchimiste": "medium",
    "antipaladin": "good",
    "chasseur de vampire": "good",
    "chevalier": "good",
    "conjurateur": "medium",
    "inquisiteur": "medium",
    "justicier": "medium",
    "magus": "medium",
    "metamorphe": "medium",
    "ninja": "medium",
    "oracle": "medium",
    "pistolier": "good",
    "samourai": "good",
    "sorciere": "poor",
    # Classes hybrides
    "arcaniste": "poor",
    "bretteur": "good",
    "chaman": "medium",
    "chasseur": "medium",
    "enqueteur": "medium",
    "lutteur": "good",
    "pretre combattant": "good",
    "sanguin": "good",
    "scalde": "good",
    "tueur": "good",
    # Classes occultes
    "cinetiste": "medium",
    "hypnotiseur": "medium",
    "medium": "medium",
    "occultiste": "medium",
    "psychiste": "poor",
    "spirite": "medium",
    # Alias courants
    "cavalier": "good",
    "clerc": "medium",
}


def _normalize_class_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.lower().strip()


def bba_at_level(level: int, progression: Progression) -> int:
    if progression == "good":
        return level
    if progression == "medium":
        return (level * 3) // 4
    if progression == "poor":
        return level // 2
    raise ValueError(f"Progression BBA inconnue: {progression!r}")


def get_bba(class_name: str, level: int) -> int:
    key = _normalize_class_name(class_name)
    if key not in CLASS_BBA_PROGRESSION:
        raise ValueError(f"Classe inconnue: {class_name!r}")
    return bba_at_level(level, CLASS_BBA_PROGRESSION[key])
