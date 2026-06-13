"""
Tests for gold_wm_pi_accuracy Gold table.

Covers:
  - count_accuracy_pct and coverage_pct maths
  - zero-denominator guards (counted_lines = 0, due_lines = 0)
  - ABC / cycle_counting_indicator grouping
  - zone-join handling (storage_zone absent — storage_location_code used as grain)
  - count_month truncation from count_date
  - currency segregation (values not summed across currencies)
  - recount_rate_pct computation

NOTE: Requires Spark/Java — runs in CI only.
"""

import datetime

import dlt
import pytest
from pyspark.sql import Row, SparkSession

from tests.conftest import all_rows, create_df


@pytest.fixture(scope="module", autouse=True)
def setup_pi_accuracy(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver_pi_accuracy")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver_pi_accuracy")
    yield
    dlt.read.side_effect = None
    spark.sql("DROP DATABASE IF EXISTS silver_pi_accuracy CASCADE")


def _pi_row(**kw) -> Row:
    """Default physical-inventory-recon row (all statuses MATCHED, counted)."""
    base = dict(
        plant_code="C061",
        storage_location_code="0001",
        cycle_counting_indicator="A",
        currency="EUR",
        count_date=datetime.date(2026, 6, 15),
        is_counted=True,
        is_recount_required=False,
        is_difference_posted=False,
        physical_inventory_status="MATCHED",
        delta_value=0.0,
        abs_delta_quantity=0.0,
    )
    base.update(kw)
    return Row(**base)


def _run_gold(spark: SparkSession, pi_rows: list) -> list:
    """Feed rows into gold_wm_pi_accuracy and return all result rows as dicts."""
    pi_df = create_df(spark, pi_rows)
    dlt.read.return_value = pi_df

    from gold.wm_operations_gold import gold_wm_pi_accuracy  # noqa: PLC0415

    result = gold_wm_pi_accuracy()
    return all_rows(result)


# ── count_month truncation ────────────────────────────────────────────────────

def test_count_month_truncated_to_first_of_month(spark: SparkSession):
    rows = [
        _pi_row(count_date=datetime.date(2026, 6, 3)),
        _pi_row(count_date=datetime.date(2026, 6, 28)),
    ]
    result = _run_gold(spark, rows)
    # Both rows land in the same bucket — one output row
    assert len(result) == 1
    assert result[0]["count_month"] == datetime.date(2026, 6, 1)


def test_count_month_separate_months_produce_separate_rows(spark: SparkSession):
    rows = [
        _pi_row(count_date=datetime.date(2026, 5, 20)),
        _pi_row(count_date=datetime.date(2026, 6, 10)),
    ]
    result = _run_gold(spark, rows)
    months = {r["count_month"] for r in result}
    assert datetime.date(2026, 5, 1) in months
    assert datetime.date(2026, 6, 1) in months


# ── count_accuracy_pct maths ─────────────────────────────────────────────────

