"""
Shared Gold pipeline helpers.
"""

from pyspark.sql import SparkSession


def get_spark_session() -> SparkSession:
    return SparkSession.builder.getOrCreate()


def get_silver_schema(spark: SparkSession) -> str:
    catalog = spark.conf.get("silver_catalog", None)
    schema = spark.conf.get("silver_schema", None)
    if not catalog:
        raise ValueError("silver_catalog configuration must be set in the Spark session.")
    if not schema:
        raise ValueError("silver_schema configuration must be set in the Spark session.")
    
    # Local Spark (spark_catalog) requires single-part namespace (database.table)
    if catalog == "spark_catalog":
        return schema
    return f"{catalog}.{schema}"


def gold_table_args(comment: str, cluster_by: list) -> dict:
    """Return common decorator arguments, applying the plant row filter if configured.

    Spark conf is read lazily HERE rather than at module import: the DLT load phase does not
    guarantee the session conf is populated when the module is imported, so reading it at
    import time (and raising) could fail the whole pipeline at load with an opaque error.
    Gold runs as a trusted aggregate layer; the row filter is OFF by default (it would force
    full MV refreshes — see ADR 005 / ADR 012). When gold_apply_row_filter is enabled,
    plant_access_filter must already exist in the configured Silver schema.
    """
    spark = get_spark_session()
    args = {
        "comment": comment,
        "table_properties": {"delta.enableChangeDataFeed": "false"},
        "cluster_by": cluster_by,
    }
    if spark.conf.get("gold_apply_row_filter", "false").lower() == "true":
        # Reuse get_silver_schema for consistent catalog/schema resolution (incl. the spark_catalog
        # single-part namespace) and its conf validation, rather than duplicating it here.
        silver_schema = get_silver_schema(spark)
        args["row_filter"] = f"ROW FILTER {silver_schema}.plant_access_filter ON (plant_code)"
    return args
