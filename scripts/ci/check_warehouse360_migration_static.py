#!/usr/bin/env python3
"""Warehouse360 Static Migration Checker.

Enforces offline-safety rules:
1. No 'gold_dev' references in Warehouse360 governed SQL.
2. No legacy 'wh360_' view names in governed SQL.
3. No 'connected_plant_uat.wh360' references.
4. Manifest source views start with 'vw_consumption_warehouse360_'.
5. Manifest source views (except placeholders) are defined in SQL files.
6. 'plant_id' appears in each active consumption view definition.
7. UAT/PROD SQL does not grant to broad 'users' group.
8. DEV uses 'connected_plant_dev.gold_io_reporting'.
9. UAT uses 'connected_plant_uat.gold_io_reporting'.
10. PROD uses 'connected_plant_prod.gold_io_reporting'.
"""
import os
import sys
import yaml

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))

DEV_SQL_PATH = os.path.join(REPO_ROOT, "data-products/io-reporting/resources/sql/warehouse360_consumption_views_dev.sql")
UAT_SQL_PATH = os.path.join(REPO_ROOT, "data-products/io-reporting/resources/sql/warehouse360_consumption_views_uat.sql")
PROD_SQL_PATH = os.path.join(REPO_ROOT, "data-products/io-reporting/resources/sql/warehouse360_consumption_views_prod.sql")
MANIFEST_PATH = os.path.join(REPO_ROOT, "data-products/io-reporting/contracts/app_contract_manifest.yml")

LEGACY_VIEWS = {
    "wh360_kpi_snapshot_v",
    "wh360_inbound_v",
    "wh360_deliveries_v",
    "wh360_process_orders_v",
    "imwm_exceptions_v",
    "imwm_stock_comparison_v",
    "wh360_dispensary_tasks_v",
    "wh360_transfer_requirements_v",
}


def run_checks() -> int:
    print("Running Warehouse360 Static Migration Checks...")
    errors = []

    # 1. Load files
    sql_files = {
        "DEV": (DEV_SQL_PATH, "connected_plant_dev.gold_io_reporting"),
        "UAT": (UAT_SQL_PATH, "connected_plant_uat.gold_io_reporting"),
        "PROD": (PROD_SQL_PATH, "connected_plant_prod.gold_io_reporting"),
    }

    sql_contents = {}
    for env, (path, expected_schema) in sql_files.items():
        if not os.path.exists(path):
            errors.append(f"SQL file not found for {env}: {path}")
            continue
        with open(path, "r", encoding="utf-8") as f:
            sql_contents[env] = f.read()

    if not os.path.exists(MANIFEST_PATH):
        errors.append(f"Manifest not found: {MANIFEST_PATH}")
        return 1

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = yaml.safe_load(f) or {}

    contracts = manifest.get("contracts", []) or []
    wh360_contracts = [c for c in contracts if c.get("id", "").startswith("warehouse360.")]

    # 2. Check forbidden strings in SQL files
    for env, content in sql_contents.items():
        # Check 2.1: No gold_dev schema target or references
        if "gold_dev" in content:
            errors.append(f"[{env} SQL] Contains forbidden reference to 'gold_dev'")

        # Check 2.2: No legacy wh360 view names
        for lv in LEGACY_VIEWS:
            if lv in content:
                errors.append(f"[{env} SQL] Contains legacy view name '{lv}'")

        # Check 2.3: No connected_plant_uat.wh360 reference
        if "connected_plant_uat.wh360" in content:
            errors.append(f"[{env} SQL] Contains forbidden reference to 'connected_plant_uat.wh360'")

        # Check 2.4: Target schema alignment
        _, expected_schema = sql_files[env]
        if expected_schema not in content:
            errors.append(f"[{env} SQL] Missing expected schema target '{expected_schema}'")

        # Check 2.5: UAT/PROD must not grant to users group
        if env in {"UAT", "PROD"}:
            if "GRANT SELECT" in content and "users" in content:
                # Let's inspect if any line has an uncommented grant to users
                for line in content.splitlines():
                    if "GRANT SELECT" in line and not line.strip().startswith("--") and ("users" in line or "`users`" in line):
                        errors.append(f"[{env} SQL] Contains uncommented grant to broad 'users' group: {line.strip()}")

    # 3. Check manifest and view alignment
    for contract in wh360_contracts:
        c_id = contract.get("id")
        source_view = contract.get("source_view", "")

        # Check 3.1: source_view naming convention
        if not source_view.startswith("vw_consumption_warehouse360_"):
            errors.append(f"[Contract {c_id}] source_view '{source_view}' must start with 'vw_consumption_warehouse360_'")
            continue

        # Skip dispensary_queue from active deployment requirement (it is explicitly commented-out/placeholder)
        if c_id == "warehouse360.dispensary_queue":
            continue

        # Check 3.2: source_view defined in SQL files
        for env, content in sql_contents.items():
            create_stmt = f"CREATE OR REPLACE VIEW {source_view}"
            if create_stmt not in content:
                # Also check if it's there without the spacing
                if source_view not in content:
                    errors.append(f"[{env} SQL] Missing view definition for contract '{c_id}' (expected view: '{source_view}')")
                else:
                    # Double check if it's commented out
                    lines_with_view = [l for l in content.splitlines() if source_view in l and not l.strip().startswith("--")]
                    if not lines_with_view:
                        errors.append(f"[{env} SQL] View '{source_view}' for contract '{c_id}' appears to be commented out or missing definition")

            # Check 3.3: plant_id column presence in view
            # (Simple static check: verify plant_id is in the SELECT list)
            if source_view in content:
                # Extract the view select block roughly
                parts = content.split(source_view)
                if len(parts) > 1:
                    view_body = parts[1].split(";")[0] # get everything up to next semi-colon
                    if "plant_id" not in view_body and "plant_code" not in view_body:
                        errors.append(f"[{env} SQL] View '{source_view}' does not expose a plant identifier ('plant_id' or 'plant_code')")

    if errors:
        print("\nStatic validation failed with the following errors:")
        for err in errors:
            print(f" - {err}")
        return 1

    print("\nAll Warehouse360 Static Migration Checks passed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
