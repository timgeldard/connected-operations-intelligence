"""
Lakeflow Spark Declarative Pipeline — Warehouse Flow Gold.

Tables:
  gold_dispensary_backlog                   — open line-pick (dispensary) demand by plant / supply area
  gold_lineside_stock                       — current stock staged in production / line-side storage types
  gold_delivery_pick_status                 — outbound delivery pick progress
  gold_stock_reconciliation                 — IM (MARD) vs WM (bins) variance, valuation and ABC class (v1, plant×material, kept for compatibility)
  gold_process_order_staging                — process-order component staging completion
  gold_stock_reconciliation_v2              — detailed IM↔WM reconciliation at plant×warehouse×material×batch×stock_category grain
  gold_stock_value_reconciliation           — value-control rollup of reconciliation v2 by plant / warehouse / severity
  gold_reconciliation_audit_log             — deterministic audit register for current reconciliation exceptions
  gold_movement_reconciliation              — IM posting movement vs WM confirmed-TO movement control
  gold_hu_reconciliation                    — handling-unit packed quantity vs WM quant evidence
  gold_physical_inventory_recon             — physical inventory count vs book/posting evidence
  gold_reconciliation_alerts                — alert-ready severe reconciliation exceptions
  gold_stock_reconciliation_exceptions_v2  — filter of v2 where is_reconciled=false, with material description
  gold_stock_reconciliation_summary_v2     — v2 rolled up by plant×warehouse×mismatch_reason×severity
  gold_stock_reconciliation_summary        — canonical v2 summary alias for consumption
"""

import dlt
from pyspark.sql import Window
from pyspark.sql import functions as F

from gold._shared import (
    STAGING_REFERENCE_TYPE,
    STAGING_VALIDATION_THRESHOLD_PCT,
    anti_join_optional_deleted_headers,
    get_silver_schema,
    get_spark_session,
    gold_table_args,
    hu_reconciliation_enabled,
    table_exists,
)

# ── 1. DISPENSARY BACKLOG ─────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Open dispensary / line-pick backlog by plant and supply area, using "
        "movement_type_classification.is_production_consumption."
    ),
    cluster_by=["plant_code", "production_supply_area"],
))
@dlt.expect("open quantity non-negative", "total_open_qty >= 0.0")
def gold_dispensary_backlog():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    reservations = spark.read.table(f"{silver_schema}.reservation_requirement")
    classification = spark.read.table(f"{silver_schema}.movement_type_classification").select(
        "movement_type_code", "is_production_consumption"
    )
    orders = spark.read.table(f"{silver_schema}.process_order").select(
        "order_number", "scheduled_start_date"
    )

    open_picks = (
        reservations
        .join(F.broadcast(classification), "movement_type_code", "inner")
        .filter(
            F.coalesce(F.col("is_production_consumption"), F.lit(False))
            & (~F.coalesce(F.col("is_deletion_flagged"), F.lit(False)))
            & (F.coalesce(F.col("open_quantity"), F.lit(0.0)) > 0)
        )
    )

    return (
        open_picks.join(orders, "order_number", "left")
        .groupBy("plant_code", "production_supply_area", "warehouse_number")
        .agg(
            F.count(F.lit(1)).alias("open_task_count"),
            F.count_distinct("order_number").alias("open_order_count"),
            F.coalesce(F.sum("open_quantity"), F.lit(0.0)).alias("total_open_qty"),
            F.coalesce(F.sum("required_quantity"), F.lit(0.0)).alias("total_required_qty"),
            F.min("requirement_date").alias("earliest_requirement_date"),
            F.min("scheduled_start_date").alias("earliest_scheduled_start_date"),
        )
    )


# ── 2. LINE-SIDE STOCK ────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Current stock staged in production / line-side storage types, by material and batch.",
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_lineside_stock():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    storage_bin = spark.read.table(f"{silver_schema}.storage_bin")
    mapping = spark.read.table(f"{silver_schema}.storage_type_role_mapping")

    # Filter occupied bins using the conformed plant-specific lineside storage roles (broadcast-optimized)
    lineside = (
        storage_bin.filter(F.col("quant_number").isNotNull()).alias("sb")
        .join(
            F.broadcast(mapping).alias("m"),
            (F.col("sb.plant_code") == F.col("m.plant_code"))
            & (F.col("sb.warehouse_number") == F.col("m.warehouse_number"))
            & (F.col("sb.storage_type") == F.col("m.storage_type"))
            & (F.col("m.role") == "LINESIDE"),
            "inner"
        )
        .select("sb.*")
    )

    base_agg = (
        lineside.groupBy(
            "plant_code", "warehouse_number", "storage_type",
            "material_code", "batch_number", "base_uom",
        )
        .agg(
            F.count(F.lit(1)).alias("quant_count"),
            F.coalesce(F.sum("total_quantity"), F.lit(0.0)).alias("total_qty"),
            F.coalesce(F.sum("available_quantity"), F.lit(0.0)).alias("available_qty"),
            F.min("expiry_date").alias("earliest_expiry_date"),
            F.min("goods_receipt_date").alias("earliest_goods_receipt_date"),
        )
    )

    # Deterministic base only (no current_date()) so the MV stays incrementally refreshable.
    # The date-relative column `min_days_to_expiry` is served live by the gold_lineside_stock_live
    # view (scripts/generate_gold_serving_views_sql.py). See docs/hardening-plan.md (Phase 2).
    return base_agg



# ── 3. DELIVERY PICK STATUS ───────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Outbound delivery pick progress (picked vs delivery quantity) by delivery.",
    cluster_by=["plant_code", "planned_goods_issue_date"],
))
@dlt.expect("pick fraction bounded", "pick_fraction IS NULL OR (pick_fraction >= 0.0 AND pick_fraction <= 2.0)")
def gold_delivery_pick_status():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    deliveries = anti_join_optional_deleted_headers(
        spark.read.table(f"{silver_schema}.outbound_delivery"),
        silver_schema,
        "outbound_delivery_header_delete",
        ["delivery_number"],
    )
    customers = spark.read.table(f"{silver_schema}.customer").select(
        "customer_code", "customer_name"
    ).distinct()

    picks = (
        deliveries.groupBy(
            "delivery_number", "plant_code", "warehouse_number",
            "delivery_type", "ship_to_customer", "sold_to_customer",
        )
        .agg(
            F.count(F.lit(1)).alias("line_count"),
            F.coalesce(F.sum("delivery_quantity_base"), F.lit(0.0)).alias("delivery_qty"),
            F.coalesce(F.sum("actual_delivered_base_quantity"), F.lit(0.0)).alias("picked_qty"),
            F.max("planned_goods_issue_date").alias("planned_goods_issue_date"),
            F.max("actual_goods_issue_date").alias("actual_goods_issue_date"),
            F.max("delivery_date").alias("delivery_date"),
            F.first("delivery_gross_weight", ignorenulls=True).alias("delivery_gross_weight"),
            F.first("delivery_weight_unit", ignorenulls=True).alias("delivery_weight_unit"),
            F.count_distinct("base_uom").alias("base_uom_count"),
            F.sum(F.when(F.col("delivery_quantity_base").isNull(), F.lit(1)).otherwise(F.lit(0))).alias(
                "null_delivery_base_count"
            ),
            F.max(F.when(F.col("actual_goods_issue_date").isNotNull(), F.lit(1)).otherwise(F.lit(0))).alias(
                "_is_shipped"
            ),
        )
        .join(
            F.broadcast(customers).alias("ship_to"),
            F.col("ship_to_customer") == F.col("ship_to.customer_code"),
            "left",
        )
        .join(
            F.broadcast(customers).alias("sold_to"),
            F.col("sold_to_customer") == F.col("sold_to.customer_code"),
            "left",
        )
        .select(
            "delivery_number", "plant_code", "warehouse_number", "delivery_type",
            F.col("ship_to_customer").alias("customer_id"),
            F.col("ship_to.customer_name").alias("customer_name"),
            "ship_to_customer",
            F.col("ship_to.customer_name").alias("ship_to_customer_name"),
            "sold_to_customer",
            F.col("sold_to.customer_name").alias("sold_to_customer_name"),
            "planned_goods_issue_date", "actual_goods_issue_date", "delivery_date",
            F.col("delivery_gross_weight").alias("gross_weight"),
            F.col("delivery_weight_unit").alias("gross_weight_unit"),
            "line_count",
            "delivery_qty", "picked_qty", "base_uom_count", "null_delivery_base_count",
            (F.col("base_uom_count") > 1).alias("has_mixed_base_uom"),
            (F.col("null_delivery_base_count") > 0).alias("has_unconverted_delivery_qty"),
            F.when(
                (F.col("delivery_qty") != 0)
                & (F.col("base_uom_count") <= 1)
                & (F.col("null_delivery_base_count") == 0),
                F.col("picked_qty") / F.col("delivery_qty"),
            )
            .otherwise(F.lit(None).cast("double"))
            .alias("pick_fraction"),
            (F.col("_is_shipped") == 1).alias("is_shipped"),
        )
    )

    # Deterministic base only; `days_to_goods_issue` / `risk_band` are served live by the
    # gold_delivery_pick_status_live view (current_date() kept out of the MV). See hardening plan.
    return picks



