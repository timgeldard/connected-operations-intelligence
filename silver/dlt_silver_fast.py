"""
Lakeflow Spark Declarative Pipeline — Silver Layer (Fast Operational)
"""

import dlt
from pyspark.sql import functions as F
from silver.helpers import get_spark, BRONZE, PP_PI_ORDER_TYPES, strip_zeros, sap_date, sap_datetime, sap_flag

spark = get_spark()

# ── 1. PROCESS ORDER ─────────────────────────────────────────────────────────
#    Sources: ordermaster_aufk (status / CO) + productionorderobject_afko
#             (scheduling / quantities / routing)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.view(name="stg_process_order")
@dlt.expect_or_drop("order_number present",      "order_number IS NOT NULL")
@dlt.expect_or_drop("plant_code present",        "plant_code IS NOT NULL")
@dlt.expect(        "quantity non-negative",     "order_quantity >= 0")
@dlt.expect(        "scheduled dates ordered",   "scheduled_start_date <= scheduled_finish_date OR scheduled_start_date IS NULL OR scheduled_finish_date IS NULL")
@dlt.expect(        "actual dates ordered",      "actual_start_date <= actual_finish_date OR actual_start_date IS NULL OR actual_finish_date IS NULL")
def stg_process_order():
    aufk = spark.readStream.table(f"{BRONZE}.ordermaster_aufk")
    afko = spark.read.table(f"{BRONZE}.productionorderobject_afko")

    order_filter = (
        F.col("k.AUART").isin(PP_PI_ORDER_TYPES)
        if PP_PI_ORDER_TYPES
        else F.lit(True)
    )

    return (
        aufk.alias("k")
        .join(afko.alias("h"), ["AUFNR", "MANDT"], "left")
        .filter(order_filter)
        .select(
            # ── Natural key
            strip_zeros("k.AUFNR").alias("order_number"),

            # ── Organisation
            F.col("k.WERKS").alias("plant_code"),
            F.col("k.BUKRS").alias("company_code"),
            F.col("k.GSBER").alias("business_area"),
            F.col("k.PRCTR").alias("profit_centre"),

            # ── Order attributes
            F.col("k.AUART").alias("order_type_code"),
            F.col("k.KTEXT").alias("order_description"),
            strip_zeros("k.PROCNR").alias("production_process_number"),
            F.col("k.VAPLZ").alias("main_work_centre_code"),

            # ── Material & quantity (AFKO)
            strip_zeros("h.PLNBEZ").alias("material_code"),
            F.col("h.GAMNG").alias("order_quantity"),
            F.col("h.GMEIN").alias("order_quantity_uom"),
            F.col("h.GASMG").alias("total_scrap_quantity"),
            F.col("h.IGMNG").alias("confirmed_yield_quantity"),
            F.col("h.DISPO").alias("mrp_controller"),
            F.col("h.FEVOR").alias("production_supervisor_code"),
            F.col("h.APRIO").alias("order_priority"),

            # ── Scheduling dates (AFKO)
            sap_date("h.GSTRP").alias("basic_start_date"),
            sap_date("h.GLTRP").alias("basic_finish_date"),
            sap_date("h.GSTRS").alias("scheduled_start_date"),
            sap_date("h.GLTRS").alias("scheduled_finish_date"),
            sap_datetime("h.GSTRS", "h.GSUZS").alias("scheduled_start_datetime"),
            sap_datetime("h.GLTRS", "h.GLUZS").alias("scheduled_finish_datetime"),
            sap_date("h.GSTRI").alias("actual_start_date"),
            sap_date("h.GLTRI").alias("actual_finish_date"),
            sap_date("h.FTRMI").alias("actual_release_date"),

            # ── Status lifecycle (AUFK)
            sap_date("k.ERDAT").alias("created_date"),
            F.col("k.ERNAM").alias("created_by"),
            sap_date("k.STDAT").alias("last_status_change_date"),
            sap_flag("k.PHAS0").alias("is_created"),
            sap_flag("k.PHAS1").alias("is_released"),
            sap_flag("k.PHAS2").alias("is_completed"),
            sap_flag("k.PHAS3").alias("is_closed"),
            sap_flag("k.LOEKZ").alias("is_deletion_flagged"),

            # ── Linkages
            strip_zeros("k.KDAUF").alias("sales_order_number"),
            F.col("k.KDPOS").alias("sales_order_item"),
            F.col("h.PRUEFLOS").alias("inspection_lot_number"),
            F.col("h.RSNUM").alias("reservation_number"),

            # ── Aecorsoft system columns
            F.col("k.AEDATTM").alias("_replicated_at"),
            F.col("k.AERUNID").alias("_run_id"),
            F.col("k.RecordActivity").alias("record_activity"),
        )
    )


