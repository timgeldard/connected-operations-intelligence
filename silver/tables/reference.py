"""
Reference/Master data domain tables.
"""

import dlt
from pyspark.sql import Row
from pyspark.sql import functions as F

from silver.helpers import BRONZE, get_spark, sap_date, sap_flag, strip_zeros
from silver.movement_types import (
    ISSUE_MOVEMENT_TYPES,
    MOVEMENT_TYPE_MAPPING,
    RECEIPT_MOVEMENT_TYPES,
    STOCK_WRITE_OFF_MOVEMENT_TYPES,
    STOCK_WRITE_ON_MOVEMENT_TYPES,
    T156_REVERSAL_MAPPING,
    TRANSFER_MOVEMENT_TYPES,
    get_movement_event_category,
)

spark = get_spark()

# ── 1. MATERIAL ──────────────────────────────────────────────────────────────

@dlt.table(
    comment="Material master — one row per material per plant, with descriptions and compliance attributes",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "material_type"],
)
@dlt.expect_all_or_drop({
    "material_code present": "material_code IS NOT NULL",
    "plant_code present": "plant_code IS NOT NULL"
})
@dlt.expect_all({
    "base_uom present": "base_uom IS NOT NULL",
    "material_type present": "material_type IS NOT NULL"
})
def material():
    mara  = spark.read.table(f"{BRONZE}.materialmaster_mara")
    marc  = spark.read.table(f"{BRONZE}.materialforplant_marc")
    makt  = spark.read.table(f"{BRONZE}.materialdescription_makt").filter(
        F.col("SPRAS") == "E"
    )

    return (
        marc.alias("p")
        .join(mara.alias("g"), ["MATNR", "MANDT"], "left")
        .join(makt.alias("d"), ["MATNR", "MANDT"], "left")
        .select(
            strip_zeros("p.MATNR").alias("material_code"),
            F.col("p.MATNR").alias("material_code_raw"),
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
            F.col("g.STOFF").alias("hazardous_material_number"),

            # ── Plant-specific MRP
            F.col("p.DISPO").alias("mrp_controller"),
            F.col("p.DISMM").alias("mrp_type"),
            F.col("p.FEVOR").alias("production_supervisor_code"),
            F.col("p.LGPRO").alias("production_storage_location"),
            F.col("p.LGFSB").alias("goods_receipt_storage_location"),

            F.col("p.AEDATTM").alias("_replicated_at"),
        )
    )


# ── 2. STORAGE LOCATION ───────────────────────────────────────────────────────

@dlt.table(
    comment="Storage locations — one row per storage location per plant",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_all_or_drop({
    "plant_code present": "plant_code IS NOT NULL",
    "storage_location_code present": "storage_location_code IS NOT NULL"
})
def storage_location():
    src = spark.read.table(f"{BRONZE}.storagelocation_t001l")
    return src.select(
        F.col("WERKS").alias("plant_code"),
        F.col("LGORT").alias("storage_location_code"),
        F.col("LGOBE").alias("storage_location_description"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


# ── 3. WORK CENTRE ────────────────────────────────────────────────────────────

@dlt.table(
    comment="Work centres — one row per work centre per plant, with descriptions",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_all_or_drop({
    "work_centre_code present": "work_centre_code IS NOT NULL",
    "plant_code present": "plant_code IS NOT NULL"
})
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


# ── 4. CAPACITY UTILISATION ───────────────────────────────────────────────────

@dlt.view(name="stg_capacity_utilisation")
@dlt.expect_all_or_drop({
    "plant_code present": "plant_code IS NOT NULL",
    "capacity_id present": "capacity_id IS NOT NULL"
})
def stg_capacity_utilisation():
    kapa_changes = spark.readStream.table(
        f"{BRONZE}.shiftparametersavailablecapacity_kapa"
    ).select("KAPID", "MANDT", "AEDATTM", "AERUNID", "AERECNO")
    kako_changes = spark.readStream.table(f"{BRONZE}.capacityheadersegment_kako").select(
        "KAPID", "MANDT", "AEDATTM", "AERUNID", "AERECNO"
    )

    changed_keys = kapa_changes.unionByName(kako_changes)
    kapa = spark.read.table(f"{BRONZE}.shiftparametersavailablecapacity_kapa")
    kako = spark.read.table(f"{BRONZE}.capacityheadersegment_kako").select(
        "KAPID", "MANDT", "ARBPL", "WERKS", "KAPAR"
    )
    capacities_to_refresh = (
        changed_keys.alias("c")
        .join(kapa.alias("k"), ["KAPID", "MANDT"], "left")
        .select(
            "k.*",
            F.col("c.AEDATTM").alias("_change_replicated_at"),
            F.col("c.AERUNID").alias("_change_run_id"),
            F.col("c.AERECNO").alias("_change_record_seq"),
        )
    )
    return (
        capacities_to_refresh.alias("k")
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

            F.col("k._change_replicated_at").alias("_replicated_at"),
            F.col("k._change_run_id").alias("_run_id"),
            F.col("k._change_record_seq").alias("_record_seq"),
        )
    )

dlt.create_streaming_table(
    name="capacity_utilisation",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "valid_from_date"],
)

dlt.apply_changes(
    target="capacity_utilisation",
    source="stg_capacity_utilisation",
    keys=["capacity_id", "valid_from_date"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    stored_as_scd_type=1,
)


# ── 5. MOVEMENT TYPE CLASSIFICATION ───────────────────────────────────────────

@dlt.table(
    name="movement_type_classification",
    comment="Classification of SAP movement types for warehouse, production, and inventory reporting",
    table_properties={"delta.enableChangeDataFeed": "true"}
)
def movement_type_classification():
    data = [
        Row(
            movement_type_code=code,
            movement_label=label,
            event_category=get_movement_event_category(code),
            is_reversal=code in T156_REVERSAL_MAPPING,
            is_goods_receipt=code in RECEIPT_MOVEMENT_TYPES,
            is_goods_issue=code in ISSUE_MOVEMENT_TYPES,
            is_transfer=code in TRANSFER_MOVEMENT_TYPES,
            is_stock_write_on=code in STOCK_WRITE_ON_MOVEMENT_TYPES,
            is_stock_write_off=code in STOCK_WRITE_OFF_MOVEMENT_TYPES,
            is_production_receipt=code in {"101", "131"},
            is_receipt_reversal=code in {"102", "132"},
            is_scrap=code == "551",
            is_scrap_reversal=code == "552",
        )
        for code, label in sorted(MOVEMENT_TYPE_MAPPING.items())
    ]
    return spark.createDataFrame(data)
