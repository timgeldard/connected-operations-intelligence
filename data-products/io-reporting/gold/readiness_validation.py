import dlt
from pyspark.sql import Row, Window
from pyspark.sql import functions as F

from gold._shared import get_silver_schema, get_spark_session, gold_table_args

# ── 1. STORAGE TYPE ROLE COVERAGE ─────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Validation check for warehouse storage type role mapping coverage.",
    cluster_by=["plant_code"]
))
def gold_storage_type_role_coverage_status():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    bins = spark.read.table(f"{silver_schema}.storage_bin")
    roles = spark.read.table(f"{silver_schema}.site_config_storage_type_role")

    active_types = bins.filter(F.col("plant_code") != "SHARED").select("plant_code", "warehouse_number", "storage_type").distinct()

    joined = active_types.join(
        roles,
        ["plant_code", "warehouse_number", "storage_type"],
        "left"
    )

    grouped = joined.groupBy("plant_code", "warehouse_number").agg(
        F.count("*").alias("total_types"),
        F.sum(F.when(F.col("storage_role").isNull() | (F.col("role_confidence") == "FALLBACK"), 1).otherwise(0)).alias("unmapped_types")
    )

    res = grouped.withColumn(
        "match_rate",
        F.when(F.col("total_types") > 0, (F.col("total_types") - F.col("unmapped_types")) / F.col("total_types"))
        .otherwise(F.lit(None).cast("double"))
    )

    return (
        res.select(
            F.col("plant_code"),
            F.col("warehouse_number"),
            F.lit("gold_lineside_stock").alias("data_product_name"),
            F.lit("Storage Type Role Coverage").alias("validation_name"),
            F.when(F.col("match_rate").isNull(), "NOT_APPLICABLE")
            .when(F.col("match_rate") >= 1.0, "READY")
            .when(F.col("match_rate") >= 0.95, "READY_WITH_WARNINGS")
            .when(F.col("match_rate") >= 0.5, "PILOT_ONLY")
            .otherwise("BLOCKED").alias("validation_status"),
            F.when(F.col("match_rate").isNull(), "INFO")
            .when(F.col("match_rate") < 0.5, "HIGH")
            .when(F.col("match_rate") < 0.95, "MEDIUM")
            .when(F.col("match_rate") < 1.0, "LOW")
            .otherwise("INFO").alias("severity"),
            F.concat(F.round(F.col("match_rate") * 100, 1), F.lit("% matched")).alias("observed_value"),
            F.lit("100% conformed").alias("threshold_value"),
            F.col("unmapped_types").cast("long").alias("failed_record_count"),
            F.lit(None).cast("string").alias("sample_evidence_json"),
            F.current_timestamp().alias("last_checked_at"),
            F.lit("Map all storage types to confirmed roles in site_config_storage_type_role.").alias("recommended_action")
        )
    )

