"""
Lakeflow Spark Declarative Pipeline — WM Operations Gold.

Read-only manager surface for the SAP WM staging/dispensary process (WMA-E-19 WM Cockpit,
WMA-E-50 Warehouse Staging with TR Split, WMA-E-28 / PEX-E-61 Dispensary). Serves the
WM Operations app workspace via vw_consumption_wm_operations_* (see
resources/sql/wm_operations_consumption_views_<env>.sql).

Tables:
  gold_wm_staging_worklist  — TR-header-grain supervisor job board (status, operator, queue,
                              campaign, pick progress from linked TOs, work-area classification)
  gold_wm_worklist_summary  — worklist rolled up by plant × warehouse × work_area × status
  gold_wm_order_readiness   — released process orders with TR coverage and PSA supply status
                              (the WM Cockpit TR / ST traffic-light logic, derived read-only)
  gold_wm_bin_stock_detail  — quant-grain stock & bin explorer with storage-zone classification

Storage-zone classification: derived from the governed storage_type_role_mapping table
(role + storage_type_description). Dispensaries are identified by description
('Powder Dispensary', 'Oils Dispensary', …) rather than a hard-coded 8xx storage-type list,
so site onboarding stays config-driven. Verified against C061/104 and P817/208 seeds.

Deterministic base only (no current_date()/current_timestamp()) so the MVs stay incrementally
refreshable; date-relative columns (age_hours, days_to_expiry, readiness band) are served live
by the *_live views (scripts/generate_gold_serving_views_sql.py). See ADR 012.
"""

import dlt
from pyspark.sql import DataFrame, functions as F

from gold._shared import (
    anti_join_optional_deleted_headers,
    get_silver_schema,
    get_spark_session,
    gold_table_args,
)

# LTBK BETYP value identifying process-order-sourced transfer requirements (the WM Cockpit
# creates staging/dispensary TRs with BENUM = AUFNR and BETYP = 'P').
TR_ORDER_REFERENCE_TYPE = "P"

# TR coverage / supply comparisons tolerate rounding noise (full-bag rounding, UoM conversions).
_COVERAGE_FULL_FRACTION = 0.999


def _storage_zone_mapping(spark, silver_schema: str) -> DataFrame:
    """storage_type_role_mapping + a derived storage_zone classification.

    Zones: PALLETISING (801/802 'Palletising (for Prodc./Dispn.)'), DISPENSARY
    ('… Dispensary' pickfaces fed by WMA-E-28 replenishment), PRODUCTION_SUPPLY
    (PSA storage types — order-keyed dynamic bins), INTERIM (9xx GI/GR/posting areas),
    WAREHOUSE (everything else config-mapped). Palletising is matched FIRST so
    'Palletising (for Dispn.)' does not classify as a dispensary.
    """
    mapping = spark.read.table(f"{silver_schema}.storage_type_role_mapping")
    desc = F.lower(F.coalesce(F.col("storage_type_description"), F.lit("")))
    return mapping.select(
        "plant_code",
        "warehouse_number",
        "storage_type",
        "storage_type_description",
        "role",
        F.when(desc.contains("palletis"), F.lit("PALLETISING"))
        .when(desc.contains("dispens"), F.lit("DISPENSARY"))
        .when(desc.contains("production supply"), F.lit("PRODUCTION_SUPPLY"))
        .when(F.col("role") == "INTERIM", F.lit("INTERIM"))
        .otherwise(F.lit("WAREHOUSE"))
        .alias("storage_zone"),
    )


def _zone_lookup(mapping: DataFrame, storage_type_col: str, zone_alias: str) -> DataFrame:
    """Slim (plant, warehouse, storage_type) -> zone projection for a broadcast join."""
    return mapping.select(
        "plant_code",
        "warehouse_number",
        F.col("storage_type").alias(storage_type_col),
        F.col("storage_zone").alias(zone_alias),
    )


# ── 1. STAGING / PICKING WORKLIST ─────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "TR-header-grain supervisor worklist for warehouse staging and dispensary picking. "
        "One row per transfer requirement with derived work area (production staging / "
        "dispensary replenishment / dispensary picking), operational status from the site "
        "RF pick-status fields (blank=open, A=in progress, P=parked, N=no stock, C=complete), "
        "assigned RF operator/queue/campaign, and pick progress from linked transfer orders "
        "(LTAK.TBNUM). Read-only mirror of the ZWMAE0019_NEW Job Assignment grid."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
