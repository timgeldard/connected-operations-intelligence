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

from silver._plant_gate import apply_plant_gate
from silver.helpers import (
    BRONZE,
    col_or_null,
    get_spark,
    sap_date,
    sap_datetime,
    sap_flag,
    strip_zeros,
)

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
    spark = get_spark()
    src = spark.readStream.table(f"{BRONZE}.reservationrequirement_resb")
    gated = src.select(
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
        # CHARG is an exact SAP identifier — preserve as replicated (no strip/trim/normalise).
        F.col("CHARG").alias("batch_number"),
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
    # Stage gate: scope to onboarded plants before SCD1 (stream-static broadcast join on plant_code).
    # Delete records ('D') carry WERKS from RESB, so C061/P817 deletes pass the gate.
    return apply_plant_gate(gated, "plant_code", "ioreporting", spark=spark)

dlt.create_streaming_table(
    name="reservation_requirement",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
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
# LIKP (header) + LIPS (item). Item grain. Pick progress is summarised in Gold
# using base-UoM quantities (LGMNG and LFIMG converted via UMVKZ/UMVKN).
# Mirrors the warehouse_transfer_order multi-source idiom.

@dlt.view(name="stg_outbound_delivery")
@dlt.expect("delivery_number present", "delivery_number IS NOT NULL")
@dlt.expect_all_or_drop({
    "item_number present": "item_number IS NOT NULL OR record_activity = 'D'",
})
def stg_outbound_delivery():
    spark = get_spark()
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
    # ── Push Despatch marker columns (additive, header-only, guarded for dev).
    # SDABW/TRAID/TRATY confirmed present on deliveryobjects_likp in UAT (recon 2026-06-13).
    # col_or_null degrades to typed NULL if the column is absent in dev — self-healing once replicated.
    likp = likp.select(
        "*",
        col_or_null(likp, "SDABW", "string").alias("_SDABW"),
        col_or_null(likp, "TRAID", "string").alias("_TRAID"),
        col_or_null(likp, "TRATY", "string").alias("_TRATY"),
    )
    lips = spark.read.table(f"{BRONZE}.deliveryobjects_lips")
    # Pre-gate pushdown: shrink the wide static LIPS to onboarded plants (same plant axis as the final
    # apply_plant_gate) BEFORE the changed-keys fan-out join. Filter-only (plant gate adds no columns);
    # row-equivalent to gating at the end, but the join's static side drops from ~15.6M to the
    # onboarded-plant subset. The final apply_plant_gate is kept (authoritative + coverage-guard).
    lips = apply_plant_gate(lips, "WERKS", "ioreporting", spark=spark)

    delivery_items_to_refresh = (
        changed_keys.alias("c")
        # .hint("merge"): the pre-filtered LIPS is small-but-wide; force sort-merge so it is not
        # auto-broadcast (which would re-introduce the wide-row OOM the header merge hints prevent).
        .join(lips.alias("i").hint("merge"), ["VBELN", "MANDT"], "left")
        .select(
            "i.*",
            F.col("c.VBELN").alias("_change_vbeln"),
            F.col("c.AEDATTM").alias("_change_replicated_at"),
            F.col("c.AERUNID").alias("_change_run_id"),
            F.col("c.AERECNO").alias("_change_record_seq"),
            F.col("c.RecordActivity").alias("_change_record_activity"),
        )
    )

    gated = (
        delivery_items_to_refresh.alias("i")
        # .hint("merge"): force sort-merge on the wide LIKP header join — Photon's default broadcast
        # hash join OOMs/spills on the wide reconstructed item rows (same pattern as
        # warehouse_transfer_order's LTAK join).
        .join(likp.alias("h").hint("merge"), ["VBELN", "MANDT"], "left")
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
            # CHARG is an exact SAP identifier — preserve as replicated (no strip/trim/normalise).
            F.col("i.CHARG").alias("batch_number"),
            F.col("i.CHARG").alias("batch_number_raw"),

            # ── Quantities (pick progress)
            # LFIMG is in sales UoM (VRKME); LGMNG is in stock/base UoM (MEINS).
            # Keep the original sales quantity for reconciliation, and expose a
            # base-UoM denominator for pick-progress KPIs.
            F.col("i.LFIMG").alias("delivery_quantity"),
            F.col("i.VRKME").alias("sales_uom"),
            F.col("i.UMVKZ").alias("sales_to_base_uom_numerator"),
            F.col("i.UMVKN").alias("sales_to_base_uom_denominator"),
            F.col("i.MEINS").alias("base_uom"),
            F.when(F.col("i.LFIMG").isNull(), F.lit(None).cast("double"))
            .when(F.col("i.VRKME") == F.col("i.MEINS"), F.col("i.LFIMG").cast("double"))
            .when(
                F.col("i.UMVKZ").isNotNull()
                & F.col("i.UMVKN").isNotNull()
                & (F.col("i.UMVKN") != 0),
                F.col("i.LFIMG").cast("double")
                * F.col("i.UMVKZ").cast("double")
                / F.col("i.UMVKN").cast("double"),
            )
            .otherwise(F.lit(None).cast("double"))
            .alias("delivery_quantity_base"),
            F.col("i.LGMNG").alias("actual_delivered_base_quantity"),
            F.col("i.LGMNG").alias("picked_quantity"),
            F.col("i.NTGEW").alias("net_weight"),
            F.col("i.BRGEW").alias("gross_weight"),
            F.col("i.GEWEI").alias("weight_unit"),

            # ── Reference
            strip_zeros("i.VGBEL").alias("source_document_number"),
            F.col("i.VGPOS").alias("source_document_item"),

            # ── Push Despatch marker (additive — NULL on pre-existing rows until churn/full-refresh).
            # SDABW='ZPUS' identifies Push Despatch deliveries (WMA-E-23 header marker, UAT-recon 2026-06-13).
            # SDABW is ABSENT on LIPS — it is a header-grain field ONLY. Add to item-grain rows via the
            # LIKP join; treat NULL as non-push in Gold (COALESCE to FALSE on the boolean flag).
            # TRAID/TRATY: vehicle/transport — 28,634 / 28,760 ZPUS deliveries populated.
            # All three columns are guarded via col_or_null above (dev LIKP may lack these fields).
            F.col("h._SDABW").alias("special_processing_code"),
            F.col("h._TRAID").alias("container_vehicle_id"),
            F.col("h._TRATY").alias("transport_type"),

            # ── Delivery direction (additive — NULL on pre-existing rows until churn/full-refresh).
            # Source: LIKP.VBTYP (delivery document category). Verified UAT 2026-06-11:
            # EL=178,632 (VBTYP='7' inbound), ELST=2,651 (inbound stock transport, VBTYP='7'),
            # NL/ZD*/ZNL*/ZCC* ~99k (VBTYP='J' outbound). Gold MUST NOT rely on this column
            # until a full-refresh / sufficient churn has backfilled pre-existing rows.
            F.col("h.VBTYP").alias("document_category"),
            F.when(F.col("h.VBTYP") == "7", F.lit("INBOUND"))
            .when(F.col("h.VBTYP") == "J", F.lit("OUTBOUND"))
            .when(F.col("h.VBTYP") == "T", F.lit("RETURNS"))
            .when(F.col("h.VBTYP").isNotNull(), F.lit("OTHER"))
            .otherwise(F.lit(None).cast("string"))
            .alias("delivery_direction"),

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
    # Stage gate: scope to onboarded plants before SCD1 (stream-static broadcast join on plant_code).
    # Header-only deletes with a purged item carry a null plant_code and are dropped — consistent with
    # the documented "header-only delete can't cascade" limitation below.
    return apply_plant_gate(gated, "plant_code", "ioreporting", spark=spark)

dlt.create_streaming_table(
    name="outbound_delivery",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["plant_code", "planned_goods_issue_date"],
)

# NOTE (delete semantics): a header-only delete (LIKP RecordActivity='D') carries a null
# item_number if the matching LIPS items are already purged, so SCD1 cannot match the compound
# key to remove prior item rows. Consistent with the repo's other multi-source streaming tables.
dlt.apply_changes(
    target="outbound_delivery",
    source="stg_outbound_delivery",
    keys=["delivery_number", "item_number"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    apply_as_deletes=F.expr("record_activity = 'D'"),
    stored_as_scd_type=1,
)


@dlt.table(
    name="outbound_delivery_header_delete",
    comment="Outbound-delivery headers with a LIKP delete tombstone. Used by Gold to suppress stale item-grain rows when item keys cannot be reconstructed.",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_or_drop("delivery_number present", "delivery_number IS NOT NULL")
def outbound_delivery_header_delete():
    spark = get_spark()
    return (
        spark.readStream.table(f"{BRONZE}.deliveryobjects_likp")
        .filter(F.col("RecordActivity") == "D")
        .select(
            strip_zeros("VBELN").alias("delivery_number"),
            F.col("VBELN").alias("delivery_number_raw"),
            F.col("AEDATTM").alias("_replicated_at"),
            F.col("AERUNID").alias("_run_id"),
            F.col("AERECNO").alias("_record_seq"),
        )
    )
