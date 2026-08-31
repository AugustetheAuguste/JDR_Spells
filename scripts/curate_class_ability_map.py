"""One-off curation script for Wave 2 / Step 02: turns
Data/class_ability_map.draft.json into the final, reviewed
Data/class_ability_map.json (568 -> 568 entries, 100% coverage).

Not part of the package; run manually:
    python scripts/curate_class_ability_map.py

Approach: rules-based curation over the normalized_text of each draft
entry, using auto_detected_classes/matched_ability_keywords as hints (not
ground truth), with real Pathfinder 1e rules knowledge applied to fix
known false triggers (esp. "sorts" -> spurious "chasseur_de_vampire", which
is not even a real PF1e class) and to recognize genuine class abilities
the seed script's keyword table missed (mostly due to curly vs straight
apostrophe normalization gaps).
"""
import json
import re
import unicodedata

from pf1_dons.class_progression import CLASS_BBA_PROGRESSION

VALID_CLASSES = set(CLASS_BBA_PROGRESSION.keys())
FALSE_CLASS = "chasseur_de_vampire"


def to_real(classes):
    """Convert underscore auto-detect class tokens to real space-separated
    CLASS_BBA_PROGRESSION keys, dropping the spurious 'chasseur_de_vampire'."""
    out = []
    for c in classes:
        if c == FALSE_CLASS:
            continue
        real = c.replace("_", " ")
        if real not in VALID_CLASSES:
            # shouldn't happen, but never invent an invalid key
            continue
        if real not in out:
            out.append(real)
    return out


# ---------------------------------------------------------------------------
# Substring/regex rules, evaluated top to bottom; first match wins.
# Each rule: (predicate(normalized_text) -> bool, disposition, classes_or_reason)
# ---------------------------------------------------------------------------

def contains(*subs):
    return lambda t, subs=subs: any(s in t for s in subs)


def regex(pattern):
    rx = re.compile(pattern)
    return lambda t, rx=rx: rx.search(t) is not None


