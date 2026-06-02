"""
Lakeflow Spark Declarative Pipeline — Warehouse Flow Gold.

Tables:
  gold_dispensary_backlog      — open line-pick (dispensary) demand by plant / supply area
  gold_lineside_stock          — current stock staged in production / line-side storage types
  gold_delivery_pick_status    — outbound delivery pick progress
  gold_stock_reconciliation    — IM (MARD) vs WM (bins) variance, valuation and ABC class
  gold_process_order_staging   — process-order component staging completion
"""

import dlt
from pyspark.sql import Window
from pyspark.sql import functions as F

from gold._shared import (
    STAGING_REFERENCE_TYPE,
    get_silver_schema,
    get_spark_session,
    gold_table_args,
)

# ── 1. DISPENSARY BACKLOG ─────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Open dispensary / line-pick backlog (RESB BWART 261) by plant and supply area.",
    cluster_by=["plant_code", "production_supply_area"],
))
@dlt.expect("open quantity non-negative", "total_open_qty >= 0.0")
def gold_dispensary_backlog():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    reservations = spark.read.table(f"{silver_schema}.reservation_requirement")
    orders = spark.read.table(f"{silver_schema}.process_order").select(
        "order_number", "scheduled_start_date"
    )

    open_picks = reservations.filter(
        (F.col("movement_type_code") == "261")
        & (~F.coalesce(F.col("is_deletion_flagged"), F.lit(False)))
        & (F.coalesce(F.col("open_quantity"), F.lit(0.0)) > 0)
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
    deliveries = spark.read.table(f"{silver_schema}.outbound_delivery")

    picks = (
        deliveries.groupBy(
            "delivery_number", "plant_code", "warehouse_number",
            "delivery_type", "sold_to_customer", "planned_goods_issue_date",
        )
        .agg(
            F.count(F.lit(1)).alias("line_count"),
            F.coalesce(F.sum("delivery_quantity"), F.lit(0.0)).alias("delivery_qty"),
            F.coalesce(F.sum("picked_quantity"), F.lit(0.0)).alias("picked_qty"),
            F.max(F.when(F.col("actual_goods_issue_date").isNotNull(), F.lit(1)).otherwise(F.lit(0))).alias(
                "_is_shipped"
            ),
        )
        .select(
            "delivery_number", "plant_code", "warehouse_number", "delivery_type",
            "sold_to_customer", "planned_goods_issue_date", "line_count",
            "delivery_qty", "picked_qty",
            F.when(F.col("delivery_qty") != 0, F.col("picked_qty") / F.col("delivery_qty"))
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

    # Classify bins as physical or interim based on storage_type_role_mapping or fallback standard 9xx prefix (broadcast-optimized)
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
            ).alias("storage_role")
        )
    )

    wm = (
        sb_mapped.filter(F.col("quant_number").isNotNull())
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

    return with_abc.select(
        "plant_code", "material_code", "im_total_qty", "wm_total_qty", "wm_interim_qty", "wm_physical_qty",
        "delta_qty", "standard_price", "price_unit", "inventory_value", "mismatch_class", "abc_class",
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
    transfer_orders = spark.read.table(f"{silver_schema}.warehouse_transfer_order")
    orders = spark.read.table(f"{silver_schema}.process_order")

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
    staging_config = spark.read.table(
        f"{silver_schema}.process_order_staging_reference_mapping_config"
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
        .select(
            "order_number",
            "plant_code",
            "material_code",
            "order_quantity",
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

    transfer_orders = spark.read.table(f"{silver_schema}.warehouse_transfer_order")
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
            .when(F.col("benum_match_pct") >= 95.0, F.lit("VALIDATED"))
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

