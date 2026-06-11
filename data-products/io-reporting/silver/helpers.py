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


def relation_exists(fq_name: str) -> bool:
    """True if a (fully-qualified) table/view exists, safe to call anywhere in pipeline code.

    Uses a lazy `spark.read.table` analysis probe rather than `spark.catalog.tableExists`, which is
    a BLOCKED Py4J API in the DLT serverless graph-construction environment (PY4J_BLOCKED_API).
    `read.table` resolves the relation (metadata only, no Spark job) and raises if it is absent.
    Self-healing: returns True automatically once the relation exists.
    """
    try:
        get_spark().read.table(fq_name)
        return True
    except Exception:  # noqa: BLE001 - missing relation is a normal bootstrap condition
        return False


def bronze_table_exists(name: str) -> bool:
    """True if a bronze SAP source table exists, safe to call at module-eval to conditionally
    define a DLT table. See relation_exists for why this avoids spark.catalog.tableExists."""
    return relation_exists(f"{BRONZE}.{name}")


def published_columns_exist(name: str, columns) -> bool:
    """True only if published (central_services) table `name` exists AND carries every column.

    Same lazy-probe rationale as bronze_columns_exist. Defensive on configuration: pipelines that
    do not set published_catalog/published_schema (e.g. the fast tier) get False rather than a
    raised error, so a shared module import can never fail on a missing conf."""
    try:
        present = set(get_spark().read.table(f"{bronze_published()}.{name}").columns)
    except Exception:  # noqa: BLE001 - missing source/conf is a normal bootstrap condition
        return False
    return all(c in present for c in columns)


def bronze_columns_exist(name: str, columns) -> bool:
    """True only if bronze SAP table `name` exists AND contains every column in `columns`.

    Same lazy-probe rationale as relation_exists (spark.catalog.tableExists is blocked at DLT
    graph-construction). For source-guarding models that reference SAP columns not guaranteed to be
    replicated in every environment. Self-healing once the columns are replicated. Reading `.columns`
    only inspects the resolved schema (no Spark job).
    """
    try:
        present = set(get_spark().read.table(f"{BRONZE}.{name}").columns)
    except Exception:  # noqa: BLE001 - missing source is a normal bootstrap condition
        return False
    return all(c in present for c in columns)


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

# SAP "initial" date sentinels across both replication formats.
_SAP_NULL_DATES = ("", "00000000", "0000-00-00")


def sap_date(col_name: str) -> Column:
    """Cast a SAP date string to DATE, tolerating BOTH replication formats.

    Aecorsoft delivers compact DATS ('yyyyMMdd') on some tables and ISO
    ('yyyy-MM-dd') on others (verified live in connected_plant_uat 2026-06-10:
    AUFK/AFKO/LTBK dates arrive as '2026-04-01'; the compact-only parser returned
    NULL for 100% of process_order and transfer-requirement dates). Returns NULL
    for the SAP initial sentinels ('00000000' / '0000-00-00') and blank.
    """
    normalized = F.trim(F.col(col_name).cast("string"))
    cleaned = F.when(
        normalized.isNull() | normalized.isin(*_SAP_NULL_DATES), None
    ).otherwise(normalized)
    return F.coalesce(
        F.try_to_timestamp(cleaned, F.lit("yyyyMMdd")),
        F.try_to_timestamp(cleaned, F.lit("yyyy-MM-dd")),
    ).cast("date")

def sap_datetime(date_col: str, time_col: str) -> Column:
    """Combine SAP date + time strings into TIMESTAMP, tolerating BOTH replication
    formats: compact ('yyyyMMdd' + 'HHmmss') and ISO ('yyyy-MM-dd' + 'HH:mm:ss').
    Returns NULL when the date part is blank/initial or either part fails to parse."""
    date_normalized = F.trim(F.col(date_col).cast("string"))
    date_cleaned = F.when(
        date_normalized.isNull() | date_normalized.isin(*_SAP_NULL_DATES), None
    ).otherwise(date_normalized)
    time_normalized = F.trim(F.col(time_col).cast("string"))
    return F.coalesce(
        F.try_to_timestamp(
            F.concat(date_cleaned, F.lpad(time_normalized, 6, "0")),
            F.lit("yyyyMMddHHmmss"),
        ),
        F.try_to_timestamp(
            F.concat_ws(" ", date_cleaned, time_normalized),
            F.lit("yyyy-MM-dd HH:mm:ss"),
        ),
    )

def sap_flag(col_name: str) -> Column:
    """Convert SAP 'X' / blank flag to boolean."""
    return F.coalesce(F.col(col_name) == "X", F.lit(False))