# ── 4. STOCK RECONCILIATION (IM vs WM) ────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="IM book stock (MARD) vs WM bin stock variance, with valuation, ABC class, and interim stock split, by plant and material.",
    cluster_by=["plant_code", "material_code"],
))
def gold_stock_reconciliation():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    mard = spark.read.table(f"{silver_schema}.stock_at_location")
    storage_bin = spark.read.table(f"{silver_schema}.storage_bin")
    valuation = spark.read.table(f"{silver_schema}.material_valuation")
    mapping = spark.read.table(f"{silver_schema}.storage_type_role_mapping")

    im = (
        mard.groupBy("plant_code", "material_code")
        .agg(
            F.coalesce(
                F.sum(
                    F.coalesce(F.col("unrestricted_quantity"), F.lit(0.0))
                    + F.coalesce(F.col("quality_inspection_quantity"), F.lit(0.0))
                    + F.coalesce(F.col("blocked_quantity"), F.lit(0.0))
                    + F.coalesce(F.col("restricted_use_quantity"), F.lit(0.0))
                    + F.coalesce(F.col("in_transfer_quantity"), F.lit(0.0))
                ),
                F.lit(0.0),
            ).alias("im_total_qty"),
        )
    )

    # Classify bins as physical or interim based on storage_type_role_mapping or fallback standard
    # 9xx prefix. role_source=CONFIG when the mapping table supplies the role; FALLBACK when the
    # 9xx heuristic is used. If ANY occupied bin uses FALLBACK, the interim/physical split for that
    # plant is heuristic — see gold_storage_type_role_coverage_status for per-warehouse gaps.
    sb_mapped = (
        storage_bin.alias("sb")
        .join(
            F.broadcast(mapping).alias("m"),
            (F.col("sb.plant_code") == F.col("m.plant_code"))
            & (F.col("sb.warehouse_number") == F.col("m.warehouse_number"))
            & (F.col("sb.storage_type") == F.col("m.storage_type")),
            "left"
        )
        .select(
            "sb.*",
            F.coalesce(
                F.col("m.role"),
                F.when(F.col("sb.storage_type").rlike("^9"), F.lit("INTERIM")).otherwise(F.lit("PHYSICAL"))
            ).alias("storage_role"),
            F.when(F.col("m.role").isNotNull(), F.lit("CONFIG")).otherwise(F.lit("FALLBACK")).alias("role_source"),
        )
    )

    occupied = sb_mapped.filter(F.col("quant_number").isNotNull())

    # A plant is trusted for reconciliation when ALL occupied bins have CONFIG-sourced roles.
    plant_role_trust = (
        occupied
        .groupBy("plant_code")
        .agg(F.min(F.col("role_source") == "CONFIG").alias("_plant_trusted"))
    )

    wm = (
        occupied
        .groupBy("plant_code", "material_code")
        .agg(
            F.coalesce(F.sum("total_quantity"), F.lit(0.0)).alias("wm_total_qty"),
            F.coalesce(
                F.sum(F.when(F.col("storage_role") == "INTERIM", F.col("total_quantity")).otherwise(0.0)),
                F.lit(0.0)
            ).alias("wm_interim_qty"),
            F.coalesce(
                F.sum(F.when(F.col("storage_role") != "INTERIM", F.col("total_quantity")).otherwise(0.0)),
                F.lit(0.0)
            ).alias("wm_physical_qty")
        )
    )

    # Plant-level valuation: valuation area conventionally equals the plant code.
    price = (
        valuation.withColumnRenamed("valuation_area", "plant_code")
        .groupBy("plant_code", "material_code")
        .agg(
            F.first("standard_price", ignorenulls=True).alias("standard_price"),
            F.first("price_unit", ignorenulls=True).alias("price_unit"),
        )
    )

    joined = (
        im.hint("skew", "plant_code").join(wm, ["plant_code", "material_code"], "full")
        .join(price, ["plant_code", "material_code"], "left")
        .withColumn("im_total_qty", F.coalesce(F.col("im_total_qty"), F.lit(0.0)))
        .withColumn("wm_total_qty", F.coalesce(F.col("wm_total_qty"), F.lit(0.0)))
        .withColumn("wm_interim_qty", F.coalesce(F.col("wm_interim_qty"), F.lit(0.0)))
        .withColumn("wm_physical_qty", F.coalesce(F.col("wm_physical_qty"), F.lit(0.0)))
        .withColumn("delta_qty", F.col("im_total_qty") - F.col("wm_total_qty"))
        .withColumn(
            "inventory_value",
            F.col("im_total_qty")
            * F.coalesce(F.col("standard_price"), F.lit(0.0))
            / F.when(F.coalesce(F.col("price_unit"), F.lit(0)) == 0, F.lit(1.0)).otherwise(
                F.col("price_unit")
            ),
        )
        # Tolerance = max(0.1 absolute units, 1% of IM) so rounding noise on small-stock
        # materials is not flagged as a variance.
        .withColumn("_tolerance", F.greatest(F.lit(0.1), F.abs(F.col("im_total_qty")) * 0.01))
        .withColumn(
            "mismatch_class",
            F.when(F.abs(F.col("delta_qty")) <= F.col("_tolerance"), F.lit("match")).otherwise(
                F.lit("variance")
            ),
        )
    )

    # ABC by cumulative inventory value within each plant.
    plant_window = Window.partitionBy("plant_code").orderBy(F.col("inventory_value").desc())
    plant_total = Window.partitionBy("plant_code")
    with_abc = (
        joined
        .withColumn("_cum_value", F.sum("inventory_value").over(plant_window))
        .withColumn("_plant_value", F.sum("inventory_value").over(plant_total))
        # Cumulative value % BEFORE this row, so the highest-value item is always A even when it
        # alone exceeds 80% of plant value (avoids the boundary mis-classification).
        .withColumn(
            "_prev_cum_pct",
            F.when(
                F.col("_plant_value") > 0,
                (F.col("_cum_value") - F.col("inventory_value")) / F.col("_plant_value"),
            ).otherwise(F.lit(0.0)),
        )
        .withColumn(
            "abc_class",
            F.when(F.col("standard_price").isNull(), F.lit("U"))  # unpriced -> not classifiable
            .when(F.col("_prev_cum_pct") < 0.80, F.lit("A"))
            .when(F.col("_prev_cum_pct") < 0.95, F.lit("B"))
            .otherwise(F.lit("C")),
        )
    )

    return (
        with_abc
        .join(F.broadcast(plant_role_trust), "plant_code", "left")
        .select(
            "plant_code", "material_code", "im_total_qty", "wm_total_qty", "wm_interim_qty", "wm_physical_qty",
            "delta_qty", "standard_price", "price_unit", "inventory_value", "mismatch_class", "abc_class",
            F.coalesce(F.col("_plant_trusted"), F.lit(False)).alias("is_operationally_trusted"),
        )
    )


