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

from functools import reduce

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

_CONTRACTS_SCHEMA = StructType([
    StructField("table_name", StringType()),
    StructField("domain", StringType()),
    StructField("criticality", StringType()),
    StructField("freshness_sla_minutes", IntegerType()),
])


@dlt.table(
    name="gold_data_freshness_status",
    comment="Per-Silver-table replication freshness: lag vs SLA with FRESH/STALE/NO_DATA/STATIC status.",
    table_properties={"delta.enableChangeDataFeed": "false"},
)
def gold_data_freshness_status():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    # Build a pure, LAZY plan (no Spark actions during DLT planning): one max(_replicated_at) query
    # per watermarked table, unioned, then joined to the contracts metadata. (Using .first() per
    # table here would fire sequential Spark jobs at pipeline-planning time — a DLT anti-pattern that
    # risks driver instability/startup failures.) tableExists is a metastore lookup, not a job.
    watermark_queries = []
    for c in FRESHNESS_CONTRACTS:
        table_name = c["table"]
        fq = f"{silver_schema}.{table_name}"
        if not c["has_watermark"]:
            q = spark.range(1).select(
                F.lit(table_name).alias("table_name"),
                F.lit(None).cast(TimestampType()).alias("latest_replicated_at"),
                F.lit("STATIC").alias("_base_status"),
            )
        elif not spark.catalog.tableExists(fq):
            q = spark.range(1).select(
                F.lit(table_name).alias("table_name"),
                F.lit(None).cast(TimestampType()).alias("latest_replicated_at"),
                F.lit("NO_DATA").alias("_base_status"),
            )
        else:
            q = (
                spark.read.table(fq)
                .agg(F.max("_replicated_at").alias("latest_replicated_at"))
                .select(
                    F.lit(table_name).alias("table_name"),
                    F.col("latest_replicated_at"),
                    F.when(F.col("latest_replicated_at").isNull(), F.lit("NO_DATA"))
                    .otherwise(F.lit(None).cast(StringType()))
                    .alias("_base_status"),
                )
            )
        watermark_queries.append(q)

    watermarks = reduce(lambda a, b: a.unionByName(b), watermark_queries)
    contracts = spark.createDataFrame(
        [(c["table"], c["domain"], c["criticality"], int(c["sla_minutes"])) for c in FRESHNESS_CONTRACTS],
        _CONTRACTS_SCHEMA,
    )

    return (
        contracts.join(watermarks, "table_name", "inner")
        .withColumn(
            "max_lag_minutes",
            F.when(
                F.col("latest_replicated_at").isNotNull(),
                (F.unix_timestamp(F.current_timestamp()) - F.unix_timestamp("latest_replicated_at")) / 60.0,
            ),
        )
        .withColumn(
            "freshness_status",
            F.when(F.col("_base_status").isNotNull(), F.col("_base_status"))
            .when(F.col("max_lag_minutes") > F.col("freshness_sla_minutes"), F.lit("STALE"))
            .otherwise(F.lit("FRESH")),
        )
        .withColumn("checked_at", F.current_timestamp())
        .select(
            "table_name", "domain", "criticality", "latest_replicated_at",
            "max_lag_minutes", "freshness_sla_minutes", "freshness_status",
            (F.col("freshness_status") == "STALE").alias("is_stale"),
            "checked_at",
        )
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
