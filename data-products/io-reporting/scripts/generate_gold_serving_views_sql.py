#!/usr/bin/env python3
"""
Generate environment-specific Gold "live" serving-view SQL for Unity Catalog.

Phase 2 of the hardening plan (docs/hardening-plan.md): the Gold materialized views are kept
deterministic (absolute dates only, no current_date()) so they remain incrementally refreshable.
The date-relative columns (risk bands, days-to-X, expiry buckets) are computed **at query time** by
thin `<table>_live` serving views built on the matching `*_secured` view (ADR 012) — so they
inherit the plant row filter (querying `_live` does NOT bypass RLS) and add zero MV-refresh cost.
Run AFTER the secured-view SQL (same generated-SQL, run-once-post-deploy pattern).

The band/bucket SQL lives ONLY here (single source of truth) and is exercised by
tests/test_gold_serving_views.py against local Spark, so the view logic stays tested.

Outputs resources/sql/gold_serving_views_<env>.sql for dev / uat / prod.
"""
import os

# Resolve output paths relative to the repo root (this script lives in scripts/), so it runs the
# same regardless of the caller's working directory.
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ENVIRONMENTS = {
    "dev": {"catalog": "connected_plant_dev", "gold_schema": "gold_io_reporting", "consumer_group": "users",
            "filename": os.path.join(REPO_ROOT, "resources/sql/gold_serving_views_dev.sql")},
    "uat": {"catalog": "connected_plant_uat", "gold_schema": "gold_io_reporting", "consumer_group": "users",
            "filename": os.path.join(REPO_ROOT, "resources/sql/gold_serving_views_uat.sql")},
    "prod": {"catalog": "connected_plant_prod", "gold_schema": "gold_io_reporting", "consumer_group": "users",
             "filename": os.path.join(REPO_ROOT, "resources/sql/gold_serving_views_prod.sql")},
}

# Reusable SQL fragments (b = the base MV row).
_DAYS_TO_GI = "datediff(b.planned_goods_issue_date, current_date())"
_DAYS_TO_START = "datediff(b.scheduled_start_date, current_date())"
_DAYS_TO_EXPIRY = "datediff(b.minimum_expiry_date, current_date())"
_DAYS_SINCE_PO = "datediff(current_date(), b.earliest_po_date)"
_DAYS_SINCE_PO_LINE = "datediff(current_date(), b.po_date)"

# Age (days) of the warehouse-exception aging reference date, e.g. GR date or expiry date.
_EXCEPTION_AGE_DAYS = "datediff(current_date(), b.aging_reference_date)"
# Rolling age (hours) of the aging reference timestamp (transfer-order creation).
_EXCEPTION_AGE_HOURS = (
    "(unix_timestamp(current_timestamp()) - unix_timestamp(b.aging_reference_datetime)) / 3600.0"
)

