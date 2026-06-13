"""
Unit tests for conformed Gold shared helper functions (convert_uom).
"""

import pytest
from pyspark.sql import Row, SparkSession

from gold._shared import convert_uom
from tests.conftest import all_rows


@pytest.fixture(scope="module", autouse=True)
def setup_uom_databases(spark: SparkSession):
    # Use spark_catalog/silver for test consistency
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")

    # Mock material_uom_conversion (from MARM)
    conversion_data = [
        Row(material_code="MAT01", alternate_uom="CAR", conversion_factor_to_base=25.0),
        Row(material_code="MAT01", alternate_uom="PAL", conversion_factor_to_base=250.0),
        Row(material_code="MAT02", alternate_uom="BAG", conversion_factor_to_base=5.0),
    ]
    spark.createDataFrame(conversion_data).write.mode("overwrite").saveAsTable(
        "silver.material_uom_conversion"
    )

    # Mock material (which defines base_uom)
    material_data = [
        Row(material_code="MAT01", base_uom="KG"),
        Row(material_code="MAT02", base_uom="EA"),
        Row(material_code="MAT03", base_uom=None),
    ]
    spark.createDataFrame(material_data).write.mode("overwrite").saveAsTable("silver.material")

    yield
    spark.sql("DROP DATABASE IF EXISTS silver CASCADE")


def test_convert_uom_alt_to_alt(spark: SparkSession):
    # Case: convert 10.0 CAR -> PAL for MAT01. Conversion: 10 * 25.0 / 250.0 = 1.0 PAL
    input_df = spark.createDataFrame(
        [Row(material="MAT01", quantity=10.0, unit_from="CAR", unit_to="PAL")]
    )

    result_df = convert_uom(
        input_df,
        material_col="material",
        qty_col="quantity",
        from_uom_col="unit_from",
        to_uom_col="unit_to",
        output_col="converted",
    )

    rows = all_rows(result_df)
    assert len(rows) == 1
    assert rows[0]["converted"] == pytest.approx(1.0)
    assert rows[0]["is_uom_conversion_unverified"] is False


def test_convert_uom_alt_to_base(spark: SparkSession):
    # Case: convert 10.0 CAR -> KG (Base) for MAT01. Conversion: 10 * 25.0 / 1.0 = 250.0 KG
    input_df = spark.createDataFrame(
        [Row(material="MAT01", quantity=10.0, unit_from="CAR", unit_to="KG")]
    )

    result_df = convert_uom(
        input_df,
        material_col="material",
        qty_col="quantity",
        from_uom_col="unit_from",
        to_uom_col="unit_to",
        output_col="converted",
    )

    rows = all_rows(result_df)
    assert len(rows) == 1
    assert rows[0]["converted"] == pytest.approx(250.0)
    assert rows[0]["is_uom_conversion_unverified"] is False


def test_convert_uom_base_to_alt(spark: SparkSession):
    # Case: convert 250.0 KG (Base) -> CAR for MAT01. Conversion: 250 * 1.0 / 25.0 = 10.0 CAR
    input_df = spark.createDataFrame(
        [Row(material="MAT01", quantity=250.0, unit_from="KG", unit_to="CAR")]
    )

    result_df = convert_uom(
        input_df,
        material_col="material",
        qty_col="quantity",
        from_uom_col="unit_from",
        to_uom_col="unit_to",
        output_col="converted",
    )

    rows = all_rows(result_df)
    assert len(rows) == 1
    assert rows[0]["converted"] == pytest.approx(10.0)
    assert rows[0]["is_uom_conversion_unverified"] is False


def test_convert_uom_same_units(spark: SparkSession):
    # Case: convert 15.0 CAR -> CAR for MAT01. No change: 15.0 CAR
    input_df = spark.createDataFrame(
        [Row(material="MAT01", quantity=15.0, unit_from="CAR", unit_to="CAR")]
    )

    result_df = convert_uom(
        input_df,
        material_col="material",
        qty_col="quantity",
        from_uom_col="unit_from",
        to_uom_col="unit_to",
        output_col="converted",
    )

    rows = all_rows(result_df)
    assert len(rows) == 1
    assert rows[0]["converted"] == pytest.approx(15.0)
    assert rows[0]["is_uom_conversion_unverified"] is False


def test_convert_uom_unverified_missing_factor(spark: SparkSession):
    # Case: convert 10.0 BAG -> PAL for MAT01 (where BAG is not a registered alternate unit for MAT01)
    input_df = spark.createDataFrame(
        [Row(material="MAT01", quantity=10.0, unit_from="BAG", unit_to="PAL")]
    )

    result_df = convert_uom(
        input_df,
        material_col="material",
        qty_col="quantity",
        from_uom_col="unit_from",
        to_uom_col="unit_to",
        output_col="converted",
    )

    rows = all_rows(result_df)
    assert len(rows) == 1
    # from_factor is missing (default 1.0), to_factor is 250.0: 10.0 * 1.0 / 250.0 = 0.04
    assert rows[0]["converted"] == pytest.approx(0.04)
    assert rows[0]["is_uom_conversion_unverified"] is True


def test_convert_uom_different_material_col(spark: SparkSession):
    # Case: check using a different material column name (e.g. material_code)
    input_df = spark.createDataFrame(
        [Row(material_code="MAT01", quantity=10.0, unit_from="CAR", unit_to="PAL")]
    )

    result_df = convert_uom(
        input_df,
        material_col="material_code",
        qty_col="quantity",
        from_uom_col="unit_from",
        to_uom_col="unit_to",
        output_col="converted",
    )

    rows = all_rows(result_df)
    assert len(rows) == 1
    assert rows[0]["converted"] == pytest.approx(1.0)
    assert rows[0]["is_uom_conversion_unverified"] is False


def test_convert_uom_missing_base_uom(spark: SparkSession):
    # Case: MAT03 has base_uom = None in material table; MAT04 is completely missing from material table
    input_df = spark.createDataFrame(
        [
            Row(material="MAT03", quantity=10.0, unit_from="CAR", unit_to="PAL"),
            Row(material="MAT04", quantity=10.0, unit_from="CAR", unit_to="PAL"),
        ]
    )

    result_df = convert_uom(
        input_df,
        material_col="material",
        qty_col="quantity",
        from_uom_col="unit_from",
        to_uom_col="unit_to",
        output_col="converted",
    )

    rows = all_rows(result_df)
    assert len(rows) == 2

    # MAT03: from_factor is NULL (1.0), to_factor is NULL (1.0). Converted = 10.0.
    # base_uom is None. eqNullSafe checks if "CAR" (from_uom) == base_uom (None), which returns False,
    # so ~False = True, and from_factor is null, so it triggers is_uom_conversion_unverified = True.
    assert rows[0]["converted"] == pytest.approx(10.0)
    assert rows[0]["is_uom_conversion_unverified"] is True

    # MAT04: Same, since it's not in the material table at all, base_uom becomes NULL from left join.
    assert rows[1]["converted"] == pytest.approx(10.0)
    assert rows[1]["is_uom_conversion_unverified"] is True

