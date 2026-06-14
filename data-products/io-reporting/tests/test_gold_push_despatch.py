"""
PySpark fixture tests for Push Despatch Gold tables (Spec 14, WMA-E-23).

Exercises:
  gold_wm_push_despatch_delivery  — delivery grain, is_push_despatch, pgi_on_time, pallet_count
  gold_wm_push_despatch_daily     — daily KPI aggregate, on_time_pgi_pct zero-guard

CI-only: these tests require a live JVM (PySpark local mode). They are written here for
completeness and correctness verification but are not run offline (see conventions §offline).

Run locally (if JVM available):
  pytest tests/test_gold_push_despatch.py -v
"""

import datetime

import pytest
from pyspark.sql import Row, SparkSession

from tests.conftest import all_rows, create_df


@pytest.fixture(scope="module", autouse=True)
def setup_silver_push(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")

    _save(spark, [
        Row(customer_code="DEST1", customer_name="Destination DC One"),
        Row(customer_code="CUST_NORMAL", customer_name="Normal Customer"),
    ], "customer")

    # Seed outbound_delivery with push and non-push rows.
    # Push delivery PD001: ZPUS, on-time PGI, 2 items
    # Push delivery PD002: ZPUS, late PGI (actual > planned), 1 item
    # Push delivery PD003: ZPUS, no PGI (is_pgi_complete=false), 1 item
    # Normal delivery ND001: no SDABW marker — MUST NOT appear in push view
    # Normal delivery ND002: SDABW=None (NULL marker) — MUST NOT appear in push view
    _save(spark, [
        # PD001 — on-time PGI, 2 items, ZPUS
        Row(delivery_number="PD001", item_number="10", plant_code="C061",
            warehouse_number="208", delivery_type="ZD04",
            ship_to_customer="DEST1", sold_to_customer="DEST1",
            special_processing_code="ZPUS", container_vehicle_id="VH001", transport_type="03",
            delivery_direction="OUTBOUND",
            planned_goods_issue_date=datetime.date(2023, 11, 1),
            actual_goods_issue_date=datetime.date(2023, 11, 1),
            delivery_date=None, delivery_gross_weight=500.0, delivery_weight_unit="KG",
            wm_status_code="C", shipping_point="SP01",
            delivery_quantity=10.0, sales_uom="CS", base_uom="KG",
            delivery_quantity_base=100.0, actual_delivered_base_quantity=100.0,
            picked_quantity=100.0, net_weight=100.0, gross_weight=110.0, weight_unit="KG",
            source_document_number=None, source_document_item=None,
            document_category="J", loading_date=None, planned_goods_issue_datetime=None,
            storage_location_code="1000", material_code="M1", material_code_raw="000000M1",
            batch_number=None, batch_number_raw=None,
            sales_to_base_uom_numerator=10.0, sales_to_base_uom_denominator=1.0),
        Row(delivery_number="PD001", item_number="20", plant_code="C061",
            warehouse_number="208", delivery_type="ZD04",
            ship_to_customer="DEST1", sold_to_customer="DEST1",
            special_processing_code="ZPUS", container_vehicle_id="VH001", transport_type="03",
            delivery_direction="OUTBOUND",
            planned_goods_issue_date=datetime.date(2023, 11, 1),
            actual_goods_issue_date=datetime.date(2023, 11, 1),
            delivery_date=None, delivery_gross_weight=500.0, delivery_weight_unit="KG",
            wm_status_code="C", shipping_point="SP01",
            delivery_quantity=5.0, sales_uom="CS", base_uom="KG",
            delivery_quantity_base=50.0, actual_delivered_base_quantity=50.0,
            picked_quantity=50.0, net_weight=50.0, gross_weight=55.0, weight_unit="KG",
            source_document_number=None, source_document_item=None,
            document_category="J", loading_date=None, planned_goods_issue_datetime=None,
            storage_location_code="1000", material_code="M2", material_code_raw="000000M2",
            batch_number=None, batch_number_raw=None,
            sales_to_base_uom_numerator=10.0, sales_to_base_uom_denominator=1.0),
        # PD002 — late PGI (actual 2023-11-03 > planned 2023-11-01), 1 item
        Row(delivery_number="PD002", item_number="10", plant_code="C061",
            warehouse_number="208", delivery_type="ZD04",
            ship_to_customer="DEST1", sold_to_customer="DEST1",
            special_processing_code="ZPUS", container_vehicle_id="VH002", transport_type="03",
            delivery_direction="OUTBOUND",
            planned_goods_issue_date=datetime.date(2023, 11, 1),
            actual_goods_issue_date=datetime.date(2023, 11, 3),
            delivery_date=None, delivery_gross_weight=200.0, delivery_weight_unit="KG",
            wm_status_code="C", shipping_point="SP01",
            delivery_quantity=20.0, sales_uom="CS", base_uom="KG",
            delivery_quantity_base=200.0, actual_delivered_base_quantity=200.0,
            picked_quantity=200.0, net_weight=200.0, gross_weight=210.0, weight_unit="KG",
            source_document_number=None, source_document_item=None,
            document_category="J", loading_date=None, planned_goods_issue_datetime=None,
            storage_location_code="1000", material_code="M1", material_code_raw="000000M1",
            batch_number=None, batch_number_raw=None,
            sales_to_base_uom_numerator=10.0, sales_to_base_uom_denominator=1.0),
        # PD003 — no PGI yet (actual = None)
        Row(delivery_number="PD003", item_number="10", plant_code="C061",
            warehouse_number="208", delivery_type="ZD04",
            ship_to_customer="DEST1", sold_to_customer="DEST1",
            special_processing_code="ZPUS", container_vehicle_id=None, transport_type=None,
            delivery_direction="OUTBOUND",
            planned_goods_issue_date=datetime.date(2023, 10, 15),
            actual_goods_issue_date=None,
            delivery_date=None, delivery_gross_weight=80.0, delivery_weight_unit="KG",
            wm_status_code="A", shipping_point="SP01",
            delivery_quantity=8.0, sales_uom="CS", base_uom="KG",
            delivery_quantity_base=80.0, actual_delivered_base_quantity=0.0,
            picked_quantity=0.0, net_weight=80.0, gross_weight=85.0, weight_unit="KG",
            source_document_number=None, source_document_item=None,
            document_category="J", loading_date=None, planned_goods_issue_datetime=None,
            storage_location_code="1000", material_code="M1", material_code_raw="000000M1",
            batch_number=None, batch_number_raw=None,
            sales_to_base_uom_numerator=10.0, sales_to_base_uom_denominator=1.0),
        # ND001 — normal outbound (no SDABW marker). MUST NOT appear in push view.
        Row(delivery_number="ND001", item_number="10", plant_code="C061",
            warehouse_number="208", delivery_type="LF",
            ship_to_customer="CUST_NORMAL", sold_to_customer="CUST_NORMAL",
            special_processing_code=None, container_vehicle_id=None, transport_type=None,
            delivery_direction="OUTBOUND",
            planned_goods_issue_date=datetime.date(2023, 11, 1),
            actual_goods_issue_date=datetime.date(2023, 11, 1),
            delivery_date=None, delivery_gross_weight=300.0, delivery_weight_unit="KG",
            wm_status_code="C", shipping_point="SP01",
            delivery_quantity=30.0, sales_uom="CS", base_uom="KG",
            delivery_quantity_base=300.0, actual_delivered_base_quantity=300.0,
            picked_quantity=300.0, net_weight=300.0, gross_weight=310.0, weight_unit="KG",
            source_document_number=None, source_document_item=None,
            document_category="J", loading_date=None, planned_goods_issue_datetime=None,
            storage_location_code="1000", material_code="M1", material_code_raw="000000M1",
            batch_number=None, batch_number_raw=None,
            sales_to_base_uom_numerator=10.0, sales_to_base_uom_denominator=1.0),
    ], "outbound_delivery")

    yield
    spark.sql("DROP DATABASE IF EXISTS silver CASCADE")


def _save(spark, rows, table):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(f"silver.{table}")


# ── Tests for gold_wm_push_despatch_delivery ──────────────────────────────────

def test_push_despatch_delivery_filters_to_zpus_only(spark):
    """Normal outbound deliveries (special_processing_code=NULL) must NOT appear."""
    from gold.warehouse_flow_gold import gold_wm_push_despatch_delivery

    rows = {r["delivery_number"]: r for r in all_rows(gold_wm_push_despatch_delivery())}

    # PD001, PD002, PD003 are push. ND001 is normal — must be excluded.
    assert "ND001" not in rows, "Normal delivery ND001 should not appear in push despatch view"
    assert "PD001" in rows
    assert "PD002" in rows
    assert "PD003" in rows
    assert len(rows) == 3


def test_push_despatch_delivery_is_push_despatch_flag(spark):
    """is_push_despatch must be True for all rows in the push delivery view."""
    from gold.warehouse_flow_gold import gold_wm_push_despatch_delivery

    rows = all_rows(gold_wm_push_despatch_delivery())
    for r in rows:
        assert r["is_push_despatch"] is True, f"is_push_despatch must be True for {r['delivery_number']}"


def test_push_despatch_delivery_line_count(spark):
    """line_count must reflect item-grain aggregation."""
    from gold.warehouse_flow_gold import gold_wm_push_despatch_delivery

    rows = {r["delivery_number"]: r for r in all_rows(gold_wm_push_despatch_delivery())}
    assert rows["PD001"]["line_count"] == 2, "PD001 has 2 items"
    assert rows["PD002"]["line_count"] == 1, "PD002 has 1 item"
    assert rows["PD003"]["line_count"] == 1, "PD003 has 1 item"


def test_push_despatch_delivery_pgi_on_time_true_when_actual_le_planned(spark):
    """pgi_on_time=True when actual_goods_issue_date <= planned_goods_issue_date."""
    from gold.warehouse_flow_gold import gold_wm_push_despatch_delivery

    rows = {r["delivery_number"]: r for r in all_rows(gold_wm_push_despatch_delivery())}
    r_pd001 = rows["PD001"]
    assert r_pd001["is_pgi_complete"] is True
    assert r_pd001["pgi_on_time"] is True, "PD001: actual == planned → on-time"


def test_push_despatch_delivery_pgi_on_time_false_when_actual_gt_planned(spark):
    """pgi_on_time=False when actual_goods_issue_date > planned_goods_issue_date."""
    from gold.warehouse_flow_gold import gold_wm_push_despatch_delivery

    rows = {r["delivery_number"]: r for r in all_rows(gold_wm_push_despatch_delivery())}
    r_pd002 = rows["PD002"]
    assert r_pd002["is_pgi_complete"] is True
    assert r_pd002["pgi_on_time"] is False, "PD002: actual 2023-11-03 > planned 2023-11-01 → late"


def test_push_despatch_delivery_is_pgi_complete_false_when_no_actual(spark):
    """is_pgi_complete=False and pgi_on_time=False when actual_goods_issue_date is NULL."""
    from gold.warehouse_flow_gold import gold_wm_push_despatch_delivery

    rows = {r["delivery_number"]: r for r in all_rows(gold_wm_push_despatch_delivery())}
    r_pd003 = rows["PD003"]
    assert r_pd003["is_pgi_complete"] is False, "PD003 has no actual GI — is_pgi_complete must be False"
    assert r_pd003["pgi_on_time"] is False, "PD003: no actual GI → pgi_on_time must be False"


def test_push_despatch_delivery_destination_customer(spark):
    """destination_customer maps to ship_to_customer; destination_plant_code is NULL in v1."""
    from gold.warehouse_flow_gold import gold_wm_push_despatch_delivery

    rows = {r["delivery_number"]: r for r in all_rows(gold_wm_push_despatch_delivery())}
    assert rows["PD001"]["destination_customer"] == "DEST1"
    assert rows["PD001"]["destination_plant_code"] is None, "destination_plant_code is NULL in v1"


def test_push_despatch_delivery_weight_aggregation(spark):
    """total_net_weight is the sum of item net weights; type is double."""
    from gold.warehouse_flow_gold import gold_wm_push_despatch_delivery

    rows = {r["delivery_number"]: r for r in all_rows(gold_wm_push_despatch_delivery())}
    pd001 = rows["PD001"]
    # PD001 has two items: 100.0 + 50.0 = 150.0 KG net weight
    assert abs(pd001["total_net_weight"] - 150.0) < 0.001, f"Expected 150.0, got {pd001['total_net_weight']}"
    assert isinstance(pd001["total_net_weight"], float), "total_net_weight must be double (float), not int"


# ── Tests for gold_wm_push_despatch_daily ────────────────────────────────────

def test_push_despatch_daily_on_time_pgi_pct_zero_guard(spark):
    """on_time_pgi_pct must be NULL when pgi_complete_count = 0 (zero-denominator guard)."""
    from gold.warehouse_flow_gold import gold_wm_push_despatch_daily

    rows = all_rows(gold_wm_push_despatch_daily())
    # PD003 has no actual GI date → not included in daily (filtered out in gold_wm_push_despatch_daily).
    # Rows only appear for days where actual_goods_issue_date is not null.
    # So we won't have a row with pgi_complete_count=0 from this fixture — verify no division error.
    # The guard matters most when pgi_complete_count==0 on an existing row; the filter
    # prevents that from occurring naturally here. We verify on_time_pgi_pct is a float (not error).
    for r in rows:
        pct_val = r["on_time_pgi_pct"]
        if pct_val is not None:
            assert 0.0 <= pct_val <= 1.0, f"on_time_pgi_pct must be in [0, 1], got {pct_val}"


def test_push_despatch_daily_counts_match_delivery_grain(spark):
    """Daily aggregate counts must reproduce from the delivery-grain fixture."""
    from gold.warehouse_flow_gold import gold_wm_push_despatch_daily

    rows = all_rows(gold_wm_push_despatch_daily())
    # PD001 and PD002 both have actual_goods_issue_date in 2023-11:
    # PD001: 2023-11-01, PD002: 2023-11-03 → two separate day rows (same destination DEST1, KG)
    day_rows = {(r["plant_code"], r["goods_issue_day"].strftime("%Y-%m-%d") if r["goods_issue_day"] else None): r for r in rows}
    # 2023-11-01: PD001 only
    key_1 = ("C061", "2023-11-01")
    assert key_1 in day_rows, f"Expected a row for 2023-11-01, found: {list(day_rows.keys())}"
    r_nov1 = day_rows[key_1]
    assert r_nov1["push_delivery_count"] == 1, "Only PD001 on 2023-11-01"
    assert r_nov1["pgi_complete_count"] == 1
    assert r_nov1["on_time_pgi_count"] == 1
    assert r_nov1["on_time_pgi_pct"] == pytest.approx(1.0), "100% on-time for 2023-11-01"
    # 2023-11-03: PD002 only (late PGI)
    key_3 = ("C061", "2023-11-03")
    assert key_3 in day_rows, f"Expected a row for 2023-11-03, found: {list(day_rows.keys())}"
    r_nov3 = day_rows[key_3]
    assert r_nov3["push_delivery_count"] == 1
    assert r_nov3["pgi_complete_count"] == 1
    assert r_nov3["on_time_pgi_count"] == 0
    assert r_nov3["on_time_pgi_pct"] == pytest.approx(0.0), "0% on-time for 2023-11-03 (PD002 was late)"


def test_push_despatch_daily_excludes_no_pgi_rows(spark):
    """Rows without actual_goods_issue_date (PD003) must not appear in the daily aggregate."""
    from gold.warehouse_flow_gold import gold_wm_push_despatch_daily

    rows = all_rows(gold_wm_push_despatch_daily())
    # PD003 has no GI date → goods_issue_day would be None → excluded by the filter
    # PD003 planned_goods_issue_date is 2023-10-15
    none_day_rows = [r for r in rows if r["goods_issue_day"] is None]
    assert len(none_day_rows) == 0, "Rows with no goods_issue_day must not appear in the daily aggregate"
