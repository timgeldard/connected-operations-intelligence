"""
Process Order domain tables.
"""

import dlt
from pyspark.sql import functions as F

from silver.helpers import (
    BRONZE,
    PP_PI_ORDER_CATEGORY,
    PP_PI_ORDER_TYPES,
    get_spark,
    sap_date,
    sap_datetime,
    sap_flag,
    strip_zeros,
)

spark = get_spark()

# ── 1. PROCESS ORDER ─────────────────────────────────────────────────────────

@dlt.view(name="stg_process_order")
@dlt.expect_all_or_drop({
    "order_number present": "order_number IS NOT NULL",
    "plant_code present": "plant_code IS NOT NULL OR record_activity = 'D'"
})
@dlt.expect_all({
    "quantity non-negative": "order_quantity >= 0 OR record_activity = 'D'",
    "scheduled dates ordered": "scheduled_start_date <= scheduled_finish_date OR scheduled_start_date IS NULL OR scheduled_finish_date IS NULL OR record_activity = 'D'",
    "actual dates ordered": "actual_start_date <= actual_finish_date OR actual_start_date IS NULL OR actual_finish_date IS NULL OR record_activity = 'D'"
})
def stg_process_order():
    aufk_changes = spark.readStream.table(f"{BRONZE}.ordermaster_aufk").select(
        "AUFNR", "MANDT", "AEDATTM", "AERUNID", "AERECNO", "RecordActivity"
    )
    afko_changes = (
        spark.readStream.table(f"{BRONZE}.productionorderobject_afko")
        .select("AUFNR", "MANDT", "AEDATTM", "AERUNID", "AERECNO")
        .withColumn("RecordActivity", F.lit(None).cast("string"))
    )

    changed_keys = aufk_changes.unionByName(afko_changes)
    aufk = spark.read.table(f"{BRONZE}.ordermaster_aufk")
    afko = spark.read.table(f"{BRONZE}.productionorderobject_afko")

    is_delete = F.coalesce(F.col("k.RecordActivity"), F.col("c.RecordActivity")) == "D"
    order_type_filter = (
        F.col("k.AUART").isin(PP_PI_ORDER_TYPES)
        if PP_PI_ORDER_TYPES
        else F.lit(True)
    )
    process_order_filter = is_delete | ((F.col("k.AUTYP") == PP_PI_ORDER_CATEGORY) & order_type_filter)

    return (
        changed_keys.alias("c")
        .join(aufk.alias("k"), ["AUFNR", "MANDT"], "left")
        .join(afko.alias("h"), ["AUFNR", "MANDT"], "left")
        .filter(process_order_filter)
        .select(
            # ── Natural key
            strip_zeros(F.coalesce(F.col("k.AUFNR"), F.col("c.AUFNR"))).alias("order_number"),
            F.coalesce(F.col("k.AUFNR"), F.col("c.AUFNR")).alias("order_number_raw"),

            # ── Organisation
            F.col("k.WERKS").alias("plant_code"),
            F.col("k.BUKRS").alias("company_code"),
            F.col("k.GSBER").alias("business_area"),
            F.col("k.PRCTR").alias("profit_centre"),

            # ── Order attributes
            F.col("k.AUART").alias("order_type_code"),
            F.col("k.KTEXT").alias("order_description"),
            strip_zeros("k.PROCNR").alias("production_process_number"),
            F.col("k.PROCNR").alias("production_process_number_raw"),
            F.col("k.VAPLZ").alias("main_work_centre_code"),

            # ── Material & quantity (AFKO)
            strip_zeros("h.PLNBEZ").alias("material_code"),
            F.col("h.PLNBEZ").alias("material_code_raw"),
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
            F.col("k.KDAUF").alias("sales_order_number_raw"),
            F.col("k.KDPOS").alias("sales_order_item"),
            F.col("h.PRUEFLOS").alias("inspection_lot_number"),
            F.col("h.RSNUM").alias("reservation_number"),

            # ── Aecorsoft system columns
            F.col("c.AEDATTM").alias("_replicated_at"),
            F.col("c.AERUNID").alias("_run_id"),
            F.col("c.AERECNO").alias("_record_seq"),
            F.coalesce(F.col("k.RecordActivity"), F.col("c.RecordActivity")).alias(
                "record_activity"
            ),
        )
    )

dlt.create_streaming_table(
    name="process_order",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["plant_code", "scheduled_start_date"],
)

