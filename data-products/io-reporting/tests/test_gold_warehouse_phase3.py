"""
Tests for Phase 3 Gold: warehouse exceptions and the per-plant KPI snapshot.
"""

from datetime import date, datetime

import pytest
from pyspark.sql import Row, SparkSession

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


def _bin(**kw):
    base = dict(
        plant_code="C061", warehouse_number="208", storage_type="100", bin_code="B1",
        quant_number="Q1", material_code="M1", batch_number="L1", stock_category_code=" ",
        total_quantity=10.0, available_quantity=10.0, expiry_date=None,
        goods_receipt_date=date(2024, 1, 1), is_blocked=False,
    )
    base.update(kw)
    return Row(**base)


def test_exceptions_emits_deterministic_candidates(spark):
    """The base MV emits aging CANDIDATES with their reference date — no current_date()
    threshold filtering and no age_days/detected_date (those live in the _live serving view,
    covered in test_gold_serving_views.py)."""
    from gold.warehouse_exceptions import gold_warehouse_exceptions

    _save(spark, [
        Row(material_code="M1", plant_code="C061", storage_location_code="1000",
            unrestricted_quantity=-5.0, quality_inspection_quantity=0.0, blocked_quantity=0.0,
            restricted_use_quantity=0.0, in_transfer_quantity=0.0),
    ], "stock_at_location")

    _save(spark, [
        # batch with stock and an expiry date (candidate regardless of whether it has passed)
        _bin(quant_number="Q1", material_code="M1", expiry_date=date(2000, 1, 1), total_quantity=10.0),
        # negative WM quant
        _bin(quant_number="Q2", material_code="M2", total_quantity=-3.0),
        # QI stock — candidate even before the 14-day threshold (applied in _live)
        _bin(quant_number="Q3", material_code="M3", stock_category_code="Q",
             total_quantity=5.0, goods_receipt_date=date(2000, 1, 1)),
    ], "storage_bin")

    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", transfer_order_number="T1", item_number="1",
            item_status="Open", created_datetime=datetime(2000, 1, 1, 0, 0, 0),
            material_code="M1", batch_number="L1", requested_quantity=10.0),
    ], "warehouse_transfer_order")

    rows = all_rows(gold_warehouse_exceptions())
    by_type = {r["exception_type"]: r for r in rows}
    assert "NEGATIVE_IM_STOCK" in by_type
    assert "NEGATIVE_WM_QUANT" in by_type
    assert "EXPIRED_BATCH_WITH_STOCK" in by_type
    assert "QI_STOCK_AGED_14D" in by_type
    assert "OPEN_TO_AGED_24H" in by_type

    # Deterministic schema: aging reference columns present, query-time columns absent.
    columns = set(rows[0].keys())
    assert {"aging_reference_date", "aging_reference_datetime"} <= columns
    assert "age_days" not in columns
    assert "detected_date" not in columns
    assert by_type["EXPIRED_BATCH_WITH_STOCK"]["aging_reference_date"] == date(2000, 1, 1)
    assert by_type["QI_STOCK_AGED_14D"]["aging_reference_date"] == date(2000, 1, 1)
    assert by_type["OPEN_TO_AGED_24H"]["aging_reference_datetime"] == datetime(2000, 1, 1, 0, 0, 0)
    assert by_type["NEGATIVE_IM_STOCK"]["aging_reference_date"] is None


def test_kpi_snapshot_per_plant(spark):
    from gold.warehouse_kpi_snapshot import gold_warehouse_kpi_snapshot

    _save(spark, [
        Row(order_number="900", plant_code="C061", is_released=True, is_closed=False),
        Row(order_number="901", plant_code="C061", is_released=False, is_closed=False),
    ], "process_order")
    _save(spark, [
        Row(plant_code="C061", is_processing_complete=False, open_quantity=10.0),
    ], "warehouse_transfer_requirement")
    _save(spark, [
        Row(plant_code="C061", item_status="Open"),
        Row(plant_code="C061", item_status="Fully Confirmed"),
    ], "warehouse_transfer_order")
    _save(spark, [
        Row(plant_code="C061", delivery_number="80001", actual_goods_issue_date=None),
    ], "outbound_delivery")
    _save(spark, [
        Row(plant_code="C061", is_delivery_complete=False, is_item_deleted=False),
    ], "purchase_order")
    _save(spark, [
        _bin(bin_code="B1", quant_number="Q1", is_blocked=False),
        _bin(bin_code="B2", quant_number=None, is_blocked=True),
    ], "storage_bin")

    rows = all_rows(gold_warehouse_kpi_snapshot())
    assert len(rows) == 1
    r = rows[0]
    assert r["plant_code"] == "C061"
    assert r["active_order_count"] == 1
    assert r["open_tr_item_count"] == 1
    assert r["open_to_item_count"] == 1
    assert r["open_delivery_count"] == 1
    assert r["open_inbound_item_count"] == 1
    assert r["total_bin_count"] == 2
    assert r["occupied_bin_count"] == 1
    assert r["blocked_bin_count"] == 1
    assert r["bin_utilisation_pct"] == 50.0
