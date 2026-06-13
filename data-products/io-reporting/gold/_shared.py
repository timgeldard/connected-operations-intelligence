"""
Shared Gold pipeline helpers.

Session/conf/existence probes are delegated to silver.helpers (single implementation —
the bundle root packages both silver* and gold*, so the import is available in every
pipeline). The explicit-`spark` signatures are kept for existing Gold callers.
"""

from pyspark.sql import DataFrame, SparkSession

from silver.helpers import get_spark as _get_spark
from silver.helpers import hu_reconciliation_enabled as _hu_reconciliation_enabled
from silver.helpers import relation_exists as _relation_exists


def get_spark_session() -> SparkSession:
    return _get_spark()


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

    Delegates to silver.helpers.hu_reconciliation_enabled (single implementation); the
    `spark` parameter is kept for signature stability (one session per pipeline run).
    """
    del spark  # one active session per run; the shared helper resolves it itself
    return _hu_reconciliation_enabled()


def table_exists(spark: SparkSession, table_name: str) -> bool:
    """True if a (fully-qualified) relation exists.

    Delegates to silver.helpers.relation_exists (single implementation of the lazy
    `spark.read.table` analysis probe — spark.catalog.tableExists is a BLOCKED Py4J API in the
    DLT serverless environment). The `spark` parameter is kept for signature stability.
    """
    del spark  # one active session per run; the shared helper resolves it itself
    return _relation_exists(table_name)


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


def convert_uom(
    df: DataFrame,
    material_col: str,
    qty_col: str,
    from_uom_col: str,
    to_uom_col: str,
    output_col: str = "converted_qty",
) -> DataFrame:
    """Convert quantities between units of measure using the silver.material_uom_conversion table.

    Formula:
        converted_qty = qty * (from_factor / to_factor)
        where factors are the conversion factors to base UoM.
        If a factor is missing (i.e. not in MARM, which means it is already base UoM or unmapped),
        we default the factor to 1.0.

    Args:
        df: Input DataFrame.
        material_col: Name of column containing material codes.
        qty_col: Name of column containing source quantities to convert.
        from_uom_col: Name of column containing source UoM codes (e.g., 'CAR').
        to_uom_col: Name of column containing target UoM codes (e.g., 'KG').
        output_col: Name of the resulting converted quantity column.
    """
    from pyspark.sql import functions as F

    spark = df.sparkSession
    ss = get_silver_schema(spark)

    # Load conversion lookup table
    conv = spark.read.table(f"{ss}.material_uom_conversion")

    # 1. Join for "From UoM" conversion factor
    conv_from = conv.select(
        F.col("material_code").alias("_from_mat"),
        F.col("alternate_uom").alias("_from_uom"),
        F.col("conversion_factor_to_base").alias("from_factor"),
    )

    df_from = df.join(
        conv_from,
        (F.col(material_col) == F.col("_from_mat"))
        & (F.upper(F.trim(F.col(from_uom_col))) == F.col("_from_uom")),
        "left",
    ).drop("_from_mat", "_from_uom")

    # 2. Join for "To UoM" conversion factor
    conv_to = conv.select(
        F.col("material_code").alias("_to_mat"),
        F.col("alternate_uom").alias("_to_uom"),
        F.col("conversion_factor_to_base").alias("to_factor"),
    )

    df_to = df_from.join(
        conv_to,
        (F.col(material_col) == F.col("_to_mat"))
        & (F.upper(F.trim(F.col(to_uom_col))) == F.col("_to_uom")),
        "left",
    ).drop("_to_mat", "_to_uom")

    # 3. Load base UoM reference to identify unverified conversions
    # Material table is plant-scoped, so select distinct material_code/base_uom pairs
    mat_base = spark.read.table(f"{ss}.material").select(
        F.col("material_code").alias("_base_mat"), "base_uom"
    ).distinct()

    df_base = df_to.join(
        mat_base, F.col(material_col) == F.col("_base_mat"), "left"
    ).drop("_base_mat")

    # 4. Perform conversion logic with fallback safety
    # If factors are missing (left-join returns NULL), default to 1.0 to prevent null multiplication.
    # We flag unconvertible rows with a warning flag instead of nulling.
    result = (
        df_base.withColumn(
            output_col,
            F.col(qty_col)
            * (
                F.coalesce(F.col("from_factor"), F.lit(1.0))
                / F.coalesce(F.col("to_factor"), F.lit(1.0))
            ),
        )
        .withColumn(
            "is_uom_conversion_unverified",
            # A conversion is unverified if:
            # - The from_uom is not the base_uom, and its conversion factor is missing (NULL)
            # - OR the to_uom is not the base_uom, and its conversion factor is missing (NULL)
            # We also check if from_uom is equal to to_uom (which is always 1:1, so verified).
            F.when(
                F.upper(F.trim(F.col(from_uom_col))) == F.upper(F.trim(F.col(to_uom_col))),
                F.lit(False),
            ).otherwise(
                (
                    (~F.upper(F.trim(F.col(from_uom_col))).eqNullSafe(F.upper(F.trim(F.col("base_uom")))))
                    & F.col("from_factor").isNull()
                )
                | (
                    (~F.upper(F.trim(F.col(to_uom_col))).eqNullSafe(F.upper(F.trim(F.col("base_uom")))))
                    & F.col("to_factor").isNull()
                )
            ),
        )
        .drop("from_factor", "to_factor", "base_uom")
    )

    return result
