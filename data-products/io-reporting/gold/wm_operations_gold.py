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
from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from gold._shared import (
    anti_join_optional_deleted_headers,
    get_silver_schema,
    get_spark_session,
    gold_table_args,
    table_exists,
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


def _material_lookup(spark, silver_schema: str) -> DataFrame:
    """(plant_code, material_code) -> material_description, guaranteed unique per key.

    groupBy + first(non-null) rather than distinct(): if silver ever carries more than one
    description for a material (historical churn), distinct() on all three columns would keep
    both rows and fan out every join below."""
    return (
        spark.read.table(f"{silver_schema}.material")
        .groupBy("plant_code", "material_code")
        .agg(F.first("material_description", ignorenulls=True).alias("material_description"))
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
        "production_line",
    )
    material = _material_lookup(spark, ss)

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
            F.max("confirmed_datetime").alias("latest_to_confirmed_datetime"),
            # Short-pick signal: ABS(difference_quantity) summed across items with a non-zero
            # difference. NULL when all difference_quantity inputs are NULL (additive column —
            # fills as TO items churn after the LAGP columns land). Do NOT coalesce to 0.
            F.sum(
                F.when(
                    F.col("difference_quantity") != 0,  # NULL != 0 -> NULL -> when() yields NULL (deliberate: chip hides on NULL)
                    F.abs(F.col("difference_quantity")),
                )
            ).alias("short_pick_qty"),
            F.sum(
                F.when(
                    F.col("difference_quantity") != 0,  # NULL != 0 -> NULL -> when() yields NULL (deliberate: chip hides on NULL)
                    F.lit(1),
                )
            ).alias("short_pick_item_count"),
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
            "latest_to_confirmed_datetime",
            F.when(
                F.col("latest_to_confirmed_datetime").isNotNull() & F.col("created_datetime").isNotNull(),
                (F.unix_timestamp(F.col("latest_to_confirmed_datetime"))
                 - F.unix_timestamp(F.col("created_datetime"))) / 3600.0,
            ).alias("cycle_hours"),
            "pick_progress_fraction",
            # Short-pick passthrough: NULL when no TO difference_quantity data yet (additive);
            # non-null only when at least one item carried a non-zero difference.
            "short_pick_qty",
            "short_pick_item_count",
            # Production line passthrough from process_order (production_line = CRVER/line ID;
            # 99.99% populated at C061/P817 — 35 lines / 18-19 lines respectively, verified UAT
            # 2026-06-11). NULL when the TR source is not a process order or order is not found.
            F.col("production_line").alias("order_production_line"),
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
    material = _material_lookup(spark, ss)

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
            # Production line passthrough from process_order (verified UAT 2026-06-11:
            # 99.99% populated at C061/P817 — 35 lines / 18-19 lines respectively).
            "production_line",
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
    material = _material_lookup(spark, ss)

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


# ── 5. ORDER COMPONENT DETAIL (drill-through) ─────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Component-level staging detail for active process orders — the drill-through "
        "behind Order Readiness. One row per component reservation with material-level "
        "TR coverage (LTBK BETYP='P'), staging-TO pick progress (LTAK BETYP='F'), and "
        "order-keyed PSA bin supply. TR/TO/PSA rollups are at order x material grain "
        "(silver TR items do not carry RSPOS), so components sharing a material show the "
        "same pool — flagged via material_component_count."
    ),
    cluster_by=["plant_code", "order_number"],
))
def gold_wm_order_component_detail():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    orders = spark.read.table(f"{ss}.process_order")
    reservations = spark.read.table(f"{ss}.reservation_requirement")
    classification = spark.read.table(f"{ss}.movement_type_classification").select(
        "movement_type_code", "is_production_consumption"
    )
    trs = spark.read.table(f"{ss}.warehouse_transfer_requirement")
    tos = anti_join_optional_deleted_headers(
        spark.read.table(f"{ss}.warehouse_transfer_order"),
        ss,
        "warehouse_transfer_order_header_delete",
        ["warehouse_number", "transfer_order_number"],
    )
    storage_bin = spark.read.table(f"{ss}.storage_bin")
    mapping = _storage_zone_mapping(spark, ss)
    material = _material_lookup(spark, ss)

    # Same activity filter as gold_wm_order_readiness (PHAS flags blank in replication).
    active_orders = orders.filter(
        (
            F.coalesce(F.col("is_released"), F.lit(False))
            | F.col("actual_release_date").isNotNull()
        )
        & (~F.coalesce(F.col("is_closed"), F.lit(False)))
        & F.col("actual_finish_date").isNull()
    ).select("order_number", "plant_code")

    components = (
        reservations
        .join(F.broadcast(classification), "movement_type_code", "inner")
        .filter(
            F.coalesce(F.col("is_production_consumption"), F.lit(False))
            & (~F.coalesce(F.col("is_deletion_flagged"), F.lit(False)))
            & (F.coalesce(F.col("required_quantity"), F.lit(0.0)) > 0)
        )
        .join(active_orders.withColumnRenamed("plant_code", "_order_plant"), "order_number", "inner")
        .withColumn("plant_code", F.coalesce(F.col("plant_code"), F.col("_order_plant")))
        .drop("_order_plant")
    )

    tr_by_material = (
        trs.filter(F.col("source_reference_type") == TR_ORDER_REFERENCE_TYPE)
        .groupBy(
            F.col("source_reference_number").alias("order_number"),
            F.col("material_code"),
        )
        .agg(
            F.count_distinct("transfer_requirement_number").alias("tr_count"),
            F.coalesce(F.sum("required_quantity"), F.lit(0.0)).alias("tr_required_qty"),
            F.coalesce(F.sum("open_quantity"), F.lit(0.0)).alias("tr_open_qty"),
        )
    )

    to_by_material = (
        tos.filter(F.col("source_reference_type") == "F")
        .groupBy(
            F.col("source_reference_number").alias("order_number"),
            F.col("material_code"),
        )
        .agg(
            F.count(F.lit(1)).alias("to_item_count"),
            F.sum(
                F.when(F.col("item_status") == "Fully Confirmed", F.lit(1)).otherwise(F.lit(0))
            ).alias("to_items_confirmed"),
            F.coalesce(F.sum("confirmed_quantity"), F.lit(0.0)).alias("to_confirmed_qty"),
        )
    )

    psa_by_material = (
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
        .groupBy("plant_code", "order_number", "material_code")
        .agg(F.coalesce(F.sum("total_quantity"), F.lit(0.0)).alias("psa_supplied_qty"))
    )

    full_threshold = F.col("required_quantity") * F.lit(_COVERAGE_FULL_FRACTION)
    material_window = Window.partitionBy("order_number", "material_code")

    return (
        components
        .join(tr_by_material, ["order_number", "material_code"], "left")
        .join(psa_by_material, ["plant_code", "order_number", "material_code"], "left")
        .join(to_by_material, ["order_number", "material_code"], "left")
        .join(F.broadcast(material), ["plant_code", "material_code"], "left")
        .withColumn("material_component_count", F.count(F.lit(1)).over(material_window))
        .withColumn("tr_count", F.coalesce(F.col("tr_count"), F.lit(0)))
        .withColumn("tr_required_qty", F.coalesce(F.col("tr_required_qty"), F.lit(0.0)))
        .withColumn("tr_open_qty", F.coalesce(F.col("tr_open_qty"), F.lit(0.0)))
        .withColumn("to_item_count", F.coalesce(F.col("to_item_count"), F.lit(0)))
        .withColumn("to_items_confirmed", F.coalesce(F.col("to_items_confirmed"), F.lit(0)))
        .withColumn("to_confirmed_qty", F.coalesce(F.col("to_confirmed_qty"), F.lit(0.0)))
        .withColumn("psa_supplied_qty", F.coalesce(F.col("psa_supplied_qty"), F.lit(0.0)))
        .withColumn(
            "tr_coverage_status",
            F.when(F.col("tr_count") == 0, F.lit("NONE"))
            .when(F.col("tr_required_qty") >= full_threshold, F.lit("FULL"))
            .otherwise(F.lit("PARTIAL")),
        )
        .withColumn(
            "pick_progress_fraction",
            F.when(
                F.col("required_quantity") > 0,
                F.least(F.col("to_confirmed_qty") / F.col("required_quantity"), F.lit(1.0)),
            ).otherwise(F.lit(None).cast("double")),
        )
        .withColumn("is_supplied", F.col("psa_supplied_qty") >= full_threshold)
        .select(
            "plant_code",
            "order_number",
            "reservation_number",
            "reservation_item",
            "operation_number",
            "warehouse_number",
            "material_code",
            "material_description",
            "batch_number",
            "required_quantity",
            "open_quantity",
            F.col("base_uom").alias("uom"),
            "production_supply_area",
            "requirement_date",
            "material_component_count",
            "tr_count",
            "tr_required_qty",
            "tr_open_qty",
            "tr_coverage_status",
            "to_item_count",
            "to_items_confirmed",
            "to_confirmed_qty",
            "pick_progress_fraction",
            "psa_supplied_qty",
            "is_supplied",
        )
    )


