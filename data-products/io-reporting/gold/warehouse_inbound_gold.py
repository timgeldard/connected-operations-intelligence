"""
Lakeflow Spark Declarative Pipeline — Inbound & Handling-Unit Gold.

Tables:
  gold_inbound_po_backlog    — open purchase-order backlog (awaiting goods receipt) by plant/vendor
  gold_inbound_po_backlog_enhanced — open PO backlog with PO-linked GR and putaway evidence
  gold_handling_unit_summary — handling-unit (SSCC) counts by plant/warehouse/status
"""

import dlt
from pyspark.sql import functions as F

from gold._shared import (
    anti_join_optional_deleted_headers,
    get_silver_schema,
    get_spark_session,
    gold_table_args,
    hu_reconciliation_enabled,
)

# ── 1. INBOUND PO BACKLOG ─────────────────────────────────────────────────────
# NOTE: this is open purchase-order *backlog* (PO items not yet flagged
# delivery-complete), NOT true goods-receipt status. It does not consult GR history
# (EKBE / MSEG 101), inbound deliveries/ASNs, or remaining-vs-received quantity. For a
# real GR-status / due-quantity model, enrich with GR history; until then the name
# reflects what it measures. See gold/design_spec.md "Pilot-grade / directional".

@dlt.table(**gold_table_args(
    comment="Open inbound purchase-order backlog (PO items awaiting goods receipt) by plant and "
            "vendor. Backlog only — does NOT use GR history / remaining quantity (see design_spec).",
    cluster_by=["plant_code", "vendor_code"],
))
@dlt.expect("open value non-negative", "total_open_value >= 0.0")
def gold_inbound_po_backlog():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    purchase_orders = anti_join_optional_deleted_headers(
        spark.read.table(f"{silver_schema}.purchase_order"),
        silver_schema,
        "purchase_order_header_delete",
        ["purchase_order_number"],
    )

    open_items = purchase_orders.filter(
        (~F.coalesce(F.col("is_delivery_complete"), F.lit(False)))
        & (~F.coalesce(F.col("is_item_deleted"), F.lit(False)))
    )

    return (
        open_items.groupBy("plant_code", "vendor_code", "purchasing_org")
        .agg(
            F.count(F.lit(1)).alias("open_item_count"),
            F.count_distinct("purchase_order_number").alias("open_po_count"),
            F.coalesce(F.sum("ordered_quantity"), F.lit(0.0)).alias("total_ordered_qty"),
            F.coalesce(F.sum("net_value"), F.lit(0.0)).alias("total_open_value"),
            F.min("purchase_order_date").alias("earliest_po_date"),
            F.sum(F.when(F.col("qa_stock_type") == "Q", F.lit(1)).otherwise(F.lit(0))).alias(
                "qa_inspection_item_count"
            ),
        )
    )


