"""
Tests for the Gold "_live" serving views (scripts/generate_gold_serving_views_sql.py).

The Gold MVs are deterministic (no current_date()); the date-relative columns are computed by the
`<table>_live` serving views. The band/bucket SQL lives once in the generator module; these tests
run that exact SQL over fake base rows via local Spark, so the view logic stays covered.
(The expiry-bucket SQL is additionally exercised in test_gold_warehouse.py against the real base.)
"""

from datetime import timedelta

from pyspark.sql import Row, SparkSession

from scripts.generate_gold_serving_views_sql import serving_select_sql
from tests.conftest import all_rows


def _today(spark):
    return spark.sql("SELECT current_date() AS d").collect()[0]["d"]


def _serve(spark, table, base_df):
    view = f"{table}_base_tmp"
    base_df.createOrReplaceTempView(view)
    return spark.sql(serving_select_sql(table, view))


def test_delivery_pick_status_live_risk_band(spark: SparkSession):
    today = _today(spark)
    base = spark.createDataFrame([
        Row(delivery_number="D1", planned_goods_issue_date=today, is_shipped=True, pick_fraction=0.1),
        Row(delivery_number="D2", planned_goods_issue_date=None, is_shipped=False, pick_fraction=0.1),
        Row(delivery_number="D3", planned_goods_issue_date=today, is_shipped=False, pick_fraction=0.2),
        Row(delivery_number="D4", planned_goods_issue_date=today + timedelta(days=1), is_shipped=False, pick_fraction=0.6),
        Row(delivery_number="D5", planned_goods_issue_date=today + timedelta(days=5), is_shipped=False, pick_fraction=0.9),
    ])
    rows = {r["delivery_number"]: r for r in all_rows(_serve(spark, "gold_delivery_pick_status", base))}
    assert rows["D1"]["risk_band"] == "green"   # shipped
    assert rows["D2"]["risk_band"] == "grey"    # no planned GI date
    assert rows["D3"]["risk_band"] == "red"     # frac < 0.5 and due today
    assert rows["D4"]["risk_band"] == "amber"   # frac < 0.8 and due tomorrow
    assert rows["D5"]["risk_band"] == "green"
    assert rows["D3"]["days_to_goods_issue"] == 0
    assert rows["D5"]["days_to_goods_issue"] == 5


def test_process_order_staging_live_risk_band(spark: SparkSession):
    today = _today(spark)
    # First row fully populated so Spark infers column types cleanly (later rows may hold nulls).
    base = spark.createDataFrame([
        Row(order_number="O2", to_items_total=4, staging_fraction=0.2, scheduled_start_date=today,    is_operationally_trusted=True),
        Row(order_number="O0", to_items_total=0, staging_fraction=None, scheduled_start_date=today,   is_operationally_trusted=True),
        Row(order_number="O1", to_items_total=4, staging_fraction=0.5, scheduled_start_date=None,     is_operationally_trusted=True),
        Row(order_number="O3", to_items_total=4, staging_fraction=0.5, scheduled_start_date=today + timedelta(days=1), is_operationally_trusted=True),
        Row(order_number="O4", to_items_total=4, staging_fraction=0.9, scheduled_start_date=today + timedelta(days=5), is_operationally_trusted=True),
        Row(order_number="OU", to_items_total=4, staging_fraction=0.9, scheduled_start_date=today + timedelta(days=5), is_operationally_trusted=False),
    ])
    rows = {r["order_number"]: r for r in all_rows(_serve(spark, "gold_process_order_staging", base))}
    assert rows["O0"]["risk_band"] == "grey"         # no staging TOs
    assert rows["O1"]["risk_band"] == "grey"         # no scheduled start
    assert rows["O2"]["risk_band"] == "red"          # frac < 0.3 and starts today
    assert rows["O3"]["risk_band"] == "amber"        # frac < 0.7 and starts tomorrow
    assert rows["O4"]["risk_band"] == "green"
    assert rows["OU"]["risk_band"] == "unvalidated"  # plant not validated — no trust
    assert rows["O2"]["days_to_start"] == 0
    assert rows["O4"]["days_to_start"] == 5


def test_lineside_stock_live_days_to_expiry(spark: SparkSession):
    today = _today(spark)
    base = spark.createDataFrame([
        Row(warehouse_number="W1", earliest_expiry_date=today + timedelta(days=5)),
        Row(warehouse_number="W2", earliest_expiry_date=None),
    ])
    rows = {r["warehouse_number"]: r for r in all_rows(_serve(spark, "gold_lineside_stock", base))}
    assert rows["W1"]["min_days_to_expiry"] == 5
    assert rows["W2"]["min_days_to_expiry"] is None