# ── 6. OPERATOR ACTIVITY ──────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "RF operator pick activity at plant x warehouse x operator x confirmation-date "
        "grain, from confirmed transfer-order items (LTAP QNAME/QDATU). Quantity totals "
        "mix base UoMs — item counts are the comparable measure."
    ),
    cluster_by=["plant_code", "activity_date"],
))
def gold_wm_operator_activity():
    spark = get_spark_session()
    ss = get_silver_schema(spark)
    tos = spark.read.table(f"{ss}.warehouse_transfer_order")

    return (
        tos.filter(
            F.col("confirmed_by_user").isNotNull()
            & (F.col("confirmed_by_user") != "")
            & F.col("confirmed_date").isNotNull()
        )
        .withColumn(
            "shift",
            F.when(F.col("confirmed_datetime").isNull(), F.lit("UNKNOWN"))
            .when(F.hour("confirmed_datetime").between(6, 13), F.lit("EARLY"))
            .when(F.hour("confirmed_datetime").between(14, 21), F.lit("LATE"))
            .otherwise(F.lit("NIGHT")),
        )
        .groupBy(
            "plant_code",
            "warehouse_number",
            F.col("confirmed_by_user").alias("operator"),
            F.col("confirmed_date").alias("activity_date"),
            "shift",
        )
        .agg(
            F.count(F.lit(1)).alias("items_confirmed"),
            F.count_distinct("transfer_order_number").alias("transfer_orders"),
            F.count_distinct("material_code").alias("materials"),
            F.count_distinct("transfer_requirement_number").alias("transfer_requirements"),
            F.coalesce(F.sum("confirmed_quantity"), F.lit(0.0)).alias("confirmed_qty"),
        )
    )


# ── 7. QUEUE WORKLOAD ─────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Current open WM workload by plant x warehouse x queue x work area, rolled up "
        "from the staging worklist (non-complete jobs only)."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_wm_queue_workload():
    worklist = dlt.read("gold_wm_staging_worklist")
    return (
        worklist
        .filter(F.col("worklist_status") != "COMPLETE")
        .withColumn("queue", F.coalesce(F.col("queue"), F.lit("")))
        .groupBy("plant_code", "warehouse_number", "queue", "work_area")
        .agg(
            F.count(F.lit(1)).alias("open_jobs"),
            F.sum(F.when(F.col("worklist_status") == "IN_PROGRESS", F.lit(1)).otherwise(F.lit(0))).alias("in_progress_jobs"),
            F.sum(F.when(F.col("worklist_status") == "PARKED", F.lit(1)).otherwise(F.lit(0))).alias("parked_jobs"),
            F.sum(F.when(F.col("worklist_status") == "NO_STOCK", F.lit(1)).otherwise(F.lit(0))).alias("no_stock_jobs"),
            F.count_distinct("assigned_operator").alias("operator_count"),
            F.min("planned_execution_datetime").alias("earliest_planned_datetime"),
            F.min("created_datetime").alias("earliest_created_datetime"),
        )
    )


# ── 8. CAMPAIGN SUMMARY ───────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Campaign-grouped picking progress (LTBK ZZ_CAMPAIGN — WMA-E-29/50 shared-material "
        "campaign picking): TR/status counts, orders covered, operators, quantities."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_wm_campaign_summary():
    worklist = dlt.read("gold_wm_staging_worklist")
    return (
        worklist
        .filter(F.col("campaign_reference").isNotNull() & (F.col("campaign_reference") != ""))
        .groupBy("plant_code", "warehouse_number", "campaign_reference")
        .agg(
            F.count(F.lit(1)).alias("tr_count"),
            F.sum(F.when(F.col("worklist_status") == "COMPLETE", F.lit(1)).otherwise(F.lit(0))).alias("complete_trs"),
            F.sum(F.when(F.col("worklist_status") == "IN_PROGRESS", F.lit(1)).otherwise(F.lit(0))).alias("in_progress_trs"),
            F.sum(F.when(F.col("worklist_status") == "PARKED", F.lit(1)).otherwise(F.lit(0))).alias("parked_trs"),
            F.sum(F.when(F.col("worklist_status") == "NO_STOCK", F.lit(1)).otherwise(F.lit(0))).alias("no_stock_trs"),
            F.count_distinct(
                F.when(F.col("source_reference_type") == TR_ORDER_REFERENCE_TYPE,
                       F.col("source_reference_number"))
            ).alias("order_count"),
            F.count_distinct("assigned_operator").alias("operator_count"),
            F.first("work_area", ignorenulls=True).alias("work_area"),
            F.coalesce(F.sum("required_qty"), F.lit(0.0)).alias("required_qty"),
            F.coalesce(F.sum("open_qty"), F.lit(0.0)).alias("open_qty"),
            F.min("planned_execution_datetime").alias("earliest_planned_datetime"),
            F.min("created_datetime").alias("earliest_created_datetime"),
        )
    )