MAPPED_RULES = [
    # --- required bug cases ---
    (contains("capacite de classe mystere"), ["oracle"]),
    (lambda t: t == "mystere", ["oracle"]),
    (contains("capacite a lancer des sorts de sanguin de 2e niveau"), ["sanguin"]),

    # --- sneak-attack family: rogue / ninja / slayer ---
    (regex(r"attaque sournoise ?\+?\d*d6"), ["ninja", "roublard", "tueur"]),
    (lambda t: t == "capacite de classe attaque sournoise", ["ninja", "roublard", "tueur"]),

    # investigator studied-strike combined with sneak attack (OR-group text)
    (contains("frappe etudiee +3d6"), ["enqueteur", "ninja", "roublard", "tueur"]),
    (contains("frappe etudiee +4d6"), ["enqueteur"]),
    (lambda t: t == "frappe etudiee", ["enqueteur"]),

    # --- channel energy family (explicit md example of legit multi-class mapping) ---
    (contains("canalisation d'energie positive", "canalisation d’energie positive"),
     ["pretre", "pretre combattant", "paladin"]),
    (contains("canalisation d'energie negative", "canalisation d’energie negative"),
     ["pretre", "pretre combattant", "antipaladin"]),
    (regex(r"canalisation d.energie"), ["pretre", "pretre combattant", "paladin", "antipaladin"]),

    # --- warpriest favored/sacred weapon family ---
    (contains("arme de predilection"), ["pretre combattant"]),
    (lambda t: t == "arme sacree", ["pretre combattant"]),
    (contains("armure sacree"), ["pretre combattant"]),

    # --- domain (cleric / inquisitor / warpriest all have domains) ---
    (regex(r"^domaine|capacite de classe domaine|capacites de classe domaine"),
     ["pretre", "inquisiteur", "pretre combattant"]),

    # --- oracle mystery/revelation ---
    (contains("revelation"), ["oracle"]),

    # --- paladin-specific ---
    (contains("detection du mal"), ["paladin"]),
    (contains("imposition des mains"), ["paladin"]),
    (contains("sante divine"), ["paladin"]),
    (lambda t: t == "grace" or "capacite de classe grace" in t, ["paladin"]),
    (contains("pacte divin"), ["paladin"]),
    (contains("chatiment du mal"), ["paladin"]),
    (contains("aura de courage"), ["paladin", "pretre", "pretre combattant"]),
    (contains("aura de fermete"), ["paladin", "pretre", "pretre combattant"]),
    (lambda t: t.strip() == "capacite de classe aura", ["pretre", "pretre combattant"]),
    (lambda t: t.strip() == "capacite de classe aura d'ancrage" or "aura d’ancrage" in t,
     ["pretre", "pretre combattant"]),

    # --- antipaladin ---
    (contains("detection du bien"), ["antipaladin"]),

    # --- sorcerer / bloodrager bloodline ---
    (contains("lignage d'ensorceleur", "lignage d’ensorceleur"), ["ensorceleur"]),
    (lambda t: t == "lignage aberrant" or "capacite de classe du lignage" in t or "capacite de classe lignage" in t,
     ["ensorceleur", "sanguin"]),

    # --- bloodrager (sanguin) specific ---
    (contains("incantation sanguine"), ["sanguin"]),
    (contains("rage sanguine"), ["sanguin"]),

    # --- barbarian rage family ---
    (contains("rage de berserker", "rage de grand berserker"), ["barbare"]),
    (contains("pouvoir de rage", "pouvoirs de rage", "chant de rage"), ["barbare", "scalde"]),
    (contains("esquive instinctive"), ["barbare", "ninja", "roublard", "sanguin", "scalde"]),

    # --- monk ---
    (contains("deluge de coups"), ["moine"]),
    (contains("pas chasse"), ["moine"]),
    (contains("serenite"), ["moine", "ninja"]),
    (contains("chute ralentie"), ["moine"]),
    (regex(r"combat a mains nues"), ["moine", "lutteur"]),

    # --- rogue/ranger/monk shared defensive abilities ---
    (contains("esquive totale"), ["moine", "rodeur", "roublard"]),
    (contains("esquive surnaturelle"), ["moine", "rodeur", "roublard"]),
    (contains("reserve de ki"), ["ninja", "moine"]),

    # --- ninja ---
    (contains("astuce de maitre"), ["ninja"]),
    (contains("talent de tueur"), ["inquisiteur", "tueur"]),
    (lambda t: t == "capacite de classe tueur", ["inquisiteur", "tueur"]),

    # --- rogue ---
    (contains("talent de roublard", "talents de roublard", "talent de maitre roublard"), ["roublard"]),
    (regex(r"capacite de classe talents? de roublard"), ["roublard"]),
    (contains("sens des pieges"), ["barbare", "rodeur", "roublard"]),

    # --- alchemist ---
    (contains("decouverte", "decouvertes"), ["alchimiste"]),
    (contains("alchimie rapide"), ["alchimiste", "enqueteur"]),
    (lambda t: t == "capacite de classe alchimie et inspiration" or "capacites de classe alchimie et inspiration" in t,
     ["alchimiste", "enqueteur"]),
    (contains("preparation de potions"), ["alchimiste"]),
    (contains("utilisation du poison", "utilisation des poisons"), ["alchimiste", "ninja"]),

    # --- investigator ---
    (contains("combat etudie"), ["enqueteur"]),
    (contains("cible etudiee"), ["enqueteur"]),
    (regex(r"^inspiration$|capacite de classe inspiration|reserve d.inspiration|aucun niveau dans une classe dotee d.inspiration"),
     ["enqueteur"]),
    (contains("souvenir precis", "souvenir magique"), ["enqueteur"]),
    (lambda t: "souvenir magique" in t, ["magus"]),
    (contains("talent d'enqueteur", "talent d’enqueteur"), ["enqueteur"]),
    (contains("connaissance des poisons"), ["enqueteur"]),
    (contains("representation bardique inspiration talentueuse"), ["barde", "enqueteur"]),

    # --- gunslinger (pistolier) ---
    (contains("aucun niveau dans une classe dotee d'audace", "aucun niveau dans une classe dotee d’audace"),
     ["pistolier"]),
    (contains("exploit parade et riposte opportune"), ["pistolier"]),
    (lambda t: t == "capacite de classe exploitation d'arcaniste" or "exploitation d'arcaniste" in t or "exploitation d’arcaniste" in t,
     ["arcaniste", "pistolier"]),

    # --- swashbuckler (bretteur) ---
    (contains("aucun niveau dans une classe dotee de panache", "aucun niveau dans une classe dotee de panache"),
     ["bretteur"]),

    # --- summoner (conjurateur) ---
    (contains("eidolon"), ["conjurateur"]),
    (contains("aspect bestial", "aspect (", "capacite de classe aspect"), ["conjurateur"]),
    (contains("protection d'allie", "protection d’allie"), ["conjurateur"]),
    (contains("convocation de monstres i") , ["conjurateur"]),

    # --- druid / ranger / hunter / shifter shared nature abilities ---
    (contains("empathie sauvage"), ["chasseur", "druide", "metamorphe", "rodeur"]),
    (contains("deplacement facilite"), ["chasseur", "druide", "metamorphe", "rodeur"]),
    (contains("imitation animale"), ["chasseur"]),
    (regex(r"compagnon animal"), ["chasseur", "druide", "rodeur", "cavalier"]),
    # « Forme animale » est AVANT TOUT la capacité signature du druide
    # (niveau 4) ; le métamorphe la possède aussi. L'attribuer au seul
    # métamorphe rendait un druide *ineligible* à tous les dons de forme
    # animale — une sous-attribution est bien plus grave qu'une
    # sur-attribution (celle-ci ne produit qu'un manual_check).
    (contains("forme animale", "capacite a utilise un effet de metamorphose"),
     ["druide", "metamorphe"]),
    # Exiger à la fois « ennemi juré » et « forme animale » suppose un
    # multiclassage rôdeur/druide ou un métamorphe : on liste les trois
    # classes concernées plutôt que d'en exclure deux à tort.
    (contains("ennemi juré et forme animale", "ennemi jure et forme animale"),
     ["druide", "metamorphe", "rodeur"]),

    # --- shaman / witch (chaman / sorciere) hex family ---
    (regex(r"malefice"), ["chaman", "sorciere"]),

    # --- spiritualist (spirite) ---
    (contains("fantome"), ["spirite"]),
    (contains("partage de conscience", "partage des sens"), ["spirite"]),
    (contains("detection des morts-vivants"), ["spirite"]),

    # --- medium ---
    (contains("magie des esprits"), ["chaman", "medium"]),
    (contains("conciliation"), ["medium"]),

    # --- psychic (psychiste) ---
    (contains("amplification phrenique"), ["psychiste"]),
    (contains("reserve phrenique"), ["psychiste"]),
    (contains("telepathie"), ["psychiste"]),
    (contains("detection de pensees"), ["psychiste"]),

    # --- occultist ---
    (contains("focalisation mentale", "pouvoir de focalisation"), ["occultiste"]),

    # --- kineticist (cinetiste) ---
    (contains("explosion cinetique", "metacinetique"), ["cinetiste"]),

    # --- hypnotist (hypnotiseur) ---
    (contains("regard hypnotique", "regard douloureux", "regard impudent", "induction d'hypnotiseur",
              "induction d’hypnotiseur", "inductions d'hypnotiseur", "inductions d’hypnotiseur"),
     ["hypnotiseur"]),

    # --- vigilante (justicier) ---
    (contains("apparition surprenante", "apparition effrayante"), ["justicier"]),
    (contains("talent social"), ["justicier"]),

    # --- inquisitor ---
    (contains("connaissance des monstres"), ["inquisiteur"]),
    (contains("detection d'alignement", "detection d’alignement"), ["inquisiteur"]),
    (contains("detection des mensonges"), ["inquisiteur"]),
    (contains("regard severe"), ["inquisiteur"]),
    (contains("second jugement"), ["inquisiteur"]),
    (contains("initiative rusee"), ["inquisiteur"]),
    (lambda t: t == "capacite de classe jugement", ["inquisiteur"]),

    # --- samurai / cavalier mount, order abilities ---
    (regex(r"\bmonture\b"), ["chevalier", "samourai"]),
    (contains("dresseur experimente"), ["chevalier"]),
    (contains("tacticien"), ["chevalier"]),
    (contains("expertise martiale"), ["samourai"]),

    # --- magus ---
    (contains("arcane de magus"), ["magus"]),
    (contains("reserve magique"), ["magus"]),

    # --- arcanist (arcaniste) ---
    (contains("reservoir arcanique"), ["arcaniste"]),
    (contains("capacite de classe grimoire"), ["arcaniste"]),

    # --- wizard (magicien) ---
    (contains("ecole de magie", "ecole renforcee"), ["magicien"]),

    # --- bard / skald ---
    (contains("savoir bardique"), ["barde", "scalde"]),
    (contains("versatilite artistique"), ["barde", "scalde"]),
    (contains("representation bardique"), ["barde"]),
    (contains("chant funeste"), ["barde", "scalde"]),
    (lambda t: t == "ecriture de parchemins", ["magicien", "scalde"]),

    # --- cleric / oracle shared spontaneous divine ---
    (regex(r"^des oraisons$|capacite.*oraisons"),
     ["chaman", "chasseur", "druide", "inquisiteur", "oracle", "pretre", "pretre combattant"]),

    # --- fighter ---
    (contains("courage +3"), ["guerrier"]),

    # --- tracking (ranger/hunter/inquisitor/slayer/shifter native ability) ---
    (lambda t: t == "pistage", ["chasseur", "inquisiteur", "metamorphe", "rodeur", "tueur"]),

    # --- generic school of arcane casters (cantrips) ---
    (contains("capacite a lancer des tours de magie"),
     ["arcaniste", "barde", "conjurateur", "ensorceleur", "magicien", "magus", "scalde", "sorciere"]),
]