dlt.apply_changes(
    target="process_order",
    source="stg_process_order",
    keys=["order_number"],
    sequence_by=F.col("_replicated_at"),
    apply_as_deletes=F.expr("record_activity = 'D'"),
    stored_as_scd_type=1,
    cluster_by=["plant_code", "scheduled_start_date"],
)


# ─────────────────────────────────────────────────────────────────────────────
# ── 2. PROCESS ORDER OPERATION ────────────────────────────────────────────────
#    Sources: processorderobject_afvc (operation master)
#             + dbstructureoperationquantitydatevalues_afvv (dates / quantities)
#             + productionorderobject_afko (to resolve order_number)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.view(name="stg_process_order_operation")
@dlt.expect_or_drop("order_number present",     "order_number IS NOT NULL")
@dlt.expect_or_drop("operation_number present", "operation_number IS NOT NULL")
@dlt.expect(        "plant_code present",       "plant_code IS NOT NULL")
@dlt.expect(        "scheduled dates ordered",  "scheduled_start_datetime <= scheduled_finish_datetime OR scheduled_start_datetime IS NULL OR scheduled_finish_datetime IS NULL")
def stg_process_order_operation():
    afvc = spark.readStream.table(f"{BRONZE}.processorderobject_afvc")
    afvv = spark.read.table(f"{BRONZE}.dbstructureoperationquantitydatevalues_afvv")
    afko = spark.read.table(
        f"{BRONZE}.productionorderobject_afko"
    ).select("AUFPL", "AUFNR", "MANDT")

    return (
        afvc.alias("o")
        .join(afvv.alias("v"),  ["AUFPL", "APLZL", "MANDT"], "left")
        .join(afko.alias("h"),  ["AUFPL",           "MANDT"], "left")
        .select(
            # ── Natural key
            strip_zeros("h.AUFNR").alias("order_number"),
            F.col("o.VORNR").alias("operation_number"),

            # ── Organisation
            F.col("o.WERKS").alias("plant_code"),
            F.col("o.ARBID").alias("work_centre_internal_id"),

            # ── Operation description
            F.col("o.LTXA1").alias("operation_description"),
            F.col("o.STEUS").alias("control_key"),
            F.col("o.RFGRP").alias("setup_group_category"),
            F.col("o.RFSCH").alias("setup_group_key"),
            F.col("o.ANZMA").cast("integer").alias("number_of_employees"),

            # ── Scheduled execution window (latest dates from AFVV)
            sap_datetime("v.SSAVD", "v.SSAVZ").alias("scheduled_start_datetime"),
            sap_datetime("v.SSEDD", "v.SSEDZ").alias("scheduled_finish_datetime"),

            # ── Actual execution
            sap_datetime("v.ISDD",  "v.ISDZ").alias("actual_start_datetime"),
            sap_date("v.IEAVD").alias("actual_finish_date"),
            sap_datetime("v.ISBD",  "v.ISBZ").alias("actual_processing_start_datetime"),
            sap_date("v.IEBD").alias("actual_processing_finish_date"),

            # ── Quantities & work
            F.col("v.MGVRG").alias("operation_quantity"),
            F.col("v.LMNGA").alias("confirmed_yield_quantity"),
            F.col("v.XMNGA").alias("confirmed_scrap_quantity"),
            F.col("v.ARBEI").alias("planned_work"),
            F.col("v.ARBEH").alias("planned_work_unit"),
            F.col("v.ISM01").alias("confirmed_activity_1"),
            F.col("v.ISMNW").alias("actual_work"),

            # ── Duration standard values
            F.col("v.DAUNO").alias("standard_duration"),
            F.col("v.DAUNE").alias("standard_duration_unit"),

            # ── Confirmation reference
            F.col("o.RUECK").alias("confirmation_number"),
            F.when(F.col("o.RUECK").isNotNull(), True).otherwise(False).alias("is_confirmed"),

            # ── Aecorsoft system columns
            F.col("o.AEDATTM").alias("_replicated_at"),
            F.col("o.AERUNID").alias("_run_id"),
        )
    )