# ── 9. DAILY ACTIVITY (trend facts) ──────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Daily warehouse activity series per plant: TO items confirmed, TRs created, and "
        "IM goods receipts/issues. Deterministic facts (no snapshots) for trend charts."
    ),
    cluster_by=["plant_code", "activity_date"],
))
def gold_wm_daily_activity():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    tos = (
        spark.read.table(f"{ss}.warehouse_transfer_order")
        .filter(F.col("confirmed_date").isNotNull())
        .groupBy("plant_code", F.col("confirmed_date").alias("activity_date"))
        .agg(
            F.count(F.lit(1)).alias("to_items_confirmed"),
            F.count_distinct("confirmed_by_user").alias("active_operators"),
        )
    )
    trs = (
        spark.read.table(f"{ss}.warehouse_transfer_requirement")
        .filter(F.col("created_datetime").isNotNull())
        .groupBy("plant_code", F.to_date("created_datetime").alias("activity_date"))
        .agg(F.count_distinct("transfer_requirement_number").alias("trs_created"))
    )
    goods = (
        spark.read.table(f"{ss}.goods_movement")
        .join(
            F.broadcast(
                spark.read.table(f"{ss}.movement_type_classification").select(
                    "movement_type_code", "is_goods_receipt", "is_goods_issue"
                )
            ),
            "movement_type_code",
            "left",
        )
        .filter(F.col("posting_date").isNotNull())
        .groupBy("plant_code", F.col("posting_date").alias("activity_date"))
        .agg(
            F.sum(F.when(F.coalesce(F.col("is_goods_receipt"), F.lit(False)), F.lit(1)).otherwise(F.lit(0))).alias("goods_receipt_lines"),
            F.sum(F.when(F.coalesce(F.col("is_goods_issue"), F.lit(False)), F.lit(1)).otherwise(F.lit(0))).alias("goods_issue_lines"),
        )
    )

    keys = ["plant_code", "activity_date"]
    return (
        tos.join(trs, keys, "full")
        .join(goods, keys, "full")
        .filter(F.col("plant_code").isNotNull() & F.col("activity_date").isNotNull())
        .withColumn("to_items_confirmed", F.coalesce(F.col("to_items_confirmed"), F.lit(0)))
        .withColumn("active_operators", F.coalesce(F.col("active_operators"), F.lit(0)))
        .withColumn("trs_created", F.coalesce(F.col("trs_created"), F.lit(0)))
        .withColumn("goods_receipt_lines", F.coalesce(F.col("goods_receipt_lines"), F.lit(0)))
        .withColumn("goods_issue_lines", F.coalesce(F.col("goods_issue_lines"), F.lit(0)))
    )


# ── 10. SLOW MOVERS / DEAD STOCK ──────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Value-weighted stock aging at plant x warehouse x material x batch grain: quantity, "
        "standard-price value, and the most recent movement timestamp. Query-time age and "
        "aging buckets live in the _live view. Interim (9xx) zones excluded."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_wm_slow_movers():
    spark = get_spark_session()
    ss = get_silver_schema(spark)
    storage_bin = spark.read.table(f"{ss}.storage_bin")
    mapping = _storage_zone_mapping(spark, ss)
    material = _material_lookup(spark, ss)
    price = (
        spark.read.table(f"{ss}.material_valuation")
        .groupBy(F.col("valuation_area").alias("plant_code"), "material_code")
        .agg(
            F.first("standard_price", ignorenulls=True).alias("standard_price"),
            F.first("price_unit", ignorenulls=True).alias("price_unit"),
        )
    )

    quants = (
        storage_bin
        .filter(F.col("quant_number").isNotNull())
        .join(
            F.broadcast(mapping.select("plant_code", "warehouse_number", "storage_type", "storage_zone")),
            ["plant_code", "warehouse_number", "storage_type"],
            "left",
        )
        .withColumn(
            "storage_zone",
            F.coalesce(
                F.col("storage_zone"),
                F.when(F.col("storage_type").rlike("^9"), F.lit("INTERIM")).otherwise(F.lit("WAREHOUSE")),
            ),
        )
        .filter(F.col("storage_zone") != "INTERIM")
    )

    return (
        quants
        .groupBy("plant_code", "warehouse_number", "material_code", "batch_number", "base_uom")
        .agg(
            F.count(F.lit(1)).alias("quant_count"),
            F.coalesce(F.sum("total_quantity"), F.lit(0.0)).alias("total_qty"),
            F.max("last_movement_datetime").alias("last_movement_datetime"),
            F.min("goods_receipt_date").alias("earliest_goods_receipt_date"),
            F.min("expiry_date").alias("earliest_expiry_date"),
        )
        .join(F.broadcast(material), ["plant_code", "material_code"], "left")
        .join(price, ["plant_code", "material_code"], "left")
        .withColumn(
            "stock_value",
            F.col("total_qty")
            * F.coalesce(F.col("standard_price"), F.lit(0.0))
            / F.when(F.coalesce(F.col("price_unit"), F.lit(0)).cast("double") == 0, F.lit(1.0))
             .otherwise(F.col("price_unit").cast("double")),
        )
    )


# ── 11. STAGING PACE (hourly staged-in throughput) ───────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Hourly material-handler throughput INTO staging buffers: confirmed TO items whose "
        "destination is a PALLETISING or PRODUCTION_SUPPLY zone, bucketed by confirmation "
        "hour. Derived from TO flows (bulk-drop log ZWMA_BULK_DROP_TO_LOG not yet "
        "replicated); feeds the staging-pace wave chart and the per-hour-of-day historical "
        "baselines (avg / best) that define what a good day looks like."
    ),
    cluster_by=["plant_code", "activity_hour"],
))
def gold_wm_staging_pace_hourly():
    spark = get_spark_session()
    ss = get_silver_schema(spark)
    tos = spark.read.table(f"{ss}.warehouse_transfer_order")
    mapping = _storage_zone_mapping(spark, ss)

    return (
        tos
        .filter(F.col("confirmed_datetime").isNotNull())
        .join(
            F.broadcast(
                mapping.filter(F.col("storage_zone").isin("PALLETISING", "PRODUCTION_SUPPLY"))
                .select(
                    "plant_code", "warehouse_number",
                    F.col("storage_type").alias("destination_storage_type"),
                    F.col("storage_zone").alias("destination_zone"),
                )
            ),
            ["plant_code", "warehouse_number", "destination_storage_type"],
            "inner",
        )
        .withColumn("activity_hour", F.date_trunc("hour", F.col("confirmed_datetime")))
        .groupBy("plant_code", "warehouse_number", "destination_zone", "activity_hour")
        .agg(
            F.count(F.lit(1)).alias("items_staged"),
            F.coalesce(F.sum("confirmed_quantity"), F.lit(0.0)).alias("qty_staged"),
            F.count_distinct("confirmed_by_user").alias("operators"),
        )
    )


# ── 12. STAGING DEMAND (hourly planned demand wave) ──────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Planned staging demand wave: open TR quantity bucketed by planned execution hour "
        "and work area. Compared against gold_wm_staging_pace_hourly to show whether "
        "handlers are running ahead of or behind the wave."
    ),
    cluster_by=["plant_code", "demand_hour"],
))
def gold_wm_staging_demand_hourly():
    spark = get_spark_session()
    ss = get_silver_schema(spark)
    worklist = dlt.read("gold_wm_staging_worklist")
    # Order-level PSA (first non-null component PRVBE) — the hyper-local "area within
    # plant" axis; TRs without an order reference keep a null area.
    psa_by_order = (
        spark.read.table(f"{ss}.reservation_requirement")
        .filter(F.col("production_supply_area").isNotNull())
        .groupBy("order_number")
        .agg(F.first("production_supply_area", ignorenulls=True).alias("production_supply_area"))
    )
    return (
        worklist
        .filter(
            (F.col("worklist_status") != "COMPLETE")
            & F.col("planned_execution_datetime").isNotNull()
        )
        .join(
            psa_by_order,
            (worklist["source_reference_type"] == TR_ORDER_REFERENCE_TYPE)
            & (worklist["source_reference_number"] == psa_by_order["order_number"]),
            "left",
        )
        .withColumn("demand_hour", F.date_trunc("hour", F.col("planned_execution_datetime")))
        .groupBy("plant_code", "warehouse_number", "work_area", "production_supply_area", "demand_hour")
        .agg(
            F.count(F.lit(1)).alias("open_trs"),
            F.coalesce(F.sum("open_qty"), F.lit(0.0)).alias("open_qty"),
        )
    )