NO_SINGLE_CLASS_RULES = [
    # ---- known false-trigger: "sorts" (spellcasting in general) ----
    (regex(r"\bsorts?\b") if False else contains("sort"),
     "generic spellcasting prerequisite ('sorts'/'lancer des sorts') matches many unrelated "
     "spellcasting classes; the seed script's bare 'sorts' keyword falsely hinted the "
     "non-existent 'chasseur de vampire' class -- no single class can be attributed from "
     "this phrase alone"),
]


def normalize_apostrophes(t: str) -> str:
    return t.replace("’", "'")


def decide(entry):
    text = normalize_apostrophes(entry["normalized_text"])

    for pred, classes in MAPPED_RULES:
        if pred(text):
            return "mapped", list(classes), None

    # fix known false trigger before falling to generic "sorts" rule below,
    # but only if entry is *purely* a generic spellcasting mention (no other
    # real signal). Since MAPPED_RULES already handled every genuine class
    # ability above (sanguin spells etc. matched by the specific bug-case
    # rule), anything reaching here that mentions "sort" is a generic/
    # ambiguous spellcasting prerequisite.
    if "sort" in text:
        return (
            "no_single_class",
            [],
            "generic spellcasting prerequisite ('sorts'/'lancer des sorts') matches many "
            "unrelated spellcasting classes; the seed script's bare 'sorts' keyword falsely "
            "hinted the non-existent 'chasseur de vampire' class -- no single class can be "
            "attributed from this phrase alone",
        )

    # Fall back to auto_detected_classes if it gives a clean, non-generic,
    # non-false-class signal not already covered above.
    auto = to_real(entry["auto_detected_classes"])
    keywords = entry.get("matched_ability_keywords") or []
    literal = entry.get("matched_literal_class_names") or []
    if auto and (literal or (keywords and keywords != ["sorts"])):
        return "mapped", auto, None

    return (
        "no_single_class",
        [],
        "generic prerequisite (ability score, skill rank, alignment, racial trait, "
        "deity-worship, weapon/armor proficiency, feat name, or other non-class-gated "
        "requirement) or an ability whose class attribution cannot be confidently "
        "determined from the text alone even with Pathfinder 1e rules knowledge",
    )


