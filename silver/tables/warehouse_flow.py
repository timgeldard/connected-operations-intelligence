"""
Warehouse flow operational tables (Fast tier — streaming sources).

Tables:
  reservation_requirement  — RESB (production component reservations / line-pick
                              demand; dispensary tasks are a BWART filter in Gold)
  outbound_delivery        — LIKP (header) + LIPS (item) outbound deliveries with
                              pick progress
"""

import dlt
from pyspark.sql import functions as F

from silver.helpers import BRONZE, get_spark, sap_date, sap_datetime, sap_flag, strip_zeros

spark = get_spark()


# ── 1. RESERVATION REQUIREMENT ────────────────────────────────────────────────
# RESB — component reservations for production orders. Single streaming source
# (carries RecordActivity for deletes). Dispensary line-pick tasks are the subset
# with BWART = '261'; that filter is applied in the Gold backlog, not here.

@dlt.view(name="stg_reservation_requirement")
@dlt.expect_all_or_drop({
    "reservation_number present": "reservation_number IS NOT NULL",
    "reservation_item present": "reservation_item IS NOT NULL",
})
def stg_reservation_requirement():
    src = spark.readStream.table(f"{BRONZE}.reservationrequirement_resb")
    return src.select(
        # ── Natural key
        F.col("RSNUM").alias("reservation_number"),
        F.col("RSPOS").alias("reservation_item"),

        # ── Reference / organisation
        strip_zeros("AUFNR").alias("order_number"),
        F.col("AUFNR").alias("order_number_raw"),
        F.col("WERKS").alias("plant_code"),
        F.col("LGORT").alias("storage_location_code"),
        F.col("PRVBE").alias("production_supply_area"),
        F.col("LGNUM").alias("warehouse_number"),
        F.col("VORNR").alias("operation_number"),

        # ── Material & batch
        strip_zeros("MATNR").alias("material_code"),
        F.col("MATNR").alias("material_code_raw"),
        strip_zeros("CHARG").alias("batch_number"),
        F.col("CHARG").alias("batch_number_raw"),

        # ── Movement / demand
        F.col("BWART").alias("movement_type_code"),
        sap_date("BDTER").alias("requirement_date"),
        F.col("BDMNG").alias("required_quantity"),
        F.col("ENMNG").alias("withdrawn_quantity"),
        (F.coalesce(F.col("BDMNG"), F.lit(0.0)) - F.coalesce(F.col("ENMNG"), F.lit(0.0))).alias(
            "open_quantity"
        ),
        F.col("MEINS").alias("base_uom"),

        # ── Flags
        sap_flag("KZEAR").alias("is_final_issue"),
        sap_flag("XLOEK").alias("is_deletion_flagged"),

        F.col("RecordActivity").alias("record_activity"),
        F.col("AEDATTM").alias("_replicated_at"),
        F.col("AERUNID").alias("_run_id"),
        F.col("AERECNO").alias("_record_seq"),
    )

dlt.create_streaming_table(
    name="reservation_requirement",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "requirement_date"],
)

