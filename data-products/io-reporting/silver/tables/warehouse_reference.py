"""
Warehouse reference and bin master tables (Reference/Slow tier).

Tables: warehouse_plant_mapping, storage_bin

Both tables resolve current state (the slow tier is triggered), which is the
correct model for their sources:

* warehouse_plant_mapping reads T320, which lives in the published
  (central_services) catalog as a VIEW — see bronze_published().
* storage_bin's quant occupancy (LQUA) is a current-state snapshot maintained
  upstream by MERGE/DELETE: it carries no Aecorsoft CDC columns
  (AERUNID/AERECNO/RecordActivity) and is therefore NOT a valid streaming
  source. We build the full current-state snapshot (stg_storage_bin) and feed it
  to apply_changes_from_snapshot, which keeps storage_bin a STREAMING table (so
  the external UC row filter persists like every other silver table) while
  diffing snapshots: for SCD type 1 it deletes target rows whose keys are absent
  from the latest snapshot, so vacated quants / emptied bins age out without any
  delete marker. The bin master (LAGP) IS append-only Aecorsoft CDC, so we reduce
  it to its current state (latest row per bin, tombstones dropped) before joining.
"""

import dlt
from pyspark.sql import Window
from pyspark.sql import functions as F

from silver.helpers import (
    BRONZE,
    bronze_published,
    col_or_null,
    get_spark,
    sap_date,
    sap_datetime,
    sap_flag,
    strip_zeros,
)

# ── 1. WAREHOUSE PLANT MAPPING ────────────────────────────────────────────────

