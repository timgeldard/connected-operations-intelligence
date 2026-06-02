"""
Tests for warehouse Gold KPI transformations.
"""

from datetime import date, datetime, timedelta

import pytest
from pyspark.sql import Row, SparkSession

from gold.warehouse_kpis import (
    gold_bin_occupancy,
    gold_inbound_outbound_throughput,
    gold_stock_availability,
    gold_stock_expiry_risk,
    gold_transfer_order_performance,
    gold_transfer_requirement_backlog,
)
from scripts.generate_gold_serving_views_sql import serving_select_sql
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


def test_bin_occupancy_current_state_counts_and_stock(spark: SparkSession):
    storage_bin_data = [
        Row(
            warehouse_number="001",
            plant_code="1000",
            storage_type="A01",
            bin_code="B01",
            bin_type="PALLET",
            quant_number="Q1",
            is_blocked=False,
            is_blocked_for_stock_removal=False,
            is_blocked_for_putaway=False,
            total_quantity=10.0,
            available_quantity=8.0,
            open_transfer_quantity=2.0,
        ),
        Row(
            warehouse_number="001",
            plant_code="1000",
            storage_type="A01",
            bin_code="B01",
            bin_type="PALLET",
            quant_number="Q2",
            is_blocked=False,
            is_blocked_for_stock_removal=False,
            is_blocked_for_putaway=True,
            total_quantity=5.0,
            available_quantity=5.0,
            open_transfer_quantity=0.0,
        ),
        Row(
            warehouse_number="001",
            plant_code="1000",
            storage_type="A01",
            bin_code="B02",
            bin_type="PALLET",
            quant_number=None,
            is_blocked=True,
            is_blocked_for_stock_removal=True,
            is_blocked_for_putaway=False,
            total_quantity=None,
            available_quantity=None,
            open_transfer_quantity=None,
        ),
        Row(
            warehouse_number="001",
            plant_code="1000",
            storage_type="A01",
            bin_code="B03",
            bin_type="PALLET",
            quant_number="Q3",
            is_blocked=False,
            is_blocked_for_stock_removal=False,
            is_blocked_for_putaway=False,
            total_quantity=5.0,
            available_quantity=5.0,
            open_transfer_quantity=0.0,
        ),
    ]
    spark.createDataFrame(storage_bin_data).write.mode("overwrite").saveAsTable(
        "silver.storage_bin"
    )

    row = all_rows(gold_bin_occupancy())[0]

    assert row["bin_record_count"] == 3
    assert row["occupied_bin_count"] == 2
    assert row["empty_bin_count"] == 1
    assert row["blocked_bin_count"] == 1
    assert row["stock_removal_blocked_bin_count"] == 1
    assert row["putaway_blocked_bin_count"] == 1
    assert abs(row["occupancy_rate"] - (2 / 3)) < 0.0001
    assert row["total_stock_qty"] == 20.0
    assert row["available_stock_qty"] == 18.0
    assert row["open_transfer_stock_qty"] == 2.0


def test_stock_availability_current_batch_state(spark: SparkSession):
    batch_stock_data = [
        Row(
            plant_code="1000",
            storage_location_code="SL01",
            material_code="12345",
            batch_number="B1",
            base_uom="KG",
            unrestricted_quantity=10.0,
            quality_inspection_quantity=2.0,
            blocked_quantity=1.0,
            restricted_use_quantity=3.0,
            in_transfer_quantity=4.0,
            blocked_returns_quantity=5.0,
        ),
        Row(
            plant_code="1000",
            storage_location_code="SL01",
            material_code="12345",
            batch_number="B1",
            base_uom="KG",
            unrestricted_quantity=6.0,
            quality_inspection_quantity=0.0,
            blocked_quantity=0.0,
            restricted_use_quantity=1.0,
            in_transfer_quantity=0.0,
            blocked_returns_quantity=0.0,
        ),
    ]
    spark.createDataFrame(batch_stock_data).write.mode("overwrite").saveAsTable(
        "silver.batch_stock"
    )

    row = all_rows(gold_stock_availability())[0]

    assert row["unrestricted_qty"] == 16.0
    assert row["available_qty"] == 16.0
    assert row["unavailable_qty"] == 12.0
    assert row["in_transfer_qty"] == 4.0
    assert row["total_stock_qty"] == 32.0


