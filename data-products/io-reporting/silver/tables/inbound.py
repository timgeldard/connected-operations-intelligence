"""
Inbound procurement and handling-unit tables (Reference/Slow tier).

Sources live in the published / central_services catalog (bronze_published()), so
these are wired into the triggered slow pipeline (which configures that source).

Tables:
  purchase_order  — EKKO (header) + EKPO (item) purchase orders (streaming SCD1)
  handling_unit   — VEKP (header, EXIDV = SSCC) + VEPO (item) handling units (batch;
                    VEKP/VEPO carry only AEDATTM). Approximates WMA-E-50 SSCC.
  physical_inventory_document — IKPF header + ISEG item physical inventory count documents.
"""

import dlt
from pyspark.sql import functions as F

from silver.helpers import (
    bronze_published,
    get_spark,
    hu_reconciliation_enabled,
    sap_date,
    sap_flag,
    strip_zeros,
)

# ── 1. PURCHASE ORDER ─────────────────────────────────────────────────────────

@dlt.view(name="stg_purchase_order")
@dlt.expect_all_or_drop({
    "purchase_order_number present": "purchase_order_number IS NOT NULL",
    "item_number present": "item_number IS NOT NULL OR record_activity = 'D'",
})
def stg_purchase_order():
    spark = get_spark()
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
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
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


@dlt.table(
    name="purchase_order_header_delete",
    comment="Purchase-order headers with an EKKO delete tombstone. Used by Gold to suppress stale item-grain rows when item keys cannot be reconstructed.",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_or_drop("purchase_order_number present", "purchase_order_number IS NOT NULL")
def purchase_order_header_delete():
    spark = get_spark()
    published = bronze_published()
    return (
        spark.readStream.table(f"{published}.procurementorderobject_ekko")
        .filter(F.col("RecordActivity") == "D")
        .select(
            strip_zeros("EBELN").alias("purchase_order_number"),
            F.col("EBELN").alias("purchase_order_number_raw"),
            F.col("AEDATTM").alias("_replicated_at"),
            F.col("AERUNID").alias("_run_id"),
            F.col("AERECNO").alias("_record_seq"),
        )
    )


# ── 2. HANDLING UNIT (SSCC) ───────────────────────────────────────────────────
# VEKP (header) + VEPO (item). Batch (VEKP/VEPO carry only AEDATTM). EXIDV is the
# SSCC barcode; VBTYP = 'J' on the item links to an outbound delivery.

# HU silver table is only defined when handling-unit reconciliation is enabled
# (full_validation). In dev_shakedown the externally-owned published_dev.central_services
# lacks handlingunit_vekp/vepo, so registering this @dlt.table would fail the run; instead
# it is simply not part of the pipeline graph. See databricks.yml / hu_reconciliation_enabled.
if hu_reconciliation_enabled():

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
        spark = get_spark()
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
                # CHARG is an exact SAP identifier — preserve as replicated (no strip/trim/normalise).
                F.col("i.CHARG").alias("batch_number"),
                F.col("i.CHARG").alias("batch_number_raw"),
                F.col("i.VEMNG").alias("packed_quantity"),
                F.col("i.VEMEH").alias("packed_uom"),
                sap_date("i.WDATU").alias("goods_receipt_date"),
                sap_date("i.VFDAT").alias("expiry_date"),

                F.col("i.AEDATTM").alias("_replicated_at"),
            )
        )


# ── 3. PHYSICAL INVENTORY DOCUMENT ────────────────────────────────────────────
# IKPF (header) + ISEG (item). Published slow-tier source used for count-vs-book
# reconciliation and cycle-count sign-off reporting.

@dlt.table(
    comment="Physical inventory documents (IKPF/ISEG) with book, counted and posted difference evidence",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "count_date"],
)
@dlt.expect_all_or_drop({
    "physical inventory document present": "physical_inventory_document_number IS NOT NULL",
    "item number present": "item_number IS NOT NULL",
})
def physical_inventory_document():
    spark = get_spark()
    published = bronze_published()
    ikpf = spark.read.table(f"{published}.header_physical_inventory_doc_ikpf")
    iseg = spark.read.table(f"{published}.physical_inventory_doc_items_iseg")

    return (
        iseg.alias("i")
        .join(ikpf.alias("h"), ["MANDT", "IBLNR", "GJAHR"], "left")
        .select(
            F.col("i.IBLNR").alias("physical_inventory_document_number"),
            F.col("i.GJAHR").alias("fiscal_year"),
            F.col("i.ZEILI").alias("item_number"),
            F.col("i.WERKS").alias("plant_code"),
            F.col("i.LGORT").alias("storage_location_code"),
            strip_zeros("i.MATNR").alias("material_code"),
            F.col("i.MATNR").alias("material_code_raw"),
            # CHARG is an exact SAP identifier — preserve as replicated (no strip/trim/normalise).
            F.col("i.CHARG").alias("batch_number"),
            F.col("i.CHARG").alias("batch_number_raw"),
            F.col("i.BSTAR").alias("stock_type_code"),
            F.col("h.VGART").alias("transaction_event_type"),
            F.col("h.INVART").alias("physical_inventory_type"),
            sap_date("h.BLDAT").alias("document_date"),
            sap_date("h.GIDAT").alias("planned_count_date"),
            F.try_to_timestamp(
                F.when(
                    F.trim(F.coalesce(F.col("i.ZLDAT"), F.col("h.ZLDAT")).cast("string")).isin("", "00000000"),
                    None,
                ).otherwise(F.trim(F.coalesce(F.col("i.ZLDAT"), F.col("h.ZLDAT")).cast("string"))),
                F.lit("yyyyMMdd"),
            ).cast("date").alias("count_date"),
            F.try_to_timestamp(
                F.when(
                    F.trim(F.coalesce(F.col("i.BUDAT"), F.col("h.BUDAT")).cast("string")).isin("", "00000000"),
                    None,
                ).otherwise(F.trim(F.coalesce(F.col("i.BUDAT"), F.col("h.BUDAT")).cast("string"))),
                F.lit("yyyyMMdd"),
            ).cast("date").alias("posting_date"),
            F.col("h.USNAM").alias("created_by_user"),
            F.col("i.USNAZ").alias("counted_by_user"),
            F.col("i.USNAD").alias("posted_by_user"),
            sap_flag("i.XZAEL").alias("is_counted"),
            sap_flag("i.XDIFF").alias("is_difference_posted"),
            sap_flag("i.XNZAE").alias("is_recount_required"),
            sap_flag("i.XLOEK").alias("is_deleted"),
            sap_flag("h.SPERR").alias("has_posting_block"),
            sap_flag("h.XBUFI").alias("is_book_inventory_frozen"),
            F.col("i.BUCHM").alias("book_quantity"),
            F.col("i.MENGE").alias("counted_quantity"),
            F.col("i.MEINS").alias("base_uom"),
            F.col("i.ERFMG").alias("entry_quantity"),
            F.col("i.ERFME").alias("entry_uom"),
            strip_zeros("i.MBLNR").alias("material_document_number"),
            F.col("i.MJAHR").alias("material_document_year"),
            F.col("i.ZEILE").alias("material_document_item"),
            F.col("i.DMBTR").alias("difference_amount_local_currency"),
            F.col("i.WAERS").alias("currency"),
            F.col("i.GRUND").alias("difference_reason_code"),
            F.col("i.ABCIN").alias("cycle_counting_indicator"),
            F.coalesce(F.col("i.AEDATTM"), F.col("h.AEDATTM")).alias("_replicated_at"),
        )
    )