# ── 13. STAGING BUFFER FLOW (hourly in/out of palletising) ────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Hourly flows in and out of the palletising (bulk-drop) buffer from confirmed TO "
        "items: in = destination zone PALLETISING, out = source zone PALLETISING. The app "
        "reconstructs the buffer level B(t) by cumulating net flow and anchoring the latest "
        "point to current palletising-zone stock."
    ),
    cluster_by=["plant_code", "activity_hour"],
))
def gold_wm_staging_buffer_flow_hourly():
    spark = get_spark_session()
    ss = get_silver_schema(spark)
    tos = spark.read.table(f"{ss}.warehouse_transfer_order").filter(
        F.col("confirmed_datetime").isNotNull()
    )
    mapping = _storage_zone_mapping(spark, ss)
    pall = mapping.filter(F.col("storage_zone") == "PALLETISING").select(
        "plant_code", "warehouse_number", "storage_type"
    )

    inflow = (
        tos.join(
            F.broadcast(pall.withColumnRenamed("storage_type", "destination_storage_type")),
            ["plant_code", "warehouse_number", "destination_storage_type"],
            "inner",
        )
        .withColumn("activity_hour", F.date_trunc("hour", F.col("confirmed_datetime")))
        .groupBy("plant_code", "warehouse_number", "activity_hour")
        .agg(
            F.count(F.lit(1)).alias("items_in"),
            F.coalesce(F.sum("confirmed_quantity"), F.lit(0.0)).alias("qty_in"),
        )
    )
    outflow = (
        tos.join(
            F.broadcast(pall.withColumnRenamed("storage_type", "source_storage_type")),
            ["plant_code", "warehouse_number", "source_storage_type"],
            "inner",
        )
        .withColumn("activity_hour", F.date_trunc("hour", F.col("confirmed_datetime")))
        .groupBy("plant_code", "warehouse_number", "activity_hour")
        .agg(
            F.count(F.lit(1)).alias("items_out"),
            F.coalesce(F.sum("confirmed_quantity"), F.lit(0.0)).alias("qty_out"),
        )
    )

    keys = ["plant_code", "warehouse_number", "activity_hour"]
    return (
        inflow.join(outflow, keys, "full")
        .withColumn("items_in", F.coalesce(F.col("items_in"), F.lit(0)))
        .withColumn("qty_in", F.coalesce(F.col("qty_in"), F.lit(0.0)))
        .withColumn("items_out", F.coalesce(F.col("items_out"), F.lit(0)))
        .withColumn("qty_out", F.coalesce(F.col("qty_out"), F.lit(0.0)))
        .withColumn("net_qty", F.col("qty_in") - F.col("qty_out"))
    )


# ── 14. QM LOT CONTEXT (held-stock enrichment) ────────────────────────────────

# Source-guarded: the silver QM tables only materialise where the QM bronze sources are
# replicated (silver/tables/quality.py guards on column presence; the tables are plant- and
# time-gated — rolling qm_lookback_years window). The app handles the absent dataset gracefully
# (QM columns show as em-dashes).

if (
    table_exists(get_spark_session(), f"{get_silver_schema(get_spark_session())}.quality_inspection_lot")
    and table_exists(get_spark_session(), f"{get_silver_schema(get_spark_session())}.quality_inspection_usage_decision")
):

    @dlt.table(**gold_table_args(
        comment=(
            "Quality inspection-lot context per plant x material x batch: open (no usage "
            "decision yet) lot counts and the latest decision from the 1:many QAVE child table. "
            "Joined client-side onto Stock Health held stock and Inbound to answer 'why is this "
            "batch in QI and when is the UD due'. Covers the silver QM lookback window only."
        ),
        cluster_by=["plant_code", "material_code"],
    ))
    def gold_wm_qm_lot_context():
        spark = get_spark_session()
        ss = get_silver_schema(spark)
        lots = spark.read.table(f"{ss}.quality_inspection_lot")
        # Usage decisions are a 1:many child of the lot (QAVE); collapse to the latest decision
        # per lot (by decision date, then counter) before joining so the lot grain is preserved.
        uds = spark.read.table(f"{ss}.quality_inspection_usage_decision")
        latest_ud = uds.groupBy("inspection_lot_number").agg(
            F.expr(
                "max_by(usage_decision, struct(coalesce(usage_decision_date, DATE'1900-01-01'),"
                " coalesce(usage_decision_counter, '')))"
            ).alias("_last_ud"),
            F.max("usage_decision_date").alias("_last_ud_date"),
        )

        return (
            lots
            .join(latest_ud, "inspection_lot_number", "left")
            # Open = no usage decision recorded for the lot at all.
            .withColumn("_is_open", F.col("_last_ud").isNull().cast("int"))
            .groupBy("plant_code", "material_code", "batch_number")
            .agg(
                F.count(F.lit(1)).alias("lot_count"),
                F.sum("_is_open").alias("open_lot_count"),
                F.max("inspection_lot_number").alias("latest_lot_number"),
                F.first("inspection_lot_origin_code", ignorenulls=True).alias("lot_origin_code"),
                F.min(
                    F.when(F.col("_is_open") == 1, F.col("lot_created_date"))
                ).alias("oldest_open_start_date"),
                F.expr(
                    "max_by(_last_ud, coalesce(_last_ud_date, DATE'1900-01-01'))"
                ).alias("last_usage_decision"),
                F.max("_last_ud_date").alias("last_usage_decision_date"),
            )
        )


# ── 15. QM LOT STATUS (lot-grain manager view — all lots, not just open) ─────
#
# Source-guarded: silver QM tables only materialise when the QM bronze sources are
# replicated (quality.py guards on column presence; tables are plant- and time-gated).