# ── 5. PROCESS ORDER STAGING ──────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Process-order component staging completion (confirmed transfer orders vs total) per order.",
    cluster_by=["plant_code", "scheduled_start_date"],
))
@dlt.expect("staging fraction bounded", "staging_fraction IS NULL OR (staging_fraction >= 0.0 AND staging_fraction <= 1.0)")
def gold_process_order_staging():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    transfer_orders = anti_join_optional_deleted_headers(
        spark.read.table(f"{silver_schema}.warehouse_transfer_order"),
        silver_schema,
        "warehouse_transfer_order_header_delete",
        ["warehouse_number", "transfer_order_number"],
    )
    orders = spark.read.table(f"{silver_schema}.process_order")
    material = spark.read.table(f"{silver_schema}.material").select(
        "plant_code", "material_code", "material_description"
    ).distinct()

    # Transfer orders that stage to a PRODUCTION ORDER are those with reference type LTAK-BETYP='F'
    # (STAGING_REFERENCE_TYPE).  Only then does BENUM hold the process-order AUFNR.  Verified live
    # in connected_plant_uat (2026-06-02): BETYP='F' ranges from ~5-24% of TOs per warehouse; 100%
    # BENUM-AUFNR match across 105 warehouse/plant combos.  See gold_process_order_staging_validation.
    # source_reference_type = LTAK-BETYP (silver.warehouse_transfer_order).
    staging_tos = (
        transfer_orders
        .filter(F.col("source_reference_type") == STAGING_REFERENCE_TYPE)
        .withColumn("order_number", F.col("source_reference_number"))
        .groupBy("order_number")
        .agg(
            F.count(F.lit(1)).alias("to_items_total"),
            F.sum(F.when(F.col("item_status") == "Fully Confirmed", F.lit(1)).otherwise(F.lit(0))).alias(
                "to_items_done"
            ),
        )
    )

    active_orders = orders.filter(
        F.coalesce(F.col("is_released"), F.lit(False)) & (~F.coalesce(F.col("is_closed"), F.lit(False)))
    )

    # Plant-level trust from process_order_staging_reference_mapping_config.
    # A plant is operationally trusted when every warehouse mapped for it carries is_validated=true.
    # Plants absent from the config default to untrusted (conservative: new/unknown sites are not
    # silently treated as validated). Seeds for all 105 UAT-profiled warehouses are in
    # resources/sql/process_order_staging_reference_mapping_*.sql.
    staging_config_table = f"{silver_schema}.process_order_staging_reference_mapping_config"
    if table_exists(spark, staging_config_table):
        staging_config = spark.read.table(staging_config_table)
    else:
        staging_config = active_orders.select("plant_code").distinct().withColumn(
            "is_validated", F.lit(False)
        )
    # F.min on booleans returns False if any row is False, True if all are True —
    # so a plant is trusted only when every configured warehouse has is_validated=true.
    plant_trust = (
        staging_config
        .groupBy("plant_code")
        .agg(F.min("is_validated").alias("_plant_trusted"))
    )

    staged = (
        active_orders.join(staging_tos, "order_number", "left")
        .join(plant_trust, "plant_code", "left")
        .join(F.broadcast(material), ["plant_code", "material_code"], "left")
        .select(
            "order_number",
            "plant_code",
            "material_code",
            F.col("material_description").alias("material_name"),
            "order_quantity",
            F.col("order_quantity_uom").alias("uom"),
            "scheduled_start_date",
            "scheduled_finish_date",
            F.coalesce(F.col("to_items_total"), F.lit(0)).alias("to_items_total"),
            F.coalesce(F.col("to_items_done"), F.lit(0)).alias("to_items_done"),
            F.when(
                F.coalesce(F.col("to_items_total"), F.lit(0)) > 0,
                F.col("to_items_done") / F.col("to_items_total"),
            )
            .otherwise(F.lit(None).cast("double"))
            .alias("staging_fraction"),
            F.coalesce(F.col("_plant_trusted"), F.lit(False)).alias("is_operationally_trusted"),
        )
    )

    # Deterministic base only; `days_to_start` / `risk_band` are served live by the
    # gold_process_order_staging_live view (current_date() kept out of the MV). See hardening plan.
    return staged


# ── 6. PROCESS ORDER STAGING VALIDATION ──────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Per-plant/warehouse validation of the LTAK BETYP='F' source-reference assumption used by "
        "gold_process_order_staging. Classifies each plant/warehouse as VALIDATED (>=95% BENUM "
        "matches a known process order), NOT_VALIDATED (F-type TOs present but low match rate), "
        "or NOT_APPLICABLE (no F-type staging TOs for this plant/warehouse)."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_process_order_staging_validation():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    transfer_orders = anti_join_optional_deleted_headers(
        spark.read.table(f"{silver_schema}.warehouse_transfer_order"),
        silver_schema,
        "warehouse_transfer_order_header_delete",
        ["warehouse_number", "transfer_order_number"],
    )
    order_keys = (
        spark.read.table(f"{silver_schema}.process_order")
        .select(F.col("order_number").alias("_po_number"))
        .distinct()
    )

    # Header-level totals per plant/warehouse.  BENUM/BETYP are LTAK header fields; aggregate
    # at the (plant, warehouse, TO-number) grain first so a multi-item TO counts once.
    to_header_totals = (
        transfer_orders
        .groupBy("plant_code", "warehouse_number", "transfer_order_number")
        .agg(
            F.first("source_reference_type").alias("source_reference_type"),
            F.min("created_datetime").alias("created_datetime"),
        )
        .groupBy("plant_code", "warehouse_number")
        .agg(
            F.count(F.lit(1)).alias("total_to_headers"),
            F.sum(F.when(F.col("source_reference_type") == STAGING_REFERENCE_TYPE, F.lit(1)).otherwise(F.lit(0)))
             .alias("f_type_to_headers"),
            F.min("created_datetime").alias("sample_window_start"),
            F.max("created_datetime").alias("sample_window_end"),
        )
    )

    # One row per F-type TO header — deterministic by picking the max(benum) in case of
    # data anomalies; in practice all items under a header carry the same BENUM.
    f_to_headers = (
        transfer_orders
        .filter(F.col("source_reference_type") == STAGING_REFERENCE_TYPE)
        .groupBy("plant_code", "warehouse_number", "transfer_order_number")
        .agg(F.max("source_reference_number").alias("benum"))
    )

    # Match count: F-type TO headers whose BENUM resolves to a known process order.
    f_matched = (
        f_to_headers
        .join(order_keys, F.col("benum") == F.col("_po_number"), "left")
        .groupBy("plant_code", "warehouse_number")
        .agg(F.count("_po_number").alias("f_type_benum_matched"))
    )

    return (
        to_header_totals
        .join(f_matched, ["plant_code", "warehouse_number"], "left")
        .withColumn(
            "benum_match_pct",
            F.when(
                F.coalesce(F.col("f_type_to_headers"), F.lit(0)) > 0,
                F.round(
                    100.0 * F.coalesce(F.col("f_type_benum_matched"), F.lit(0))
                    / F.col("f_type_to_headers"),
                    1,
                ),
            ).otherwise(F.lit(None).cast("double")),
        )
        .withColumn(
            "validation_status",
            F.when(
                F.coalesce(F.col("f_type_to_headers"), F.lit(0)) == 0,
                F.lit("NOT_APPLICABLE"),
            )
            .when(F.col("benum_match_pct") >= STAGING_VALIDATION_THRESHOLD_PCT, F.lit("VALIDATED"))
            .otherwise(F.lit("NOT_VALIDATED")),
        )
        .select(
            "plant_code",
            "warehouse_number",
            "sample_window_start",
            "sample_window_end",
            F.coalesce(F.col("total_to_headers"),     F.lit(0)).alias("total_to_headers"),
            F.coalesce(F.col("f_type_to_headers"),    F.lit(0)).alias("f_type_to_headers"),
            F.coalesce(F.col("f_type_benum_matched"), F.lit(0)).alias("f_type_benum_matched"),
            "benum_match_pct",
            "validation_status",
        )
    )