def test_transfer_requirement_backlog_filters_completed_and_closed_items(spark: SparkSession):
    transfer_requirement_data = [
        Row(
            warehouse_number="001",
            plant_code="1000",
            source_storage_type="A01",
            destination_storage_type="B01",
            queue="Q1",
            transfer_priority="1",
            is_processing_complete=False,
            open_quantity=7.0,
            required_quantity=10.0,
            created_datetime=datetime(2026, 5, 30, 7, 0, 0),
            planned_execution_datetime=datetime(2026, 5, 30, 9, 0, 0),
        ),
        Row(
            warehouse_number="001",
            plant_code="1000",
            source_storage_type="A01",
            destination_storage_type="B01",
            queue="Q1",
            transfer_priority="1",
            is_processing_complete=False,
            open_quantity=3.0,
            required_quantity=5.0,
            created_datetime=datetime(2026, 5, 30, 8, 0, 0),
            planned_execution_datetime=datetime(2026, 5, 30, 10, 0, 0),
        ),
        Row(
            warehouse_number="001",
            plant_code="1000",
            source_storage_type="A01",
            destination_storage_type="B01",
            queue="Q1",
            transfer_priority="1",
            is_processing_complete=True,
            open_quantity=9.0,
            required_quantity=9.0,
            created_datetime=datetime(2026, 5, 30, 6, 0, 0),
            planned_execution_datetime=datetime(2026, 5, 30, 8, 0, 0),
        ),
        Row(
            warehouse_number="001",
            plant_code="1000",
            source_storage_type="A01",
            destination_storage_type="B01",
            queue="Q1",
            transfer_priority="1",
            is_processing_complete=False,
            open_quantity=0.0,
            required_quantity=4.0,
            created_datetime=datetime(2026, 5, 30, 6, 30, 0),
            planned_execution_datetime=datetime(2026, 5, 30, 8, 30, 0),
        ),
    ]
    spark.createDataFrame(transfer_requirement_data).write.mode("overwrite").saveAsTable(
        "silver.warehouse_transfer_requirement"
    )

    row = all_rows(gold_transfer_requirement_backlog())[0]

    assert row["backlog_item_count"] == 2
    assert row["open_qty"] == 10.0
    assert row["required_qty"] == 15.0
    assert abs(row["open_quantity_rate"] - (10.0 / 15.0)) < 0.0001
    assert row["oldest_created_datetime"] == datetime(2026, 5, 30, 7, 0, 0)
    assert row["oldest_planned_execution_datetime"] == datetime(2026, 5, 30, 9, 0, 0)


