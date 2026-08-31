from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from . import paths
from .models import ParsedConditions
from .parser import build_normalized_feats, parse_conditions

DEFAULT_CSV_PATH = paths.DONS_CSV


@dataclass
class FeatRow:
    name: str
    display_name: str
    source: str
    raw_conditions: str
    benefits: str
    parsed: ParsedConditions


def load_raw(path: Path = DEFAULT_CSV_PATH) -> pd.DataFrame:
    return pd.read_csv(path, encoding="utf-8")


def filter_valid_rows(df: pd.DataFrame) -> pd.DataFrame:
    mask = (df["Conditions"] != "#ERROR!") & (df["Avantages"] != "#ERROR!")
    return df[mask].reset_index(drop=True)


def clean_feat_name(name: str) -> str:
    return name.strip().rstrip("*").strip()


def build_catalog(df: pd.DataFrame, all_feat_names: set[str] | None = None) -> list[FeatRow]:
    known_feat_names = all_feat_names or {clean_feat_name(n) for n in df["Dons"]}
    normalized_feats = build_normalized_feats(known_feat_names)

    catalog = []
    for _, row in df.iterrows():
        display_name = str(row["Dons"])
        name = clean_feat_name(display_name)
        conditions = str(row["Conditions"])
        parsed = parse_conditions(conditions, normalized_feats)
        catalog.append(
            FeatRow(
                name=name,
                display_name=display_name,
                source=str(row["Src"]),
                raw_conditions=conditions,
                benefits=str(row["Avantages"]),
                parsed=parsed,
            )
        )
    return catalog


def load_catalog(path: Path = DEFAULT_CSV_PATH) -> list[FeatRow]:
    df = load_raw(path)
    all_feat_names = {clean_feat_name(n) for n in df["Dons"]}
    df = filter_valid_rows(df)
    return build_catalog(df, all_feat_names=all_feat_names)
