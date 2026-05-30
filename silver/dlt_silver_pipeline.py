"""
Lakeflow Spark Declarative Pipeline — Silver Layer

Deployed via DAB bundle: databricks.yml / resources/silver_pipeline.pipeline.yml
  target catalog  : controlled by var.catalog   (default: connected_plant_prod)
  target schema   : controlled by var.schema    (default: silver)
  source catalog  : spark.conf source_catalog   (default: connected_plant_prod)
  source schema   : spark.conf source_schema    (default: sap)
  pipeline mode   : Continuous
  channel         : Current

Actual target and source catalogs are controlled dynamically via Databricks Asset Bundle target variables.
Fallback defaults point to production.

All silver tables use SCD Type 1 (apply_changes) with liquid clustering.
Source tables are in the Aecorsoft Delta replication schema.
"""

import dlt
from pyspark.sql import Column
from pyspark.sql import functions as F

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

try:
    BRONZE = (
        f"{spark.conf.get('source_catalog', 'connected_plant_prod')}"
        f".{spark.conf.get('source_schema', 'sap')}"
    )
except NameError:
    BRONZE = "connected_plant_prod.sap"

# TODO: Confirm PP-PI process order types with plant operations teams.
# Once confirmed, populate this list, e.g. ["PI01", "PI02", "ZPI1"].
# While None, all order categories are included.
PP_PI_ORDER_TYPES = None

# ─────────────────────────────────────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────────────────────────────────────

def strip_zeros(col_name: str) -> Column:
    """Remove SAP database-level leading zeros from key identifier fields."""
    return F.regexp_replace(F.col(col_name), r"^0+", "")

def sap_date(col_name: str) -> Column:
    """Cast SAP YYYYMMDD string to DATE. Returns NULL for SAP sentinel '00000000' or blank."""
    return F.try_to_date(F.col(col_name), "yyyyMMdd")

def sap_datetime(date_col: str, time_col: str) -> Column:
    """Combine SAP YYYYMMDD date + HHMMSS time strings into TIMESTAMP. Returns NULL if either part is blank."""
    return F.try_to_timestamp(
        F.concat(F.col(date_col), F.lpad(F.col(time_col), 6, "0")),
        F.lit("yyyyMMddHHmmss"),
    )

def sap_flag(col_name: str) -> Column:
    """Convert SAP 'X' / blank flag to boolean."""
    return F.when(F.col(col_name) == "X", True).otherwise(False)