@dlt.table(
    name="warehouse_plant_mapping",
    comment="Warehouse to Plant mapping (SAP T320, sourced from the published/central_services catalog)",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_all_or_drop({
    "warehouse_number present": "warehouse_number IS NOT NULL",
    "plant_code present": "plant_code IS NOT NULL"
})
def warehouse_plant_mapping():
    spark = get_spark()
    # T320 is not replicated into the SAP source; it lives in central_services as a
    # current-state view (LGNUM/WERKS/LGORT/AEDATTM, no CDC columns).
    src = spark.read.table(f"{bronze_published()}.warehouseforplant_t320")
    return src.select(
        F.col("LGNUM").alias("warehouse_number"),
        F.col("WERKS").alias("plant_code"),
        F.col("LGORT").alias("storage_location_code"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


@dlt.view(
    name="warehouse_plant_mapping_validation",
    comment="Validation view to audit warehouses mapped to multiple plants (ambiguous scopes)",
)
def warehouse_plant_mapping_validation():
    return (
        dlt.read("warehouse_plant_mapping")
        .groupBy("warehouse_number")
        .agg(F.count_distinct("plant_code").alias("plant_count"))
        .filter(F.col("plant_count") > 1)
    )


# ── 2. STORAGE BIN ────────────────────────────────────────────────────────────

# Materialized (temporary=True) so it is a valid, unambiguous periodic-snapshot source for
# apply_changes_from_snapshot — a canonical full-overwrite table per triggered run — while
# temporary keeps it out of the published schema (it is unfiltered staging, so it must not be
# exposed to consumers; the RLS-filtered output is storage_bin).
@dlt.table(name="stg_storage_bin", temporary=True)
@dlt.expect_all_or_drop({
    # Enforce every field used in the apply_changes_from_snapshot merge key, so a row with a null
    # key component cannot enter the snapshot and produce an invalid SCD1 key. (_storage_bin_occupancy_key
    # is coalesced to '__EMPTY__' so is never null by construction, but is asserted for completeness.)
    "warehouse_number present": "warehouse_number IS NOT NULL",
    "storage_type present": "storage_type IS NOT NULL",
    "bin_code present": "bin_code IS NOT NULL",
    "occupancy key present": "_storage_bin_occupancy_key IS NOT NULL"
})
def stg_storage_bin():
    spark = get_spark()
    bin_key = ["LGNUM", "LGTYP", "LGPLA", "MANDT"]

    # LAGP is append-only Aecorsoft CDC (RecordActivity I/U/D, AERUNID/AERECNO sequence).
    # Reduce to current bin master: latest row per physical bin, then drop tombstones ('D').
    latest_bin = Window.partitionBy(*bin_key).orderBy(
        F.col("AEDATTM").desc_nulls_last(),
        F.col("AERUNID").desc_nulls_last(),
        F.col("AERECNO").desc_nulls_last(),
    )
    lagp = (
        spark.read.table(f"{BRONZE}.storagebin_lagp")
        .withColumn("_rn", F.row_number().over(latest_bin))
        .filter(F.col("_rn") == 1)
        .drop("_rn")
        .filter(F.coalesce(F.col("RecordActivity"), F.lit("")) != "D")
    )

    # LQUA is already a current-state snapshot (one row per quant; upstream MERGE/DELETE).
    lqua = spark.read.table(f"{BRONZE}.quant_lqua")

    # Resolve a single primary plant per warehouse (mark genuinely shared warehouses as SHARED).
    t320_agg = (
        dlt.read("warehouse_plant_mapping")
        .groupBy("warehouse_number")
        .agg(
            F.min("plant_code").alias("primary_plant_code"),
            F.count_distinct("plant_code").alias("plant_count"),
        )
    )

    bins_with_quants = lagp.alias("b").join(
        lqua.alias("q"),
        (F.col("b.LGNUM") == F.col("q.LGNUM"))
        & (F.col("b.LGTYP") == F.col("q.LGTYP"))
        & (F.col("b.LGPLA") == F.col("q.LGPLA"))
        & (F.col("b.MANDT") == F.col("q.MANDT")),
        "left",
    )

    return (
        bins_with_quants.join(
            t320_agg.alias("m"),
            F.col("b.LGNUM") == F.col("m.warehouse_number"),
            "left",
        )
        .select(
            # ── Natural key (physical bin identity)
            F.col("b.LGNUM").alias("warehouse_number"),
            F.col("b.LGTYP").alias("storage_type"),
            F.col("b.LGPLA").alias("bin_code"),
            F.coalesce(
                F.col("q.WERKS"),
                F.when(F.col("m.plant_count") > 1, F.lit("SHARED")).otherwise(F.col("m.primary_plant_code"))
            ).alias("plant_code"),

            # ── Bin attributes
            # LGBKT, LGPBE, MAXGW, BRGEW, MAXEI, ANZRE are NOT present in the replicated storagebin_lagp
            # in either connected_plant_dev.sap OR connected_plant_uat.sap (confirmed live 2026-06-07).
            # They are OPTIONAL descriptive bin attributes (not keys), so they degrade to typed NULL via
            # col_or_null rather than failing the run with UNRESOLVED_COLUMN; the real field is used
            # automatically if a future replication adds it. NOT remapped to a different field
            # (e.g. LGBKT→LPTYP) — that mapping is a data-team decision, not assumed. None of these has a
            # gold consumer except bin_type: gold_bin_occupancy loses bin_type as a grouping dimension
            # (collapses to a single NULL group) — bin COUNTS, and therefore the Warehouse360 overview
            # KPIs, are unaffected. These gaps also apply to UAT. See ioreporting_dev_source_schema_preflight.sql.
            F.col("b.LGBER").alias("storage_section"),
            col_or_null(lagp, "LGBKT", "string", "b").alias("bin_type"),
            F.col("b.KOBER").alias("picking_area"),
            col_or_null(lagp, "LGPBE", "string", "b").alias("storage_bin_structure"),
            col_or_null(lagp, "MAXGW", "double", "b").alias("maximum_weight"),
            col_or_null(lagp, "BRGEW", "double", "b").alias("current_weight"),
            F.col("b.GEWEI").alias("weight_unit"),
            col_or_null(lagp, "MAXEI", "double", "b").alias("maximum_capacity_units"),
            col_or_null(lagp, "ANZRE", "double", "b").alias("current_capacity_units_used"),
            sap_flag("b.SPGRU").alias("is_blocked"),
            F.col("b.SPGRU").alias("blocking_reason_code"),

            # ── Current quant (NULL if bin is empty)
            # Stable occupancy key for the snapshot diff: each (bin, quant) is one row; an empty
            # bin gets a single __EMPTY__ row. When a quant disappears from the LQUA snapshot its
            # key is absent on the next run, so apply_changes_from_snapshot deletes it (SCD1).
            F.coalesce(F.col("q.LQNUM"), F.lit("__EMPTY__")).alias("_storage_bin_occupancy_key"),
            F.col("q.LQNUM").alias("quant_number"),
            strip_zeros("q.MATNR").alias("material_code"),
            F.col("q.MATNR").alias("material_code_raw"),
            # CHARG is an exact SAP identifier — preserve as replicated (no strip/trim/normalise).
            F.col("q.CHARG").alias("batch_number"),
            F.col("q.CHARG").alias("batch_number_raw"),
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

            # ── Freshness watermark: newest of bin-master / quant replication timestamps
            F.greatest(F.col("b.AEDATTM"), F.col("q.AEDATTM")).alias("_replicated_at"),
        )
    )


# storage_bin stays a STREAMING table (so the external UC row filter applied by
# scripts/generate_row_filter_sql.py persists, consistent with every other silver table).
# LQUA carries no delete marker and is not a valid streaming source, so we feed the full
# current-state snapshot (stg_storage_bin) to apply_changes_from_snapshot: it diffs successive
# snapshots and, for SCD type 1, DELETES target rows whose keys are absent from the latest
# snapshot — so vacated quants / emptied bins age out automatically.
dlt.create_streaming_table(
    name="storage_bin",
    comment="Physical storage bins (LAGP) with current quant occupancy (LQUA). "
            "LQUA lacks physical delete markers (emptied quants are deleted upstream), so "
            "snapshot-CDC is used to prune vacated bins as their occupancy keys leave the snapshot.",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["warehouse_number", "storage_type"],
)

# Enforce non-negative stock quantity to catch any replication or negative-stock anomalies early
@dlt.view(name="storage_bin_gate")
@dlt.expect("total_quantity non-negative", "total_quantity IS NULL OR total_quantity >= 0.0")
def storage_bin_gate():
    # Pass-through view/wrapper to apply DLT expectations before snapshot CDC merges the changes
    return dlt.read("stg_storage_bin")

dlt.apply_changes_from_snapshot(
    target="storage_bin",
    source="storage_bin_gate",
    keys=["warehouse_number", "storage_type", "bin_code", "_storage_bin_occupancy_key"],
    stored_as_scd_type=1,
)
