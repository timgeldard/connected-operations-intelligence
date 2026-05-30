"""
Lakeflow Spark Declarative Pipeline — Silver Layer (Reference/Slow)
"""

import dlt
from pyspark.sql import functions as F
from silver.helpers import get_spark, BRONZE, PP_PI_ORDER_TYPES, strip_zeros, sap_date, sap_datetime, sap_flag

spark = get_spark()

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

    # Aggregate T320 to resolve a single primary plant per warehouse to prevent key instability/row duplication
    t320_agg = (
        t320.groupBy("warehouse_number")
        .agg(F.min("plant_code").alias("primary_plant_code"))
    )

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
        .join(t320_agg.alias("m"),
              F.col("b.LGNUM") == F.col("m.warehouse_number"),
              "left")
        .select(
            # ── Natural key (physical bin identity)
            F.col("b.LGNUM").alias("warehouse_number"),
            F.col("b.LGTYP").alias("storage_type"),
            F.col("b.LGPLA").alias("bin_code"),
            F.coalesce(F.col("q.WERKS"), F.col("m.primary_plant_code")).alias("plant_code"),

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
    keys=["warehouse_number", "storage_type", "bin_code"],
    sequence_by=F.col("_replicated_at"),
    stored_as_scd_type=1,
    cluster_by=["warehouse_number", "storage_type"],
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


# ─────────────────────────────────────────────────────────────────────────────
# ── 15. MOVEMENT TYPE CLASSIFICATION (reference) ──────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(
    name="movement_type_classification",
    comment="Classification of SAP movement types for production and scrap reporting",
    table_properties={"delta.enableChangeDataFeed": "true"}
)
def movement_type_classification():
    # Conformed classification seed mapping
    data = [
        Row(
            movement_type_code="101",
            movement_category="PRODUCTION_RECEIPT",
            is_production_receipt=True,
            is_receipt_reversal=False,
            is_scrap=False,
            is_scrap_reversal=False
        ),
        Row(
            movement_type_code="102",
            movement_category="PRODUCTION_REVERSAL",
            is_production_receipt=False,
            is_receipt_reversal=True,
            is_scrap=False,
            is_scrap_reversal=False
        ),
        Row(
            movement_type_code="551",
            movement_category="SCRAP",
            is_production_receipt=False,
            is_receipt_reversal=False,
            is_scrap=True,
            is_scrap_reversal=False
        ),
        Row(
            movement_type_code="552",
            movement_category="SCRAP_REVERSAL",
            is_production_receipt=False,
            is_receipt_reversal=False,
            is_scrap=False,
            is_scrap_reversal=True
        ),
    ]
    return spark.createDataFrame(data)
