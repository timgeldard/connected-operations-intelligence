"""
Shared Gold pipeline helpers.
"""

from pyspark.sql import DataFrame, SparkSession


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


def hu_reconciliation_enabled(spark: SparkSession) -> bool:
    """Whether handling-unit (HU) Gold models should be materialised.

    Gated by the `enable_hu_reconciliation` Spark conf (from the bundle variable). In
    `dev_shakedown` mode it is false: the upstream silver `handling_unit` table is not
    built because the externally-owned `published_dev.central_services` lacks
    handlingunit_vekp/vepo. So gold_hu_reconciliation / gold_handling_unit_summary and
    the HU branch of gold_reconciliation_alerts are not defined. UAT/PROD set it true.
    Defaults to true so a missing conf never silently drops HU in a real environment.
    """
    return str(spark.conf.get("enable_hu_reconciliation", "true")).strip().lower() == "true"


def table_exists(spark: SparkSession, table_name: str) -> bool:
    """True if a (fully-qualified) relation exists.

    Uses a lazy `spark.read.table` analysis probe, NOT `spark.catalog.tableExists`, which is a
    BLOCKED Py4J API in the DLT serverless environment (PY4J_BLOCKED_API). `read.table` resolves
    the relation (metadata only, no Spark job) and raises if it is absent.
    """
    try:
        spark.read.table(table_name)
        return True
    except Exception:  # noqa: BLE001 - missing UC catalog/schema is a normal bootstrap condition
        return False


def anti_join_optional_deleted_headers(
    df: DataFrame,
    silver_schema: str,
    delete_table: str,
    keys: list[str],
) -> DataFrame:
    """Drop rows whose parent SAP header has an explicit delete tombstone, when available."""
    spark = get_spark_session()
    fq_table = f"{silver_schema}.{delete_table}"
    if not table_exists(spark, fq_table):
        return df
    deleted = spark.read.table(fq_table).select(*keys).distinct()
    return df.join(deleted, keys, "left_anti")


# LTAK reference type that identifies process-order staging TOs.  When BETYP='F',
# BENUM holds the AUFNR (process-order number).  All other BETYP values (blank,
# 'X', 'P', 'L', 'D', …) do not carry a process-order reference in BENUM.
# Validated live (connected_plant_uat, 2026-06-02): 100% BENUM↔AUFNR match across
# 105 warehouse/plant combos; see gold_process_order_staging_validation.
STAGING_REFERENCE_TYPE = "F"


def _spark_available() -> bool:
    try:
        return SparkSession.getActiveSession() is not None
    except Exception:
        return False


STAGING_VALIDATION_THRESHOLD_PCT: float = float(
    # Percentage of F-type TO headers whose BENUM must match a known process order
    # for a warehouse to be classified as VALIDATED. Default 95.0.
    # Override via Spark conf: spark.conf.get("staging_validation_threshold_pct", "95.0")
    SparkSession.getActiveSession().conf.get("staging_validation_threshold_pct", "95.0")
    if _spark_available()
    else "95.0"
)


def gold_table_args(comment: str, cluster_by: list) -> dict:
    """Return common decorator arguments for Gold DLT tables.

    Gold runs as a trusted aggregate layer — no UC row filters are applied directly to the MVs
    (doing so forces full MV refreshes, see ADR 005 / ADR 012). Plant-level access control is
    enforced at query time via the *_secured serving views, which use the central
    published_<env>.security.model CSM pattern (see scripts/generate_gold_security_sql.py).
    """
    return {
        "comment": comment,
        "table_properties": {"delta.enableChangeDataFeed": "false"},
        "cluster_by": cluster_by,
    }
