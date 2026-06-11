"""
Process Order domain tables.
"""

import dlt
from pyspark.sql import functions as F

from silver._plant_gate import apply_plant_gate
from silver.helpers import (
    BRONZE,
    PP_PI_ORDER_CATEGORY,
    PP_PI_ORDER_TYPES,
    bronze_columns_exist,
    get_spark,
    sap_date,
    sap_datetime,
    sap_flag,
    strip_zeros,
)

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
    spark = get_spark()
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
    # Plant stage-gate, applied EARLY for cost: prune the AUFK static side to onboarded plants (AUFK
    # carries WERKS) BEFORE the AFKO/recipe joins + SCD1, so non-onboarded plants' orders never enter the
    # expensive join/write path. The output gate below additionally drops any null-plant delete rows that
    # arrive via changed_keys with no matching (now-pruned) AUFK row. See site_stage_gate_contract.md.
    aufk = apply_plant_gate(aufk, "WERKS", "process_order", spark=spark)
    afko = spark.read.table(f"{BRONZE}.productionorderobject_afko")

    # ── Process-line enrichment — read the slow-tier recipe_process_line reference map ──
    # The heavy SAP classification (AFKO → INOB → AUSP → CAWNT, class type 018) is materialised by the
    # slow pipeline into silver.recipe_process_line (one row per recipe object key). This fast stream
    # reads that small pre-aggregated map (recipe_process_line_table conf) and joins by the recipe key
    # OBJEK = PLNTY + rpad(PLNNR,8) + lpad(PLNAL,2).
    #
    # Read UNCONDITIONALLY — no tableExists guard. This is a CONTINUOUS pipeline, so stg_process_order
    # is evaluated ONCE at graph build; a tableExists guard would bake an empty-map fallback into the
    # plan for the life of the update if the table were missing at startup, silently resolving every
    # production_line to NULL until the next restart. Reading unconditionally instead fails loud at
    # startup if the map is absent (explicit and fixable), and — as a stream-static join — picks up the
    # slow pipeline's map updates per microbatch once the table exists.
    # DEPLOY ORDER: the slow pipeline must have built recipe_process_line before this continuous pipeline
    # starts (DABs deploy both pipelines but cannot order their *runs*); on first deploy, run the slow
    # pipeline once, then start the fast pipeline. See resources/silver_fast_pipeline.pipeline.yml.
    # ENRICHMENT TRADE-OFF: an order is enriched only when that order changes (SCD1), using the last
    # slow-run snapshot of the map — so an order created against a recipe classified between two slow
    # runs gets NULL until it next changes. Recipes normally predate orders, so the window is narrow.
    recipe_table = spark.conf.get("recipe_process_line_table", None)
    if not recipe_table:
        raise ValueError(
            "recipe_process_line_table configuration must be set "
            "(see resources/silver_fast_pipeline.pipeline.yml)."
        )
    process_line_map = spark.read.table(recipe_table).select(
        F.col("recipe_object_key").alias("_objek"),
        F.col("production_line"),
        F.col("production_line_description"),
    )

    is_delete = F.coalesce(F.col("k.RecordActivity"), F.col("c.RecordActivity")) == "D"
    order_type_filter = (
        F.col("k.AUART").isin(PP_PI_ORDER_TYPES)
        if PP_PI_ORDER_TYPES
        else F.lit(True)
    )
    process_order_filter = is_delete | ((F.col("k.AUTYP") == PP_PI_ORDER_CATEGORY) & order_type_filter)

    process_order_out = (
        changed_keys.alias("c")
        .join(aufk.alias("k"), ["AUFNR", "MANDT"], "left")
        .join(afko.alias("h"), ["AUFNR", "MANDT"], "left")
        .join(
            process_line_map.alias("pl"),
            F.concat(
                F.coalesce(F.col("h.PLNTY"), F.lit("")),
                F.rpad(F.coalesce(F.col("h.PLNNR"), F.lit("")), 8, " "),
                F.lpad(F.coalesce(F.col("h.PLNAL"), F.lit("")), 2, "0"),
            ) == F.col("pl._objek"),
            "left",
        )
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
            F.col("pl.production_line").alias("production_line"),
            F.col("pl.production_line_description").alias("production_line_description"),

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
    # Output gate: scope to onboarded plants and drop any null-plant delete rows (changed_keys with no
    # matching active-plant AUFK). Redundant with the early AUFK prune for non-delete rows, but correct.
    return apply_plant_gate(process_order_out, "plant_code", "process_order", spark=spark)

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

# Current-state snapshot MV (the batch_stock/MCHB + quality_inspection_lot + downtime_event
# pattern). AFVV (operation quantity/date values) is replicated in bronze with AEDATTM only — no
# AERUNID/AERECNO/RecordActivity — so the original streaming SCD1 design was never run-eligible.
# Confirmed by Tim Geldard 2026-06-11 that bronze AFVV (94M rows, UAT) is the source to use →
# remodelled to a full-recompute MV the same day. Pre-gate pushdown is ESSENTIAL at this size:
# AFVC (operations master, WERKS direct) is plant-gated BEFORE the AFVV join, so the 94M-row scan
# is pruned to the onboarded plants' operations. AFVC/AFKO carry full CDC but are batch-read here —
# the MV recomputes whole, so streaming change-tracking machinery is unnecessary.
_AFVV_REQUIRED = [
    "AUFPL", "APLZL", "MANDT", "AEDATTM",
    "SSAVD", "SSAVZ", "SSEDD", "SSEDZ", "ISDD", "ISDZ", "IEAVD", "ISBD", "ISBZ", "IEBD",
    "MGVRG", "LMNGA", "XMNGA", "ARBEI", "ARBEH", "ISM01", "ISMNW", "DAUNO", "DAUNE",
]
if bronze_columns_exist("dbstructureoperationquantitydatevalues_afvv", _AFVV_REQUIRED):
    @dlt.table(
        name="process_order_operation",
        comment=(
            "Process-order operations (AFVC routing + AFVV quantities/dates) — one row per "
            "routing_number x operation_counter. Current-state snapshot (AFVV has no CDC "
            "sequencing metadata — AEDATTM only); AFVC soft-deletes (RecordActivity='D') excluded."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "scheduled_start_datetime"],
    )
    @dlt.expect_all_or_drop({
        "order_number present": "order_number IS NOT NULL",
        "operation_number present": "operation_number IS NOT NULL"
    })
    @dlt.expect_all({
        "plant_code present": "plant_code IS NOT NULL",
        "scheduled dates ordered": "scheduled_start_datetime <= scheduled_finish_datetime OR scheduled_start_datetime IS NULL OR scheduled_finish_datetime IS NULL"
    })
    def process_order_operation():
        spark = get_spark()
        afvc = spark.read.table(f"{BRONZE}.processorderobject_afvc").filter(
            F.coalesce(F.col("RecordActivity"), F.lit("")) != "D"
        )
        # Pre-gate pushdown: shrink the all-plant AFVC to onboarded plants (AFVC.WERKS, the SAME
        # axis as the final apply_plant_gate) BEFORE joining the 94M-row AFVV.
        afvc = apply_plant_gate(afvc, "WERKS", "process_order", spark=spark)
        afvv = spark.read.table(f"{BRONZE}.dbstructureoperationquantitydatevalues_afvv")
        afko = spark.read.table(
            f"{BRONZE}.productionorderobject_afko"
        ).select("AUFPL", "AUFNR", "MANDT")

        operation_out = (
            afvc.alias("o")
            .join(afvv.alias("v"),  ["AUFPL", "APLZL", "MANDT"], "left")
            .join(afko.alias("h"),  ["AUFPL",           "MANDT"], "left")
            .select(
                # ── Natural key
                strip_zeros("h.AUFNR").alias("order_number"),
                F.col("h.AUFNR").alias("order_number_raw"),
                F.col("o.AUFPL").alias("routing_number"),
                F.col("o.APLZL").alias("operation_counter"),
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

                # Extraction timestamp only — NOT an event-ordering column (MCHB note).
                F.col("o.AEDATTM").cast("timestamp").alias("_replicated_at"),
            )
        )
        # Authoritative output gate (pre-gated on AFVC.WERKS above, same axis; belt-and-braces).
        return apply_plant_gate(operation_out, "plant_code", "process_order", spark=spark)

# ── 3. PI SHEET EXECUTION ─────────────────────────────────────────────────────

# Current-state snapshot MV (the downtime_event / batch_stock / MCHB pattern).
# Remodelled from never-eligible streaming SCD1 to a current-state snapshot 2026-06-11.
# Functional sign-off: Tim Geldard 2026-06-11.
# The PI-sheet source (actualpistartenddatetime_zmanpex_e04_002) is replicated with AEDATTM only —
# no AERUNID/AERECNO/RecordActivity — so the original streaming SCD1 design could never run.
# The source represents PI-sheet execution current state (one row per order/operation execution
# timing), making a full-recompute snapshot MV the correct model (same rationale as downtime_event).
# No PP/PI flow remains CDC-blocked after this remodel.
# The client field on this Z-table is CLIENT — not MANDT (AFKO/AUFK) and not MANDANT (QM tables);
# a third replicated-source naming variant, verified against UAT bronze 2026-06-11. The original
# MANDT guard silently kept the flow undefined.
_PI_SHEET_REQUIRED = [
    "CLIENT", "ZWERKS", "ZAUFNR", "ZVORNR", "ZSDATS", "ZSTIMS", "ZEDATS", "ZETIMS",
    "ZDUR", "ZUSERSTART", "ZUSEREND", "AEDATTM",
]
if bronze_columns_exist("actualpistartenddatetime_zmanpex_e04_002", _PI_SHEET_REQUIRED):
    @dlt.table(
        name="pi_sheet_execution",
        comment=(
            "PI-sheet execution timing (ZMANPEX_E04_002) — one row per order/operation PI-sheet "
            "execution entry with start/end datetimes, duration, and user. Current-state snapshot "
            "(source has no CDC sequencing metadata — AEDATTM only)."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "pi_sheet_start_datetime"],
    )
    @dlt.expect_all_or_drop({
        "order_number present": "order_number IS NOT NULL",
        "operation_number present": "operation_number IS NOT NULL"
    })
    @dlt.expect_all({
        "start before end": "pi_sheet_start_datetime <= pi_sheet_end_datetime OR pi_sheet_end_datetime IS NULL"
    })
    def pi_sheet_execution():
        spark = get_spark()
        src = spark.read.table(f"{BRONZE}.actualpistartenddatetime_zmanpex_e04_002")
        start_datetime = sap_datetime("ZSDATS", "ZSTIMS")
        end_datetime = sap_datetime("ZEDATS", "ZETIMS")
        pi_sheet_out = (
            src
            .select(
                # ── Natural key (client field is CLIENT on this Z-table — see _PI_SHEET_REQUIRED)
                F.col("CLIENT").alias("client"),
                F.col("ZWERKS").alias("plant_code"),
                strip_zeros("ZAUFNR").alias("order_number"),
                F.col("ZAUFNR").alias("order_number_raw"),
                F.col("ZVORNR").alias("operation_number"),

                # ── Execution times
                start_datetime.alias("pi_sheet_start_datetime"),
                end_datetime.alias("pi_sheet_end_datetime"),
                F.col("ZDUR").alias("duration_decimal_days"),
                F.round(F.col("ZDUR") * 24, 4).alias("duration_hours"),

                # ── Users
                F.col("ZUSERSTART").alias("started_by_user"),
                F.col("ZUSEREND").alias("completed_by_user"),

                # ── Derived status
                F.when(end_datetime.isNotNull(), "Completed")
                 .when(start_datetime.isNotNull(), "In Progress")
                 .otherwise("Not Started").alias("pi_sheet_status"),

                # Extraction timestamp only — NOT an event-ordering column (MCHB note).
                F.col("AEDATTM").cast("timestamp").alias("_replicated_at"),
            )
        )
        # Plant stage-gate (DIRECT ZWERKS).
        return apply_plant_gate(pi_sheet_out, "plant_code", "process_order", spark=spark)

# ── 4. DOWNTIME EVENT ─────────────────────────────────────────────────────────

# Current-state snapshot MV (the batch_stock/MCHB + quality_inspection_lot pattern). The downtime
# source (downtime_zpexpm_dwnt) is replicated with AEDATTM only — no AERUNID/AERECNO — so this flow
# was source-guarded off pending a snapshot redesign + functional sign-off. Sign-off given by Tim
# Geldard 2026-06-11; flipped from the never-eligible streaming SCD1 design to a full-recompute MV
# the same day. UAT shape verified 2026-06-11: 2.77M rows all-plants -> plant gate cuts to ~477k for
# the 4 onboarded plants. Reason/sub-reason CODES AND TEXTS are denormalised on the transaction rows
# (ZRCD/ZTEXT, ZSUB/ZSRTXT); the governed reason masters also exist in bronze
# (downtimereason_zpexpm_dwntrcode: 97 codes; reasonfordowntime_zpexpm_dtsubrcde: 809 sub-reasons)
# and can be modelled as reference tables if a consumer needs the full catalogue.
_DWNT_REQUIRED = [
    "MANDT", "AUFNR", "WERKS", "MATNR", "VORNR", "ZITEM", "LTXA1", "ARBPL",
    "ZRCD", "ZTEXT", "ZSUB", "ZSRTXT", "ZTPLNR", "ZPLTXT", "PRO_LINE_DES",
    "ZAUSVN", "ZAUZTV", "ZAUSBS", "ZAUZTB", "ZEAUSZT", "ZDEL",
    "QMNUM", "Z2_QMNUM", "QMNAM", "ZTEXT1", "AEDATTM",
]
if bronze_columns_exist("downtime_zpexpm_dwnt", _DWNT_REQUIRED):
    @dlt.table(
        name="downtime_event",
        comment=(
            "Production downtime events (ZPEXPM_DWNT) — one row per order/operation/item downtime "
            "entry with reason and sub-reason. Current-state snapshot (source has no CDC sequencing "
            "metadata — AEDATTM only); soft-deleted rows (ZDEL='X') excluded."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "start_datetime"],
    )
    @dlt.expect_all_or_drop({
        "plant_code present": "plant_code IS NOT NULL",
        "start_date present": "start_datetime IS NOT NULL"
    })
    @dlt.expect_all({
        "duration non-negative": "duration_minutes >= 0"
    })
    def downtime_event():
        spark = get_spark()
        src = spark.read.table(f"{BRONZE}.downtime_zpexpm_dwnt")
        start_datetime = sap_datetime("ZAUSVN", "ZAUZTV")
        end_datetime = sap_datetime("ZAUSBS", "ZAUZTB")
        downtime_out = (
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

                # Extraction timestamp only — NOT an event-ordering column (MCHB note).
                F.col("AEDATTM").cast("timestamp").alias("_replicated_at"),
            )
        )
        # Plant stage-gate (DIRECT WERKS). Gate-ready for when CDC unblocks this flow.
        return apply_plant_gate(downtime_out, "plant_code", "process_order", spark=spark)


