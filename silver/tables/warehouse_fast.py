"""
Warehouse and Inventory operational tables (Fast tier — streaming sources).

Tables: goods_movement, batch_stock, warehouse_transfer_order,
        warehouse_transfer_requirement
"""

import dlt
from pyspark.sql import functions as F

from silver.helpers import BRONZE, get_spark, sap_date, sap_datetime, sap_flag, strip_zeros

spark = get_spark()


# ── 1. GOODS MOVEMENT ────────────────────────────────────────────────────────


@dlt.view(name="stg_goods_movement")
@dlt.expect_all_or_drop({
    "document_number present": "material_document_number IS NOT NULL",
    "plant_code present": "plant_code IS NOT NULL OR record_activity = 'D'"
})
@dlt.expect_all({
    "movement_type_code present": "movement_type_code IS NOT NULL OR record_activity = 'D'"
})
def stg_goods_movement():
    mseg_changes = spark.readStream.table(f"{BRONZE}.inventorymovement_mseg").select(
        "MBLNR", "MJAHR", "MANDT", "ZEILE", "AEDATTM", "AERUNID", "AERECNO", "RecordActivity"
    )
    mkpf_changes = (
        spark.readStream.table(f"{BRONZE}.materialdocument_mkpf")
        .select("MBLNR", "MJAHR", "MANDT", "AEDATTM", "AERUNID", "AERECNO")
        .withColumn("ZEILE", F.lit(None).cast("string"))
        .withColumn("RecordActivity", F.lit(None).cast("string"))
    )

    changed_keys = mseg_changes.unionByName(mkpf_changes)
    mseg = spark.read.table(f"{BRONZE}.inventorymovement_mseg")
    mkpf = spark.read.table(f"{BRONZE}.materialdocument_mkpf").select(
        "MBLNR", "MJAHR", "MANDT", "BUDAT", "BLDAT", "USNAM", "TCODE"
    )
    movement_lines_to_refresh = (
        changed_keys.alias("c")
        .join(
            mseg.alias("s"),
            (F.col("c.MBLNR") == F.col("s.MBLNR"))
            & (F.col("c.MJAHR") == F.col("s.MJAHR"))
            & (F.col("c.MANDT") == F.col("s.MANDT"))
            & (F.col("c.ZEILE").isNull() | (F.col("c.ZEILE") == F.col("s.ZEILE"))),
            "left",
        )
        .select(
            "s.*",
            F.col("c.MBLNR").alias("_change_mblnr"),
            F.col("c.MJAHR").alias("_change_mjahr"),
            F.col("c.ZEILE").alias("_change_zeile"),
            F.col("c.AEDATTM").alias("_change_replicated_at"),
            F.col("c.AERUNID").alias("_change_run_id"),
            F.col("c.AERECNO").alias("_change_record_seq"),
            F.col("c.RecordActivity").alias("_change_record_activity"),
        )
    )
    return (
        movement_lines_to_refresh.alias("s")
        .join(mkpf.alias("h"), ["MBLNR", "MJAHR", "MANDT"], "left")
        .select(
            # ── Natural key
            strip_zeros(F.coalesce(F.col("s.MBLNR"), F.col("s._change_mblnr"))).alias("material_document_number"),
            F.coalesce(F.col("s.MJAHR"), F.col("s._change_mjahr")).alias("fiscal_year"),
            F.coalesce(F.col("s.ZEILE"), F.col("s._change_zeile")).alias("document_line_item"),

            # ── Organisation
            F.col("s.WERKS").alias("plant_code"),
            F.col("s.LGORT").alias("storage_location_code"),

            # ── Material & batch
            strip_zeros("s.MATNR").alias("material_code"),
            F.col("s.MATNR").alias("material_code_raw"),
            strip_zeros("s.CHARG").alias("batch_number"),
            F.col("s.CHARG").alias("batch_number_raw"),

            # ── Movement
            F.col("s.BWART").alias("movement_type_code"),
            F.col("s.SHKZG").alias("debit_credit_indicator"),
            F.col("s.MENGE").alias("quantity"),
            F.col("s.MEINS").alias("base_uom"),
            F.col("s.ERFMG").alias("quantity_in_entry_uom"),
            F.col("s.ERFME").alias("entry_uom"),

            # ── Valuation
            F.col("s.DMBTR").alias("amount_local_currency"),
            F.col("s.WAERS").alias("currency"),

            # ── Dates
            sap_date("h.BUDAT").alias("posting_date"),
            sap_date("h.BLDAT").alias("document_date"),

            # ── Reference documents
            strip_zeros("s.AUFNR").alias("order_number"),
            F.col("s.AUFNR").alias("order_number_raw"),
            strip_zeros("s.EBELN").alias("purchase_order_number"),
            F.col("s.EBELN").alias("purchase_order_number_raw"),
            F.col("s.EBELP").alias("purchase_order_item"),
            strip_zeros("s.VBELN").alias("delivery_number"),
            F.col("s.VBELN").alias("delivery_number_raw"),
            F.col("s.KDAUF").alias("sales_order_number"),

            # ── User
            F.col("h.USNAM").alias("posted_by_user"),
            F.col("h.TCODE").alias("transaction_code"),

            F.col("s._change_replicated_at").alias("_replicated_at"),
            F.col("s._change_run_id").alias("_run_id"),
            F.col("s._change_record_seq").alias("_record_seq"),
            F.coalesce(F.col("s.RecordActivity"), F.col("s._change_record_activity")).alias(
                "record_activity"
            ),
        )
    )

