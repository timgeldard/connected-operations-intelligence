"""
Tests for shortage projection Gold tables:
  - gold_wm_supply_demand_ledger
  - gold_wm_order_shortage_projection

NOTE: Requires Spark/Java — runs in CI only.
"""

import datetime

import dlt
import pytest
from pyspark.sql import Row, SparkSession

from tests.conftest import all_rows, create_df


@pytest.fixture(scope="module", autouse=True)
def setup_shortage(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver_shortage")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver_shortage")

    create_df(spark, [
        Row(plant_code="C061", material_code="RM1", material_description="Raw Material One"),
    ]).write.mode("overwrite").saveAsTable("silver_shortage.material")

    yield

    dlt.read.side_effect = None
    spark.sql("DROP DATABASE IF EXISTS silver_shortage CASCADE")


def _save(spark, rows, table):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(f"silver_shortage.{table}")


def _order(**kw):
    base = dict(
        plant_code="C061",
        order_number="900001",
        material_code="FG1",
        production_line="LINE_A",
        scheduled_start_date=datetime.date(2026, 6, 10),
        scheduled_finish_date=datetime.date(2026, 6, 12),
        actual_release_date=datetime.date(2026, 6, 1),
        actual_finish_date=None,
        is_released=False,
        is_completed=False,
        is_closed=False,
    )
    base.update(kw)
    return Row(**base)


def _reservation(**kw):
    base = dict(
        plant_code="C061",
        order_number="900001",
        material_code="RM1",
        reservation_number="100",
        reservation_item="1",
        movement_type_code="261",
        requirement_date=datetime.date(2026, 6, 10),
        required_quantity=50.0,
        withdrawn_quantity=0.0,
        open_quantity=50.0,
        base_uom="KG",
        is_deletion_flagged=False,
    )
    base.update(kw)
    return Row(**base)


def _received_delivery():
    return Row(
        plant_code="C061",
        material_code="RM1",
        delivery_number="800000",
        item_number="10",
        delivery_type="EL",
        planned_goods_issue_date=datetime.date(2026, 6, 1),
        actual_goods_issue_date=datetime.date(2026, 6, 1),
        delivery_quantity_base=10.0,
        actual_delivered_base_quantity=10.0,
        base_uom="KG",
    )


def _stock(**kw):
    base = dict(
        plant_code="C061",
        material_code="RM1",
        unrestricted_quantity=100.0,
        base_uom="KG",
    )
    base.update(kw)
    return Row(**base)


def _run_projection(spark: SparkSession):
    from gold.wm_operations_gold import (
        gold_wm_order_shortage_projection,
        gold_wm_supply_demand_ledger,
    )

    ledger_df = gold_wm_supply_demand_ledger()
    ledger_df.write.mode("overwrite").saveAsTable("silver_shortage.gold_wm_supply_demand_ledger")
    dlt.read.side_effect = lambda name: spark.read.table(f"silver_shortage.{name}")
    return all_rows(gold_wm_order_shortage_projection())


def test_sufficient_stock_never_flags(spark: SparkSession):
    _save(spark, [_stock(unrestricted_quantity=100.0)], "batch_stock")
    _save(spark, [_reservation(open_quantity=50.0)], "reservation_requirement")
    _save(spark, [_order()], "process_order")
    _save(spark, [_received_delivery()], "outbound_delivery")

    rows = _run_projection(spark)
    assert len(rows) == 1
    assert rows[0]["is_projected_short"] is False
    assert rows[0]["projected_balance_at_demand"] == 100.0


def test_insufficient_stock_always_flags(spark: SparkSession):
    _save(spark, [_stock(unrestricted_quantity=10.0)], "batch_stock")
    _save(spark, [_reservation(open_quantity=50.0)], "reservation_requirement")
    _save(spark, [_order()], "process_order")
    _save(spark, [_received_delivery()], "outbound_delivery")

    rows = _run_projection(spark)
    assert len(rows) == 1
    assert rows[0]["is_projected_short"] is True
    assert rows[0]["projected_balance_at_demand"] == 10.0


def test_inbound_rescue_before_demand(spark: SparkSession):
    _save(spark, [_stock(unrestricted_quantity=10.0)], "batch_stock")
    _save(spark, [_reservation(open_quantity=40.0, requirement_date=datetime.date(2026, 6, 15))], "reservation_requirement")
    _save(spark, [_order()], "process_order")
    _save(spark, [
        Row(
            plant_code="C061",
            material_code="RM1",
            delivery_number="800001",
            item_number="10",
            delivery_type="EL",
            planned_goods_issue_date=datetime.date(2026, 6, 12),
            actual_goods_issue_date=None,
            delivery_quantity_base=50.0,
            actual_delivered_base_quantity=0.0,
            base_uom="KG",
        ),
    ], "outbound_delivery")

    rows = _run_projection(spark)
    assert len(rows) == 1
    assert rows[0]["is_projected_short"] is False
    assert rows[0]["projected_balance_at_demand"] == 60.0


def test_ledger_window_ordering_deterministic(spark: SparkSession):
    from gold.wm_operations_gold import gold_wm_supply_demand_ledger

    _save(spark, [_stock(unrestricted_quantity=100.0)], "batch_stock")
    _save(spark, [
        _reservation(
            reservation_number="200",
            requirement_date=datetime.date(2026, 6, 5),
            open_quantity=30.0,
        ),
        _reservation(
            reservation_number="201",
            requirement_date=datetime.date(2026, 6, 5),
            open_quantity=20.0,
        ),
    ], "reservation_requirement")
    _save(spark, [_received_delivery()], "outbound_delivery")

    rows = all_rows(gold_wm_supply_demand_ledger())
    on_hand = [r for r in rows if r["event_subtype"] == "ON_HAND"]
    assert len(on_hand) == 1
    assert on_hand[0]["running_balance"] == 100.0
    demand_rows = [r for r in rows if r["event_subtype"] == "RESERVATION"]
    assert len(demand_rows) == 2
    assert demand_rows[0]["balance_before"] == 100.0
    assert demand_rows[1]["balance_before"] == 70.0
