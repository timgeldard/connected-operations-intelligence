#!/usr/bin/env python3
"""CI guard: generated Gold security SQL files exist and contain all GOLD_TABLES entries.

Checks:
  1. The three canonical security SQL files exist:
       data-products/io-reporting/resources/sql/gold_security_dev.sql
       data-products/io-reporting/resources/sql/gold_security_uat.sql
       data-products/io-reporting/resources/sql/gold_security_prod.sql
  2. Each file contains a reference to every table in GOLD_TABLES from
     data-products/io-reporting/scripts/generate_gold_security_sql.py.

Missing tables indicate the security SQL was last regenerated before the GOLD_TABLES
list was updated. Run:
  cd data-products/io-reporting
  python scripts/generate_gold_security_sql.py

Exit 0 = OK; exit 1 = violations.

Run from the repo root.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
PRODUCT = REPO_ROOT / "data-products" / "io-reporting"
GENERATOR = PRODUCT / "scripts" / "generate_gold_security_sql.py"
SQL_DIR = PRODUCT / "resources" / "sql"

TARGET_FILES = [
    SQL_DIR / "gold_security_dev.sql",
    SQL_DIR / "gold_security_uat.sql",
    SQL_DIR / "gold_security_prod.sql",
]


def _load_gold_tables() -> list[str]:
    """Import GOLD_TABLES from generate_gold_security_sql.py without executing main()."""
    spec = importlib.util.spec_from_file_location("generate_gold_security_sql", GENERATOR)
    mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod.GOLD_TABLES


def check() -> list[str]:
    errors: list[str] = []

    if not GENERATOR.exists():
        return [f"{GENERATOR}: generator script not found"]

    try:
        gold_tables = _load_gold_tables()
    except Exception as exc:
        return [f"Failed to load GOLD_TABLES from {GENERATOR}: {exc}"]

    for sql_file in TARGET_FILES:
        if not sql_file.exists():
            errors.append(f"{sql_file.name}: file not found — run python scripts/generate_gold_security_sql.py")
            continue

        content = sql_file.read_text(encoding="utf-8")
        for table in gold_tables:
            if table not in content:
                errors.append(
                    f"{sql_file.name}: table '{table}' not found — "
                    "security SQL is stale, regenerate with python scripts/generate_gold_security_sql.py"
                )

    return errors


def main() -> int:
    errs = check()
    if errs:
        print("Generated artefacts freshness check: FAILED")
        for e in errs:
            print(f"  - {e}")
        return 1
    print(f"Generated artefacts freshness check: OK ({len(TARGET_FILES)} SQL files verified)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
