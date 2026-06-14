"""
Gold data-freshness monitoring (hardening Sprint 3) + domain watermark extension (Spec 16).

The original `gold_freshness_gate` (dlt_gold_pipeline.py) only checked `silver.goods_movement`. The
Gold layer now depends on many more Silver tables, so a silent failure of any of them would leave
stale KPIs with no signal. This module adds:

  gold_data_freshness_status  — one row per monitored Silver dependency: latest replication time,
                                lag minutes, SLA, and a FRESH/STALE/NO_DATA/STATIC status. Intended
                                for an operations "data freshness" panel.
  gold_critical_freshness_gate — fails the Gold run (@dlt.expect_or_fail) when a CRITICAL table is
                                STALE or has NO_DATA, so empty critical inputs cannot pass silently.

DETERMINISM EXEMPTION: these are full-recompute MONITORING tables, not analytics bases — the
checked_at / latest_observed_at wall-clock audit columns and lag calculations are the tables'
purpose. They are exempt from the no-current_date()-in-base-MV rule (see
scripts/ci/check_gold_mv_determinism.py EXEMPT_FILES) and must not be used as serving sources.

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

from gold._shared import get_silver_schema, get_spark_session, table_exists

# ---------------------------------------------------------------------------
# Spec 16: domain freshness thresholds (warning / critical in minutes).
# Used by gold_domain_freshness_watermark and the consumption view
# vw_consumption_data_freshness (query-time age status).
# ---------------------------------------------------------------------------
DOMAIN_FRESHNESS_THRESHOLDS: dict[str, dict] = {
    "warehouse_tr_to": {"warning_minutes": 120, "critical_minutes": 480},
    "process_orders": {"warning_minutes": 120, "critical_minutes": 480},
    "production_quality": {"warning_minutes": 240, "critical_minutes": 720},
    "stock": {"warning_minutes": 240, "critical_minutes": 720},
    "deliveries": {"warning_minutes": 240, "critical_minutes": 720},
    "inbound": {"warning_minutes": 720, "critical_minutes": 1440},
    "reference": {"warning_minutes": 720, "critical_minutes": 2880},
    "stock_counting": {"warning_minutes": 720, "critical_minutes": 2880},
}

# Mapping from FRESHNESS_CONTRACTS domain strings to canonical SHD-003 domain keys.
_DOMAIN_MAP: dict[str, str] = {
    "warehouse": "warehouse_tr_to",
    "production": "process_orders",
    "production/quality": "production_quality",
    "production/warehouse": "process_orders",
    "stock": "stock",
    "stock/warehouse": "stock",
    "stock/counting": "stock_counting",
    "outbound": "deliveries",
    "inbound": "inbound",
    "inbound/HU": "inbound",
    "reference": "reference",
    "reference/config": "reference",
}

# has_watermark=False → a seed/config table with no _replicated_at (reported STATIC, never STALE).
FRESHNESS_CONTRACTS = [
    {"table": "goods_movement", "domain": "production/warehouse", "criticality": "critical", "sla_minutes": 120, "has_watermark": True},
    {"table": "process_order", "domain": "production", "criticality": "critical", "sla_minutes": 120, "has_watermark": True},
    {"table": "process_order_operation", "domain": "production", "criticality": "high", "sla_minutes": 240, "has_watermark": True},
    {"table": "pi_sheet_execution", "domain": "production", "criticality": "high", "sla_minutes": 480, "has_watermark": True},
    {"table": "downtime_event", "domain": "production/quality", "criticality": "high", "sla_minutes": 120, "has_watermark": True},
    {"table": "warehouse_transfer_order", "domain": "warehouse", "criticality": "critical", "sla_minutes": 240, "has_watermark": True},
    {"table": "warehouse_transfer_requirement", "domain": "warehouse", "criticality": "critical", "sla_minutes": 240, "has_watermark": True},
    {"table": "storage_bin", "domain": "stock/warehouse", "criticality": "critical", "sla_minutes": 480, "has_watermark": True},
    {"table": "batch_stock", "domain": "stock", "criticality": "critical", "sla_minutes": 480, "has_watermark": True},
    {"table": "reservation_requirement", "domain": "warehouse", "criticality": "high", "sla_minutes": 240, "has_watermark": True},
    {"table": "outbound_delivery", "domain": "outbound", "criticality": "high", "sla_minutes": 480, "has_watermark": True},
    {"table": "stock_at_location", "domain": "stock", "criticality": "high", "sla_minutes": 480, "has_watermark": True},
    {"table": "purchase_order", "domain": "inbound", "criticality": "medium", "sla_minutes": 1440, "has_watermark": True},
    {"table": "handling_unit", "domain": "inbound/HU", "criticality": "medium", "sla_minutes": 240, "has_watermark": True},
    {"table": "physical_inventory_document", "domain": "stock/counting", "criticality": "medium", "sla_minutes": 1440, "has_watermark": True},
    {"table": "material", "domain": "reference", "criticality": "medium", "sla_minutes": 1440, "has_watermark": True},
    {"table": "movement_type_classification", "domain": "reference", "criticality": "high", "sla_minutes": 0, "has_watermark": False},
    {"table": "storage_type_role_mapping", "domain": "reference/config", "criticality": "high", "sla_minutes": 0, "has_watermark": False},
    {"table": "process_order_staging_reference_mapping_config", "domain": "reference/config", "criticality": "high", "sla_minutes": 0, "has_watermark": False},
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
        elif not table_exists(spark, fq):
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
    comment="Fails the Gold run if any CRITICAL Silver dependency is STALE or NO_DATA.",
)
@dlt.expect_or_fail("critical_data_is_available_and_fresh", "blocking_critical_table_count = 0")
def gold_critical_freshness_gate():
    return (
        dlt.read("gold_data_freshness_status")
        .filter(
            (F.col("criticality") == "critical")
            & (F.col("freshness_status").isin("STALE", "NO_DATA"))
        )
        .agg(F.count(F.lit(1)).alias("blocking_critical_table_count"))
    )


@dlt.table(
    name="gold_data_health_summary",
    comment=(
        "Gold observability rollup for freshness, expectations, config coverage, staging "
        "validation, and stock reconciliation health."
    ),
    table_properties={"delta.enableChangeDataFeed": "false"},
    cluster_by=["health_area"],
)
def gold_data_health_summary():
    """Summarise the operational health signals emitted by the Gold pipeline.

    DLT expectation metrics are stored in the pipeline event log, not in a materialized table
    that can be safely joined during planning. The expectation row below makes that ownership
    explicit while the other rows roll up tables that are already persisted in Gold.
    """
    spark = get_spark_session()

    freshness = dlt.read("gold_data_freshness_status")
    freshness_summary = (
        freshness
        .agg(
            F.count(F.lit(1)).alias("monitored_table_count"),
            F.coalesce(
                F.sum(
                    F.when(
                        (F.col("criticality") == "critical")
                        & (F.col("freshness_status").isin("STALE", "NO_DATA")),
                        F.lit(1),
                    ).otherwise(F.lit(0))
                ),
                F.lit(0),
            ).alias("critical_issue_count"),
            F.coalesce(
                F.sum(
                    F.when(
                        (F.col("criticality") != "critical")
                        & (F.col("freshness_status").isin("STALE", "NO_DATA")),
                        F.lit(1),
                    ).otherwise(F.lit(0))
                ),
                F.lit(0),
            ).alias("warning_issue_count"),
            F.max("checked_at").alias("latest_observed_at"),
        )
        .withColumn(
            "health_status",
            F.when(F.col("critical_issue_count") > 0, F.lit("FAIL"))
            .when(F.col("warning_issue_count") > 0, F.lit("WARN"))
            .otherwise(F.lit("OK")),
        )
        .select(
            F.lit("freshness").alias("health_area"),
            "health_status",
            F.col("monitored_table_count").alias("affected_row_count"),
            "critical_issue_count",
            "warning_issue_count",
            "latest_observed_at",
            F.concat(
                F.lit("monitored Silver dependencies="),
                F.col("monitored_table_count").cast("string"),
            ).alias("details"),
        )
    )

    storage_coverage = dlt.read("gold_storage_type_role_coverage_status")
    storage_summary = (
        storage_coverage
        .agg(
            F.count(F.lit(1)).alias("warehouse_count"),
            F.coalesce(
                F.sum(F.when(F.col("coverage_status") == "MISSING", F.lit(1)).otherwise(F.lit(0))),
                F.lit(0),
            ).alias("critical_issue_count"),
            F.coalesce(
                F.sum(F.when(F.col("coverage_status") == "PARTIAL", F.lit(1)).otherwise(F.lit(0))),
                F.lit(0),
            ).alias("warning_issue_count"),
        )
        .withColumn("latest_observed_at", F.current_timestamp())
        .withColumn(
            "health_status",
            F.when(F.col("critical_issue_count") > 0, F.lit("FAIL"))
            .when(F.col("warning_issue_count") > 0, F.lit("WARN"))
            .otherwise(F.lit("OK")),
        )
        .select(
            F.lit("storage_type_role_coverage").alias("health_area"),
            "health_status",
            F.col("warehouse_count").alias("affected_row_count"),
            "critical_issue_count",
            "warning_issue_count",
            "latest_observed_at",
            F.lit("MISSING/PARTIAL storage-type role mappings affect lineside and reconciliation trust").alias(
                "details"
            ),
        )
    )

    staging_validation = dlt.read("gold_process_order_staging_validation")
    staging_summary = (
        staging_validation
        .agg(
            F.count(F.lit(1)).alias("warehouse_count"),
            F.coalesce(
                F.sum(F.when(F.col("validation_status") == "NOT_VALIDATED", F.lit(1)).otherwise(F.lit(0))),
                F.lit(0),
            ).alias("critical_issue_count"),
            F.coalesce(
                F.sum(F.when(F.col("validation_status") == "NOT_APPLICABLE", F.lit(1)).otherwise(F.lit(0))),
                F.lit(0),
            ).alias("warning_issue_count"),
            F.max("sample_window_end").alias("latest_observed_at"),
        )
        .withColumn(
            "health_status",
            F.when(F.col("critical_issue_count") > 0, F.lit("FAIL"))
            .when(F.col("warning_issue_count") > 0, F.lit("WARN"))
            .otherwise(F.lit("OK")),
        )
        .select(
            F.lit("process_order_staging_validation").alias("health_area"),
            "health_status",
            F.col("warehouse_count").alias("affected_row_count"),
            "critical_issue_count",
            "warning_issue_count",
            "latest_observed_at",
            F.lit("BETYP='F' source-reference validation for process-order staging").alias("details"),
        )
    )

    reconciliation = dlt.read("gold_stock_reconciliation_summary_v2")
    reconciliation_summary = (
        reconciliation
        .agg(
            F.coalesce(F.sum("exception_count"), F.lit(0)).alias("affected_row_count"),
            F.coalesce(
                F.sum(
                    F.when(
                        F.col("mismatch_severity").isin("HIGH", "CRITICAL"),
                        F.col("exception_count"),
                    ).otherwise(F.lit(0))
                ),
                F.lit(0),
            ).alias("critical_issue_count"),
            F.coalesce(
                F.sum(
                    F.when(
                        ~F.col("mismatch_severity").isin("INFO", "HIGH", "CRITICAL"),
                        F.col("exception_count"),
                    ).otherwise(F.lit(0))
                ),
                F.lit(0),
            ).alias("warning_issue_count"),
            F.coalesce(F.sum("abs_delta_quantity_total"), F.lit(0.0)).alias("abs_delta_quantity_total"),
        )
        .withColumn("latest_observed_at", F.current_timestamp())
        .withColumn(
            "health_status",
            F.when(F.col("critical_issue_count") > 0, F.lit("FAIL"))
            .when(F.col("warning_issue_count") > 0, F.lit("WARN"))
            .otherwise(F.lit("OK")),
        )
        .select(
            F.lit("stock_reconciliation").alias("health_area"),
            "health_status",
            "affected_row_count",
            "critical_issue_count",
            "warning_issue_count",
            "latest_observed_at",
            F.concat(
                F.lit("absolute delta quantity total="),
                F.round(F.col("abs_delta_quantity_total"), 3).cast("string"),
            ).alias("details"),
        )
    )

    expectation_summary = spark.range(1).select(
        F.lit("expectations").alias("health_area"),
        F.lit("EVENT_LOG").alias("health_status"),
        F.lit(None).cast("long").alias("affected_row_count"),
        F.lit(None).cast("long").alias("critical_issue_count"),
        F.lit(None).cast("long").alias("warning_issue_count"),
        F.current_timestamp().alias("latest_observed_at"),
        F.lit("DLT expectation violations are available in the pipeline event log").alias("details"),
    )

    reconciliation_alerts = dlt.read("gold_reconciliation_alerts")
    reconciliation_alerts_summary = (
        reconciliation_alerts
        .agg(
            F.count(F.lit(1)).alias("affected_row_count"),
            F.coalesce(F.sum(F.when(F.col("alert_priority") == "P1", F.lit(1)).otherwise(F.lit(0))), F.lit(0)).alias(
                "critical_issue_count"
            ),
            F.coalesce(F.sum(F.when(F.col("alert_priority").isin("P2", "P3"), F.lit(1)).otherwise(F.lit(0))), F.lit(0)).alias(
                "warning_issue_count"
            ),
        )
        .withColumn("latest_observed_at", F.current_timestamp())
        .withColumn(
            "health_status",
            F.when(F.col("critical_issue_count") > 0, F.lit("FAIL"))
            .when(F.col("warning_issue_count") > 0, F.lit("WARN"))
            .otherwise(F.lit("OK")),
        )
        .select(
            F.lit("reconciliation_alerts").alias("health_area"),
            "health_status",
            "affected_row_count",
            "critical_issue_count",
            "warning_issue_count",
            "latest_observed_at",
            F.lit("Alert-ready stock/HU/physical-inventory reconciliation exceptions").alias("details"),
        )
    )

    return (
        freshness_summary
        .unionByName(storage_summary)
        .unionByName(staging_summary)
        .unionByName(reconciliation_summary)
        .unionByName(reconciliation_alerts_summary)
        .unionByName(expectation_summary)
    )


# ---------------------------------------------------------------------------
# Spec 16: domain-level freshness watermarks (deterministic — no current_timestamp()).
# Reads from gold_data_freshness_status (exempt) and aggregates to one row per
# canonical domain. Stores only the watermark timestamp; age is computed at query time
# in vw_consumption_data_freshness (consumption view).
# ---------------------------------------------------------------------------

_THRESHOLD_ROWS = [
    (domain, thresholds["warning_minutes"], thresholds["critical_minutes"])
    for domain, thresholds in DOMAIN_FRESHNESS_THRESHOLDS.items()
]

_THRESHOLD_SCHEMA = StructType([
    StructField("domain", StringType()),
    StructField("warning_minutes", IntegerType()),
    StructField("critical_minutes", IntegerType()),
])


@dlt.table(
    name="gold_domain_freshness_watermark",
    comment=(
        "Per-canonical-domain freshness watermark: latest_replicated_at aggregated across "
        "all Silver contracts in the domain. Deterministic — no wall-clock. Age is computed "
        "at query time in vw_consumption_data_freshness."
    ),
    table_properties={"delta.enableChangeDataFeed": "false"},
    cluster_by=["domain"],
)
def gold_domain_freshness_watermark():
    """Aggregate silver watermarks to canonical domain level.

    Reads gold_data_freshness_status (which IS exempt, stamped at pipeline run time) but
    only extracts the latest_replicated_at column — no current_timestamp() call here.
    Result is deterministic for a given pipeline run snapshot.
    """
    spark = get_spark_session()

    freshness = dlt.read("gold_data_freshness_status")
    thresholds = spark.createDataFrame(_THRESHOLD_ROWS, _THRESHOLD_SCHEMA)

    # Map raw FRESHNESS_CONTRACTS domains to canonical domain keys.
    domain_mapping_rows = [
        (raw_domain, canonical)
        for raw_domain, canonical in _DOMAIN_MAP.items()
    ]
    domain_map_schema = StructType([
        StructField("raw_domain", StringType()),
        StructField("canonical_domain", StringType()),
    ])
    domain_map = spark.createDataFrame(domain_mapping_rows, domain_map_schema)

    return (
        freshness
        .join(F.broadcast(domain_map), freshness["domain"] == domain_map["raw_domain"], "left")
        .withColumn(
            "domain",
            F.coalesce(F.col("canonical_domain"), F.col("domain")),
        )
        .groupBy("domain")
        .agg(
            F.min("latest_replicated_at").alias("last_refresh_at"),
            F.count(F.lit(1)).cast("long").alias("source_table_count"),
        )
        .join(thresholds, "domain", "left")
        .select(
            "domain",
            "last_refresh_at",
            "source_table_count",
            F.coalesce(F.col("warning_minutes"), F.lit(480)).alias("warning_minutes"),
            F.coalesce(F.col("critical_minutes"), F.lit(1440)).alias("critical_minutes"),
        )
    )
