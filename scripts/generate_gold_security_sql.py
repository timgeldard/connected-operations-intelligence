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
-- ── Optional hardening: ensure consumers cannot read the un-trimmed base tables ──
-- Direct SELECT on the base Gold tables should be limited to the data-product owner / admins.
-- Uncomment to explicitly revoke base-table access from the consumer group (no-op if never granted):
"""


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
            sql += (
                f"\nCREATE OR REPLACE VIEW {view} AS\n"
                f"  SELECT * FROM {base}\n"
                f"  WHERE {fn}(plant_code);\n"
                f"GRANT SELECT ON VIEW {view} TO `{group}`;\n"
            )

        sql += REVOKE_NOTE
        for table in GOLD_TABLES:
            sql += f"-- REVOKE SELECT ON TABLE {gold}.{table} FROM `{group}`;\n"

        with open(cfg["filename"], "w", encoding="utf-8") as f:
            f.write(sql)
        print(f"Generated: {cfg['filename']}")


if __name__ == "__main__":
    generate_sql()
