from pf1_dons.models import OrGroup, RequirementType
from pf1_dons.parser import build_normalized_feats, parse_conditions

KNOWN_FEATS = {"Doigts de fée", "Trépanation", "Esquive"}
NORMALIZED_FEATS = build_normalized_feats(KNOWN_FEATS)


def test_bba():
    parsed = parse_conditions("BBA +1", NORMALIZED_FEATS)
    assert len(parsed.requirements) == 1
    req = parsed.requirements[0]
    assert req.type == RequirementType.BBA
    assert req.payload["min"] == 1


def test_ability_score():
    parsed = parse_conditions("Dex 13", NORMALIZED_FEATS)
    req = parsed.requirements[0]
    assert req.type == RequirementType.ABILITY_SCORE
    assert req.payload == {"ability": "Dex", "min": 13}


def test_multiple_skill_ranks():
    parsed = parse_conditions(
        "5 rangs en Acrobaties, 11 rangs en Équitation", NORMALIZED_FEATS
    )
    assert len(parsed.requirements) == 2
    assert all(r.type == RequirementType.SKILL_RANKS for r in parsed.requirements)
    assert parsed.requirements[0].payload == {"skill": "Acrobaties", "ranks": 5}
    assert parsed.requirements[1].payload == {"skill": "Équitation", "ranks": 11}


def test_race_or_group():
    parsed = parse_conditions("nain ou orque", NORMALIZED_FEATS)
    req = parsed.requirements[0]
    assert isinstance(req, OrGroup)
    assert [o.type for o in req.options] == [RequirementType.RACE, RequirementType.RACE]
    assert {o.payload["race"] for o in req.options} == {"nain", "orque"}


def test_feat_or_group():
    parsed = parse_conditions("Doigts de fée ou Trépanation", NORMALIZED_FEATS)
    req = parsed.requirements[0]
    assert isinstance(req, OrGroup)
    assert all(o.type == RequirementType.FEAT for o in req.options)


def test_class_feature_text_needs_manual_check():
    parsed = parse_conditions("Capacité de classe bond du lancier", NORMALIZED_FEATS)
    req = parsed.requirements[0]
    assert req.type == RequirementType.CLASS_FEATURE_TEXT
    assert req.needs_manual_check is True


def test_empty_conditions():
    parsed = parse_conditions("—", NORMALIZED_FEATS)
    assert parsed.requirements == []


def test_unknown_segment_is_unparsed_not_ignored():
    parsed = parse_conditions("Un texte totalement inventé et jamais vu", NORMALIZED_FEATS)
    req = parsed.requirements[0]
    assert req.type == RequirementType.UNPARSED
    assert req.needs_manual_check is True


def test_class_feature_text_implies_class():
    parsed = parse_conditions("Capacité de classe mystère", NORMALIZED_FEATS)
    req = parsed.requirements[0]
    assert req.payload["implied_classes"] == ["oracle"]


def test_unparsed_implies_class():
    parsed = parse_conditions(
        "Capacité à lancer des sorts de sanguin de 2e niveau", NORMALIZED_FEATS
    )
    req = parsed.requirements[0]
    assert req.payload["implied_classes"] == ["sanguin"]


def test_unknown_segment_has_no_implied_classes():
    parsed = parse_conditions("Un texte totalement inventé et jamais vu", NORMALIZED_FEATS)
    req = parsed.requirements[0]
    assert "implied_classes" not in req.payload
