"""
PySpark unit tests for gold_wm_daily_activity_baseline.

NOTE: pytest cannot run locally without a JVM (PySpark). Tests are written for CI.
Run: cd data-products/io-reporting && pytest tests/test_gold_daily_activity_baseline.py -v
"""
from __future__ import annotations

import datetime

# ─────────────────────────────────────────────────────────────────────────────
# DLT mock setup (dlt is installed by conftest autouse)
# ─────────────────────────────────────────────────────────────────────────────
import dlt  # noqa: E402  — mocked by conftest before this import
import pytest
from pyspark.sql import Row, SparkSession

from gold.wm_operations_gold import gold_wm_daily_activity_baseline  # noqa: E402
from tests.conftest import all_rows, create_df

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _activity_row(plant_code, activity_date, to_items_confirmed=0, active_operators=0,
                  trs_created=0, goods_receipt_lines=0, goods_issue_lines=0):
    return Row(
        plant_code=plant_code,
        activity_date=activity_date,
        to_items_confirmed=to_items_confirmed,
        active_operators=active_operators,
        trs_created=trs_created,
        goods_receipt_lines=goods_receipt_lines,
        goods_issue_lines=goods_issue_lines,
    )


# Monday 2026-06-01 → dayofweek = 2
MON = datetime.date(2026, 6, 1)
# Tuesday 2026-06-02 → dayofweek = 3
TUE = datetime.date(2026, 6, 2)
# Another Monday 2026-06-08 → dayofweek = 2
MON2 = datetime.date(2026, 6, 8)


@pytest.fixture(scope="module", autouse=True)
def setup_silver(spark: SparkSession):
    """Baseline tests don't need silver tables — gold_wm_daily_activity is mocked via dlt.read."""
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")
    yield


class TestBaselineDowGrouping:
    """Verify day-of-week groupBy produces correct grain."""

    def test_two_mondays_grouped_together(self, spark: SparkSession):
        src = create_df(spark, [
            _activity_row("C061", MON, to_items_confirmed=100),
            _activity_row("C061", MON2, to_items_confirmed=200),
            _activity_row("C061", TUE, to_items_confirmed=50),
        ])
        dlt.read.return_value = src

        result = gold_wm_daily_activity_baseline()
        rows = all_rows(result)

        # Should have one row for plant C061, metric to_items_confirmed, dow=2 (Monday)
        monday_picks = [r for r in rows if r["plant_code"] == "C061"
                        and r["metric_name"] == "to_items_confirmed"
                        and r["day_of_week"] == 2]
        assert len(monday_picks) == 1
        # sample_days = 2 (two Mondays)
        assert monday_picks[0]["sample_days"] == 2

    def test_single_tuesday_sample_days_one(self, spark: SparkSession):
        src = create_df(spark, [
            _activity_row("C061", TUE, to_items_confirmed=50),
        ])
        dlt.read.return_value = src

        result = gold_wm_daily_activity_baseline()
        rows = all_rows(result)

        tuesday_picks = [r for r in rows if r["plant_code"] == "C061"
                         and r["metric_name"] == "to_items_confirmed"
                         and r["day_of_week"] == 3]
        assert len(tuesday_picks) == 1
        assert tuesday_picks[0]["sample_days"] == 1