dlt.apply_changes(
    target="process_order_operation",
    source="stg_process_order_operation",
    keys=["order_number", "operation_number"],
    sequence_by=F.col("_replicated_at"),
    stored_as_scd_type=1,
    cluster_by=["plant_code", "scheduled_start_datetime"],
)


# ─────────────────────────────────────────────────────────────────────────────
# ── 3. PI SHEET EXECUTION ─────────────────────────────────────────────────────
#    Source: actualpistartenddatetime_zmanpex_e04_002
# ─────────────────────────────────────────────────────────────────────────────

@dlt.view(name="stg_pi_sheet_execution")
@dlt.expect_or_drop("order_number present",    "order_number IS NOT NULL")
@dlt.expect_or_drop("operation_number present","operation_number IS NOT NULL")
@dlt.expect(        "start before end",        "pi_sheet_start_datetime <= pi_sheet_end_datetime OR pi_sheet_end_datetime IS NULL")
def stg_pi_sheet_execution():
    src = spark.readStream.table(
        f"{BRONZE}.actualpistartenddatetime_zmanpex_e04_002"
    )
    return src.select(
        F.col("ZWERKS").alias("plant_code"),
        strip_zeros("ZAUFNR").alias("order_number"),
        F.col("ZVORNR").alias("operation_number"),

        sap_datetime("ZSDATS", "ZSTIMS").alias("pi_sheet_start_datetime"),
        sap_datetime("ZEDATS", "ZETIMS").alias("pi_sheet_end_datetime"),
        F.col("ZDUR").alias("duration_decimal_days"),
        F.round(F.col("ZDUR") * 24, 4).alias("duration_hours"),

        F.col("ZUSERSTART").alias("started_by_user"),
        F.col("ZUSEREND").alias("completed_by_user"),

        F.when(F.col("ZEDATS").isNotNull(), "Completed")
         .when(F.col("ZSDATS").isNotNull(), "In Progress")
         .otherwise("Not Started").alias("pi_sheet_status"),

        F.col("AEDATTM").alias("_replicated_at"),
    )


dlt.apply_changes(
    target="pi_sheet_execution",
    source="stg_pi_sheet_execution",
    keys=["plant_code", "order_number", "operation_number"],
    sequence_by=F.col("_replicated_at"),
    stored_as_scd_type=1,
    cluster_by=["plant_code", "pi_sheet_start_datetime"],
)