@dlt.expect("required quantity non-negative", "required_qty >= 0.0")
@dlt.expect("open quantity non-negative", "open_qty >= 0.0")
def gold_wm_staging_worklist():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    trs = spark.read.table(f"{ss}.warehouse_transfer_requirement")
    tos = anti_join_optional_deleted_headers(
        spark.read.table(f"{ss}.warehouse_transfer_order"),
        ss,
        "warehouse_transfer_order_header_delete",
        ["warehouse_number", "transfer_order_number"],
    )
    mapping = _storage_zone_mapping(spark, ss)
    orders = spark.read.table(f"{ss}.process_order").select(
        "order_number",
        F.col("material_code").alias("order_material_code"),
        "scheduled_start_date",
    )
    material = (
        spark.read.table(f"{ss}.material")
        .select("plant_code", "material_code", "material_description")
        .distinct()
    )

    bool_int = lambda c: F.coalesce(c, F.lit(False)).cast("int")  # noqa: E731

    header = (
        trs.groupBy("plant_code", "warehouse_number", "transfer_requirement_number")
        .agg(
            F.count(F.lit(1)).alias("item_count"),
            F.sum(
                F.when(
                    (~F.coalesce(F.col("is_processing_complete"), F.lit(False)))
                    & (F.coalesce(F.col("open_quantity"), F.lit(0.0)) > 0),
                    F.lit(1),
                ).otherwise(F.lit(0))
            ).alias("open_item_count"),
            # All-items-complete only when every item carries ELIKZ.
            (F.min(bool_int(F.col("is_processing_complete"))) == 1).alias("_all_items_complete"),
            F.coalesce(F.sum("required_quantity"), F.lit(0.0)).alias("required_qty"),
            F.coalesce(F.sum("open_quantity"), F.lit(0.0)).alias("open_qty"),
            F.count_distinct("material_code").alias("material_count"),
            F.min("material_code").alias("first_material_code"),
            F.first("base_uom", ignorenulls=True).alias("base_uom"),
            F.count_distinct("base_uom").alias("_uom_count"),
            # Header-level fields are constant across items (denormalised from LTBK).
            F.first("source_storage_type", ignorenulls=True).alias("source_storage_type"),
            F.first("destination_storage_type", ignorenulls=True).alias("destination_storage_type"),
            F.first("destination_bin", ignorenulls=True).alias("destination_bin"),
            F.first("header_status_code", ignorenulls=True).alias("header_status_code"),
            F.min("created_datetime").alias("created_datetime"),
            F.min("planned_execution_datetime").alias("planned_execution_datetime"),
            F.first("source_reference_type", ignorenulls=True).alias("source_reference_type"),
            F.first("source_reference_number", ignorenulls=True).alias("source_reference_number"),
            F.first("queue", ignorenulls=True).alias("queue"),
            F.first("campaign_reference", ignorenulls=True).alias("campaign_reference"),
            F.first("manual_pick_status", ignorenulls=True).alias("manual_pick_status"),
            F.first("direct_pick_status", ignorenulls=True).alias("direct_pick_status"),
            F.first("assigned_operator_manual", ignorenulls=True).alias("assigned_operator_manual"),
            F.first("assigned_operator_direct", ignorenulls=True).alias("assigned_operator_direct"),
            F.first("job_sequence_manual", ignorenulls=True).alias("job_sequence_manual"),
            F.first("job_sequence_direct", ignorenulls=True).alias("job_sequence_direct"),
            F.first("created_by_user", ignorenulls=True).alias("created_by_user"),
            F.first("transfer_priority", ignorenulls=True).alias("transfer_priority"),
        )
    )

    to_progress = (
        tos.filter(F.col("transfer_requirement_number").isNotNull())
        .groupBy("warehouse_number", "transfer_requirement_number")
        .agg(
            F.count(F.lit(1)).alias("to_item_count"),
            F.sum(
                F.when(F.col("item_status") == "Fully Confirmed", F.lit(1)).otherwise(F.lit(0))
            ).alias("to_items_confirmed"),
            F.coalesce(F.sum("requested_quantity"), F.lit(0.0)).alias("to_requested_qty"),
            F.coalesce(F.sum("confirmed_quantity"), F.lit(0.0)).alias("to_confirmed_qty"),
            F.max("confirmed_date").alias("latest_to_confirmed_date"),
        )
    )

    enriched = (
        header
        .join(to_progress, ["warehouse_number", "transfer_requirement_number"], "left")
        .join(
            F.broadcast(_zone_lookup(mapping, "source_storage_type", "source_zone")),
            ["plant_code", "warehouse_number", "source_storage_type"],
            "left",
        )
        .join(
            F.broadcast(_zone_lookup(mapping, "destination_storage_type", "destination_zone")),
            ["plant_code", "warehouse_number", "destination_storage_type"],
            "left",
        )
        .withColumn(
            "work_area",
            F.when(F.col("source_zone") == "DISPENSARY", F.lit("DISPENSARY_PICKING"))
            .when(F.col("destination_zone") == "DISPENSARY", F.lit("DISPENSARY_REPLENISHMENT"))
            .when(
                F.col("destination_zone").isin("PRODUCTION_SUPPLY", "PALLETISING"),
                F.lit("PRODUCTION_STAGING"),
            )
            .otherwise(F.lit("WAREHOUSE_OTHER")),
        )
    )

    # The governing pick status: dispensary picks run on the dispensary RF fields
    # (ZZ_PICK_STAT_D / ZZ_UNAME_D, transaction ZPEXE0061); everything else on the
    # warehouse fields (ZZ_PICK_STAT_M / ZZ_UNAME_M, transaction ZWMAE0050).
    _is_disp_pick = F.col("work_area") == "DISPENSARY_PICKING"
    pick_status = F.upper(
        F.coalesce(
            F.when(_is_disp_pick, F.col("direct_pick_status")).otherwise(F.col("manual_pick_status")),
            F.lit(""),
        )
    )
    raw_operator = F.when(_is_disp_pick, F.col("assigned_operator_direct")).otherwise(
        F.col("assigned_operator_manual")
    )

    classified = (
        enriched
        .withColumn(
            "worklist_status",
            # LTBK.STATU='E' / all items ELIKZ / pick status C all mean done.
            F.when(
                F.col("_all_items_complete")
                | (F.col("header_status_code") == "E")
                | (pick_status == "C"),
                F.lit("COMPLETE"),
            )
            .when(pick_status == "A", F.lit("IN_PROGRESS"))
            .when(pick_status == "P", F.lit("PARKED"))
            .when(pick_status == "N", F.lit("NO_STOCK"))
            .otherwise(F.lit("OPEN")),
        )
        # Parked/complete jobs keep the operator with a '~' prefix (SAP convention).
        .withColumn("assigned_operator", F.regexp_replace(F.coalesce(raw_operator, F.lit("")), "^~", ""))
        .withColumn("assigned_operator", F.when(F.col("assigned_operator") == "", None).otherwise(F.col("assigned_operator")))
        .withColumn(
            "job_sequence",
            F.when(_is_disp_pick, F.col("job_sequence_direct")).otherwise(F.col("job_sequence_manual")),
        )
        .withColumn("has_mixed_base_uom", F.col("_uom_count") > 1)
        .withColumn(
            "pick_progress_fraction",
            F.when(
                (F.col("required_qty") > 0) & (~F.col("has_mixed_base_uom")),
                F.least(
                    F.coalesce(F.col("to_confirmed_qty"), F.lit(0.0)) / F.col("required_qty"),
                    F.lit(1.0),
                ),
            ).otherwise(F.lit(None).cast("double")),
        )
    )

    return (
        classified
        .join(
            orders,
            (classified["source_reference_type"] == TR_ORDER_REFERENCE_TYPE)
            & (classified["source_reference_number"] == orders["order_number"]),
            "left",
        )
        .join(
            F.broadcast(material),
            (classified["plant_code"] == material["plant_code"])
            & (classified["first_material_code"] == material["material_code"]),
            "left",
        )
        .select(
            classified["plant_code"],
            "warehouse_number",
            "transfer_requirement_number",
            "work_area",
            "worklist_status",
            "source_reference_type",
            "source_reference_number",
            F.col("order_material_code"),
            F.col("scheduled_start_date").alias("order_scheduled_start_date"),
            "source_storage_type",
            "source_zone",
            "destination_storage_type",
            "destination_zone",
            "destination_bin",
            "queue",
            "campaign_reference",
            "assigned_operator",
            "job_sequence",
            "manual_pick_status",
            "direct_pick_status",
            "header_status_code",
            "transfer_priority",
            "created_by_user",
            "created_datetime",
            "planned_execution_datetime",
            "item_count",
            "open_item_count",
            "material_count",
            F.when(F.col("material_count") == 1, F.col("first_material_code"))
            .otherwise(F.lit(None))
            .alias("single_material_code"),
            F.when(F.col("material_count") == 1, material["material_description"])
            .otherwise(F.lit(None))
            .alias("single_material_description"),
            "required_qty",
            "open_qty",
            "base_uom",
            "has_mixed_base_uom",
            F.coalesce(F.col("to_item_count"), F.lit(0)).alias("to_item_count"),
            F.coalesce(F.col("to_items_confirmed"), F.lit(0)).alias("to_items_confirmed"),
            F.coalesce(F.col("to_requested_qty"), F.lit(0.0)).alias("to_requested_qty"),
            F.coalesce(F.col("to_confirmed_qty"), F.lit(0.0)).alias("to_confirmed_qty"),
            "latest_to_confirmed_date",
            "pick_progress_fraction",
        )
    )