def main():
    with open("Data/class_ability_map.draft.json", encoding="utf-8") as f:
        draft = json.load(f)

    expected_count = len(draft)
    final_entries = []
    seen_keywords = set()

    for entry in draft:
        disposition, classes, reason = decide(entry)

        if disposition == "mapped":
            for c in classes:
                assert c in VALID_CLASSES, f"invalid class {c!r} for {entry['raw_text']!r}"
            assert classes, entry["raw_text"]
            reason = None
        else:
            assert not classes
            assert reason

        keyword = entry["normalized_text"]
        assert keyword not in seen_keywords, f"duplicate keyword {keyword!r}"
        seen_keywords.add(keyword)

        final_entries.append(
            {
                "keyword": keyword,
                "classes": classes,
                "disposition": disposition,
                "reason": reason,
                "source_raw_examples": [entry["raw_text"]],
                "confidence": "reviewed",
            }
        )

    assert len(final_entries) == expected_count, (len(final_entries), expected_count)

    final_entries.sort(key=lambda e: e["keyword"])

    with open("Data/class_ability_map.json", "w", encoding="utf-8") as f:
        json.dump({"entries": final_entries}, f, ensure_ascii=False, indent=2)

    mapped = sum(1 for e in final_entries if e["disposition"] == "mapped")
    nsc = sum(1 for e in final_entries if e["disposition"] == "no_single_class")
    print(f"total={len(final_entries)} mapped={mapped} no_single_class={nsc}")


if __name__ == "__main__":
    main()
