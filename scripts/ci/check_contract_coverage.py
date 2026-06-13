#!/usr/bin/env python3
"""Contract Coverage Check CI script.

Ensures that:
1. Every Warehouse360 governed route has a contract_id.
2. Every contract_id exists in the manifest.
3. Every Warehouse360 source_view starts with vw_consumption_warehouse360_.
4. No governed Warehouse360 route depends on wh360 object names.
"""
from __future__ import annotations

import os
import sys

import yaml

# Set environment variables for the import and run
os.environ["WAREHOUSE360_SOURCE_MODE"] = "governed_contracts"
os.environ["WH360_CATALOG"] = "dummy_catalog"
os.environ["WH360_SCHEMA"] = "dummy_schema"

# Adjust python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../apps/api")))

try:
    from adapters.warehouse360.warehouse360_databricks_adapter import (
        WarehouseBatchHoldStatusRequest,
        WarehouseExceptionRequest,
        WarehouseGoodsMovementsRequest,
        WarehouseInboundRequest,
        WarehouseMoveRequestsRequest,
        WarehouseOpenHoldsRequest,
        WarehouseOutboundRequest,
        WarehouseOverviewRequest,
        WarehousePickTasksRequest,
        WarehouseShortfallsRequest,
        WarehouseStagingReadinessRequest,
        WarehouseStagingRequest,
        WarehouseStockExceptionsRequest,
        WarehouseStockZonesRequest,
        get_warehouse_batch_hold_status_spec,
        get_warehouse_exceptions_spec,
        get_warehouse_goods_movements_spec,
        get_warehouse_inbound_spec,
        get_warehouse_move_requests_spec,
        get_warehouse_open_holds_spec,
        get_warehouse_outbound_spec,
        get_warehouse_overview_spec,
        get_warehouse_pick_tasks_spec,
        get_warehouse_shortfalls_spec,
        get_warehouse_staging_readiness_spec,
        get_warehouse_staging_spec,
        get_warehouse_stock_exceptions_spec,
        get_warehouse_stock_zones_spec,
    )
except ImportError as err:
    print(f"Error importing adapter: {err}")
    sys.exit(1)

MANIFEST_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "../../data-products/io-reporting/contracts/app_contract_manifest.yml"
    )
)

LEGACY_WH360_VIEWS = {
    "wh360_kpi_snapshot_v",
    "wh360_inbound_v",
    "wh360_deliveries_v",
    "wh360_process_orders_v",
    "imwm_exceptions_v",
    "imwm_stock_comparison_v",
    "wh360_dispensary_tasks_v",
    "wh360_transfer_requirements_v",
}


def run_contract_coverage() -> None:
    print("Running Contract Coverage CI Check...")

    # 1. Load the manifest
    if not os.path.exists(MANIFEST_PATH):
        print(f"Error: Manifest not found at {MANIFEST_PATH}")
        sys.exit(1)

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = yaml.safe_load(f) or {}

    contracts = manifest.get("contracts", []) or []
    manifest_contract_ids = {c.get("id"): c for c in contracts}

    # 2. Define our target functions and dummy requests
    specs_to_check = [
        ("overview", lambda: get_warehouse_overview_spec(WarehouseOverviewRequest("WH01"))),
        ("inbound", lambda: get_warehouse_inbound_spec(WarehouseInboundRequest("WH01"))),
        ("outbound", lambda: get_warehouse_outbound_spec(WarehouseOutboundRequest("WH01"))),
        ("staging", lambda: get_warehouse_staging_spec(WarehouseStagingRequest("WH01"))),
        ("exceptions", lambda: get_warehouse_exceptions_spec(WarehouseExceptionRequest("WH01"))),
        ("stock_exceptions", lambda: get_warehouse_stock_exceptions_spec(WarehouseStockExceptionsRequest("WH01"))),
        ("shortfalls", lambda: get_warehouse_shortfalls_spec(WarehouseShortfallsRequest("WH01"))),
        ("stock_zones", lambda: get_warehouse_stock_zones_spec(WarehouseStockZonesRequest("WH01"))),
        ("batch_hold_status", lambda: get_warehouse_batch_hold_status_spec(WarehouseBatchHoldStatusRequest("B001"))),
        ("staging_readiness", lambda: get_warehouse_staging_readiness_spec(WarehouseStagingReadinessRequest("P001", "2026-06-10"))),
        ("open_holds", lambda: get_warehouse_open_holds_spec(WarehouseOpenHoldsRequest())),
        ("pick_tasks", lambda: get_warehouse_pick_tasks_spec(WarehousePickTasksRequest())),
        ("move_requests", lambda: get_warehouse_move_requests_spec(WarehouseMoveRequestsRequest())),
        ("goods_movements", lambda: get_warehouse_goods_movements_spec(WarehouseGoodsMovementsRequest("2026-06-09", "2026-06-10"))),
    ]

    errors: list[str] = []

    for route_name, spec_factory in specs_to_check:
        try:
            spec = spec_factory()
        except Exception as exc:
            errors.append(f"Failed to generate spec for route '{route_name}': {exc}")
            continue

        c_id = spec.contract_id
        print(f"Checking route '{route_name}' -> contract_id: {c_id}")

        # Check 1: every Warehouse360 governed route has a contract_id
        if not c_id:
            errors.append(f"Route '{route_name}' is missing a contract_id in governed mode")
            continue

        # Check 2: every contract_id exists in the manifest
        if c_id not in manifest_contract_ids:
            errors.append(f"Route '{route_name}' contract_id '{c_id}' not found in manifest")
            continue

        contract = manifest_contract_ids[c_id]
        source_view = contract.get("source_view") or ""

        # Check 3: every Warehouse360 contract source_view starts with vw_consumption_warehouse360_
        if not source_view.startswith("vw_consumption_warehouse360_"):
            errors.append(
                f"Contract '{c_id}' source_view '{source_view}' must start with 'vw_consumption_warehouse360_'"
            )

        # Check 4: no governed Warehouse360 route depends on wh360 object names in SQL
        sql = spec.sql.lower()
        for legacy_view in LEGACY_WH360_VIEWS:
            if legacy_view in sql:
                errors.append(
                    f"Route '{route_name}' in governed mode directly references legacy wh360 view '{legacy_view}' in SQL"
                )

    if errors:
        print("\nContract Coverage Check FAILED:")
        for err in errors:
            print(f" - {err}")
        sys.exit(1)

    print("\n=== Contract Coverage Classification ===")
    coverage_map = {
        "warehouse360.overview": "route-covered",
        "warehouse360.inbound_backlog": "route-covered",
        "warehouse360.outbound_backlog": "route-covered",
        "warehouse360.staging_workload": "route-covered",
        "warehouse360.im_wm_reconciliation": "route-covered",
        "warehouse360.stock_exceptions": "route-covered",
        "warehouse360.shortfalls": "route-covered",
        "warehouse360.stock_zones": "route-covered",
        "warehouse360.batch_hold_status": "route-covered",
        "warehouse360.open_holds": "route-covered",
        "warehouse360.pick_tasks": "route-covered",
        "warehouse360.move_requests": "route-covered",
        "warehouse360.goods_movements": "route-covered",
        "warehouse360.staging_readiness": "route-covered",
        "warehouse360.dispensary_queue": "placeholder / not runtime-ready",
    }
    for c_id, status in coverage_map.items():
        print(f" - {c_id}: {status}")

    print("\nContract Coverage Check PASSED successfully!")
    sys.exit(0)


if __name__ == "__main__":
    run_contract_coverage()
