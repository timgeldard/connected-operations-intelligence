from pyspark.sql import Column, Row, SparkSession
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

def strip_zeros(col_name: str) -> Column:
    """Remove SAP database-level leading zeros from key identifier fields."""
    return F.regexp_replace(F.col(col_name), r"^0+", "")

def sap_date(col_name: str) -> Column:
    """Cast SAP YYYYMMDD string to DATE. Returns NULL for SAP sentinel '00000000' or blank."""
    return F.try_to_date(F.col(col_name), "yyyyMMdd")

def sap_datetime(date_col: str, time_col: str) -> Column:
    """Combine SAP YYYYMMDD date + HHMMSS time strings into TIMESTAMP. Returns NULL if either part is blank."""
    return F.try_to_timestamp(
        F.concat(F.col(date_col), F.lpad(F.col(time_col), 6, "0")),
        F.lit("yyyyMMddHHmmss"),
    )

def sap_flag(col_name: str) -> Column:
    """Convert SAP 'X' / blank flag to boolean."""
    return F.coalesce(F.col(col_name) == "X", F.lit(False))
