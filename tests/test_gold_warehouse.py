"""
Tests for warehouse Gold KPI transformations.
"""

from datetime import date, datetime

import pytest
from pyspark.sql import Row, SparkSession

from gold.warehouse_kpis import (
    gold_inbound_outbound_throughput,
    gold_transfer_order_performance,
)
from silver.movement_types import (
    ISSUE_MOVEMENT_TYPES,
    MOVEMENT_TYPE_MAPPING,
    RECEIPT_MOVEMENT_TYPES,
    STOCK_WRITE_OFF_MOVEMENT_TYPES,
    STOCK_WRITE_ON_MOVEMENT_TYPES,
    T156_REVERSAL_MAPPING,
    TRANSFER_MOVEMENT_TYPES,
    get_movement_event_category,
)
from tests.conftest import all_rows


@pytest.fixture(scope="module", autouse=True)
def setup_databases(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")

    classification_data = [
        Row(
            movement_type_code=code,
            movement_label=MOVEMENT_TYPE_MAPPING[code],
            event_category=get_movement_event_category(code),
            is_reversal=code in T156_REVERSAL_MAPPING,
            is_goods_receipt=code in RECEIPT_MOVEMENT_TYPES,
            is_goods_issue=code in ISSUE_MOVEMENT_TYPES,
            is_transfer=code in TRANSFER_MOVEMENT_TYPES,
            is_stock_write_on=code in STOCK_WRITE_ON_MOVEMENT_TYPES,
            is_stock_write_off=code in STOCK_WRITE_OFF_MOVEMENT_TYPES,
            is_production_receipt=code in {"101", "131"},
            is_receipt_reversal=code in {"102", "132"},
            is_scrap=code == "551",
            is_scrap_reversal=code == "552",
        )
        for code in ["101", "102", "201", "202", "311", "701", "702"]
    ]
    spark.createDataFrame(classification_data).write.mode("overwrite").saveAsTable(
        "silver.movement_type_classification"
    )

    yield
    spark.sql("DROP DATABASE IF EXISTS silver CASCADE")


def test_transfer_order_performance_operator_bucket_and_accuracy(spark: SparkSession):
    transfer_order_data = [
        Row(
            warehouse_number="001",
            plant_code="1000",
            confirmed_by_user="OP1",
            confirmed_date=date(2026, 5, 30),
            source_storage_type="A01",
            confirmed_quantity=10.0,
            requested_quantity=12.0,
            actual_quantity_picked=9.0,
            item_status="Fully Confirmed",
            start_datetime=datetime(2026, 5, 30, 8, 0, 0),
            end_datetime=datetime(2026, 5, 30, 10, 0, 0),
            actual_processing_time=20.0,
            processing_time_unit="MIN",
        ),
        Row(
            warehouse_number="001",
            plant_code="1000",
            confirmed_by_user="OP1",
            confirmed_date=date(2026, 5, 30),
            source_storage_type="A01",
            confirmed_quantity=5.0,
            requested_quantity=5.0,
            actual_quantity_picked=5.0,
            item_status="Partially Confirmed",
            start_datetime=datetime(2026, 5, 30, 11, 0, 0),
            end_datetime=datetime(2026, 5, 30, 10, 0, 0),
            actual_processing_time=0.5,
            processing_time_unit="HR",
        ),
        Row(
            warehouse_number="001",
            plant_code="1000",
            confirmed_by_user="OP1",
            confirmed_date=date(2026, 5, 30),
            source_storage_type="A01",
            confirmed_quantity=0.0,
            requested_quantity=4.0,
            actual_quantity_picked=0.0,
            item_status="Open",
            start_datetime=None,
            end_datetime=None,
            actual_processing_time=600.0,
            processing_time_unit="SEC",
        ),
        Row(
            warehouse_number="001",
            plant_code="1000",
            confirmed_by_user=None,
            confirmed_date=None,
            source_storage_type="A01",
            confirmed_quantity=0.0,
            requested_quantity=4.0,
            actual_quantity_picked=0.0,
            item_status="Open",
            start_datetime=None,
            end_datetime=None,
            actual_processing_time=None,
            processing_time_unit=None,
        ),
    ]
    spark.createDataFrame(transfer_order_data).write.mode("overwrite").saveAsTable(
        "silver.warehouse_transfer_order"
    )

    rows = all_rows(gold_transfer_order_performance())
    grouped = {
        (row["confirmed_by_user"], row["confirmed_date"]): row
        for row in rows
    }

    op_row = grouped[("OP1", date(2026, 5, 30))]
    assert op_row["to_item_count"] == 3
    assert op_row["confirmed_qty"] == 15.0
    assert op_row["requested_qty"] == 21.0
    assert op_row["picked_qty"] == 14.0
    assert abs(op_row["pick_accuracy"] - (14.0 / 15.0)) < 0.0001
    assert op_row["fully_confirmed_rate"] == 0.5
    assert op_row["avg_confirmation_cycle_hours"] == 1.0
    assert op_row["avg_processing_time"] == 20.0
    assert op_row["processing_time_unit"] == "MIN"

    unknown_row = grouped[("UNKNOWN", None)]
    assert unknown_row["to_item_count"] == 1
    assert unknown_row["pick_accuracy"] is None


def test_inbound_outbound_throughput_reversal_netting_and_transfer_exclusion(spark: SparkSession):
    goods_movement_data = [
        Row(
            plant_code="1000",
            storage_location_code="SL01",
            posting_date=date(2026, 5, 30),
            movement_type_code="101",
            quantity=100.0,
        ),
        Row(
            plant_code="1000",
            storage_location_code="SL01",
            posting_date=date(2026, 5, 30),
            movement_type_code="102",
            quantity=100.0,
        ),
        Row(
            plant_code="1000",
            storage_location_code="SL01",
            posting_date=date(2026, 5, 30),
            movement_type_code="201",
            quantity=40.0,
        ),
        Row(
            plant_code="1000",
            storage_location_code="SL01",
            posting_date=date(2026, 5, 30),
            movement_type_code="202",
            quantity=10.0,
        ),
        Row(
            plant_code="1000",
            storage_location_code="SL01",
            posting_date=date(2026, 5, 30),
            movement_type_code="311",
            quantity=25.0,
        ),
        Row(
            plant_code="1000",
            storage_location_code="SL01",
            posting_date=date(2026, 5, 30),
            movement_type_code="701",
            quantity=7.0,
        ),
        Row(
            plant_code="1000",
            storage_location_code="SL01",
            posting_date=date(2026, 5, 30),
            movement_type_code="702",
            quantity=2.0,
        ),
    ]
    spark.createDataFrame(goods_movement_data).write.mode("overwrite").saveAsTable(
        "silver.goods_movement"
    )

    row = all_rows(gold_inbound_outbound_throughput())[0]

    assert row["movement_line_count"] == 7
    assert row["inbound_qty"] == 0.0
    assert row["outbound_qty"] == 30.0
    assert row["transfer_qty"] == 25.0
    assert row["adjustment_qty"] == 5.0
    assert row["net_qty"] == -30.0