def test_stock_expiry_risk_buckets_and_minimum_shelf_life(spark: SparkSession):
    today = spark.sql("SELECT current_date() AS today").collect()[0]["today"]
    storage_bin_data = [
        Row(
            plant_code="1000",
            material_code="12345",
            batch_number="B1",
            base_uom="KG",
            expiry_date=today - timedelta(days=1),
            goods_receipt_date=today - timedelta(days=120),
            total_quantity=2.0,
        ),
        Row(
            plant_code="1000",
            material_code="12345",
            batch_number="B2",
            base_uom="KG",
            expiry_date=today + timedelta(days=3),
            goods_receipt_date=today - timedelta(days=90),
            total_quantity=3.0,
        ),
        Row(
            plant_code="1000",
            material_code="12345",
            batch_number="B3",
            base_uom="KG",
            expiry_date=today + timedelta(days=20),
            goods_receipt_date=today - timedelta(days=60),
            total_quantity=5.0,
        ),
        Row(
            plant_code="1000",
            material_code="12345",
            batch_number="B4",
            base_uom="KG",
            expiry_date=today + timedelta(days=45),
            goods_receipt_date=today - timedelta(days=30),
            total_quantity=7.0,
        ),
        Row(
            plant_code="1000",
            material_code="12345",
            batch_number="B5",
            base_uom="KG",
            expiry_date=today + timedelta(days=120),
            goods_receipt_date=today,
            total_quantity=11.0,
        ),
    ]
    material_data = [
        Row(
            plant_code="1000",
            material_code="12345",
            material_description="Finished Good",
            shelf_life_days=180,
            minimum_remaining_shelf_life_days=30,
        )
    ]
    spark.createDataFrame(storage_bin_data).write.mode("overwrite").saveAsTable(
        "silver.storage_bin"
    )
    spark.createDataFrame(material_data).write.mode("overwrite").saveAsTable("silver.material")

    # The MV is now deterministic (absolute dates only); the expiry buckets/flags are served by the
    # gold_stock_expiry_risk_live view. Verify the base omits them, then apply the serving-view SQL
    # (single source of truth) and assert the full bucket behaviour.
    base = gold_stock_expiry_risk()
    assert "expired_qty" not in base.columns
    base.createOrReplaceTempView("expiry_base_for_serving")
    live = spark.sql(serving_select_sql("gold_stock_expiry_risk", "expiry_base_for_serving"))
    rows = {r["batch_number"]: r for r in all_rows(live)}
    assert len(rows) == 5

    # B1: Expired
    assert rows["B1"]["minimum_expiry_date"] == today - timedelta(days=1)
    assert rows["B1"]["minimum_days_to_expiry"] == -1
    assert rows["B1"]["total_stock_qty"] == 2.0
    assert rows["B1"]["expired_qty"] == 2.0
    assert rows["B1"]["highest_expiry_risk_bucket"] == "EXPIRED"
    assert rows["B1"]["minimum_shelf_life_breach_qty"] == 2.0
    assert rows["B1"]["has_minimum_shelf_life_breach"] is True

    # B2: LT 7 Days
    assert rows["B2"]["minimum_expiry_date"] == today + timedelta(days=3)
    assert rows["B2"]["minimum_days_to_expiry"] == 3
    assert rows["B2"]["total_stock_qty"] == 3.0
    assert rows["B2"]["expiry_risk_lt_7d_qty"] == 3.0
    assert rows["B2"]["highest_expiry_risk_bucket"] == "LT_7_DAYS"
    assert rows["B2"]["minimum_shelf_life_breach_qty"] == 3.0
    assert rows["B2"]["has_minimum_shelf_life_breach"] is True

    # B3: Days 7 to 30
    assert rows["B3"]["minimum_expiry_date"] == today + timedelta(days=20)
    assert rows["B3"]["minimum_days_to_expiry"] == 20
    assert rows["B3"]["total_stock_qty"] == 5.0
    assert rows["B3"]["expiry_risk_7_30d_qty"] == 5.0
    assert rows["B3"]["highest_expiry_risk_bucket"] == "DAYS_7_30"
    assert rows["B3"]["minimum_shelf_life_breach_qty"] == 5.0
    assert rows["B3"]["has_minimum_shelf_life_breach"] is True

    # B4: Days 30 to 90 (no breach)
    assert rows["B4"]["minimum_expiry_date"] == today + timedelta(days=45)
    assert rows["B4"]["minimum_days_to_expiry"] == 45
    assert rows["B4"]["total_stock_qty"] == 7.0
    assert rows["B4"]["expiry_risk_30_90d_qty"] == 7.0
    assert rows["B4"]["highest_expiry_risk_bucket"] == "DAYS_30_90"
    assert rows["B4"]["minimum_shelf_life_breach_qty"] == 0.0
    assert rows["B4"]["has_minimum_shelf_life_breach"] is False

    # B5: OK (no breach)
    assert rows["B5"]["minimum_expiry_date"] == today + timedelta(days=120)
    assert rows["B5"]["minimum_days_to_expiry"] == 120
    assert rows["B5"]["total_stock_qty"] == 11.0
    assert rows["B5"]["expiry_ok_qty"] == 11.0
    assert rows["B5"]["highest_expiry_risk_bucket"] == "OK"
    assert rows["B5"]["minimum_shelf_life_breach_qty"] == 0.0
    assert rows["B5"]["has_minimum_shelf_life_breach"] is False

