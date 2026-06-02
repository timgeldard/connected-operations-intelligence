"""
Reference/Master data domain tables.
"""

import dlt
from pyspark.sql import Row, Window
from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructField, StructType

from silver.helpers import (
    BRONZE,
    PROCESS_LINE_ATINN,
    bronze_published,
    get_spark,
    sap_date,
    sap_flag,
    strip_zeros,
)
from silver.movement_types import build_movement_type_classification_records

# Verified: module-level spark session deleted. All functions load spark lazily.


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
    spark = get_spark()
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
            # Common material code (MARA-BISMT) — the cross-system / common material identifier
            # used to reconcile this material across source systems.
            strip_zeros("g.BISMT").alias("common_material_id"),
            F.col("g.BISMT").alias("common_material_id_raw"),

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
    spark = get_spark()
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
    spark = get_spark()
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
    spark = get_spark()
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
    spark = get_spark()
    overlay = spark.createDataFrame(build_movement_type_classification_records()).alias("overlay")

    published = bronze_published()
    t156_table = f"{published}.movementtype_t156"
    t156t_table = f"{published}.movementtypetext2_t156t"

    t156_exists = False
    try:
        t156_exists = spark.catalog.tableExists(t156_table)
    except Exception:  # noqa: BLE001 - missing catalog/schema is expected in local/sample tests
        t156_exists = False

    if not t156_exists:
        return (
            overlay
            .withColumn("sap_movement_description", F.lit(None).cast("string"))
            .withColumn("sap_debit_credit_indicator", F.lit(None).cast("string"))
            .withColumn("sap_reversal_indicator", F.lit(None).cast("string"))
            .withColumn("classification_source", F.lit("OVERLAY_ONLY"))
        )

    t156_raw = spark.read.table(t156_table).filter(F.col("BWART").isNotNull())
    has_mandt = "MANDT" in t156_raw.columns

    t156t_exists = False
    try:
        t156t_exists = spark.catalog.tableExists(t156t_table)
    except Exception:  # noqa: BLE001 - missing catalog/schema is expected in local/sample tests
        t156t_exists = False

    if t156t_exists:
        text_raw = spark.read.table(t156t_table).filter(
            (F.col("SPRAS") == "E") & F.col("BWART").isNotNull()
        )
        join_cols = ["BWART", "MANDT"] if has_mandt and "MANDT" in text_raw.columns else ["BWART"]
        t156_joined = t156_raw.join(text_raw, join_cols, "left")
    else:
        t156_joined = t156_raw.withColumn("BTEXT", F.lit(None).cast("string"))

    order_cols = [F.col("MANDT")] if has_mandt else [F.lit(1)]
    for optional_col in ("SOBKZ", "KZBEW", "KZZUG", "KZVBR"):
        if optional_col in t156_joined.columns:
            order_cols.append(F.col(optional_col).asc_nulls_first())

    t156 = (
        t156_joined
        .withColumn("_movement_type_rank", F.row_number().over(Window.partitionBy("BWART").orderBy(*order_cols)))
        .filter(F.col("_movement_type_rank") == 1)
        .select(
            F.col("BWART").alias("movement_type_code"),
            F.col("SHKZG").alias("sap_debit_credit_indicator"),
            F.col("XSTBW").alias("sap_reversal_indicator"),
            F.col("BTEXT").alias("sap_movement_description"),
        )
    )

    # Include every code SAP knows about plus the Kerry-confirmed overlay codes. T156-only rows are
    # retained as OTHER/false-flag classifications instead of being absent from the reference table.
    all_codes = (
        t156.select("movement_type_code")
        .unionByName(overlay.select("movement_type_code"))
        .dropDuplicates(["movement_type_code"])
        .alias("codes")
    )

    return (
        all_codes
        .join(t156.alias("sap"), F.col("codes.movement_type_code") == F.col("sap.movement_type_code"), "left")
        .join(overlay, F.col("codes.movement_type_code") == F.col("overlay.movement_type_code"), "left")
        .select(
            F.col("codes.movement_type_code").alias("movement_type_code"),
            F.coalesce(F.col("overlay.movement_label"), F.lit("UNCLASSIFIED_MOVEMENT_TYPE")).alias(
                "movement_label"
            ),
            F.coalesce(F.col("overlay.event_category"), F.lit("OTHER")).alias("event_category"),
            F.coalesce(F.col("overlay.is_reversal"), F.lit(False)).alias("is_reversal"),
            F.coalesce(F.col("overlay.is_goods_receipt"), F.lit(False)).alias("is_goods_receipt"),
            F.coalesce(F.col("overlay.is_goods_issue"), F.lit(False)).alias("is_goods_issue"),
            F.coalesce(F.col("overlay.is_transfer"), F.lit(False)).alias("is_transfer"),
            F.coalesce(F.col("overlay.is_stock_write_on"), F.lit(False)).alias("is_stock_write_on"),
            F.coalesce(F.col("overlay.is_stock_write_off"), F.lit(False)).alias("is_stock_write_off"),
            F.coalesce(F.col("overlay.is_production_receipt"), F.lit(False)).alias("is_production_receipt"),
            F.coalesce(F.col("overlay.is_receipt_reversal"), F.lit(False)).alias("is_receipt_reversal"),
            F.coalesce(F.col("overlay.is_scrap"), F.lit(False)).alias("is_scrap"),
            F.coalesce(F.col("overlay.is_scrap_reversal"), F.lit(False)).alias("is_scrap_reversal"),
            "sap_movement_description",
            "sap_debit_credit_indicator",
            "sap_reversal_indicator",
            F.when(F.col("overlay.movement_type_code").isNotNull() & F.col("sap.movement_type_code").isNotNull(),
                   F.lit("T156_WITH_OVERLAY"))
            .when(F.col("overlay.movement_type_code").isNotNull(), F.lit("OVERLAY_ONLY"))
            .otherwise(F.lit("T156_UNCLASSIFIED"))
            .alias("classification_source"),
        )
    )