# ── 1b. INBOUND PO BACKLOG ENHANCED ───────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Enhanced open inbound purchase-order backlog by plant and vendor, including PO-linked "
        "103/104 goods-receipt quantity, remaining open quantity, putaway TO evidence, and age anchors."
    ),
    cluster_by=["plant_code", "vendor_code"],
))
@dlt.expect("ordered quantity non-negative", "total_ordered_qty >= 0.0")
@dlt.expect("receipt quantity non-negative", "total_gr_qty >= 0.0")
@dlt.expect("remaining quantity non-negative", "remaining_open_qty >= 0.0")
def gold_inbound_po_backlog_enhanced():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    purchase_orders = anti_join_optional_deleted_headers(
        spark.read.table(f"{silver_schema}.purchase_order"),
        silver_schema,
        "purchase_order_header_delete",
        ["purchase_order_number"],
    )
    goods_movements = spark.read.table(f"{silver_schema}.goods_movement")
    classification = spark.read.table(f"{silver_schema}.movement_type_classification").select(
        "movement_type_code", "is_po_receipt", "is_po_receipt_reversal"
    )
    transfer_orders = anti_join_optional_deleted_headers(
        spark.read.table(f"{silver_schema}.warehouse_transfer_order"),
        silver_schema,
        "warehouse_transfer_order_header_delete",
        ["warehouse_number", "transfer_order_number"],
    )

    group_cols = ["plant_code", "vendor_code", "purchasing_org"]

    open_items = purchase_orders.filter(
        (~F.coalesce(F.col("is_delivery_complete"), F.lit(False)))
        & (~F.coalesce(F.col("is_item_deleted"), F.lit(False)))
    )

    gr_by_item = (
        goods_movements
        .join(F.broadcast(classification), "movement_type_code", "inner")
        .filter(
            F.col("purchase_order_number").isNotNull()
            & F.col("purchase_order_item").isNotNull()
            & (
                F.coalesce(F.col("is_po_receipt"), F.lit(False))
                | F.coalesce(F.col("is_po_receipt_reversal"), F.lit(False))
            )
        )
        .groupBy("purchase_order_number", "purchase_order_item")
        .agg(
            F.coalesce(
                F.sum(
                    F.when(F.col("is_po_receipt"), F.col("quantity"))
                    .when(F.col("is_po_receipt_reversal"), -F.col("quantity"))
                    .otherwise(F.lit(0.0))
                ),
                F.lit(0.0),
            ).alias("gr_quantity"),
            F.max("posting_date").alias("latest_gr_posting_date"),
        )
    )

    item_summary = (
        open_items
        .join(
            gr_by_item,
            (open_items.purchase_order_number == gr_by_item.purchase_order_number)
            & (open_items.item_number == gr_by_item.purchase_order_item),
            "left",
        )
        .drop(gr_by_item.purchase_order_number)
        .withColumn("gr_quantity", F.coalesce(F.col("gr_quantity"), F.lit(0.0)))
        .withColumn(
            "remaining_item_qty",
            F.greatest(F.coalesce(F.col("ordered_quantity"), F.lit(0.0)) - F.col("gr_quantity"), F.lit(0.0)),
        )
        .groupBy(*group_cols)
        .agg(
            F.count(F.lit(1)).alias("open_item_count"),
            F.count_distinct("purchase_order_number").alias("open_po_count"),
            F.coalesce(F.sum("ordered_quantity"), F.lit(0.0)).alias("total_ordered_qty"),
            F.coalesce(F.sum("gr_quantity"), F.lit(0.0)).alias("total_gr_qty"),
            F.coalesce(F.sum("remaining_item_qty"), F.lit(0.0)).alias("remaining_open_qty"),
            F.coalesce(F.sum("net_value"), F.lit(0.0)).alias("total_open_value"),
            F.min("purchase_order_date").alias("earliest_po_date"),
            F.max("latest_gr_posting_date").alias("latest_gr_posting_date"),
            F.sum(F.when(F.col("gr_quantity") <= 0, F.lit(1)).otherwise(F.lit(0))).alias(
                "item_without_gr_count"
            ),
            F.sum(
                F.when(
                    (F.col("gr_quantity") > 0)
                    & (F.col("gr_quantity") < F.coalesce(F.col("ordered_quantity"), F.lit(0.0))),
                    F.lit(1),
                ).otherwise(F.lit(0))
            ).alias("partial_gr_item_count"),
            F.sum(
                F.when(
                    F.col("gr_quantity") >= F.coalesce(F.col("ordered_quantity"), F.lit(0.0)),
                    F.lit(1),
                ).otherwise(F.lit(0))
            ).alias("fully_gr_item_count"),
            F.sum(F.when(F.col("qa_stock_type") == "Q", F.lit(1)).otherwise(F.lit(0))).alias(
                "qa_inspection_item_count"
            ),
        )
    )

    po_group_keys = open_items.select(*group_cols, "purchase_order_number").distinct()
    putaway_summary = (
        po_group_keys
        .join(
            transfer_orders,
            (po_group_keys.purchase_order_number == transfer_orders.source_reference_number)
            & (po_group_keys.plant_code == transfer_orders.plant_code),
            "left",
        )
        .groupBy(*[po_group_keys[c] for c in group_cols])
        .agg(
            F.count_distinct("transfer_order_number").alias("putaway_to_count"),
            F.count_distinct(
                F.when(F.col("item_status") == "Fully Confirmed", F.col("transfer_order_number"))
            ).alias("confirmed_putaway_to_count"),
            F.min("created_datetime").alias("oldest_putaway_to_created_datetime"),
            F.max("confirmed_date").alias("latest_putaway_to_confirmed_date"),
        )
    )

    return (
        item_summary
        .join(putaway_summary, group_cols, "left")
        .select(
            *group_cols,
            "open_item_count",
            "open_po_count",
            "total_ordered_qty",
            "total_gr_qty",
            "remaining_open_qty",
            "total_open_value",
            "earliest_po_date",
            "latest_gr_posting_date",
            "item_without_gr_count",
            "partial_gr_item_count",
            "fully_gr_item_count",
            "qa_inspection_item_count",
            F.coalesce(F.col("putaway_to_count"), F.lit(0)).alias("putaway_to_count"),
            F.coalesce(F.col("confirmed_putaway_to_count"), F.lit(0)).alias("confirmed_putaway_to_count"),
            "oldest_putaway_to_created_datetime",
            "latest_putaway_to_confirmed_date",
        )
    )


# ── 2. HANDLING UNIT SUMMARY ──────────────────────────────────────────────────
# Only materialised in full_validation: depends on the silver handling_unit table, which is
# absent in dev_shakedown (central_services lacks handlingunit_vekp/vepo).

if hu_reconciliation_enabled(get_spark_session()):

    @dlt.table(**gold_table_args(
        comment="Handling-unit (SSCC) summary by plant, warehouse and status.",
        cluster_by=["plant_code", "warehouse_number"],
    ))
    def gold_handling_unit_summary():
        spark = get_spark_session()
        silver_schema = get_silver_schema(spark)
        handling_units = spark.read.table(f"{silver_schema}.handling_unit")

        group_cols = [
            "plant_code", "warehouse_number", "handling_unit_status", "reference_document_category",
        ]

        # gross_weight is a VEKP *header* value repeated on every VEPO item row, so summing it at
        # item grain would multiply it by the item count. Aggregate to one row per handling unit
        # first, then sum once per HU.
        hu_weight = (
            handling_units.groupBy(*group_cols, "handling_unit_number")
            .agg(F.first("gross_weight", ignorenulls=True).alias("_hu_gross_weight"))
            .groupBy(*group_cols)
            .agg(F.coalesce(F.sum("_hu_gross_weight"), F.lit(0.0)).alias("total_gross_weight"))
        )

        counts = handling_units.groupBy(*group_cols).agg(
            F.count(F.lit(1)).alias("hu_item_count"),
            F.count_distinct("sscc").alias("distinct_sscc_count"),
            F.count_distinct("handling_unit_number").alias("distinct_hu_count"),
            F.count_distinct("delivery_number").alias("linked_delivery_count"),
            F.count_distinct("material_code").alias("distinct_material_count"),
        )

        return counts.join(hu_weight, group_cols, "left")
