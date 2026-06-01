"""
Inbound procurement and handling-unit tables (Reference/Slow tier).

Sources live in the published / central_services catalog (bronze_published()), so
these are wired into the triggered slow pipeline (which configures that source).

Tables:
  purchase_order  — EKKO (header) + EKPO (item) purchase orders (streaming SCD1)
  handling_unit   — VEKP (header, EXIDV = SSCC) + VEPO (item) handling units (batch;
                    VEKP/VEPO carry only AEDATTM). Approximates WMA-E-50 SSCC.
"""

import dlt
from pyspark.sql import functions as F

from silver.helpers import bronze_published, get_spark, sap_date, sap_flag, strip_zeros

spark = get_spark()


# ── 1. PURCHASE ORDER ─────────────────────────────────────────────────────────

@dlt.view(name="stg_purchase_order")
@dlt.expect_all_or_drop({
    "purchase_order_number present": "purchase_order_number IS NOT NULL",
    "item_number present": "item_number IS NOT NULL OR record_activity = 'D'",
})
def stg_purchase_order():
    published = bronze_published()
    ekko_changes = spark.readStream.table(f"{published}.procurementorderobject_ekko").select(
        "EBELN", "MANDT", "AEDATTM", "AERUNID", "AERECNO", "RecordActivity"
    )
    ekpo_changes = (
        spark.readStream.table(f"{published}.procurementorderobject_ekpo")
        .select("EBELN", "MANDT", "AEDATTM", "AERUNID", "AERECNO")
        .withColumn("RecordActivity", F.lit(None).cast("string"))
    )

    changed_keys = ekko_changes.unionByName(ekpo_changes)
    ekko = spark.read.table(f"{published}.procurementorderobject_ekko")
    ekpo = spark.read.table(f"{published}.procurementorderobject_ekpo")

    items_to_refresh = (
        changed_keys.alias("c")
        .join(ekpo.alias("i"), ["EBELN", "MANDT"], "left")
        .select(
            "i.*",
            F.col("c.EBELN").alias("_change_ebeln"),
            F.col("c.AEDATTM").alias("_change_replicated_at"),
            F.col("c.AERUNID").alias("_change_run_id"),
            F.col("c.AERECNO").alias("_change_record_seq"),
            F.col("c.RecordActivity").alias("_change_record_activity"),
        )
    )

    return (
        items_to_refresh.alias("i")
        .join(ekko.alias("h"), ["EBELN", "MANDT"], "left")
        .select(
            # ── Natural key
            strip_zeros(F.coalesce(F.col("i.EBELN"), F.col("i._change_ebeln"))).alias("purchase_order_number"),
            F.coalesce(F.col("i.EBELN"), F.col("i._change_ebeln")).alias("purchase_order_number_raw"),
            F.col("i.EBELP").alias("item_number"),

            # ── Header
            F.col("h.BSART").alias("purchase_order_type"),
            F.col("h.BSTYP").alias("purchase_order_category"),
            strip_zeros("h.LIFNR").alias("vendor_code"),
            F.col("h.EKORG").alias("purchasing_org"),
            F.col("h.EKGRP").alias("purchasing_group"),
            F.col("h.WAERS").alias("currency"),
            sap_date("h.BEDAT").alias("purchase_order_date"),
            F.col("h.ERNAM").alias("created_by_user"),

            # ── Item
            F.col("i.WERKS").alias("plant_code"),
            F.col("i.LGORT").alias("storage_location_code"),
            strip_zeros("i.MATNR").alias("material_code"),
            F.col("i.MATNR").alias("material_code_raw"),
            F.col("i.TXZ01").alias("item_text"),
            F.col("i.MENGE").alias("ordered_quantity"),
            F.col("i.MEINS").alias("base_uom"),
            F.col("i.NETPR").alias("net_price"),
            F.col("i.PEINH").alias("price_unit"),
            F.col("i.NETWR").alias("net_value"),
            F.col("i.WEBAZ").alias("gr_processing_days"),
            F.col("i.INSMK").alias("qa_stock_type"),
            F.col("i.MTART").alias("material_type"),
            sap_flag("i.ELIKZ").alias("is_delivery_complete"),
            sap_flag("i.LOEKZ").alias("is_item_deleted"),

            F.col("i._change_replicated_at").alias("_replicated_at"),
            F.col("i._change_run_id").alias("_run_id"),
            F.col("i._change_record_seq").alias("_record_seq"),
            F.coalesce(F.col("h.RecordActivity"), F.col("i._change_record_activity")).alias(
                "record_activity"
            ),
        )
    )

dlt.create_streaming_table(
    name="purchase_order",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "purchase_order_date"],
)

# NOTE (delete semantics): a header-only delete (EKKO RecordActivity='D') carries a null
# item_number when the matching EKPO items are already purged, so SCD1 cannot match the
# compound key to remove prior item rows. This matches the repo's other multi-source
# streaming tables; a full header-delete cascade would need a separate header-keyed pass.
dlt.apply_changes(
    target="purchase_order",
    source="stg_purchase_order",
    keys=["purchase_order_number", "item_number"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    apply_as_deletes=F.expr("record_activity = 'D'"),
    stored_as_scd_type=1,
)


# ── 2. HANDLING UNIT (SSCC) ───────────────────────────────────────────────────
# VEKP (header) + VEPO (item). Batch (VEKP/VEPO carry only AEDATTM). EXIDV is the
# SSCC barcode; VBTYP = 'J' on the item links to an outbound delivery.

@dlt.table(
    comment="Handling units (VEKP/VEPO) — SSCC packing units with material, batch and delivery link",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "warehouse_number"],
)
@dlt.expect_all_or_drop({
    "handling_unit_number present": "handling_unit_number IS NOT NULL",
    "item_number present": "item_number IS NOT NULL",
})
def handling_unit():
    published = bronze_published()
    vekp = spark.read.table(f"{published}.handlingunit_vekp")
    vepo = spark.read.table(f"{published}.handlingunit_vepo")

    return (
        vepo.alias("i")
        .join(vekp.alias("h"), ["VENUM", "MANDT"], "left")
        .select(
            # ── Natural key
            F.col("i.VENUM").alias("handling_unit_number"),
            F.col("i.VEPOS").alias("item_number"),

            # ── Header
            F.col("h.EXIDV").alias("sscc"),
            F.col("h.VHART").alias("handling_unit_type"),
            F.col("h.STATUS").alias("handling_unit_status"),
            F.col("h.WMSTA").alias("wm_status_code"),
            F.col("h.WERKS").alias("plant_code"),
            F.col("h.LGNUM").alias("warehouse_number"),
            F.col("h.BRGEW").alias("gross_weight"),
            F.col("h.NTGEW").alias("net_weight"),
            F.col("h.GEWEI").alias("weight_unit"),

            # ── Item
            F.col("i.VBTYP").alias("reference_document_category"),
            strip_zeros("i.VBELN").alias("delivery_number"),
            F.col("i.VBELN").alias("delivery_number_raw"),
            F.col("i.POSNR").alias("delivery_item_number"),
            strip_zeros("i.MATNR").alias("material_code"),
            F.col("i.MATNR").alias("material_code_raw"),
            strip_zeros("i.CHARG").alias("batch_number"),
            F.col("i.CHARG").alias("batch_number_raw"),
            F.col("i.VEMNG").alias("packed_quantity"),
            F.col("i.VEMEH").alias("packed_uom"),
            sap_date("i.WDATU").alias("goods_receipt_date"),
            sap_date("i.VFDAT").alias("expiry_date"),

            F.col("i.AEDATTM").alias("_replicated_at"),
        )
    )
