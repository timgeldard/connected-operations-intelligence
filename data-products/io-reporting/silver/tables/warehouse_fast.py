"""
Warehouse and Inventory operational tables (Fast tier — streaming sources).

Tables: goods_movement, batch_stock, warehouse_transfer_order,
        warehouse_transfer_requirement
"""

import dlt
from pyspark.sql import functions as F

from silver._plant_gate import active_warehouses_df, apply_plant_gate, apply_warehouse_gate
from silver.helpers import BRONZE, get_spark, sap_date, sap_datetime, sap_flag, strip_zeros

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
    spark = get_spark()
    mseg_changes = spark.readStream.table(f"{BRONZE}.inventorymovement_mseg").select(
        "MBLNR", "MJAHR", "MANDT", "ZEILE", "AEDATTM", "AERUNID", "AERECNO", "RecordActivity"
    )
    # NOTE (delete propagation): A header-only delete from MKPF (RecordActivity='D')
    # will propagate to changed_keys with a null ZEILE, fanning out to all MSEG lines
    # for that document. In stg_goods_movement, this resolves as record_activity = 'D'
    # for all joined lines via coalesce, resulting in a cascade-delete of all line items
    # in the target goods_movement table.
    mkpf_changes = (
        spark.readStream.table(f"{BRONZE}.materialdocument_mkpf")
        .select("MBLNR", "MJAHR", "MANDT", "AEDATTM", "AERUNID", "AERECNO", "RecordActivity")
        .withColumn("ZEILE", F.lit(None).cast("string"))
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
    movement_out = (
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
            # CHARG is an exact SAP identifier — preserve as replicated (no strip/trim/normalise).
            # See source-contracts/site_stage_gate_contract.md + silver_fast_field_reconciliation.md.
            F.col("s.CHARG").alias("batch_number"),
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
            # Approved IM delivery mapping (source-contracts/sap/silver_fast_field_reconciliation.md):
            # MSEG.VBELN is absent; VBELN_IM/VBELP_IM are the IM delivery reference. Movement-type
            # dependent — may be blank, so delivery_number stays NULL (no fake fallback to
            # MBLNR/KDAUF/LFBNR). reference_type = 'DELIVERY' only when VBELN_IM is populated.
            strip_zeros("s.VBELN_IM").alias("delivery_number"),
            F.col("s.VBELN_IM").alias("delivery_number_raw"),
            F.col("s.VBELP_IM").alias("delivery_item"),
            F.when(strip_zeros("s.VBELN_IM").isNotNull(), F.lit("DELIVERY"))
             .otherwise(F.lit(None).cast("string")).alias("reference_type"),
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
    # Plant stage-gate (DIRECT WERKS): MSEG carries the true plant in WERKS. Scope to onboarded plants
    # (base ioreporting gate). Stream-static left-semi against the governed active-plant set.
    return apply_plant_gate(movement_out, "plant_code", "ioreporting", spark=spark)

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
# Approved architecture (source-contracts/sap/silver_fast_field_reconciliation.md): MCHB is a stock
# CURRENT-STATE table, not an ordered event stream. The replicated MCHB carries no CDC sequencing
# metadata (AERUNID/AERECNO/RecordActivity absent — only AEDATTM, kept as an extraction timestamp and
# NOT used for event ordering). It is therefore modelled as a current-state snapshot (materialized
# view, full recompute) keyed by (material_code, plant_code, storage_location_code, batch_number) —
# proven 1:1 unique in the replicated MCHB (11,499,051 rows = 11,499,051 distinct keys, 2026-06-07).
# No dlt.apply_changes / CDC. base_uom is enriched from MARA (MCHB carries no unit; stock buckets are
# in the material base UoM); join on MANDT+MATNR (MARA unique per client+material → no fan-out).

@dlt.table(
    name="batch_stock",
    comment="Batch stock current state (MCHB) — one row per material/plant/storage-location/batch; "
            "base_uom from MARA. Current-state snapshot (no CDC; MCHB has no apply_changes metadata).",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["plant_code", "storage_location_code"],
)
@dlt.expect_all_or_drop({
    "material_code present": "material_code IS NOT NULL",
    "plant_code present": "plant_code IS NOT NULL"
})
@dlt.expect_all({
    "unrestricted quantity non-negative": "unrestricted_quantity >= 0"
})
def batch_stock():
    spark = get_spark()
    mchb = spark.read.table(f"{BRONZE}.batchstock_mchb")
    # base_uom from material master (MCHB has no MEINS); MARA is unique per MANDT+MATNR.
    mara = spark.read.table(f"{BRONZE}.materialmaster_mara").select(
        F.col("MANDT").alias("_mara_mandt"),
        F.col("MATNR").alias("_mara_matnr"),
        F.col("MEINS").alias("base_uom"),
    )
    batch_stock_out = (
        mchb.alias("s")
        .join(
            mara.alias("m"),
            (F.col("s.MANDT") == F.col("m._mara_mandt")) & (F.col("s.MATNR") == F.col("m._mara_matnr")),
            "left",
        )
        .select(
            # client (MANDT) — part of the exact SAP natural key (material/plant/storage-loc/batch
            # are unique only within a client). DEV is single-client; exposed for the multi-client key.
            F.col("s.MANDT").alias("client"),
            strip_zeros("s.MATNR").alias("material_code"),
            F.col("s.MATNR").alias("material_code_raw"),
            F.col("s.WERKS").alias("plant_code"),
            F.col("s.LGORT").alias("storage_location_code"),
            # CHARG is an exact SAP identifier — preserve as replicated (no strip/trim/normalise).
            # See source-contracts/site_stage_gate_contract.md + silver_fast_field_reconciliation.md.
            F.col("s.CHARG").alias("batch_number"),
            F.col("s.CHARG").alias("batch_number_raw"),

            F.col("s.CLABS").alias("unrestricted_quantity"),
            F.col("s.CINSM").alias("quality_inspection_quantity"),
            F.col("s.CSPEM").alias("blocked_quantity"),
            F.col("s.CEINM").alias("restricted_use_quantity"),
            F.col("s.CUMLM").alias("in_transfer_quantity"),
            F.col("s.CRETM").alias("blocked_returns_quantity"),
            F.col("m.base_uom").alias("base_uom"),

            # Previous period (for trend / delta)
            F.col("s.CVMLA").alias("prev_period_unrestricted_quantity"),
            F.col("s.CVMIN").alias("prev_period_quality_inspection_quantity"),

            F.col("s.LFGJA").alias("fiscal_year"),
            F.col("s.LFMON").alias("fiscal_period"),

            # Extraction timestamp only — NOT an event-ordering / CDC sequence key.
            F.col("s.AEDATTM").alias("_replicated_at"),
        )
    )
    # Plant stage-gate (DIRECT WERKS): MCHB carries the true plant in WERKS. Scope to plants onboarded
    # for stock (batch_managed_flag). Batch-static left-semi against the governed active-plant set.
    return apply_plant_gate(batch_stock_out, "plant_code", "stock", spark=spark)


# ── 3. WAREHOUSE TRANSFER ORDER ───────────────────────────────────────────────

@dlt.view(name="stg_warehouse_transfer_order")
@dlt.expect_all_or_drop({
    "warehouse_number present": "warehouse_number IS NOT NULL",
    "transfer_order_number present": "transfer_order_number IS NOT NULL"
})
def stg_warehouse_transfer_order():
    spark = get_spark()
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

    transfer_order_out = (
        order_items_to_refresh.alias("i")
        # Force sort-merge for THIS join only. order_items_to_refresh carries the wide LTAP row (i.*,
        # 165 var-len cols); Photon under-estimated it and built a BroadcastHashedRelation that ran the
        # executor out of memory (SparkOutOfMemoryError, var-len data) once this flow became
        # runtime-reachable. The merge hint forces SMJ (spills instead of OOM) for this stream-static
        # join, WITHOUT a pipeline-wide auto-broadcast disable — small dimension/config joins elsewhere
        # still broadcast cheaply. Replaces the global spark.sql.autoBroadcastJoinThreshold=-1.
        .join(ltak.alias("h").hint("merge"), ["LGNUM", "TANUM", "MANDT"], "left")
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
            # CHARG is an exact SAP identifier — preserve as replicated (no strip/trim/normalise).
            F.col("i.CHARG").alias("batch_number"),
            F.col("i.CHARG").alias("batch_number_raw"),
            F.col("i.MEINS").alias("base_uom"),
            F.col("i.BESTQ").alias("stock_category_code"),

            # ── Locations
            F.col("i.VLTYP").alias("source_storage_type"),
            F.col("i.VLPLA").alias("source_bin"),
            F.col("i.NLTYP").alias("destination_storage_type"),
            F.col("i.NLPLA").alias("destination_bin"),

            # ── Quantities (approved WM mapping — source-contracts/sap/silver_fast_field_reconciliation.md)
            # ANFME/ENMNG/ISPOS are not LTAP fields. requested = source target qty (VSOLM);
            # confirmed = source actual qty (VISTA) — both source-side (do NOT mix with destination
            # NSOLM/NISTM). In WM, picking and confirmation collapse to the same persisted LTAP quantity
            # for this use case, so actual_quantity_picked is aliased to confirmed_quantity (kept for
            # downstream-contract compatibility; NOT an independent business measure).
            F.col("i.VSOLM").alias("requested_quantity"),
            F.col("i.VISTA").alias("confirmed_quantity"),
            F.col("i.VISTA").alias("actual_quantity_picked"),

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
    # Warehouse stage-gate (LGNUM -> WERKS via site_config_warehouse). WM flows are gated by warehouse,
    # NOT raw LTAK.WERKS (verified unreliable: warehouse 208 has 393,612 TOs but only 369,694 carry
    # WERKS=C061). Adds governed `plant_id` from the mapping, kept DISTINCT from the raw `plant_code`.
    return apply_warehouse_gate(
        transfer_order_out, "warehouse_number", "warehouse", add_plant_col="plant_id", spark=spark
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


@dlt.table(
    name="warehouse_transfer_order_header_delete",
    comment="Transfer-order headers with an LTAK delete tombstone. Used by Gold to suppress stale item-grain rows when item keys cannot be reconstructed.",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_all_or_drop({
    "warehouse_number present": "warehouse_number IS NOT NULL",
    "transfer_order_number present": "transfer_order_number IS NOT NULL",
})
def warehouse_transfer_order_header_delete():
    spark = get_spark()
    return (
        spark.readStream.table(f"{BRONZE}.transferorderobjects_ltak")
        .filter(F.col("RecordActivity") == "D")
        .select(
            F.col("LGNUM").alias("warehouse_number"),
            F.col("TANUM").alias("transfer_order_number"),
            F.col("AEDATTM").alias("_replicated_at"),
            F.col("AERUNID").alias("_run_id"),
            F.col("AERECNO").alias("_record_seq"),
        )
    )


# ── 4. WAREHOUSE TRANSFER REQUIREMENT ─────────────────────────────────────────
# NOTE (delete semantics): this table intentionally uses LTBK's native OPFLAG as the
# change/delete signal (mapped to `record_activity`), NOT the Aecorsoft `RecordActivity`
# used by the other tables. OPFLAG is SAP WM's own operation flag on the transfer-requirement
# header (it carries the 'D'/delete indication for TRs); using it keeps deletes aligned with
# SAP WM semantics. Deliberate divergence — see apply_changes below.

@dlt.view(name="stg_warehouse_transfer_requirement")
@dlt.expect_all_or_drop({
    "warehouse_number present": "warehouse_number IS NOT NULL",
    "transfer_requirement_number present": "transfer_requirement_number IS NOT NULL"
})
@dlt.expect_all({
    "required quantity positive": "required_quantity > 0 OR record_activity = 'D'"
})
def stg_warehouse_transfer_requirement():
    spark = get_spark()
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
    # Pre-gate pushdown: shrink the wide static LTBP to onboarded WAREHOUSES BEFORE the changed-keys
    # fan-out join. Uses the LGNUM (warehouse_number) axis — the SAME axis as the final
    # apply_warehouse_gate (NOT WERKS, which is unreliable on WM rows: LGNUM != WERKS). Filter-only
    # semi-join (no plant_id enrichment — that stays on the final gate); row-equivalent to gating at the
    # end. The final apply_warehouse_gate is kept (authoritative filter + plant_id + coverage-guard).
    _active_wh = active_warehouses_df(spark, "warehouse").select(
        F.col("warehouse_number").alias("_gate_lgnum")
    )
    ltbp = ltbp.join(F.broadcast(_active_wh), ltbp["LGNUM"] == F.col("_gate_lgnum"), "inner").drop("_gate_lgnum")
    requirement_items_to_refresh = (
        changed_keys.alias("c")
        # .hint("merge"): pre-filtered LTBP is small-but-wide; force sort-merge so it is not
        # auto-broadcast (which would re-introduce the wide-row OOM the header merge hints prevent).
        .join(ltbp.alias("i").hint("merge"), ["LGNUM", "TBNUM", "MANDT"], "left")
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

    transfer_requirement_out = (
        requirement_items_to_refresh.alias("i")
        # .hint("merge"): force sort-merge on the wide LTBK header join — Photon's default broadcast
        # hash join OOMs/spills on the wide reconstructed item rows (same pattern as
        # warehouse_transfer_order's LTAK join).
        .join(ltbk.alias("h").hint("merge"), ["LGNUM", "TBNUM", "MANDT"], "left")
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
            # CHARG is an exact SAP identifier — preserve as replicated (no strip/trim/normalise).
            F.col("i.CHARG").alias("batch_number"),
            F.col("i.CHARG").alias("batch_number_raw"),
            F.col("i.MEINS").alias("base_uom"),

            # ── Quantities (approved derivation — source-contracts/sap/silver_fast_field_reconciliation.md)
            # ENQTY is not an LTBP field. open_quantity = required (MENGE) minus quantity already
            # converted to transfer orders (TAMEN — confirmed present in the replicated LTBP),
            # null-safe and clamped to >= 0. Completed TRs (ELIKZ) are exposed via is_processing_complete
            # below and naturally yield open_quantity 0; backlog consumers filter on open_quantity > 0.
            F.col("i.MENGE").alias("required_quantity"),
            F.greatest(
                F.coalesce(F.col("i.MENGE"), F.lit(0)) - F.coalesce(F.col("i.TAMEN"), F.lit(0)),
                F.lit(0),
            ).alias("open_quantity"),

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
    # Warehouse stage-gate (LGNUM -> WERKS via site_config_warehouse); adds governed `plant_id`,
    # kept DISTINCT from the raw `plant_code`. WM flows gated by warehouse, not raw WERKS.
    return apply_warehouse_gate(
        transfer_requirement_out, "warehouse_number", "warehouse", add_plant_col="plant_id", spark=spark
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
