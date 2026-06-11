#!/usr/bin/env python3
"""Validate Warehouse360 governed adapter columns against the contract manifest.

This is an offline guardrail. It does not connect to Databricks and does not
claim that DEV validation has passed.
"""
from __future__ import annotations

import os
import sys

import yaml

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))
MANIFEST_PATH = os.path.join(
    REPO_ROOT,
    "data-products/io-reporting/contracts/app_contract_manifest.yml",
)

ACTIVE_ROUTE_COLUMNS: dict[str, set[str]] = {
    "warehouse360.overview": {
        "orders_total",
        "orders_red",
        "orders_amber",
        "trs_open",
        "tos_open",
        "deliveries_today",
        "deliveries_at_risk",
        "inbound_open",
        "bins_blocked",
        "bins_total",
        "bin_util_pct",
    },
    "warehouse360.inbound_backlog": {
        "po_id",
        "po_item",
        "doc_type",
        "vendor_id",
        "plant_id",
        "storage_loc",
        "material_id",
        "material_name",
        "ordered_qty",
        "uom",
        "po_date",
        "oldest_po_age_days",
        "inbound_backlog_risk_band",
    },
    "warehouse360.outbound_backlog": {
        "delivery_id",
        "delivery_type",
        "plant_id",
        "customer_id",
        "customer_name",
        "planned_gi_date",
        "actual_gi_date",
        "delivery_date",
        "gross_weight",
        "pick_pct",
        "line_count",
        "risk",
        "shipped",
    },
    "warehouse360.staging_workload": {
        "order_id",
        "material_id",
        "material_name",
        "plant_id",
        "uom",
        "order_qty",
        "sched_start",
        "sched_finish",
        "staging_pct",
        "to_items_total",
        "to_items_done",
        "mins_to_start",
        "risk",
    },
    "warehouse360.im_wm_reconciliation": {
        "exception_type",
        "severity",
        "material_id",
        "plant_id",
        "qty",
        "batch_id",
        "detail_text",
    },
}


def load_contract_fields() -> dict[str, set[str]]:
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = yaml.safe_load(f) or {}
    contracts = manifest.get("contracts", []) or []
    return {
        contract["id"]: {field["name"] for field in contract.get("fields", [])}
        for contract in contracts
    }


def run_checks() -> int:
    print("Running Warehouse360 adapter contract-column check...")
    contract_fields = load_contract_fields()
    errors: list[str] = []

    for contract_id, adapter_columns in ACTIVE_ROUTE_COLUMNS.items():
        fields = contract_fields.get(contract_id)
        if fields is None:
            errors.append(f"[{contract_id}] missing contract in manifest")
            continue
        missing = sorted(adapter_columns - fields)
        if missing:
            errors.append(
                f"[{contract_id}] adapter selects columns missing from manifest: {', '.join(missing)}"
            )

    if "warehouse360.dispensary_queue" in ACTIVE_ROUTE_COLUMNS:
        errors.append("dispensary_queue must remain out of active route column validation")

    if errors:
        print("\nWarehouse360 adapter contract-column check failed:")
        for error in errors:
            print(f" - {error}")
        return 1

    print("\nWarehouse360 adapter contract-column check passed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
