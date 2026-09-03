import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import pandas as pd

from . import paths
from .models import ParsedConditions
from .parser import build_normalized_feats, parse_conditions

DEFAULT_CSV_PATH = paths.DONS_CSV

ERREUR_IMPORT = "#ERROR!"


@dataclass
class FeatRow:
    name: str
    display_name: str
    source: str
    raw_conditions: str
    benefits: str
    parsed: ParsedConditions
    # Prérequis lus sur la page du don et absents du CSV, retenus par la
    # curation de `data/dons/feat_prereq_supplements.json`. `raw_conditions`
    # reste le texte du CSV, tel quel, pour que l'audit puisse citer sa source ;
    # `parsed` porte, lui, les conditions du CSV *et* ces ajouts.
    prereq_supplements: tuple[str, ...] = ()

    @property
    def effective_conditions(self) -> str:
        """Les conditions réellement évaluées : CSV + ajouts curés."""
        return _concatener_conditions(self.raw_conditions, self.prereq_supplements)


def load_raw(path: Path = DEFAULT_CSV_PATH) -> pd.DataFrame:
    return pd.read_csv(path, encoding="utf-8")


def filter_valid_rows(df: pd.DataFrame) -> pd.DataFrame:
    mask = (df["Conditions"] != ERREUR_IMPORT) & (df["Avantages"] != ERREUR_IMPORT)
    return df[mask].reset_index(drop=True)


def clean_feat_name(name: str) -> str:
    return name.strip().rstrip("*").strip()


@lru_cache(maxsize=1)
def _avantages_scrapes(chemin: Path = paths.FEAT_DETAILS) -> dict[str, str]:
    """Texte d'avantage scrapé par don, indexé sur son nom nettoyé.

    `data/dons/feat_details.json` est indexé sur le nom sans astérisque, alors
    que la colonne `Dons` du CSV garde l'astérisque des dons répétables.
    """
    if not chemin.exists():
        return {}
    details = json.loads(chemin.read_text(encoding="utf-8"))
    avantages = {}
    for nom, entree in details.items():
        texte = (entree.get("avantages_detail") or "").strip()
        if texte:
            avantages[clean_feat_name(nom)] = texte
    return avantages


def repair_benefits(df: pd.DataFrame) -> pd.DataFrame:
    """Recolle les `Avantages` ratés à l'import depuis les pages scrapées.

    127 lignes du CSV portent `#ERROR!` en `Avantages` alors que leurs
    `Conditions` sont intactes. Les filtrer amputait le catalogue de 10 % de ses
    dons — dont des prérequis très structurants (« Endurance », prérequis de 15
    dons, « Science de la lutte », de 18) — sur la seule foi d'un texte de
    description non importé, qui ne joue aucun rôle dans l'éligibilité.
    """
    avantages = _avantages_scrapes()
    if not avantages:
        return df

    df = df.copy()
    casse = df["Avantages"] == ERREUR_IMPORT
    recolle = df.loc[casse, "Dons"].map(lambda n: avantages.get(clean_feat_name(str(n))))
    df.loc[casse, "Avantages"] = recolle.where(recolle.notna(), ERREUR_IMPORT)
    return df


# Marqueurs « aucune condition » de la colonne `Conditions` : les concaténer à
# un ajout produirait un segment vide ou un tiret cadratin lu comme UNPARSED.
AUCUNE_CONDITION = {"", "-", "—", "–", "nan", ERREUR_IMPORT}


def _concatener_conditions(conditions: str, ajouts: tuple[str, ...] | list[str]) -> str:
    if not ajouts:
        return conditions
    base = conditions.strip()
    segments = [] if base.lower() in AUCUNE_CONDITION else [base]
    segments.extend(ajouts)
    return ", ".join(segments)


@lru_cache(maxsize=4)
def _prereq_supplements(chemin: Path | None = None) -> dict[str, tuple[str, ...]]:
    """Ajouts de prérequis curés, par nom de don nettoyé.

    Seuls les `ajouts` sont chargés : les `ignores` du même fichier ne servent
    qu'à documenter ce que la relecture a écarté, et pourquoi. Fichier absent =
    catalogue inchangé, comme pour toutes les couches de gating du dépôt.

    Le chemin est résolu **à l'appel** (et non lié comme valeur par défaut), pour
    qu'un test qui redirige ``paths.FEAT_PREREQ_SUPPLEMENTS`` soit effectivement
    pris en compte.
    """
    chemin = chemin or paths.FEAT_PREREQ_SUPPLEMENTS
    if not chemin.exists():
        return {}
    donnees = json.loads(chemin.read_text(encoding="utf-8"))
    return {
        clean_feat_name(entree["don"]): tuple(entree.get("ajouts") or [])
        for entree in donnees.get("entries", [])
        if entree.get("ajouts")
    }


def build_catalog(df: pd.DataFrame, all_feat_names: set[str] | None = None) -> list[FeatRow]:
    known_feat_names = all_feat_names or {clean_feat_name(n) for n in df["Dons"]}
    normalized_feats = build_normalized_feats(known_feat_names)
    supplements = _prereq_supplements()

    catalog = []
    for _, row in df.iterrows():
        display_name = str(row["Dons"])
        name = clean_feat_name(display_name)
        conditions = str(row["Conditions"])
        ajouts = supplements.get(name, ())
        parsed = parse_conditions(_concatener_conditions(conditions, ajouts), normalized_feats)
        catalog.append(
            FeatRow(
                name=name,
                display_name=display_name,
                source=str(row["Src"]),
                raw_conditions=conditions,
                benefits=str(row["Avantages"]),
                parsed=parsed,
                prereq_supplements=ajouts,
            )
        )
    return catalog


def load_catalog(path: Path = DEFAULT_CSV_PATH) -> list[FeatRow]:
    df = load_raw(path)
    all_feat_names = {clean_feat_name(n) for n in df["Dons"]}
    df = filter_valid_rows(repair_benefits(df))
    return build_catalog(df, all_feat_names=all_feat_names)
