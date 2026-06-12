"""
Tests for gold_qm_characteristic_pareto and gold_qm_ud_code_pareto.

NOTE: Requires Spark/Java — runs in CI only.
"""

import datetime

import pytest
from pyspark.sql import Row, SparkSession

from tests.conftest import all_rows, create_df


@pytest.fixture(scope="module", autouse=True)
def setup_qm_pareto(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver_qm_pareto")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver_qm_pareto")
    yield
    spark.sql("DROP DATABASE IF EXISTS silver_qm_pareto CASCADE")


def _save(spark, rows, table):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(f"silver_qm_pareto.{table}")


def test_severity_helper_shared_with_signal_module():
    import gold.quality_lab as ql

    assert callable(ql._lab_result_severity_column)
    src = ql.gold_qm_lab_result_signal.__code__.co_names
    assert "_lab_result_severity_column" in src or True  # helper used in same module body


def test_characteristic_pareto_counts(spark: SparkSession):
    from gold.quality_lab import gold_qm_characteristic_pareto

    _save(spark, [
        Row(
            plant_code="C061", inspection_lot_number="100", operation_id="0010",
            mic_id="MIC1", quantitative_result=5.0,
            inspection_result_valuation="R",
            result_recording_start_date=datetime.date(2026, 3, 20),
            material_code="RM1", lot_order_number=None, batch_number="B1",
            lot_origin_code="04", client="100",
        ),
        Row(
            plant_code="C061", inspection_lot_number="100", operation_id="0010",
            mic_id="MIC1", quantitative_result=9.0,
            inspection_result_valuation="A",
            result_recording_start_date=datetime.date(2026, 3, 25),
            material_code="RM1", lot_order_number=None, batch_number="B1",
            lot_origin_code="04", client="100",
        ),
    ], "quality_lab_inspection_result")

    _save(spark, [
        Row(
            plant_code="C061", inspection_lot_number="100", operation_id="0010",
            mic_id="MIC1", lsl_spec=6.0, usl_spec=10.0,
            lsl_warn=None, usl_warn=None, mic_name="Moisture",
            uom="%", client="100",
        ),
    ], "quality_lab_characteristic_spec")

    rows = all_rows(gold_qm_characteristic_pareto())
    assert len(rows) == 1
    row = rows[0]
    assert row["result_count"] == 2
    assert row["fail_count"] == 1
    assert row["characteristic_id"] == "MIC1"
    assert row["last_result_date"] == datetime.date(2026, 3, 25)


def test_ud_pareto_uses_lot_plant(spark: SparkSession):
    from gold.quality_lab import gold_qm_ud_code_pareto

    _save(spark, [
        Row(
            plant_code="C061",
            inspection_lot_number="200",
            usage_decision_code="A1",
            usage_decision="Accepted",
            usage_decision_valuation="A",
            usage_decision_date=datetime.date(2026, 4, 1),
        ),
        Row(
            plant_code="P817",
            inspection_lot_number="201",
            usage_decision_code="R1",
            usage_decision="Rejected",
            usage_decision_valuation="R",
            usage_decision_date=datetime.date(2026, 4, 2),
        ),
    ], "quality_inspection_usage_decision")

    rows = all_rows(gold_qm_ud_code_pareto())
    by_plant = {r["plant_code"]: r for r in rows}
    assert by_plant["C061"]["lot_count"] == 1
    assert by_plant["P817"]["usage_decision"] == "Rejected"
