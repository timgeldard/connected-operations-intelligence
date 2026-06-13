#!/usr/bin/env python3
"""CI guard: site_config_plant seed is well-formed and in sync with the CSV.

Checks:
  1. Schema conformance: every row in resources/config/site_config_plant.csv has all
     required fields, no unexpected columns, correct boolean flag types, valid
     go_live_status, valid lifecycle_status (ADR 016 vocabulary), valid_from <= valid_to.
  2. No duplicate plant_code in the CSV.
  3. The reference.py fallback seed matches the CSV: every plant_code in the CSV
     appears in the reference.py data list with matching key fields.

Exits 0 on success, 1 on any failure.
"""
import ast
import csv
import re
import sys
from datetime import date
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
SEED_CSV = REPO_ROOT / "data-products/io-reporting/resources/config/site_config_plant.csv"
REFERENCE_PY = REPO_ROOT / "data-products/io-reporting/silver/tables/reference.py"

# -- Expected schema (must match reference.py Row fields) ---------------------
BOOL_FIELDS = frozenset({
    "wm_enabled_flag", "hu_enabled_flag", "qm_enabled_flag", "spc_enabled_flag",
    "batch_managed_flag", "process_manufacturing_flag", "is_active",
})
STRING_FIELDS = frozenset({
    "plant_code", "plant_name", "country", "region", "business_unit",
    "timezone", "sap_system_id", "go_live_status", "lifecycle_status",
    "default_language_code", "config_owner",
})
DATE_FIELDS = frozenset({"valid_from", "valid_to", "last_validated_at"})
ALL_FIELDS = BOOL_FIELDS | STRING_FIELDS | DATE_FIELDS

ALLOWED_GO_LIVE_STATUSES = frozenset({
    "PRODUCTION", "PILOT", "SHADOW", "BLOCKED", "DECOMMISSIONED", "SUSPENDED",
})

# ADR 016 site_lifecycle vocabulary -- distinct from go_live_status.
ALLOWED_LIFECYCLE_STATUSES = frozenset({
    "ACTIVE", "CLOSED", "SOLD", "DIVESTED_ON_SAP",
})

PLANT_CODE_RE = re.compile(r"^[A-Z]\d{3}$")


# -- Helpers ------------------------------------------------------------------

def _parse_date(val: str) -> date | None:
    try:
        return date.fromisoformat(val)
    except (ValueError, TypeError):
        return None


def _csv_bool(val: str) -> bool | None:
    """Parse a CSV boolean string ('true'/'false') -> bool, or None if invalid."""
    if val.strip().lower() == "true":
        return True
    if val.strip().lower() == "false":
        return False
    return None


# -- CSV validation -----------------------------------------------------------