# ── 2. MOVEMENT TYPE CLASSIFICATION COVERAGE ──────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Validation check for movement type classification coverage.",
    cluster_by=["plant_code"]
))
def gold_movement_type_classification_coverage():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    movs = spark.read.table(f"{silver_schema}.goods_movement").filter(F.col("posting_date") >= F.date_sub(F.current_date(), 90))
    cfg = spark.read.table(f"{silver_schema}.site_config_movement_type_classification").alias("cfg")

    active_movs = movs.groupBy("plant_code", "movement_type_code").agg(F.count("*").alias("record_count"))

    joined = active_movs.alias("m").join(
        cfg.alias("cfg"),
        "movement_type_code",
        "left"
    ).filter(
        (F.col("cfg.plant_code").isNull()) | (F.col("cfg.plant_code") == F.col("m.plant_code"))
    ).select(
        F.col("m.plant_code").alias("plant_code"),
        "movement_type_code",
        "record_count",
        "event_category",
        F.col("cfg.plant_code").alias("cfg_plant_code")
    )

    win = Window.partitionBy("plant_code", "movement_type_code").orderBy(F.col("cfg_plant_code").desc_nulls_last())
    deduped = joined.withColumn("_rn", F.row_number().over(win)).filter(F.col("_rn") == 1).drop("_rn")

    grouped = deduped.groupBy("plant_code").agg(
        F.sum("record_count").alias("total_records"),
        F.sum(F.when(F.col("event_category").isNull() | (F.col("event_category") == "OTHER"), F.col("record_count")).otherwise(0)).alias("unclassified_records"),
        F.sum(F.when(F.col("movement_type_code").like("Z%") & (F.col("event_category").isNull() | (F.col("event_category") == "OTHER")), F.col("record_count")).otherwise(0)).alias("unclassified_z_records")
    )

    res = grouped.withColumn(
        "match_rate",
        F.when(F.col("total_records") > 0, (F.col("total_records") - F.col("unclassified_records")) / F.col("total_records"))
        .otherwise(F.lit(None).cast("double"))
    )

    return (
        res.select(
            F.col("plant_code"),
            F.lit(None).cast("string").alias("warehouse_number"),
            F.lit("gold_shift_output_summary").alias("data_product_name"),
            F.lit("Movement Type Classification").alias("validation_name"),
            F.when(F.col("match_rate").isNull(), "NOT_APPLICABLE")
            .when(F.col("unclassified_z_records") > 0, "BLOCKED")
            .when(F.col("match_rate") >= 0.995, "READY")
            .when(F.col("match_rate") >= 0.95, "READY_WITH_WARNINGS")
            .when(F.col("match_rate") >= 0.70, "PILOT_ONLY")
            .otherwise("BLOCKED").alias("validation_status"),
            F.when(F.col("match_rate").isNull(), "INFO")
            .when((F.col("unclassified_z_records") > 0) | (F.col("match_rate") < 0.70), "CRITICAL")
            .when(F.col("match_rate") < 0.95, "HIGH")
            .when(F.col("match_rate") < 0.995, "MEDIUM")
            .otherwise("INFO").alias("severity"),
            F.concat(F.round(F.col("match_rate") * 100, 1), F.lit("% classified")).alias("observed_value"),
            F.lit(">= 99.5% classified, 0 unclassified Z*").alias("threshold_value"),
            F.col("unclassified_records").cast("long").alias("failed_record_count"),
            F.lit(None).cast("string").alias("sample_evidence_json"),
            F.current_timestamp().alias("last_checked_at"),
            F.lit("Classify movement types in site_config_movement_type_classification.").alias("recommended_action")
        )
    )

# ── 3. PROCESS ORDER STAGING VALIDATION ────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Validation check for process order staging key matching.",
    cluster_by=["plant_code"]
))
def gold_process_order_staging_validation():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    tos = spark.read.table(f"{silver_schema}.warehouse_transfer_order").filter(F.col("source_reference_type") == "F")
    orders = spark.read.table(f"{silver_schema}.process_order").select("order_number", "plant_code").distinct()

    joined = tos.alias("tos").join(
        orders.alias("orders"),
        (F.col("tos.source_reference_number") == F.col("orders.order_number")) & (F.col("tos.plant_code") == F.col("orders.plant_code")),
        "left"
    ).select(
        F.col("tos.plant_code").alias("plant_code"),
        "warehouse_number",
        F.col("orders.order_number").alias("order_number")
    )

    grouped = joined.groupBy("plant_code", "warehouse_number").agg(
        F.count("*").alias("total_to_items"),
        F.sum(F.when(F.col("order_number").isNull(), 1).otherwise(0)).alias("unmatched_to_items")
    )

    res = grouped.withColumn(
        "match_rate",
        F.when(F.col("total_to_items") > 0, (F.col("total_to_items") - F.col("unmatched_to_items")) / F.col("total_to_items"))
        .otherwise(F.lit(None).cast("double"))
    )

    return (
        res.select(
            F.col("plant_code"),
            F.col("warehouse_number"),
            F.lit("gold_process_order_staging").alias("data_product_name"),
            F.lit("Process Order Staging Validation").alias("validation_name"),
            F.when(F.col("match_rate").isNull(), "NOT_APPLICABLE")
            .when(F.col("match_rate") >= 0.98, "READY")
            .when(F.col("match_rate") >= 0.90, "READY_WITH_WARNINGS")
            .when(F.col("match_rate") >= 0.70, "PILOT_ONLY")
            .otherwise("BLOCKED").alias("validation_status"),
            F.when(F.col("match_rate").isNull(), "INFO")
            .when(F.col("match_rate") < 0.70, "HIGH")
            .when(F.col("match_rate") < 0.90, "MEDIUM")
            .when(F.col("match_rate") < 0.98, "LOW")
            .otherwise("INFO").alias("severity"),
            F.concat(F.round(F.col("match_rate") * 100, 1), F.lit("% keys matched")).alias("observed_value"),
            F.lit(">= 98% matching").alias("threshold_value"),
            F.col("unmatched_to_items").cast("long").alias("failed_record_count"),
            F.lit(None).cast("string").alias("sample_evidence_json"),
            F.current_timestamp().alias("last_checked_at"),
            F.lit("Check why TO reference numbers (BENUM) do not exist in process_order.").alias("recommended_action")
        )
    )

