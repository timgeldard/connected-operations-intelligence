"""
Tests for the gold layer DLT transformations.
"""

from datetime import date

import pytest
from pyspark.sql import Row, SparkSession

from gold.dlt_gold_pipeline import (
    gold_plant_production_quality_summary,
    gold_process_order_schedule_adherence,
    gold_shift_output_summary,
    gold_process_order_operations,
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
    # Set configuration to use spark_catalog and silver schema locally
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")

    spark.sql("CREATE DATABASE IF NOT EXISTS silver")

    # Mock data for conformed movement type classification
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
        for code in ["101", "102", "201", "551", "552"]
    ]
    spark.createDataFrame(classification_data).write.mode("overwrite").saveAsTable("silver.movement_type_classification")

    yield
    spark.sql("DROP DATABASE IF EXISTS silver CASCADE")

def test_gold_shift_output_summary(spark: SparkSession):
    # Mock data for goods_movement
    goods_movement_data = [
        # Normal receipt (101)
        Row(plant_code="1000", posting_date=date(2026, 5, 30), material_code="MAT01", base_uom="KG", movement_type_code="101", quantity=100.0),
        # Receipt reversal (102)
        Row(plant_code="1000", posting_date=date(2026, 5, 30), material_code="MAT01", base_uom="KG", movement_type_code="102", quantity=20.0),
        # Scrap movement (551)
        Row(plant_code="1000", posting_date=date(2026, 5, 30), material_code="MAT01", base_uom="KG", movement_type_code="551", quantity=5.0),
        # Scrap reversal (552)
        Row(plant_code="1000", posting_date=date(2026, 5, 30), material_code="MAT01", base_uom="KG", movement_type_code="552", quantity=2.0),
        # Unrelated movement type
        Row(plant_code="1000", posting_date=date(2026, 5, 30), material_code="MAT01", base_uom="KG", movement_type_code="201", quantity=10.0),
    ]

    df_gm = spark.createDataFrame(goods_movement_data)
    df_gm.write.mode("overwrite").saveAsTable("silver.goods_movement")

    # Run target function
    res_df = gold_shift_output_summary()
    results = all_rows(res_df)

    assert len(results) == 1
    row = results[0]
    assert row["plant_code"] == "1000"
    assert row["produced_quantity"] == 80.0  # 100 - 20
    assert row["scrap_quantity"] == 3.0       # 5 - 2

def test_gold_process_order_schedule_adherence(spark: SparkSession):
    # Mock data for process_order
    process_order_data = [
        # Completed on time, in full
        Row(order_number="1", plant_code="1000", material_code="MAT01", order_quantity=100.0, confirmed_yield_quantity=100.0,
            scheduled_finish_date=date(2026, 5, 30), actual_finish_date=date(2026, 5, 29), is_completed=True, is_closed=False),
        # Completed late, not in full
        Row(order_number="2", plant_code="1000", material_code="MAT01", order_quantity=100.0, confirmed_yield_quantity=90.0,
            scheduled_finish_date=date(2026, 5, 30), actual_finish_date=date(2026, 5, 31), is_completed=True, is_closed=False),
        # Incomplete order (should be filtered out)
        Row(order_number="3", plant_code="1000", material_code="MAT01", order_quantity=100.0, confirmed_yield_quantity=0.0,
            scheduled_finish_date=date(2026, 5, 30), actual_finish_date=None, is_completed=False, is_closed=False),
        # Completed, but missing scheduled date (should yield None for is_on_time)
        Row(order_number="4", plant_code="1000", material_code="MAT01", order_quantity=100.0, confirmed_yield_quantity=100.0,
            scheduled_finish_date=None, actual_finish_date=date(2026, 5, 29), is_completed=True, is_closed=False),
    ]

    df_po = spark.createDataFrame(process_order_data)
    df_po.write.mode("overwrite").saveAsTable("silver.process_order")

    res_df = gold_process_order_schedule_adherence()
    results = all_rows(res_df)

    # Should only have completed/closed orders (1, 2, 4)
    assert len(results) == 3

    otif_map = {r["order_number"]: r for r in results}

    # Order 1: On time and In Full
    assert otif_map["1"]["is_on_time"] == 1
    assert otif_map["1"]["is_in_full"] == 1

    # Order 2: Late and Not In Full
    assert otif_map["2"]["is_on_time"] == 0
    assert otif_map["2"]["is_in_full"] == 0

    # Order 4: Missing Date (is_on_time is None) and In Full (is_in_full is 1)
    assert otif_map["4"]["is_on_time"] is None
    assert otif_map["4"]["is_in_full"] == 1


