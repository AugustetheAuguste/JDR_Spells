"""Recolle dans Dons.csv les `Avantages` en `#ERROR!` récupérables depuis
feat_details.json, au lieu de laisser data_loader.repair_benefits() les
reconstruire à chaque chargement.

Idempotent : les lignes déjà réparées (ou sans texte scrapé disponible)
restent inchangées.
"""

import pandas as pd

from pf1_dons import paths
from pf1_dons.data_loader import ERREUR_IMPORT, load_raw, repair_benefits


def main() -> None:
    df = load_raw()
    avant = int((df["Avantages"] == ERREUR_IMPORT).sum())

    reparé = repair_benefits(df)
    encore_erreur = int((reparé["Avantages"] == ERREUR_IMPORT).sum())

    reparé.to_csv(paths.DONS_CSV, index=False, encoding="utf-8")

    print(f"{avant - encore_erreur} lignes réparées ({avant} en #ERROR! avant, {encore_erreur} restantes).")


if __name__ == "__main__":
    main()
