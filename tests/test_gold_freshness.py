"""
Tests for the Gold data-freshness monitoring (gold/freshness.py).

Exercises the status logic without needing real Silver tables: pointed at a non-existent schema,
every watermark table resolves to NO_DATA and the seed table (no watermark) to STATIC.
"""

import datetime

from pyspark.sql import Row, SparkSession

from gold.freshness import (
    FRESHNESS_CONTRACTS,
    gold_critical_freshness_gate,
    gold_data_freshness_status,
    gold_data_health_summary,
)
from tests.conftest import all_rows, create_df


def test_freshness_status_no_data_and_static(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver_absent_for_freshness_test")

    rows = {r["table_name"]: r for r in all_rows(gold_data_freshness_status())}
    assert len(rows) == len(FRESHNESS_CONTRACTS)

    # Watermark tables that don't exist → NO_DATA (never silently FRESH).
    assert rows["goods_movement"]["freshness_status"] == "NO_DATA"
    assert rows["goods_movement"]["max_lag_minutes"] is None
    assert rows["goods_movement"]["criticality"] == "critical"
    assert rows["goods_movement"]["is_stale"] is False

    # Seed/config table (no watermark) → STATIC, never STALE.
    assert rows["movement_type_classification"]["freshness_status"] == "STATIC"
    assert rows["movement_type_classification"]["is_stale"] is False

    # SLA carried through for the contract.
    assert rows["batch_stock"]["freshness_sla_minutes"] == 480
    assert rows["batch_stock"]["is_stale"] is False


def test_critical_freshness_gate_blocks_stale_and_no_data(spark: SparkSession, monkeypatch):
    import gold.freshness as freshness

    status_df = create_df(spark, [
        Row(table_name="goods_movement", criticality="critical", freshness_status="NO_DATA"),
        Row(table_name="process_order", criticality="critical", freshness_status="STALE"),
        Row(table_name="reservation_requirement", criticality="high", freshness_status="STALE"),
        Row(table_name="movement_type_classification", criticality="high", freshness_status="STATIC"),
        Row(table_name="storage_bin", criticality="critical", freshness_status="FRESH"),
    ])
    monkeypatch.setattr(freshness.dlt, "read", lambda _: status_df)

    rows = all_rows(gold_critical_freshness_gate())
    assert rows == [{"blocking_critical_table_count": 2}]


def test_data_health_summary_rolls_up_operational_signals(spark: SparkSession, monkeypatch):
    import gold.freshness as freshness

    tables = {
        "gold_data_freshness_status": create_df(spark, [
            Row(table_name="goods_movement", criticality="critical", freshness_status="FRESH",
                checked_at=datetime.datetime(2026, 6, 1, 8, 0)),
            Row(table_name="process_order", criticality="critical", freshness_status="STALE",
                checked_at=datetime.datetime(2026, 6, 1, 8, 0)),
            Row(table_name="material", criticality="medium", freshness_status="NO_DATA",
                checked_at=datetime.datetime(2026, 6, 1, 8, 0)),
        ]),
        "gold_storage_type_role_coverage_status": create_df(spark, [
            Row(plant_code="C061", warehouse_number="208", coverage_status="VALIDATED"),
            Row(plant_code="C062", warehouse_number="209", coverage_status="PARTIAL"),
        ]),
        "gold_process_order_staging_validation": create_df(spark, [
            Row(plant_code="C061", warehouse_number="208", validation_status="VALIDATED",
                sample_window_end=datetime.datetime(2026, 6, 1, 7, 0)),
            Row(plant_code="C062", warehouse_number="209", validation_status="NOT_VALIDATED",
                sample_window_end=datetime.datetime(2026, 6, 1, 7, 30)),
        ]),
        "gold_stock_reconciliation_summary_v2": create_df(spark, [
            Row(mismatch_severity="HIGH", exception_count=2, abs_delta_quantity_total=5.0),
            Row(mismatch_severity="INFO", exception_count=0, abs_delta_quantity_total=0.0),
        ]),
    }

    monkeypatch.setattr(freshness.dlt, "read", lambda name: tables[name])

    rows = {r["health_area"]: r for r in all_rows(gold_data_health_summary())}

    assert rows["freshness"]["health_status"] == "FAIL"
    assert rows["freshness"]["critical_issue_count"] == 1
    assert rows["freshness"]["warning_issue_count"] == 1
    assert rows["storage_type_role_coverage"]["health_status"] == "WARN"
    assert rows["process_order_staging_validation"]["health_status"] == "FAIL"
    assert rows["stock_reconciliation"]["health_status"] == "FAIL"
    assert rows["stock_reconciliation"]["critical_issue_count"] == 2
    assert rows["expectations"]["health_status"] == "EVENT_LOG"
