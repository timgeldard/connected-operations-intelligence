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


def snapshot(spark: SparkSession, gold_catalog: str, gold_schema: str, retention_days: int) -> None:
    schema = gold_schema if gold_catalog == "spark_catalog" else f"{gold_catalog}.{gold_schema}"
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
        print(f"snapshotted {src} -> {snap}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Append daily warehouse Gold snapshots.")
    parser.add_argument("--gold_catalog", required=True)
    parser.add_argument("--gold_schema", required=True)
    parser.add_argument("--retention_days", type=int, default=400)
    args = parser.parse_args()

    spark = SparkSession.builder.getOrCreate()
    snapshot(spark, args.gold_catalog, args.gold_schema, args.retention_days)


if __name__ == "__main__":
    main()
