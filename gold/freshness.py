"""
Gold data-freshness monitoring (hardening Sprint 3).

The original `gold_freshness_gate` (dlt_gold_pipeline.py) only checked `silver.goods_movement`. The
Gold layer now depends on many more Silver tables, so a silent failure of any of them would leave
stale KPIs with no signal. This module adds:

  gold_data_freshness_status  — one row per monitored Silver dependency: latest replication time,
                                lag minutes, SLA, and a FRESH/STALE/NO_DATA/STATIC status. Intended
                                for an operations "data freshness" panel.
  gold_critical_freshness_gate — fails the Gold run (@dlt.expect_or_fail) only when a CRITICAL table
                                is STALE, so non-critical lag does not block the pipeline.

Contracts (table → domain → criticality → SLA minutes) are documented in
docs/freshness_contracts.md and must be kept in sync with FRESHNESS_CONTRACTS below.
"""

import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import (
    IntegerType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)

from gold._shared import get_silver_schema, get_spark_session

# has_watermark=False → a seed/config table with no _replicated_at (reported STATIC, never STALE).
FRESHNESS_CONTRACTS = [
    {"table": "goods_movement", "domain": "production/warehouse", "criticality": "critical", "sla_minutes": 120, "has_watermark": True},
    {"table": "process_order", "domain": "production", "criticality": "critical", "sla_minutes": 120, "has_watermark": True},
    {"table": "warehouse_transfer_order", "domain": "warehouse", "criticality": "critical", "sla_minutes": 120, "has_watermark": True},
    {"table": "warehouse_transfer_requirement", "domain": "warehouse", "criticality": "critical", "sla_minutes": 120, "has_watermark": True},
    {"table": "storage_bin", "domain": "stock/warehouse", "criticality": "critical", "sla_minutes": 120, "has_watermark": True},
    {"table": "batch_stock", "domain": "stock", "criticality": "critical", "sla_minutes": 240, "has_watermark": True},
    {"table": "reservation_requirement", "domain": "warehouse", "criticality": "high", "sla_minutes": 120, "has_watermark": True},
    {"table": "outbound_delivery", "domain": "outbound", "criticality": "high", "sla_minutes": 240, "has_watermark": True},
    {"table": "stock_at_location", "domain": "stock", "criticality": "high", "sla_minutes": 240, "has_watermark": True},
    {"table": "purchase_order", "domain": "inbound", "criticality": "medium", "sla_minutes": 1440, "has_watermark": True},
    {"table": "handling_unit", "domain": "inbound/HU", "criticality": "medium", "sla_minutes": 240, "has_watermark": True},
    {"table": "material", "domain": "reference", "criticality": "medium", "sla_minutes": 1440, "has_watermark": True},
    {"table": "movement_type_classification", "domain": "reference", "criticality": "high", "sla_minutes": 0, "has_watermark": False},
]

_SCHEMA = StructType([
    StructField("table_name", StringType()),
    StructField("domain", StringType()),
    StructField("criticality", StringType()),
    StructField("freshness_sla_minutes", IntegerType()),
    StructField("latest_replicated_at", TimestampType()),
    StructField("_base_status", StringType()),
])


@dlt.table(
    name="gold_data_freshness_status",
    comment="Per-Silver-table replication freshness: lag vs SLA with FRESH/STALE/NO_DATA/STATIC status.",
    table_properties={"delta.enableChangeDataFeed": "false"},
)
def gold_data_freshness_status():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    records = []
    for c in FRESHNESS_CONTRACTS:
        fq = f"{silver_schema}.{c['table']}"
        latest = None
        base_status = None  # None → computed (FRESH/STALE) from the lag below
        if not c["has_watermark"]:
            base_status = "STATIC"
        elif not spark.catalog.tableExists(fq):
            base_status = "NO_DATA"
        else:
            latest = spark.read.table(fq).agg(F.max("_replicated_at").alias("m")).first()["m"]
            if latest is None:
                base_status = "NO_DATA"
        records.append(
            (c["table"], c["domain"], c["criticality"], int(c["sla_minutes"]), latest, base_status)
        )

    df = spark.createDataFrame(records, _SCHEMA)
    df = df.withColumn(
        "max_lag_minutes",
        F.when(
            F.col("latest_replicated_at").isNotNull(),
            (F.unix_timestamp(F.current_timestamp()) - F.unix_timestamp("latest_replicated_at")) / 60.0,
        ),
    )
    df = df.withColumn(
        "freshness_status",
        F.when(F.col("_base_status").isNotNull(), F.col("_base_status"))
        .when(F.col("max_lag_minutes") > F.col("freshness_sla_minutes"), F.lit("STALE"))
        .otherwise(F.lit("FRESH")),
    )
    df = df.withColumn("checked_at", F.current_timestamp())
    return df.select(
        "table_name", "domain", "criticality", "latest_replicated_at",
        "max_lag_minutes", "freshness_sla_minutes", "freshness_status", "checked_at",
    )


@dlt.view(
    name="gold_critical_freshness_gate",
    comment="Fails the Gold run if any CRITICAL Silver dependency is STALE (non-critical lag does not block).",
)
@dlt.expect_or_fail("critical_data_is_fresh", "stale_critical_table_count = 0")
def gold_critical_freshness_gate():
    return (
        dlt.read("gold_data_freshness_status")
        .filter((F.col("criticality") == "critical") & (F.col("freshness_status") == "STALE"))
        .agg(F.count(F.lit(1)).alias("stale_critical_table_count"))
    )