# ── 7. STORAGE-TYPE ROLE COVERAGE STATUS ─────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Per-plant/warehouse coverage of storage_type_role_mapping config vs in-use storage types. "
        "VALIDATED = all active storage types are config-mapped; PARTIAL = some mapped, some not; "
        "MISSING = no config rows for this warehouse. Use to identify gaps before relying on "
        "gold_lineside_stock or gold_stock_reconciliation for a plant/warehouse."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_storage_type_role_coverage_status():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    storage_bin = spark.read.table(f"{silver_schema}.storage_bin")
    role_mapping = spark.read.table(f"{silver_schema}.storage_type_role_mapping")

    # In-use storage types: every distinct ST that appears in the bin master.
    in_use_sts = (
        storage_bin
        .filter(F.col("storage_type").isNotNull())
        .select("plant_code", "warehouse_number", "storage_type")
        .distinct()
    )

    # Mapped STs from config (the governed role-mapping table).
    mapped_sts = (
        role_mapping
        .select("plant_code", "warehouse_number", "storage_type")
        .distinct()
        .withColumn("_is_mapped", F.lit(True))
    )

    # Flag each in-use ST as CONFIG-mapped or not.  Broadcast the small config table.
    # in_use_sts is already distinct at (plant, warehouse, storage_type) grain so count()
    # is correct — countDistinct() would be redundant and slower.
    in_use_with_flag = (
        in_use_sts
        .join(F.broadcast(mapped_sts), ["plant_code", "warehouse_number", "storage_type"], "left")
        .withColumn("is_mapped", F.coalesce(F.col("_is_mapped"), F.lit(False)))
        .drop("_is_mapped")
    )

    return (
        in_use_with_flag
        .groupBy("plant_code", "warehouse_number")
        .agg(
            F.count("storage_type").alias("total_storage_types"),
            F.sum(F.col("is_mapped").cast("int")).alias("mapped_storage_types"),
        )
        .withColumn("unmapped_storage_types", F.col("total_storage_types") - F.col("mapped_storage_types"))
        .withColumn(
            "coverage_pct",
            F.when(
                F.col("total_storage_types") > 0,
                F.round(100.0 * F.col("mapped_storage_types") / F.col("total_storage_types"), 1),
            ).otherwise(F.lit(None).cast("double")),
        )
        .withColumn(
            "coverage_status",
            F.when(F.col("mapped_storage_types") == 0, F.lit("MISSING"))
            .when(F.col("unmapped_storage_types") == 0, F.lit("VALIDATED"))
            .otherwise(F.lit("PARTIAL")),
        )
    )


# ── 8. STOCK RECONCILIATION V2 ────────────────────────────────────────────────
# Detailed IM↔WM reconciliation at plant × warehouse × material × batch × stock_category.
#
# Design decisions (see docs/reconciliation/stock-reconciliation-v2-contract.md):
# • WM grain: LQUA has no LGORT — WM stock is warehouse-grain only. T320 bridges
#   IM sloc→warehouse (1:1); the reverse warehouse→sloc is 1:many so sloc is NOT on the
#   output. This is the best achievable grain from current sources.
# • IM routing: batch-managed materials use MCHB (silver.batch_stock); non-batch use MARD
#   (silver.stock_at_location) with batch='__NONE__'. MARD.LABST = SUM(MCHB.CLABS) verified
#   at C061 (750/750 combos, 2026-06-02) — using both would double-count.
# • Stock categories compared: UNRESTRICTED, QUALITY, BLOCKED (WM BESTQ: blank/Q/S).
#   RESTRICTED, IN_TRANSFER, RETURNS_BLOCKED have no WM equivalent → IM-only, excluded.
# • UoM: MARM wired but both MARD and LQUA store in base UoM — conversion is detection-only.
# • Tolerance: 0.1% of IM qty, floor 0.001.

# Tolerance: 0.1% of IM quantity, floor 0.001 (tighter than v1's 1%/0.1).
_RECON_V2_TOLERANCE_PCT = 0.001
_RECON_V2_TOLERANCE_FLOOR = 0.001


def _im_long(df, plant_col, sloc_col, mat_col, batch_col, uom_col, wh_sloc_map):
    """Normalise an IM source to (plant, warehouse, material, batch, stock_category, base_uom, quantity) grain.
    Single pass using F.explode on an array of structs — avoids rescanning the source three times."""
    keys = ["plant_code", "warehouse_number", "material_code", "batch_number", "base_uom"]
    return (
        df
        .join(F.broadcast(wh_sloc_map), [plant_col, sloc_col], "left")
        .withColumn("plant_code",     F.col(plant_col))
        .withColumn("warehouse_number",
                    F.coalesce(F.col("warehouse_number"), F.lit("__NO_WM_MAPPING__")))
        .withColumn("material_code",  F.col(mat_col))
        .withColumn("batch_number",   F.col(batch_col) if batch_col else F.lit("__NONE__"))
        .withColumn("base_uom",       F.col(uom_col) if uom_col else F.lit(None).cast("string"))
        .withColumn("_cats", F.array(
            F.struct(F.lit("UNRESTRICTED").alias("s"),
                     F.coalesce(F.col("unrestricted_quantity"),      F.lit(0.0)).alias("q")),
            F.struct(F.lit("QUALITY").alias("s"),
                     F.coalesce(F.col("quality_inspection_quantity"), F.lit(0.0)).alias("q")),
            F.struct(F.lit("BLOCKED").alias("s"),
                     F.coalesce(F.col("blocked_quantity"),            F.lit(0.0)).alias("q")),
        ))
        .select(*keys, F.explode("_cats").alias("_cat"))
        .select(
            *keys,
            F.col("_cat.s").alias("stock_category"),
            F.col("_cat.q").alias("quantity"),
        )
        .filter(F.col("quantity") != 0)
    )