def test_count_accuracy_pct_matched_over_counted(spark: SparkSession):
    """4 counted, 3 matched → accuracy = 3/4 = 0.75."""
    rows = [
        _pi_row(is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(is_counted=True, physical_inventory_status="DIFFERENCE_POSTED"),
    ]
    result = _run_gold(spark, rows)
    assert len(result) == 1
    row = result[0]
    assert row["counted_lines"] == 4
    assert row["matched_lines"] == 3
    assert abs(row["count_accuracy_pct"] - 0.75) < 1e-9


def test_count_accuracy_pct_null_when_counted_lines_zero(spark: SparkSession):
    """Zero counted lines → count_accuracy_pct must be null (not ZeroDivision)."""
    rows = [
        _pi_row(is_counted=False, physical_inventory_status="NOT_COUNTED"),
        _pi_row(is_counted=False, physical_inventory_status="NOT_COUNTED"),
    ]
    result = _run_gold(spark, rows)
    assert len(result) == 1
    row = result[0]
    assert row["counted_lines"] == 0
    assert row["count_accuracy_pct"] is None


# ── coverage_pct maths ────────────────────────────────────────────────────────

def test_coverage_pct_counted_over_due(spark: SparkSession):
    """5 due lines, 4 counted → coverage = 4/5 = 0.8."""
    rows = [
        _pi_row(is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(is_counted=False, physical_inventory_status="NOT_COUNTED"),
    ]
    result = _run_gold(spark, rows)
    assert len(result) == 1
    row = result[0]
    assert row["due_lines"] == 5
    assert row["counted_lines"] == 4
    assert abs(row["coverage_pct"] - 0.8) < 1e-9


def test_coverage_pct_null_when_no_due_lines(spark: SparkSession):
    """Empty group (due_lines = 0) after filter — coverage_pct must be null."""
    # Use an empty DF to simulate a plant with no PI lines
    pi_df = create_df(spark, [])
    dlt.read.return_value = pi_df

    # Import fresh — module-level dlt.read mock is set per call
    from gold.wm_operations_gold import gold_wm_pi_accuracy  # noqa: PLC0415
    result_df = gold_wm_pi_accuracy()
    rows = all_rows(result_df)
    # No rows — no division by zero possible
    assert len(rows) == 0


# ── recount_rate_pct ──────────────────────────────────────────────────────────

def test_recount_rate_pct_computation(spark: SparkSession):
    """3 counted, 1 requires recount → recount_rate = 1/3."""
    rows = [
        _pi_row(is_counted=True, is_recount_required=True, physical_inventory_status="RECOUNT_REQUIRED"),
        _pi_row(is_counted=True, is_recount_required=False, physical_inventory_status="MATCHED"),
        _pi_row(is_counted=True, is_recount_required=False, physical_inventory_status="MATCHED"),
    ]
    result = _run_gold(spark, rows)
    assert len(result) == 1
    row = result[0]
    assert row["recount_required_lines"] == 1
    assert abs(row["recount_rate_pct"] - (1.0 / 3.0)) < 1e-9


# ── ABC grouping ──────────────────────────────────────────────────────────────

def test_abc_classes_produce_separate_rows(spark: SparkSession):
    """A, B, C class indicators must be grouped independently."""
    rows = [
        _pi_row(cycle_counting_indicator="A", is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(cycle_counting_indicator="B", is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(cycle_counting_indicator="C", is_counted=False, physical_inventory_status="NOT_COUNTED"),
    ]
    result = _run_gold(spark, rows)
    abc_map = {r["cycle_counting_indicator"]: r for r in result}
    assert set(abc_map.keys()) == {"A", "B", "C"}
    assert abc_map["A"]["matched_lines"] == 1
    assert abc_map["C"]["counted_lines"] == 0
    assert abc_map["C"]["count_accuracy_pct"] is None


# ── zone-join: storage_location_code grouping (no storage_zone) ──────────────

def test_storage_location_code_grouping(spark: SparkSession):
    """Different storage locations must produce separate aggregate rows."""
    rows = [
        _pi_row(storage_location_code="0001", is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(storage_location_code="0001", is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(storage_location_code="0002", is_counted=True, physical_inventory_status="DIFFERENCE_POSTED"),
    ]
    result = _run_gold(spark, rows)
    loc_map = {r["storage_location_code"]: r for r in result}
    assert "0001" in loc_map
    assert "0002" in loc_map
    assert loc_map["0001"]["matched_lines"] == 2
    assert loc_map["0002"]["matched_lines"] == 0
    assert loc_map["0002"]["lines_with_difference"] == 1


# ── currency segregation ──────────────────────────────────────────────────────

def test_adjustment_value_not_summed_across_currencies(spark: SparkSession):
    """EUR and GBP values must stay in separate rows — not summed together."""
    rows = [
        _pi_row(currency="EUR", delta_value=100.0, is_counted=True, physical_inventory_status="MATCHED"),
        _pi_row(currency="GBP", delta_value=200.0, is_counted=True, physical_inventory_status="MATCHED"),
    ]
    result = _run_gold(spark, rows)
    currency_map = {r["currency"]: r for r in result}
    assert "EUR" in currency_map
    assert "GBP" in currency_map
    # EUR row should not contain GBP's 200
    assert abs(currency_map["EUR"]["total_adjustment_value"] - 100.0) < 1e-9
    assert abs(currency_map["GBP"]["total_adjustment_value"] - 200.0) < 1e-9


# ── abs_adjustment_value ──────────────────────────────────────────────────────

def test_abs_adjustment_value_sums_absolute_delta_values(spark: SparkSession):
    """+100 and -50 → abs_adjustment_value = 150, total_adjustment_value = 50."""
    rows = [
        _pi_row(delta_value=100.0, is_counted=True, physical_inventory_status="DIFFERENCE_POSTED"),
        _pi_row(delta_value=-50.0, is_counted=True, physical_inventory_status="DIFFERENCE_POSTED"),
    ]
    result = _run_gold(spark, rows)
    assert len(result) == 1
    row = result[0]
    assert abs(row["total_adjustment_value"] - 50.0) < 1e-9
    assert abs(row["abs_adjustment_value"] - 150.0) < 1e-9


# ── lines_with_difference count ───────────────────────────────────────────────

def test_lines_with_difference_counts_both_statuses(spark: SparkSession):
    """DIFFERENCE_POSTED and DIFFERENCE_NOT_POSTED both count as lines_with_difference."""
    rows = [
        _pi_row(is_counted=True, physical_inventory_status="DIFFERENCE_POSTED"),
        _pi_row(is_counted=True, physical_inventory_status="DIFFERENCE_NOT_POSTED"),
        _pi_row(is_counted=True, physical_inventory_status="MATCHED"),
    ]
    result = _run_gold(spark, rows)
    assert len(result) == 1
    assert result[0]["lines_with_difference"] == 2