if (
    table_exists(get_spark_session(), f"{get_silver_schema(get_spark_session())}.quality_inspection_lot")
    and table_exists(get_spark_session(), f"{get_silver_schema(get_spark_session())}.quality_inspection_usage_decision")
):

    @dlt.table(**gold_table_args(
        comment=(
            "QM inspection lot status — one row per plant_code × inspection_lot_number (all lots "
            "in the silver lookback window). Carries lot header fields, material name from the "
            "material lookup, and the latest usage decision (collapsed from the 1:many QAVE child "
            "via max_by date+counter). Date-relative columns (lot_age_days, ud_lead_time_days, "
            "is_overdue) live in the qm_lot_status_live serving view (no current_date() here)."
        ),
        cluster_by=["plant_code", "lot_created_date"],
    ))
    def gold_wm_qm_lot_status():
        spark = get_spark_session()
        ss = get_silver_schema(spark)
        lots = spark.read.table(f"{ss}.quality_inspection_lot")
        uds = spark.read.table(f"{ss}.quality_inspection_usage_decision")
        material = _material_lookup(spark, ss)

        # Collapse UD child table to the latest UD per lot (max_by date then counter, same
        # logic as gold_wm_qm_lot_context). This preserves lot grain on the outer join.
        latest_ud = uds.groupBy("plant_code", "inspection_lot_number").agg(
            F.expr(
                "max_by(struct(usage_decision_valuation, usage_decision, usage_decision_code,"
                " usage_decision_code_group, quality_score, usage_decision_by, usage_decision_date,"
                " usage_decision_counter),"
                " struct(coalesce(usage_decision_date, DATE'1900-01-01'),"
                "        coalesce(usage_decision_counter, '')))"
            ).alias("_ud"),
        )

        return (
            lots.alias("l")
            .join(latest_ud.alias("ud"), ["plant_code", "inspection_lot_number"], "left")
            .join(F.broadcast(material), ["plant_code", "material_code"], "left")
            .select(
                F.col("l.inspection_lot_number"),
                F.col("l.plant_code"),
                F.col("l.inspection_lot_origin_code"),
                F.col("l.inspection_type"),
                F.col("l.material_code"),
                F.col("material_description").alias("material_name"),
                F.col("l.batch_number"),
                F.col("l.order_number"),
                F.col("l.lot_created_date"),
                F.col("l.inspection_start_date"),
                F.col("l.inspection_end_date"),
                F.col("l.inspection_lot_quantity"),
                F.col("l.inspection_lot_uom"),
                # has_usage_decision: true when a UD row exists for this lot.
                F.col("_ud").isNotNull().alias("has_usage_decision"),
                # Flatten the latest-UD struct (NULL when no UD).
                F.col("_ud.usage_decision").alias("last_usage_decision"),
                F.col("_ud.usage_decision_date").alias("last_usage_decision_date"),
                F.col("_ud.usage_decision_by").alias("last_usage_decision_by"),
                F.col("_ud.quality_score").alias("quality_score"),
            )
        )

    @dlt.table(**gold_table_args(
        comment=(
            "QM disposition queue — open lots only (no usage decision). Enriched with blocked "
            "stock quantity (quality_inspection_quantity from batch_stock, the MCHB.CINSM field) "
            "and estimated blocked value (blocked_qty × standard_price / price_unit from "
            "material_valuation). Grain: plant_code × inspection_lot_number. Date-relative columns "
            "(lot_age_days, is_overdue) live in the qm_disposition_queue_live serving view."
        ),
        cluster_by=["plant_code", "lot_created_date"],
    ))
    def gold_wm_qm_disposition_queue():
        spark = get_spark_session()
        ss = get_silver_schema(spark)
        lots = spark.read.table(f"{ss}.quality_inspection_lot")
        uds = spark.read.table(f"{ss}.quality_inspection_usage_decision")
        material = _material_lookup(spark, ss)

        # Latest-UD guard: open = no UD row at all for this lot.
        latest_ud_keys = (
            uds.groupBy("plant_code", "inspection_lot_number")
            .agg(F.count(F.lit(1)).alias("_ud_count"))
        )

        open_lots = (
            lots.join(latest_ud_keys, ["plant_code", "inspection_lot_number"], "left")
            .filter(F.col("_ud_count").isNull())
            .drop("_ud_count")
        )

        # Blocked stock: MCHB.CINSM (quality_inspection_quantity) aggregated to plant×material×batch.
        blocked = (
            spark.read.table(f"{ss}.batch_stock")
            .groupBy("plant_code", "material_code", "batch_number")
            .agg(
                F.coalesce(F.sum("quality_inspection_quantity"), F.lit(0.0)).alias("blocked_qty"),
                F.first("base_uom", ignorenulls=True).alias("blocked_uom"),
            )
        )

        # Standard price / price unit (same pattern as gold_wm_slow_movers).
        price = (
            spark.read.table(f"{ss}.material_valuation")
            .groupBy(F.col("valuation_area").alias("plant_code"), "material_code")
            .agg(
                F.first("standard_price", ignorenulls=True).alias("standard_price"),
                F.first("price_unit", ignorenulls=True).alias("price_unit"),
            )
        )

        return (
            open_lots.alias("l")
            .join(F.broadcast(material), ["plant_code", "material_code"], "left")
            .join(
                blocked.alias("bs"),
                (F.col("l.plant_code") == F.col("bs.plant_code"))
                & (F.col("l.material_code") == F.col("bs.material_code"))
                & F.col("l.batch_number").eqNullSafe(F.col("bs.batch_number")),
                "left",
            )
            .join(price, ["plant_code", "material_code"], "left")
            .select(
                F.col("l.inspection_lot_number"),
                F.col("l.plant_code"),
                F.col("l.inspection_lot_origin_code"),
                F.col("l.inspection_type"),
                F.col("l.material_code"),
                F.col("material_description").alias("material_name"),
                F.col("l.batch_number"),
                F.col("l.order_number"),
                F.col("l.lot_created_date"),
                F.col("l.inspection_start_date"),
                F.col("l.inspection_end_date"),
                F.col("l.inspection_lot_quantity"),
                F.col("l.inspection_lot_uom"),
                F.coalesce(F.col("bs.blocked_qty"), F.lit(0.0)).alias("blocked_qty"),
                F.col("bs.blocked_uom"),
                F.col("standard_price"),
                F.col("price_unit"),
                # est_blocked_value: blocked_qty × standard_price / price_unit (price_unit=0 → NULL)
                F.when(
                    F.coalesce(F.col("price_unit").cast("double"), F.lit(0.0)) > 0,
                    F.coalesce(F.col("bs.blocked_qty"), F.lit(0.0))
                    * F.col("standard_price")
                    / F.col("price_unit").cast("double"),
                ).otherwise(F.lit(None).cast("double")).alias("est_blocked_value"),
            )
        )


# ── 17. ORDER OPERATIONS (operation-level enrichment for Order Detail overlay) ──

@dlt.table(**gold_table_args(
    comment=(
        "Process-order operations enriched with work-centre description — one row per "
        "plant_code × order_number × routing_number × operation_counter. Drill-through "
        "behind the Order Detail overlay (Item B): operation sequence, scheduled window, "
        "actual start, yield, scrap, and derived completion status. "
        "LEFT JOIN to work_centre on work_centre_internal_id + plant_code."
    ),
    cluster_by=["plant_code", "order_number"],
))
def gold_wm_order_operations():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    ops = spark.read.table(f"{ss}.process_order_operation")
    wc = spark.read.table(f"{ss}.work_centre")

    return (
        ops.alias("op")
        .join(
            F.broadcast(
                wc.select(
                    "plant_code",
                    "work_centre_internal_id",
                    "work_centre_code",
                    "work_centre_description",
                ).alias("wc")
            ),
            (F.col("op.plant_code") == F.col("wc.plant_code"))
            & (F.col("op.work_centre_internal_id") == F.col("wc.work_centre_internal_id")),
            "left",
        )
        .select(
            F.col("op.plant_code"),
            F.col("op.order_number"),
            F.col("op.routing_number"),
            F.col("op.operation_counter"),
            F.col("op.operation_number"),
            F.col("op.operation_description"),
            F.col("op.control_key"),
            F.col("wc.work_centre_code"),
            F.col("wc.work_centre_description"),
            F.col("op.scheduled_start_datetime"),
            F.col("op.scheduled_finish_datetime"),
            F.col("op.actual_start_datetime"),
            F.col("op.actual_finish_date"),
            F.col("op.operation_quantity"),
            F.col("op.confirmed_yield_quantity"),
            F.col("op.confirmed_scrap_quantity"),
            F.col("op.is_confirmed"),
        )
    )


# ── 18. DOWNTIME PARETO (weekly aggregated pareto by reason) ──────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Weekly production downtime pareto: plant_code × week_start × "
        "downtime_reason_code × sub_reason_code × work_centre_code grain. "
        "week_start = date_trunc('week', start_datetime) cast to DATE. "
        "Aggregates event_count, total/avg duration, and distinct order count. "
        "Rows with NULL start_datetime are excluded. Feeds the Production Health view."
    ),
    cluster_by=["plant_code", "week_start"],
))
def gold_wm_downtime_pareto():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    dt = spark.read.table(f"{ss}.downtime_event").filter(F.col("start_datetime").isNotNull())

    return (
        dt.withColumn("week_start", F.to_date(F.date_trunc("week", F.col("start_datetime"))))
        .groupBy(
            "plant_code",
            "week_start",
            "downtime_reason_code",
            "sub_reason_code",
            "work_centre_code",
        )
        .agg(
            F.first("downtime_reason_description", ignorenulls=True).alias("downtime_reason_description"),
            F.first("sub_reason_description", ignorenulls=True).alias("sub_reason_description"),
            F.first("production_line_description", ignorenulls=True).alias("production_line_description"),
            F.count(F.lit(1)).alias("event_count"),
            F.coalesce(F.sum("duration_minutes"), F.lit(0.0)).alias("total_duration_minutes"),
            (F.coalesce(F.sum("duration_minutes"), F.lit(0.0)) / F.count(F.lit(1))).alias(
                "avg_duration_minutes"
            ),
            F.count_distinct("order_number").alias("distinct_order_count"),
        )
    )