# ─────────────────────────────────────────────────────────────────────────────
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
# ── 8. WAREHOUSE PLANT MAPPING (reference) ───────────────────────────────────
#    Source: warehouseforplant_t320
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(
    name="warehouse_plant_mapping",
    comment="Warehouse to Plant mapping (SAP T320)",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_or_drop("warehouse_number present", "warehouse_number IS NOT NULL")
@dlt.expect_or_drop("plant_code present",       "plant_code IS NOT NULL")
def warehouse_plant_mapping():
    src = spark.read.table(f"{BRONZE}.warehouseforplant_t320")
    return src.select(
        F.col("LGNUM").alias("warehouse_number"),
        F.col("WERKS").alias("plant_code"),
        F.col("LGORT").alias("storage_location_code"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


# ── 9. STORAGE BIN ────────────────────────────────────────────────────────────
#    Sources: storagebin_lagp (bin master) + quant_lqua (current occupancy)
#             + warehouse_plant_mapping (T320 fallback plant mapping)
#    All bins are included; bins with no quant show NULL occupancy fields.
# ─────────────────────────────────────────────────────────────────────────────

@dlt.view(name="stg_storage_bin")
@dlt.expect_or_drop("warehouse_number present", "warehouse_number IS NOT NULL")
@dlt.expect_or_drop("bin_code present",          "bin_code IS NOT NULL")
def stg_storage_bin():
    lagp = spark.readStream.table(f"{BRONZE}.storagebin_lagp")
    lqua = spark.read.table(f"{BRONZE}.quant_lqua")
    t320 = dlt.read("warehouse_plant_mapping")

    bins_with_quants = (
        lagp.alias("b")
        .join(lqua.alias("q"),
              (F.col("b.LGNUM") == F.col("q.LGNUM")) &
              (F.col("b.LGTYP") == F.col("q.LGTYP")) &
              (F.col("b.LGPLA") == F.col("q.LGPLA")) &
              (F.col("b.MANDT") == F.col("q.MANDT")),
              "left")
    )

    return (
        bins_with_quants
        .join(t320.alias("m"),
              F.col("b.LGNUM") == F.col("m.warehouse_number"),
              "left")
        .select(
            # ── Natural key (bin + plant)
            F.col("b.LGNUM").alias("warehouse_number"),
            F.col("b.LGTYP").alias("storage_type"),
            F.col("b.LGPLA").alias("bin_code"),
            F.coalesce(F.col("q.WERKS"), F.col("m.plant_code")).alias("plant_code"),

            # ── Bin attributes
            F.col("b.LGBER").alias("storage_section"),
            F.col("b.LGBKT").alias("bin_type"),
            F.col("b.KOBER").alias("picking_area"),
            F.col("b.LGPBE").alias("storage_bin_structure"),
            F.col("b.MAXGW").alias("maximum_weight"),
            F.col("b.BRGEW").alias("current_weight"),
            F.col("b.GEWEI").alias("weight_unit"),
            F.col("b.MAXEI").alias("maximum_capacity_units"),
            F.col("b.ANZRE").alias("current_capacity_units_used"),
            sap_flag("b.SPGRU").alias("is_blocked"),
            F.col("b.SPGRU").alias("blocking_reason_code"),

            # ── Current quant (NULL if bin is empty)
            F.col("q.LQNUM").alias("quant_number"),
            strip_zeros("q.MATNR").alias("material_code"),
            strip_zeros("q.CHARG").alias("batch_number"),
            F.col("q.BESTQ").alias("stock_category_code"),
            F.col("q.GESME").alias("total_quantity"),
            F.col("q.VERME").alias("available_quantity"),
            F.col("q.EINME").alias("putaway_quantity"),
            F.col("q.AUSME").alias("pick_quantity"),
            F.col("q.TRAME").alias("open_transfer_quantity"),
            F.col("q.MEINS").alias("base_uom"),
            sap_date("q.WDATU").alias("goods_receipt_date"),
            sap_date("q.VFDAT").alias("expiry_date"),
            sap_datetime("q.BDATU", "q.BZEIT").alias("last_movement_datetime"),
            sap_flag("q.SKZUA").alias("is_blocked_for_stock_removal"),
            sap_flag("q.SKZUE").alias("is_blocked_for_putaway"),

            F.col("b.AEDATTM").alias("_replicated_at"),
            F.col("b.AERUNID").alias("_run_id"),
        )
    )


dlt.apply_changes(
    target="storage_bin",
    source="stg_storage_bin",
    keys=["warehouse_number", "storage_type", "bin_code", "plant_code"],
    sequence_by=F.col("_replicated_at"),
    stored_as_scd_type=1,
    cluster_by=["warehouse_number", "storage_type", "plant_code"],
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
# ── 10. QUALITY INSPECTION LOT ────────────────────────────────────────────────
#    Sources: inspection_qals (lot) + qualitymessage_qmih (link to order)
#             + inspection_qamv (characteristic results summary)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.view(name="stg_quality_inspection_lot")
@dlt.expect_or_drop("inspection_lot_number present", "inspection_lot_number IS NOT NULL")
@dlt.expect_or_drop("plant_code present",            "plant_code IS NOT NULL")
@dlt.expect(        "material_code present",         "material_code IS NOT NULL")
@dlt.expect(        "inspection dates ordered",      "inspection_start_date <= inspection_end_date OR inspection_start_date IS NULL OR inspection_end_date IS NULL")
def stg_quality_inspection_lot():
    qals = spark.readStream.table(f"{BRONZE}.inspection_qals")
    qmih = spark.read.table(f"{BRONZE}.qualitymessage_qmih").select(
        "PRUEFLOS", "MANDT", "QMNUM", "AUFNR"
    )
    return (
        qals.alias("l")
        .join(qmih.alias("m"), (F.col("l.PRUEFLOS") == F.col("m.PRUEFLOS")) & (F.col("l.MANDT") == F.col("m.MANDT")), "left")
        .select(
            F.col("l.PRUEFLOS").alias("inspection_lot_number"),
            F.col("l.WERKS").alias("plant_code"),
            strip_zeros("l.MATNR").alias("material_code"),
            strip_zeros("l.CHARG").alias("batch_number"),
            strip_zeros("m.AUFNR").alias("order_number"),
            F.col("m.QMNUM").alias("quality_notification_number"),

            F.col("l.LOTORIGIN").alias("inspection_lot_origin_code"),
            F.col("l.MENGE").alias("inspection_lot_quantity"),
            F.col("l.MEINH").alias("inspection_lot_uom"),

            sap_date("l.ENSTDE").alias("inspection_start_date"),
            sap_date("l.EENDDE").alias("inspection_end_date"),

            F.col("l.VCODE").alias("usage_decision_code"),
            F.col("l.VENDAT").alias("usage_decision_date"),
            F.when(F.col("l.VCODE").isin("A", "AA"), "Accepted")
             .when(F.col("l.VCODE").isin("R", "RA"), "Rejected")
             .when(F.col("l.VCODE").isNotNull(),      "Other Decision")
             .otherwise("Pending").alias("usage_decision"),

            sap_flag("l.KZLOESCH").alias("is_deletion_flagged"),

            F.col("l.AEDATTM").alias("_replicated_at"),
            F.col("l.AERUNID").alias("_run_id"),
        )
    )


dlt.apply_changes(
    target="quality_inspection_lot",
    source="stg_quality_inspection_lot",
    keys=["inspection_lot_number"],
    sequence_by=F.col("_replicated_at"),
    stored_as_scd_type=1,
    cluster_by=["plant_code", "inspection_start_date"],
)


# ─────────────────────────────────────────────────────────────────────────────
# ── 11. MATERIAL  (reference / slowly changing) ───────────────────────────────
#    Sources: materialmaster_mara + materialforplant_marc + materialdescription_makt
#             + loftwareplantmaterialdata_zmanpex_loft_x (compliance / labelling)
#    Batch read — refreshed each pipeline trigger.
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(
    comment="Material master — one row per material per plant, with descriptions and compliance attributes",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "material_type"],
)
@dlt.expect_or_drop("material_code present", "material_code IS NOT NULL")
@dlt.expect_or_drop("plant_code present",    "plant_code IS NOT NULL")
@dlt.expect(        "base_uom present",      "base_uom IS NOT NULL")
@dlt.expect(        "material_type present", "material_type IS NOT NULL")
def material():
    mara  = spark.read.table(f"{BRONZE}.materialmaster_mara")
    marc  = spark.read.table(f"{BRONZE}.materialforplant_marc")
    makt  = spark.read.table(f"{BRONZE}.materialdescription_makt").filter(
        F.col("SPRAS") == "E"
    )
    loft  = spark.read.table(f"{BRONZE}.loftwareplantmaterialdata_zmanpex_loft_x")

    return (
        marc.alias("p")
        .join(mara.alias("g"), ["MATNR", "MANDT"], "left")
        .join(makt.alias("d"), ["MATNR", "MANDT"], "left")
        .join(loft.alias("l"), ["MATNR", "MANDT"], "left")
        .select(
            strip_zeros("p.MATNR").alias("material_code"),
            F.col("p.WERKS").alias("plant_code"),

            # ── Descriptions
            F.col("d.MAKTX").alias("material_description"),
            F.col("g.MTART").alias("material_type"),
            F.col("g.MATKL").alias("material_group"),
            F.col("g.MEINS").alias("base_uom"),

            # ── Physical attributes
            F.col("g.NTGEW").alias("net_weight"),
            F.col("g.BRGEW").alias("gross_weight"),
            F.col("g.GEWEI").alias("weight_unit"),
            F.col("g.MHDRZ").alias("shelf_life_days"),
            F.col("g.MHDLP").alias("minimum_remaining_shelf_life_days"),

            # ── Batch & storage
            sap_flag("g.XCHPF").alias("batch_management_required"),
            F.col("g.IPRKZ").alias("storage_conditions_code"),
            F.col("l.STORCOND").alias("storage_conditions_description"),
            F.col("g.STOFF").alias("hazardous_material_number"),

            # ── Plant-specific MRP
            F.col("p.DISPO").alias("mrp_controller"),
            F.col("p.DISMM").alias("mrp_type"),
            F.col("p.FEVOR").alias("production_supervisor_code"),
            F.col("p.LGPRO").alias("production_storage_location"),
            F.col("p.LGFSB").alias("goods_receipt_storage_location"),

            # ── Compliance (from Loftware Z-table)
            sap_flag("l.KOSHERSUIT").alias("is_kosher_suitable"),
            sap_flag("l.KOSHERAPP").alias("is_kosher_approved"),
            sap_flag("l.HALALSUIT").alias("is_halal_suitable"),
            sap_flag("l.HALALAPP").alias("is_halal_approved"),
            sap_flag("l.ORGANICSUIT").alias("is_organic_suitable"),
            sap_flag("l.ORGANICAPP").alias("is_organic_approved"),
            F.col("l.ZGMO_CODE").alias("gmo_code"),

            # ── Label templates
            F.col("l.Z_LOFTWARE_LABEL").alias("label_layout"),
            F.col("l.ZZPALLBLTEMP").alias("pallet_label_template"),

            F.col("p.AEDATTM").alias("_replicated_at"),
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# ── 12. STORAGE LOCATION  (reference) ─────────────────────────────────────────
#    Source: storagelocation_t001l
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(
    comment="Storage locations — one row per storage location per plant",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_or_drop("plant_code present",            "plant_code IS NOT NULL")
@dlt.expect_or_drop("storage_location_code present", "storage_location_code IS NOT NULL")
def storage_location():
    src = spark.read.table(f"{BRONZE}.storagelocation_t001l")
    return src.select(
        F.col("WERKS").alias("plant_code"),
        F.col("LGORT").alias("storage_location_code"),
        F.col("LGOBE").alias("storage_location_description"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# ── 13. WORK CENTRE  (reference) ──────────────────────────────────────────────
#    Sources: workcenterheader_crhd + workcentertext_crtx
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(
    comment="Work centres — one row per work centre per plant, with descriptions",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_or_drop("work_centre_code present", "work_centre_code IS NOT NULL")
@dlt.expect_or_drop("plant_code present",       "plant_code IS NOT NULL")
def work_centre():
    crhd = spark.read.table(f"{BRONZE}.workcenterheader_crhd")
    crtx = spark.read.table(f"{BRONZE}.workcentertext_crtx").filter(
        F.col("SPRAS") == "E"
    )
    return (
        crhd.alias("w")
        .join(crtx.alias("t"), ["OBJID", "MANDT"], "left")
        .select(
            F.col("w.ARBPL").alias("work_centre_code"),
            F.col("w.WERKS").alias("plant_code"),
            F.col("t.KTEXT").alias("work_centre_description"),
            F.col("w.VERWE").alias("work_centre_category"),
            F.col("w.KOSTL").alias("cost_centre"),
            F.col("w.OBJID").alias("work_centre_internal_id"),
            F.col("w.AEDATTM").alias("_replicated_at"),
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# ── 14. CAPACITY UTILISATION ──────────────────────────────────────────────────
#    Sources: shiftparametersavailablecapacity_kapa
#             + capacityheadersegment_kako
# ─────────────────────────────────────────────────────────────────────────────

@dlt.view(name="stg_capacity_utilisation")
@dlt.expect_or_drop("plant_code present",   "plant_code IS NOT NULL")
@dlt.expect_or_drop("capacity_id present",  "capacity_id IS NOT NULL")
def stg_capacity_utilisation():
    kapa = spark.readStream.table(f"{BRONZE}.shiftparametersavailablecapacity_kapa")
    kako = spark.read.table(f"{BRONZE}.capacityheadersegment_kako").select(
        "KAPID", "MANDT", "ARBPL", "WERKS", "KAPAR"
    )
    return (
        kapa.alias("k")
        .join(kako.alias("h"), ["KAPID", "MANDT"], "left")
        .select(
            F.col("k.KAPID").alias("capacity_id"),
            F.col("h.ARBPL").alias("work_centre_code"),
            F.col("h.WERKS").alias("plant_code"),
            F.col("h.KAPAR").alias("capacity_category"),

            sap_date("k.DAFBI").alias("valid_from_date"),
            sap_date("k.DAFEI").alias("valid_to_date"),
            F.col("k.PAUSA").alias("break_duration"),
            F.col("k.BEGDA").alias("start_time"),
            F.col("k.ENDDA").alias("end_time"),
            F.col("k.KAPAZ").alias("available_capacity"),
            F.col("k.MEINH").alias("capacity_unit"),
            F.col("k.OEFFZ").alias("operating_time"),
            F.col("k.NORMA").alias("normal_capacity"),
            F.col("k.RUEZT").alias("setup_time_reduction"),

            F.col("k.AEDATTM").alias("_replicated_at"),
            F.col("k.AERUNID").alias("_run_id"),
        )
    )


dlt.apply_changes(
    target="capacity_utilisation",
    source="stg_capacity_utilisation",
    keys=["capacity_id", "valid_from_date"],
    sequence_by=F.col("_replicated_at"),
    stored_as_scd_type=1,
    cluster_by=["plant_code", "valid_from_date"],
)