dlt.create_streaming_table(
    name="goods_movement",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["plant_code", "posting_date"],
)

dlt.apply_changes(
    target="goods_movement",
    source="stg_goods_movement",
    keys=["material_document_number", "fiscal_year", "document_line_item"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    apply_as_deletes=F.expr("record_activity = 'D'"),
    stored_as_scd_type=1,
)


# ── 2. BATCH STOCK ────────────────────────────────────────────────────────────

@dlt.view(name="stg_batch_stock")
@dlt.expect_all_or_drop({
    "material_code present": "material_code IS NOT NULL",
    "plant_code present": "plant_code IS NOT NULL"
})
@dlt.expect_all({
    "unrestricted quantity non-negative": "unrestricted_quantity >= 0"
})
def stg_batch_stock():
    src = spark.readStream.table(f"{BRONZE}.batchstock_mchb")
    return src.select(
        strip_zeros("MATNR").alias("material_code"),
        F.col("MATNR").alias("material_code_raw"),
        F.col("WERKS").alias("plant_code"),
        F.col("LGORT").alias("storage_location_code"),
        strip_zeros("CHARG").alias("batch_number"),
        F.col("CHARG").alias("batch_number_raw"),

        F.col("CLABS").alias("unrestricted_quantity"),
        F.col("CINSM").alias("quality_inspection_quantity"),
        F.col("CSPEM").alias("blocked_quantity"),
        F.col("CEINM").alias("restricted_use_quantity"),
        F.col("CUMLM").alias("in_transfer_quantity"),
        F.col("CRETM").alias("blocked_returns_quantity"),
        F.col("MEINS").alias("base_uom"),

        # Previous period (for trend / delta)
        F.col("CVMLA").alias("prev_period_unrestricted_quantity"),
        F.col("CVMIN").alias("prev_period_quality_inspection_quantity"),

        F.col("LFGJA").alias("fiscal_year"),
        F.col("LFMON").alias("fiscal_period"),

        F.col("AEDATTM").alias("_replicated_at"),
        F.col("AERUNID").alias("_run_id"),
        F.col("AERECNO").alias("_record_seq"),
    )

dlt.create_streaming_table(
    name="batch_stock",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["plant_code", "storage_location_code"],
)

dlt.apply_changes(
    target="batch_stock",
    source="stg_batch_stock",
    keys=["material_code", "plant_code", "storage_location_code", "batch_number"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    stored_as_scd_type=1,
)


# ── 3. WAREHOUSE TRANSFER ORDER ───────────────────────────────────────────────

@dlt.view(name="stg_warehouse_transfer_order")
@dlt.expect_all_or_drop({
    "warehouse_number present": "warehouse_number IS NOT NULL",
    "transfer_order_number present": "transfer_order_number IS NOT NULL"
})
def stg_warehouse_transfer_order():
    ltak_changes = spark.readStream.table(f"{BRONZE}.transferorderobjects_ltak").select(
        "LGNUM", "TANUM", "MANDT", "AEDATTM", "AERUNID", "AERECNO", "RecordActivity"
    )
    ltap_changes = (
        spark.readStream.table(f"{BRONZE}.transferorderobjects_ltap")
        .select("LGNUM", "TANUM", "MANDT", "AEDATTM", "AERUNID", "AERECNO")
        .withColumn("RecordActivity", F.lit(None).cast("string"))
    )

    changed_keys = ltak_changes.unionByName(ltap_changes)
    ltak = spark.read.table(f"{BRONZE}.transferorderobjects_ltak")
    ltap = spark.read.table(f"{BRONZE}.transferorderobjects_ltap")
    order_items_to_refresh = (
        changed_keys.alias("c")
        .join(ltap.alias("i"), ["LGNUM", "TANUM", "MANDT"], "left")
        .select(
            "i.*",
            F.col("c.LGNUM").alias("_change_lgnum"),
            F.col("c.TANUM").alias("_change_tanum"),
            F.col("c.AEDATTM").alias("_change_replicated_at"),
            F.col("c.AERUNID").alias("_change_run_id"),
            F.col("c.AERECNO").alias("_change_record_seq"),
            F.col("c.RecordActivity").alias("_change_record_activity"),
        )
    )

    return (
        order_items_to_refresh.alias("i")
        .join(ltak.alias("h"), ["LGNUM", "TANUM", "MANDT"], "left")
        .select(
            # ── Natural key
            F.coalesce(F.col("i.LGNUM"), F.col("i._change_lgnum")).alias("warehouse_number"),
            F.coalesce(F.col("i.TANUM"), F.col("i._change_tanum")).alias("transfer_order_number"),
            F.col("i.TAPOS").alias("item_number"),

            # ── Organisation
            F.col("i.WERKS").alias("plant_code"),

            # ── Material & batch
            strip_zeros("i.MATNR").alias("material_code"),
            F.col("i.MATNR").alias("material_code_raw"),
            strip_zeros("i.CHARG").alias("batch_number"),
            F.col("i.CHARG").alias("batch_number_raw"),
            F.col("i.MEINS").alias("base_uom"),
            F.col("i.BESTQ").alias("stock_category_code"),

            # ── Locations
            F.col("i.VLTYP").alias("source_storage_type"),
            F.col("i.VLPLA").alias("source_bin"),
            F.col("i.NLTYP").alias("destination_storage_type"),
            F.col("i.NLPLA").alias("destination_bin"),

            # ── Quantities
            F.col("i.ANFME").alias("requested_quantity"),
            F.col("i.ENMNG").alias("confirmed_quantity"),
            F.col("i.ISPOS").alias("actual_quantity_picked"),

            # ── Status
            F.when(F.col("i.PQUIT") == "B", "Fully Confirmed")
             .when(F.col("i.PQUIT") == "A", "Partially Confirmed")
             .otherwise("Open").alias("item_status"),
            F.when(F.col("h.KQUIT") == "B", "Fully Confirmed")
             .when(F.col("h.KQUIT") == "A", "Partially Confirmed")
             .otherwise("Open").alias("header_status"),

            # ── Dates & times
            sap_datetime("h.BDATU", "h.BZEIT").alias("created_datetime"),
            sap_date("h.PLDAT").alias("planned_execution_date"),
            sap_date("i.QDATU").alias("confirmed_date"),
            sap_datetime("h.STDAT", "h.STUZT").alias("start_datetime"),
            sap_datetime("h.ENDAT", "h.ENUZT").alias("end_datetime"),

            # ── Performance
            F.col("h.SOLWM").alias("planned_processing_time"),
            F.col("h.ISTWM").alias("actual_processing_time"),
            F.col("h.ZEIEI").alias("processing_time_unit"),

            # ── Reference
            F.col("h.BETYP").alias("source_reference_type"),
            strip_zeros("h.BENUM").alias("source_reference_number"),
            F.col("h.BENUM").alias("source_reference_number_raw"),
            strip_zeros("h.VBELN").alias("delivery_number"),
            F.col("h.VBELN").alias("delivery_number_raw"),
            F.col("h.TBPRI").alias("transfer_priority"),

            # ── Users
            F.col("h.BNAME").alias("created_by_user"),
            F.col("i.QNAME").alias("confirmed_by_user"),

            F.col("i._change_replicated_at").alias("_replicated_at"),
            F.col("i._change_run_id").alias("_run_id"),
            F.col("i._change_record_seq").alias("_record_seq"),
            F.coalesce(F.col("h.RecordActivity"), F.col("i._change_record_activity")).alias(
                "record_activity"
            ),
        )
    )

dlt.create_streaming_table(
    name="warehouse_transfer_order",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["plant_code", "created_datetime"],
)

dlt.apply_changes(
    target="warehouse_transfer_order",
    source="stg_warehouse_transfer_order",
    keys=["warehouse_number", "transfer_order_number", "item_number"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    apply_as_deletes=F.expr("record_activity = 'D'"),
    stored_as_scd_type=1,
)


# ── 4. WAREHOUSE TRANSFER REQUIREMENT ─────────────────────────────────────────

@dlt.view(name="stg_warehouse_transfer_requirement")
@dlt.expect_all_or_drop({
    "warehouse_number present": "warehouse_number IS NOT NULL",
    "transfer_requirement_number present": "transfer_requirement_number IS NOT NULL"
})
@dlt.expect_all({
    "required quantity positive": "required_quantity > 0 OR record_activity = 'D'"
})
def stg_warehouse_transfer_requirement():
    ltbk_changes = spark.readStream.table(f"{BRONZE}.transferrequirementobjects_ltbk").select(
        "LGNUM", "TBNUM", "MANDT", "AEDATTM", "AERUNID", "AERECNO", "OPFLAG"
    )
    ltbp_changes = (
        spark.readStream.table(f"{BRONZE}.transferrequirementobjects_ltbp")
        .select("LGNUM", "TBNUM", "MANDT", "AEDATTM", "AERUNID", "AERECNO")
        .withColumn("OPFLAG", F.lit(None).cast("string"))
    )

    changed_keys = ltbk_changes.unionByName(ltbp_changes)
    ltbk = spark.read.table(f"{BRONZE}.transferrequirementobjects_ltbk")
    ltbp = spark.read.table(f"{BRONZE}.transferrequirementobjects_ltbp")
    requirement_items_to_refresh = (
        changed_keys.alias("c")
        .join(ltbp.alias("i"), ["LGNUM", "TBNUM", "MANDT"], "left")
        .select(
            "i.*",
            F.col("c.LGNUM").alias("_change_lgnum"),
            F.col("c.TBNUM").alias("_change_tbnum"),
            F.col("c.AEDATTM").alias("_change_replicated_at"),
            F.col("c.AERUNID").alias("_change_run_id"),
            F.col("c.AERECNO").alias("_change_record_seq"),
            F.col("c.OPFLAG").alias("_change_record_activity"),
        )
    )

    return (
        requirement_items_to_refresh.alias("i")
        .join(ltbk.alias("h"), ["LGNUM", "TBNUM", "MANDT"], "left")
        .select(
            # ── Natural key
            F.coalesce(F.col("i.LGNUM"), F.col("i._change_lgnum")).alias("warehouse_number"),
            F.coalesce(F.col("i.TBNUM"), F.col("i._change_tbnum")).alias("transfer_requirement_number"),
            F.col("i.TBPOS").alias("item_number"),

            # ── Organisation
            F.col("i.WERKS").alias("plant_code"),

            # ── Material & batch
            strip_zeros("i.MATNR").alias("material_code"),
            F.col("i.MATNR").alias("material_code_raw"),
            strip_zeros("i.CHARG").alias("batch_number"),
            F.col("i.CHARG").alias("batch_number_raw"),
            F.col("i.MEINS").alias("base_uom"),

            # ── Quantities
            F.col("i.MENGE").alias("required_quantity"),
            F.col("i.ENQTY").alias("open_quantity"),

            # ── Locations
            F.col("h.VLTYP").alias("source_storage_type"),
            F.col("h.VLPLA").alias("source_bin"),
            F.col("h.NLTYP").alias("destination_storage_type"),
            F.col("h.NLPLA").alias("destination_bin"),

            # ── Status
            F.col("h.STATU").alias("header_status_code"),
            sap_flag("i.ELIKZ").alias("is_processing_complete"),

            # ── Dates
            sap_datetime("h.BDATU", "h.BZEIT").alias("created_datetime"),
            sap_datetime("h.PDATU", "h.PZEIT").alias("planned_execution_datetime"),

            # ── Reference
            F.col("h.BETYP").alias("source_reference_type"),
            strip_zeros("h.BENUM").alias("source_reference_number"),
            F.col("h.BENUM").alias("source_reference_number_raw"),
            F.col("h.RSNUM").alias("reservation_number"),

            # ── Custom fields (site-specific campaign / pick status)
            F.col("h.ZZ_CAMPAIGN").alias("campaign_reference"),
            F.col("h.ZZ_PICK_STAT_M").alias("manual_pick_status"),
            F.col("h.ZZ_PICK_STAT_D").alias("direct_pick_status"),
            F.col("h.ZZQUEUE").alias("queue"),

            F.col("h.BNAME").alias("created_by_user"),
            F.col("h.TBPRI").alias("transfer_priority"),

            F.col("i._change_replicated_at").alias("_replicated_at"),
            F.col("i._change_run_id").alias("_run_id"),
            F.col("i._change_record_seq").alias("_record_seq"),
            F.coalesce(F.col("h.OPFLAG"), F.col("i._change_record_activity")).alias(
                "record_activity"
            ),
        )
    )

dlt.create_streaming_table(
    name="warehouse_transfer_requirement",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["plant_code", "created_datetime"],
)

dlt.apply_changes(
    target="warehouse_transfer_requirement",
    source="stg_warehouse_transfer_requirement",
    keys=["warehouse_number", "transfer_requirement_number", "item_number"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    apply_as_deletes=F.expr("record_activity = 'D'"),
    stored_as_scd_type=1,
)
