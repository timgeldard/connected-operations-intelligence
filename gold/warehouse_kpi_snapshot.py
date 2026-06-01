"""
Lakeflow Spark Declarative Pipeline — Warehouse KPI Snapshot Gold.

gold_warehouse_kpi_snapshot: one row per plant summarising the live operational
state (open orders, transfer requirements/orders, deliveries, inbound, bins).
Multi-plant (the prototype was a single-row, single-plant scorecard).
"""

from functools import reduce

import dlt
from pyspark.sql import functions as F

from gold._shared import get_silver_schema, get_spark_session, gold_table_args


@dlt.table(**gold_table_args(
    comment="Per-plant warehouse operations scorecard (open orders, TRs, TOs, deliveries, inbound, bins).",
    cluster_by=["plant_code"],
))
def gold_warehouse_kpi_snapshot():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    process_order = spark.read.table(f"{silver_schema}.process_order")
    transfer_requirement = spark.read.table(f"{silver_schema}.warehouse_transfer_requirement")
    transfer_order = spark.read.table(f"{silver_schema}.warehouse_transfer_order")
    outbound_delivery = spark.read.table(f"{silver_schema}.outbound_delivery")
    purchase_order = spark.read.table(f"{silver_schema}.purchase_order")
    storage_bin = spark.read.table(f"{silver_schema}.storage_bin")

    orders = (
        process_order.filter(
            F.coalesce(F.col("is_released"), F.lit(False))
            & (~F.coalesce(F.col("is_closed"), F.lit(False)))
        )
        .groupBy("plant_code")
        .agg(F.count(F.lit(1)).alias("active_order_count"))
    )

    trs = (
        transfer_requirement.filter(
            (~F.coalesce(F.col("is_processing_complete"), F.lit(False)))
            & (F.coalesce(F.col("open_quantity"), F.lit(0.0)) > 0)
        )
        .groupBy("plant_code")
        .agg(F.count(F.lit(1)).alias("open_tr_item_count"))
    )

    tos = (
        transfer_order.filter(F.col("item_status") != "Fully Confirmed")
        .groupBy("plant_code")
        .agg(F.count(F.lit(1)).alias("open_to_item_count"))
    )

    deliveries = (
        outbound_delivery.filter(F.col("actual_goods_issue_date").isNull())
        .groupBy("plant_code")
        .agg(F.count_distinct("delivery_number").alias("open_delivery_count"))
    )

    inbound = (
        purchase_order.filter(
            (~F.coalesce(F.col("is_delivery_complete"), F.lit(False)))
            & (~F.coalesce(F.col("is_item_deleted"), F.lit(False)))
        )
        .groupBy("plant_code")
        .agg(F.count(F.lit(1)).alias("open_inbound_item_count"))
    )

    # struct (not concat_ws) so distinct-bin counting can't collide on a separator char.
    bin_key = F.struct("warehouse_number", "storage_type", "bin_code")
    bins = storage_bin.groupBy("plant_code").agg(
        F.count_distinct(bin_key).alias("total_bin_count"),
        F.count_distinct(F.when(F.col("quant_number").isNotNull(), bin_key)).alias("occupied_bin_count"),
        F.count_distinct(F.when(F.col("is_blocked"), bin_key)).alias("blocked_bin_count"),
    )

    frames = [orders, trs, tos, deliveries, inbound, bins]
    snapshot = reduce(lambda a, b: a.join(b, "plant_code", "full"), frames)

    count_cols = [
        "active_order_count", "open_tr_item_count", "open_to_item_count",
        "open_delivery_count", "open_inbound_item_count",
        "total_bin_count", "occupied_bin_count", "blocked_bin_count",
    ]
    for c in count_cols:
        snapshot = snapshot.withColumn(c, F.coalesce(F.col(c), F.lit(0)))

    return snapshot.withColumn(
        "bin_utilisation_pct",
        F.when(
            F.col("total_bin_count") > 0,
            F.round(F.col("occupied_bin_count") / F.col("total_bin_count") * 100, 1),
        ).otherwise(F.lit(0.0)),
    ).withColumn("snapshot_date", F.current_date())