@dlt.table(**gold_table_args(
    comment=(
        "Detailed IM↔WM stock reconciliation at plant × warehouse × material × batch × "
        "stock_category grain. Compares MCHB/MARD (IM) with LQUA/storage_bin (WM). "
        "See docs/reconciliation/stock-reconciliation-v2-contract.md."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_stock_reconciliation_v2():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    batch_stk   = spark.read.table(f"{ss}.batch_stock")
    stk_at_loc  = spark.read.table(f"{ss}.stock_at_location")
    # plant-scoped routing: plant_code included in mat_dim selects and joins to ensure correctness
    mat_dim     = (
        spark.read.table(f"{ss}.material")
        .select("plant_code", "material_code", "base_uom", "batch_management_required")
        .distinct()
    )
    storage_bin = spark.read.table(f"{ss}.storage_bin")
    wh_sloc_map = spark.read.table(f"{ss}.warehouse_storage_location_mapping")
    # silver.material_uom_conversion (MARM) is wired into the pipeline for detection
    # purposes but not used in mismatch classification — see comment below.
    price_dim = (
        spark.read.table(f"{ss}.material_valuation")
        .groupBy(F.col("valuation_area").alias("plant_code"), "material_code")
        .agg(
            F.first("standard_price", ignorenulls=True).alias("unit_price"),
            F.first("price_unit",     ignorenulls=True).alias("price_unit"),
        )
    )
    role_mapping = spark.read.table(f"{ss}.storage_type_role_mapping")

    # ── IM: batch-managed materials → MCHB ───────────────────────────────────
    batch_mat_codes = mat_dim.filter(
        F.coalesce(F.col("batch_management_required"), F.lit(False))
    ).select("plant_code", "material_code")

    im_batch = _im_long(
        batch_stk.join(F.broadcast(batch_mat_codes), ["plant_code", "material_code"], "inner"),
        plant_col="plant_code", sloc_col="storage_location_code",
        mat_col="material_code", batch_col="batch_number", uom_col="base_uom",
        wh_sloc_map=wh_sloc_map,
    )

    # ── IM: non-batch materials → MARD + base_uom from material dim ──────────
    non_batch_mat = mat_dim.filter(
        ~F.coalesce(F.col("batch_management_required"), F.lit(False))
    ).select("plant_code", "material_code", "base_uom")

    # Single inner join filters to non-batch materials and adds base_uom in one step.
    im_mard_base = stk_at_loc.join(F.broadcast(non_batch_mat), ["plant_code", "material_code"], "inner")
    im_mard = _im_long(
        im_mard_base,
        plant_col="plant_code", sloc_col="storage_location_code",
        mat_col="material_code", batch_col=None, uom_col="base_uom",
        wh_sloc_map=wh_sloc_map,
    )

    im = (
        im_batch.unionByName(im_mard)
        .groupBy("plant_code", "warehouse_number", "material_code",
                  "batch_number", "stock_category", "base_uom")
        .agg(F.sum("quantity").alias("im_quantity"))
    )

    # ── WM: from storage_bin (LQUA). BESTQ: blank→UNRESTRICTED, Q→QUALITY, S→BLOCKED ─
    bestq_map = F.create_map(
        F.lit(""),  F.lit("UNRESTRICTED"),
        F.lit("Q"), F.lit("QUALITY"),
        F.lit("S"), F.lit("BLOCKED"),
    )
    wm = (
        storage_bin.filter(F.col("quant_number").isNotNull())
        .withColumn("stock_category",
                    bestq_map.getItem(F.coalesce(F.col("stock_category_code"), F.lit(""))))
        .filter(F.col("stock_category").isNotNull())
        .groupBy("plant_code", "warehouse_number", "material_code",
                  "batch_number", "stock_category", "base_uom")
        .agg(F.sum("total_quantity").alias("wm_quantity"))
    )

    # ── Full outer join ───────────────────────────────────────────────────────
    _keys = ["plant_code", "warehouse_number", "material_code",
             "batch_number", "stock_category", "base_uom"]
    recon = (
        im.join(wm, _keys, "full")
        .withColumn("im_quantity", F.coalesce(F.col("im_quantity"), F.lit(0.0)))
        .withColumn("wm_quantity", F.coalesce(F.col("wm_quantity"), F.lit(0.0)))
        .withColumn("delta_quantity",     F.col("wm_quantity") - F.col("im_quantity"))
        .withColumn("abs_delta_quantity", F.abs(F.col("delta_quantity")))
        .withColumn("tolerance_quantity",
                    F.greatest(
                        F.lit(_RECON_V2_TOLERANCE_FLOOR),
                        F.abs(F.col("im_quantity")) * F.lit(_RECON_V2_TOLERANCE_PCT),
                    ))
        .withColumn("is_reconciled",
                    F.col("abs_delta_quantity") <= F.col("tolerance_quantity"))
        .withColumn("tolerance_exceeded", ~F.col("is_reconciled"))
        .withColumn(
            "delta_percent",
            F.when(
                F.abs(F.col("im_quantity")) > 0,
                F.col("delta_quantity") / F.abs(F.col("im_quantity")),
            ).otherwise(F.lit(None).cast("double")),
        )
        .withColumn("tolerance_rule_code", F.lit("DEFAULT_0_1_PCT_FLOOR_0_001"))
    )

    # ── Mismatch reason ───────────────────────────────────────────────────────
    # NOTE: UOM_CONVERSION_MISSING is intentionally NOT used here. MARM only contains
    # entries for materials WITH alternative UoMs — absence means "base-UoM-only material",
    # not a conversion problem. Both MARD and LQUA already store in base UoM, so no
    # conversion is needed. Flagging absent-MARM materials as UOM issues would mask
    # TRUE_VARIANCE for the majority of standard materials. (UOM_CONVERSION_MISSING is
    # kept as a documented allowed-value for future use if alt-UoM transactions appear.)
    recon = (
        recon
        .withColumn("mismatch_reason",
            F.when(F.col("is_reconciled"),
                   F.lit("MATCHED"))
            .when(F.col("warehouse_number") == "__NO_WM_MAPPING__",
                  F.lit("WM_MANAGED_SLOC_MAPPING_MISSING"))
            .when((F.col("im_quantity") > 0) & (F.col("wm_quantity") == 0),
                  F.lit("BATCH_MISSING_IN_WM"))
            .when((F.col("wm_quantity") > 0) & (F.col("im_quantity") == 0),
                  F.lit("BATCH_MISSING_IN_IM"))
            .otherwise(F.lit("TRUE_VARIANCE")),
        )
        .withColumn("mismatch_severity",
            F.when(F.col("mismatch_reason") == "MATCHED",
                   F.lit("INFO"))
            .when(F.col("mismatch_reason").isin("BATCH_MISSING_IN_WM", "BATCH_MISSING_IN_IM"),
                  F.lit("MEDIUM"))
            .otherwise(F.lit("HIGH")),
        )
    )

    # ── Trust: warehouse trusted when all occupied STs are CONFIG-mapped ──────
    wh_trust = (
        storage_bin.filter(F.col("quant_number").isNotNull())
        .select("plant_code", "warehouse_number", "storage_type").distinct()
        .join(
            F.broadcast(
                role_mapping.select("plant_code", "warehouse_number", "storage_type")
                .withColumn("_mapped", F.lit(True))
            ),
            ["plant_code", "warehouse_number", "storage_type"], "left",
        )
        .groupBy("plant_code", "warehouse_number")
        .agg(F.min(F.coalesce(F.col("_mapped"), F.lit(False))).alias("_wh_trusted"))
    )

    # ── Valuation ─────────────────────────────────────────────────────────────
    return (
        recon
        .join(price_dim, ["plant_code", "material_code"], "left")
        .join(F.broadcast(wh_trust),  ["plant_code", "warehouse_number"], "left")
        .withColumn("delta_value",
            F.col("delta_quantity")
            * F.coalesce(F.col("unit_price"), F.lit(0.0))
            / F.when(
                F.coalesce(F.col("price_unit"), F.lit(0)).cast("double") == 0, F.lit(1.0)
            ).otherwise(F.col("price_unit").cast("double")),
        )
        .withColumn("is_operationally_trusted", F.coalesce(F.col("_wh_trusted"), F.lit(False)))
        .withColumn(
            "audit_trail_json",
            F.to_json(F.struct(
                F.lit("IM_WM_STOCK_RECON_V2").alias("control_id"),
                F.lit("2.1").alias("rule_version"),
                F.col("tolerance_rule_code"),
            F.col("mismatch_reason"),
            F.col("mismatch_severity"),
            F.col("is_operationally_trusted"),
            F.col("delta_percent"),
            F.col("delta_value"),
            )),
        )
        .select(
            "plant_code", "warehouse_number", "material_code", "batch_number",
            "stock_category", "base_uom",
            "im_quantity", "wm_quantity", "delta_quantity",
            "abs_delta_quantity", "delta_percent",
            "tolerance_quantity", "tolerance_exceeded", "tolerance_rule_code",
            "is_reconciled",
            "unit_price", "price_unit", "delta_value",
            "mismatch_reason", "mismatch_severity",
            "is_operationally_trusted",
            F.lit("2.1").alias("reconciliation_rule_version"),
            F.lit(None).cast("timestamp").alias("last_reconciled_at"),
            "audit_trail_json",
        )
    )


# ── 9. STOCK VALUE RECONCILIATION ─────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Value-control rollup of IM↔WM reconciliation v2 by plant × warehouse × "
        "mismatch reason. Uses material valuation where available."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_stock_value_reconciliation():
    recon = dlt.read("gold_stock_reconciliation_v2")
    return (
        recon
        .groupBy("plant_code", "warehouse_number", "mismatch_reason", "mismatch_severity")
        .agg(
            F.count(F.lit(1)).alias("row_count"),
            F.sum(F.when(F.col("tolerance_exceeded"), F.lit(1)).otherwise(F.lit(0))).alias(
                "tolerance_exceeded_count"
            ),
            F.coalesce(F.sum("delta_value"), F.lit(0.0)).alias("net_delta_value"),
            F.coalesce(F.sum(F.abs(F.col("delta_value"))), F.lit(0.0)).alias("abs_delta_value"),
            F.coalesce(F.sum("abs_delta_quantity"), F.lit(0.0)).alias("abs_delta_quantity"),
        )
        .withColumn(
            "value_reconciliation_status",
            F.when(F.col("tolerance_exceeded_count") == 0, F.lit("RECONCILED"))
            .when(F.col("mismatch_severity").isin("HIGH", "CRITICAL"), F.lit("ACTION_REQUIRED"))
            .otherwise(F.lit("REVIEW")),
        )
    )


# ── 10. RECONCILIATION AUDIT LOG ──────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Current-state audit register for reconciliation exceptions. Append-only trend "
        "history is captured by the warehouse snapshot job."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_reconciliation_audit_log():
    recon = dlt.read("gold_stock_reconciliation_v2")
    return (
        recon
        .filter(F.col("tolerance_exceeded"))
        .select(
            F.concat_ws(
                "|",
                "plant_code", "warehouse_number", "material_code", "batch_number",
                "stock_category", "base_uom", "mismatch_reason",
            ).alias("audit_event_key"),
            F.lit("gold_stock_reconciliation_v2").alias("source_table"),
            "plant_code", "warehouse_number", "material_code", "batch_number",
            "stock_category", "base_uom",
            "im_quantity", "wm_quantity", "delta_quantity", "abs_delta_quantity", "delta_percent",
            "tolerance_quantity", "delta_value",
            "mismatch_reason", "mismatch_severity",
            "tolerance_rule_code", "reconciliation_rule_version",
            "is_operationally_trusted", "audit_trail_json",
            "last_reconciled_at",
        )
    )


# ── 11. MOVEMENT RECONCILIATION ───────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "IM goods movement postings reconciled to WM confirmed transfer-order activity "
        "by plant × warehouse × posting/confirmation date × material × batch."
    ),
    cluster_by=["plant_code", "posting_date"],
))
def gold_movement_reconciliation():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    goods = spark.read.table(f"{ss}.goods_movement")
    wh_sloc_map = spark.read.table(f"{ss}.warehouse_storage_location_mapping")
    transfer_orders = spark.read.table(f"{ss}.warehouse_transfer_order")

    im_movements = (
        goods
        .join(F.broadcast(wh_sloc_map), ["plant_code", "storage_location_code"], "left")
        .withColumn("warehouse_number", F.coalesce(F.col("warehouse_number"), F.lit("__NO_WM_MAPPING__")))
        .groupBy(
            "plant_code", "warehouse_number", "posting_date", "movement_type_code",
            "material_code", "batch_number", "base_uom",
        )
        .agg(
            F.count(F.lit(1)).alias("im_document_line_count"),
            F.coalesce(F.sum("quantity"), F.lit(0.0)).alias("im_movement_quantity"),
            F.coalesce(F.sum("amount_local_currency"), F.lit(0.0)).alias("im_movement_value"),
        )
    )

    wm_movements = (
        transfer_orders
        .filter(F.col("confirmed_date").isNotNull())
        .groupBy(
            "plant_code", "warehouse_number",
            F.col("confirmed_date").alias("posting_date"),
            "material_code", "batch_number", "base_uom",
        )
        .agg(
            F.count(F.lit(1)).alias("wm_to_line_count"),
            F.coalesce(F.sum("confirmed_quantity"), F.lit(0.0)).alias("wm_confirmed_quantity"),
        )
    )

    keys = ["plant_code", "warehouse_number", "posting_date", "material_code", "batch_number", "base_uom"]
    return (
        im_movements.join(wm_movements, keys, "full")
        .withColumn("movement_type_code", F.coalesce(F.col("movement_type_code"), F.lit("__NO_IM_POSTING__")))
        .withColumn("im_document_line_count", F.coalesce(F.col("im_document_line_count"), F.lit(0)))
        .withColumn("wm_to_line_count", F.coalesce(F.col("wm_to_line_count"), F.lit(0)))
        .withColumn("im_movement_quantity", F.coalesce(F.col("im_movement_quantity"), F.lit(0.0)))
        .withColumn("wm_confirmed_quantity", F.coalesce(F.col("wm_confirmed_quantity"), F.lit(0.0)))
        .withColumn("im_movement_value", F.coalesce(F.col("im_movement_value"), F.lit(0.0)))
        .withColumn("delta_quantity", F.col("wm_confirmed_quantity") - F.col("im_movement_quantity"))
        .withColumn("abs_delta_quantity", F.abs(F.col("delta_quantity")))
        .withColumn(
            "movement_reconciliation_status",
            F.when((F.col("im_document_line_count") > 0) & (F.col("wm_to_line_count") > 0), F.lit("MATCHED_ACTIVITY"))
            .when(F.col("im_document_line_count") > 0, F.lit("IM_ONLY"))
            .when(F.col("wm_to_line_count") > 0, F.lit("WM_ONLY"))
            .otherwise(F.lit("NO_ACTIVITY")),
        )
    )


