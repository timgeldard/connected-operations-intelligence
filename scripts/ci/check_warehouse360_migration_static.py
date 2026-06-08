#!/usr/bin/env python3
"""Warehouse360 Static Migration Checker.

Enforces offline-safety rules:
1. No 'gold_dev' references in Warehouse360 governed SQL.
2. No legacy 'wh360_' view names in governed SQL.
3. No 'connected_plant_uat.wh360' references.
4. Manifest source views start with 'vw_consumption_warehouse360_'.
5. Manifest source views (except placeholders) are defined in SQL files.
6. 'plant_id' appears in each active plant-facing consumption view definition.
7. UAT/PROD SQL does not grant to broad 'users' group.
8. DEV uses 'connected_plant_dev.gold_io_reporting'.
9. UAT uses 'connected_plant_uat.gold_io_reporting'.
10. PROD uses 'connected_plant_prod.gold_io_reporting'.
11. Every vw_consumption_warehouse360_* view exposes contract-required fields.
12. Plant-facing views expose plant_id.
13. Any known Gold source with plant_code is aliased as plant_id in the consumption view.
14. No route-covered consumption view is missing from the SQL.
"""
import os
import re
import sys

import yaml

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))

DEV_SQL_PATH = os.path.join(REPO_ROOT, "data-products/io-reporting/resources/sql/warehouse360_consumption_views_dev.sql")
UAT_SQL_PATH = os.path.join(REPO_ROOT, "data-products/io-reporting/resources/sql/warehouse360_consumption_views_uat.sql")
PROD_SQL_PATH = os.path.join(REPO_ROOT, "data-products/io-reporting/resources/sql/warehouse360_consumption_views_prod.sql")
MANIFEST_PATH = os.path.join(REPO_ROOT, "data-products/io-reporting/contracts/app_contract_manifest.yml")
EXPECTATIONS_PATH = os.path.join(REPO_ROOT, "data-products/io-reporting/contracts/warehouse360_view_expectations.yml")

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

GOLD_SOURCES_WITH_PLANT_CODE = {
    "gold_warehouse_kpi_snapshot_secured", "gold_warehouse_kpi_snapshot_live", "gold_warehouse_kpi_snapshot",
    "gold_inbound_po_backlog_enhanced_live", "gold_inbound_po_backlog_enhanced_secured", "gold_inbound_po_backlog_enhanced",
    "gold_delivery_pick_status_live", "gold_delivery_pick_status_secured", "gold_delivery_pick_status",
    "gold_process_order_staging_live", "gold_process_order_staging_secured", "gold_process_order_staging",
    "gold_stock_expiry_risk_live", "gold_stock_expiry_risk_secured", "gold_stock_expiry_risk",
    "gold_transfer_requirement_backlog",
    "gold_warehouse_exceptions"
}


def split_select_fields(select_text: str) -> list[str]:
    """Split SQL SELECT body by commas at the top-level (ignoring commas inside parentheses)."""
    fields = []
    current = []
    paren_depth = 0
    for char in select_text:
        if char == '(':
            paren_depth += 1
        elif char == ')':
            paren_depth -= 1

        if char == ',' and paren_depth == 0:
            fields.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    if current:
        fields.append("".join(current).strip())
    return [f for f in fields if f]