# ── 4. RECIPE / PROCESS-LINE ENRICHMENT COVERAGE ──────────────────────────────

@dlt.table(**gold_table_args(
    comment="Validation check for recipe process line enrichment coverage.",
    cluster_by=["plant_code"]
))
def gold_recipe_line_enrichment_coverage():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    orders = spark.read.table(f"{silver_schema}.process_order").filter(F.col("scheduled_start_date") >= F.date_sub(F.current_date(), 90))

    grouped = orders.groupBy("plant_code").agg(
        F.count("*").alias("total_orders"),
        F.sum(F.when(F.col("production_line").isNull(), 1).otherwise(0)).alias("unenriched_orders")
    )

    res = grouped.withColumn(
        "match_rate",
        F.when(F.col("total_orders") > 0, (F.col("total_orders") - F.col("unenriched_orders")) / F.col("total_orders"))
        .otherwise(F.lit(None).cast("double"))
    )

    return (
        res.select(
            F.col("plant_code"),
            F.lit(None).cast("string").alias("warehouse_number"),
            F.lit("gold_shift_output_summary").alias("data_product_name"),
            F.lit("Recipe Line Enrichment").alias("validation_name"),
            F.when(F.col("match_rate").isNull(), "NOT_APPLICABLE")
            .when(F.col("match_rate") >= 0.98, "READY")
            .when(F.col("match_rate") >= 0.95, "READY_WITH_WARNINGS")
            .when(F.col("match_rate") >= 0.80, "PILOT_ONLY")
            .otherwise("BLOCKED").alias("validation_status"),
            F.when(F.col("match_rate").isNull(), "INFO")
            .when(F.col("match_rate") < 0.80, "HIGH")
            .when(F.col("match_rate") < 0.95, "MEDIUM")
            .when(F.col("match_rate") < 0.98, "LOW")
            .otherwise("INFO").alias("severity"),
            F.concat(F.round(F.col("match_rate") * 100, 1), F.lit("% enriched")).alias("observed_value"),
            F.lit(">= 98% conformed lines").alias("threshold_value"),
            F.col("unenriched_orders").cast("long").alias("failed_record_count"),
            F.lit(None).cast("string").alias("sample_evidence_json"),
            F.current_timestamp().alias("last_checked_at"),
            F.lit("Maintain recipe to line classifications in SAP class type 018.").alias("recommended_action")
        )
    )

# ── 5. DELIVERY PICK STATUS VALIDATION ────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Validation check for mixed UoM delivery picking status.",
    cluster_by=["plant_code"]
))
def gold_delivery_pick_status_validation():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    deliveries = spark.read.table(f"{silver_schema}.outbound_delivery").filter(F.col("planned_goods_issue_date") >= F.date_sub(F.current_date(), 90))

    deliv_uom = deliveries.groupBy("plant_code", "delivery_number").agg(
        F.count_distinct("base_uom").alias("uom_count")
    )

    grouped = deliv_uom.groupBy("plant_code").agg(
        F.count("*").alias("total_deliveries"),
        F.sum(F.when(F.col("uom_count") > 1, 1).otherwise(0)).alias("mixed_uom_deliveries")
    )

    res = grouped.withColumn(
        "mixed_rate",
        F.when(F.col("total_deliveries") > 0, F.col("mixed_uom_deliveries") / F.col("total_deliveries"))
        .otherwise(F.lit(None).cast("double"))
    )

    return (
        res.select(
            F.col("plant_code"),
            F.lit(None).cast("string").alias("warehouse_number"),
            F.lit("gold_delivery_pick_status").alias("data_product_name"),
            F.lit("Delivery Pick Status Validation").alias("validation_name"),
            F.when(F.col("mixed_rate").isNull(), "NOT_APPLICABLE")
            .when(F.col("mixed_rate") > 0.05, "PILOT_ONLY")
            .otherwise("READY").alias("validation_status"),
            F.when(F.col("mixed_rate").isNull(), "INFO")
            .when(F.col("mixed_rate") > 0.05, "MEDIUM")
            .otherwise("INFO").alias("severity"),
            F.concat(F.round(F.col("mixed_rate") * 100, 1), F.lit("% mixed UoM")).alias("observed_value"),
            F.lit("<= 5% mixed UoM").alias("threshold_value"),
            F.col("mixed_uom_deliveries").cast("long").alias("failed_record_count"),
            F.lit(None).cast("string").alias("sample_evidence_json"),
            F.current_timestamp().alias("last_checked_at"),
            F.lit("Ensure conformed picking uses conformed single UoMs or switch to TO-level picking.").alias("recommended_action")
        )
    )

