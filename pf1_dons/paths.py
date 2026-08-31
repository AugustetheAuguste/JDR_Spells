"""Emplacement unique de tous les fichiers de données du dépôt.

Chaque module ouvrait jusqu'ici un chemin relatif écrit en dur
(``"Data/races.json"``), donc dépendant du répertoire courant : le paquet ne
s'importait correctement que depuis la racine du dépôt, et déplacer un
fichier de données obligeait à en retrouver toutes les occurrences. Les
chemins sont désormais ancrés sur la racine, déduite de l'emplacement de ce
fichier, et regroupés par sujet.

Les scrappers et les scripts (hors paquet) importent eux aussi ce module,
afin qu'il n'existe qu'une seule définition de « où vit telle donnée ».
"""

from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DATA_DIR = RACINE / "Data"

# Un sous-répertoire par sujet : le don lui-même, la classe, la race, et les
# conditions (prérequis) qui ne se rattachent ni à l'un ni à l'autre.
DONS_DIR = DATA_DIR / "dons"
CLASSES_DIR = DATA_DIR / "classes"
RACES_DIR = DATA_DIR / "races"
CONDITIONS_DIR = DATA_DIR / "conditions"
CHARACTERS_DIR = DATA_DIR / "characters"

# --- Dons : catalogue brut, pages scrapées, et tags dérivés ----------------
DONS_CSV = DONS_DIR / "Dons.csv"
FEAT_LINKS = DONS_DIR / "feat_links.json"
FEAT_DETAILS = DONS_DIR / "feat_details.json"
FEAT_CATEGORIES = DONS_DIR / "feat_categories.json"
FEAT_MAGIC_INFO = DONS_DIR / "feat_magic_info.json"
FEAT_CREATURE_AFFINITY = DONS_DIR / "feat_creature_affinity.json"
FEAT_CLASS_RESTRICTION = DONS_DIR / "feat_class_restriction.json"

# --- Classes : progressions scrapées, et tables de gating curées -----------
CLASS_FEATURES = CLASSES_DIR / "class_features.json"
CLASS_SKILLS = CLASSES_DIR / "class_skills.json"
CLASS_BONUS_FEATS = CLASSES_DIR / "class_bonus_feats.json"
CLASS_ABILITY_MAP = CLASSES_DIR / "class_ability_map.json"
CLASS_CASTER_INFO = CLASSES_DIR / "class_caster_info.json"
# Brouillons produits par les scripts de seed, non versionnés (.gitignore).
CLASS_ABILITY_MAP_DRAFT = CLASSES_DIR / "class_ability_map.draft.json"
CLASS_CASTER_INFO_DRAFT = CLASSES_DIR / "class_caster_info.draft.json"

# --- Races ----------------------------------------------------------------
RACES = RACES_DIR / "races.json"

# --- Conditions (prérequis) -----------------------------------------------
PREREQ_GATING = CONDITIONS_DIR / "prereq_gating.json"
