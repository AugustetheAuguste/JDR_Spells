"""Transcrit la vérité terrain relue à la main
(`build/armes-et-armures-de-classe/OUTPUT_class_proficiencies_ground_truth.md`)
en `Data/classes/class_proficiencies.json`.

Ce script ne fait que lire le tableau markdown et l'écrire en JSON ; il ne
redérive ni ne devine aucune valeur (même patron que
`curate_class_caster_info.py`). Toute classe absente du tableau (ex.
« chasseur de vampire », qui n'existe pas officiellement en PF1) est
volontairement absente du JSON produit : `engine.py` doit alors traiter la
classe comme inconnue (`None`), jamais comme "aucune maîtrise" (`False`).

Usage : python scripts/curate_class_proficiencies.py
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf_dons import paths

GROUND_TRUTH_DOC = "build/armes-et-armures-de-classe/OUTPUT_class_proficiencies_ground_truth.md"
OUT_PATH = paths.CLASS_PROFICIENCIES

ROW_RE = re.compile(
    r"^\|\s*(?P<classe>[^|]+?)\s*\|\s*(?P<simples>true|false)\s*\|\s*"
    r"(?P<martiales>true|false)\s*\|\s*(?P<specifiques>[^|]*?)\s*\|\s*"
    r"(?P<boucliers>true|false)\s*\|\s*$"
)


def parse_bool(text: str) -> bool:
    return text == "true"


def main() -> None:
    text = Path(GROUND_TRUTH_DOC).read_text(encoding="utf-8")
    out: dict[str, dict] = {}
    for line in text.splitlines():
        match = ROW_RE.match(line)
        if not match:
            continue
        classe = match["classe"].strip()
        if classe in ("classe", "---") or set(classe) <= {"-"}:
            continue
        specifiques = [s.strip() for s in match["specifiques"].split(",") if s.strip()]
        out[classe] = {
            "armes_simples": parse_bool(match["simples"]),
            "armes_martiales": parse_bool(match["martiales"]),
            "armes_specifiques": specifiques,
            "boucliers": parse_bool(match["boucliers"]),
        }

    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"{OUT_PATH} : {len(out)} classes")


if __name__ == "__main__":
    main()
