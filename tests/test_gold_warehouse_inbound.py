"""
Tests for inbound / handling-unit Gold tables (gold/warehouse_inbound_gold.py).
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


def test_inbound_open_backlog_excludes_complete_and_deleted(spark):
    from gold.warehouse_inbound_gold import gold_inbound_gr_status

    _save(spark, [
        Row(purchase_order_number="450001", item_number="10", plant_code="C061", vendor_code="V1",
            purchasing_org="IT01", ordered_quantity=100.0, net_value=1000.0,
            purchase_order_date=None, qa_stock_type="Q", is_delivery_complete=False, is_item_deleted=False),
        Row(purchase_order_number="450001", item_number="20", plant_code="C061", vendor_code="V1",
            purchasing_org="IT01", ordered_quantity=50.0, net_value=500.0,
            purchase_order_date=None, qa_stock_type=" ", is_delivery_complete=False, is_item_deleted=False),
        # excluded: delivery complete
        Row(purchase_order_number="450002", item_number="10", plant_code="C061", vendor_code="V1",
            purchasing_org="IT01", ordered_quantity=10.0, net_value=100.0,
            purchase_order_date=None, qa_stock_type=" ", is_delivery_complete=True, is_item_deleted=False),
        # excluded: deleted
        Row(purchase_order_number="450003", item_number="10", plant_code="C061", vendor_code="V1",
            purchasing_org="IT01", ordered_quantity=10.0, net_value=100.0,
            purchase_order_date=None, qa_stock_type=" ", is_delivery_complete=False, is_item_deleted=True),
    ], "purchase_order")

    rows = all_rows(gold_inbound_gr_status())
    assert len(rows) == 1
    r = rows[0]
    assert r["open_item_count"] == 2
    assert r["open_po_count"] == 1
    assert r["total_open_value"] == 1500.0
    assert r["qa_inspection_item_count"] == 1


def test_handling_unit_summary_counts(spark):
    from gold.warehouse_inbound_gold import gold_handling_unit_summary

    _save(spark, [
        Row(handling_unit_number="H1", item_number="1", sscc="00353970850000000011",
            handling_unit_status="0030", reference_document_category="J", plant_code="C061",
            warehouse_number="208", delivery_number="80001", material_code="M1", gross_weight=10.0),
        Row(handling_unit_number="H1", item_number="2", sscc="00353970850000000011",
            handling_unit_status="0030", reference_document_category="J", plant_code="C061",
            warehouse_number="208", delivery_number="80001", material_code="M2", gross_weight=5.0),
        Row(handling_unit_number="H2", item_number="1", sscc="00353970850000000022",
            handling_unit_status="0030", reference_document_category="J", plant_code="C061",
            warehouse_number="208", delivery_number="80002", material_code="M1", gross_weight=8.0),
    ], "handling_unit")

    rows = all_rows(gold_handling_unit_summary())
    assert len(rows) == 1
    r = rows[0]
    assert r["hu_item_count"] == 3
    assert r["distinct_sscc_count"] == 2
    assert r["distinct_hu_count"] == 2
    assert r["linked_delivery_count"] == 2
    assert r["distinct_material_count"] == 2
    assert r["total_gross_weight"] == 23.0