def test_gold_plant_production_quality_summary(spark: SparkSession):
    # Mock data for process_order
    process_order_data = [
        Row(plant_code="1000", order_quantity=100.0, confirmed_yield_quantity=90.0, total_scrap_quantity=10.0),
        Row(plant_code="1000", order_quantity=200.0, confirmed_yield_quantity=180.0, total_scrap_quantity=20.0),
        # Plant 2000 with zero production
        Row(plant_code="2000", order_quantity=0.0, confirmed_yield_quantity=0.0, total_scrap_quantity=0.0),
    ]
    # Mock data for downtime_event
    downtime_data = [
        Row(plant_code="1000", duration_minutes=120.0),
        Row(plant_code="1000", duration_minutes=60.0),
        Row(plant_code="2000", duration_minutes=0.0),
    ]

    df_po = spark.createDataFrame(process_order_data)
    df_po.write.mode("overwrite").saveAsTable("silver.process_order")

    df_dt = spark.createDataFrame(downtime_data)
    df_dt.write.mode("overwrite").saveAsTable("silver.downtime_event")

    res_df = gold_plant_production_quality_summary()
    results = all_rows(res_df)

    assert len(results) == 2
    oee_map = {r["plant_code"]: r for r in results}

    # Plant 1000
    row_1000 = oee_map["1000"]
    assert row_1000["total_ordered_qty"] == 300.0
    assert row_1000["total_yield_qty"] == 270.0
    assert row_1000["total_scrap_qty"] == 30.0
    assert row_1000["total_downtime_minutes"] == 180.0
    # quality_rate = yield / (yield + scrap) = 270 / 300 = 0.9
    assert abs(row_1000["quality_rate"] - 0.9) < 0.0001

    # Plant 2000
    row_2000 = oee_map["2000"]
    assert row_2000["total_ordered_qty"] == 0.0
    assert row_2000["total_yield_qty"] == 0.0
    assert row_2000["total_scrap_qty"] == 0.0
    assert row_2000["quality_rate"] is None


def test_gold_process_order_operations(spark: SparkSession):
    # Mock silver.process_order (order_number = 10 is active, 20 is closed, 30 is not released)
    po_data = [
        Row(order_number="10", plant_code="1000", material_code="MAT01", scheduled_start_date=date(2026, 6, 1), is_released=True, is_closed=False),
        Row(order_number="20", plant_code="1000", material_code="MAT01", scheduled_start_date=date(2026, 6, 1), is_released=True, is_closed=True),
        Row(order_number="30", plant_code="1000", material_code="MAT01", scheduled_start_date=date(2026, 6, 1), is_released=False, is_closed=False),
    ]
    spark.createDataFrame(po_data).write.mode("overwrite").saveAsTable("silver.process_order")

    # Mock silver.process_order_operation
    po_op_data = [
        Row(order_number="10", operation_number="0010", plant_code="1000", scheduled_start_datetime=date(2026, 6, 1), scheduled_finish_datetime=date(2026, 6, 2),
            actual_start_datetime=date(2026, 6, 1), actual_finish_date=date(2026, 6, 2), work_centre_internal_id="WC01", planned_work=10.0,
            actual_work=12.0, is_confirmed=True, confirmed_yield_quantity=100.0, confirmed_scrap_quantity=0.0,
            control_key="PP01", number_of_employees=2.0),
        # Operation for order 20 (should be filtered out since order 20 is closed)
        Row(order_number="20", operation_number="0010", plant_code="1000", scheduled_start_datetime=date(2026, 6, 1), scheduled_finish_datetime=date(2026, 6, 2),
            actual_start_datetime=date(2026, 6, 1), actual_finish_date=date(2026, 6, 2), work_centre_internal_id="WC01", planned_work=10.0,
            actual_work=12.0, is_confirmed=True, confirmed_yield_quantity=100.0, confirmed_scrap_quantity=0.0,
            control_key="PP01", number_of_employees=2.0),
    ]
    spark.createDataFrame(po_op_data).write.mode("overwrite").saveAsTable("silver.process_order_operation")

    # Mock silver.pi_sheet_execution
    pi_data = [
        Row(order_number="10", operation_number="0010", pi_sheet_status="Completed", duration_hours=4.5),
    ]
    spark.createDataFrame(pi_data).write.mode("overwrite").saveAsTable("silver.pi_sheet_execution")

    # Mock silver.downtime_event
    dt_data = [
        Row(order_number="10", operation_number="0010", duration_minutes=30.0),
        Row(order_number="10", operation_number="0010", duration_minutes=15.0),
    ]
    spark.createDataFrame(dt_data).write.mode("overwrite").saveAsTable("silver.downtime_event")

    res_df = gold_process_order_operations()
    results = all_rows(res_df)

    # Should only return operation for active order 10
    assert len(results) == 1
    row = results[0]
    assert row["order_number"] == "10"
    assert row["operation_number"] == "0010"
    assert row["plant_code"] == "1000"
    assert row["control_key"] == "PP01"
    assert row["number_of_employees"] == 2.0
    assert row["pi_sheet_status"] == "Completed"
    assert row["pi_sheet_duration_hours"] == 4.5
    assert row["total_downtime_minutes"] == 45.0
    assert row["is_operationally_active"] is True
