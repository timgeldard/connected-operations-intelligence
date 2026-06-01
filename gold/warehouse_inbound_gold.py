"""
Lakeflow Spark Declarative Pipeline — Inbound & Handling-Unit Gold.

Tables:
  gold_inbound_po_backlog    — open purchase-order backlog (awaiting goods receipt) by plant/vendor
  gold_handling_unit_summary — handling-unit (SSCC) counts by plant/warehouse/status
"""

import dlt
from pyspark.sql import functions as F

from gold._shared import get_silver_schema, get_spark_session, gold_table_args


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
    purchase_orders = spark.read.table(f"{silver_schema}.purchase_order")

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


# ── 2. HANDLING UNIT SUMMARY ──────────────────────────────────────────────────

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