class TestPercentileNullSafe:
    """Verify null values don't corrupt percentile or sample_days counts."""

    def test_null_metric_excluded_from_sample_days(self, spark: SparkSession):
        from pyspark.sql import Row as SparkRow
        from pyspark.sql.types import DateType, IntegerType, StringType, StructField, StructType
        schema = StructType([
            StructField("plant_code", StringType(), True),
            StructField("activity_date", DateType(), True),
            StructField("to_items_confirmed", IntegerType(), True),
            StructField("active_operators", IntegerType(), True),
            StructField("trs_created", IntegerType(), True),
            StructField("goods_receipt_lines", IntegerType(), True),
            StructField("goods_issue_lines", IntegerType(), True),
        ])
        # Two Mondays: one with value, one with None
        src = spark.createDataFrame([
            SparkRow(plant_code="C061", activity_date=MON, to_items_confirmed=100,
                     active_operators=5, trs_created=10, goods_receipt_lines=None, goods_issue_lines=None),
            SparkRow(plant_code="C061", activity_date=MON2, to_items_confirmed=200,
                     active_operators=None, trs_created=None, goods_receipt_lines=None, goods_issue_lines=None),
        ], schema)
        dlt.read.return_value = src

        result = gold_wm_daily_activity_baseline()
        rows = all_rows(result)

        # goods_receipt_lines: both None → sample_days = 0
        gr_monday = [r for r in rows if r["plant_code"] == "C061"
                     and r["metric_name"] == "goods_receipt_lines"
                     and r["day_of_week"] == 2]
        assert len(gr_monday) == 1
        assert gr_monday[0]["sample_days"] == 0

        # active_operators: one row has 5, one has None → sample_days = 1
        ao_monday = [r for r in rows if r["plant_code"] == "C061"
                     and r["metric_name"] == "active_operators"
                     and r["day_of_week"] == 2]
        assert len(ao_monday) == 1
        assert ao_monday[0]["sample_days"] == 1

    def test_percentile_returns_double_columns(self, spark: SparkSession):
        src = create_df(spark, [
            _activity_row("C061", MON, to_items_confirmed=100),
        ])
        dlt.read.return_value = src

        result = gold_wm_daily_activity_baseline()
        # Schema check: median_value, p10_value, p90_value should be DoubleType
        schema_map = {f.name: f.dataType.simpleString() for f in result.schema.fields}
        assert schema_map["median_value"] == "double"
        assert schema_map["p10_value"] == "double"
        assert schema_map["p90_value"] == "double"


class TestPartialDayExclusion:
    """Verify the MV itself includes today's rows (exclusion is query-time).
    The consumption view applies WHERE activity_date < CURRENT_DATE() — not the MV.
    """

    def test_all_rows_included_in_mv(self, spark: SparkSession):
        today = datetime.date.today()
        src = create_df(spark, [
            _activity_row("C061", MON, to_items_confirmed=100),
            _activity_row("C061", today, to_items_confirmed=50),  # today = partial day
        ])
        dlt.read.return_value = src

        result = gold_wm_daily_activity_baseline()
        rows = all_rows(result)

        # Both days should contribute to whatever DOW they fall on
        # sample_days across all to_items_confirmed rows for C061 = 2 days total
        # (may or may not be same DOW, but total sample_days across all DOW groups = 2)
        total_picks_sample_days = sum(
            r["sample_days"] for r in rows
            if r["plant_code"] == "C061" and r["metric_name"] == "to_items_confirmed"
        )
        assert total_picks_sample_days == 2


class TestWideVsLongHandling:
    """Verify all 5 metric columns are unpivoted to metric_name rows."""

    def test_five_metrics_per_day(self, spark: SparkSession):
        src = create_df(spark, [
            _activity_row("C061", MON, to_items_confirmed=10, active_operators=2,
                          trs_created=5, goods_receipt_lines=3, goods_issue_lines=1),
        ])
        dlt.read.return_value = src

        result = gold_wm_daily_activity_baseline()
        rows = all_rows(result)

        c061_rows = [r for r in rows if r["plant_code"] == "C061"]
        metric_names = {r["metric_name"] for r in c061_rows}
        assert metric_names == {
            "to_items_confirmed", "active_operators", "trs_created",
            "goods_receipt_lines", "goods_issue_lines"
        }

    def test_multi_plant_isolation(self, spark: SparkSession):
        src = create_df(spark, [
            _activity_row("C061", MON, to_items_confirmed=100),
            _activity_row("P806", MON, to_items_confirmed=200),
        ])
        dlt.read.return_value = src

        result = gold_wm_daily_activity_baseline()
        rows = all_rows(result)

        c061 = [r for r in rows if r["plant_code"] == "C061" and r["metric_name"] == "to_items_confirmed"]
        p806 = [r for r in rows if r["plant_code"] == "P806" and r["metric_name"] == "to_items_confirmed"]
        assert len(c061) == 1
        assert len(p806) == 1
        # Each has 1 sample day
        assert c061[0]["sample_days"] == 1
        assert p806[0]["sample_days"] == 1