# ── 19. DOWNTIME EVENT DETAIL (event-grain passthrough) ───────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Production downtime events at event grain — passthrough of the key columns "
        "from silver.downtime_event for drill-through in the Production Health view. "
        "Feeds the recent-events table and order-number drill-through."
    ),
    cluster_by=["plant_code", "start_datetime"],
))
def gold_wm_downtime_event_detail():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    return (
        spark.read.table(f"{ss}.downtime_event")
        .select(
            "plant_code",
            "work_centre_code",
            "machine_code",
            "machine_description",
            "production_line_description",
            "order_number",
            "material_code",
            "operation_number",
            "item_number",
            "downtime_reason_code",
            "downtime_reason_description",
            "sub_reason_code",
            "sub_reason_description",
            "start_datetime",
            "end_datetime",
            "duration_minutes",
            "reported_by_user",
            "comment",
        )
    )


# -- 20. ORDER JOURNEY SUMMARY (per-order milestone summary) ------------------

@dlt.table(**gold_table_args(
    comment=(
        "Per-order milestone summary for the Order Journey Timeline view -- one row per "
        "plant_code x order_number. Milestones from five sources joined by order_number: "
        "process_order (created/release/scheduled dates, production_line, material), "
        "warehouse_transfer_requirement (staging: first TR created ts, first/last staging "
        "confirmed ts, item counts via TBNUM linkage), process_order_operation (production "
        "actual start/finish, confirmed yield/scrap), pi_sheet_execution (PI first/last "
        "activity -- absent at P806; left join, nullable), goods_movement (GR from 101 by "
        "order_number, GI/issue qty from 261 family, delivery_count from delivery_number "
        "where present). Derived lag columns only where both endpoints exist. "
        "Deterministic: no current_date(). cluster_by plant_code x scheduled_start_date."
    ),
    cluster_by=["plant_code", "scheduled_start_date"],
))
def gold_wm_order_journey_summary():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    orders = spark.read.table(f"{ss}.process_order")
    trs = spark.read.table(f"{ss}.warehouse_transfer_requirement")
    tos = anti_join_optional_deleted_headers(
        spark.read.table(f"{ss}.warehouse_transfer_order"),
        ss,
        "warehouse_transfer_order_header_delete",
        ["warehouse_number", "transfer_order_number"],
    )
    material = _material_lookup(spark, ss)

    # -- Staging milestones from TR/TO (same TBNUM linkage as worklist) --------
    tr_by_order = (
        trs.filter(F.col("source_reference_type") == TR_ORDER_REFERENCE_TYPE)
        .groupBy("plant_code", F.col("source_reference_number").alias("order_number"))
        .agg(
            F.min("created_datetime").alias("first_tr_created_ts"),
            F.count_distinct("transfer_requirement_number").alias("tr_count"),
        )
    )

    # Single TR↔TO join produces both confirmed-ts fields and item counts in one pass,
    # grouping on plant_code + order_number to avoid cross-plant fan-out.
    to_agg = (
        tos.filter(F.col("transfer_requirement_number").isNotNull())
        .join(
            trs.filter(F.col("source_reference_type") == TR_ORDER_REFERENCE_TYPE)
            .select(
                F.col("transfer_requirement_number"),
                F.col("source_reference_number").alias("order_number"),
                F.col("plant_code"),
            )
            .distinct(),
            "transfer_requirement_number",
            "inner",
        )
        .groupBy("plant_code", "order_number")
        .agg(
            F.min(
                F.when(F.col("item_status") == "Fully Confirmed", F.col("confirmed_datetime"))
            ).alias("staging_first_confirmed_ts"),
            F.max(
                F.when(F.col("item_status") == "Fully Confirmed", F.col("confirmed_datetime"))
            ).alias("staging_last_confirmed_ts"),
            F.sum(
                F.when(F.col("item_status") == "Fully Confirmed", F.lit(1)).otherwise(F.lit(0))
            ).alias("staging_confirmed_item_count"),
            F.count(F.lit(1)).alias("staging_total_item_count"),
        )
    )

    # -- Production milestones from process_order_operation --------------------
    ops_agg = (
        spark.read.table(f"{ss}.process_order_operation")
        .groupBy("order_number")
        .agg(
            F.min("actual_start_datetime").alias("production_first_actual_start"),
            F.max("actual_finish_date").alias("production_last_actual_finish"),
            F.coalesce(F.sum("confirmed_yield_quantity"), F.lit(0.0)).alias("confirmed_yield_qty"),
            F.coalesce(F.sum("confirmed_scrap_quantity"), F.lit(0.0)).alias("confirmed_scrap_qty"),
        )
    )

    # -- PI sheet execution milestones (absent at P806 -- left join) -----------
    pi_agg = None
    if table_exists(spark, f"{ss}.pi_sheet_execution"):
        pi_agg = (
            spark.read.table(f"{ss}.pi_sheet_execution")
            .groupBy("order_number")
            .agg(
                F.min("start_datetime").alias("pi_first_start"),
                F.max("end_datetime").alias("pi_last_end"),
            )
        )

    # -- Goods movement milestones ---------------------------------------------
    goods = spark.read.table(f"{ss}.goods_movement")

    gr_agg = (
        goods.filter(
            (F.col("movement_type_code") == "101")
            & F.col("order_number").isNotNull()
            & F.col("posting_date").isNotNull()
        )
        .groupBy("order_number")
        .agg(
            F.min("posting_date").alias("first_gr_posting_date"),
            F.max("posting_date").alias("last_gr_posting_date"),
            F.coalesce(F.sum("quantity"), F.lit(0.0)).alias("gr_qty"),
        )
    )

    issue_agg = (
        goods.filter(
            F.col("movement_type_code").isin("261", "262")
            & F.col("order_number").isNotNull()
        )
        .groupBy("order_number")
        .agg(
            F.coalesce(
                F.sum(
                    F.when(F.col("movement_type_code") == "261", F.col("quantity"))
                    .when(F.col("movement_type_code") == "262", -F.col("quantity"))
                    .otherwise(F.lit(0.0))
                ),
                F.lit(0.0),
            ).alias("issue_qty")
        )
    )

    delivery_agg = (
        goods.filter(
            (F.col("movement_type_code") == "101")
            & F.col("order_number").isNotNull()
            & F.col("delivery_number").isNotNull()
        )
        .groupBy("order_number")
        .agg(F.count_distinct("delivery_number").alias("delivery_count"))
    )

    # -- QM lot context (source-guarded) ---------------------------------------
    qm_agg = None
    if table_exists(spark, f"{ss}.quality_inspection_lot"):
        qm_agg = (
            spark.read.table(f"{ss}.quality_inspection_lot")
            .filter(F.col("order_number").isNotNull())
            .groupBy("order_number")
            .agg(
                F.count_distinct("inspection_lot_number").alias("qm_lot_count"),
                F.count_distinct(
                    F.when(
                        ~F.coalesce(F.col("usage_decision_taken"), F.lit(False)),
                        F.col("inspection_lot_number"),
                    )
                ).alias("qm_open_lot_count"),
            )
        )

    # -- Base: all process orders ---------------------------------------------
    result = (
        orders
        .join(F.broadcast(material), ["plant_code", "material_code"], "left")
        .join(tr_by_order, ["plant_code", "order_number"], "left")
        .join(to_agg, ["plant_code", "order_number"], "left")
        .join(ops_agg, "order_number", "left")
        .join(gr_agg, "order_number", "left")
        .join(issue_agg, "order_number", "left")
        .join(delivery_agg, "order_number", "left")
    )
    if pi_agg is not None:
        result = result.join(pi_agg, "order_number", "left")
    else:
        result = result.withColumn("pi_first_start", F.lit(None).cast("timestamp"))
        result = result.withColumn("pi_last_end", F.lit(None).cast("timestamp"))
    if qm_agg is not None:
        result = result.join(qm_agg, "order_number", "left")
    else:
        result = (
            result
            .withColumn("qm_lot_count", F.lit(None).cast("long"))
            .withColumn("qm_open_lot_count", F.lit(None).cast("long"))
        )

    def _lag_hours(ts_start, ts_end):
        return F.when(
            ts_start.isNotNull() & ts_end.isNotNull(),
            (F.unix_timestamp(ts_end) - F.unix_timestamp(ts_start)) / 3600.0,
        )

    return result.select(
        "plant_code",
        "order_number",
        F.col("material_code"),
        F.col("material_description").alias("material_name"),
        F.col("order_quantity").alias("order_qty"),
        F.col("order_quantity_uom").alias("uom"),
        "production_line",
        F.col("created_datetime").alias("order_created_ts"),
        F.col("actual_release_date").alias("release_date"),
        F.col("scheduled_start_date"),
        F.col("scheduled_finish_date"),
        # Staging milestones
        "first_tr_created_ts",
        F.col("tr_count").alias("staging_tr_count"),
        "staging_first_confirmed_ts",
        "staging_last_confirmed_ts",
        F.coalesce(F.col("staging_confirmed_item_count"), F.lit(0)).alias("staged_item_count"),
        F.coalesce(F.col("staging_total_item_count"), F.lit(0)).alias("staged_item_total"),
        # Production milestones
        "production_first_actual_start",
        F.col("production_last_actual_finish").cast("timestamp").alias("production_last_actual_finish"),
        F.coalesce(F.col("confirmed_yield_qty"), F.lit(0.0)).alias("confirmed_yield_qty"),
        F.coalesce(F.col("confirmed_scrap_qty"), F.lit(0.0)).alias("confirmed_scrap_qty"),
        # PI milestones (nullable -- absent at P806)
        "pi_first_start",
        "pi_last_end",
        # GR / issue milestones
        "first_gr_posting_date",
        "last_gr_posting_date",
        F.coalesce(F.col("gr_qty"), F.lit(0.0)).alias("gr_qty"),
        F.coalesce(F.col("issue_qty"), F.lit(0.0)).alias("issue_qty"),
        F.coalesce(F.col("delivery_count"), F.lit(0)).alias("delivery_count"),
        # QM (nullable -- source-guarded)
        "qm_lot_count",
        "qm_open_lot_count",
        # Derived lag hours (both endpoints must exist)
        _lag_hours(
            F.col("actual_release_date").cast("timestamp"),
            F.col("first_tr_created_ts"),
        ).alias("release_to_first_tr_hours"),
        _lag_hours(
            F.col("first_tr_created_ts"),
            F.col("staging_last_confirmed_ts"),
        ).alias("tr_to_staged_hours"),
        _lag_hours(
            F.col("staging_last_confirmed_ts"),
            F.col("production_first_actual_start"),
        ).alias("staged_to_production_hours"),
        _lag_hours(
            F.col("production_first_actual_start"),
            F.col("first_gr_posting_date").cast("timestamp"),
        ).alias("production_to_gr_hours"),
    )


