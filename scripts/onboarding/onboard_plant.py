#!/usr/bin/env python3
"""Plant onboarding script -- validates a plant-config YAML offline and emits outputs.

Usage:
    python scripts/onboarding/onboard_plant.py <path-to-plant-config.yml>

The script:
1. Validates the config against the site_config_plant seed entry shape (reference.py).
2. Detects duplicates against the current resources/config/site_config_plant.csv.
3. Emits the CSV row to append to resources/config/site_config_plant.csv.
4. Emits the Python Row() snippet for the reference.py fallback seed.
5. Prints a LIVE-VALIDATION CHECKLIST of SQL probes for the orchestrator.
6. Exits non-zero if any validation fails.

Refactor decision -- why we emit paste snippets rather than auto-editing reference.py:
  The repo already has resources/config/site_config_plant.csv as the checked-in single
  source of plant config (consumed by scripts/generate_readiness_config_sql.py for
  governed SQL, and validated by check_site_config_plant_seed.py for CSV<->seed parity).
  Adding a separate YAML seed would create a parallel config that could drift -- violating
  the "do not create a parallel config" constraint in the spec.  The correct workflow is:
    (a) append a row to resources/config/site_config_plant.csv  (data edit, snippet emitted),
    (b) add the matching Python Row to the reference.py fallback seed  (snippet emitted),
    (c) regenerate governed SQL via scripts/generate_readiness_config_sql.py,
    (d) run CI guard scripts/ci/check_site_config_plant_seed.py before committing.
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("PyYAML is required: pip install pyyaml", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SEED_CSV = REPO_ROOT / "data-products/io-reporting/resources/config/site_config_plant.csv"

# -- Schema: exact fields from reference.py site_config_plant seed ------------
BOOL_FIELDS: frozenset[str] = frozenset({
    "wm_enabled_flag", "hu_enabled_flag", "qm_enabled_flag", "spc_enabled_flag",
    "batch_managed_flag", "process_manufacturing_flag", "is_active",
})
STRING_FIELDS: frozenset[str] = frozenset({
    "plant_code", "plant_name", "country", "region", "business_unit",
    "timezone", "sap_system_id", "go_live_status", "lifecycle_status",
    "default_language_code", "config_owner",
})
DATE_FIELDS: frozenset[str] = frozenset({"valid_from", "valid_to", "last_validated_at"})
ALL_FIELDS: frozenset[str] = BOOL_FIELDS | STRING_FIELDS | DATE_FIELDS

# -- Allowed vocabularies -----------------------------------------------------
# go_live_status: BLOCKED/DECOMMISSIONED/SUSPENDED exclude a plant from the gate
# (silver/_plant_gate.py _BLOCKED_GO_LIVE_STATUSES); PRODUCTION is the live status.
ALLOWED_GO_LIVE_STATUSES: frozenset[str] = frozenset({
    "PRODUCTION", "PILOT", "SHADOW", "BLOCKED", "DECOMMISSIONED", "SUSPENDED",
})

# lifecycle_status: ADR 016 site_lifecycle dimension -- distinct from go_live_status.
# Must match silver.site_lifecycle effective_lifecycle vocabulary.
ALLOWED_LIFECYCLE_STATUSES: frozenset[str] = frozenset({
    "ACTIVE", "CLOSED", "SOLD", "DIVESTED_ON_SAP",
})

# SAP WERKS format: 1 uppercase letter + 3 digits (e.g. C061, P817)
PLANT_CODE_RE = re.compile(r"^[A-Z]\d{3}$")

# CSV column order -- must match site_config_plant.csv header exactly
CSV_COLUMNS = [
    "plant_code", "plant_name", "country", "region", "business_unit",
    "timezone", "sap_system_id", "go_live_status", "wm_enabled_flag",
    "hu_enabled_flag", "qm_enabled_flag", "spc_enabled_flag", "lifecycle_status",
    "batch_managed_flag", "process_manufacturing_flag", "default_language_code",
    "valid_from", "valid_to", "is_active", "config_owner", "last_validated_at",
]


# -- Validation ---------------------------------------------------------------

def _parse_date(val: Any) -> date | None:
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        try:
            return date.fromisoformat(val)
        except ValueError:
            return None
    return None


def validate_entry(entry: dict, seen_in_file: set[str]) -> list[str]:
    """Validate a single plant entry; return a list of error strings."""
    errors: list[str] = []
    pc = entry.get("plant_code", "<unknown>")
    pfx = f"[{pc}]"

    # 1. Required fields present
    missing = ALL_FIELDS - set(entry.keys())
    if missing:
        errors.append(f"{pfx} Missing required fields: {sorted(missing)}")

    # 2. No unexpected fields (typo guard -- silently wrong field names are bugs)
    extra = set(entry.keys()) - ALL_FIELDS
    if extra:
        errors.append(f"{pfx} Unexpected fields (possible typos): {sorted(extra)}")

    # 3. plant_code format
    raw_code = entry.get("plant_code")
    if raw_code and not PLANT_CODE_RE.match(str(raw_code)):
        errors.append(
            f"{pfx} plant_code '{raw_code}' does not match SAP WERKS format "
            "(1 uppercase letter + 3 digits, e.g. C061)."
        )

    # 4. Intra-file duplicate
    if raw_code in seen_in_file:
        errors.append(f"{pfx} Duplicate plant_code '{raw_code}' in this config file.")

    # 5. Boolean field types (YAML true/false, not strings like 'true'/'false')
    for f in BOOL_FIELDS:
        val = entry.get(f)
        if val is not None and not isinstance(val, bool):
            errors.append(
                f"{pfx} Field '{f}' must be a boolean (true/false in YAML), "
                f"got {type(val).__name__}: {val!r}."
            )

    # 6. go_live_status vocabulary
    gls = entry.get("go_live_status")
    if gls and gls not in ALLOWED_GO_LIVE_STATUSES:
        errors.append(
            f"{pfx} go_live_status '{gls}' is not in the allowed set "
            f"{sorted(ALLOWED_GO_LIVE_STATUSES)}."
        )

    # 7. lifecycle_status vocabulary (ADR 016 -- distinct from go_live_status)
    lcs = entry.get("lifecycle_status")
    if lcs and lcs not in ALLOWED_LIFECYCLE_STATUSES:
        errors.append(
            f"{pfx} lifecycle_status '{lcs}' must be one of "
            f"{sorted(ALLOWED_LIFECYCLE_STATUSES)} "
            "(ADR 016 / site_lifecycle vocabulary -- distinct from go_live_status)."
        )

    # 8. valid_from <= valid_to
    vf = _parse_date(entry.get("valid_from"))
    vt = _parse_date(entry.get("valid_to"))
    if entry.get("valid_from") is not None and vf is None:
        errors.append(
            f"{pfx} valid_from '{entry['valid_from']}' is not a valid date (YYYY-MM-DD)."
        )
    if entry.get("valid_to") is not None and vt is None:
        errors.append(
            f"{pfx} valid_to '{entry['valid_to']}' is not a valid date (YYYY-MM-DD)."
        )
    if vf and vt and vf > vt:
        errors.append(f"{pfx} valid_from ({vf}) must be <= valid_to ({vt}).")

    # 9. last_validated_at is a parseable date
    lvr = entry.get("last_validated_at")
    if lvr is not None and _parse_date(lvr) is None:
        errors.append(
            f"{pfx} last_validated_at '{lvr}' is not a valid date (YYYY-MM-DD)."
        )

    return errors


def load_existing_plant_codes() -> set[str]:
    """Load plant_codes already present in the site_config_plant.csv seed."""
    if not SEED_CSV.exists():
        return set()
    codes: set[str] = set()
    with open(SEED_CSV, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            code = row.get("plant_code", "").strip()
            if code:
                codes.add(code)
    return codes


# -- Emitters -----------------------------------------------------------------

def _pb(v: bool) -> str:
    return "True" if v else "False"


def _ps(v: Any) -> str:
    return f'"{v}"'


def emit_csv_row(entry: dict) -> str:
    """Emit the CSV row to append to resources/config/site_config_plant.csv."""
    def fmt(v: Any) -> str:
        if isinstance(v, bool):
            return "true" if v else "false"
        return str(v)
    return ",".join(fmt(entry[c]) for c in CSV_COLUMNS)


def emit_python_snippet(entry: dict) -> str:
    """Emit the Python Row() for the reference.py fallback seed.

    Format mirrors the existing entries in site_config_plant() in reference.py.
    """
    pc = entry["plant_code"]
    pn = entry["plant_name"]
    return (
        f"        # {pc} {pn}: added via onboard_plant.py\n"
        f"        Row(plant_code={_ps(pc)}, plant_name={_ps(pn)}, "
        f"country={_ps(entry['country'])}, region={_ps(entry['region'])},\n"
        f"            business_unit={_ps(entry['business_unit'])}, "
        f"timezone={_ps(entry['timezone'])}, sap_system_id={_ps(entry['sap_system_id'])},\n"
        f"            go_live_status={_ps(entry['go_live_status'])}, "
        f"wm_enabled_flag={_pb(entry['wm_enabled_flag'])}, "
        f"hu_enabled_flag={_pb(entry['hu_enabled_flag'])},\n"
        f"            qm_enabled_flag={_pb(entry['qm_enabled_flag'])},\n"
        f"            spc_enabled_flag={_pb(entry['spc_enabled_flag'])},  "
        "# SPC tier flag -- default true for onboarded plants\n"
        f"            lifecycle_status={_ps(entry['lifecycle_status'])},  "
        "# ADR 016: onboarded plants are ACTIVE by definition\n"
        f"            batch_managed_flag={_pb(entry['batch_managed_flag'])}, "
        f"process_manufacturing_flag={_pb(entry['process_manufacturing_flag'])},\n"
        f"            default_language_code={_ps(entry['default_language_code'])}, "
        f"valid_from={_ps(str(entry['valid_from']))}, "
        f"valid_to={_ps(str(entry['valid_to']))},\n"
        f"            is_active={_pb(entry['is_active'])}, "
        f"config_owner={_ps(entry['config_owner'])}, "
        f"last_validated_at={_ps(str(entry['last_validated_at']))}),\n"
    )


def emit_live_validation_checklist(entry: dict) -> str:
    """Return the LIVE-VALIDATION CHECKLIST as a text string (SQL probes only -- not executed)."""
    pc = entry["plant_code"]
    pn = entry.get("plant_name", "")
    wm = entry.get("wm_enabled_flag", False)
    qm = entry.get("qm_enabled_flag", False)

    wm_probes = (
        f"\n-- 6. WM Transfer Orders in LTAP (wm_enabled_flag = true)\n"
        f"SELECT COUNT(*) AS to_count\n"
        f"FROM <catalog>.sap.transferorderitem_ltap\n"
        f"WHERE TRIM(WERKS) = '{pc}';\n"
        f"-- Expected: > 0 rows confirming WM data is replicated.\n"
        f"\n-- 7. WM Transfer Requirements in LTBK (wm_enabled_flag = true)\n"
        f"SELECT COUNT(*) AS tr_count\n"
        f"FROM <catalog>.sap.transferrequirementhead_ltbk\n"
        f"WHERE TRIM(WERKS) = '{pc}';\n"
        f"-- Expected: > 0 rows.\n"
    ) if wm else "-- 6-7. wm_enabled_flag = false; skip LTAP/LTBK checks.\n"

    qm_probes = (
        f"\n-- 8. QM inspection lots in QALS (qm_enabled_flag = true)\n"
        f"SELECT COUNT(*) AS lot_count\n"
        f"FROM <catalog>.sap.qualityinspectionlot_qals\n"
        f"WHERE TRIM(WERKS) = '{pc}';\n"
        f"-- Expected: > 0 rows for a QM-enabled plant.\n"
        f"\n-- 9. QM usage decisions in QAVE (qm_enabled_flag = true)\n"
        f"-- Note: QAVE.VWERKS = 'R001' (central plant) -- gate via QALS.WERKS, not QAVE.VWERKS.\n"
        f"SELECT COUNT(*) AS ud_count\n"
        f"FROM <catalog>.sap.qualityusagedecision_qave q\n"
        f"JOIN <catalog>.sap.qualityinspectionlot_qals l\n"
        f"  ON TRIM(q.PRUEFLOS) = TRIM(l.PRUEFLOS)\n"
        f"WHERE TRIM(l.WERKS) = '{pc}';\n"
        f"-- Expected: a fraction of lot_count (not all lots have a usage decision).\n"
    ) if qm else "-- 8-9. qm_enabled_flag = false; skip QALS/QAVE checks.\n"

    silver_wm = (
        f"  , (SELECT COUNT(*) FROM <catalog>.silver.transfer_order      WHERE plant_code = '{pc}') AS transfer_orders\n"
        f"  , (SELECT COUNT(*) FROM <catalog>.silver.transfer_requirement WHERE plant_code = '{pc}') AS transfer_requirements\n"
    ) if wm else "  -- wm_enabled_flag = false; skip transfer_order/requirement counts\n"

    silver_qm = (
        f"  , (SELECT COUNT(*) FROM <catalog>.silver.quality_inspection_lot WHERE plant_code = '{pc}') AS qm_lots\n"
    ) if qm else "  -- qm_enabled_flag = false; skip quality_inspection_lot count\n"

    sep = "=" * 72
    return (
        f"\n{sep}\n"
        f"LIVE-VALIDATION CHECKLIST -- {pc} {pn}\n"
        f"Run in Databricks BEFORE the go-live pipeline run.\n"
        f"Substitute <catalog> (e.g. connected_plant_uat) and <env> (e.g. uat).\n"
        f"Do NOT run via this script -- requires a live SQL warehouse.\n"
        f"{sep}\n"
        f"\n-- 1. Plant exists in SAP T001W (plant master)\n"
        f"SELECT WERKS, BWKEY, LAND1, ORT01\n"
        f"FROM published_<env>.central_services.plantmasterdata_t001w\n"
        f"WHERE TRIM(WERKS) = '{pc}';\n"
        f"-- Expected: exactly 1 row. Zero rows = plant not replicated; stop here.\n"
        f"\n-- 2. Warehouse number in T320 (plant <-> warehouse mapping)\n"
        f"SELECT WERKS, LGORT, LGNUM\n"
        f"FROM published_<env>.central_services.warehouseforplant_t320\n"
        f"WHERE TRIM(WERKS) = '{pc}'\n"
        f"ORDER BY LGNUM;\n"
        f"-- Expected: >= 1 row. Note the LGNUM value(s) for site_config_warehouse.csv.\n"
        f"-- T320 is authoritative; do NOT guess (C061->104, P817->208,\n"
        f"-- P806->190, C351->105 are the verified precedents; new plants may differ).\n"
        f"\n-- 3. Warehouse number exists in T300 (warehouse master)\n"
        f"SELECT LGNUM, REGKZ\n"
        f"FROM published_<env>.central_services.warehousemaster_t300\n"
        f"WHERE LGNUM IN (<lgnum_from_step_2>);\n"
        f"-- Expected: 1 row per LGNUM.\n"
        f"\n-- 4. SAP rows in AUFK (process orders)\n"
        f"SELECT COUNT(*) AS order_count\n"
        f"FROM <catalog>.sap.processorderheader_aufk\n"
        f"WHERE TRIM(WERKS) = '{pc}'\n"
        f"  AND AUTYP = '40';  -- PP/PI only; AUTYP='10' returns zero in Kerry config\n"
        f"-- Expected: > 0 rows. Zero may be valid pre-production; confirm with plant team.\n"
        f"\n-- 5. Batch/stock rows in MCHB\n"
        f"SELECT COUNT(*) AS stock_count\n"
        f"FROM <catalog>.sap.batchstock_mchb\n"
        f"WHERE TRIM(WERKS) = '{pc}';\n"
        f"-- Expected: > 0 rows for an active manufacturing plant.\n"
        f"{wm_probes}"
        f"{qm_probes}"
        f"\n-- 10. Stage-gate includes the plant (run AFTER slow reference pipeline)\n"
        f"SELECT plant_code, go_live_status, wm_enabled_flag, qm_enabled_flag,\n"
        f"       spc_enabled_flag, is_active\n"
        f"FROM <catalog>.silver.site_config_plant\n"
        f"WHERE plant_code = '{pc}';\n"
        f"-- Expected: 1 row with is_active = true.\n"
        f"\n-- 11. Row counts in key silver tables (run AFTER fast + slow pipelines)\n"
        f"SELECT '{pc}' AS plant_code,\n"
        f"  (SELECT COUNT(*) FROM <catalog>.silver.process_order WHERE plant_code = '{pc}') AS process_orders,\n"
        f"  (SELECT COUNT(*) FROM <catalog>.silver.batch_stock   WHERE plant_code = '{pc}') AS batch_stock_rows\n"
        f"{silver_wm}"
        f"{silver_qm}"
        f";\n"
        f"-- Expected: > 0 for each enabled area. Zero = gate or replication issue.\n"
        f"\n{sep}\n"
        f"END OF LIVE-VALIDATION CHECKLIST\n"
        f"Post-checklist: run fast/quality/gold pipelines -> smoke test the app.\n"
        f"See docs/runbooks/plant-onboarding.md for the full end-to-end sequence.\n"
        f"{sep}\n"
    )


# -- Main ---------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate a plant-config YAML and emit onboarding outputs.",
    )
    parser.add_argument(
        "config_file",
        help="Path to YAML file containing a list of plant-config entries.",
    )
    parser.add_argument(
        "--skip-duplicate-check",
        action="store_true",
        help=(
            "Skip checking against the existing site_config_plant.csv seed. "
            "Use only when amending an already-seeded entry."
        ),
    )
    args = parser.parse_args(argv)

    config_path = Path(args.config_file)
    if not config_path.exists():
        print(f"ERROR: Config file not found: {config_path}", file=sys.stderr)
        return 1

    with open(config_path, encoding="utf-8") as fh:
        raw = yaml.safe_load(fh)

    if not isinstance(raw, list):
        print(
            "ERROR: Config file must contain a YAML list (lines starting with '- ').",
            file=sys.stderr,
        )
        return 1
    if not raw:
        print("ERROR: Config file contains no entries.", file=sys.stderr)
        return 1

    existing_in_csv = set() if args.skip_duplicate_check else load_existing_plant_codes()

    all_errors: list[str] = []
    seen_in_file: set[str] = set()

    for i, entry in enumerate(raw, start=1):
        if not isinstance(entry, dict):
            all_errors.append(
                f"Entry {i}: expected a YAML mapping, got {type(entry).__name__}."
            )
            continue
        errors = validate_entry(entry, seen_in_file)
        pc = entry.get("plant_code")
        if pc and pc in existing_in_csv:
            errors.append(
                f"[{pc}] plant_code already exists in resources/config/site_config_plant.csv. "
                "Use --skip-duplicate-check if amending an existing entry."
            )
        all_errors.extend(errors)
        if pc:
            seen_in_file.add(pc)

    if all_errors:
        print("\nVALIDATION FAILED -- fix the following before editing the seed:\n")
        for e in all_errors:
            print(f"  FAIL: {e}")
        print(f"\n{len(all_errors)} error(s) found.")
        return 1

    print(f"\nVALIDATION PASSED -- {len(raw)} entry/entries are well-formed.\n")

    for entry in raw:
        pc = entry.get("plant_code", "?")
        pn = entry.get("plant_name", "")
        sep = "=" * 72
        print(f"\n{sep}")
        print(f"PLANT: {pc}  {pn}")
        print(sep)

        print(
            "\n-- Step 1: Append to resources/config/site_config_plant.csv\n"
            "(Append after the last data row; do not add a new header)\n"
        )
        print(emit_csv_row(entry))

        print(
            "\n-- Step 2: Add Row() to silver/tables/reference.py\n"
            "(Paste inside the data = [...] list in site_config_plant(), before the closing ])\n"
        )
        print(emit_python_snippet(entry))

        print(
            "-- Step 3: Regenerate governed SQL\n"
            "  python data-products/io-reporting/scripts/generate_readiness_config_sql.py\n"
            "  git add data-products/io-reporting/resources/sql/site_config_*.sql\n"
        )

        print(
            "-- Step 4: Run CI guard (must pass before committing)\n"
            "  python scripts/ci/check_site_config_plant_seed.py\n"
        )

        print(emit_live_validation_checklist(entry))

    return 0


if __name__ == "__main__":
    sys.exit(main())
