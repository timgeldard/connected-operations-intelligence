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


def test_inbound_po_backlog_enhanced_live_aging_band(spark: SparkSession):
    today = _today(spark)
    base = spark.createDataFrame([
        Row(purchase_group="old", earliest_po_date=today - timedelta(days=30), remaining_open_qty=10.0),
        Row(purchase_group="mid", earliest_po_date=today - timedelta(days=14), remaining_open_qty=10.0),
        Row(purchase_group="new", earliest_po_date=today - timedelta(days=2), remaining_open_qty=10.0),
        Row(purchase_group="done", earliest_po_date=today - timedelta(days=60), remaining_open_qty=0.0),
        Row(purchase_group="unknown", earliest_po_date=None, remaining_open_qty=10.0),
    ])

    rows = {
        r["purchase_group"]: r
        for r in all_rows(_serve(spark, "gold_inbound_po_backlog_enhanced", base))
    }

    assert rows["old"]["oldest_po_age_days"] == 30
    assert rows["old"]["inbound_backlog_risk_band"] == "red"
    assert rows["mid"]["inbound_backlog_risk_band"] == "amber"
    assert rows["new"]["inbound_backlog_risk_band"] == "green"
    assert rows["done"]["inbound_backlog_risk_band"] == "green"
    assert rows["unknown"]["inbound_backlog_risk_band"] == "grey"


def test_warehouse_exceptions_live_age_thresholds(spark: SparkSession):
    """The exceptions base MV holds aging CANDIDATES; the _live view confirms each type's age
    threshold at query time and computes age_days / detected_date."""
    from datetime import datetime as dt

    today = _today(spark)
    now = spark.sql("SELECT current_timestamp() AS t").collect()[0]["t"]

    def cand(ref_id, exc_type, ref_date=None, ref_dt=None):
        return Row(reference_id=ref_id, exception_type=exc_type, plant_code="C061",
                   aging_reference_date=ref_date, aging_reference_datetime=ref_dt)

    base = spark.createDataFrame([
        # Expired: confirmed only once the expiry date has passed (today is not expired).
        cand("EXP_PAST", "EXPIRED_BATCH_WITH_STOCK", ref_date=today - timedelta(days=2)),
        cand("EXP_TODAY", "EXPIRED_BATCH_WITH_STOCK", ref_date=today),
        # QI: > 14 days since goods receipt; null GR date never confirms (matches pre-Phase-2 logic).
        cand("QI_OLD", "QI_STOCK_AGED_14D", ref_date=today - timedelta(days=15)),
        cand("QI_AT", "QI_STOCK_AGED_14D", ref_date=today - timedelta(days=14)),
        cand("QI_NULL", "QI_STOCK_AGED_14D", ref_date=None),
        # Blocked: > 3 days since goods receipt.
        cand("BLK_OLD", "BLOCKED_STOCK_AGED_3D", ref_date=today - timedelta(days=4)),
        cand("BLK_NEW", "BLOCKED_STOCK_AGED_3D", ref_date=today - timedelta(days=3)),
        # Open TO: rolling > 24h on the creation timestamp.
        cand("TO_OLD", "OPEN_TO_AGED_24H", ref_dt=dt(2000, 1, 1, 0, 0, 0)),
        cand("TO_NEW", "OPEN_TO_AGED_24H", ref_dt=now),
        # Non-aging types pass through unfiltered.
        cand("NEG_IM", "NEGATIVE_IM_STOCK"),
        cand("VAR", "IM_WM_TRUE_VARIANCE"),
    ])

    rows = {r["reference_id"]: r for r in all_rows(_serve(spark, "gold_warehouse_exceptions", base))}
    assert set(rows) == {"EXP_PAST", "QI_OLD", "BLK_OLD", "TO_OLD", "NEG_IM", "VAR"}
    assert rows["EXP_PAST"]["age_days"] == 2
    assert rows["QI_OLD"]["age_days"] == 15
    assert rows["NEG_IM"]["age_days"] is None
    assert rows["QI_OLD"]["detected_date"] == today