# ── 6. STOCK RECONCILIATION READINESS ─────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Validation check for stock reconciliation readiness.",
    cluster_by=["plant_code"]
))
def gold_stock_reconciliation_readiness():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    slocs = spark.read.table(f"{silver_schema}.warehouse_storage_location_mapping")
    slocs_agg = slocs.groupBy("plant_code").agg(F.count("*").alias("mapped_slocs"))

    roles_cov = dlt.read("gold_storage_type_role_coverage_status")

    joined = slocs_agg.join(
        roles_cov,
        "plant_code",
        "left"
    )

    return (
        joined.select(
            F.col("plant_code"),
            F.lit(None).cast("string").alias("warehouse_number"),
            F.lit("gold_stock_reconciliation").alias("data_product_name"),
            F.lit("Stock Reconciliation Readiness").alias("validation_name"),
            F.when(F.col("validation_status") == "READY", "READY")
            .when(F.col("validation_status") == "READY_WITH_WARNINGS", "READY_WITH_WARNINGS")
            .otherwise("PILOT_ONLY").alias("validation_status"),
            F.when(F.col("validation_status") == "READY", "INFO").otherwise("MEDIUM").alias("severity"),
            F.concat(F.col("mapped_slocs").cast("string"), F.lit(" slocs mapped")).alias("observed_value"),
            F.lit("All slocs conformed and storage types mapped").alias("threshold_value"),
            F.lit(0).cast("long").alias("failed_record_count"),
            F.lit(None).cast("string").alias("sample_evidence_json"),
            F.current_timestamp().alias("last_checked_at"),
            F.lit("Verify storage type roles and sloc-to-warehouse mappings.").alias("recommended_action")
        )
    )

# ── 7. PLANT REPLICATION FRESHNESS SLA ────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Validation check for plant replication freshness lag.",
    cluster_by=["plant_code"]
))
def gold_plant_freshness_readiness():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    po = spark.read.table(f"{silver_schema}.process_order").groupBy("plant_code").agg(F.max("_replicated_at").alias("po_max"))
    to = spark.read.table(f"{silver_schema}.warehouse_transfer_order").groupBy("plant_code").agg(F.max("_replicated_at").alias("to_max"))

    joined = po.join(to, "plant_code", "outer")

    res = joined.withColumn(
        "max_rep",
        F.coalesce(
            F.when(F.col("po_max") > F.col("to_max"), F.col("po_max")).otherwise(F.col("to_max")),
            F.col("po_max"),
            F.col("to_max")
        )
    )

    res_lag = res.withColumn(
        "lag_minutes",
        (F.unix_timestamp(F.current_timestamp()) - F.unix_timestamp(F.col("max_rep"))) / 60
    )

    return (
        res_lag.select(
            F.col("plant_code"),
            F.lit(None).cast("string").alias("warehouse_number"),
            F.lit("all_products").alias("data_product_name"),
            F.lit("Plant Freshness SLA").alias("validation_name"),
            F.when(F.col("lag_minutes").isNull(), "UNKNOWN")
            .when(F.col("lag_minutes") > 1440.0, "BLOCKED")
            .otherwise("READY").alias("validation_status"),
            F.when(F.col("lag_minutes").isNull() | (F.col("lag_minutes") > 1440.0), "CRITICAL").otherwise("INFO").alias("severity"),
            F.concat(F.round(F.col("lag_minutes") / 60, 1), F.lit(" hours lag")).alias("observed_value"),
            F.lit("<= 24 hours lag").alias("threshold_value"),
            F.when(F.col("lag_minutes") > 1440.0, 1).otherwise(0).cast("long").alias("failed_record_count"),
            F.lit(None).cast("string").alias("sample_evidence_json"),
            F.current_timestamp().alias("last_checked_at"),
            F.lit("Investigate replication jobs for Bronze data tables.").alias("recommended_action")
        )
    )

