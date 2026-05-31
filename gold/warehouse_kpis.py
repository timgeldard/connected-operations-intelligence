"""
Lakeflow Spark Declarative Pipeline - Warehouse Gold KPIs.
"""

import dlt
from pyspark.sql import Column
from pyspark.sql import functions as F

from gold._shared import get_silver_schema, get_spark_session, gold_table_args


def _reversal_net_quantity() -> Column:
    return F.col("quantity") * F.when(F.col("is_reversal"), F.lit(-1.0)).otherwise(F.lit(1.0))


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
        (F.unix_timestamp("end_datetime") - F.unix_timestamp("start_datetime")) / 3600,
    )

    return (
        transfer_orders
        .withColumn("operator_user", F.coalesce(F.col("confirmed_by_user"), F.lit("UNKNOWN")))
        .withColumn("confirmation_cycle_hours", cycle_hours)
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
                F.avg(F.when(F.col("item_status") == "Fully Confirmed", F.lit(1.0)).otherwise(F.lit(0.0))),
                F.lit(0.0),
            ).alias("fully_confirmed_rate"),
            F.avg("confirmation_cycle_hours").alias("avg_confirmation_cycle_hours"),
            F.avg("actual_processing_time").alias("avg_processing_time"),
            F.max("processing_time_unit").alias("processing_time_unit"),
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
            "processing_time_unit",
        )
    )


@dlt.table(**gold_table_args(
    comment="Inbound, outbound, transfer, and adjustment throughput by plant, storage location, date, and movement family.",
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
        joined.groupBy("plant_code", "storage_location_code", "posting_date", "event_category")
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
            "event_category",
            "movement_line_count",
            "inbound_qty",
            "outbound_qty",
            "transfer_qty",
            "adjustment_qty",
            (F.col("inbound_qty") - F.col("outbound_qty")).alias("net_qty"),
        )
    )
