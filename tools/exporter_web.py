"""Run the full export in one command, from a fresh clone, on any platform.

Why this exists rather than an npm script chaining `python -m …`: the modules live
under `src/`, so they need `PYTHONPATH=src` unless the package was installed, and
an npm script cannot set an environment variable portably (`VAR=x cmd` is a POSIX
shell idiom that cmd.exe does not understand). Putting `sys.path` in one place also
means the documented command works before `pip install -e .` has ever been run —
which is what « depuis un clone neuf, sans intervention » requires.

The two steps are ordered, not parallel: `build_alias` reads the `index.json` that
`export_web` writes, and an alias table validated against a stale index would
accept an id that no longer exists.

    python tools/exporter_web.py
"""

from __future__ import annotations

import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "src"))

from pf_spells.build_alias import AliasError  # noqa: E402
from pf_spells.build_alias import main as main_alias  # noqa: E402
from pf_spells.export_web import ExportWebError  # noqa: E402
from pf_spells.export_web import main as main_export  # noqa: E402


def main() -> int:
    try:
        code = main_export(["--racine", str(RACINE), "--sortie", str(RACINE / "web/public/data")])
        if code != 0:
            return code
        return main_alias(["--racine", str(RACINE)])
    except (ExportWebError, AliasError) as erreur:
        print(f"ÉCHEC : {erreur}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
