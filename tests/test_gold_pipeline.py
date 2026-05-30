"""
Tests for the gold layer DLT transformations.
"""

from datetime import date
import pytest
from pyspark.sql import Row, SparkSession
from tests.conftest import all_rows
from gold.dlt_gold_pipeline import (
    gold_shift_output_summary,
    gold_order_otif_metrics,
    gold_plant_oee_kpis,
)

@pytest.fixture(scope="module", autouse=True)
def setup_databases(spark: SparkSession):
    # Set configuration to use spark_catalog and silver schema locally
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")
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

def test_gold_order_otif_metrics(spark: SparkSession):
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
    
    res_df = gold_order_otif_metrics()
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


def test_gold_plant_oee_kpis(spark: SparkSession):
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
    
    res_df = gold_plant_oee_kpis()
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

