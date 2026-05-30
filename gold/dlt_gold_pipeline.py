"""
Lakeflow Spark Declarative Pipeline — connected_plant_uat.gold

Deployed via DAB bundle: databricks.yml / resources/gold_pipeline.pipeline.yml
  target catalog  : controlled by var.catalog   (default: connected_plant_uat)
  target schema   : controlled by var.gold_schema(default: gold)
  silver catalog  : spark.conf silver_catalog   (default: connected_plant_uat)
  silver schema   : spark.conf silver_schema    (default: silver)
  pipeline mode   : Triggered
"""

import dlt
from pyspark.sql import SparkSession, functions as F

def get_spark_session() -> SparkSession:
    return SparkSession.builder.getOrCreate()

def get_silver_schema(spark: SparkSession) -> str:
    try:
        catalog = spark.conf.get('silver_catalog')
        schema = spark.conf.get('silver_schema', 'silver')
        # Local Spark (spark_catalog) requires single-part namespace (database.table)
        if catalog and catalog != "spark_catalog":
            return f"{catalog}.{schema}"
        return schema
    except Exception:
        return "connected_plant_uat.silver"

@dlt.table(
    comment="Shift-level production output summary. Aggregates quantity and scrap by posting date and plant.",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "posting_date"]
)
def gold_shift_output_summary():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    # Read from Silver layer
    goods_mov = spark.read.table(f"{silver_schema}.goods_movement")
    
    # Aggregate output quantities based on standard movement types (101 receipt, 102 receipt reversal)
    # Scrap movement types are typically 551 (scrap) and 552 (scrap reversal)
    return (
        goods_mov.groupBy("plant_code", "posting_date", "material_code", "base_uom")
        .agg(
            F.sum(
                F.when(F.col("movement_type_code") == "101", F.col("quantity"))
                .when(F.col("movement_type_code") == "102", -F.col("quantity"))
                .otherwise(0.0)
            ).alias("produced_quantity"),
            F.sum(
                F.when(F.col("movement_type_code") == "551", F.col("quantity"))
                .when(F.col("movement_type_code") == "552", -F.col("quantity"))
                .otherwise(0.0)
            ).alias("scrap_quantity")
        )
    )

@dlt.table(
    comment="On-Time-In-Full (OTIF) metrics comparing scheduled vs actual process order completions.",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "actual_finish_date"]
)
def gold_order_otif_metrics():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    orders = spark.read.table(f"{silver_schema}.process_order")
    
    # Filter completed or closed orders
    completed_orders = orders.filter("is_completed = true OR is_closed = true")
    
    return (
        completed_orders.select(
            "order_number",
            "plant_code",
            "material_code",
            "order_quantity",
            "confirmed_yield_quantity",
            "scheduled_finish_date",
            "actual_finish_date",
            F.when(F.col("actual_finish_date") <= F.col("scheduled_finish_date"), 1)
            .otherwise(0).alias("is_on_time"),
            F.when(F.col("confirmed_yield_quantity") >= F.col("order_quantity"), 1)
            .otherwise(0).alias("is_in_full")
        )
    )

@dlt.table(
    comment="Plant-level OEE / utilisation KPIs including available hours, operating hours, and performance index.",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code"]
)
def gold_plant_oee_kpis():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    orders = spark.read.table(f"{silver_schema}.process_order")
    downtime = spark.read.table(f"{silver_schema}.downtime_event")


    
    # Sum of downtime hours per plant
    plant_downtime = (
        downtime.groupBy("plant_code")
        .agg(F.sum("duration_minutes").alias("total_downtime_minutes"))
    )
    
    # Sum of process orders quantities and yield
    plant_production = (
        orders.groupBy("plant_code")
        .agg(
            F.sum("order_quantity").alias("total_ordered_qty"),
            F.sum("confirmed_yield_quantity").alias("total_yield_qty"),
            F.sum("total_scrap_quantity").alias("total_scrap_qty")
        )
    )
    
    return (
        plant_production.join(plant_downtime, "plant_code", "left")
        .select(
            "plant_code",
            "total_ordered_qty",
            "total_yield_qty",
            "total_scrap_qty",
            F.coalesce(F.col("total_downtime_minutes"), F.lit(0.0)).alias("total_downtime_minutes"),
            # Yield rate calculation
            F.when(
                F.col("total_yield_qty") + F.col("total_scrap_qty") > 0,
                F.col("total_yield_qty") / (F.col("total_yield_qty") + F.col("total_scrap_qty"))
            ).otherwise(1.0).alias("quality_rate")
        )
    )
