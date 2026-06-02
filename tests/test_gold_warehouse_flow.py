"""
Tests for warehouse-flow Gold tables (gold/warehouse_flow_gold.py).

Pattern follows tests/test_gold_warehouse.py: create the required silver tables in
the local spark_catalog `silver` database, call the Gold function directly, assert
on the aggregation results.
"""

import pytest
from pyspark.sql import Row, SparkSession

from tests.conftest import all_rows, create_df


@pytest.fixture(scope="module", autouse=True)
def setup_silver(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")
    
    # Seed default storage type role mapping configuration table
    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100", role="LINESIDE"),
        Row(plant_code="C061", warehouse_number="208", storage_type="801", role="LINESIDE"),
    ], "storage_type_role_mapping")

    # Seed staging reference mapping: C061 is trusted (validated warehouse); P001 absent = untrusted
    _save(spark, [
        Row(plant_code="C061", warehouse_number="208",
            staging_reference_strategy="BENUM_EQUALS_AUFNR", is_validated=True,
            validated_by="profiling-2026-06-02", validated_at=None, notes=None),
    ], "process_order_staging_reference_mapping_config")
    
    yield
    spark.sql("DROP DATABASE IF EXISTS silver CASCADE")


def _save(spark, rows, table):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(f"silver.{table}")


# ── Dispensary backlog ────────────────────────────────────────────────────────

def test_dispensary_backlog_filters_and_aggregates(spark):
    from gold.warehouse_flow_gold import gold_dispensary_backlog

    _save(spark, [
        # in scope: 261, open, not deleted
        Row(reservation_number="1", reservation_item="1", order_number="900", plant_code="C061",
            production_supply_area="PSA1", warehouse_number="208", movement_type_code="261",
            required_quantity=100.0, withdrawn_quantity=40.0, open_quantity=60.0,
            requirement_date=None, is_deletion_flagged=False),
        Row(reservation_number="1", reservation_item="2", order_number="900", plant_code="C061",
            production_supply_area="PSA1", warehouse_number="208", movement_type_code="261",
            required_quantity=50.0, withdrawn_quantity=0.0, open_quantity=50.0,
            requirement_date=None, is_deletion_flagged=False),
        # excluded: not 261
        Row(reservation_number="2", reservation_item="1", order_number="901", plant_code="C061",
            production_supply_area="PSA1", warehouse_number="208", movement_type_code="101",
            required_quantity=10.0, withdrawn_quantity=0.0, open_quantity=10.0,
            requirement_date=None, is_deletion_flagged=False),
        # excluded: deletion flagged
        Row(reservation_number="3", reservation_item="1", order_number="902", plant_code="C061",
            production_supply_area="PSA1", warehouse_number="208", movement_type_code="261",
            required_quantity=10.0, withdrawn_quantity=0.0, open_quantity=10.0,
            requirement_date=None, is_deletion_flagged=True),
        # excluded: nothing open
        Row(reservation_number="4", reservation_item="1", order_number="903", plant_code="C061",
            production_supply_area="PSA1", warehouse_number="208", movement_type_code="261",
            required_quantity=10.0, withdrawn_quantity=10.0, open_quantity=0.0,
            requirement_date=None, is_deletion_flagged=False),
    ], "reservation_requirement")
    _save(spark, [Row(order_number="900", scheduled_start_date=None)], "process_order")

    rows = all_rows(gold_dispensary_backlog())
    assert len(rows) == 1
    r = rows[0]
    assert r["open_task_count"] == 2
    assert r["open_order_count"] == 1
    assert r["total_open_qty"] == 110.0


# ── Delivery pick status ──────────────────────────────────────────────────────

def test_delivery_pick_fraction(spark):
    from gold.warehouse_flow_gold import gold_delivery_pick_status

    _save(spark, [
        Row(delivery_number="80001", item_number="10", plant_code="C061", warehouse_number="208",
            delivery_type="LF", sold_to_customer="C1", planned_goods_issue_date=None,
            delivery_quantity=60.0, picked_quantity=30.0, actual_goods_issue_date=None),
        Row(delivery_number="80001", item_number="20", plant_code="C061", warehouse_number="208",
            delivery_type="LF", sold_to_customer="C1", planned_goods_issue_date=None,
            delivery_quantity=40.0, picked_quantity=40.0, actual_goods_issue_date=None),
    ], "outbound_delivery")

    rows = all_rows(gold_delivery_pick_status())
    assert len(rows) == 1
    r = rows[0]
    assert r["line_count"] == 2
    assert r["delivery_qty"] == 100.0
    assert r["picked_qty"] == 70.0
    assert r["pick_fraction"] == 0.7
    assert r["is_shipped"] is False


# ── Stock reconciliation ──────────────────────────────────────────────────────

