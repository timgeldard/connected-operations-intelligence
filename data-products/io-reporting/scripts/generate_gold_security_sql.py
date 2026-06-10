#!/usr/bin/env python3
"""
Generate environment-specific Gold row-level-security SQL for Unity Catalog.

The Gold materialized views are a "trusted" aggregate layer and are deliberately NOT
row-filtered directly (doing so forces full MV refreshes — see ADR 005 / ADR 012). Instead
we expose a **secured serving view** per plant-scoped Gold table that enforces plant access
via the central published_<env>.security.model CSM pattern. Consumers (the `users` group)
are granted SELECT on the `*_secured` views only; direct SELECT on the base Gold tables is
reserved for the data-product owner / admins.

Security model: each user has a row in published_<env>.security.model keyed by email +
application_key ('io_reporting'). access_type = 'full view' grants all plants; access_type =
'filter' restricts to the plant codes in the filter_plant array. Dev secured views are
pass-through (no filter) — silver_io_reporting is inaccessible to civilians in all envs.

Outputs SQL scripts to resources/sql/ for dev, uat and prod. Run once per env as a UC
admin after the first deploy (re-runnable; views are CREATE OR REPLACE).

Security modes (--security-mode):
  * strict (default)      — secured views filter on the real published_<env>.security.model.
                            This is the only mode allowed for prod.
  * validation-open       — secured views are pass-throughs (same names + grants, no security
                            predicate). UAT/DEV only — for data-shape validation when the
                            corporate security model is unavailable. Does NOT prove RLS.
  * validation-fixture    — secured views filter on a LOCAL fixture table
                            (<catalog>.<gold_schema>.security_model_fixture) instead of the
                            corporate model. UAT/DEV only — for representative entitlement
                            testing with placeholder identities.
Validation modes are FORBIDDEN for prod (the generator errors). Strict mode writes the
canonical gold_security_<env>.sql (+ the harden script); validation modes write a clearly
named gold_security_<env>_validation_<mode>.sql and reuse the same harden script.
"""
import argparse
import os
import sys

# Resolve output paths relative to the repo root (this script lives in scripts/), so it runs the
# same regardless of the caller's working directory (matches generate_gold_serving_views_sql.py).
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

APPLICATION_KEY = "io_reporting"

SECURITY_MODES = ("strict", "validation-open", "validation-fixture")
VALIDATION_MODES = ("validation-open", "validation-fixture")
# Local fixture table (UAT/DEV) used by validation-fixture mode in place of the corporate model.
FIXTURE_TABLE = "security_model_fixture"

ENVIRONMENTS = {
    "dev": {
        "catalog": "connected_plant_dev",
        "gold_schema": "gold_io_reporting",
        "consumer_group": "users",
        "security_model": None,  # dev: no filter — return all rows (no published_<env>.security available)
        # dev_shakedown: HU-dependent Gold tables are not materialised (central_services lacks
        # handlingunit_vekp/vepo), so their secured views are skipped — see databricks.yml.
        "enable_hu_reconciliation": False,
        "filename": "resources/sql/gold_security_dev.sql",
    },
    "uat": {
        "catalog": "connected_plant_uat",
        "gold_schema": "gold_io_reporting",
        "consumer_group": "users",
        "security_model": "published_uat.security.model",
        "enable_hu_reconciliation": True,
        "filename": "resources/sql/gold_security_uat.sql",
    },
    "prod": {
        "catalog": "connected_plant_prod",
        "gold_schema": "gold_io_reporting",
        "consumer_group": "users",
        "security_model": "published_prod.security.model",
        "enable_hu_reconciliation": True,
        "filename": "resources/sql/gold_security_prod.sql",
    },
}

# Gold tables that depend on the handling-unit (HU) silver source. Not materialised when
# enable_hu_reconciliation is false (dev_shakedown), so their secured views/REVOKEs are skipped.
# Keep in sync with the hu_reconciliation_enabled() gating in gold/*.py and silver/tables/inbound.py.
HU_DEPENDENT_GOLD_TABLES = {"gold_hu_reconciliation", "gold_handling_unit_summary"}

