"""
Lakeflow Spark Declarative Pipeline - Warehouse Gold KPIs.
"""

import dlt
from pyspark.sql import Column
from pyspark.sql import functions as F

from gold._shared import get_silver_schema, get_spark_session, gold_table_args


def _reversal_net_quantity() -> Column:
    return F.col("quantity") * F.when(F.col("is_reversal"), F.lit(-1.0)).otherwise(F.lit(1.0))


def _processing_time_minutes() -> Column:
    return (
        F.when(F.col("processing_time_unit") == "SEC", F.col("actual_processing_time") / 60.0)
        .when(F.col("processing_time_unit") == "HR", F.col("actual_processing_time") * 60.0)
        .otherwise(F.col("actual_processing_time"))
    )


@dlt.table(**gold_table_args(
    comment="Transfer-order operator performance by warehouse, plant, date, and source storage type.",
    cluster_by=["plant_code", "confirmed_date"],
))
@dlt.expect("pick_accuracy bounded", "pick_accuracy IS NULL OR (pick_accuracy >= 0.0 AND pick_accuracy <= 2.0)")
@dlt.expect("fully_confirmed_rate bounded", "fully_confirmed_rate >= 0.0 AND fully_confirmed_rate <= 1.0")
def gold_transfer_order_performance():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    transfer_orders = spark.read.table(f"{silver_schema}.warehouse_transfer_order")

    cycle_hours = F.when(
        F.col("start_datetime").isNotNull() & F.col("end_datetime").isNotNull(),
        F.greatest(
            (F.unix_timestamp("end_datetime") - F.unix_timestamp("start_datetime")) / 3600,
            F.lit(0.0),
        ),
    )

    return (
        transfer_orders
        .withColumn("operator_user", F.coalesce(F.col("confirmed_by_user"), F.lit("UNKNOWN")))
        .withColumn("confirmation_cycle_hours", cycle_hours)
        .withColumn("processing_time_minutes", _processing_time_minutes())
        .groupBy(
            "warehouse_number",
            "plant_code",
            "operator_user",
            "confirmed_date",
            "source_storage_type",
        )
        .agg(
            F.count(F.lit(1)).alias("to_item_count"),
            F.coalesce(F.sum("confirmed_quantity"), F.lit(0.0)).alias("confirmed_qty"),
            F.coalesce(F.sum("requested_quantity"), F.lit(0.0)).alias("requested_qty"),
            F.coalesce(F.sum("actual_quantity_picked"), F.lit(0.0)).alias("picked_qty"),
            F.coalesce(
                F.avg(
                    F.when(F.col("item_status") == "Fully Confirmed", F.lit(1.0))
                    .when(F.col("item_status") == "Partially Confirmed", F.lit(0.0))
                ),
                F.lit(0.0),
            ).alias("fully_confirmed_rate"),
            F.avg("confirmation_cycle_hours").alias("avg_confirmation_cycle_hours"),
            F.avg("processing_time_minutes").alias("avg_processing_time"),
        )
        .select(
            "warehouse_number",
            "plant_code",
            F.col("operator_user").alias("confirmed_by_user"),
            "confirmed_date",
            "source_storage_type",
            "to_item_count",
            "confirmed_qty",
            "requested_qty",
            "picked_qty",
            F.when(F.col("confirmed_qty") != 0, F.col("picked_qty") / F.col("confirmed_qty"))
            .otherwise(F.lit(None).cast("double"))
            .alias("pick_accuracy"),
            "fully_confirmed_rate",
            "avg_confirmation_cycle_hours",
            "avg_processing_time",
            F.lit("MIN").alias("processing_time_unit"),
        )
    )