# ─────────────────────────────────────────────────────────────────────────────
# ── 4. GOODS MOVEMENT ────────────────────────────────────────────────────────
#    Sources: inventorymovement_mseg + materialdocument_mkpf (header)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.view(name="stg_goods_movement")
@dlt.expect_or_drop("document_number present",    "material_document_number IS NOT NULL")
@dlt.expect_or_drop("plant_code present",         "plant_code IS NOT NULL")
@dlt.expect(        "movement_type_code present", "movement_type_code IS NOT NULL")
def stg_goods_movement():
    mseg = spark.readStream.table(f"{BRONZE}.inventorymovement_mseg")
    mkpf = spark.read.table(f"{BRONZE}.materialdocument_mkpf").select(
        "MBLNR", "MJAHR", "MANDT", "BUDAT", "BLDAT", "USNAM", "TCODE"
    )
    return (
        mseg.alias("s")
        .join(mkpf.alias("h"), ["MBLNR", "MJAHR", "MANDT"], "left")
        .select(
            # ── Natural key
            strip_zeros("s.MBLNR").alias("material_document_number"),
            F.col("s.MJAHR").alias("fiscal_year"),
            F.col("s.ZEILE").alias("document_line_item"),

            # ── Organisation
            F.col("s.WERKS").alias("plant_code"),
            F.col("s.LGORT").alias("storage_location_code"),

            # ── Material & batch
            strip_zeros("s.MATNR").alias("material_code"),
            strip_zeros("s.CHARG").alias("batch_number"),

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
            strip_zeros("s.EBELN").alias("purchase_order_number"),
            F.col("s.EBELP").alias("purchase_order_item"),
            strip_zeros("s.VBELN").alias("delivery_number"),
            F.col("s.KDAUF").alias("sales_order_number"),

            # ── User
            F.col("h.USNAM").alias("posted_by_user"),
            F.col("h.TCODE").alias("transaction_code"),

            F.col("s.AEDATTM").alias("_replicated_at"),
            F.col("s.AERUNID").alias("_run_id"),
        )
    )


dlt.apply_changes(
    target="goods_movement",
    source="stg_goods_movement",
    keys=["material_document_number", "fiscal_year", "document_line_item"],
    sequence_by=F.col("_replicated_at"),
    stored_as_scd_type=1,
    cluster_by=["plant_code", "posting_date"],
)


# ─────────────────────────────────────────────────────────────────────────────
# ── 5. BATCH STOCK ────────────────────────────────────────────────────────────
#    Source: batchstock_mchb (current batch stock by plant / storage location)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.view(name="stg_batch_stock")
@dlt.expect_or_drop("material_code present",              "material_code IS NOT NULL")
@dlt.expect_or_drop("plant_code present",                 "plant_code IS NOT NULL")
@dlt.expect(        "unrestricted quantity non-negative", "unrestricted_quantity >= 0")
def stg_batch_stock():
    src = spark.readStream.table(f"{BRONZE}.batchstock_mchb")
    return src.select(
        strip_zeros("MATNR").alias("material_code"),
        F.col("WERKS").alias("plant_code"),
        F.col("LGORT").alias("storage_location_code"),
        strip_zeros("CHARG").alias("batch_number"),

        F.col("CLABS").alias("unrestricted_quantity"),
        F.col("CINSM").alias("quality_inspection_quantity"),
        F.col("CSPEM").alias("blocked_quantity"),
        F.col("CEINM").alias("restricted_use_quantity"),
        F.col("CUMLM").alias("in_transfer_quantity"),
        F.col("CRETM").alias("blocked_returns_quantity"),
        F.col("MEINS").alias("base_uom"),  # derived via MARA join at Gold

        # Previous period (for trend / delta)
        F.col("CVMLA").alias("prev_period_unrestricted_quantity"),
        F.col("CVMIN").alias("prev_period_quality_inspection_quantity"),

        F.col("LFGJA").alias("fiscal_year"),
        F.col("LFMON").alias("fiscal_period"),

        F.col("AEDATTM").alias("_replicated_at"),
        F.col("AERUNID").alias("_run_id"),
    )


dlt.apply_changes(
    target="batch_stock",
    source="stg_batch_stock",
    keys=["material_code", "plant_code", "storage_location_code", "batch_number"],
    sequence_by=F.col("_replicated_at"),
    stored_as_scd_type=1,
    cluster_by=["plant_code", "storage_location_code"],
)


