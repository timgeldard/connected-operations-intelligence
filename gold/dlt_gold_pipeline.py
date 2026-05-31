"""
Lakeflow Spark Declarative Pipeline — Gold Layer

Deployed via DAB bundle: databricks.yml / resources/gold_pipeline.pipeline.yml
  target catalog  : controlled by var.catalog
  target schema   : controlled by var.gold_schema
  silver catalog  : spark.conf silver_catalog
  silver schema   : spark.conf silver_schema
  pipeline mode   : Triggered
"""

import dlt
from pyspark.sql import SparkSession
from pyspark.sql import functions as F


def get_spark_session() -> SparkSession:
    return SparkSession.builder.getOrCreate()

def get_silver_schema(spark: SparkSession) -> str:
    try:
        catalog = spark.conf.get('silver_catalog')
        schema = spark.conf.get('silver_schema', 'silver')
        # Local Spark (spark_catalog) requires single-part namespace (database.table)
        if catalog and catalog != "spark_catalog":
            return f"{catalog}.{schema}"
        return schema
    except Exception:
        # Local/manual fallback default only (points to production)
        return "connected_plant_prod.silver"

# ── Dynamic Row Filter Security & Test Detection ──────────────────────────────
try:
    spark = get_spark_session()
    SILVER_CATALOG = spark.conf.get('silver_catalog', 'connected_plant_prod')
    SILVER_SCHEMA = spark.conf.get('silver_schema', 'silver')
    ROW_FILTER_FN = f"{SILVER_CATALOG}.{SILVER_SCHEMA}.plant_access_filter"
    # Gold runs as a trusted aggregate layer. Plant security is enforced on direct
    # Silver consumption; applying row filters here would force full MV refreshes.
    APPLY_ROW_FILTER = spark.conf.get("gold_apply_row_filter", "false").lower() == "true"
except Exception:
    # Local/manual fallback default only (points to production)
    ROW_FILTER_FN = "connected_plant_prod.silver.plant_access_filter"
    APPLY_ROW_FILTER = False

def gold_table_args(comment: str, cluster_by: list) -> dict:
    """Return common decorator arguments, applying the row filter if configured."""
    args = {
        "comment": comment,
        "table_properties": {"delta.enableChangeDataFeed": "true"},
        "cluster_by": cluster_by
    }
    if APPLY_ROW_FILTER:
        args["row_filter"] = f"ROW FILTER {ROW_FILTER_FN} ON (plant_code)"
    return args

# ─────────────────────────────────────────────────────────────────────────────
# ── Gold Tables ──────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Daily production output summary. Aggregates quantity and scrap by posting date and plant.",
    cluster_by=["plant_code", "posting_date"]
))
@dlt.expect("produced_quantity non-negative", "produced_quantity >= 0.0")
@dlt.expect("scrap_quantity non-negative",    "scrap_quantity >= 0.0")
def gold_shift_output_summary():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    # Read from Silver layer
    goods_mov = spark.read.table(f"{silver_schema}.goods_movement")
    classification = spark.read.table(f"{silver_schema}.movement_type_classification")

    # Join with conformed classification metadata to decouple hardcoded SAP codes
    joined_movs = goods_mov.join(classification, "movement_type_code", "inner")

    # Aggregate output quantities based on semantic categories (receipts minus reversals)
    return (
        joined_movs.groupBy("plant_code", "posting_date", "material_code", "base_uom")
        .agg(
            F.sum(
                F.when(F.col("is_production_receipt"), F.col("quantity"))
                .when(F.col("is_receipt_reversal"), -F.col("quantity"))
                .otherwise(0.0)
            ).alias("produced_quantity"),
            F.sum(
                F.when(F.col("is_scrap"), F.col("quantity"))
                .when(F.col("is_scrap_reversal"), -F.col("quantity"))
                .otherwise(0.0)
            ).alias("scrap_quantity")
        )
    )

@dlt.table(**gold_table_args(
    comment="Production order schedule-adherence metrics comparing scheduled vs actual completions.",
    cluster_by=["plant_code", "actual_finish_date"]
))
@dlt.expect("order_quantity non-negative", "order_quantity >= 0.0")
def gold_order_otif_metrics():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    orders = spark.read.table(f"{silver_schema}.process_order")

    # Filter completed or closed orders
    completed_orders = orders.filter("is_completed = true OR is_closed = true")

    return (
        completed_orders.select(
            "order_number",
            "plant_code",
            "material_code",
            "order_quantity",
            "confirmed_yield_quantity",
            "scheduled_finish_date",
            "actual_finish_date",
            # Null-safe Date/OTIF comparisons
            F.when(
                F.col("actual_finish_date").isNull() | F.col("scheduled_finish_date").isNull(),
                F.lit(None)
            ).when(
                F.col("actual_finish_date") <= F.col("scheduled_finish_date"),
                F.lit(1)
            ).otherwise(F.lit(0)).alias("is_on_time"),
            F.when(
                F.col("confirmed_yield_quantity").isNull() | F.col("order_quantity").isNull(),
                F.lit(None)
            ).when(
                F.col("confirmed_yield_quantity") >= F.col("order_quantity"),
                F.lit(1)
            ).otherwise(F.lit(0)).alias("is_in_full")
        )
    )

@dlt.table(**gold_table_args(
    comment="Plant-level production quality & downtime summary.",
    cluster_by=["plant_code"]
))
@dlt.expect("quality_rate valid range", "quality_rate >= 0.0 AND quality_rate <= 1.0")
def gold_plant_production_quality_summary():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    orders = spark.read.table(f"{silver_schema}.process_order")
    downtime = spark.read.table(f"{silver_schema}.downtime_event")

    # Sum of downtime hours per plant
    plant_downtime = (
        downtime.groupBy("plant_code")
        .agg(F.coalesce(F.sum("duration_minutes"), F.lit(0.0)).alias("total_downtime_minutes"))
    )

    # Sum of process orders quantities and yield - coalesce sums to prevent NULL propagation
    plant_production = (
        orders.groupBy("plant_code")
        .agg(
            F.coalesce(F.sum("order_quantity"), F.lit(0.0)).alias("total_ordered_qty"),
            F.coalesce(F.sum("confirmed_yield_quantity"), F.lit(0.0)).alias("total_yield_qty"),
            F.coalesce(F.sum("total_scrap_quantity"), F.lit(0.0)).alias("total_scrap_qty")
        )
    )

    return (
        plant_production.join(plant_downtime, "plant_code", "left")
        .select(
            "plant_code",
            "total_ordered_qty",
            "total_yield_qty",
            "total_scrap_qty",
            F.coalesce(F.col("total_downtime_minutes"), F.lit(0.0)).alias("total_downtime_minutes"),
            # Yield rate calculation
            F.when(
                F.col("total_yield_qty") + F.col("total_scrap_qty") > 0,
                F.col("total_yield_qty") / (F.col("total_yield_qty") + F.col("total_scrap_qty"))
            ).otherwise(F.lit(None).cast("double")).alias("quality_rate")
        )
    )
