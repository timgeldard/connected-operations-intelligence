"""
Tests for the repo-owned dimension silver transforms: plant, customer, storage_type.

Mirrors the select logic in silver/tables/reference.py (the established silver-test
pattern — replicate the transform on fabricated bronze rows and assert), avoiding a
live DLT/Databricks runtime.

Business rules under test:
  - plant (T001W) and customer (KNA1) come from the published/central_services source
  - Customer/plant SAP numeric keys are zero-stripped, with a raw pair retained where used
  - storage_type joins T301 + T301T and keeps English descriptions only
"""

from typing import List

from pyspark.sql import DataFrame, Row, SparkSession
from pyspark.sql import functions as F

from silver.helpers import strip_zeros
from tests.conftest import all_rows, first_row

# ── Plant (T001W) ─────────────────────────────────────────────────────────────

_T001W_SCHEMA = (
    "WERKS STRING, NAME1 STRING, NAME2 STRING, ORT01 STRING, LAND1 STRING, "
    "REGIO STRING, BWKEY STRING, EKORG STRING, VKORG STRING, SPART STRING, "
    "KUNNR STRING, LIFNR STRING, AEDATTM STRING"
)


def apply_plant_transform(spark: SparkSession, rows: List[Row]) -> DataFrame:
    src = spark.createDataFrame(rows, _T001W_SCHEMA)
    return src.select(
        F.col("WERKS").alias("plant_code"),
        F.col("NAME1").alias("plant_name"),
        F.col("NAME2").alias("plant_name_2"),
        F.col("ORT01").alias("city"),
        F.col("LAND1").alias("country_key"),
        F.col("REGIO").alias("region_code"),
        F.col("BWKEY").alias("valuation_area"),
        F.col("EKORG").alias("purchasing_org"),
        F.col("VKORG").alias("sales_org"),
        F.col("SPART").alias("division"),
        strip_zeros("KUNNR").alias("plant_customer_number"),
        strip_zeros("LIFNR").alias("plant_vendor_number"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


def _t001w(**kw) -> Row:
    base = dict(
        WERKS="C061", NAME1="Mozzo Plant", NAME2="", ORT01="Mozzo", LAND1="IT",
        REGIO="BG", BWKEY="C061", EKORG="IT01", VKORG="IT01", SPART="00",
        KUNNR="0000054321", LIFNR="0000098765", AEDATTM="2024-12-01T10:00:00",
    )
    base.update(kw)
    return Row(**base)


class TestPlantDimension:
    def test_plant_code_and_name(self, spark):
        row = first_row(apply_plant_transform(spark, [_t001w()]))
        assert row["plant_code"] == "C061"
        assert row["plant_name"] == "Mozzo Plant"
        assert row["valuation_area"] == "C061"

    def test_plant_org_assignments(self, spark):
        row = first_row(apply_plant_transform(spark, [_t001w(VKORG="IT02", SPART="10")]))
        assert row["sales_org"] == "IT02"
        assert row["division"] == "10"

    def test_plant_customer_vendor_numbers_stripped(self, spark):
        row = first_row(apply_plant_transform(spark, [_t001w(KUNNR="0000054321", LIFNR="0000098765")]))
        assert row["plant_customer_number"] == "54321"
        assert row["plant_vendor_number"] == "98765"


# ── Customer (KNA1) ───────────────────────────────────────────────────────────

_KNA1_SCHEMA = (
    "KUNNR STRING, NAME1 STRING, NAME2 STRING, ORT01 STRING, LAND1 STRING, "
    "REGIO STRING, PSTLZ STRING, STRAS STRING, AEDATTM STRING"
)


def apply_customer_transform(spark: SparkSession, rows: List[Row]) -> DataFrame:
    src = spark.createDataFrame(rows, _KNA1_SCHEMA)
    return src.select(
        strip_zeros("KUNNR").alias("customer_code"),
        F.col("KUNNR").alias("customer_code_raw"),
        F.col("NAME1").alias("customer_name"),
        F.col("NAME2").alias("customer_name_2"),
        F.col("ORT01").alias("city"),
        F.col("LAND1").alias("country_key"),
        F.col("REGIO").alias("region_code"),
        F.col("PSTLZ").alias("postal_code"),
        F.col("STRAS").alias("street"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


def _kna1(**kw) -> Row:
    base = dict(
        KUNNR="0000012345", NAME1="ACME Foods", NAME2="", ORT01="Dublin",
        LAND1="IE", REGIO="D", PSTLZ="D01", STRAS="Main St",
        AEDATTM="2024-12-01T10:00:00",
    )
    base.update(kw)
    return Row(**base)


class TestCustomerDimension:
    def test_customer_code_stripped_with_raw_pair(self, spark):
        row = first_row(apply_customer_transform(spark, [_kna1(KUNNR="0000012345")]))
        assert row["customer_code"] == "12345"
        assert row["customer_code_raw"] == "0000012345"

    def test_customer_name_and_country(self, spark):
        row = first_row(apply_customer_transform(spark, [_kna1(NAME1="ACME Foods", LAND1="IE")]))
        assert row["customer_name"] == "ACME Foods"
        assert row["country_key"] == "IE"


# ── Storage type (T301 + T301T) ───────────────────────────────────────────────

_T301_SCHEMA = "MANDT STRING, LGNUM STRING, LGTYP STRING, AEDATTM STRING"
_T301T_SCHEMA = "MANDT STRING, SPRAS STRING, LGNUM STRING, LGTYP STRING, LTYPT STRING, AEDATTM STRING"


def apply_storage_type_transform(
    spark: SparkSession, t301_rows: List[Row], t301t_rows: List[Row]
) -> DataFrame:
    t301 = spark.createDataFrame(t301_rows, _T301_SCHEMA)
    t301t = spark.createDataFrame(t301t_rows, _T301T_SCHEMA).filter(F.col("SPRAS") == "E")
    return (
        t301.alias("s")
        .join(t301t.alias("t"), ["LGNUM", "LGTYP", "MANDT"], "left")
        .select(
            F.col("s.LGNUM").alias("warehouse_number"),
            F.col("s.LGTYP").alias("storage_type"),
            F.col("t.LTYPT").alias("storage_type_description"),
            F.col("s.AEDATTM").alias("_replicated_at"),
        )
    )


class TestStorageTypeDimension:
    def test_description_joined_english_only(self, spark):
        t301 = [Row(MANDT="100", LGNUM="208", LGTYP="100", AEDATTM="2024-12-01T10:00:00")]
        t301t = [
            Row(MANDT="100", SPRAS="E", LGNUM="208", LGTYP="100", LTYPT="Production Supply Area", AEDATTM="x"),
            Row(MANDT="100", SPRAS="D", LGNUM="208", LGTYP="100", LTYPT="Produktionsversorgung", AEDATTM="x"),
        ]
        rows = all_rows(apply_storage_type_transform(spark, t301, t301t))
        assert len(rows) == 1
        assert rows[0]["warehouse_number"] == "208"
        assert rows[0]["storage_type"] == "100"
        assert rows[0]["storage_type_description"] == "Production Supply Area"

    def test_storage_type_without_description_retained(self, spark):
        t301 = [Row(MANDT="100", LGNUM="208", LGTYP="801", AEDATTM="2024-12-01T10:00:00")]
        rows = all_rows(apply_storage_type_transform(spark, t301, []))
        assert len(rows) == 1
        assert rows[0]["storage_type"] == "801"
        assert rows[0]["storage_type_description"] is None