# ── 2. WORKLIST SUMMARY ───────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "WM worklist rolled up by plant × warehouse × work area × status — the manager's "
        "KPI strip (open / in-progress / parked / no-stock job counts per flow)."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_wm_worklist_summary():
    worklist = dlt.read("gold_wm_staging_worklist")
    return (
        worklist
        .groupBy("plant_code", "warehouse_number", "work_area", "worklist_status")
        .agg(
            F.count(F.lit(1)).alias("tr_count"),
            F.coalesce(F.sum("open_qty"), F.lit(0.0)).alias("total_open_qty"),
            F.coalesce(F.sum("required_qty"), F.lit(0.0)).alias("total_required_qty"),
            F.count_distinct("assigned_operator").alias("operator_count"),
            F.min("planned_execution_datetime").alias("earliest_planned_datetime"),
            F.min("created_datetime").alias("earliest_created_datetime"),
        )
    )


# ── 3. ORDER STAGING READINESS ────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Released process orders with derived TR coverage (component demand converted to "
        "transfer requirements — the WM Cockpit 'TR' status) and PSA supply status (stock "
        "in order-keyed Production Supply bins vs WM component demand — the cockpit 'ST' "
        "status). Coverage denominators use WM-managed components only (RESB rows carrying "
        "a warehouse number); quantity comparisons assume base-UoM consistency and are "
        "approximate for mixed-UoM orders."
    ),
    cluster_by=["plant_code", "scheduled_start_date"],
))
@dlt.expect(
    "tr coverage status valid",
    "tr_coverage_status IN ('NONE', 'PARTIAL', 'FULL')",
)
@dlt.expect(
    "supply status valid",
    "supply_status IN ('NOT_SUPPLIED', 'PARTIAL', 'SUPPLIED')",
)
def gold_wm_order_readiness():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    orders = spark.read.table(f"{ss}.process_order")
    reservations = spark.read.table(f"{ss}.reservation_requirement")
    classification = spark.read.table(f"{ss}.movement_type_classification").select(
        "movement_type_code", "is_production_consumption"
    )
    trs = spark.read.table(f"{ss}.warehouse_transfer_requirement")
    storage_bin = spark.read.table(f"{ss}.storage_bin")
    mapping = _storage_zone_mapping(spark, ss)
    material = (
        spark.read.table(f"{ss}.material")
        .select("plant_code", "material_code", "material_description")
        .distinct()
    )

    # Release evidence: PHAS1 (is_released) where populated, else FTRMI (actual_release_date)
    # — the WM Cockpit's own definition of released (WMA-E-19: status I0002 or FTRMI not
    # initial). Verified live (connected_plant_uat 2026-06-10): the replicated AUFK PHAS0-3
    # flags are blank for all 247k orders, so PHAS1 alone yields zero released orders.
    # Finished evidence: actual_finish_date (GLTRI) — AUFK IDAT2 (TECO) is not yet replicated
    # to silver, so confirmed-finished is the closest available completion signal.
    active_orders = orders.filter(
        (
            F.coalesce(F.col("is_released"), F.lit(False))
            | F.col("actual_release_date").isNotNull()
        )
        & (~F.coalesce(F.col("is_closed"), F.lit(False)))
        & F.col("actual_finish_date").isNull()
    )

    components = (
        reservations
        .join(F.broadcast(classification), "movement_type_code", "inner")
        .filter(
            F.coalesce(F.col("is_production_consumption"), F.lit(False))
            & (~F.coalesce(F.col("is_deletion_flagged"), F.lit(False)))
            & (F.coalesce(F.col("required_quantity"), F.lit(0.0)) > 0)
        )
        .groupBy("order_number")
        .agg(
            F.count(F.lit(1)).alias("component_count"),
            F.sum(F.when(F.col("warehouse_number").isNotNull(), F.lit(1)).otherwise(F.lit(0)))
            .alias("wm_component_count"),
            F.coalesce(F.sum("required_quantity"), F.lit(0.0)).alias("component_required_qty"),
            F.coalesce(
                F.sum(F.when(F.col("warehouse_number").isNotNull(), F.col("required_quantity"))),
                F.lit(0.0),
            ).alias("wm_component_required_qty"),
            F.coalesce(F.sum("open_quantity"), F.lit(0.0)).alias("component_open_qty"),
            F.first("warehouse_number", ignorenulls=True).alias("warehouse_number"),
            F.first("production_supply_area", ignorenulls=True).alias("production_supply_area"),
            F.min("requirement_date").alias("earliest_requirement_date"),
        )
    )

    tr_coverage = (
        trs.filter(F.col("source_reference_type") == TR_ORDER_REFERENCE_TYPE)
        .groupBy(F.col("source_reference_number").alias("order_number"))
        .agg(
            F.count(F.lit(1)).alias("tr_item_count"),
            F.count_distinct("transfer_requirement_number").alias("tr_count"),
            F.coalesce(F.sum("required_quantity"), F.lit(0.0)).alias("tr_required_qty"),
            F.coalesce(F.sum("open_quantity"), F.lit(0.0)).alias("tr_open_qty"),
        )
    )

    # PSA supply: the staging flows put stock into Production Supply storage types using the
    # PROCESS ORDER NUMBER as the (dynamic) storage bin — LQUA.LGPLA = AUFNR (WMA-E-19 'ST'
    # status logic). Bin codes keep SAP zero-padding, order_number is zero-stripped.
    psa_supply = (
        storage_bin
        .filter(F.col("quant_number").isNotNull())
        .join(
            F.broadcast(
                mapping.filter(F.col("storage_zone") == "PRODUCTION_SUPPLY").select(
                    "plant_code", "warehouse_number", "storage_type"
                )
            ),
            ["plant_code", "warehouse_number", "storage_type"],
            "inner",
        )
        .withColumn("order_number", F.regexp_replace(F.col("bin_code"), "^0+", ""))
        .groupBy("plant_code", "order_number")
        .agg(
            F.coalesce(F.sum("total_quantity"), F.lit(0.0)).alias("psa_supplied_qty"),
            F.count(F.lit(1)).alias("psa_quant_count"),
        )
    )

    full_threshold = F.col("wm_component_required_qty") * F.lit(_COVERAGE_FULL_FRACTION)

    return (
        active_orders
        .join(components, "order_number", "left")
        .join(tr_coverage, "order_number", "left")
        .join(psa_supply, ["plant_code", "order_number"], "left")
        .join(F.broadcast(material), ["plant_code", "material_code"], "left")
        .withColumn("component_count", F.coalesce(F.col("component_count"), F.lit(0)))
        .withColumn("wm_component_count", F.coalesce(F.col("wm_component_count"), F.lit(0)))
        .withColumn("component_required_qty", F.coalesce(F.col("component_required_qty"), F.lit(0.0)))
        .withColumn(
            "wm_component_required_qty", F.coalesce(F.col("wm_component_required_qty"), F.lit(0.0))
        )
        .withColumn("component_open_qty", F.coalesce(F.col("component_open_qty"), F.lit(0.0)))
        .withColumn("tr_count", F.coalesce(F.col("tr_count"), F.lit(0)))
        .withColumn("tr_item_count", F.coalesce(F.col("tr_item_count"), F.lit(0)))
        .withColumn("tr_required_qty", F.coalesce(F.col("tr_required_qty"), F.lit(0.0)))
        .withColumn("tr_open_qty", F.coalesce(F.col("tr_open_qty"), F.lit(0.0)))
        .withColumn("psa_supplied_qty", F.coalesce(F.col("psa_supplied_qty"), F.lit(0.0)))
        .withColumn("psa_quant_count", F.coalesce(F.col("psa_quant_count"), F.lit(0)))
        .withColumn(
            "tr_coverage_status",
            F.when(F.col("tr_count") == 0, F.lit("NONE"))
            .when(
                (F.col("wm_component_required_qty") > 0)
                & (F.col("tr_required_qty") >= full_threshold),
                F.lit("FULL"),
            )
            .otherwise(F.lit("PARTIAL")),
        )
        .withColumn(
            "supply_status",
            F.when(F.col("psa_supplied_qty") <= 0, F.lit("NOT_SUPPLIED"))
            .when(
                (F.col("wm_component_required_qty") > 0)
                & (F.col("psa_supplied_qty") >= full_threshold),
                F.lit("SUPPLIED"),
            )
            .otherwise(F.lit("PARTIAL")),
        )
        .withColumn(
            "readiness_status",
            F.when(F.col("supply_status") == "SUPPLIED", F.lit("SUPPLIED"))
            .when(F.col("tr_coverage_status") == "FULL", F.lit("STAGING_PLANNED"))
            .when(F.col("tr_coverage_status") == "PARTIAL", F.lit("PARTIALLY_PLANNED"))
            .when(F.col("wm_component_count") == 0, F.lit("NO_WM_DEMAND"))
            .otherwise(F.lit("NOT_STARTED")),
        )
        .select(
            "order_number",
            "plant_code",
            "warehouse_number",
            "material_code",
            F.col("material_description").alias("material_name"),
            "order_quantity",
            F.col("order_quantity_uom").alias("uom"),
            "scheduled_start_date",
            "scheduled_finish_date",
            "production_supply_area",
            "earliest_requirement_date",
            "component_count",
            "wm_component_count",
            "component_required_qty",
            "wm_component_required_qty",
            "component_open_qty",
            "tr_count",
            "tr_item_count",
            "tr_required_qty",
            "tr_open_qty",
            "tr_coverage_status",
            "psa_supplied_qty",
            "psa_quant_count",
            "supply_status",
            "readiness_status",
        )
    )