dlt.apply_changes(
    target="reservation_requirement",
    source="stg_reservation_requirement",
    keys=["reservation_number", "reservation_item"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    apply_as_deletes=F.expr("record_activity = 'D'"),
    stored_as_scd_type=1,
)


# ── 2. OUTBOUND DELIVERY ──────────────────────────────────────────────────────
# LIKP (header) + LIPS (item). Item grain. Pick progress (LGMNG vs LFIMG) is
# summarised in Gold. Mirrors the warehouse_transfer_order multi-source idiom.

@dlt.view(name="stg_outbound_delivery")
@dlt.expect_all_or_drop({
    "delivery_number present": "delivery_number IS NOT NULL",
    "item_number present": "item_number IS NOT NULL OR record_activity = 'D'",
})
def stg_outbound_delivery():
    likp_changes = spark.readStream.table(f"{BRONZE}.deliveryobjects_likp").select(
        "VBELN", "MANDT", "AEDATTM", "AERUNID", "AERECNO", "RecordActivity"
    )
    lips_changes = (
        spark.readStream.table(f"{BRONZE}.deliveryobjects_lips")
        .select("VBELN", "MANDT", "AEDATTM", "AERUNID", "AERECNO")
        .withColumn("RecordActivity", F.lit(None).cast("string"))
    )

    changed_keys = likp_changes.unionByName(lips_changes)
    likp = spark.read.table(f"{BRONZE}.deliveryobjects_likp")
    lips = spark.read.table(f"{BRONZE}.deliveryobjects_lips")

    delivery_items_to_refresh = (
        changed_keys.alias("c")
        .join(lips.alias("i"), ["VBELN", "MANDT"], "left")
        .select(
            "i.*",
            F.col("c.VBELN").alias("_change_vbeln"),
            F.col("c.AEDATTM").alias("_change_replicated_at"),
            F.col("c.AERUNID").alias("_change_run_id"),
            F.col("c.AERECNO").alias("_change_record_seq"),
            F.col("c.RecordActivity").alias("_change_record_activity"),
        )
    )

    return (
        delivery_items_to_refresh.alias("i")
        .join(likp.alias("h"), ["VBELN", "MANDT"], "left")
        .select(
            # ── Natural key
            strip_zeros(F.coalesce(F.col("i.VBELN"), F.col("i._change_vbeln"))).alias("delivery_number"),
            F.coalesce(F.col("i.VBELN"), F.col("i._change_vbeln")).alias("delivery_number_raw"),
            F.col("i.POSNR").alias("item_number"),

            # ── Organisation
            F.col("i.WERKS").alias("plant_code"),
            F.col("i.LGORT").alias("storage_location_code"),
            F.col("h.LGNUM").alias("warehouse_number"),
            F.col("h.VSTEL").alias("shipping_point"),
            F.col("h.LFART").alias("delivery_type"),

            # ── Customer
            strip_zeros("h.KUNNR").alias("ship_to_customer"),
            strip_zeros("h.KUNAG").alias("sold_to_customer"),

            # ── Material & batch
            strip_zeros("i.MATNR").alias("material_code"),
            F.col("i.MATNR").alias("material_code_raw"),
            strip_zeros("i.CHARG").alias("batch_number"),
            F.col("i.CHARG").alias("batch_number_raw"),

            # ── Quantities (pick progress)
            F.col("i.LFIMG").alias("delivery_quantity"),
            F.col("i.LGMNG").alias("picked_quantity"),
            F.col("i.MEINS").alias("base_uom"),
            F.col("i.NTGEW").alias("net_weight"),
            F.col("i.BRGEW").alias("gross_weight"),
            F.col("i.GEWEI").alias("weight_unit"),

            # ── Reference
            strip_zeros("i.VGBEL").alias("source_document_number"),
            F.col("i.VGPOS").alias("source_document_item"),

            # ── Status / dates (header)
            F.col("h.VLSTK").alias("wm_status_code"),
            sap_date("h.WADAT").alias("planned_goods_issue_date"),
            sap_date("h.WADAT_IST").alias("actual_goods_issue_date"),
            sap_date("h.LFDAT").alias("delivery_date"),
            sap_date("h.LDDAT").alias("loading_date"),
            sap_datetime("h.WADAT", "h.KOUHR").alias("planned_goods_issue_datetime"),
            F.col("h.BTGEW").alias("delivery_gross_weight"),
            F.col("h.GEWEI").alias("delivery_weight_unit"),

            F.col("i._change_replicated_at").alias("_replicated_at"),
            F.col("i._change_run_id").alias("_run_id"),
            F.col("i._change_record_seq").alias("_record_seq"),
            F.coalesce(F.col("h.RecordActivity"), F.col("i._change_record_activity")).alias(
                "record_activity"
            ),
        )
    )

dlt.create_streaming_table(
    name="outbound_delivery",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "planned_goods_issue_date"],
)

dlt.apply_changes(
    target="outbound_delivery",
    source="stg_outbound_delivery",
    keys=["delivery_number", "item_number"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    apply_as_deletes=F.expr("record_activity = 'D'"),
    stored_as_scd_type=1,
)
