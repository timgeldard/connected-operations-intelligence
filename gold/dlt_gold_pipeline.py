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
from pyspark.sql import functions as F

from gold._shared import get_silver_schema, get_spark_session, gold_table_args

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

    # Join with conformed classification metadata to decouple hardcoded SAP codes (broadcast-optimized)
    joined_movs = goods_mov.join(F.broadcast(classification), "movement_type_code", "inner")

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
@dlt.expect("fill_rate non-negative", "fill_rate IS NULL OR fill_rate >= 0.0")
@dlt.expect("scrap_rate bounded", "scrap_rate IS NULL OR (scrap_rate >= 0.0 AND scrap_rate <= 1.0)")
def gold_process_order_schedule_adherence():
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
            # Null-safe schedule-adherence comparisons
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
            ).otherwise(F.lit(0)).alias("is_in_full"),
            # Start-date adherence
            F.when(
                F.col("actual_start_date").isNull() | F.col("scheduled_start_date").isNull(),
                F.lit(None)
            ).when(
                F.col("actual_start_date") <= F.col("scheduled_start_date"),
                F.lit(1)
            ).otherwise(F.lit(0)).alias("is_started_on_time"),
            # Fill rate (ratio, not just flag)
            F.when(
                F.col("order_quantity").isNull() | (F.col("order_quantity") == 0),
                F.lit(None).cast("double")
            ).otherwise(
                F.col("confirmed_yield_quantity") / F.col("order_quantity")
            ).alias("fill_rate"),
            # Scrap rate
            F.when(
                F.col("order_quantity").isNull() | (F.col("order_quantity") == 0),
                F.lit(None).cast("double")
            ).otherwise(
                F.coalesce(F.col("total_scrap_quantity"), F.lit(0.0)) / F.col("order_quantity")
            ).alias("scrap_rate"),
            # Production line
            "production_line",
            "production_line_description"
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


@dlt.table(**gold_table_args(
    comment="Operations Overview of process orders including schedule, confirmations, PI sheet, and downtime at operation grain.",
    cluster_by=["plant_code", "scheduled_start_datetime"]
))
@dlt.expect("scheduled dates ordered",
    "scheduled_start_datetime <= scheduled_finish_datetime "
    "OR scheduled_start_datetime IS NULL OR scheduled_finish_datetime IS NULL")
@dlt.expect("pi_sheet duration non-negative",
    "pi_sheet_duration_hours IS NULL OR pi_sheet_duration_hours >= 0.0")
@dlt.expect("downtime non-negative",
    "total_downtime_minutes >= 0.0")
def gold_process_order_operations():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    operations = spark.read.table(f"{silver_schema}.process_order_operation")
    pi_sheets = spark.read.table(f"{silver_schema}.pi_sheet_execution")
    downtimes = spark.read.table(f"{silver_schema}.downtime_event")
    orders = spark.read.table(f"{silver_schema}.process_order")

    active_orders = orders.filter("is_released = true and is_closed = false").select(
        F.col("order_number").alias("order_number_ref"),
        F.col("material_code").alias("order_material_code"),
        F.col("scheduled_start_date").alias("order_scheduled_start_date"),
        "is_released",
        "is_closed"
    )

    op_downtime = downtimes.groupBy("order_number", "operation_number").agg(
        F.coalesce(F.sum("duration_minutes"), F.lit(0.0)).alias("total_downtime_minutes")
    )

    # Subset pi_sheets to avoid duplicate plant_code / metadata columns
    pi_sheets_subset = pi_sheets.select(
        "order_number", "operation_number", "pi_sheet_status", "duration_hours"
    )

    joined_ops = operations.join(
        active_orders,
        operations.order_number == active_orders.order_number_ref,
        "inner"
    )

    joined_pi = joined_ops.join(
        pi_sheets_subset,
        ["order_number", "operation_number"],
        "left"
    )

    return (
        joined_pi.join(
            op_downtime,
            ["order_number", "operation_number"],
            "left"
        )
        .select(
            "order_number",
            "operation_number",
            "plant_code",
            F.col("order_material_code").alias("material_code"),
            F.col("order_scheduled_start_date").alias("scheduled_start_date"),
            "scheduled_start_datetime",
            "scheduled_finish_datetime",
            "actual_start_datetime",
            "actual_finish_date",
            "work_centre_internal_id",
            "planned_work",
            "actual_work",
            "is_confirmed",
            "confirmed_yield_quantity",
            "confirmed_scrap_quantity",
            "control_key",
            "number_of_employees",
            F.coalesce(F.col("pi_sheet_status"), F.lit("No PI Sheet")).alias("pi_sheet_status"),
            F.col("duration_hours").alias("pi_sheet_duration_hours"),
            F.coalesce(F.col("total_downtime_minutes"), F.lit(0.0)).alias("total_downtime_minutes"),
            (F.col("is_released") & ~F.col("is_closed")).alias("is_operationally_active")
        )
    )