# ── 6. PLANT ──────────────────────────────────────────────────────────────────
# Source: published / central_services (T001W is not replicated into the SAP
# source). Read via bronze_published() so the fast/quality pipelines are unaffected.

@dlt.table(
    comment="Plant master — one row per plant, with name, location and org assignments",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_all_or_drop({
    "plant_code present": "plant_code IS NOT NULL",
})
def plant():
    spark = get_spark()
    src = spark.read.table(f"{bronze_published()}.plantcode_t001w")
    return src.select(
        F.col("WERKS").alias("plant_code"),
        F.col("NAME1").alias("plant_name"),
        F.col("NAME2").alias("plant_name_2"),
        F.col("ORT01").alias("city"),
        F.col("LAND1").alias("country_key"),
        F.col("REGIO").alias("region_code"),
        F.col("BWKEY").alias("valuation_area"),
        F.col("EKORG").alias("purchasing_org"),
        F.col("VKORG").alias("sales_org"),
        F.col("SPART").alias("division"),
        strip_zeros("KUNNR").alias("plant_customer_number"),
        strip_zeros("LIFNR").alias("plant_vendor_number"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


# ── 7. CUSTOMER ───────────────────────────────────────────────────────────────
# Source: published / central_services (KNA1 is not replicated into the SAP source).

@dlt.table(
    comment="Customer master — one row per customer (sold-to/ship-to), with name and address",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_all_or_drop({
    "customer_code present": "customer_code IS NOT NULL",
})
def customer():
    spark = get_spark()
    src = spark.read.table(f"{bronze_published()}.customermaster_kna1")
    return src.select(
        strip_zeros("KUNNR").alias("customer_code"),
        F.col("KUNNR").alias("customer_code_raw"),
        F.col("NAME1").alias("customer_name"),
        F.col("NAME2").alias("customer_name_2"),
        F.col("ORT01").alias("city"),
        F.col("LAND1").alias("country_key"),
        F.col("REGIO").alias("region_code"),
        F.col("PSTLZ").alias("postal_code"),
        F.col("STRAS").alias("street"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


# ── 8. STORAGE TYPE ───────────────────────────────────────────────────────────
# WM storage-type dimension (LGTYP) with English description. From the SAP source.

@dlt.table(
    comment="WM storage types — one row per warehouse number and storage type, with description",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_all_or_drop({
    "warehouse_number present": "warehouse_number IS NOT NULL",
    "storage_type present": "storage_type IS NOT NULL",
})
def storage_type():
    spark = get_spark()
    t301 = spark.read.table(f"{BRONZE}.wm_storagetypes_t301")
    t301t = spark.read.table(f"{BRONZE}.wm_storagetypesdescription_t301t").filter(
        F.col("SPRAS") == "E"
    )
    return (
        t301.alias("s")
        .join(t301t.alias("t"), ["LGNUM", "LGTYP", "MANDT"], "left")
        .select(
            F.col("s.LGNUM").alias("warehouse_number"),
            F.col("s.LGTYP").alias("storage_type"),
            F.col("t.LTYPT").alias("storage_type_description"),
            F.col("s.AEDATTM").alias("_replicated_at"),
        )
    )


# ── 9. STOCK AT LOCATION (IM book stock) ──────────────────────────────────────
# MARD — inventory-management book stock per material/plant/storage location.
# Batch snapshot (MARD carries only AEDATTM, no run/seq/RecordActivity).

@dlt.table(
    comment="IM book stock per material, plant and storage location (MARD)",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "storage_location_code"],
)
@dlt.expect_all_or_drop({
    "material_code present": "material_code IS NOT NULL",
    "plant_code present": "plant_code IS NOT NULL",
    "storage_location_code present": "storage_location_code IS NOT NULL",
})
def stock_at_location():
    spark = get_spark()
    src = spark.read.table(f"{BRONZE}.storagelocationmaterial_mard")
    return src.select(
        strip_zeros("MATNR").alias("material_code"),
        F.col("MATNR").alias("material_code_raw"),
        F.col("WERKS").alias("plant_code"),
        F.col("LGORT").alias("storage_location_code"),
        F.col("LABST").alias("unrestricted_quantity"),
        F.col("INSME").alias("quality_inspection_quantity"),
        F.col("SPEME").alias("blocked_quantity"),
        F.col("EINME").alias("restricted_use_quantity"),
        F.col("RETME").alias("blocked_returns_quantity"),
        F.col("UMLME").alias("in_transfer_quantity"),
        sap_flag("LVORM").alias("is_deletion_flagged"),
        F.col("LGPBE").alias("storage_bin"),
        F.col("LFGJA").alias("fiscal_year"),
        F.col("LFMON").alias("fiscal_period"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


# ── 10. MATERIAL VALUATION ────────────────────────────────────────────────────
# MBEW — valuation / pricing per valuation area. Batch snapshot (AEDATTM only).

@dlt.table(
    comment="Material valuation and pricing per valuation area (MBEW)",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["valuation_area", "material_code"],
)
@dlt.expect_all_or_drop({
    "material_code present": "material_code IS NOT NULL",
    "valuation_area present": "valuation_area IS NOT NULL",
})
def material_valuation():
    spark = get_spark()
    src = spark.read.table(f"{BRONZE}.materialvaluation_mbew")
    return src.select(
        strip_zeros("MATNR").alias("material_code"),
        F.col("MATNR").alias("material_code_raw"),
        F.col("BWKEY").alias("valuation_area"),
        F.col("BWTAR").alias("valuation_type"),
        F.col("VPRSV").alias("price_control_indicator"),
        F.col("STPRS").alias("standard_price"),
        F.col("VERPR").alias("moving_average_price"),
        F.col("PEINH").alias("price_unit"),
        F.col("SALK3").alias("total_stock_value"),
        F.col("LBKUM").alias("total_valuated_stock"),
        F.col("BKLAS").alias("valuation_class"),
        F.col("LFGJA").alias("fiscal_year"),
        F.col("LFMON").alias("fiscal_period"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


# ── 11. VENDOR ────────────────────────────────────────────────────────────────
# LFA1 — vendor master (published / central_services). Batch dimension.

@dlt.table(
    comment="Vendor master — one row per vendor, with name and address (LFA1)",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_all_or_drop({
    "vendor_code present": "vendor_code IS NOT NULL",
})
def vendor():
    spark = get_spark()
    src = spark.read.table(f"{bronze_published()}.vendormaster_lfa1")
    return src.select(
        strip_zeros("LIFNR").alias("vendor_code"),
        F.col("LIFNR").alias("vendor_code_raw"),
        F.col("NAME1").alias("vendor_name"),
        F.col("NAME2").alias("vendor_name_2"),
        F.col("ORT01").alias("city"),
        F.col("LAND1").alias("country_key"),
        F.col("REGIO").alias("region_code"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


# ── 12. STORAGE TYPE ROLE MAPPING ─────────────────────────────────────────────

@dlt.table(
    name="storage_type_role_mapping",
    comment="Mapping of storage types to specific functional roles (e.g. LINESIDE) per warehouse and plant",
    table_properties={"delta.enableChangeDataFeed": "true"}
)
def storage_type_role_mapping():
    spark = get_spark()
    # Sourced from a GOVERNED Unity Catalog config table (admins maintain rows without editing code
    # or redeploying) when configured/present — set the `storage_role_config_table` Spark conf to its
    # fully-qualified name (the slow pipeline wires it to <catalog>.<schema>.storage_type_role_mapping_config,
    # seeded from resources/config/storage_type_role_mapping.csv via
    # scripts/generate_storage_type_role_sql.py). Only APPROVED, in-window rows are used. Falls back
    # to a small embedded bootstrap seed so the pipeline never breaks before the config table exists.
    schema = StructType([
        StructField("plant_code", StringType(), True),
        StructField("plant_name", StringType(), True),
        StructField("warehouse_number", StringType(), True),
        StructField("storage_type", StringType(), True),
        StructField("storage_type_description", StringType(), True),
        StructField("role", StringType(), True),
    ])
    config_table = spark.conf.get("storage_role_config_table", None)
    # tableExists can raise (CATALOG_NOT_FOUND / SCHEMA_NOT_FOUND) during DLT compile before the
    # target schema exists (initial bootstrap) — treat any failure as "not present" and fall back.
    table_exists = False
    if config_table:
        try:
            table_exists = spark.catalog.tableExists(config_table)
        except Exception:  # noqa: BLE001 — missing catalog/schema is expected pre-bootstrap
            table_exists = False
    if table_exists:
        return (
            spark.read.table(config_table)
            .filter(
                (F.upper(F.col("review_status")) == "APPROVED")
                & (F.col("valid_from").isNull() | (F.col("valid_from") <= F.current_date()))
                & (F.col("valid_to").isNull() | (F.col("valid_to") > F.current_date()))
            )
            .select("plant_code", "plant_name", "warehouse_number", "storage_type", "storage_type_description", "role")
        )

    # Bootstrap fallback (C061 / warehouse 208) — used only until the governed config table exists.
    data = [
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208", storage_type="100", storage_type_description="Production Supply",       role="LINESIDE"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208", storage_type="801", storage_type_description="Palletising (for Prodc.)", role="LINESIDE"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208", storage_type="802", storage_type_description="Palletising (for Dispn.)", role="LINESIDE"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208", storage_type="803", storage_type_description=None,                        role="LINESIDE"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208", storage_type="804", storage_type_description=None,                        role="LINESIDE"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208", storage_type="805", storage_type_description=None,                        role="LINESIDE"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208", storage_type="901", storage_type_description="GR Area for Production",    role="INTERIM"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208", storage_type="902", storage_type_description="GR Area External Rcpts",    role="INTERIM"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208", storage_type="911", storage_type_description=None,                        role="INTERIM"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208", storage_type="922", storage_type_description="Posting Change Area",        role="INTERIM"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208", storage_type="999", storage_type_description="Differences",                role="INTERIM"),
    ]
    return spark.createDataFrame(data, schema)


# ── 13. RECIPE PROCESS LINE ───────────────────────────────────────────────────

@dlt.table(
    name="recipe_process_line",
    comment="Recipe/task-list (PLKO) → process-line classification map (SAP class type 018: "
            "recipe key → INOB → AUSP value → CAWNT English text). One row per recipe object key. "
            "process_order joins this for production_line enrichment. Lives in the slow (triggered) "
            "tier so the fast process_order stream reads a small pre-aggregated map instead of "
            "re-scanning AUSP every microbatch.",
    table_properties={"delta.enableChangeDataFeed": "true"},
)
def recipe_process_line():
    spark = get_spark()
    # Classification tables live in the PUBLISHED (central_services) source, NOT in the SAP source
    # (verified live: connected_plant_uat.sap has none of INOB/AUSP/CAWNT). Read via bronze_published().
    published = bronze_published()
    inob = (
        spark.read.table(f"{published}.internalnumberobjectlink_inob")
        .filter((F.col("KLART") == "018") & (F.col("OBTAB") == "PLKO"))
        .select(F.col("OBJEK").alias("_objek"), F.col("CUOBJ").alias("_cuobj"))
    )
    # If PROCESS_LINE_ATINN is configured, select only that characteristic (avoids picking the wrong
    # one when the 018/PLKO class carries multiple characteristics). Default None = take what's present.
    ausp = spark.read.table(f"{published}.objectcharacteristics_ausp").filter(F.col("KLART") == "018")
    if PROCESS_LINE_ATINN is not None:
        ausp = ausp.filter(F.col("ATINN") == PROCESS_LINE_ATINN)
    ausp = ausp.select(
        F.col("OBJEK").alias("_cuobj"),
        F.col("ATINN").alias("_atinn"),
        F.col("ATZHL").alias("_atzhl"),
        F.col("ATWRT").alias("_atwrt"),
    )
    # CAWNT description in English ('E' is the SAP language code — consistent with MAKT/CRTX elsewhere).
    cawnt = (
        spark.read.table(f"{published}.characteristicvaluedescription_cawnt")
        .filter(F.col("SPRAS") == "E")
        .select(
            F.col("ATINN").alias("_atinn"),
            F.col("ATZHL").alias("_atzhl"),
            F.col("ATWTB").alias("_atwtb"),
        )
    )
    # Pick value + description TOGETHER via a struct so the description always belongs to the
    # selected value (independent F.max() on each could mix them across characteristics).
    return (
        inob.join(ausp, "_cuobj", "inner")
        .join(cawnt, ["_atinn", "_atzhl"], "left")
        .groupBy("_objek")
        .agg(
            F.max(
                F.struct(
                    F.col("_atwrt").alias("production_line"),
                    F.col("_atwtb").alias("production_line_description"),
                )
            ).alias("_pl")
        )
        .select(
            F.col("_objek").alias("recipe_object_key"),
            F.col("_pl.production_line").alias("production_line"),
            F.col("_pl.production_line_description").alias("production_line_description"),
        )
    )


# ── 14. MATERIAL UOM CONVERSION ───────────────────────────────────────────────
# MARM — alternate-unit conversion factors per material.
# Verified ingested in UAT: `materialconversion_marm` (1.57M rows, 1.05M materials,
# 76 alt UoMs, zero zero-denominators, 2026-06-02).
# Conversion direction confirmed: qty_base = qty_alt × UMREZ / UMREN.

@dlt.table(
    name="material_uom_conversion",
    comment=(
        "SAP MARM alternate-unit conversion factors. "
        "qty_in_base_uom = qty_in_alt_uom * numerator / denominator. "
        "Base UoM per material is MARA-MEINS, available in silver.material.base_uom."
    ),
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_all_or_drop({
    "material_code present": "material_code IS NOT NULL",
    "alternate_uom present": "alternate_uom IS NOT NULL",
    "valid_conversion": "is_valid_conversion = true",
})
def material_uom_conversion():
    spark = get_spark()
    src = spark.read.table(f"{BRONZE}.materialconversion_marm")
    return src.select(
        strip_zeros("MATNR").alias("material_code"),
        F.col("MATNR").alias("material_code_raw"),
        F.col("MEINH").alias("alternate_uom"),
        F.col("UMREZ").cast("double").alias("numerator"),
        F.col("UMREN").cast("double").alias("denominator"),
        F.when(
            F.col("UMREN").cast("double") != 0,
            F.col("UMREZ").cast("double") / F.col("UMREN").cast("double"),
        ).otherwise(F.lit(None).cast("double")).alias("conversion_factor_to_base"),
        (F.col("UMREN").cast("double") != 0).alias("is_valid_conversion"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


# ── 15. WAREHOUSE STORAGE LOCATION MAPPING ────────────────────────────────────
# T320 — warehouse ↔ storage-location mapping from the published (central_services) catalog.
# Every (plant, storage_location) maps to exactly one warehouse (verified UAT 2026-06-02:
# 996 distinct plant/sloc combos, 0 with multiple warehouses).
# The reverse (warehouse → sloc) is 1:many; this table maps sloc → warehouse only.

@dlt.table(
    name="warehouse_storage_location_mapping",
    comment=(
        "T320 storage-location to warehouse mapping (from central_services). "
        "Every (plant, storage_location) maps to exactly 1 warehouse; "
        "one warehouse may serve multiple storage-locations. "
        "Used to bridge IM sloc-grain data to WM warehouse-grain data."
    ),
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_all_or_drop({
    "plant_code present": "plant_code IS NOT NULL",
    "storage_location_code present": "storage_location_code IS NOT NULL",
    "warehouse_number present": "warehouse_number IS NOT NULL",
})
def warehouse_storage_location_mapping():
    spark = get_spark()
    src = spark.read.table(f"{bronze_published()}.warehouseforplant_t320")
    return (
        src.select(
            F.col("WERKS").alias("plant_code"),
            F.col("LGORT").alias("storage_location_code"),
            F.col("LGNUM").alias("warehouse_number"),
        )
        .distinct()
    )
