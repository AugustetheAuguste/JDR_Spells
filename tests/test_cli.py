import pytest

from pf1_dons import cli, persistence


@pytest.fixture(autouse=True)
def isolate_characters_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(persistence, "DEFAULT_CHARACTERS_DIR", tmp_path)


def test_create_show_list_round_trip(capsys):
    cli.main(
        [
            "create",
            "Test CLI",
            "--class",
            "Guerrier",
            "--level",
            "1",
            "--race",
            "humain",
            "--for",
            "16",
        ]
    )
    out = capsys.readouterr().out
    assert "Test CLI" in out

    cli.main(["show", "Test CLI"])
    out = capsys.readouterr().out
    assert "Test CLI" in out
    assert "Guerrier" in out

    cli.main(["list"])
    out = capsys.readouterr().out
    assert "Test_CLI" in out


def test_slots_lists_open_slots_with_candidates(capsys):
    cli.main(
        [
            "create",
            "Test Slots",
            "--class",
            "Guerrier",
            "--level",
            "1",
        ]
    )
    capsys.readouterr()

    cli.main(["slots", "Test Slots"])
    out = capsys.readouterr().out
    assert "general-1" in out
    assert "- " in out
    assert "autres" in out


def test_assign_then_show_reflects_filled_slot(capsys):
    cli.main(
        [
            "create",
            "Test Assign CLI",
            "--class",
            "Guerrier",
            "--level",
            "1",
        ]
    )
    capsys.readouterr()

    cli.main(["assign", "Test Assign CLI", "general-1", "Arme en main"])
    out = capsys.readouterr().out
    assert "attribué" in out

    cli.main(["show", "Test Assign CLI"])
    out = capsys.readouterr().out
    assert "Arme en main" in out


def test_assign_rejects_ineligible_feat(capsys):
    cli.main(
        [
            "create",
            "Test Reject CLI",
            "--class",
            "Magicien",
            "--level",
            "1",
        ]
    )
    capsys.readouterr()

    with pytest.raises(SystemExit):
        cli.main(["assign", "Test Reject CLI", "general-1", "Arme en main"])
    out = capsys.readouterr().out
    assert "n'est pas éligible" in out


def test_assign_rejects_duplicate_feat_across_slots(capsys):
    cli.main(
        [
            "create",
            "Test Dup CLI",
            "--class",
            "Guerrier",
            "--level",
            "1",
            "--race",
            "humain",
        ]
    )
    capsys.readouterr()

    cli.main(["assign", "Test Dup CLI", "general-1", "Arme en main"])
    capsys.readouterr()

    with pytest.raises(SystemExit):
        cli.main(["assign", "Test Dup CLI", "class-1", "Arme en main"])
    out = capsys.readouterr().out
    assert "déjà attribué" in out


def test_unassign_reopens_slot(capsys):
    cli.main(
        [
            "create",
            "Test Unassign CLI",
            "--class",
            "Guerrier",
            "--level",
            "1",
        ]
    )
    capsys.readouterr()

    cli.main(["assign", "Test Unassign CLI", "general-1", "Arme en main"])
    capsys.readouterr()

    cli.main(["unassign", "Test Unassign CLI", "general-1"])
    out = capsys.readouterr().out
    assert "libéré" in out

    cli.main(["show", "Test Unassign CLI"])
    out = capsys.readouterr().out
    assert "(vide)" in out