# ── 8. VALIDATION FAILURE DETAIL (UNION ROLLUP) ───────────────────────────────

@dlt.table(**gold_table_args(
    comment="Actionable list of all validation checks and failure records.",
    cluster_by=["plant_code"]
))
def gold_validation_failure_detail():
    s1 = dlt.read("gold_storage_type_role_coverage_status")
    s2 = dlt.read("gold_movement_type_classification_coverage")
    s3 = dlt.read("gold_process_order_staging_validation")
    s4 = dlt.read("gold_recipe_line_enrichment_coverage")
    s5 = dlt.read("gold_delivery_pick_status_validation")
    s6 = dlt.read("gold_stock_reconciliation_readiness")
    s7 = dlt.read("gold_plant_freshness_readiness")

    return s1.unionByName(s2).unionByName(s3).unionByName(s4).unionByName(s5).unionByName(s6).unionByName(s7)

# ── 9. PLANT READINESS STATUS (ROLLUP SCORING) ───────────────────────────────

@dlt.table(**gold_table_args(
    comment="Rollup readiness status and calculated score per plant, domain, and data product.",
    cluster_by=["plant_code", "data_product_name"]
))
def gold_plant_readiness_status():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    # Read the details and conformed enablement configs
    detail = dlt.read("gold_validation_failure_detail")
    enablement = spark.read.table(f"{silver_schema}.site_config_kpi_enablement")

    # Calculate score deduction per plant / data product
    # Deductions: CRITICAL: -40, HIGH: -20, MEDIUM: -10, LOW: -3, INFO: 0
    deduct_df = detail.withColumn(
        "deduction",
        F.when(F.col("severity") == "CRITICAL", 40)
        .when(F.col("severity") == "HIGH", 20)
        .when(F.col("severity") == "MEDIUM", 10)
        .when(F.col("severity") == "LOW", 3)
        .otherwise(0)
    )

    # Calculate total deduction per plant/data_product
    # Note: plant lag is in data_product_name = 'all_products', we should account for it.
    # Group and rollup
    rolled = deduct_df.groupBy("plant_code", "data_product_name").agg(
        F.sum("deduction").alias("total_deduction"),
        F.max(F.when(F.col("severity") == "CRITICAL", 1).otherwise(0)).alias("has_critical"),
        F.max(F.when((F.col("validation_name") == "Plant Freshness SLA") & (F.col("validation_status") == "BLOCKED"), 1).otherwise(0)).alias("is_stale")
    )

    # Freshness lag rollup: join rolled with plant-level lag status
    stale_plants = rolled.filter((F.col("data_product_name") == "all_products") & (F.col("is_stale") == 1)).select("plant_code").distinct()

    score_df = rolled.withColumn("raw_score", 100 - F.col("total_deduction")) \
                     .withColumn("readiness_score", F.when(F.col("raw_score") < 0, 0).otherwise(F.col("raw_score")))

    # Apply override status logic
    status_df = score_df.withColumn(
        "computed_status",
        F.when(F.col("readiness_score") >= 90, "READY")
        .when(F.col("readiness_score") >= 75, "READY_WITH_WARNINGS")
        .when(F.col("readiness_score") >= 50, "PILOT_ONLY")
        .otherwise("BLOCKED")
    )

    # Join with conformed KPI enablement overrides
    joined_override = status_df.alias("s").join(
        enablement.alias("e"),
        (F.col("s.plant_code") == F.col("e.plant_code")) & (F.col("s.data_product_name") == F.col("e.data_product_name")),
        "left"
    ).select(
        F.col("s.plant_code").alias("plant_code"),
        F.col("s.data_product_name").alias("data_product_name"),
        F.col("s.readiness_score").alias("readiness_score"),
        F.col("s.total_deduction").alias("total_deduction"),
        F.col("s.has_critical").alias("has_critical"),
        F.col("s.computed_status").alias("computed_status"),
        F.col("e.enablement_status").alias("enablement_status")
    )

    # Apply final overrides
    res = joined_override.join(stale_plants.alias("stale"), "plant_code", "left") \
        .withColumn(
            "final_status",
            F.when(F.col("stale.plant_code").isNotNull(), "BLOCKED")
            .when(F.col("has_critical") == 1, "BLOCKED")
            .when(F.col("enablement_status").isNotNull(), F.col("enablement_status"))
            .otherwise(F.col("computed_status"))
        )

    # Map domain names
    res_domain = res.withColumn(
        "domain",
        F.when(F.col("data_product_name").like("%stock%"), "STOCK")
        .when(F.col("data_product_name").like("%warehouse%") | F.col("data_product_name").like("%transfer%"), "WAREHOUSE")
        .when(F.col("data_product_name").like("%delivery%"), "OUTBOUND")
        .when(F.col("data_product_name").like("%output%"), "PRODUCTION")
        .otherwise("GENERAL")
    )

    return (
        res_domain.select(
            F.col("plant_code"),
            F.col("domain"),
            F.col("data_product_name"),
            F.col("final_status").alias("readiness_status"),
            F.col("readiness_score").cast("int"),
            F.col("total_deduction").cast("int").alias("critical_failure_count"), # approximate summary
            F.current_timestamp().alias("last_assessed_at")
        )
    )

