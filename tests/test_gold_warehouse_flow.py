"""
Tests for warehouse-flow Gold tables (gold/warehouse_flow_gold.py).

Pattern follows tests/test_gold_warehouse.py: create the required silver tables in
the local spark_catalog `silver` database, call the Gold function directly, assert
on the aggregation results.
"""

import pytest
from pyspark.sql import Row, SparkSession

from tests.conftest import all_rows


@pytest.fixture(scope="module", autouse=True)
def setup_silver(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")
    yield
    spark.sql("DROP DATABASE IF EXISTS silver CASCADE")


def _save(spark, rows, table):
    spark.createDataFrame(rows).write.mode("overwrite").saveAsTable(f"silver.{table}")


# ── Dispensary backlog ────────────────────────────────────────────────────────

def test_dispensary_backlog_filters_and_aggregates(spark):
    from gold.warehouse_flow_gold import gold_dispensary_backlog

    _save(spark, [
        # in scope: 261, open, not deleted
        Row(reservation_number="1", reservation_item="1", order_number="900", plant_code="C061",
            production_supply_area="PSA1", warehouse_number="208", movement_type_code="261",
            required_quantity=100.0, withdrawn_quantity=40.0, open_quantity=60.0,
            requirement_date=None, is_deletion_flagged=False),
        Row(reservation_number="1", reservation_item="2", order_number="900", plant_code="C061",
            production_supply_area="PSA1", warehouse_number="208", movement_type_code="261",
            required_quantity=50.0, withdrawn_quantity=0.0, open_quantity=50.0,
            requirement_date=None, is_deletion_flagged=False),
        # excluded: not 261
        Row(reservation_number="2", reservation_item="1", order_number="901", plant_code="C061",
            production_supply_area="PSA1", warehouse_number="208", movement_type_code="101",
            required_quantity=10.0, withdrawn_quantity=0.0, open_quantity=10.0,
            requirement_date=None, is_deletion_flagged=False),
        # excluded: deletion flagged
        Row(reservation_number="3", reservation_item="1", order_number="902", plant_code="C061",
            production_supply_area="PSA1", warehouse_number="208", movement_type_code="261",
            required_quantity=10.0, withdrawn_quantity=0.0, open_quantity=10.0,
            requirement_date=None, is_deletion_flagged=True),
        # excluded: nothing open
        Row(reservation_number="4", reservation_item="1", order_number="903", plant_code="C061",
            production_supply_area="PSA1", warehouse_number="208", movement_type_code="261",
            required_quantity=10.0, withdrawn_quantity=10.0, open_quantity=0.0,
            requirement_date=None, is_deletion_flagged=False),
    ], "reservation_requirement")
    _save(spark, [Row(order_number="900", scheduled_start_date=None)], "process_order")

    rows = all_rows(gold_dispensary_backlog())
    assert len(rows) == 1
    r = rows[0]
    assert r["open_task_count"] == 2
    assert r["open_order_count"] == 1
    assert r["total_open_qty"] == 110.0


# ── Delivery pick status ──────────────────────────────────────────────────────

def test_delivery_pick_fraction(spark):
    from gold.warehouse_flow_gold import gold_delivery_pick_status

    _save(spark, [
        Row(delivery_number="80001", item_number="10", plant_code="C061", warehouse_number="208",
            delivery_type="LF", sold_to_customer="C1", planned_goods_issue_date=None,
            delivery_quantity=60.0, picked_quantity=30.0, actual_goods_issue_date=None),
        Row(delivery_number="80001", item_number="20", plant_code="C061", warehouse_number="208",
            delivery_type="LF", sold_to_customer="C1", planned_goods_issue_date=None,
            delivery_quantity=40.0, picked_quantity=40.0, actual_goods_issue_date=None),
    ], "outbound_delivery")

    rows = all_rows(gold_delivery_pick_status())
    assert len(rows) == 1
    r = rows[0]
    assert r["line_count"] == 2
    assert r["delivery_qty"] == 100.0
    assert r["picked_qty"] == 70.0
    assert r["pick_fraction"] == 0.7
    assert r["is_shipped"] is False


# ── Stock reconciliation ──────────────────────────────────────────────────────

def test_stock_reconciliation_delta_and_match(spark):
    from gold.warehouse_flow_gold import gold_stock_reconciliation

    _save(spark, [
        Row(material_code="M1", plant_code="C061", storage_location_code="1000",
            unrestricted_quantity=100.0, quality_inspection_quantity=0.0, blocked_quantity=0.0,
            restricted_use_quantity=0.0, in_transfer_quantity=0.0),
        Row(material_code="M2", plant_code="C061", storage_location_code="1000",
            unrestricted_quantity=50.0, quality_inspection_quantity=0.0, blocked_quantity=0.0,
            restricted_use_quantity=0.0, in_transfer_quantity=0.0),
    ], "stock_at_location")
    _save(spark, [
        # M1 WM matches IM (100); M2 WM short (30 vs 50 -> variance)
        Row(plant_code="C061", material_code="M1", quant_number="Q1", total_quantity=100.0),
        Row(plant_code="C061", material_code="M2", quant_number="Q2", total_quantity=30.0),
    ], "storage_bin")
    _save(spark, [
        Row(material_code="M1", valuation_area="C061", standard_price=10.0, price_unit=1),
        Row(material_code="M2", valuation_area="C061", standard_price=2.0, price_unit=1),
    ], "material_valuation")

    rows = {r["material_code"]: r for r in all_rows(gold_stock_reconciliation())}
    assert rows["M1"]["delta_qty"] == 0.0
    assert rows["M1"]["mismatch_class"] == "match"
    assert rows["M1"]["inventory_value"] == 1000.0
    assert rows["M2"]["delta_qty"] == 20.0
    assert rows["M2"]["mismatch_class"] == "variance"
    # M1 is the higher-value line -> ABC class A
    assert rows["M1"]["abc_class"] == "A"