# Every plant-scoped Gold materialized view (all carry a plant_code column). Keep in sync
# with the gold/*.py table definitions.
GOLD_TABLES = [
    # warehouse_kpis.py
    "gold_transfer_order_performance",
    "gold_inbound_outbound_throughput",
    "gold_bin_occupancy",
    "gold_stock_availability",
    "gold_transfer_requirement_backlog",
    "gold_transfer_requirement_material_backlog",
    "gold_stock_expiry_risk",
    # dlt_gold_pipeline.py
    "gold_shift_output_summary",
    "gold_process_order_schedule_adherence",
    "gold_plant_production_quality_summary",
    "gold_process_order_operations",
    "gold_order_downtime_summary",
    "gold_process_order_component_status",
    # warehouse_flow_gold.py
    "gold_dispensary_backlog",
    "gold_lineside_stock",
    "gold_delivery_pick_status",
    "gold_stock_reconciliation",
    "gold_process_order_staging",
    "gold_process_order_staging_validation",
    "gold_storage_type_role_coverage_status",
    "gold_stock_reconciliation_v2",
    "gold_stock_value_reconciliation",
    "gold_reconciliation_audit_log",
    "gold_movement_reconciliation",
    "gold_hu_reconciliation",
    "gold_physical_inventory_recon",
    "gold_reconciliation_alerts",
    "gold_stock_reconciliation_exceptions_v2",
    "gold_stock_reconciliation_summary_v2",
    "gold_stock_reconciliation_summary",
    "gold_stock_holds",
    "gold_transfer_order_open_items",
    "gold_transfer_requirement_open_items",
    "gold_goods_movement_activity",
    # warehouse_inbound_gold.py
    "gold_inbound_po_backlog",
    "gold_inbound_po_backlog_enhanced",
    "gold_inbound_po_line_backlog",
    "gold_handling_unit_summary",
    # warehouse_exceptions.py
    "gold_warehouse_exceptions",
    # warehouse_kpi_snapshot.py
    "gold_warehouse_kpi_snapshot",
    # wm_operations_gold.py
    "gold_wm_staging_worklist",
    "gold_wm_worklist_summary",
    "gold_wm_order_readiness",
    "gold_wm_bin_stock_detail",
    "gold_wm_order_component_detail",
    "gold_wm_operator_activity",
    "gold_wm_queue_workload",
]

TEMPLATE = """-- Unity Catalog Gold row-level security — secured serving views ({env_upper}).
-- Run once as a Unity Catalog admin after the first {env_lower} deploy. Re-runnable.
-- Requires: CREATE VIEW on {catalog}.{gold_schema}.
-- WARNING: Generated automatically by scripts/generate_gold_security_sql.py. Do not edit manually.
--
-- Model: Gold MVs stay trusted (not row-filtered, to avoid full MV refreshes). Each plant-scoped
-- Gold table gets a <table>_secured view that enforces plant access via published_<env>.security.model
-- (application_key = 'io_reporting'). access_type 'full view' = all plants; 'filter' = filter_plant
-- array. Dev secured views are pass-through (no security model available in dev).
-- Consumers ('users' group) are granted SELECT on the *_secured views only.
"""

REVOKE_NOTE = """
-- ── Base-table access hardening ──
-- The actual REVOKE statements are generated as a SEPARATE admin script
-- (resources/sql/gold_security_harden_{env_lower}.sql). Apply it AFTER this script so plant-scoped users
-- can only read the *_secured views, not the un-trimmed base Gold tables (ADR 012).
-- It is kept separate because revoking broad access is operationally sensitive and irreversible-ish.
"""


CUSTOM_SELECTS: dict[str, str] = {}
# ADR 012: date-relative (current_date()) columns live ONLY in the _live serving views
# (gold_serving_views_<env>.sql), so base MVs stay deterministic. The _secured views are pure
# RLS pass-throughs (SELECT * FROM base + plant filter). Previously this dict hard-coded
# date-relative columns into 4 secured views, which (a) collided with the same columns the
# _live views add (COLUMN_ALREADY_EXISTS) and (b) carried stale projections that dropped
# columns the consumption views need. Emptied — all secured views now use the default body.


