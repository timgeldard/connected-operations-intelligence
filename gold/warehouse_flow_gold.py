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

from gold._shared import get_silver_schema, get_spark_session, gold_table_args

# Storage types treated as production / line-side staging (PSA 100, palletising 801,
# dispensary 8xx). Hard-coded for now; FOLLOW-UP: drive this from a governed storage-type
# role config table (per warehouse/plant) for global rollout — see gold/design_spec.md
# "Known limitations".
_LINESIDE_PREDICATE = "(storage_type = '100' OR storage_type LIKE '8%')"


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

    lineside = storage_bin.filter(
        F.col("quant_number").isNotNull() & F.expr(_LINESIDE_PREDICATE)
    )

    return (
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
        .withColumn(
            "min_days_to_expiry",
            F.when(
                F.col("earliest_expiry_date").isNotNull(),
                F.datediff(F.col("earliest_expiry_date"), F.current_date()),
            ),
        )
    )


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

    fraction = F.coalesce(F.col("pick_fraction"), F.lit(0.0))
    return (
        picks
        .withColumn("days_to_goods_issue", F.datediff(F.col("planned_goods_issue_date"), F.current_date()))
        .withColumn(
            "risk_band",
            F.when(F.col("is_shipped"), F.lit("green"))
            .when(F.col("days_to_goods_issue").isNull(), F.lit("grey"))  # no planned GI date
            .when((fraction < 0.5) & (F.col("days_to_goods_issue") <= 0), F.lit("red"))
            .when((fraction < 0.8) & (F.col("days_to_goods_issue") <= 1), F.lit("amber"))
            .otherwise(F.lit("green")),
        )
    )


# ── 4. STOCK RECONCILIATION (IM vs WM) ────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="IM book stock (MARD) vs WM bin stock variance, with valuation and ABC class, by plant and material.",
    cluster_by=["plant_code", "material_code"],
))
def gold_stock_reconciliation():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    mard = spark.read.table(f"{silver_schema}.stock_at_location")
    storage_bin = spark.read.table(f"{silver_schema}.storage_bin")
    valuation = spark.read.table(f"{silver_schema}.material_valuation")

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

    wm = (
        storage_bin.filter(F.col("quant_number").isNotNull())
        .groupBy("plant_code", "material_code")
        .agg(F.coalesce(F.sum("total_quantity"), F.lit(0.0)).alias("wm_total_qty"))
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
        im.join(wm, ["plant_code", "material_code"], "full")
        .join(price, ["plant_code", "material_code"], "left")
        .withColumn("im_total_qty", F.coalesce(F.col("im_total_qty"), F.lit(0.0)))
        .withColumn("wm_total_qty", F.coalesce(F.col("wm_total_qty"), F.lit(0.0)))
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
        .withColumn(
            "_cum_pct",
            F.when(F.col("_plant_value") > 0, F.col("_cum_value") / F.col("_plant_value")).otherwise(
                F.lit(1.0)
            ),
        )
        .withColumn(
            "abc_class",
            F.when(F.col("standard_price").isNull(), F.lit("U"))  # unpriced -> not classifiable
            .when(F.col("_cum_pct") <= 0.80, F.lit("A"))
            .when(F.col("_cum_pct") <= 0.95, F.lit("B"))
            .otherwise(F.lit("C")),
        )
    )

    return with_abc.select(
        "plant_code", "material_code", "im_total_qty", "wm_total_qty", "delta_qty",
        "standard_price", "price_unit", "inventory_value", "mismatch_class", "abc_class",
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

    # Transfer orders that stage to a production order: in Kerry's WM config the TO source
    # reference (LTAK-BENUM) holds the process-order number. TOs whose source reference is NOT
    # a process order (warehouse replenishment, returns, etc.) find no match in the left join
    # below and are dropped — they don't corrupt the result. ASSUMPTION to confirm against live
    # LTAK reference types per plant before relying on this for KPIs.
    staging_tos = (
        transfer_orders
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

    staged = (
        active_orders.join(staging_tos, "order_number", "left")
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
        )
    )

    fraction = F.coalesce(F.col("staging_fraction"), F.lit(0.0))
    return (
        staged
        .withColumn("days_to_start", F.datediff(F.col("scheduled_start_date"), F.current_date()))
        .withColumn(
            "risk_band",
            F.when(F.col("to_items_total") == 0, F.lit("grey"))
            .when(F.col("days_to_start").isNull(), F.lit("grey"))  # no scheduled start date
            .when((fraction < 0.3) & (F.col("days_to_start") <= 0), F.lit("red"))
            .when((fraction < 0.7) & (F.col("days_to_start") <= 1), F.lit("amber"))
            .otherwise(F.lit("green")),
        )
    )