# ── 4. BIN / STOCK DETAIL EXPLORER ────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Quant-grain stock & bin explorer: every occupied bin with storage-zone "
        "classification (dispensary / production supply / palletising / interim / "
        "warehouse), stock category, block flags and expiry. The dispensary stock-health "
        "view is this table filtered to storage_zone = 'DISPENSARY'. Empty bins are "
        "excluded (bin-capacity views are served by gold_bin_occupancy)."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_wm_bin_stock_detail():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    storage_bin = spark.read.table(f"{ss}.storage_bin")
    mapping = _storage_zone_mapping(spark, ss)
    material = (
        spark.read.table(f"{ss}.material")
        .select("plant_code", "material_code", "material_description")
        .distinct()
    )

    stock_category = F.when(F.coalesce(F.col("stock_category_code"), F.lit("")) == "", F.lit("UNRESTRICTED")) \
        .when(F.col("stock_category_code") == "Q", F.lit("QUALITY")) \
        .when(F.col("stock_category_code") == "S", F.lit("BLOCKED")) \
        .otherwise(F.lit("OTHER"))

    return (
        storage_bin
        .filter(F.col("quant_number").isNotNull())
        .join(
            F.broadcast(
                mapping.select("plant_code", "warehouse_number", "storage_type", "storage_zone")
            ),
            ["plant_code", "warehouse_number", "storage_type"],
            "left",
        )
        .join(F.broadcast(material), ["plant_code", "material_code"], "left")
        .select(
            "plant_code",
            "warehouse_number",
            "storage_type",
            # Unmapped storage types fall back to the 9xx-interim heuristic used by
            # stock reconciliation; see gold_storage_type_role_coverage_status for gaps.
            F.coalesce(
                F.col("storage_zone"),
                F.when(F.col("storage_type").rlike("^9"), F.lit("INTERIM")).otherwise(
                    F.lit("WAREHOUSE")
                ),
            ).alias("storage_zone"),
            F.col("bin_code"),
            "picking_area",
            "quant_number",
            "material_code",
            "material_description",
            "batch_number",
            "stock_category_code",
            stock_category.alias("stock_category"),
            "total_quantity",
            "available_quantity",
            "putaway_quantity",
            "pick_quantity",
            "open_transfer_quantity",
            "base_uom",
            "goods_receipt_date",
            "expiry_date",
            "last_movement_datetime",
            F.coalesce(F.col("is_blocked_for_stock_removal"), F.lit(False)).alias(
                "is_blocked_for_stock_removal"
            ),
            F.coalesce(F.col("is_blocked_for_putaway"), F.lit(False)).alias(
                "is_blocked_for_putaway"
            ),
            F.coalesce(F.col("is_blocked"), F.lit(False)).alias("is_bin_blocked"),
            "blocking_reason_code",
        )
    )
