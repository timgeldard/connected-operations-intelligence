"""
Tests for the Gold data-freshness monitoring (gold/freshness.py).

Exercises the status logic without needing real Silver tables: pointed at a non-existent schema,
every watermark table resolves to NO_DATA and the seed table (no watermark) to STATIC.
"""

from pyspark.sql import SparkSession

from gold.freshness import FRESHNESS_CONTRACTS, gold_data_freshness_status
from tests.conftest import all_rows


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
    assert rows["batch_stock"]["freshness_sla_minutes"] == 240
    assert rows["batch_stock"]["is_stale"] is False