# ─────────────────────────────────────────────────────────────────────────────
# ── 6. WAREHOUSE TRANSFER ORDER ───────────────────────────────────────────────
#    Sources: transferorderobjects_ltak (header) + transferorderobjects_ltap
# ─────────────────────────────────────────────────────────────────────────────

@dlt.view(name="stg_warehouse_transfer_order")
@dlt.expect_or_drop("warehouse_number present",       "warehouse_number IS NOT NULL")
@dlt.expect_or_drop("transfer_order_number present",  "transfer_order_number IS NOT NULL")
def stg_warehouse_transfer_order():
    ltak = spark.readStream.table(f"{BRONZE}.transferorderobjects_ltak")
    ltap = spark.read.table(f"{BRONZE}.transferorderobjects_ltap")

    return (
        ltak.alias("h")
        .join(ltap.alias("i"), ["LGNUM", "TANUM", "MANDT"], "left")
        .select(
            # ── Natural key
            F.col("i.LGNUM").alias("warehouse_number"),
            F.col("i.TANUM").alias("transfer_order_number"),
            F.col("i.TAPOS").alias("item_number"),

            # ── Organisation
            F.col("i.WERKS").alias("plant_code"),

            # ── Material & batch
            strip_zeros("i.MATNR").alias("material_code"),
            strip_zeros("i.CHARG").alias("batch_number"),
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
            strip_zeros("h.VBELN").alias("delivery_number"),
            F.col("h.TBPRI").alias("transfer_priority"),

            # ── Users
            F.col("h.BNAME").alias("created_by_user"),
            F.col("i.QNAME").alias("confirmed_by_user"),

            F.col("h.AEDATTM").alias("_replicated_at"),
            F.col("h.AERUNID").alias("_run_id"),
            F.col("h.RecordActivity").alias("record_activity"),
        )
    )


dlt.apply_changes(
    target="warehouse_transfer_order",
    source="stg_warehouse_transfer_order",
    keys=["warehouse_number", "transfer_order_number", "item_number"],
    sequence_by=F.col("_replicated_at"),
    apply_as_deletes=F.expr("record_activity = 'D'"),
    stored_as_scd_type=1,
    cluster_by=["plant_code", "created_datetime"],
)


# ─────────────────────────────────────────────────────────────────────────────
# ── 7. WAREHOUSE TRANSFER REQUIREMENT ─────────────────────────────────────────
#    Sources: transferrequirementobjects_ltbk (header)
#             + transferrequirementobjects_ltbp (item)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.view(name="stg_warehouse_transfer_requirement")
@dlt.expect_or_drop("warehouse_number present",            "warehouse_number IS NOT NULL")
@dlt.expect_or_drop("transfer_requirement_number present", "transfer_requirement_number IS NOT NULL")
@dlt.expect(        "required quantity positive",          "required_quantity > 0")
def stg_warehouse_transfer_requirement():
    ltbk = spark.readStream.table(f"{BRONZE}.transferrequirementobjects_ltbk")
    ltbp = spark.read.table(f"{BRONZE}.transferrequirementobjects_ltbp")

    return (
        ltbk.alias("h")
        .join(ltbp.alias("i"), ["LGNUM", "TBNUM", "MANDT"], "left")
        .select(
            # ── Natural key
            F.col("i.LGNUM").alias("warehouse_number"),
            F.col("i.TBNUM").alias("transfer_requirement_number"),
            F.col("i.TBPOS").alias("item_number"),

            # ── Organisation
            F.col("i.WERKS").alias("plant_code"),

            # ── Material & batch
            strip_zeros("i.MATNR").alias("material_code"),
            strip_zeros("i.CHARG").alias("batch_number"),
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
            F.col("h.RSNUM").alias("reservation_number"),

            # ── Custom fields (site-specific campaign / pick status)
            F.col("h.ZZ_CAMPAIGN").alias("campaign_reference"),
            F.col("h.ZZ_PICK_STAT_M").alias("manual_pick_status"),
            F.col("h.ZZ_PICK_STAT_D").alias("direct_pick_status"),
            F.col("h.ZZQUEUE").alias("queue"),

            F.col("h.BNAME").alias("created_by_user"),
            F.col("h.TBPRI").alias("transfer_priority"),

            F.col("h.AEDATTM").alias("_replicated_at"),
            F.col("h.AERUNID").alias("_run_id"),
            F.col("h.OPFLAG").alias("record_activity"),
        )
    )