@dlt.table(**gold_table_args(
    comment="Inbound, outbound, transfer, and adjustment throughput by plant, storage location, and date.",
    cluster_by=["plant_code", "posting_date"],
))
def gold_inbound_outbound_throughput():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    goods_movements = spark.read.table(f"{silver_schema}.goods_movement")
    classification = spark.read.table(f"{silver_schema}.movement_type_classification")

    joined = goods_movements.join(classification, "movement_type_code", "inner")
    reversal_net_qty = _reversal_net_quantity()

    return (
        joined.groupBy("plant_code", "storage_location_code", "posting_date")
        .agg(
            F.count(F.lit(1)).alias("movement_line_count"),
            F.coalesce(
                F.sum(F.when(F.col("is_goods_receipt"), reversal_net_qty).otherwise(F.lit(0.0))),
                F.lit(0.0),
            ).alias("inbound_qty"),
            F.coalesce(
                F.sum(F.when(F.col("is_goods_issue"), reversal_net_qty).otherwise(F.lit(0.0))),
                F.lit(0.0),
            ).alias("outbound_qty"),
            F.coalesce(
                F.sum(F.when(F.col("is_transfer"), reversal_net_qty).otherwise(F.lit(0.0))),
                F.lit(0.0),
            ).alias("transfer_qty"),
            F.coalesce(
                F.sum(
                    F.when(F.col("is_stock_write_on"), reversal_net_qty)
                    .when(F.col("is_stock_write_off"), -reversal_net_qty)
                    .otherwise(F.lit(0.0))
                ),
                F.lit(0.0),
            ).alias("adjustment_qty"),
        )
        .select(
            "plant_code",
            "storage_location_code",
            "posting_date",
            "movement_line_count",
            "inbound_qty",
            "outbound_qty",
            "transfer_qty",
            "adjustment_qty",
            (F.col("inbound_qty") - F.col("outbound_qty")).alias("net_qty"),
        )
    )


@dlt.table(**gold_table_args(
    comment="Current warehouse bin occupancy by warehouse, plant, storage type, and bin type.",
    cluster_by=["plant_code", "warehouse_number"],
))
@dlt.expect("occupancy_rate bounded", "occupancy_rate >= 0.0 AND occupancy_rate <= 1.0")
def gold_bin_occupancy():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    storage_bins = spark.read.table(f"{silver_schema}.storage_bin")

    return (
        storage_bins
        .groupBy("warehouse_number", "plant_code", "storage_type", "bin_type")
        .agg(
            F.count(F.lit(1)).alias("bin_record_count"),
            F.sum(F.when(F.col("quant_number").isNotNull(), F.lit(1)).otherwise(F.lit(0))).alias(
                "occupied_bin_count"
            ),
            F.sum(F.when(F.col("quant_number").isNull(), F.lit(1)).otherwise(F.lit(0))).alias(
                "empty_bin_count"
            ),
            F.sum(F.when(F.col("is_blocked"), F.lit(1)).otherwise(F.lit(0))).alias(
                "blocked_bin_count"
            ),
            F.sum(
                F.when(F.col("is_blocked_for_stock_removal"), F.lit(1)).otherwise(F.lit(0))
            ).alias("stock_removal_blocked_bin_count"),
            F.sum(F.when(F.col("is_blocked_for_putaway"), F.lit(1)).otherwise(F.lit(0))).alias(
                "putaway_blocked_bin_count"
            ),
            F.coalesce(F.sum("total_quantity"), F.lit(0.0)).alias("total_stock_qty"),
            F.coalesce(F.sum("available_quantity"), F.lit(0.0)).alias("available_stock_qty"),
            F.coalesce(F.sum("open_transfer_quantity"), F.lit(0.0)).alias(
                "open_transfer_stock_qty"
            ),
        )
        .select(
            "warehouse_number",
            "plant_code",
            "storage_type",
            "bin_type",
            "bin_record_count",
            "occupied_bin_count",
            "empty_bin_count",
            "blocked_bin_count",
            "stock_removal_blocked_bin_count",
            "putaway_blocked_bin_count",
            F.when(
                F.col("bin_record_count") > 0,
                F.col("occupied_bin_count") / F.col("bin_record_count"),
            ).otherwise(F.lit(0.0)).alias("occupancy_rate"),
            "total_stock_qty",
            "available_stock_qty",
            "open_transfer_stock_qty",
        )
    )