def test_stock_reconciliation_delta_and_match(spark):
    from gold.warehouse_flow_gold import gold_stock_reconciliation

    _save(spark, [
        Row(material_code="M1", plant_code="C061", storage_location_code="1000",
            unrestricted_quantity=100.0, quality_inspection_quantity=0.0, blocked_quantity=0.0,
            restricted_use_quantity=0.0, in_transfer_quantity=0.0),
        Row(material_code="M2", plant_code="C061", storage_location_code="1000",
            unrestricted_quantity=50.0, quality_inspection_quantity=0.0, blocked_quantity=0.0,
            restricted_use_quantity=0.0, in_transfer_quantity=0.0),
    ], "stock_at_location")
    _save(spark, [
        # M1 WM matches IM (100 total: 80 physical in 100, 20 interim in 902)
        Row(plant_code="C061", warehouse_number="208", storage_type="100", material_code="M1", quant_number="Q1", total_quantity=80.0),
        Row(plant_code="C061", warehouse_number="208", storage_type="902", material_code="M1", quant_number="Q12", total_quantity=20.0),
        # M2 WM short (30 vs 50 -> variance, all physical in 100)
        Row(plant_code="C061", warehouse_number="208", storage_type="100", material_code="M2", quant_number="Q2", total_quantity=30.0),
    ], "storage_bin")
    _save(spark, [
        Row(material_code="M1", valuation_area="C061", standard_price=10.0, price_unit=1),
        Row(material_code="M2", valuation_area="C061", standard_price=2.0, price_unit=1),
    ], "material_valuation")

    rows = {r["material_code"]: r for r in all_rows(gold_stock_reconciliation())}
    assert rows["M1"]["delta_qty"] == 0.0
    assert rows["M1"]["wm_total_qty"] == 100.0
    assert rows["M1"]["wm_physical_qty"] == 80.0
    assert rows["M1"]["wm_interim_qty"] == 20.0
    assert rows["M1"]["mismatch_class"] == "match"
    assert rows["M1"]["inventory_value"] == 1000.0
    
    assert rows["M2"]["delta_qty"] == 20.0
    assert rows["M2"]["wm_total_qty"] == 30.0
    assert rows["M2"]["wm_physical_qty"] == 30.0
    assert rows["M2"]["wm_interim_qty"] == 0.0
    assert rows["M2"]["mismatch_class"] == "variance"
    # M1 is the higher-value line -> ABC class A
    assert rows["M1"]["abc_class"] == "A"


# ── Line-side stock ───────────────────────────────────────────────────────────

# ── Process order staging trust (is_operationally_trusted) ───────────────────

def test_staging_trusted_for_configured_plant(spark):
    """Plant in config with is_validated=true → is_operationally_trusted=true."""
    from gold.warehouse_flow_gold import gold_process_order_staging

    _save(spark, [
        Row(order_number="1001", plant_code="C061", material_code="M1", order_quantity=100.0,
            scheduled_start_date=None, scheduled_finish_date=None,
            is_released=True, is_closed=False),
    ], "process_order")
    _save(spark, [
        Row(warehouse_number="208", transfer_order_number="T1", item_number="1",
            source_reference_type="F", source_reference_number="1001",
            item_status="Open", created_datetime=None),
    ], "warehouse_transfer_order")

    rows = {r["order_number"]: r for r in all_rows(gold_process_order_staging())}
    assert rows["1001"]["is_operationally_trusted"] is True


def test_staging_untrusted_for_unconfigured_plant(spark):
    """Plant absent from config → is_operationally_trusted=false (no silent default to trusted)."""
    from gold.warehouse_flow_gold import gold_process_order_staging

    _save(spark, [
        Row(order_number="2001", plant_code="UNKNOWN", material_code="M1", order_quantity=50.0,
            scheduled_start_date=None, scheduled_finish_date=None,
            is_released=True, is_closed=False),
    ], "process_order")
    _save(spark, [], "warehouse_transfer_order")

    rows = {r["order_number"]: r for r in all_rows(gold_process_order_staging())}
    assert rows["2001"]["is_operationally_trusted"] is False


# ── Process order staging validation ─────────────────────────────────────────

