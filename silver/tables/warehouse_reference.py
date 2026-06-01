"""
Warehouse reference and bin master tables (Reference/Slow tier).

Tables: warehouse_plant_mapping, storage_bin

storage_bin co-locates here (rather than Fast) because it depends on
warehouse_plant_mapping via dlt.read(), and because its quant occupancy
data (LQUA) is already a batch read — so occupancy freshness is a
periodic snapshot in either tier.
"""

import dlt
from pyspark.sql import functions as F

from silver.helpers import BRONZE, get_spark, sap_date, sap_datetime, sap_flag, strip_zeros

spark = get_spark()


# ── 1. WAREHOUSE PLANT MAPPING ────────────────────────────────────────────────

@dlt.table(
    name="warehouse_plant_mapping",
    comment="Warehouse to Plant mapping (SAP T320)",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_all_or_drop({
    "warehouse_number present": "warehouse_number IS NOT NULL",
    "plant_code present": "plant_code IS NOT NULL"
})
def warehouse_plant_mapping():
    src = spark.read.table(f"{BRONZE}.warehouseforplant_t320")
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

@dlt.view(name="stg_storage_bin")
@dlt.expect_all_or_drop({
    "warehouse_number present": "warehouse_number IS NOT NULL",
    "bin_code present": "bin_code IS NOT NULL"
})
def stg_storage_bin():
    lagp_changes = spark.readStream.table(f"{BRONZE}.storagebin_lagp").select(
        "LGNUM", "LGTYP", "LGPLA", "MANDT", "AEDATTM", "AERUNID", "AERECNO"
    )
    lqua_changes = spark.readStream.table(f"{BRONZE}.quant_lqua").select(
        "LGNUM", "LGTYP", "LGPLA", "MANDT", "AEDATTM", "AERUNID", "AERECNO"
    )
    t320_changes = (
        spark.readStream.table(f"{BRONZE}.warehouseforplant_t320")
        .select("LGNUM", "MANDT", "AEDATTM", "AERUNID", "AERECNO")
        .withColumn("LGTYP", F.lit(None).cast("string"))
        .withColumn("LGPLA", F.lit(None).cast("string"))
    )

    changed_keys = lagp_changes.unionByName(lqua_changes).unionByName(t320_changes)
    lagp = spark.read.table(f"{BRONZE}.storagebin_lagp")
    lqua = spark.read.table(f"{BRONZE}.quant_lqua")
    t320 = dlt.read("warehouse_plant_mapping")

    # Aggregate T320 to resolve a single primary plant per warehouse to prevent key instability/row duplication
    t320_agg = (
        t320.groupBy("warehouse_number")
        .agg(
            F.min("plant_code").alias("primary_plant_code"),
            F.count_distinct("plant_code").alias("plant_count")
        )
    )

    bins_to_refresh = (
        changed_keys.alias("c")
        .join(
            lagp.alias("b"),
            (F.col("c.LGNUM") == F.col("b.LGNUM"))
            & (F.col("c.MANDT") == F.col("b.MANDT"))
            & (F.col("c.LGTYP").isNull() | (F.col("c.LGTYP") == F.col("b.LGTYP")))
            & (F.col("c.LGPLA").isNull() | (F.col("c.LGPLA") == F.col("b.LGPLA"))),
            "left",
        )
        .select(
            "b.*",
            F.col("c.AEDATTM").alias("_change_replicated_at"),
            F.col("c.AERUNID").alias("_change_run_id"),
            F.col("c.AERECNO").alias("_change_record_seq"),
        )
    )

    bins_with_quants = (
        bins_to_refresh.alias("b")
        .join(lqua.alias("q"),
              (F.col("b.LGNUM") == F.col("q.LGNUM")) &
              (F.col("b.LGTYP") == F.col("q.LGTYP")) &
              (F.col("b.LGPLA") == F.col("q.LGPLA")) &
              (F.col("b.MANDT") == F.col("q.MANDT")),
              "left")
    )

    return (
        bins_with_quants
        .join(t320_agg.alias("m"),
              F.col("b.LGNUM") == F.col("m.warehouse_number"),
              "left")
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
            F.coalesce(F.col("q.LQNUM"), F.lit("__EMPTY__")).alias("_storage_bin_occupancy_key"),
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

            F.col("b._change_replicated_at").alias("_replicated_at"),
            F.col("b._change_run_id").alias("_run_id"),
            F.col("b._change_record_seq").alias("_record_seq"),
        )
    )

dlt.create_streaming_table(
    name="storage_bin",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["warehouse_number", "storage_type"],
)

dlt.apply_changes(
    target="storage_bin",
    source="stg_storage_bin",
    keys=["warehouse_number", "storage_type", "bin_code", "_storage_bin_occupancy_key"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    stored_as_scd_type=1,
)