@dlt.table(**gold_table_args(
    comment="Current stock availability by plant, storage location, material, batch, and base UOM.",
    cluster_by=["plant_code", "storage_location_code"],
))
def gold_stock_availability():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    batch_stock = spark.read.table(f"{silver_schema}.batch_stock")

    return (
        batch_stock
        .groupBy("plant_code", "storage_location_code", "material_code", "batch_number", "base_uom")
        .agg(
            F.coalesce(F.sum("unrestricted_quantity"), F.lit(0.0)).alias("unrestricted_qty"),
            F.coalesce(F.sum("quality_inspection_quantity"), F.lit(0.0)).alias(
                "quality_inspection_qty"
            ),
            F.coalesce(F.sum("blocked_quantity"), F.lit(0.0)).alias("blocked_qty"),
            F.coalesce(F.sum("restricted_use_quantity"), F.lit(0.0)).alias("restricted_use_qty"),
            F.coalesce(F.sum("in_transfer_quantity"), F.lit(0.0)).alias("in_transfer_qty"),
            F.coalesce(F.sum("blocked_returns_quantity"), F.lit(0.0)).alias(
                "blocked_returns_qty"
            ),
        )
        .select(
            "plant_code",
            "storage_location_code",
            "material_code",
            "batch_number",
            "base_uom",
            "unrestricted_qty",
            "quality_inspection_qty",
            "blocked_qty",
            "restricted_use_qty",
            "in_transfer_qty",
            "blocked_returns_qty",
            F.col("unrestricted_qty").alias("available_qty"),
            (
                F.col("quality_inspection_qty")
                + F.col("blocked_qty")
                + F.col("restricted_use_qty")
                + F.col("blocked_returns_qty")
            ).alias("unavailable_qty"),
            (
                F.col("unrestricted_qty")
                + F.col("quality_inspection_qty")
                + F.col("blocked_qty")
                + F.col("restricted_use_qty")
                + F.col("in_transfer_qty")
                + F.col("blocked_returns_qty")
            ).alias("total_stock_qty"),
        )
    )


@dlt.table(**gold_table_args(
    comment="Current open transfer-requirement backlog by warehouse, plant, queue, and source/destination storage.",
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_transfer_requirement_backlog():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    transfer_requirements = spark.read.table(f"{silver_schema}.warehouse_transfer_requirement")

    open_requirements = transfer_requirements.filter(
        (~F.coalesce(F.col("is_processing_complete"), F.lit(False)))
        & (F.coalesce(F.col("open_quantity"), F.lit(0.0)) > 0)
    )

    return (
        open_requirements
        .groupBy(
            "warehouse_number",
            "plant_code",
            "source_storage_type",
            "destination_storage_type",
            "queue",
            "transfer_priority",
        )
        .agg(
            F.count(F.lit(1)).alias("backlog_item_count"),
            F.coalesce(F.sum("open_quantity"), F.lit(0.0)).alias("open_qty"),
            F.coalesce(F.sum("required_quantity"), F.lit(0.0)).alias("required_qty"),
            F.min("created_datetime").alias("oldest_created_datetime"),
            F.min("planned_execution_datetime").alias("oldest_planned_execution_datetime"),
        )
        .select(
            "warehouse_number",
            "plant_code",
            "source_storage_type",
            "destination_storage_type",
            "queue",
            "transfer_priority",
            "backlog_item_count",
            "open_qty",
            "required_qty",
            F.when(F.col("required_qty") > 0, F.col("open_qty") / F.col("required_qty"))
            .otherwise(F.lit(None).cast("double"))
            .alias("open_quantity_rate"),
            "oldest_created_datetime",
            "oldest_planned_execution_datetime",
        )
    )