# table -> serving-view spec. Either a plain list of (output_column, sql_expression_over_base_alias_b)
# pairs, or a dict {"columns": [...], "where": "<predicate over b>"} when the view must also FILTER
# the base candidates at query time (age-threshold exceptions). Mirrors the pre-Phase-2 test-mode
# logic exactly so behaviour is unchanged — only the location moves (MV -> serving view).
SERVING_VIEWS = {
    "gold_stock_holds": [
        ("age_hours",
         "CASE WHEN b.goods_receipt_date IS NOT NULL "
         "THEN (unix_timestamp(current_timestamp()) - unix_timestamp(b.goods_receipt_date)) / 3600.0 END"),
    ],
    "gold_transfer_order_open_items": [
        ("age_hours",
         "CASE WHEN b.created_datetime IS NOT NULL "
         "THEN (unix_timestamp(current_timestamp()) - unix_timestamp(b.created_datetime)) / 3600.0 END"),
    ],
    "gold_transfer_requirement_open_items": [
        ("age_hours",
         "CASE WHEN b.created_datetime IS NOT NULL "
         "THEN (unix_timestamp(current_timestamp()) - unix_timestamp(b.created_datetime)) / 3600.0 END"),
    ],
    "gold_lineside_stock": [
        ("min_days_to_expiry",
         "CASE WHEN b.earliest_expiry_date IS NOT NULL "
         "THEN datediff(b.earliest_expiry_date, current_date()) END"),
    ],
    "gold_delivery_pick_status": [
        ("days_to_goods_issue", _DAYS_TO_GI),
        ("risk_band",
         "CASE "
         "WHEN b.is_shipped THEN 'green' "
         f"WHEN {_DAYS_TO_GI} IS NULL THEN 'grey' "
         f"WHEN coalesce(b.pick_fraction, 0.0) < 0.5 AND {_DAYS_TO_GI} <= 0 THEN 'red' "
         f"WHEN coalesce(b.pick_fraction, 0.0) < 0.8 AND {_DAYS_TO_GI} <= 1 THEN 'amber' "
         "ELSE 'green' END"),
    ],
    # Inbound deliveries: days until expected receipt served live (base MV stays deterministic).
    # receipt_band mirrors the outbound risk_band logic: red = overdue + low progress,
    # amber = due within 1 day + not fully received, green otherwise / already received.
    "gold_wm_inbound_deliveries": [
        ("days_until_expected_receipt", "datediff(b.expected_receipt_date, current_date())"),
        ("receipt_band",
         "CASE "
         "WHEN b.is_received THEN 'green' "
         "WHEN b.expected_receipt_date IS NULL THEN 'grey' "
         "WHEN datediff(b.expected_receipt_date, current_date()) IS NULL THEN 'grey' "
         "WHEN coalesce(b.receipt_fraction, 0.0) < 0.5 AND datediff(b.expected_receipt_date, current_date()) <= 0 THEN 'red' "
         "WHEN coalesce(b.receipt_fraction, 0.0) < 0.8 AND datediff(b.expected_receipt_date, current_date()) <= 1 THEN 'amber' "
         "ELSE 'green' END"),
    ],
    "gold_process_order_staging": [
        ("days_to_start", _DAYS_TO_START),
        ("risk_band",
         "CASE "
         "WHEN NOT coalesce(b.is_operationally_trusted, false) THEN 'unvalidated' "
         "WHEN b.to_items_total = 0 THEN 'grey' "
         f"WHEN {_DAYS_TO_START} IS NULL THEN 'grey' "
         f"WHEN coalesce(b.staging_fraction, 0.0) < 0.3 AND {_DAYS_TO_START} <= 0 THEN 'red' "
         f"WHEN coalesce(b.staging_fraction, 0.0) < 0.7 AND {_DAYS_TO_START} <= 1 THEN 'amber' "
         "ELSE 'green' END"),
    ],
    "gold_stock_expiry_risk": [
        ("minimum_days_to_expiry", _DAYS_TO_EXPIRY),
        ("expired_qty",
         f"coalesce(CASE WHEN {_DAYS_TO_EXPIRY} < 0 THEN b.total_stock_qty END, 0.0)"),
        ("expiry_risk_lt_7d_qty",
         f"coalesce(CASE WHEN {_DAYS_TO_EXPIRY} >= 0 AND {_DAYS_TO_EXPIRY} < 7 "
         "THEN b.total_stock_qty END, 0.0)"),
        ("expiry_risk_7_30d_qty",
         f"coalesce(CASE WHEN {_DAYS_TO_EXPIRY} >= 7 AND {_DAYS_TO_EXPIRY} < 30 "
         "THEN b.total_stock_qty END, 0.0)"),
        ("expiry_risk_30_90d_qty",
         f"coalesce(CASE WHEN {_DAYS_TO_EXPIRY} >= 30 AND {_DAYS_TO_EXPIRY} < 90 "
         "THEN b.total_stock_qty END, 0.0)"),
        ("expiry_ok_qty",
         f"coalesce(CASE WHEN {_DAYS_TO_EXPIRY} >= 90 THEN b.total_stock_qty END, 0.0)"),
        ("minimum_shelf_life_breach_qty",
         f"coalesce(CASE WHEN {_DAYS_TO_EXPIRY} < coalesce(b.minimum_remaining_shelf_life_days, 0) "
         "THEN b.total_stock_qty END, 0.0)"),
        ("highest_expiry_risk_bucket",
         "CASE "
         "WHEN coalesce(b.total_stock_qty, 0.0) <= 0 THEN 'OK' "
         f"WHEN {_DAYS_TO_EXPIRY} < 0 THEN 'EXPIRED' "
         f"WHEN {_DAYS_TO_EXPIRY} < 7 THEN 'LT_7_DAYS' "
         f"WHEN {_DAYS_TO_EXPIRY} < 30 THEN 'DAYS_7_30' "
         f"WHEN {_DAYS_TO_EXPIRY} < 90 THEN 'DAYS_30_90' "
         "ELSE 'OK' END"),
        ("has_minimum_shelf_life_breach",
         f"coalesce(CASE WHEN {_DAYS_TO_EXPIRY} < coalesce(b.minimum_remaining_shelf_life_days, 0) "
         "THEN b.total_stock_qty END, 0.0) > 0"),
    ],
    "gold_inbound_po_backlog_enhanced": [
        ("oldest_po_age_days",
         f"CASE WHEN b.earliest_po_date IS NOT NULL THEN {_DAYS_SINCE_PO} END"),
        ("inbound_backlog_risk_band",
         "CASE "
         "WHEN b.remaining_open_qty <= 0 THEN 'green' "
         f"WHEN {_DAYS_SINCE_PO} IS NULL THEN 'grey' "
         f"WHEN {_DAYS_SINCE_PO} >= 30 THEN 'red' "
         f"WHEN {_DAYS_SINCE_PO} >= 14 THEN 'amber' "
         "ELSE 'green' END"),
    ],
    # PO-line backlog: age + risk band are per-line (date-relative on the line's PO date), so they live
    # in the _live serving view (base MV stays deterministic). No remaining_open_qty yet (GR qty is
    # future enrichment), so the band is age-only.
    "gold_inbound_po_line_backlog": [
        ("oldest_po_age_days",
         f"CASE WHEN b.po_date IS NOT NULL THEN {_DAYS_SINCE_PO_LINE} END"),
        ("inbound_backlog_risk_band",
         "CASE "
         f"WHEN {_DAYS_SINCE_PO_LINE} IS NULL THEN 'grey' "
         f"WHEN {_DAYS_SINCE_PO_LINE} >= 30 THEN 'red' "
         f"WHEN {_DAYS_SINCE_PO_LINE} >= 14 THEN 'amber' "
         "ELSE 'green' END"),
    ],
    # KPI snapshot: the base MV is deterministic (no snapshot_date); the query-time as-of marker
    # is added here so consumers (Warehouse360 overview) get it without wall-clock SQL of their own.
    "gold_warehouse_kpi_snapshot": [
        ("snapshot_date", "current_date()"),
    ],
    # WM Operations worklist: job age + overdue flag vs the TR planned execution datetime.
    "gold_wm_staging_worklist": [
        ("age_hours",
         "CASE WHEN b.created_datetime IS NOT NULL "
         "THEN (unix_timestamp(current_timestamp()) - unix_timestamp(b.created_datetime)) / 3600.0 END"),
        ("is_overdue",
         "b.planned_execution_datetime IS NOT NULL "
         "AND b.planned_execution_datetime < current_timestamp() "
         "AND b.worklist_status NOT IN ('COMPLETE')"),
    ],
    # WM Operations order readiness: days-to-start + cockpit-style traffic light. Red when the
    # order starts today-or-earlier without full PSA supply; amber when it starts within a day
    # and staging is not fully planned; grey when unscheduled or without WM demand.
    "gold_wm_order_readiness": [
        ("days_to_start", _DAYS_TO_START),
        ("readiness_band",
         "CASE "
         "WHEN b.readiness_status = 'NO_WM_DEMAND' THEN 'grey' "
         f"WHEN {_DAYS_TO_START} IS NULL THEN 'grey' "
         "WHEN b.supply_status = 'SUPPLIED' AND b.quality_release_status = 'QUALITY_BLOCKED' THEN 'amber' "
         "WHEN b.supply_status = 'SUPPLIED' THEN 'green' "
         f"WHEN b.readiness_status IN ('NOT_STARTED', 'PARTIALLY_PLANNED') AND {_DAYS_TO_START} <= 0 THEN 'red' "
         f"WHEN b.readiness_status <> 'SUPPLIED' AND {_DAYS_TO_START} <= 1 THEN 'amber' "
         "ELSE 'green' END"),
        ("readiness_reason",
         "CASE "
         "WHEN b.supply_status = 'SUPPLIED' AND b.quality_release_status = 'QUALITY_BLOCKED' THEN 'QUALITY_HOLD' "
         "WHEN b.quality_release_status = 'PARTIAL_HOLD' THEN 'QUALITY_PARTIAL_HOLD' "
         "WHEN b.quality_release_status = 'NO_QM_DATA' THEN 'QM_SOURCE_ABSENT' "
         "ELSE NULL END"),
    ],
    # WM Operations bin/stock explorer: expiry age served live (base MV stays deterministic).
    "gold_wm_bin_stock_detail": [
        ("days_to_expiry",
         "CASE WHEN b.expiry_date IS NOT NULL THEN datediff(b.expiry_date, current_date()) END"),
        ("is_expired",
         "b.expiry_date IS NOT NULL AND b.expiry_date < current_date()"),
    ],
    # WM slow movers: stock age served live so the base MV stays deterministic.
    "gold_wm_slow_movers": [
        ("days_since_last_movement",
         "CASE WHEN b.last_movement_datetime IS NOT NULL "
         "THEN datediff(current_date(), CAST(b.last_movement_datetime AS DATE)) END"),
        ("age_bucket",
         "CASE "
         "WHEN b.last_movement_datetime IS NULL THEN 'NO_MOVEMENT_RECORD' "
         "WHEN datediff(current_date(), CAST(b.last_movement_datetime AS DATE)) >= 365 THEN 'OVER_365D' "
         "WHEN datediff(current_date(), CAST(b.last_movement_datetime AS DATE)) >= 180 THEN 'D180_365' "
         "WHEN datediff(current_date(), CAST(b.last_movement_datetime AS DATE)) >= 90 THEN 'D90_180' "
         "ELSE 'ACTIVE' END"),
    ],
    # QM lot status (all lots): date-relative columns at query time so the base MV stays deterministic.
    # is_overdue: no UD AND current_date > inspection_end_date (planned end).
    "gold_wm_qm_lot_status": [
        ("lot_age_days",
         "CASE WHEN b.lot_created_date IS NOT NULL "
         "THEN datediff(current_date(), b.lot_created_date) END"),
        ("ud_lead_time_days",
         "CASE WHEN b.last_usage_decision_date IS NOT NULL AND b.lot_created_date IS NOT NULL "
         "THEN datediff(b.last_usage_decision_date, b.lot_created_date) END"),
        ("is_overdue",
         "NOT coalesce(b.has_usage_decision, false) "
         "AND b.inspection_end_date IS NOT NULL "
         "AND b.inspection_end_date < current_date()"),
    ],
    # QM disposition queue (open lots only): same date-relative columns.
    "gold_wm_qm_disposition_queue": [
        ("lot_age_days",
         "CASE WHEN b.lot_created_date IS NOT NULL "
         "THEN datediff(current_date(), b.lot_created_date) END"),
        ("is_overdue",
         "b.inspection_end_date IS NOT NULL "
         "AND b.inspection_end_date < current_date()"),
    ],
    # Warehouse exceptions: the base MV stores ALL aging candidates with their reference date
    # (deterministic, incrementally refreshable); the per-type age thresholds, age_days and
    # detected_date are evaluated here at query time. Consumers must read _live, not _secured —
    # _secured rows are candidates, not confirmed exceptions.
    "gold_warehouse_exceptions": {
        "columns": [
            ("age_days", f"CAST({_EXCEPTION_AGE_DAYS} AS INT)"),
            ("detected_date", "current_date()"),
        ],
        "where": (
            "CASE b.exception_type "
            "WHEN 'EXPIRED_BATCH_WITH_STOCK' THEN b.aging_reference_date < current_date() "
            f"WHEN 'QI_STOCK_AGED_14D' THEN {_EXCEPTION_AGE_DAYS} > 14 "
            f"WHEN 'BLOCKED_STOCK_AGED_3D' THEN {_EXCEPTION_AGE_DAYS} > 3 "
            f"WHEN 'OPEN_TO_AGED_24H' THEN {_EXCEPTION_AGE_HOURS} > 24 "
            "ELSE TRUE END"
        ),
    },
}


