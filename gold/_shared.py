"""
Shared Gold pipeline helpers.
"""

from pyspark.sql import SparkSession


def get_spark_session() -> SparkSession:
    return SparkSession.builder.getOrCreate()


def get_silver_schema(spark: SparkSession) -> str:
    try:
        catalog = spark.conf.get("silver_catalog")
        schema = spark.conf.get("silver_schema", "silver")
        # Local Spark (spark_catalog) requires single-part namespace (database.table)
        if catalog and catalog != "spark_catalog":
            return f"{catalog}.{schema}"
        return schema
    except Exception:
        # Local/manual fallback default only (points to production)
        return "connected_plant_prod.silver"


try:
    spark = get_spark_session()
    SILVER_CATALOG = spark.conf.get("silver_catalog", "connected_plant_prod")
    SILVER_SCHEMA = spark.conf.get("silver_schema", "silver")
    ROW_FILTER_FN = f"{SILVER_CATALOG}.{SILVER_SCHEMA}.plant_access_filter"
    # Gold runs as a trusted aggregate layer. Plant security is enforced on direct
    # Silver consumption; applying row filters here would force full MV refreshes.
    APPLY_ROW_FILTER = spark.conf.get("gold_apply_row_filter", "false").lower() == "true"
except Exception:
    ROW_FILTER_FN = "connected_plant_prod.silver.plant_access_filter"
    APPLY_ROW_FILTER = False


def gold_table_args(comment: str, cluster_by: list) -> dict:
    """Return common decorator arguments, applying the row filter if configured.

    If gold_apply_row_filter is enabled, plant_access_filter must already exist
    in the configured Silver schema before this pipeline is created/refreshed.
    """
    args = {
        "comment": comment,
        "table_properties": {"delta.enableChangeDataFeed": "true"},
        "cluster_by": cluster_by,
    }
    if APPLY_ROW_FILTER:
        args["row_filter"] = f"ROW FILTER {ROW_FILTER_FN} ON (plant_code)"
    return args
