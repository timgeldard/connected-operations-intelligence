"""
Tests for gold_wm_adherence_root_cause (wm_operations_gold.py).

NOTE: Requires Spark/Java — runs in CI only.
"""

import datetime

import dlt
import pytest
from pyspark.sql import Row, SparkSession

from tests.conftest import all_rows, create_df


@pytest.fixture(scope="module", autouse=True)
def setup_adherence_root_cause(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver_adherence_rc")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver_adherence_rc")

    create_df(spark, [
        Row(plant_code="C061", material_code="FG1", material_description="Finished Good"),
    ]).write.mode("overwrite").saveAsTable("silver_adherence_rc.material")

    def _read(table_name):
        return spark.read.table(f"silver_adherence_rc.{table_name}")

    dlt.read.side_effect = _read

    yield

    dlt.read.side_effect = None
    spark.sql("DROP DATABASE IF EXISTS silver_adherence_rc CASCADE")


def _order(**kw):
    base = dict(
        plant_code="C061",
        order_number="900001",
        material_code="FG1",
        production_line="LINE_A",
        order_quantity=100.0,
        order_quantity_uom="KG",
        scheduled_start_date=datetime.date(2026, 6, 1),
        scheduled_finish_date=datetime.date(2026, 6, 10),
        actual_release_date=datetime.date(2026, 6, 1),
        actual_finish_date=datetime.date(2026, 6, 12),
    )
    base.update(kw)
    return Row(**base)


def _variance_row(**kw):
    base = dict(
        plant_code="C061",
        order_number="900001",
        material_code="RM1",
        material_name="Raw Mat",
        uom="KG",
        movement_type_code="261",
        required_qty=10.0,
        withdrawn_qty=0.0,
        issued_qty=5.0,
        variance_qty=-5.0,
        variance_pct=-0.5,
        est_loss_value=None,
        standard_price=None,
        is_final_issue=False,
    )
    base.update(kw)
    return Row(**base)


def _journey_row(**kw):
    base = dict(
        plant_code="C061",
        order_number="900001",
        production_first_actual_start=datetime.datetime(2026, 6, 3, 8, 0, 0),
    )
    base.update(kw)
    return Row(**base)


def _save(spark, rows, table):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(f"silver_adherence_rc.{table}")


def test_late_release_precedence(spark: SparkSession):
    from gold.wm_operations_gold import gold_wm_adherence_root_cause

    _save(spark, [
        _order(
            order_number="LATE_REL",
            actual_release_date=datetime.date(2026, 6, 3),  # after scheduled start
        ),
    ], "process_order")
    _save(spark, [_variance_row(order_number="LATE_REL")], "gold_wm_order_component_variance")
    _save(spark, [_journey_row(order_number="LATE_REL")], "gold_wm_order_journey_summary")

    rows = all_rows(gold_wm_adherence_root_cause())
    by_order = {r["order_number"]: r for r in rows}
    assert by_order["LATE_REL"]["root_cause_class"] == "LATE_RELEASE"
    assert by_order["LATE_REL"]["is_late_release"] is True


def test_material_short_when_release_on_time(spark: SparkSession):
    from gold.wm_operations_gold import gold_wm_adherence_root_cause

    _save(spark, [
        _order(
            order_number="MAT_SHORT",
            actual_release_date=datetime.date(2026, 5, 31),
        ),
    ], "process_order")
    _save(spark, [_variance_row(order_number="MAT_SHORT", variance_qty=-2.0)], "gold_wm_order_component_variance")
    _save(spark, [_journey_row(order_number="MAT_SHORT")], "gold_wm_order_journey_summary")

    row = all_rows(gold_wm_adherence_root_cause())[0]
    assert row["root_cause_class"] == "MATERIAL_SHORT"
    assert row["has_material_short"] is True


def test_capacity_when_no_short_and_release_on_time(spark: SparkSession):
    from gold.wm_operations_gold import gold_wm_adherence_root_cause

    _save(spark, [
        _order(
            order_number="CAPACITY",
            actual_release_date=datetime.date(2026, 6, 1),
        ),
    ], "process_order")
    _save(spark, [_variance_row(order_number="CAPACITY", variance_qty=0.0)], "gold_wm_order_component_variance")
    _save(spark, [
        _journey_row(
            order_number="CAPACITY",
            production_first_actual_start=datetime.datetime(2026, 6, 5, 8, 0, 0),
        ),
    ], "gold_wm_order_journey_summary")

    row = all_rows(gold_wm_adherence_root_cause())[0]
    assert row["root_cause_class"] == "CAPACITY"
    assert row["release_to_production_hours"] > 24.0


def test_unclassified_fallback(spark: SparkSession):
    from gold.wm_operations_gold import gold_wm_adherence_root_cause

    _save(spark, [
        _order(
            order_number="UNCLASS",
            actual_release_date=datetime.date(2026, 6, 1),
        ),
    ], "process_order")
    _save(spark, [_variance_row(order_number="UNCLASS", variance_qty=0.0)], "gold_wm_order_component_variance")
    _save(spark, [
        _journey_row(
            order_number="UNCLASS",
            production_first_actual_start=datetime.datetime(2026, 6, 1, 12, 0, 0),
        ),
    ], "gold_wm_order_journey_summary")

    row = all_rows(gold_wm_adherence_root_cause())[0]
    assert row["root_cause_class"] == "UNCLASSIFIED"


def test_open_late_candidate_with_null_finish_date(spark: SparkSession):
    """Open orders (actual_finish_date IS NULL) remain miss candidates for query-time is_open_late."""
    from gold.wm_operations_gold import gold_wm_adherence_root_cause

    _save(spark, [
        _order(
            order_number="OPEN_LATE",
            scheduled_finish_date=datetime.date(2026, 6, 10),
            actual_finish_date=None,
        ),
    ], "process_order")
    _save(spark, [_variance_row(order_number="OPEN_LATE", variance_qty=0.0)], "gold_wm_order_component_variance")
    _save(spark, [
        _journey_row(
            order_number="OPEN_LATE",
            production_first_actual_start=datetime.datetime(2026, 6, 2, 8, 0, 0),
        ),
    ], "gold_wm_order_journey_summary")

    row = all_rows(gold_wm_adherence_root_cause())[0]
    assert row["order_number"] == "OPEN_LATE"
    assert row["actual_finish_date"] is None
    assert row["root_cause_class"] == "UNCLASSIFIED"