# ── 12. HU RECONCILIATION ─────────────────────────────────────────────────────
# Only materialised when handling-unit reconciliation is enabled (full_validation).
# In dev_shakedown the silver handling_unit table is absent (central_services lacks
# handlingunit_vekp/vepo), so this and gold_handling_unit_summary are not in the graph.

if hu_reconciliation_enabled(get_spark_session()):

    @dlt.table(**gold_table_args(
        comment=(
            "Handling-unit packed quantity reconciled to WM quant stock by plant × warehouse × "
            "material × batch. Supports HU/batch traceability checks."
        ),
        cluster_by=["plant_code", "warehouse_number"],
    ))
    def gold_hu_reconciliation():
        spark = get_spark_session()
        ss = get_silver_schema(spark)

        hu = spark.read.table(f"{ss}.handling_unit")
        storage_bin = spark.read.table(f"{ss}.storage_bin")

        hu_stock = (
            hu
            .withColumn("base_uom", F.col("packed_uom"))
            .groupBy("plant_code", "warehouse_number", "material_code", "batch_number", "base_uom")
            .agg(
                F.count_distinct("handling_unit_number").alias("handling_unit_count"),
                F.count(F.lit(1)).alias("handling_unit_item_count"),
                F.coalesce(F.sum("packed_quantity"), F.lit(0.0)).alias("hu_packed_quantity"),
                F.count_distinct("sscc").alias("sscc_count"),
            )
        )

        wm_stock = (
            storage_bin
            .filter(F.col("quant_number").isNotNull())
            .groupBy("plant_code", "warehouse_number", "material_code", "batch_number", "base_uom")
            .agg(
                F.count_distinct("quant_number").alias("wm_quant_count"),
                F.coalesce(F.sum("total_quantity"), F.lit(0.0)).alias("wm_quantity"),
            )
        )

        keys = ["plant_code", "warehouse_number", "material_code", "batch_number", "base_uom"]
        return (
            hu_stock.join(wm_stock, keys, "full")
            .withColumn("handling_unit_count", F.coalesce(F.col("handling_unit_count"), F.lit(0)))
            .withColumn("handling_unit_item_count", F.coalesce(F.col("handling_unit_item_count"), F.lit(0)))
            .withColumn("sscc_count", F.coalesce(F.col("sscc_count"), F.lit(0)))
            .withColumn("wm_quant_count", F.coalesce(F.col("wm_quant_count"), F.lit(0)))
            .withColumn("hu_packed_quantity", F.coalesce(F.col("hu_packed_quantity"), F.lit(0.0)))
            .withColumn("wm_quantity", F.coalesce(F.col("wm_quantity"), F.lit(0.0)))
            .withColumn("delta_quantity", F.col("wm_quantity") - F.col("hu_packed_quantity"))
            .withColumn("abs_delta_quantity", F.abs(F.col("delta_quantity")))
            .withColumn(
                "hu_reconciliation_status",
                F.when(F.col("abs_delta_quantity") <= F.lit(0.001), F.lit("MATCHED"))
                .when(F.col("handling_unit_count") == 0, F.lit("WM_WITHOUT_HU"))
                .when(F.col("wm_quant_count") == 0, F.lit("HU_WITHOUT_WM_QUANT"))
                .otherwise(F.lit("QUANTITY_VARIANCE")),
            )
        )


