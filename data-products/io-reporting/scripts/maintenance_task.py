#!/usr/bin/env python3
"""Table maintenance task — ADR 017 decision 6.

Runs as a Databricks serverless Python task (resources/maintenance.job.yml).

Strategy (in priority order):

1. **Predictive Optimization (preferred):** if the workspace supports it, enable PO on
   the silver and gold schemas via ``ALTER SCHEMA ... ENABLE PREDICTIVE OPTIMIZATION``.
   When PO is enabled the platform handles compaction and deletion-vector purging
   automatically — this script then logs PO status and exits without running
   OPTIMIZE/REORG (they would be redundant).

2. **OPTIMIZE + REORG TABLE ... APPLY (PURGE) (fallback):** if PO is not enabled or not
   supported, run OPTIMIZE (file compaction) then REORG TABLE ... APPLY (PURGE)
   (deletion-vector purge) for each silver and gold table.

VACUUM is NOT executed here. Silver tables serve CDF to downstream incremental
consumers; aggressive VACUUM retention destroys unconsumed change history and is
prohibited without a specific reviewed reason (ADR 017 decision 6). The CI guard
``scripts/ci/check_vacuum_retention.py`` enforces the 168h minimum.
"""
from __future__ import annotations

import argparse
import sys

# Silver tables maintained by this job (DLT streaming tables that accumulate deletion
# vectors from apply_changes CDC ingestion).  Gold tables are managed separately after
# the silver block because gold runs in a different schema.
SILVER_TABLES = [
    "goods_movement",
    "process_order",
    "process_order_operation",
    "pi_sheet_execution",
    "warehouse_transfer_order",
    "warehouse_transfer_requirement",
    "batch_stock",
    "storage_bin",
    "stock_at_location",
    "reservation_requirement",
    "outbound_delivery",
    "purchase_order",
    "handling_unit",
    "physical_inventory_document",
    "downtime_event",
    "material",
    # Reference / slow-tier tables (fewer mutations; OPTIMIZE only — no REORG needed
    # in typical steady state but included for completeness)
    "movement_type_classification",
    "storage_type_role_mapping",
    "process_order_staging_reference_mapping_config",
    "site_config_plant",
    "warehouse_storage_location_mapping",
    "recipe_process_line",
]


def _try_enable_predictive_optimization(spark: object, catalog: str, schema: str) -> bool:
    """Attempt to enable Predictive Optimization on a schema.

    Returns True if PO was enabled (or already enabled); False if not supported.
    The ``ALTER SCHEMA ... ENABLE PREDICTIVE OPTIMIZATION`` DDL was introduced in
    Databricks Runtime 13.3 and requires workspace-level opt-in. Earlier runtimes
    raise an AnalysisException that we catch here.
    """
    try:
        spark.sql(  # type: ignore[union-attr]
            f"ALTER SCHEMA {catalog}.{schema} ENABLE PREDICTIVE OPTIMIZATION"
        )
        print(f"  Predictive Optimization ENABLED on {catalog}.{schema}")
        return True
    except Exception as exc:  # noqa: BLE001
        msg = str(exc).lower()
        if "not supported" in msg or "analysisexception" in msg.lower() or "syntax error" in msg:
            print(
                f"  Predictive Optimization not available on {catalog}.{schema} "
                f"(workspace/runtime does not support it): {exc}"
            )
            return False
        # Unexpected error — re-raise so the job fails loudly
        raise


def _check_predictive_optimization_status(spark: object, catalog: str, schema: str) -> bool:
    """Return True if Predictive Optimization is currently enabled for the schema."""
    try:
        rows = spark.sql(  # type: ignore[union-attr]
            f"DESCRIBE SCHEMA EXTENDED {catalog}.{schema}"
        ).collect()
        for row in rows:
            if hasattr(row, "info_name") and "predictive_optimization" in str(row.info_name).lower():
                val = str(row.info_value).upper() if hasattr(row, "info_value") else ""
                if "ENABLE" in val or "TRUE" in val:
                    return True
    except Exception:  # noqa: BLE001
        pass
    return False


