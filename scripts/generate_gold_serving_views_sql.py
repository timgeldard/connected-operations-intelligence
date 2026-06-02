#!/usr/bin/env python3
"""
Generate environment-specific Gold "live" serving-view SQL for Unity Catalog.

Phase 2 of the hardening plan (docs/hardening-plan.md): the Gold materialized views are kept
deterministic (absolute dates only, no current_date()) so they remain incrementally refreshable.
The date-relative columns (risk bands, days-to-X, expiry buckets) are computed **at query time** by
thin `<table>_live` serving views over the MV — zero MV-refresh cost. Same generated-SQL,
run-once-post-deploy pattern as the secured views (ADR 012), and composable with them.

The band/bucket SQL lives ONLY here (single source of truth) and is exercised by
tests/test_gold_serving_views.py against local Spark, so the view logic stays tested.

Outputs resources/sql/gold_serving_views_<env>.sql for dev / uat / prod.
"""
import os

ENVIRONMENTS = {
    "dev": {"catalog": "connected_plant_dev", "gold_schema": "gold_dev",
            "consumer_group": "users", "filename": "resources/sql/gold_serving_views_dev.sql"},
    "uat": {"catalog": "connected_plant_uat", "gold_schema": "gold",
            "consumer_group": "users", "filename": "resources/sql/gold_serving_views_uat.sql"},
    "prod": {"catalog": "connected_plant_prod", "gold_schema": "gold",
             "consumer_group": "users", "filename": "resources/sql/gold_serving_views_prod.sql"},
}

# Reusable SQL fragments (b = the base MV row).
_DAYS_TO_GI = "datediff(b.planned_goods_issue_date, current_date())"
_DAYS_TO_START = "datediff(b.scheduled_start_date, current_date())"
_DAYS_TO_EXPIRY = "datediff(b.minimum_expiry_date, current_date())"

# table -> [(output_column, sql_expression_over_base_alias_b)]. Mirrors the pre-Phase-2 test-mode
# logic exactly so behaviour is unchanged — only the location moves (MV -> serving view).
SERVING_VIEWS = {
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
    "gold_process_order_staging": [
        ("days_to_start", _DAYS_TO_START),
        ("risk_band",
         "CASE "
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
}


def serving_select_sql(table: str, base_relation: str) -> str:
    """Return `SELECT b.*, <expr> AS <col>, ... FROM <base_relation> AS b` for a serving view.
    Used by both the DDL generator and the unit tests (single source of truth)."""
    cols = ",\n  ".join(f"{expr} AS {alias}" for alias, expr in SERVING_VIEWS[table])
    return f"SELECT\n  b.*,\n  {cols}\nFROM {base_relation} AS b"


def generate_sql():
    os.makedirs("resources/sql", exist_ok=True)
    for env, cfg in ENVIRONMENTS.items():
        gold = f"{cfg['catalog']}.{cfg['gold_schema']}"
        group = cfg["consumer_group"]
        sql = (
            f"-- Unity Catalog Gold 'live' serving views ({env.upper()}).\n"
            "-- Run once as a UC admin after the first deploy. Re-runnable (CREATE OR REPLACE).\n"
            "-- These compute date-relative columns (current_date()) at query time so the base MVs\n"
            "-- stay deterministic / incrementally refreshable (hardening plan Phase 2).\n"
            "-- WARNING: Generated by scripts/generate_gold_serving_views_sql.py. Do not edit by hand.\n"
        )
        for table in SERVING_VIEWS:
            view = f"{gold}.{table}_live"
            body = serving_select_sql(table, f"{gold}.{table}")
            sql += f"\nCREATE OR REPLACE VIEW {view} AS\n{body};\n"
            sql += f"GRANT SELECT ON VIEW {view} TO `{group}`;\n"
        with open(cfg["filename"], "w", encoding="utf-8") as f:
            f.write(sql)
        print(f"Generated: {cfg['filename']}")


if __name__ == "__main__":
    generate_sql()