def _security_filter(security_model: str, enabled_guard: bool = False) -> str:
    """Return the WHERE clause for the CSM security model EXISTS check, or empty string for a pass-through.

    enabled_guard adds `AND COALESCE(enabled, true)` to both branches — used by validation-fixture so a
    fixture row with enabled=false grants nothing (the corporate model has no `enabled` column, so strict
    never sets this)."""
    if not security_model:
        return ""
    en = "\n      AND COALESCE(enabled, true)" if enabled_guard else ""
    return (
        f"\n  WHERE EXISTS (\n"
        f"    SELECT 1 FROM {security_model}\n"
        f"    WHERE current_user() = email\n"
        f"      AND application_key = '{APPLICATION_KEY}'\n"
        f"      AND LOWER(access_type) = 'full view'{en}\n"
        f"    UNION ALL\n"
        f"    SELECT 1 FROM {security_model}\n"
        f"    WHERE current_user() = email\n"
        f"      AND application_key = '{APPLICATION_KEY}'\n"
        f"      AND LOWER(access_type) = 'filter'\n"
        f"      AND array_contains(filter_plant, plant_code){en}\n"
        f"  )"
    )


def _mode_model_ref(cfg: dict, gold: str, security_mode: str):
    """The table the secured-view predicate filters against for a given mode (None = pass-through)."""
    if security_mode == "strict":
        return cfg["security_model"]
    if security_mode == "validation-open":
        return None
    if security_mode == "validation-fixture":
        return f"{gold}.{FIXTURE_TABLE}"
    raise ValueError(f"Unknown security_mode '{security_mode}' (allowed: {', '.join(SECURITY_MODES)}).")


def _output_filename(cfg: dict, security_mode: str) -> str:
    """Strict → the canonical gold_security_<env>.sql; validation modes → a clearly named variant."""
    if security_mode == "strict":
        return cfg["filename"]
    base, ext = os.path.splitext(cfg["filename"])
    suffix = security_mode.replace("-", "_")  # validation-open -> validation_open
    return f"{base}_{suffix}{ext}"


def _mode_header_note(security_mode: str) -> str:
    if security_mode == "validation-open":
        return (
            "--\n-- SECURITY MODE: validation-open (UAT/DEV ONLY). The *_secured views below are\n"
            "-- PASS-THROUGHS (no security predicate) so UAT data-shape validation can run when\n"
            "-- published_<env>.security.model is unavailable. This preserves the secured-view boundary\n"
            "-- and view names, but does NOT prove RLS / plant filtering / entitlement. MUST NOT be used\n"
            "-- in prod or to claim cutover readiness. Run gold_security_harden_<env>.sql after it so the\n"
            "-- base Gold tables remain revoked from `users`.\n"
        )
    if security_mode == "validation-fixture":
        return (
            "--\n-- SECURITY MODE: validation-fixture (UAT/DEV ONLY). The *_secured views filter on the\n"
            f"-- LOCAL <catalog>.<gold_schema>.{FIXTURE_TABLE} table (placeholder test identities), NOT the\n"
            "-- corporate published_<env>.security.model. Proves the secured-view PREDICATE logic and\n"
            "-- representative plant scoping, NOT real corporate-RLS integration. MUST NOT be used in prod.\n"
        )
    return ""