def parse_views_from_sql(sql_content: str) -> dict:
    """Parse all views, their SELECT fields, and their source tables/views from SQL content."""
    # Strip comments
    sql_content = re.sub(r'--.*$', '', sql_content, flags=re.MULTILINE)
    sql_content = re.sub(r'/\*.*?\*/', '', sql_content, flags=re.DOTALL)
    statements = sql_content.split(';')

    views = {}
    for stmt in statements:
        stmt = stmt.strip()
        if not stmt:
            continue
        match = re.search(r'CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(\w+)\s+AS\s+SELECT\s+(.*?)\s+FROM\s+([^\s;]+)', stmt, re.IGNORECASE | re.DOTALL)
        if match:
            view_name = match.group(1).strip()
            select_body = match.group(2).strip()
            source_table = match.group(3).strip()

            fields = split_select_fields(select_body)
            parsed_fields = {}
            for field in fields:
                field = field.strip()
                if not field:
                    continue
                parts = re.split(r'\s+[aA][sS]\s+', field)
                if len(parts) == 2:
                    expr, alias = parts[0].strip(), parts[1].strip()
                    alias = alias.strip('`')
                    parsed_fields[alias] = expr
                elif len(parts) == 1:
                    name = parts[0].strip().strip('`')
                    parsed_fields[name] = name
                else:
                    alias = parts[-1].strip().strip('`')
                    expr = " AS ".join(parts[:-1]).strip()
                    parsed_fields[alias] = expr
            views[view_name] = {
                "source": source_table,
                "fields": parsed_fields
            }
    return views


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

    # Load view expectations
    if not os.path.exists(EXPECTATIONS_PATH):
        errors.append(f"Expectations yml not found: {EXPECTATIONS_PATH}")
        return 1

    with open(EXPECTATIONS_PATH, "r", encoding="utf-8") as f:
        expectations = yaml.safe_load(f) or {}
    expected_views = expectations.get("views", [])

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
                    lines_with_view = [line for line in content.splitlines() if source_view in line and not line.strip().startswith("--")]
                    if not lines_with_view:
                        errors.append(f"[{env} SQL] View '{source_view}' for contract '{c_id}' appears to be commented out or missing definition")

    # 4. View expectations alignment checks
    for env, content in sql_contents.items():
        views = parse_views_from_sql(content)

        for exp in expected_views:
            view_name = exp["name"]
            is_route_covered = exp.get("runtime_route_exists", False)
            expected_cols = [c["name"] for c in exp.get("expected_columns", [])]
            is_plant_facing = "plant_id" in expected_cols

            # Skip dispensary_queue as it is not Wave 1 runtime-ready
            if view_name == "vw_consumption_warehouse360_dispensary_queue":
                continue

            # Check 4.1: no route-covered consumption view is missing from the SQL
            if view_name not in views:
                if is_route_covered:
                    errors.append(f"[{env} SQL] Missing route-covered view definition for '{view_name}'")
                continue

            view_data = views[view_name]
            parsed_fields = view_data["fields"]
            source_table = view_data["source"]
            simple_source_name = source_table.split(".")[-1].lower()

            # Check 4.2: every vw_consumption_warehouse360_* view exposes contract-required fields
            for col_name in expected_cols:
                if col_name not in parsed_fields:
                    errors.append(f"[{env} SQL] View '{view_name}' is missing contract-required field: '{col_name}'")

            # Check 4.3: plant-facing views expose plant_id
            if is_plant_facing and "plant_id" not in parsed_fields:
                errors.append(f"[{env} SQL] Plant-facing view '{view_name}' does not expose 'plant_id'")

            # Check 4.4: any known Gold source with plant_code is aliased as plant_id in the consumption view
            if simple_source_name in GOLD_SOURCES_WITH_PLANT_CODE:
                plant_id_expr = parsed_fields.get("plant_id")
                if plant_id_expr:
                    if plant_id_expr.lower() != "plant_code":
                        errors.append(
                            f"[{env} SQL] View '{view_name}' selects from Gold source '{source_table}' exposing 'plant_code' "
                            f"but aliases '{plant_id_expr}' as 'plant_id' instead of 'plant_code'"
                        )
                else:
                    errors.append(f"[{env} SQL] View '{view_name}' selects from Gold source '{source_table}' but is missing 'plant_id'")

    if errors:
        print("\nStatic validation failed with the following errors:")
        for err in errors:
            print(f" - {err}")
        return 1

    print("\nAll Warehouse360 Static Migration Checks passed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
