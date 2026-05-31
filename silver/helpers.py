from pyspark.sql import Column, SparkSession
from pyspark.sql import functions as F


def get_spark() -> SparkSession:
    return SparkSession.builder.getOrCreate()

try:
    spark = get_spark()
    BRONZE = (
        f"{spark.conf.get('source_catalog', 'connected_plant_prod')}"
        f".{spark.conf.get('source_schema', 'sap')}"
    )
except Exception:
    BRONZE = "connected_plant_prod.sap"

PP_PI_ORDER_TYPES = None
PP_PI_ORDER_CATEGORY = "10"

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
