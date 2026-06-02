"""
Warehouse reference and bin master tables (Reference/Slow tier).

Tables: warehouse_plant_mapping, storage_bin

Both tables are recomputed as batch current-state snapshots (the slow tier is
triggered), which is the correct model for their sources:

* warehouse_plant_mapping reads T320, which lives in the published
  (central_services) catalog as a VIEW — see bronze_published().
* storage_bin's quant occupancy (LQUA) is a current-state snapshot maintained
  upstream by MERGE/DELETE: it carries no Aecorsoft CDC columns
  (AERUNID/AERECNO/RecordActivity) and is therefore NOT a valid streaming
  source. A full recompute means vacated quants simply drop out, so emptied
  bins age out without needing a delete marker. The bin master (LAGP) IS
  append-only Aecorsoft CDC, so we reduce it to its current state (latest row
  per bin, tombstones dropped) before joining.
"""

import dlt
from pyspark.sql import Window
from pyspark.sql import functions as F

from silver.helpers import (
    BRONZE,
    bronze_published,
    get_spark,
    sap_date,
    sap_datetime,
    sap_flag,
    strip_zeros,
)

spark = get_spark()


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

@dlt.table(
    name="storage_bin",
    comment="Physical storage bins (LAGP) with current quant occupancy (LQUA). "
            "Batch current-state recompute: emptied bins age out automatically.",
    table_properties={
        "delta.enableChangeDataFeed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
    cluster_by=["warehouse_number", "storage_type"],
)
@dlt.expect_all_or_drop({
    "warehouse_number present": "warehouse_number IS NOT NULL",
    "bin_code present": "bin_code IS NOT NULL"
})
def storage_bin():
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
            F.col("q.MATNR").alias("material_code_raw"),
            strip_zeros("q.CHARG").alias("batch_number"),
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