@dlt.table(**gold_table_args(
    comment="Downtime events rolled to order × operation × reason grain with order context.",
    cluster_by=["plant_code", "order_number"],
))
@dlt.expect("total_downtime_minutes non-negative", "total_downtime_minutes >= 0.0")
@dlt.expect("has_recorded_duration", "total_downtime_minutes > 0.0")
def gold_order_downtime_summary():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    downtimes = spark.read.table(f"{silver_schema}.downtime_event")
    orders = spark.read.table(f"{silver_schema}.process_order").select(
        "order_number", "material_code", "scheduled_start_date", "production_line_description"
    )
    return (
        downtimes
        .groupBy(
            "plant_code", "order_number", "operation_number",
            "work_centre_code", "downtime_reason_code",
            "downtime_reason_description", "sub_reason_code", "sub_reason_description",
        )
        .agg(
            F.count(F.lit(1)).alias("event_count"),
            F.coalesce(F.sum("duration_minutes"), F.lit(0.0)).alias("total_downtime_minutes"),
            F.min("start_datetime").alias("earliest_start_datetime"),
            F.max("end_datetime").alias("latest_end_datetime"),
        )
        .join(orders, "order_number", "left")
        .select(
            "plant_code", "order_number", "material_code",
            "production_line_description", "scheduled_start_date",
            "operation_number", "work_centre_code",
            "downtime_reason_code", "downtime_reason_description",
            "sub_reason_code", "sub_reason_description",
            "event_count", "total_downtime_minutes",
            "earliest_start_datetime", "latest_end_datetime",
        )
    )


@dlt.table(**gold_table_args(
    comment="Per-component reservation status for active process orders with available stock coverage.",
    cluster_by=["plant_code", "order_number"],
))
@dlt.expect("open_quantity non-negative", "open_quantity IS NULL OR open_quantity >= 0.0")
@dlt.expect("required_quantity non-negative", "required_quantity IS NULL OR required_quantity >= 0.0")
def gold_process_order_component_status():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    reservations = spark.read.table(f"{silver_schema}.reservation_requirement")
    orders = spark.read.table(f"{silver_schema}.process_order").select(
        "order_number", "plant_code", "scheduled_start_date",
        "is_released", "is_closed", "production_line_description",
        F.col("material_code").alias("order_material_code"),
    )
    # Aggregate available stock to plant × material grain (broadcast-safe: small relative to reservations)
    stock = (
        spark.read.table(f"{silver_schema}.batch_stock")
        .groupBy("plant_code", "material_code")
        .agg(F.coalesce(F.sum("unrestricted_quantity"), F.lit(0.0)).alias("available_unrestricted_qty"))
    )

    open_components = reservations.filter(
        (~F.coalesce(F.col("is_deletion_flagged"), F.lit(False)))
        & (F.coalesce(F.col("open_quantity"), F.lit(0.0)) > 0)
        & (F.col("movement_type_code") == "261")   # PP-PI consumption
    ).select(
        "order_number", "material_code", "reservation_item", "reservation_number",
        "required_quantity", "open_quantity", "requirement_date", "production_supply_area"
    )

    return (
        open_components
        .join(orders, "order_number", "inner")        # inner — only components for known active orders
        .join(F.broadcast(stock), ["plant_code", "material_code"], "left")
        .select(
            "order_number", "plant_code", "material_code", "order_material_code",
            "production_line_description", "scheduled_start_date",
            "is_released", "is_closed",
            F.col("reservation_item").alias("reservation_item_number"),
            "reservation_number",
            "required_quantity", "open_quantity", "requirement_date",
            "production_supply_area",
            F.coalesce(F.col("available_unrestricted_qty"), F.lit(0.0)).alias("available_unrestricted_qty"),
            F.when(
                F.col("open_quantity").isNull(), F.lit(None).cast("boolean")
            ).otherwise(
                F.coalesce(F.col("available_unrestricted_qty"), F.lit(0.0)) >= F.col("open_quantity")
            ).alias("is_fully_covered"),
        )
    )


@dlt.view(
    name="gold_freshness_gate",
    comment="Validation view to enforce freshness guarantees. Checks the max lag of silver.goods_movement."
)
@dlt.expect_or_fail("data_is_fresh", "max_lag_minutes <= 120 OR max_lag_minutes IS NULL")
def gold_freshness_gate():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    catalog = spark.conf.get("silver_catalog", None)

    # If in local test mode, return a dummy DataFrame to bypass real-time checks
    if catalog == "spark_catalog":
        return spark.range(1).select(F.lit(0.0).alias("max_lag_minutes"))

    # Optimize: restrict the scan to recent postings (last 14 days) to leverage partition pruning/Liquid clustering
    goods_mov = spark.read.table(f"{silver_schema}.goods_movement").filter(
        F.col("posting_date") >= F.date_sub(F.current_date(), 14)
    )
    return (
        goods_mov.agg(
            F.max("_replicated_at").alias("latest_replication_time")
        )
        .withColumn("current_time", F.current_timestamp())
        .withColumn(
            "max_lag_minutes",
            (F.unix_timestamp("current_time") - F.unix_timestamp("latest_replication_time")) / 60
        )
    )
