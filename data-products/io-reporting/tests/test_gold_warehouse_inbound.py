"""
Tests for inbound / handling-unit Gold tables (gold/warehouse_inbound_gold.py).
"""

from datetime import date, datetime

import pytest
from pyspark.sql import Row, SparkSession

from silver.movement_types import build_movement_type_classification_records
from tests.conftest import all_rows, create_df


@pytest.fixture(scope="module", autouse=True)
def setup_silver(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")
    yield
    spark.sql("DROP DATABASE IF EXISTS silver CASCADE")


def _save(spark, rows, table):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(f"silver.{table}")


def test_inbound_open_backlog_excludes_complete_and_deleted(spark):
    from gold.warehouse_inbound_gold import gold_inbound_po_backlog

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

    rows = all_rows(gold_inbound_po_backlog())
    assert len(rows) == 1
    r = rows[0]
    assert r["open_item_count"] == 2
    assert r["open_po_count"] == 1
    assert r["total_open_value"] == 1500.0
    assert r["qa_inspection_item_count"] == 1


def test_inbound_po_backlog_enhanced_gr_putaway_and_aging_anchors(spark):
    from gold.warehouse_inbound_gold import gold_inbound_po_backlog_enhanced

    _save(spark, [
        Row(purchase_order_number="450001", item_number="00010", plant_code="C061", vendor_code="V1",
            purchasing_org="IT01", ordered_quantity=100.0, net_value=1000.0,
            purchase_order_date=date(2026, 5, 1), qa_stock_type=" ", is_delivery_complete=False,
            is_item_deleted=False),
        Row(purchase_order_number="450001", item_number="00020", plant_code="C061", vendor_code="V1",
            purchasing_org="IT01", ordered_quantity=40.0, net_value=400.0,
            purchase_order_date=date(2026, 5, 1), qa_stock_type="Q", is_delivery_complete=False,
            is_item_deleted=False),
        Row(purchase_order_number="450002", item_number="00010", plant_code="C061", vendor_code="V1",
            purchasing_org="IT01", ordered_quantity=20.0, net_value=200.0,
            purchase_order_date=date(2026, 5, 3), qa_stock_type=" ", is_delivery_complete=False,
            is_item_deleted=False),
        Row(purchase_order_number="450003", item_number="00010", plant_code="C061", vendor_code="V1",
            purchasing_org="IT01", ordered_quantity=999.0, net_value=999.0,
            purchase_order_date=date(2026, 5, 4), qa_stock_type=" ", is_delivery_complete=True,
            is_item_deleted=False),
    ], "purchase_order")
    _save(
        spark,
        build_movement_type_classification_records(["101", "103", "104"]),
        "movement_type_classification",
    )
    _save(spark, [
        Row(purchase_order_number="450001", purchase_order_item="00010", movement_type_code="103",
            quantity=60.0, posting_date=date(2026, 5, 5)),
        Row(purchase_order_number="450001", purchase_order_item="00010", movement_type_code="104",
            quantity=10.0, posting_date=date(2026, 5, 6)),
        Row(purchase_order_number="450002", purchase_order_item="00010", movement_type_code="103",
            quantity=20.0, posting_date=date(2026, 5, 7)),
        # Production receipt must not count as PO GR.
        Row(purchase_order_number="450001", purchase_order_item="00020", movement_type_code="101",
            quantity=40.0, posting_date=date(2026, 5, 8)),
    ], "goods_movement")
    _save(spark, [
        Row(plant_code="C061", transfer_order_number="TO1", item_status="Fully Confirmed",
            source_reference_number="450001",
            created_datetime=datetime(2026, 5, 6, 8, 0), confirmed_date=date(2026, 5, 6)),
        Row(plant_code="C061", transfer_order_number="TO2", item_status="Open",
            source_reference_number="450002",
            created_datetime=datetime(2026, 5, 8, 8, 0), confirmed_date=None),
        # Same PO number in another plant must not link to the C061 backlog.
        Row(plant_code="C099", transfer_order_number="TOX", item_status="Fully Confirmed",
            source_reference_number="450001",
            created_datetime=datetime(2026, 5, 9, 8, 0), confirmed_date=date(2026, 5, 9)),
    ], "warehouse_transfer_order")

    rows = all_rows(gold_inbound_po_backlog_enhanced())
    assert len(rows) == 1
    row = rows[0]

    assert row["open_item_count"] == 3
    assert row["open_po_count"] == 2
    assert row["total_ordered_qty"] == 160.0
    assert row["total_gr_qty"] == 70.0
    assert row["remaining_open_qty"] == 90.0
    assert row["earliest_po_date"] == date(2026, 5, 1)
    assert row["latest_gr_posting_date"] == date(2026, 5, 7)
    assert row["item_without_gr_count"] == 1
    assert row["partial_gr_item_count"] == 1
    assert row["fully_gr_item_count"] == 1
    assert row["qa_inspection_item_count"] == 1
    assert row["putaway_to_count"] == 2
    assert row["confirmed_putaway_to_count"] == 1
    assert row["oldest_putaway_to_created_datetime"] == datetime(2026, 5, 6, 8, 0)


def test_handling_unit_summary_counts(spark):
    from gold.warehouse_inbound_gold import gold_handling_unit_summary

    _save(spark, [
        # gross_weight is the VEKP header value repeated on every item of the HU.
        Row(handling_unit_number="H1", item_number="1", sscc="00353970850000000011",
            handling_unit_status="0030", reference_document_category="J", plant_code="C061",
            warehouse_number="208", delivery_number="80001", material_code="M1", gross_weight=10.0),
        Row(handling_unit_number="H1", item_number="2", sscc="00353970850000000011",
            handling_unit_status="0030", reference_document_category="J", plant_code="C061",
            warehouse_number="208", delivery_number="80001", material_code="M2", gross_weight=10.0),
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
    # Header weight counted once per HU (10 for H1, 8 for H2), not once per item.
    assert r["total_gross_weight"] == 18.0