# -- 21. ORDER JOURNEY EVENTS (long-format per-order event timeline) -----------

@dlt.table(**gold_table_args(
    comment=(
        "Long-format per-order event timeline for the Order Journey Timeline view -- one row "
        "per event, identified by (plant_code, order_number, event_seq). Sources UNION ALL:"
        "ORDER_CREATED / RELEASED from process_order; TR_CREATED from "
        "warehouse_transfer_requirement (BETYP='P'); STAGING_CONFIRMED from "
        "warehouse_transfer_order items (Fully Confirmed, via TBNUM->BETYP='P' TR chain); "
        "PI_START / PI_END from pi_sheet_execution (left/optional); "
        "OPERATION_CONFIRMED from process_order_operation (is_confirmed=true); "
        "GR_POSTED from goods_movement (movement_type 101 by order_number); "
        "COMPONENT_ISSUED from goods_movement (261 family); "
        "QM_LOT_CREATED / QM_UD_TAKEN from quality_inspection_lot + usage decision (source-guarded). "
        "event_seq = row_number over event_ts NULLS LAST within plant_code x order_number. "
        "Deterministic: no current_date(). cluster_by plant_code x order_number."
    ),
    cluster_by=["plant_code", "order_number"],
))
@dlt.expect("event_ts present", "event_ts IS NOT NULL OR event_type IS NOT NULL")
@dlt.expect("order_number present", "order_number IS NOT NULL")
@dlt.expect("plant_code present", "plant_code IS NOT NULL")
def gold_wm_order_journey_events():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    orders = spark.read.table(f"{ss}.process_order")
    trs = spark.read.table(f"{ss}.warehouse_transfer_requirement")
    tos = anti_join_optional_deleted_headers(
        spark.read.table(f"{ss}.warehouse_transfer_order"),
        ss,
        "warehouse_transfer_order_header_delete",
        ["warehouse_number", "transfer_order_number"],
    )
    goods = spark.read.table(f"{ss}.goods_movement")

    # -- ORDER_CREATED ---------------------------------------------------------
    ev_created = (
        orders
        .filter(F.col("created_datetime").isNotNull())
        .select(
            "plant_code",
            "order_number",
            F.col("created_datetime").alias("event_ts"),
            F.lit("ORDER_CREATED").alias("event_type"),
            F.lit(None).cast("double").alias("qty"),
            F.lit(None).cast("string").alias("uom"),
            F.lit(None).cast("string").alias("reference_id"),
            F.lit("Order created").alias("detail"),
        )
    )

    # -- RELEASED --------------------------------------------------------------
    ev_released = (
        orders
        .filter(F.col("actual_release_date").isNotNull())
        .select(
            "plant_code",
            "order_number",
            F.col("actual_release_date").cast("timestamp").alias("event_ts"),
            F.lit("RELEASED").alias("event_type"),
            F.lit(None).cast("double").alias("qty"),
            F.lit(None).cast("string").alias("uom"),
            F.lit(None).cast("string").alias("reference_id"),
            F.lit("Order released").alias("detail"),
        )
    )

    # -- TR_CREATED ------------------------------------------------------------
    ev_tr = (
        trs.filter(
            (F.col("source_reference_type") == TR_ORDER_REFERENCE_TYPE)
            & F.col("created_datetime").isNotNull()
        )
        .select(
            "plant_code",
            F.col("source_reference_number").alias("order_number"),
            F.col("created_datetime").alias("event_ts"),
            F.lit("TR_CREATED").alias("event_type"),
            F.col("required_quantity").alias("qty"),
            F.col("base_uom").alias("uom"),
            F.col("transfer_requirement_number").alias("reference_id"),
            F.concat_ws(" ", F.lit("TR"), F.col("transfer_requirement_number")).alias("detail"),
        )
    )

    # -- STAGING_CONFIRMED (TO item grain, Fully Confirmed, order-linked TRs) --
    tr_order_map = (
        trs.filter(F.col("source_reference_type") == TR_ORDER_REFERENCE_TYPE)
        .select(
            F.col("transfer_requirement_number"),
            F.col("source_reference_number").alias("order_number"),
            F.col("plant_code"),
        )
        .distinct()
    )
    ev_staging = (
        tos.filter(
            F.col("transfer_requirement_number").isNotNull()
            & (F.col("item_status") == "Fully Confirmed")
            & F.col("confirmed_datetime").isNotNull()
        )
        .join(tr_order_map, "transfer_requirement_number", "inner")
        .select(
            "plant_code",
            "order_number",
            F.col("confirmed_datetime").alias("event_ts"),
            F.lit("STAGING_CONFIRMED").alias("event_type"),
            F.col("confirmed_quantity").alias("qty"),
            F.col("base_uom").alias("uom"),
            F.col("transfer_order_number").alias("reference_id"),
            F.concat_ws(
                " ",
                F.lit("TO"),
                F.col("transfer_order_number"),
                F.lit("item"),
                F.col("transfer_order_item").cast("string"),
            ).alias("detail"),
        )
    )

    # -- OPERATION_CONFIRMED ---------------------------------------------------
    ev_ops = (
        spark.read.table(f"{ss}.process_order_operation")
        .filter(
            F.coalesce(F.col("is_confirmed"), F.lit(False))
            & F.col("actual_start_datetime").isNotNull()
        )
        .join(
            orders.select("order_number", "plant_code"),
            "order_number",
            "inner",
        )
        .select(
            "plant_code",
            "order_number",
            F.col("actual_start_datetime").alias("event_ts"),
            F.lit("OPERATION_CONFIRMED").alias("event_type"),
            F.col("confirmed_yield_quantity").alias("qty"),
            F.lit(None).cast("string").alias("uom"),
            F.col("operation_number").alias("reference_id"),
            F.coalesce(
                F.col("operation_description"),
                F.concat_ws(" ", F.lit("Op"), F.col("operation_number")),
            ).alias("detail"),
        )
    )

    # -- PI_START / PI_END -----------------------------------------------------
    pi_events: list = []
    if table_exists(spark, f"{ss}.pi_sheet_execution"):
        pi = spark.read.table(f"{ss}.pi_sheet_execution")
        pi_start = (
            pi.filter(F.col("start_datetime").isNotNull() & F.col("order_number").isNotNull())
            .join(orders.select("order_number", "plant_code"), "order_number", "inner")
            .select(
                "plant_code",
                "order_number",
                F.col("start_datetime").alias("event_ts"),
                F.lit("PI_START").alias("event_type"),
                F.lit(None).cast("double").alias("qty"),
                F.lit(None).cast("string").alias("uom"),
                F.col("pi_sheet_number").alias("reference_id"),
                F.lit("PI sheet started").alias("detail"),
            )
        )
        pi_end = (
            pi.filter(F.col("end_datetime").isNotNull() & F.col("order_number").isNotNull())
            .join(orders.select("order_number", "plant_code"), "order_number", "inner")
            .select(
                "plant_code",
                "order_number",
                F.col("end_datetime").alias("event_ts"),
                F.lit("PI_END").alias("event_type"),
                F.lit(None).cast("double").alias("qty"),
                F.lit(None).cast("string").alias("uom"),
                F.col("pi_sheet_number").alias("reference_id"),
                F.lit("PI sheet ended").alias("detail"),
            )
        )
        pi_events = [pi_start, pi_end]

    # -- GR_POSTED -------------------------------------------------------------
    ev_gr = (
        goods.filter(
            (F.col("movement_type_code") == "101")
            & F.col("order_number").isNotNull()
            & F.col("posting_date").isNotNull()
        )
        .join(orders.select("order_number", "plant_code"), "order_number", "inner")
        .select(
            "plant_code",
            "order_number",
            F.col("posting_date").cast("timestamp").alias("event_ts"),
            F.lit("GR_POSTED").alias("event_type"),
            F.col("quantity").alias("qty"),
            F.col("base_uom").alias("uom"),
            F.col("material_document_number").alias("reference_id"),
            F.lit("Goods receipt (101)").alias("detail"),
        )
    )

    # -- COMPONENT_ISSUED ------------------------------------------------------
    ev_issue = (
        goods.filter(
            F.col("movement_type_code").isin("261", "262")
            & F.col("order_number").isNotNull()
            & F.col("posting_date").isNotNull()
        )
        .join(orders.select("order_number", "plant_code"), "order_number", "inner")
        .select(
            "plant_code",
            "order_number",
            F.col("posting_date").cast("timestamp").alias("event_ts"),
            F.lit("COMPONENT_ISSUED").alias("event_type"),
            F.col("quantity").alias("qty"),
            F.col("base_uom").alias("uom"),
            F.col("material_document_number").alias("reference_id"),
            F.concat_ws(" ", F.lit("Issue"), F.col("movement_type_code")).alias("detail"),
        )
    )

    # -- QM_LOT_CREATED / QM_UD_TAKEN -----------------------------------------
    qm_events: list = []
    if table_exists(spark, f"{ss}.quality_inspection_lot"):
        qml = spark.read.table(f"{ss}.quality_inspection_lot")
        ev_qm_created = (
            qml.filter(
                F.col("order_number").isNotNull()
                & F.col("lot_created_date").isNotNull()
            )
            .join(orders.select("order_number", "plant_code"), "order_number", "inner")
            .select(
                "plant_code",
                "order_number",
                F.col("lot_created_date").cast("timestamp").alias("event_ts"),
                F.lit("QM_LOT_CREATED").alias("event_type"),
                F.col("inspection_lot_quantity").alias("qty"),
                F.col("inspection_lot_uom").alias("uom"),
                F.col("inspection_lot_number").alias("reference_id"),
                F.lit("QM inspection lot created").alias("detail"),
            )
        )
        qm_events.append(ev_qm_created)
        if table_exists(spark, f"{ss}.quality_inspection_usage_decision"):
            uds = spark.read.table(f"{ss}.quality_inspection_usage_decision")
            ev_qm_ud = (
                uds.filter(F.col("usage_decision_date").isNotNull())
                .join(
                    qml.filter(F.col("order_number").isNotNull())
                    .select("inspection_lot_number", "order_number")
                    .distinct(),
                    "inspection_lot_number",
                    "inner",
                )
                .join(orders.select("order_number", "plant_code"), "order_number", "inner")
                .select(
                    "plant_code",
                    "order_number",
                    F.col("usage_decision_date").cast("timestamp").alias("event_ts"),
                    F.lit("QM_UD_TAKEN").alias("event_type"),
                    F.lit(None).cast("double").alias("qty"),
                    F.lit(None).cast("string").alias("uom"),
                    F.col("inspection_lot_number").alias("reference_id"),
                    F.coalesce(
                        F.col("usage_decision"),
                        F.lit("Usage decision taken"),
                    ).alias("detail"),
                )
            )
            qm_events.append(ev_qm_ud)

    # -- UNION ALL -------------------------------------------------------------
    all_events = [ev_created, ev_released, ev_tr, ev_staging, ev_ops, ev_gr, ev_issue]
    all_events.extend(pi_events)
    all_events.extend(qm_events)

    union_df = all_events[0]
    for df in all_events[1:]:
        union_df = union_df.unionByName(df, allowMissingColumns=False)

    # event_seq: row_number within (plant_code, order_number) ordered by event_ts NULLS LAST
    w = Window.partitionBy("plant_code", "order_number").orderBy(
        F.col("event_ts").asc_nulls_last()
    )
    return union_df.withColumn("event_seq", F.row_number().over(w)).select(
        "plant_code",
        "order_number",
        "event_seq",
        "event_ts",
        "event_type",
        "qty",
        "uom",
        "reference_id",
        "detail",
    )