# ── 13. PHYSICAL INVENTORY RECONCILIATION ─────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Physical inventory count-vs-book reconciliation from IKPF/ISEG, including "
        "difference posting and material-document evidence."
    ),
    cluster_by=["plant_code", "count_date"],
))
def gold_physical_inventory_recon():
    spark = get_spark_session()
    ss = get_silver_schema(spark)
    pi = spark.read.table(f"{ss}.physical_inventory_document")

    return (
        pi
        .filter(~F.coalesce(F.col("is_deleted"), F.lit(False)))
        .withColumn("book_quantity", F.coalesce(F.col("book_quantity"), F.lit(0.0)))
        .withColumn("counted_quantity", F.coalesce(F.col("counted_quantity"), F.lit(0.0)))
        .withColumn("delta_quantity", F.col("counted_quantity") - F.col("book_quantity"))
        .withColumn("abs_delta_quantity", F.abs(F.col("delta_quantity")))
        .withColumn("delta_value", F.coalesce(F.col("difference_amount_local_currency"), F.lit(0.0)))
        .withColumn(
            "physical_inventory_status",
            F.when(~F.col("is_counted"), F.lit("NOT_COUNTED"))
            .when(F.col("is_recount_required"), F.lit("RECOUNT_REQUIRED"))
            .when(F.col("is_difference_posted"), F.lit("DIFFERENCE_POSTED"))
            .when(F.col("abs_delta_quantity") <= F.lit(0.001), F.lit("MATCHED"))
            .otherwise(F.lit("DIFFERENCE_NOT_POSTED")),
        )
        .select(
            "physical_inventory_document_number", "fiscal_year", "item_number",
            "plant_code", "storage_location_code", "material_code", "batch_number",
            "stock_type_code", "base_uom", "document_date", "planned_count_date",
            "count_date", "posting_date", "book_quantity", "counted_quantity",
            "delta_quantity", "abs_delta_quantity", "delta_value", "currency",
            "is_counted", "is_difference_posted", "is_recount_required",
            "has_posting_block", "is_book_inventory_frozen",
            "material_document_number", "material_document_year", "material_document_item",
            "difference_reason_code", "cycle_counting_indicator", "physical_inventory_status",
            "_replicated_at",
        )
    )


# ── 14. RECONCILIATION ALERTS ─────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Alert-ready reconciliation exceptions for severe IM↔WM, HU, movement, and "
        "physical inventory variances."
    ),
    cluster_by=["plant_code", "alert_type"],
))
def gold_reconciliation_alerts():
    stock = (
        dlt.read("gold_reconciliation_audit_log")
        .filter(F.col("mismatch_severity").isin("HIGH", "CRITICAL") | (F.abs(F.col("delta_value")) >= F.lit(10000.0)))
        .select(
            F.concat(F.lit("STOCK|"), F.col("audit_event_key")).alias("alert_key"),
            F.lit("STOCK_RECONCILIATION").alias("alert_type"),
            F.when(F.col("mismatch_severity").isin("HIGH", "CRITICAL"), F.lit("P1")).otherwise(F.lit("P2")).alias(
                "alert_priority"
            ),
            "plant_code", "warehouse_number", "material_code", "batch_number",
            F.col("mismatch_reason").alias("reason_code"),
            F.col("delta_quantity"),
            F.col("delta_value"),
            F.col("audit_trail_json").alias("alert_context_json"),
        )
    )

    # HU alerts only when HU reconciliation is enabled (gold_hu_reconciliation is only
    # defined in full_validation; absent in dev_shakedown).
    hu = None
    if hu_reconciliation_enabled(get_spark_session()):
        hu = (
            dlt.read("gold_hu_reconciliation")
            .filter(F.col("hu_reconciliation_status") != "MATCHED")
            .select(
                F.concat_ws(
                    "|",
                    F.lit("HU"), "plant_code", "warehouse_number", "material_code",
                    "batch_number", "base_uom", "hu_reconciliation_status",
                ).alias("alert_key"),
                F.lit("HU_RECONCILIATION").alias("alert_type"),
                F.lit("P3").alias("alert_priority"),
                "plant_code", "warehouse_number", "material_code", "batch_number",
                F.col("hu_reconciliation_status").alias("reason_code"),
                F.col("delta_quantity"),
                F.lit(None).cast("double").alias("delta_value"),
                F.to_json(F.struct("handling_unit_count", "wm_quant_count", "sscc_count")).alias("alert_context_json"),
            )
        )

    physical_inventory = (
        dlt.read("gold_physical_inventory_recon")
        .filter(F.col("physical_inventory_status").isin("RECOUNT_REQUIRED", "DIFFERENCE_NOT_POSTED"))
        .select(
            F.concat_ws(
                "|",
                F.lit("PI"), "physical_inventory_document_number", "fiscal_year", "item_number",
            ).alias("alert_key"),
            F.lit("PHYSICAL_INVENTORY").alias("alert_type"),
            F.when(F.col("physical_inventory_status") == "RECOUNT_REQUIRED", F.lit("P2")).otherwise(F.lit("P3")).alias(
                "alert_priority"
            ),
            "plant_code",
            F.lit(None).cast("string").alias("warehouse_number"),
            "material_code", "batch_number",
            F.col("physical_inventory_status").alias("reason_code"),
            F.col("delta_quantity"),
            F.col("delta_value"),
            F.to_json(F.struct("count_date", "posting_date", "difference_reason_code")).alias("alert_context_json"),
        )
    )

    result = stock.unionByName(physical_inventory)
    if hu is not None:
        result = result.unionByName(hu)
    return result


# ── 15. STOCK RECONCILIATION EXCEPTIONS V2 ────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Non-reconciled rows from gold_stock_reconciliation_v2, enriched with "
        "material description. Use as the starting point for variance investigation."
    ),
    cluster_by=["plant_code", "mismatch_severity"],
))
def gold_stock_reconciliation_exceptions_v2():
    spark = get_spark_session()
    ss = get_silver_schema(spark)

    recon = dlt.read("gold_stock_reconciliation_v2")
    mat_desc = (
        spark.read.table(f"{ss}.material")
        .select("material_code", "material_description")
        .distinct()
    )

    return (
        recon
        .filter(~F.col("is_reconciled"))
        .join(F.broadcast(mat_desc), "material_code", "left")
        .select(
            "plant_code", "warehouse_number",
            "material_code", "material_description",
            "batch_number", "stock_category", "base_uom",
            "im_quantity", "wm_quantity", "delta_quantity",
            "abs_delta_quantity", "delta_percent", "delta_value",
            "mismatch_reason", "mismatch_severity", "tolerance_rule_code",
            "is_operationally_trusted",
        )
    )