# ── 10. DATA PRODUCT SAFETY STATUS ────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment="Safety classification of all conformed Gold data products.",
    cluster_by=["data_product_name"]
))
def gold_data_product_safety_status():
    spark = get_spark_session()

    data = [
        Row(data_product_name="gold_transfer_order_performance", current_status_label="READY", contains_date_relative_logic=False, is_allowed_for_production=True),
        Row(data_product_name="gold_transfer_requirement_backlog", current_status_label="READY", contains_date_relative_logic=False, is_allowed_for_production=True),
        Row(data_product_name="gold_bin_occupancy", current_status_label="READY", contains_date_relative_logic=False, is_allowed_for_production=True),
        Row(data_product_name="gold_stock_availability", current_status_label="READY", contains_date_relative_logic=False, is_allowed_for_production=True),
        Row(data_product_name="gold_lineside_stock", current_status_label="PILOT_ONLY", contains_date_relative_logic=True, is_allowed_for_production=False),
        Row(data_product_name="gold_delivery_pick_status", current_status_label="PILOT_ONLY", contains_date_relative_logic=True, is_allowed_for_production=False),
        Row(data_product_name="gold_process_order_staging", current_status_label="PILOT_ONLY", contains_date_relative_logic=True, is_allowed_for_production=False),
        Row(data_product_name="gold_inbound_po_backlog", current_status_label="PILOT_ONLY", contains_date_relative_logic=False, is_allowed_for_production=False),
        Row(data_product_name="gold_shift_output_summary", current_status_label="BLOCKED", contains_date_relative_logic=False, is_allowed_for_production=False),
        Row(data_product_name="gold_stock_reconciliation", current_status_label="PILOT_ONLY", contains_date_relative_logic=False, is_allowed_for_production=False),
    ]
    return spark.createDataFrame(data)

# ── 11. READINESS DASHBOARD SOURCE (FLATTENED PREAgg) ──────────────────────────

@dlt.table(**gold_table_args(
    comment="Flattened reporting source optimized for plant readiness dashboards.",
    cluster_by=["plant_code"]
))
def gold_readiness_dashboard_source():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    # Read the status rollup and conformed plant catalog
    status = dlt.read("gold_plant_readiness_status")
    plants = spark.read.table(f"{silver_schema}.site_config_plant")

    # Left join to enrich dashboard rows
    return (
        status.join(
            plants,
            "plant_code",
            "left"
        )
        .select(
            F.col("plant_code"),
            F.col("plant_name"),
            F.col("region"),
            F.col("domain"),
            F.col("data_product_name"),
            F.col("readiness_status"),
            F.col("readiness_score"),
            F.col("last_assessed_at")
        )
    )