def run_optimize_reorg(spark: object, catalog: str, schema: str, tables: list[str]) -> None:
    """Run OPTIMIZE + REORG TABLE ... APPLY (PURGE) for each table."""
    for table in tables:
        fq = f"{catalog}.{schema}.{table}"
        print(f"  OPTIMIZE {fq} ...")
        try:
            spark.sql(f"OPTIMIZE {fq}")  # type: ignore[union-attr]
        except Exception as exc:  # noqa: BLE001
            # Table may not exist in dev_shakedown (e.g. handling_unit).  Log and skip.
            print(f"    OPTIMIZE skipped — table may not exist: {exc}")
            continue

        print(f"  REORG TABLE {fq} APPLY (PURGE) ...")
        try:
            spark.sql(f"REORG TABLE {fq} APPLY (PURGE)")  # type: ignore[union-attr]
        except Exception as exc:  # noqa: BLE001
            print(f"    REORG skipped: {exc}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run table maintenance for ADR 017 decision 6.")
    parser.add_argument("--catalog", required=True, help="Unity Catalog catalog name.")
    parser.add_argument("--silver-schema", required=True, help="Silver schema name.")
    parser.add_argument("--gold-schema", required=True, help="Gold schema name.")
    args = parser.parse_args(argv)

    # PySpark is available at Databricks serverless task runtime.
    try:
        from pyspark.sql import SparkSession
    except ImportError:
        print("ERROR: PySpark not available. This task must run on Databricks.", file=sys.stderr)
        return 1

    spark = SparkSession.builder.getOrCreate()

    catalog = args.catalog
    silver_schema = args.silver_schema
    gold_schema = args.gold_schema

    print(f"Maintenance task starting — catalog={catalog}, silver={silver_schema}, gold={gold_schema}")

    # -----------------------------------------------------------------------
    # Silver schema
    # -----------------------------------------------------------------------
    print(f"\n=== Silver: {catalog}.{silver_schema} ===")
    silver_po = _try_enable_predictive_optimization(spark, catalog, silver_schema)
    if not silver_po:
        silver_po = _check_predictive_optimization_status(spark, catalog, silver_schema)

    if silver_po:
        print("  Predictive Optimization active — skipping manual OPTIMIZE/REORG for silver.")
    else:
        print("  Predictive Optimization not active — running OPTIMIZE + REORG for silver tables.")
        run_optimize_reorg(spark, catalog, silver_schema, SILVER_TABLES)

    # -----------------------------------------------------------------------
    # Gold schema
    # -----------------------------------------------------------------------
    print(f"\n=== Gold: {catalog}.{gold_schema} ===")
    gold_po = _try_enable_predictive_optimization(spark, catalog, gold_schema)
    if not gold_po:
        gold_po = _check_predictive_optimization_status(spark, catalog, gold_schema)

    if gold_po:
        print("  Predictive Optimization active — skipping manual OPTIMIZE/REORG for gold.")
    else:
        print("  Predictive Optimization not active — running OPTIMIZE for gold schema.")
        # For gold we run OPTIMIZE only (gold tables are written by DLT triggered pipeline,
        # which does not accumulate persistent deletion vectors the way streaming tables do).
        try:
            rows = spark.sql(  # type: ignore[union-attr]
                f"SHOW TABLES IN {catalog}.{gold_schema}"
            ).collect()
            gold_tables = [r.tableName for r in rows if hasattr(r, "tableName")]
        except Exception as exc:  # noqa: BLE001
            print(f"  Could not list gold tables: {exc}")
            gold_tables = []

        for table in gold_tables:
            fq = f"{catalog}.{gold_schema}.{table}"
            print(f"  OPTIMIZE {fq} ...")
            try:
                spark.sql(f"OPTIMIZE {fq}")  # type: ignore[union-attr]
            except Exception as exc:  # noqa: BLE001
                print(f"    OPTIMIZE skipped: {exc}")

    print("\nMaintenance task complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
