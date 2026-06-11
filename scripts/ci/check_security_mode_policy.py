#!/usr/bin/env python3
"""CI guard: production Gold security SQL must use the REAL security model — never a validation mode.

The Gold security SQL generator (data-products/io-reporting/scripts/generate_gold_security_sql.py)
supports validation modes (validation-open pass-throughs, validation-fixture local fixture) for UAT/DEV
data-shape and predicate testing. This guard prevents those modes from ever reaching production:

Fails if:
  * a prod validation-mode file exists (gold_security_prod_validation_*.sql);
  * gold_security_prod.sql is missing, or lacks published_prod.security.model / current_user() /
    array_contains(filter_plant, plant_code);
  * gold_security_prod.sql references a fixture table (security_model_fixture);
  * any prod `*_secured` view is a pass-through (no `WHERE EXISTS` security predicate).

Allows:
  * gold_security_uat_validation_open.sql / gold_security_uat_validation_fixture.sql (UAT-only);
  * dev pass-throughs (gold_security_dev.sql — no published security model in dev).
"""
import glob
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))
SQL_DIR = os.path.join(REPO_ROOT, "data-products/io-reporting/resources/sql")

PROD_STRICT = "gold_security_prod.sql"
PROD_MODEL = "published_prod.security.model"
REQUIRED_IN_PROD = (PROD_MODEL, "current_user()", "array_contains(filter_plant, plant_code)")
FORBIDDEN_IN_PROD = ("security_model_fixture", "validation-open", "validation_open",
                     "validation-fixture", "validation_fixture")

# A secured-view block: from "CREATE OR REPLACE VIEW ..._secured AS" up to the terminating ";".
_SECURED_BLOCK = re.compile(
    r"CREATE OR REPLACE VIEW\s+\S+_secured\s+AS(?P<body>.*?);", re.IGNORECASE | re.DOTALL
)


def scan(sql_dir: str) -> list:
    """Return a list of policy-violation messages for the security SQL in `sql_dir` (empty = clean)."""
    errors = []

    # 1. No prod validation-mode files may exist.
    for path in glob.glob(os.path.join(sql_dir, "gold_security_prod_validation_*.sql")):
        errors.append(
            f"[{os.path.basename(path)}] prod validation-mode security SQL is forbidden — prod must use "
            f"the real {PROD_MODEL}."
        )

    prod_path = os.path.join(sql_dir, PROD_STRICT)
    if not os.path.exists(prod_path):
        errors.append(f"[{PROD_STRICT}] missing — prod strict security SQL must exist.")
    else:
        with open(prod_path, encoding="utf-8") as f:
            prod = f.read()
        for token in REQUIRED_IN_PROD:
            if token not in prod:
                errors.append(f"[{PROD_STRICT}] must contain '{token}' (real corporate-model RLS).")
        for token in FORBIDDEN_IN_PROD:
            if token in prod:
                errors.append(f"[{PROD_STRICT}] must NOT contain '{token}' (validation/fixture artefact).")
        # 2. Every prod secured view must carry a WHERE EXISTS predicate (no pass-throughs).
        blocks = _SECURED_BLOCK.findall(prod)
        if not blocks:
            errors.append(f"[{PROD_STRICT}] no `*_secured` views found — expected the prod secured views.")
        for body in blocks:
            if "WHERE EXISTS" not in body.upper():
                m = re.search(r"FROM\s+(\S+)", body)
                errors.append(
                    f"[{PROD_STRICT}] secured view over {m.group(1) if m else '?'} is a pass-through "
                    f"(no WHERE EXISTS security predicate) — forbidden in prod."
                )
    return errors


def run_checks() -> int:
    print("Running security-mode policy check...")
    errors = scan(SQL_DIR)
    if errors:
        print("\nSecurity-mode policy check FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nSecurity-mode policy check passed: prod uses the real security model; no validation modes in prod.")
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
