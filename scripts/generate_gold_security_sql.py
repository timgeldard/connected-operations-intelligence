#!/usr/bin/env python3
"""
Generate environment-specific Gold row-level-security SQL for Unity Catalog.

The Gold materialized views are a "trusted" aggregate layer and are deliberately NOT
row-filtered directly, because applying a UC row filter to a materialized view forces
full refreshes (see ADR 005 / ADR 012). Instead we expose a **secured serving view**
per plant-scoped Gold table that applies the same `plant_access_filter` function used on
Silver. Consumers (the `users` group) are granted SELECT on the `*_secured` views; direct
SELECT on the base Gold tables is reserved for the data-product owner / admins.

(Snapshot companion tables are physical Delta tables, so they get a real row filter applied
in-job by gold/snapshots/warehouse_snapshot.py — they are not covered here.)

Outputs SQL scripts to resources/sql/ for dev, uat and prod. Run once per env as a UC
admin after the first deploy (re-runnable; views are CREATE OR REPLACE).
"""
import os

ENVIRONMENTS = {
    "dev": {
        "catalog": "connected_plant_dev",
        "gold_schema": "gold_dev",
        "silver_schema": "silver_dev",
        "consumer_group": "users",
        "filename": "resources/sql/gold_security_dev.sql",
    },
    "uat": {
        "catalog": "connected_plant_uat",
        "gold_schema": "gold",
        "silver_schema": "silver",
        "consumer_group": "users",
        "filename": "resources/sql/gold_security_uat.sql",
    },
    "prod": {
        "catalog": "connected_plant_prod",
        "gold_schema": "gold",
        "silver_schema": "silver",
        "consumer_group": "users",
        "filename": "resources/sql/gold_security_prod.sql",
    },
}

# Every plant-scoped Gold materialized view (all carry a plant_code column). Keep in sync
# with the gold/*.py table definitions.
GOLD_TABLES = [
    # warehouse_kpis.py
    "gold_transfer_order_performance",
    "gold_inbound_outbound_throughput",
    "gold_bin_occupancy",
    "gold_stock_availability",
    "gold_transfer_requirement_backlog",
    "gold_stock_expiry_risk",
    # dlt_gold_pipeline.py
    "gold_shift_output_summary",
    "gold_order_otif_metrics",
    "gold_plant_production_quality_summary",
    # warehouse_flow_gold.py
    "gold_dispensary_backlog",
    "gold_lineside_stock",
    "gold_delivery_pick_status",
    "gold_stock_reconciliation",
    "gold_process_order_staging",
    "gold_process_order_staging_validation",
    # warehouse_inbound_gold.py
    "gold_inbound_po_backlog",
    "gold_handling_unit_summary",
    # warehouse_exceptions.py
    "gold_warehouse_exceptions",
    # warehouse_kpi_snapshot.py
    "gold_warehouse_kpi_snapshot",
]

TEMPLATE = """-- Unity Catalog Gold row-level security — secured serving views ({env_upper}).
-- Run once as a Unity Catalog admin after the first {env_lower} deploy. Re-runnable.
-- Requires: the plant_access_filter function (created by resources/sql/row_filter_{env_lower}.sql)
--           and CREATE VIEW on {catalog}.{gold_schema}.
-- WARNING: Generated automatically by scripts/generate_gold_security_sql.py. Do not edit manually.
--
-- Model: Gold MVs stay trusted (not row-filtered, to avoid full MV refreshes). Each plant-scoped
-- Gold table gets a <table>_secured view applying plant_access_filter(plant_code); the consumer
-- group is granted SELECT on the views only. plant_access_filter reads the *invoking* user's
-- 'allowed_plants' attribute (definer-rights view, session-scoped function), so per-plant
-- trimming is enforced at query time, and silver_admin members see all rows.
"""

REVOKE_NOTE = """
-- ── Base-table access hardening ──
-- The actual REVOKE statements are generated as a SEPARATE admin script
-- (resources/sql/gold_security_harden_{env_lower}.sql). Apply it AFTER this script so plant-scoped users
-- can only read the row-filtered *_secured views, not the un-trimmed base Gold tables (ADR 012).
-- It is kept separate because revoking broad access is operationally sensitive and irreversible-ish.
"""