def test_staging_validation_validated(spark):
    """A warehouse with F-type TOs that all match process orders → VALIDATED."""
    from gold.warehouse_flow_gold import gold_process_order_staging_validation

    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", transfer_order_number="T1",
            source_reference_type="F", source_reference_number="1001", created_datetime=None),
        Row(plant_code="C061", warehouse_number="208", transfer_order_number="T1",
            source_reference_type="F", source_reference_number="1001", created_datetime=None),  # dupe item same TO
        Row(plant_code="C061", warehouse_number="208", transfer_order_number="T2",
            source_reference_type="F", source_reference_number="1002", created_datetime=None),
        Row(plant_code="C061", warehouse_number="208", transfer_order_number="T3",
            source_reference_type="X", source_reference_number="9999", created_datetime=None),  # non-F
    ], "warehouse_transfer_order")
    _save(spark, [
        Row(order_number="1001"), Row(order_number="1002"),
    ], "process_order")

    rows = {(r["plant_code"], r["warehouse_number"]): r
            for r in all_rows(gold_process_order_staging_validation())}
    r = rows[("C061", "208")]
    assert r["total_to_headers"] == 3       # T1, T2, T3
    assert r["f_type_to_headers"] == 2      # T1, T2 (BETYP=F)
    assert r["f_type_benum_matched"] == 2   # both resolve to known orders
    assert r["benum_match_pct"] == 100.0
    assert r["validation_status"] == "VALIDATED"


def test_staging_validation_not_applicable(spark):
    """A warehouse with zero F-type TOs → NOT_APPLICABLE."""
    from gold.warehouse_flow_gold import gold_process_order_staging_validation

    _save(spark, [
        Row(plant_code="P749", warehouse_number="501", transfer_order_number="T9",
            source_reference_type="X", source_reference_number="9999", created_datetime=None),
    ], "warehouse_transfer_order")
    _save(spark, [Row(order_number="9999")], "process_order")

    rows = {(r["plant_code"], r["warehouse_number"]): r
            for r in all_rows(gold_process_order_staging_validation())}
    r = rows[("P749", "501")]
    assert r["f_type_to_headers"] == 0
    assert r["benum_match_pct"] is None
    assert r["validation_status"] == "NOT_APPLICABLE"


def test_staging_validation_not_validated(spark):
    """A warehouse with F-type TOs where BENUM does not resolve → NOT_VALIDATED."""
    from gold.warehouse_flow_gold import gold_process_order_staging_validation

    _save(spark, [
        Row(plant_code="P001", warehouse_number="201", transfer_order_number="TX",
            source_reference_type="F", source_reference_number="9999", created_datetime=None),
    ], "warehouse_transfer_order")
    _save(spark, [Row(order_number="DIFFERENT")], "process_order")

    rows = {(r["plant_code"], r["warehouse_number"]): r
            for r in all_rows(gold_process_order_staging_validation())}
    r = rows[("P001", "201")]
    assert r["f_type_to_headers"] == 1
    assert r["f_type_benum_matched"] == 0
    assert r["benum_match_pct"] == 0.0
    assert r["validation_status"] == "NOT_VALIDATED"


def test_staging_validation_deduplicates_to_headers(spark):
    """Multiple LTAP items under the same TO header count as one TO, not many."""
    from gold.warehouse_flow_gold import gold_process_order_staging_validation

    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", transfer_order_number="T1",
            source_reference_type="F", source_reference_number="1001", created_datetime=None),
        Row(plant_code="C061", warehouse_number="208", transfer_order_number="T1",
            source_reference_type="F", source_reference_number="1001", created_datetime=None),
        Row(plant_code="C061", warehouse_number="208", transfer_order_number="T1",
            source_reference_type="F", source_reference_number="1001", created_datetime=None),
    ], "warehouse_transfer_order")
    _save(spark, [Row(order_number="1001")], "process_order")

    rows = {(r["plant_code"], r["warehouse_number"]): r
            for r in all_rows(gold_process_order_staging_validation())}
    r = rows[("C061", "208")]
    assert r["total_to_headers"] == 1       # 3 items → 1 header
    assert r["f_type_to_headers"] == 1
    assert r["f_type_benum_matched"] == 1


def test_lineside_stock_aggregation(spark):
    from gold.warehouse_flow_gold import gold_lineside_stock

    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100",
            material_code="M1", batch_number="B1", base_uom="KG", quant_number="Q1",
            total_quantity=50.0, available_quantity=40.0, expiry_date=None, goods_receipt_date=None),
        Row(plant_code="C061", warehouse_number="208", storage_type="100",
            material_code="M1", batch_number="B1", base_uom="KG", quant_number="Q2",
            total_quantity=10.0, available_quantity=10.0, expiry_date=None, goods_receipt_date=None),
        # Excluded storage type (not mapped in reference table to role LINESIDE)
        Row(plant_code="C061", warehouse_number="208", storage_type="999",
            material_code="M1", batch_number="B1", base_uom="KG", quant_number="Q3",
            total_quantity=99.0, available_quantity=99.0, expiry_date=None, goods_receipt_date=None),
    ], "storage_bin")

    rows = all_rows(gold_lineside_stock())
    assert len(rows) == 1
    r = rows[0]
    assert r["quant_count"] == 2
    assert r["total_qty"] == 60.0
    assert r["available_qty"] == 50.0
