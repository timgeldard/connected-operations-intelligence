"""
Daily warehouse snapshot job.

The repo's Gold layer is current-state only (materialized views recompute and keep
no history). This scheduled job appends the current state of selected current-state
Gold tables to `<table>_snapshot` companions, partitioned by `snapshot_date`, so
backlog / occupancy / stock / exception trends can be analysed over time.

Run as a triggered Databricks job on serverless (see resources/warehouse_snapshot.job.yml).
Mechanism is deliberately INSERT ... SELECT (append) rather than a DLT MV — see
docs/adr/006-warehouse-snapshots.md.
"""

import argparse

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

# Current-state Gold tables worth trending. Each gets a partitioned *_snapshot companion.
SNAPSHOT_TABLES = [
    "gold_transfer_requirement_backlog",
    "gold_dispensary_backlog",
    "gold_bin_occupancy",
    "gold_lineside_stock",
    "gold_stock_reconciliation",
    "gold_warehouse_exceptions",
    "gold_warehouse_kpi_snapshot",
]


def _apply_row_filter(spark: SparkSession, snap: str, row_filter_function: str) -> None:
    """Apply the plant row filter to a snapshot table (real RLS — snapshots are physical
    Delta tables, so unlike the Gold MVs there is no full-refresh cost).

    The job DROPs the filter while it does its own maintenance DELETEs and re-applies it here, so
    history maintenance never reads through the filter — the run-as principal therefore does NOT
    need to be in silver_admin (it only needs MODIFY on the table + EXECUTE on the function). The
    table is briefly unfiltered mid-run; the job is scheduled off-hours and is the only mid-run
    accessor. See docs/adr/012-gold-row-level-security.md.
    """
    spark.sql(f"ALTER TABLE {snap} SET ROW FILTER {row_filter_function} ON (plant_code)")


def _drop_row_filter(spark: SparkSession, snap: str) -> None:
    """Drop any row filter so this job's maintenance DELETEs run unfiltered. No-op (ignored) if
    the table has no filter — e.g. after a prior run failed before re-applying it."""
    try:
        spark.sql(f"ALTER TABLE {snap} DROP ROW FILTER")
    except Exception:  # noqa: BLE001 — "no row filter set" is expected and harmless
        pass


def snapshot(spark: SparkSession, gold_catalog: str, gold_schema: str, retention_days: int,
             row_filter_function: str = None) -> None:
    schema = gold_schema if gold_catalog == "spark_catalog" else f"{gold_catalog}.{gold_schema}"
    # UC row filters are not supported on local spark_catalog (tests); only apply against UC.
    apply_filter = bool(row_filter_function) and gold_catalog != "spark_catalog"
    for table in SNAPSHOT_TABLES:
        src = f"{schema}.{table}"
        snap = f"{schema}.{table}_snapshot"

        # Read current state and stamp snapshot metadata. Using the DataFrame writer (not
        # INSERT ... SELECT *) means appends resolve by COLUMN NAME, and mergeSchema lets the
        # snapshot evolve when the source Gold table gains columns — so a Gold schema change
        # can no longer silently corrupt or break the snapshot. See ADR 006.
        current = (
            spark.read.table(src)
            .withColumn("snapshot_date", F.current_date())
            .withColumn("snapshot_timestamp", F.current_timestamp())
        )

        # Drop any existing row filter first so the maintenance DELETEs below run unfiltered
        # (otherwise, on day 2+ they would read through the prior run's filter and could silently
        # mis-maintain history if the principal is not in silver_admin). Re-applied at the end.
        if apply_filter and spark.catalog.tableExists(snap):
            _drop_row_filter(spark, snap)

        # Idempotent for a given day: clear today's partition before re-appending.
        if spark.catalog.tableExists(snap):
            spark.sql(f"DELETE FROM {snap} WHERE snapshot_date = CURRENT_DATE()")

        (
            current.write.format("delta")
            .mode("append")
            .option("mergeSchema", "true")
            .partitionBy("snapshot_date")
            .saveAsTable(snap)
        )

        # Retention: drop snapshots older than the window.
        if retention_days and retention_days > 0:
            spark.sql(
                f"DELETE FROM {snap} "
                f"WHERE snapshot_date < DATE_SUB(CURRENT_DATE(), {int(retention_days)})"
            )

        # Re-enforce plant-level row security on the snapshot, now that all writes/deletes for
        # this run are done (the table existed-and-was-dropped above, or was just created).
        if apply_filter:
            _apply_row_filter(spark, snap, row_filter_function)

        print(f"snapshotted {src} -> {snap}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Append daily warehouse Gold snapshots.")
    parser.add_argument("--gold_catalog", required=True)
    parser.add_argument("--gold_schema", required=True)
    parser.add_argument("--retention_days", type=int, default=400)
    parser.add_argument(
        "--row_filter_function", default=None,
        help="Fully-qualified plant_access_filter function to apply as a row filter to the "
             "snapshot tables (e.g. connected_plant_uat.silver.plant_access_filter). "
             "Omit to skip (e.g. local runs).",
    )
    args = parser.parse_args()

    spark = SparkSession.builder.getOrCreate()
    snapshot(spark, args.gold_catalog, args.gold_schema, args.retention_days,
             row_filter_function=args.row_filter_function)


if __name__ == "__main__":
    main()
