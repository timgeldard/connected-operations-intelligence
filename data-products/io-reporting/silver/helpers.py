from pyspark.sql import Column, SparkSession
from pyspark.sql import functions as F


def get_spark() -> SparkSession:
    return SparkSession.builder.getOrCreate()


class BronzePath:
    def __str__(self) -> str:
        spark = get_spark()
        source_catalog = spark.conf.get("source_catalog", None)
        source_schema = spark.conf.get("source_schema", None)
        if not source_catalog:
            raise ValueError("source_catalog configuration must be set in the Spark session.")
        if not source_schema:
            raise ValueError("source_schema configuration must be set in the Spark session.")
        return f"{source_catalog}.{source_schema}"

    def __repr__(self) -> str:
        return self.__str__()


BRONZE = BronzePath()


def bronze_published() -> str:
    """Second bronze source for cross-application master data (plant T001W,
    customer KNA1) that lives in the published / central_services catalog rather
    than the SAP source. Read lazily so pipelines that do not use it (fast,
    quality) are not required to configure published_catalog/published_schema."""
    spark = get_spark()
    catalog = spark.conf.get("published_catalog", None)
    schema = spark.conf.get("published_schema", None)
    if not catalog or not schema:
        raise ValueError(
            "published_catalog and published_schema must be set to read the "
            "published (central_services) source."
        )
    return f"{catalog}.{schema}"


def bronze_table_exists(name: str) -> bool:
    """True if a bronze SAP source table exists, safe to call at module-eval to conditionally
    define a DLT table.

    Uses a lazy `spark.read.table` analysis probe rather than `spark.catalog.tableExists`, which is
    a BLOCKED Py4J API in the DLT serverless graph-construction environment (PY4J_BLOCKED_API).
    `read.table` resolves the relation (metadata only, no Spark job) and raises if it is absent.
    Self-healing: returns True automatically once the source table is replicated.
    """
    try:
        get_spark().read.table(f"{BRONZE}.{name}")
        return True
    except Exception:  # noqa: BLE001 - missing source is a normal bootstrap condition
        return False


def col_or_null(df, name: str, dtype: str, alias_prefix: str | None = None) -> Column:
    """Reference a source column when it is present, else a typed NULL.

    Use for OPTIONAL source columns that are not guaranteed to be replicated in every
    environment, so a missing column degrades to a typed NULL instead of failing the run with
    UNRESOLVED_COLUMN. Self-healing: when the column is later replicated it is used automatically.
    Does NOT change business meaning — never substitute a different field. `dtype` is a Spark DDL
    type string (e.g. "string", "double") used only for the NULL branch.
    """
    if name in df.columns:
        return F.col(f"{alias_prefix}.{name}" if alias_prefix else name)
    return F.lit(None).cast(dtype)


def hu_reconciliation_enabled() -> bool:
    """Whether handling-unit (HU) models should be materialised.

    Gated by the `enable_hu_reconciliation` Spark conf (set from the bundle variable;
    see databricks.yml). In `dev_shakedown` mode this is false because the externally
    owned `published_dev.central_services` is missing handlingunit_vekp/vepo — so the
    HU silver/gold models are not defined rather than failing the run. UAT/PROD
    (`full_validation`) set it true. Defaults to true so a missing conf never silently
    drops HU in a real environment.
    """
    spark = get_spark()
    return str(spark.conf.get("enable_hu_reconciliation", "true")).strip().lower() == "true"


def deployment_mode() -> str:
    """`dev_shakedown` or `full_validation` (Spark conf, from the bundle variable)."""
    return str(get_spark().conf.get("deployment_mode", "full_validation")).strip().lower()


# AUFK.AUTYP order category for PP-PI process orders. Verified against live
# connected_plant_uat.sap: process orders are AUTYP='40' (AUART ZI01/ZI02/ZI05/...);
# AUTYP='10' returns zero rows in Kerry's config.
PP_PI_ORDER_CATEGORY = "40"
# Optional AUART allowlist to further narrow within AUTYP='40'
# (e.g. ("ZI01", "ZI02", "ZI05")). None = keep all AUTYP='40' process orders.
PP_PI_ORDER_TYPES = None

# Process-line characteristic (classification path AFKO→INOB→AUSP→CAWNT). The 018/PLKO recipe
# classification may carry several characteristics; set this to the internal characteristic id
# (AUSP/CABN-ATINN) of the process-line characteristic to select it unambiguously. None = take the
# (single) characteristic present — confirm against live AUSP/CABN before relying on it.
PROCESS_LINE_ATINN = None

# TODO: Review Aecorsoft functionality to apply rules directly to fields at replication
# time (e.g. zero-stripping, date-casting). Shifting these transformations to the
# replication layer can avoid post-ingestion Spark processing overhead and reduce
# hidden compute/storage costs.
def strip_zeros(col: "str | Column") -> Column:
    """Apply SAP ALPHA-style leading-zero removal for numeric identifiers.

    Accepts either a column name (str, wrapped with F.col) or a pyspark Column used directly,
    so callers can pass an expression such as strip_zeros(F.coalesce(F.col("i.EBELN"), ...)).
    Passing a Column to F.col previously raised NOT_ITERABLE. Semantics are unchanged for the
    str case: NULL/blank -> NULL; all-zero -> NULL; numeric strings have leading zeros stripped;
    non-numeric values pass through unchanged.
    """
    column = F.col(col) if isinstance(col, str) else col
    value = F.trim(column.cast("string"))
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
