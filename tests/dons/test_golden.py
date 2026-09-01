import json

import pytest

from pf1_dons.data_loader import load_catalog
from pf1_dons.engine import Character, evaluate_feat


def load_cases():
    with open("tests/golden/cases.json", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def catalog():
    return load_catalog()


def find_feat(catalog, name):
    for feat in catalog:
        if feat.name == name:
            return feat
    raise AssertionError(f"Don introuvable dans le catalogue : {name}")


@pytest.mark.parametrize("case", load_cases(), ids=lambda c: c["id"])
def test_golden_case(case, catalog):
    feat = find_feat(catalog, case["feat_name"])
    character = Character(**{k: v for k, v in case["character"].items() if v is not None})
    result = evaluate_feat(feat, character)
    assert result.status == case["expected_status"], (
        f"{case['id']}: attendu {case['expected_status']}, obtenu "
        f"{result.status} ({result.reasons})"
    )