dlt.apply_changes(
    target="warehouse_transfer_requirement",
    source="stg_warehouse_transfer_requirement",
    keys=["warehouse_number", "transfer_requirement_number", "item_number"],
    sequence_by=F.col("_replicated_at"),
    apply_as_deletes=F.expr("record_activity = 'D'"),
    stored_as_scd_type=1,
    cluster_by=["plant_code", "created_datetime"],
)


# ─────────────────────────────────────────────────────────────────────────────
# ── 9. DOWNTIME EVENT ─────────────────────────────────────────────────────────
#    Source: downtime_zpexpm_dwnt
#    Reason description is already denormalised in the source Z-table.
# ─────────────────────────────────────────────────────────────────────────────

@dlt.view(name="stg_downtime_event")
@dlt.expect_or_drop("plant_code present",      "plant_code IS NOT NULL")
@dlt.expect_or_drop("start_date present",      "start_datetime IS NOT NULL")
@dlt.expect(        "duration non-negative",   "duration_minutes >= 0")
def stg_downtime_event():
    src = spark.readStream.table(f"{BRONZE}.downtime_zpexpm_dwnt")
    return (
        src.filter(F.col("ZDEL").isNull() | (F.col("ZDEL") != "X"))   # exclude soft-deleted rows
        .select(
            # ── Natural key (composite — no single surrogate in Z-table)
            strip_zeros("AUFNR").alias("order_number"),
            F.col("WERKS").alias("plant_code"),
            strip_zeros("MATNR").alias("material_code"),
            F.col("VORNR").alias("operation_number"),
            F.col("ZITEM").alias("item_number"),

            # ── Work centre & machine
            F.col("ARBPL").alias("work_centre_code"),
            F.col("LTXA1").alias("operation_description"),
            F.col("ZTPLNR").alias("machine_code"),
            F.col("ZPLTXT").alias("machine_description"),
            F.col("PRO_LINE_DES").alias("production_line_description"),

            # ── Reason
            F.col("ZRCD").alias("downtime_reason_code"),
            F.col("ZTEXT").alias("downtime_reason_description"),
            F.col("ZSUB").alias("sub_reason_code"),
            F.col("ZSRTXT").alias("sub_reason_description"),

            # ── Times
            sap_datetime("ZAUSVN", "ZAUZTV").alias("start_datetime"),
            sap_datetime("ZAUSBS", "ZAUZTB").alias("end_datetime"),
            (F.col("ZEAUSZT") * 60).alias("duration_minutes"),

            # ── Notification
            F.col("QMNUM").alias("quality_notification_number"),
            F.col("Z2_QMNUM").alias("secondary_notification_number"),
            F.col("QMNAM").alias("reported_by_user"),
            F.col("ZTEXT1").alias("comment"),

            F.col("AEDATTM").alias("_replicated_at"),
        )
    )


dlt.apply_changes(
    target="downtime_event",
    source="stg_downtime_event",
    keys=["order_number", "plant_code", "operation_number", "item_number"],
    sequence_by=F.col("_replicated_at"),
    stored_as_scd_type=1,
    cluster_by=["plant_code", "start_datetime"],
)


# ─────────────────────────────────────────────────────────────────────────────
