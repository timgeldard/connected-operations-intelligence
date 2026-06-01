from pyspark.sql import Column, SparkSession
from pyspark.sql import functions as F


def get_spark() -> SparkSession:
    return SparkSession.builder.getOrCreate()

spark = get_spark()
source_catalog = spark.conf.get("source_catalog", None)
source_schema = spark.conf.get("source_schema", None)
if not source_catalog:
    raise ValueError("source_catalog configuration must be set in the Spark session.")
if not source_schema:
    raise ValueError("source_schema configuration must be set in the Spark session.")
BRONZE = f"{source_catalog}.{source_schema}"


def bronze_published() -> str:
    """Second bronze source for cross-application master data (plant T001W,
    customer KNA1) that lives in the published / central_services catalog rather
    than the SAP source. Read lazily so pipelines that do not use it (fast,
    quality) are not required to configure published_catalog/published_schema."""
    catalog = spark.conf.get("published_catalog", None)
    schema = spark.conf.get("published_schema", None)
    if not catalog or not schema:
        raise ValueError(
            "published_catalog and published_schema must be set to read the "
            "published (central_services) source."
        )
    return f"{catalog}.{schema}"


# AUFK.AUTYP order category for PP-PI process orders. Verified against live
# connected_plant_uat.sap: process orders are AUTYP='40' (AUART ZI01/ZI02/ZI05/...);
# AUTYP='10' returns zero rows in Kerry's config.
PP_PI_ORDER_CATEGORY = "40"
# Optional AUART allowlist to further narrow within AUTYP='40'
# (e.g. ("ZI01", "ZI02", "ZI05")). None = keep all AUTYP='40' process orders.
PP_PI_ORDER_TYPES = None

# TODO: Review Aecorsoft functionality to apply rules directly to fields at replication
# time (e.g. zero-stripping, date-casting). Shifting these transformations to the
# replication layer can avoid post-ingestion Spark processing overhead and reduce
# hidden compute/storage costs.
def strip_zeros(col_name: str) -> Column:
    """Apply SAP ALPHA-style leading-zero removal for numeric identifiers."""
    value = F.trim(F.col(col_name).cast("string"))
    stripped = F.regexp_replace(value, r"^0+", "")
    return (
        F.when(value.isNull() | (value == ""), None)
        .when(value.rlike(r"^[0-9]+$"), F.when(stripped == "", None).otherwise(stripped))
        .otherwise(value)
    )

def sap_date(col_name: str) -> Column:
    """Cast SAP YYYYMMDD string to DATE. Returns NULL for SAP sentinel '00000000' or blank."""
    normalized = F.trim(F.col(col_name).cast("string"))
    return F.try_to_timestamp(
        F.when(normalized.isNull() | (normalized == "") | (normalized == "00000000"), None)
        .otherwise(normalized),
        F.lit("yyyyMMdd"),
    ).cast("date")

def sap_datetime(date_col: str, time_col: str) -> Column:
    """Combine SAP YYYYMMDD date + HHMMSS time strings into TIMESTAMP. Returns NULL if either part is blank."""
    return F.try_to_timestamp(
        F.concat(F.col(date_col), F.lpad(F.col(time_col), 6, "0")),
        F.lit("yyyyMMddHHmmss"),
    )

def sap_flag(col_name: str) -> Column:
    """Convert SAP 'X' / blank flag to boolean."""
    return F.coalesce(F.col(col_name) == "X", F.lit(False))