dlt.apply_changes(
    target="process_order",
    source="stg_process_order",
    keys=["order_number"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    apply_as_deletes=F.expr("record_activity = 'D'"),
    stored_as_scd_type=1,
)

# ── 2. PROCESS ORDER OPERATION ────────────────────────────────────────────────

@dlt.view(name="stg_process_order_operation")
@dlt.expect_all_or_drop({
    "order_number present": "order_number IS NOT NULL",
    "operation_number present": "operation_number IS NOT NULL"
})
@dlt.expect_all({
    "plant_code present": "plant_code IS NOT NULL",
    "scheduled dates ordered": "scheduled_start_datetime <= scheduled_finish_datetime OR scheduled_start_datetime IS NULL OR scheduled_finish_datetime IS NULL"
})
def stg_process_order_operation():
    afvc_changes = spark.readStream.table(f"{BRONZE}.processorderobject_afvc").select(
        "AUFPL", "APLZL", "MANDT", "AEDATTM", "AERUNID", "AERECNO"
    )
    afvv_changes = spark.readStream.table(
        f"{BRONZE}.dbstructureoperationquantitydatevalues_afvv"
    ).select("AUFPL", "APLZL", "MANDT", "AEDATTM", "AERUNID", "AERECNO")
    afko_changes = (
        spark.readStream.table(f"{BRONZE}.productionorderobject_afko")
        .select("AUFPL", "MANDT", "AEDATTM", "AERUNID", "AERECNO")
        .withColumn("APLZL", F.lit(None).cast("string"))
    )

    changed_keys = afvc_changes.unionByName(afvv_changes).unionByName(afko_changes)
    afvc = spark.read.table(f"{BRONZE}.processorderobject_afvc")
    afvv = spark.read.table(f"{BRONZE}.dbstructureoperationquantitydatevalues_afvv")
    afko = spark.read.table(
        f"{BRONZE}.productionorderobject_afko"
    ).select("AUFPL", "AUFNR", "MANDT")

    operations_to_refresh = (
        changed_keys.alias("c")
        .join(
            afvc.alias("o"),
            (F.col("c.AUFPL") == F.col("o.AUFPL"))
            & (F.col("c.MANDT") == F.col("o.MANDT"))
            & (F.col("c.APLZL").isNull() | (F.col("c.APLZL") == F.col("o.APLZL"))),
            "left",
        )
        .select(
            "o.*",
            F.col("c.AEDATTM").alias("_change_replicated_at"),
            F.col("c.AERUNID").alias("_change_run_id"),
            F.col("c.AERECNO").alias("_change_record_seq"),
        )
    )

    return (
        operations_to_refresh.alias("o")
        .join(afvv.alias("v"),  ["AUFPL", "APLZL", "MANDT"], "left")
        .join(afko.alias("h"),  ["AUFPL",           "MANDT"], "left")
        .select(
            # ── Natural key
            strip_zeros("h.AUFNR").alias("order_number"),
            F.col("h.AUFNR").alias("order_number_raw"),
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
            F.col("o._change_replicated_at").alias("_replicated_at"),
            F.col("o._change_run_id").alias("_run_id"),
            F.col("o._change_record_seq").alias("_record_seq"),
        )
    )

dlt.create_streaming_table(
    name="process_order_operation",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["plant_code", "scheduled_start_datetime"],
)

dlt.apply_changes(
    target="process_order_operation",
    source="stg_process_order_operation",
    keys=["order_number", "operation_number"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    stored_as_scd_type=1,
)

# ── 3. PI SHEET EXECUTION ─────────────────────────────────────────────────────

@dlt.view(name="stg_pi_sheet_execution")
@dlt.expect_all_or_drop({
    "order_number present": "order_number IS NOT NULL",
    "operation_number present": "operation_number IS NOT NULL"
})
@dlt.expect_all({
    "start before end": "pi_sheet_start_datetime <= pi_sheet_end_datetime OR pi_sheet_end_datetime IS NULL"
})
def stg_pi_sheet_execution():
    src = spark.readStream.table(
        f"{BRONZE}.actualpistartenddatetime_zmanpex_e04_002"
    )
    return src.select(
        F.col("ZWERKS").alias("plant_code"),
        strip_zeros("ZAUFNR").alias("order_number"),
        F.col("ZAUFNR").alias("order_number_raw"),
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
        F.col("AERUNID").alias("_run_id"),
        F.col("AERECNO").alias("_record_seq"),
    )

dlt.create_streaming_table(
    name="pi_sheet_execution",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["plant_code", "pi_sheet_start_datetime"],
)

dlt.apply_changes(
    target="pi_sheet_execution",
    source="stg_pi_sheet_execution",
    keys=["plant_code", "order_number", "operation_number"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    stored_as_scd_type=1,
)

# ── 4. DOWNTIME EVENT ─────────────────────────────────────────────────────────

@dlt.view(name="stg_downtime_event")
@dlt.expect_all_or_drop({
    "plant_code present": "plant_code IS NOT NULL",
    "start_date present": "start_datetime IS NOT NULL"
})
@dlt.expect_all({
    "duration non-negative": "duration_minutes >= 0"
})
def stg_downtime_event():
    src = spark.readStream.table(f"{BRONZE}.downtime_zpexpm_dwnt")
    start_datetime = sap_datetime("ZAUSVN", "ZAUZTV")
    end_datetime = sap_datetime("ZAUSBS", "ZAUZTB")
    return (
        src.filter(F.col("ZDEL").isNull() | (F.col("ZDEL") != "X"))   # exclude soft-deleted rows
        .select(
            # ── Natural key (composite — no single surrogate in Z-table)
            strip_zeros("AUFNR").alias("order_number"),
            F.col("AUFNR").alias("order_number_raw"),
            F.col("WERKS").alias("plant_code"),
            strip_zeros("MATNR").alias("material_code"),
            F.col("MATNR").alias("material_code_raw"),
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
            start_datetime.alias("start_datetime"),
            end_datetime.alias("end_datetime"),
            F.when(
                start_datetime.isNotNull() & end_datetime.isNotNull(),
                (F.unix_timestamp(end_datetime) - F.unix_timestamp(start_datetime)) / 60,
            )
            .otherwise(F.col("ZEAUSZT"))
            .alias("duration_minutes"),

            # ── Notification
            F.col("QMNUM").alias("quality_notification_number"),
            F.col("Z2_QMNUM").alias("secondary_notification_number"),
            F.col("QMNAM").alias("reported_by_user"),
            F.col("ZTEXT1").alias("comment"),

            F.col("AEDATTM").alias("_replicated_at"),
            F.col("AERUNID").alias("_run_id"),
            F.col("AERECNO").alias("_record_seq"),
        )
    )

dlt.create_streaming_table(
    name="downtime_event",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["plant_code", "start_datetime"],
)

dlt.apply_changes(
    target="downtime_event",
    source="stg_downtime_event",
    keys=["order_number", "plant_code", "operation_number", "item_number"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    stored_as_scd_type=1,
)