def validate_csv(errors: list[str]) -> list[dict]:
    """Validate the CSV file; return parsed rows (empty on missing file)."""
    if not SEED_CSV.exists():
        errors.append(
            f"[CSV] Seed CSV not found: {SEED_CSV}. "
            "Create resources/config/site_config_plant.csv."
        )
        return []

    with open(SEED_CSV, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        fieldnames = set(reader.fieldnames or [])
        missing_cols = ALL_FIELDS - fieldnames
        if missing_cols:
            errors.append(
                f"[CSV] Missing columns in site_config_plant.csv: {sorted(missing_cols)}"
            )
        extra_cols = fieldnames - ALL_FIELDS
        if extra_cols:
            errors.append(
                f"[CSV] Unexpected columns in site_config_plant.csv: {sorted(extra_cols)}"
            )
        rows = list(reader)

    seen_codes: set[str] = set()
    parsed: list[dict] = []

    for i, row in enumerate(rows, start=2):  # row 1 is the header
        pc = row.get("plant_code", "").strip()
        pfx = f"[CSV row {i} / {pc or '?'}]"

        # plant_code format
        if not pc:
            errors.append(f"{pfx} plant_code is empty.")
        elif not PLANT_CODE_RE.match(pc):
            errors.append(
                f"{pfx} plant_code '{pc}' does not match SAP WERKS format "
                "(1 uppercase letter + 3 digits)."
            )

        # Duplicate plant_code
        if pc in seen_codes:
            errors.append(f"{pfx} Duplicate plant_code '{pc}'.")
        seen_codes.add(pc)

        # Boolean fields
        for f in BOOL_FIELDS:
            raw = row.get(f, "")
            parsed_bool = _csv_bool(raw)
            if parsed_bool is None:
                errors.append(
                    f"{pfx} Field '{f}' must be 'true' or 'false', got: '{raw}'."
                )

        # go_live_status vocabulary
        gls = row.get("go_live_status", "").strip()
        if gls and gls not in ALLOWED_GO_LIVE_STATUSES:
            errors.append(
                f"{pfx} go_live_status '{gls}' is not in {sorted(ALLOWED_GO_LIVE_STATUSES)}."
            )

        # lifecycle_status vocabulary (ADR 016)
        lcs = row.get("lifecycle_status", "").strip()
        if lcs and lcs not in ALLOWED_LIFECYCLE_STATUSES:
            errors.append(
                f"{pfx} lifecycle_status '{lcs}' must be one of "
                f"{sorted(ALLOWED_LIFECYCLE_STATUSES)} "
                "(ADR 016 -- distinct from go_live_status)."
            )

        # valid_from <= valid_to
        vf = _parse_date(row.get("valid_from", ""))
        vt = _parse_date(row.get("valid_to", ""))
        if row.get("valid_from") and vf is None:
            errors.append(
                f"{pfx} valid_from '{row['valid_from']}' is not a valid date (YYYY-MM-DD)."
            )
        if row.get("valid_to") and vt is None:
            errors.append(
                f"{pfx} valid_to '{row['valid_to']}' is not a valid date (YYYY-MM-DD)."
            )
        if vf and vt and vf > vt:
            errors.append(f"{pfx} valid_from ({vf}) must be <= valid_to ({vt}).")

        parsed.append(row)

    return parsed


# -- reference.py seed extraction via AST ------------------------------------

def _extract_seed_plant_codes_from_reference_py() -> set[str]:
    """Extract plant_codes from the site_config_plant() data list in reference.py.

    Uses AST to find keyword args in Row(...) calls inside the site_config_plant function.
    Returns a set of plant_code values found.
    """
    src = REFERENCE_PY.read_text(encoding="utf-8")
    tree = ast.parse(src, filename=str(REFERENCE_PY))

    # Find the site_config_plant function
    target_fn: ast.FunctionDef | None = None
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "site_config_plant":
            target_fn = node
            break
    if target_fn is None:
        return set()

    plant_codes: set[str] = set()
    for call in ast.walk(target_fn):
        if not (isinstance(call, ast.Call) and isinstance(call.func, ast.Name)
                and call.func.id == "Row"):
            continue
        for kw in call.keywords:
            if kw.arg == "plant_code" and isinstance(kw.value, ast.Constant):
                plant_codes.add(kw.value.value)
    return plant_codes


def validate_reference_py_sync(csv_rows: list[dict], errors: list[str]) -> None:
    """Verify every plant_code in the CSV also appears in reference.py's seed."""
    if not REFERENCE_PY.exists():
        errors.append(f"[SYNC] reference.py not found at {REFERENCE_PY}.")
        return

    seed_codes = _extract_seed_plant_codes_from_reference_py()
    csv_codes = {r.get("plant_code", "").strip() for r in csv_rows if r.get("plant_code")}

    missing_in_seed = csv_codes - seed_codes
    for pc in sorted(missing_in_seed):
        errors.append(
            f"[SYNC] plant_code '{pc}' is in site_config_plant.csv "
            "but NOT in the reference.py fallback seed. "
            "Add the Row() entry to silver/tables/reference.py site_config_plant()."
        )

    orphan_in_seed = seed_codes - csv_codes
    for pc in sorted(orphan_in_seed):
        errors.append(
            f"[SYNC] plant_code '{pc}' is in the reference.py fallback seed "
            "but NOT in site_config_plant.csv. "
            "Add the CSV row or remove the stale Row() entry."
        )


# -- Main ---------------------------------------------------------------------

def run_checks() -> int:
    print("Running site_config_plant seed guard...")
    errors: list[str] = []

    csv_rows = validate_csv(errors)
    if csv_rows:
        validate_reference_py_sync(csv_rows, errors)

    if errors:
        print("\nSeed guard FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1

    csv_count = len(csv_rows)
    print(
        f"\nSeed guard PASSED: {csv_count} plant(s) in CSV, "
        "all well-formed, CSV and reference.py seed in sync."
    )
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