def generate_sql(env_filter: str | None = None, security_mode: str = "strict"):
    """Write the per-environment Gold RLS SQL (and, in strict mode, the harden script).

    Args:
        env_filter: restrict generation to one of dev/uat/prod; None generates every
            environment. Validation security modes REQUIRE an explicit env.
        security_mode: 'strict' (real published_<env>.security.model — the only mode
            allowed for prod, writes the canonical gold_security_<env>.sql + harden
            script), 'validation-open' (pass-through secured views) or
            'validation-fixture' (local fixture table) — UAT/DEV only, written to
            clearly suffixed gold_security_<env>_validation_<mode>.sql files.

    Raises:
        SystemExit: unknown mode/env, validation mode without an explicit env, or a
            validation mode targeting prod.
    """
    if security_mode not in SECURITY_MODES:
        raise SystemExit(f"Unknown --security-mode '{security_mode}' (allowed: {', '.join(SECURITY_MODES)}).")

    if env_filter and env_filter not in ENVIRONMENTS:
        raise SystemExit(f"Unknown --env '{env_filter}' (allowed: {', '.join(ENVIRONMENTS)}).")

    if security_mode in VALIDATION_MODES and not env_filter:
        raise SystemExit(
            f"An explicit --env is required when using validation security modes "
            f"(allowed: {', '.join(e for e in ENVIRONMENTS if e != 'prod')})."
        )

    envs = {env_filter: ENVIRONMENTS[env_filter]} if env_filter else ENVIRONMENTS

    # GUARDRAIL: prod must use the real corporate security model — never a pass-through or fixture.
    if security_mode in VALIDATION_MODES and "prod" in envs:
        raise SystemExit("validation security modes are forbidden for prod")

    os.makedirs(os.path.join(REPO_ROOT, "resources/sql"), exist_ok=True)

    for env, cfg in envs.items():

        catalog = cfg["catalog"]
        gold = f"{catalog}.{cfg['gold_schema']}"
        group = cfg["consumer_group"]
        where = _security_filter(
            _mode_model_ref(cfg, gold, security_mode),
            enabled_guard=(security_mode == "validation-fixture"),
        )

        # In dev_shakedown, HU-dependent Gold tables are not built, so skip their secured views.
        env_tables = [
            t for t in GOLD_TABLES
            if cfg["enable_hu_reconciliation"] or t not in HU_DEPENDENT_GOLD_TABLES
        ]

        sql = TEMPLATE.format(
            env_upper=env.upper(), env_lower=env,
            catalog=catalog, gold_schema=cfg["gold_schema"],
        )
        sql += _mode_header_note(security_mode)
        if not cfg["enable_hu_reconciliation"]:
            sql += (
                "\n-- NOTE: enable_hu_reconciliation=false — HU-dependent secured views "
                f"({', '.join(sorted(HU_DEPENDENT_GOLD_TABLES))}) are intentionally omitted.\n"
            )

        sql += "\n-- ── Secured views + consumer grants ──\n"
        for table in env_tables:
            view = f"{gold}.{table}_secured"
            base = f"{gold}.{table}"
            if table in CUSTOM_SELECTS:
                select_clause = CUSTOM_SELECTS[table].format(base=base)
            else:
                select_clause = f"  SELECT * FROM {base}"
            sql += (
                f"\nCREATE OR REPLACE VIEW {view} AS\n"
                f"{select_clause}"
                f"{where};\n"
                f"GRANT SELECT ON VIEW {view} TO `{group}`;\n"
            )

        sql += REVOKE_NOTE.format(env_lower=env)
        out_fn = os.path.join(REPO_ROOT, _output_filename(cfg, security_mode))
        with open(out_fn, "w", encoding="utf-8", newline="\n") as f:
            f.write(sql)
        print(f"Generated: {out_fn}")

        # The harden script (base-table REVOKEs) is mode-independent and canonical — only strict mode
        # writes it. Validation modes reuse the same gold_security_harden_<env>.sql (so base Gold stays
        # revoked from `users` even while the secured views are pass-throughs/fixtures).
        if security_mode != "strict":
            continue

        # Separate hardening script: real (uncommented) base-table REVOKEs, so the security model is
        # actually enforced rather than relying on nobody having direct base-table SELECT.
        harden = (
            f"-- Gold base-table access hardening ({env.upper()}). Generated by "
            "scripts/generate_gold_security_sql.py — do not edit manually.\n"
            f"-- Run as a UC admin AFTER gold_security_{env}.sql (so the *_secured views already exist).\n"
            "-- Revokes direct SELECT on the un-trimmed base Gold tables from the consumer group, so\n"
            "-- plant-scoped users can only read the row-filtered *_secured views (ADR 012).\n\n"
        )
        for table in env_tables:
            harden += f"REVOKE SELECT ON TABLE {gold}.{table} FROM `{group}`;\n"
        harden_fn = os.path.join(REPO_ROOT, os.path.dirname(cfg["filename"]), f"gold_security_harden_{env}.sql")
        with open(harden_fn, "w", encoding="utf-8", newline="\n") as f:
            f.write(harden)
        print(f"Generated: {harden_fn}")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Generate Gold row-level-security SQL for Unity Catalog.")
    parser.add_argument(
        "--security-mode", choices=SECURITY_MODES, default="strict",
        help="strict (real security model; only mode allowed for prod), validation-open (pass-through "
             "secured views, UAT/DEV only), or validation-fixture (local fixture table, UAT/DEV only).",
    )
    parser.add_argument(
        "--env", choices=list(ENVIRONMENTS), default=None,
        help="Restrict generation to one environment (default: all). Required intent for validation modes.",
    )
    args = parser.parse_args(argv)
    generate_sql(env_filter=args.env, security_mode=args.security_mode)
    return 0


if __name__ == "__main__":
    sys.exit(main())