# ── 16. STOCK RECONCILIATION SUMMARY V2 ──────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Summary of gold_stock_reconciliation_v2 rolled up by "
        "plant × warehouse × mismatch_reason × mismatch_severity."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_stock_reconciliation_summary_v2():
    recon = dlt.read("gold_stock_reconciliation_v2")
    return (
        recon
        .groupBy("plant_code", "warehouse_number", "mismatch_reason", "mismatch_severity")
        .agg(
            F.count(F.lit(1)).alias("row_count"),
            F.sum(F.when(~F.col("is_reconciled"), F.lit(1)).otherwise(F.lit(0)))
             .alias("exception_count"),
            F.sum(F.when(F.col("tolerance_exceeded"), F.lit(1)).otherwise(F.lit(0)))
             .alias("tolerance_exceeded_count"),
            F.coalesce(F.sum("abs_delta_quantity"), F.lit(0.0)).alias("abs_delta_quantity_total"),
            F.coalesce(F.sum(F.abs(F.col("delta_value"))), F.lit(0.0)).alias("abs_delta_value_total"),
        )
    )


# ── 17. STOCK RECONCILIATION SUMMARY ─────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Canonical summary of IM↔WM stock reconciliation by plant × warehouse × mismatch reason. "
        "Backed by gold_stock_reconciliation_v2."
    ),
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_stock_reconciliation_summary():
    summary = dlt.read("gold_stock_reconciliation_summary_v2")
    return (
        summary
        .select(
            "plant_code",
            "warehouse_number",
            "mismatch_reason",
            "mismatch_severity",
            "row_count",
            "exception_count",
            "tolerance_exceeded_count",
            "abs_delta_quantity_total",
            "abs_delta_value_total",
            F.when(F.col("exception_count") == 0, F.lit("RECONCILED"))
            .when(F.col("mismatch_severity").isin("HIGH", "CRITICAL"), F.lit("ACTION_REQUIRED"))
            .otherwise(F.lit("REVIEW"))
            .alias("reconciliation_status"),
        )
    )


# ── 18. WAREHOUSE COCKPIT CATEGORY C TABLES ───────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Current quant-level holds (Quality, Blocked, Restricted) in WM.",
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_stock_holds():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    storage_bin = spark.read.table(f"{silver_schema}.storage_bin")
    batch_stock = spark.read.table(f"{silver_schema}.batch_stock")

    batch_restricted = (
        batch_stock.groupBy("plant_code", "material_code", "batch_number")
        .agg(F.sum("restricted_use_quantity").alias("total_restricted_qty"))
        .filter(F.col("total_restricted_qty") > 0)
        .select("plant_code", "material_code", "batch_number", "total_restricted_qty")
        .distinct()
    )

    return (
        storage_bin.filter(F.col("quant_number").isNotNull())
        .join(
            batch_restricted,
            ["plant_code", "material_code", "batch_number"],
            "left"
        )
        .withColumn(
            "hold_type",
            F.when(F.col("stock_category_code") == "Q", F.lit("quality"))
            .when(F.col("stock_category_code") == "S", F.lit("blocked"))
            .when(F.col("total_restricted_qty").isNotNull(), F.lit("restricted"))
            .otherwise(F.lit(None))
        )
        .filter(F.col("hold_type").isNotNull())
        .select(
            "plant_code",
            "warehouse_number",
            "storage_type",
            F.col("bin_code").alias("storage_bin"),
            "quant_number",
            "material_code",
            "batch_number",
            "hold_type",
            F.col("total_quantity").alias("quantity"),
            "base_uom",
            "goods_receipt_date"
        )
    )


@dlt.table(**gold_table_args(
    comment="Current open transfer-order items (pick tasks).",
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_transfer_order_open_items():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    transfer_orders = anti_join_optional_deleted_headers(
        spark.read.table(f"{silver_schema}.warehouse_transfer_order"),
        silver_schema,
        "warehouse_transfer_order_header_delete",
        ["warehouse_number", "transfer_order_number"],
    )

    return (
        transfer_orders
        .filter(F.col("item_status") != "Fully Confirmed")
        .select(
            "plant_code",
            "warehouse_number",
            "transfer_order_number",
            "item_number",
            "material_code",
            "batch_number",
            "source_storage_type",
            F.col("source_bin").alias("source_storage_bin"),
            "destination_storage_type",
            F.col("destination_bin").alias("destination_storage_bin"),
            "requested_quantity",
            "confirmed_quantity",
            "item_status",
            "created_datetime",
            "confirmed_date",
            F.col("source_reference_type").alias("order_reference_type"),
            F.col("source_reference_number").alias("order_reference_number"),
            "transfer_priority",
            "delivery_number",
            "created_by_user",
            "confirmed_by_user",
        )
    )


@dlt.table(**gold_table_args(
    comment="Current open transfer-requirement items (move requests).",
    cluster_by=["plant_code", "warehouse_number"],
))
def gold_transfer_requirement_open_items():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    transfer_requirements = spark.read.table(f"{silver_schema}.warehouse_transfer_requirement")

    return (
        transfer_requirements.filter(
            (~F.coalesce(F.col("is_processing_complete"), F.lit(False)))
            & (F.coalesce(F.col("open_quantity"), F.lit(0.0)) > 0)
        )
        .select(
            "plant_code",
            "warehouse_number",
            "transfer_requirement_number",
            "item_number",
            "material_code",
            "batch_number",
            "source_storage_type",
            F.col("source_bin").alias("source_storage_bin"),
            "destination_storage_type",
            F.col("destination_bin").alias("destination_storage_bin"),
            "required_quantity",
            "open_quantity",
            "created_datetime",
            "planned_execution_datetime",
            F.col("source_reference_type").alias("order_reference_type"),
            F.col("source_reference_number").alias("order_reference_number"),
            "queue",
            "transfer_priority",
        )
    )

@dlt.table(**gold_table_args(
    comment=(
        "Goods-movement activity feed at MSEG-line grain (IM postings joined to the "
        "movement-type classification). High-volume table: consumers MUST filter on a bounded "
        "posting_date window — the serving route enforces a default 1-day window and a hard "
        "31-day maximum (see plan section 5, cost controls)."
    ),
    cluster_by=["plant_code", "posting_date"],
))
def gold_goods_movement_activity():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    goods = spark.read.table(f"{silver_schema}.goods_movement")
    classification = spark.read.table(f"{silver_schema}.movement_type_classification").select(
        "movement_type_code",
        "movement_label",
        "event_category",
        "is_goods_receipt",
        "is_goods_issue",
        "is_transfer",
        "is_reversal",
    )

    return (
        goods
        .join(F.broadcast(classification), ["movement_type_code"], "left")
        .select(
            "plant_code",
            "storage_location_code",
            "material_document_number",
            "fiscal_year",
            "document_line_item",
            "material_code",
            "batch_number",
            "movement_type_code",
            "movement_label",
            "event_category",
            F.coalesce(F.col("is_goods_receipt"), F.lit(False)).alias("is_goods_receipt"),
            F.coalesce(F.col("is_goods_issue"), F.lit(False)).alias("is_goods_issue"),
            F.coalesce(F.col("is_transfer"), F.lit(False)).alias("is_transfer"),
            F.coalesce(F.col("is_reversal"), F.lit(False)).alias("is_reversal"),
            "debit_credit_indicator",
            "quantity",
            "base_uom",
            "amount_local_currency",
            "currency",
            "posting_date",
            "document_date",
            "order_number",
            "purchase_order_number",
            "delivery_number",
            "sales_order_number",
            "posted_by_user",
            "transaction_code",
        )
    )