def _spec(table: str) -> dict:
    """Normalise a SERVING_VIEWS entry to {"columns": [...], "where": str | None}."""
    entry = SERVING_VIEWS[table]
    if isinstance(entry, dict):
        return {"columns": entry["columns"], "where": entry.get("where")}
    return {"columns": entry, "where": None}


def serving_select_sql(table: str, base_relation: str) -> str:
    """Return `SELECT b.*, <expr> AS <col>, ... FROM <base_relation> AS b [WHERE ...]` for a
    serving view. Used by both the DDL generator and the unit tests (single source of truth)."""
    spec = _spec(table)
    cols = ",\n  ".join(f"{expr} AS {alias}" for alias, expr in spec["columns"])
    sql = f"SELECT\n  b.*,\n  {cols}\nFROM {base_relation} AS b"
    if spec["where"]:
        sql += f"\nWHERE {spec['where']}"
    return sql


def generate_sql():
    os.makedirs(os.path.join(REPO_ROOT, "resources/sql"), exist_ok=True)
    for env, cfg in ENVIRONMENTS.items():
        gold = f"{cfg['catalog']}.{cfg['gold_schema']}"
        group = cfg["consumer_group"]
        sql = (
            f"-- Unity Catalog Gold 'live' serving views ({env.upper()}).\n"
            "-- Run once as a UC admin AFTER the secured-view SQL (gold_security_<env>.sql): each\n"
            "-- _live view is built ON the matching *_secured view, so it inherits the plant row\n"
            "-- filter (querying _live does NOT bypass RLS). Re-runnable (CREATE OR REPLACE).\n"
            "-- These compute date-relative columns (current_date()) at query time so the base MVs\n"
            "-- stay deterministic / incrementally refreshable (hardening plan Phase 2 / ADR 012).\n"
            "-- WARNING: Generated by scripts/generate_gold_serving_views_sql.py. Do not edit by hand.\n"
        )
        for table in SERVING_VIEWS:
            view = f"{gold}.{table}_live"
            # Build on the secured view (not the raw MV) so the plant filter is inherited.
            body = serving_select_sql(table, f"{gold}.{table}_secured")
            sql += f"\nCREATE OR REPLACE VIEW {view} AS\n{body};\n"
            sql += f"GRANT SELECT ON VIEW {view} TO `{group}`;\n"
        with open(cfg["filename"], "w", encoding="utf-8", newline="\n") as f:
            f.write(sql)
        print(f"Generated: {cfg['filename']}")


if __name__ == "__main__":
    generate_sql()