CUSTOM_SELECTS = {
    "gold_stock_expiry_risk": """  SELECT
    plant_code,
    material_code,
    material_description,
    batch_number,
    base_uom,
    minimum_expiry_date,
    earliest_goods_receipt_date,
    datediff(minimum_expiry_date, current_date()) AS minimum_days_to_expiry,
    shelf_life_days,
    minimum_remaining_shelf_life_days,
    total_stock_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) < 0 THEN total_stock_qty END,
      0.0
    ) AS expired_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) >= 0 AND datediff(minimum_expiry_date, current_date()) < 7 THEN total_stock_qty END,
      0.0
    ) AS expiry_risk_lt_7d_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) >= 7 AND datediff(minimum_expiry_date, current_date()) < 30 THEN total_stock_qty END,
      0.0
    ) AS expiry_risk_7_30d_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) >= 30 AND datediff(minimum_expiry_date, current_date()) < 90 THEN total_stock_qty END,
      0.0
    ) AS expiry_risk_30_90d_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) >= 90 THEN total_stock_qty END,
      0.0
    ) AS expiry_ok_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) < coalesce(minimum_remaining_shelf_life_days, 0) THEN total_stock_qty END,
      0.0
    ) AS minimum_shelf_life_breach_qty,
    CASE
      WHEN datediff(minimum_expiry_date, current_date()) < 0 THEN 'EXPIRED'
      WHEN datediff(minimum_expiry_date, current_date()) < 7 THEN 'LT_7_DAYS'
      WHEN datediff(minimum_expiry_date, current_date()) < 30 THEN 'DAYS_7_30'
      WHEN datediff(minimum_expiry_date, current_date()) < 90 THEN 'DAYS_30_90'
      ELSE 'OK'
    END AS highest_expiry_risk_bucket,
    coalesce(datediff(minimum_expiry_date, current_date()) < coalesce(minimum_remaining_shelf_life_days, 0), false) AS has_minimum_shelf_life_breach
  FROM {base}""",

    "gold_lineside_stock": """  SELECT
    *,
    CASE WHEN earliest_expiry_date IS NOT NULL THEN datediff(earliest_expiry_date, current_date()) END AS min_days_to_expiry
  FROM {base}""",

    "gold_delivery_pick_status": """  SELECT
    delivery_number,
    plant_code,
    warehouse_number,
    delivery_type,
    sold_to_customer,
    planned_goods_issue_date,
    line_count,
    delivery_qty,
    picked_qty,
    pick_fraction,
    is_shipped,
    datediff(planned_goods_issue_date, current_date()) AS days_to_goods_issue,
    CASE
      WHEN is_shipped THEN 'green'
      WHEN planned_goods_issue_date IS NULL THEN 'grey'
      WHEN coalesce(pick_fraction, 0.0) < 0.5 AND datediff(planned_goods_issue_date, current_date()) <= 0 THEN 'red'
      WHEN coalesce(pick_fraction, 0.0) < 0.8 AND datediff(planned_goods_issue_date, current_date()) <= 1 THEN 'amber'
      ELSE 'green'
    END AS risk_band
  FROM {base}""",

    "gold_process_order_staging": """  SELECT
    order_number,
    plant_code,
    material_code,
    order_quantity,
    scheduled_start_date,
    scheduled_finish_date,
    to_items_total,
    to_items_done,
    staging_fraction,
    is_operationally_trusted,
    datediff(scheduled_start_date, current_date()) AS days_to_start,
    CASE
      WHEN NOT coalesce(is_operationally_trusted, false) THEN 'unvalidated'
      WHEN to_items_total = 0 THEN 'grey'
      WHEN scheduled_start_date IS NULL THEN 'grey'
      WHEN coalesce(staging_fraction, 0.0) < 0.3 AND datediff(scheduled_start_date, current_date()) <= 0 THEN 'red'
      WHEN coalesce(staging_fraction, 0.0) < 0.7 AND datediff(scheduled_start_date, current_date()) <= 1 THEN 'amber'
      ELSE 'green'
    END AS risk_band
  FROM {base}"""
}


def generate_sql():
    os.makedirs("resources/sql", exist_ok=True)

    for env, cfg in ENVIRONMENTS.items():
        catalog = cfg["catalog"]
        gold = f"{catalog}.{cfg['gold_schema']}"
        fn = f"{catalog}.{cfg['silver_schema']}.plant_access_filter"
        group = cfg["consumer_group"]

        sql = TEMPLATE.format(
            env_upper=env.upper(), env_lower=env,
            catalog=catalog, gold_schema=cfg["gold_schema"],
        )

        sql += "\n-- ── Secured views + consumer grants ──\n"
        for table in GOLD_TABLES:
            view = f"{gold}.{table}_secured"
            base = f"{gold}.{table}"
            if table in CUSTOM_SELECTS:
                select_clause = CUSTOM_SELECTS[table].format(base=base)
            else:
                select_clause = f"  SELECT * FROM {base}"
            sql += (
                f"\nCREATE OR REPLACE VIEW {view} AS\n"
                f"{select_clause}\n"
                f"  WHERE {fn}(plant_code);\n"
                f"GRANT SELECT ON VIEW {view} TO `{group}`;\n"
            )

        sql += REVOKE_NOTE.format(env_lower=env)
        with open(cfg["filename"], "w", encoding="utf-8", newline="\n") as f:
            f.write(sql)
        print(f"Generated: {cfg['filename']}")

        # Separate hardening script: real (uncommented) base-table REVOKEs, so the security model is
        # actually enforced rather than relying on nobody having direct base-table SELECT.
        harden = (
            f"-- Gold base-table access hardening ({env.upper()}). Generated by "
            "scripts/generate_gold_security_sql.py — do not edit manually.\n"
            f"-- Run as a UC admin AFTER gold_security_{env}.sql (so the *_secured views already exist).\n"
            "-- Revokes direct SELECT on the un-trimmed base Gold tables from the consumer group, so\n"
            "-- plant-scoped users can only read the row-filtered *_secured views (ADR 012).\n\n"
        )
        for table in GOLD_TABLES:
            harden += f"REVOKE SELECT ON TABLE {gold}.{table} FROM `{group}`;\n"
        harden_fn = os.path.join(os.path.dirname(cfg["filename"]), f"gold_security_harden_{env}.sql")
        with open(harden_fn, "w", encoding="utf-8", newline="\n") as f:
            f.write(harden)
        print(f"Generated: {harden_fn}")


if __name__ == "__main__":
    generate_sql()