class TestExistingSeriesRegression:
    """Regression-pin: gold_wm_daily_activity still returns wide format (additive-only proof)."""

    def test_gold_wm_daily_activity_is_wide(self, spark: SparkSession):
        # This test imports and invokes gold_wm_daily_activity to confirm it still works
        # and returns wide columns — the baseline is a NEW table, not a replacement.
        from gold.wm_operations_gold import gold_wm_daily_activity

        spark.conf.set("silver_catalog", "spark_catalog")
        spark.conf.set("silver_schema", "silver")
        spark.sql("CREATE DATABASE IF NOT EXISTS silver")

        from pyspark.sql import Row

        from tests.conftest import create_df

        _TS = datetime.datetime(2026, 6, 1, 8, 0, 0)

        # Seed minimal silver tables needed by gold_wm_daily_activity
        create_df(spark, [
            Row(plant_code="C061", transfer_order_number="0000000001", transfer_order_item="0001",
                warehouse_number="104", source_storage_type="300", destination_storage_type="100",
                confirmed_date=datetime.date(2026, 6, 1), confirmed_by_user="OP1",
                created_datetime=_TS, material_code="RM1", source_bin="SRC001",
                destination_bin="DST001", quantity=10.0, base_uom="KG",
                transfer_order_status=None, is_cancelled=False),
        ]).write.mode("overwrite").saveAsTable("silver.warehouse_transfer_order")

        create_df(spark, [
            Row(plant_code="C061", transfer_requirement_number="TR001", item_number="0001",
                warehouse_number="104", material_code="RM1", base_uom="KG",
                created_datetime=_TS, required_quantity=10.0, open_quantity=10.0,
                source_storage_type=None, destination_storage_type="100",
                header_status_code=None, is_processing_complete=False,
                planned_execution_datetime=_TS, destination_bin=None,
                source_reference_type="P", source_reference_number="900001",
                queue=None, campaign_reference=None,
                manual_pick_status=None, direct_pick_status=None,
                assigned_operator_manual=None, assigned_operator_direct=None,
                job_sequence_manual=None, job_sequence_direct=None,
                created_by_user="SUPERVISOR", transfer_priority=None),
        ]).write.mode("overwrite").saveAsTable("silver.warehouse_transfer_requirement")

        create_df(spark, [
            Row(plant_code="C061", material_document_number="4900000001", material_document_year="2026",
                item_number="0001", movement_type_code="261", posting_date=datetime.date(2026, 6, 1),
                material_code="RM1", quantity=10.0, base_uom="KG", storage_location="L001",
                batch_number=None, vendor_number=None, customer_number=None, order_number=None,
                delivery_number=None, cost_center=None, gl_account=None, valuation_type=None,
                debit_credit_indicator="S"),
        ]).write.mode("overwrite").saveAsTable("silver.goods_movement")

        create_df(spark, [
            Row(movement_type_code="261", is_goods_receipt=False, is_goods_issue=True,
                is_production_consumption=True),
            Row(movement_type_code="101", is_goods_receipt=True, is_goods_issue=False,
                is_production_consumption=False),
        ]).write.mode("overwrite").saveAsTable("silver.movement_type_classification")

        result = gold_wm_daily_activity()
        schema_names = {f.name for f in result.schema.fields}

        # Verify the WIDE schema is intact
        assert "plant_code" in schema_names
        assert "activity_date" in schema_names
        assert "to_items_confirmed" in schema_names
        assert "active_operators" in schema_names
        assert "trs_created" in schema_names
        assert "goods_receipt_lines" in schema_names
        assert "goods_issue_lines" in schema_names
        # Confirm no baseline columns leaked in
        assert "metric_name" not in schema_names
        assert "metric_value" not in schema_names
        assert "median_value" not in schema_names
