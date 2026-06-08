"""
Tests for warehouse-flow Gold tables (gold/warehouse_flow_gold.py).

Pattern follows tests/test_gold_warehouse.py: create the required silver tables in
the local spark_catalog `silver` database, call the Gold function directly, assert
on the aggregation results.
"""

import datetime

import pytest
from pyspark.sql import Row, SparkSession

from silver.movement_types import build_movement_type_classification_records
from tests.conftest import all_rows, create_df


@pytest.fixture(scope="module", autouse=True)
def setup_silver(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")

    _save(
        spark,
        build_movement_type_classification_records(["101", "261"]),
        "movement_type_classification",
    )

    # Seed default storage type role mapping configuration table
    _save(spark, [
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208",
            storage_type="100", storage_type_description="Production Supply", role="LINESIDE"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="208",
            storage_type="801", storage_type_description="Palletising (for Prodc.)", role="LINESIDE"),
    ], "storage_type_role_mapping")

    # Seed warehouse_storage_location_mapping (T320) — needed for recon v2
    _save(spark, [
        Row(plant_code="C061", storage_location_code="1000", warehouse_number="208"),
        Row(plant_code="C061", storage_location_code="2000", warehouse_number="208"),
    ], "warehouse_storage_location_mapping")

    # Seed material_uom_conversion (MARM) — needed for UOM detection in recon v2
    _save(spark, [
        Row(material_code="M1", alternate_uom="KG", numerator=1.0, denominator=1.0,
            conversion_factor_to_base=1.0, is_valid_conversion=True),
    ], "material_uom_conversion")

    _save(spark, [
        Row(plant_code="C061", material_code="M1", material_description="Material One"),
        Row(plant_code="C061", material_code="M2", material_description="Material Two"),
    ], "material")

    _save(spark, [
        Row(customer_code="SHIP1", customer_name="Ship-To Customer"),
        Row(customer_code="SOLD1", customer_name="Sold-To Customer"),
        Row(customer_code="C1", customer_name="Legacy Customer"),
    ], "customer")

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


def _save_empty(spark, table):
    """Save a dummy row with zero quantities to define schema and act as empty table."""
    if table == "stock_at_location":
        rows = [Row(material_code="DUMMY", plant_code="DUMMY", storage_location_code="DUMMY",
                    unrestricted_quantity=0.0, quality_inspection_quantity=0.0,
                    blocked_quantity=0.0, restricted_use_quantity=0.0, in_transfer_quantity=0.0,
                    blocked_returns_quantity=0.0)]
    elif table == "batch_stock":
        rows = [Row(material_code="DUMMY", plant_code="DUMMY", storage_location_code="DUMMY",
                    batch_number="DUMMY", base_uom="DUMMY",
                    unrestricted_quantity=0.0, quality_inspection_quantity=0.0,
                    blocked_quantity=0.0, restricted_use_quantity=0.0, in_transfer_quantity=0.0,
                    blocked_returns_quantity=0.0)]
    elif table == "storage_bin":
        rows = [Row(plant_code="DUMMY", warehouse_number="DUMMY", storage_type="DUMMY",
                    material_code="DUMMY", batch_number="DUMMY", base_uom="DUMMY",
                    stock_category_code="DUMMY", total_quantity=0.0, quant_number="DUMMY")]
    else:
        rows = []
    _save(spark, rows, table)


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
            delivery_type="LF", ship_to_customer="SHIP1", sold_to_customer="SOLD1",
            planned_goods_issue_date=None, actual_goods_issue_date=None, delivery_date=None,
            delivery_gross_weight=123.4, delivery_weight_unit="KG",
            delivery_quantity=6.0, sales_uom="CS", base_uom="KG",
            delivery_quantity_base=60.0, actual_delivered_base_quantity=30.0,
            picked_quantity=30.0, gross_weight=60.0, weight_unit="KG"),
        Row(delivery_number="80001", item_number="20", plant_code="C061", warehouse_number="208",
            delivery_type="LF", ship_to_customer="SHIP1", sold_to_customer="SOLD1",
            planned_goods_issue_date=None, actual_goods_issue_date=datetime.date(2026, 6, 1),
            delivery_date=None,
            delivery_gross_weight=123.4, delivery_weight_unit="KG",
            delivery_quantity=4.0, sales_uom="CS", base_uom="KG",
            delivery_quantity_base=40.0, actual_delivered_base_quantity=40.0,
            picked_quantity=40.0, gross_weight=40.0, weight_unit="KG"),
        Row(delivery_number="80002", item_number="10", plant_code="C061", warehouse_number="208",
            delivery_type="LF", ship_to_customer="SHIP1", sold_to_customer="SOLD1",
            planned_goods_issue_date=None, actual_goods_issue_date=None, delivery_date=None,
            delivery_gross_weight=None, delivery_weight_unit="KG",
            delivery_quantity=1.0, sales_uom="PAL", base_uom="KG",
            delivery_quantity_base=100.0, actual_delivered_base_quantity=50.0,
            picked_quantity=50.0, gross_weight=10.0, weight_unit="KG"),
        Row(delivery_number="80002", item_number="20", plant_code="C061", warehouse_number="208",
            delivery_type="LF", ship_to_customer="SHIP1", sold_to_customer="SOLD1",
            planned_goods_issue_date=None, actual_goods_issue_date=None, delivery_date=None,
            delivery_gross_weight=None, delivery_weight_unit="KG",
            delivery_quantity=1.0, sales_uom="EA", base_uom="EA",
            delivery_quantity_base=1.0, actual_delivered_base_quantity=1.0,
            picked_quantity=1.0, gross_weight=1.0, weight_unit="KG"),
        Row(delivery_number="80003", item_number="10", plant_code="C061", warehouse_number="208",
            delivery_type="LF", ship_to_customer="SHIP1", sold_to_customer="SOLD1",
            planned_goods_issue_date=None, actual_goods_issue_date=None, delivery_date=None,
            delivery_gross_weight=80.0, delivery_weight_unit="KG",
            delivery_quantity=2.0, sales_uom="CS", base_uom="KG",
            delivery_quantity_base=None, actual_delivered_base_quantity=20.0,
            picked_quantity=20.0, gross_weight=20.0, weight_unit="KG"),
        Row(delivery_number="80003", item_number="20", plant_code="C061", warehouse_number="208",
            delivery_type="LF", ship_to_customer="SHIP1", sold_to_customer="SOLD1",
            planned_goods_issue_date=None, actual_goods_issue_date=None, delivery_date=None,
            delivery_gross_weight=80.0, delivery_weight_unit="KG",
            delivery_quantity=4.0, sales_uom="CS", base_uom="KG",
            delivery_quantity_base=40.0, actual_delivered_base_quantity=20.0,
            picked_quantity=20.0, gross_weight=40.0, weight_unit="KG"),
    ], "outbound_delivery")

    rows = {r["delivery_number"]: r for r in all_rows(gold_delivery_pick_status())}
    assert len(rows) == 3
    r = rows["80001"]
    assert r["line_count"] == 2
    assert r["delivery_qty"] == 100.0
    assert r["picked_qty"] == 70.0
    assert r["base_uom_count"] == 1
    assert r["null_delivery_base_count"] == 0
    assert r["has_mixed_base_uom"] is False
    assert r["has_unconverted_delivery_qty"] is False
    assert r["pick_fraction"] == 0.7
    assert r["is_shipped"] is True
    assert r["actual_goods_issue_date"] == datetime.date(2026, 6, 1)
    assert r["customer_id"] == "SHIP1"
    assert r["customer_name"] == "Ship-To Customer"
    assert r["ship_to_customer"] == "SHIP1"
    assert r["ship_to_customer_name"] == "Ship-To Customer"
    assert r["sold_to_customer"] == "SOLD1"
    assert r["sold_to_customer_name"] == "Sold-To Customer"
    assert r["gross_weight"] == 123.4
    assert r["gross_weight_unit"] == "KG"

    mixed = rows["80002"]
    assert mixed["base_uom_count"] == 2
    assert mixed["null_delivery_base_count"] == 0
    assert mixed["has_mixed_base_uom"] is True
    assert mixed["has_unconverted_delivery_qty"] is False
    assert mixed["pick_fraction"] is None
    assert mixed["gross_weight"] is None
    assert mixed["gross_weight_unit"] == "KG"

    unconverted = rows["80003"]
    assert unconverted["base_uom_count"] == 1
    assert unconverted["null_delivery_base_count"] == 1
    assert unconverted["has_mixed_base_uom"] is False
    assert unconverted["has_unconverted_delivery_qty"] is True
    assert unconverted["delivery_qty"] == 40.0
    assert unconverted["picked_qty"] == 40.0
    assert unconverted["pick_fraction"] is None


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
    # Storage type 902 is not in the config seed → FALLBACK used → plant not trusted
    assert rows["M1"]["is_operationally_trusted"] is False
    assert rows["M2"]["is_operationally_trusted"] is False


def test_stock_reconciliation_trusted_when_all_config(spark):
    """Plant is trusted when all occupied bins have CONFIG-sourced roles (no FALLBACK)."""
    from gold.warehouse_flow_gold import gold_stock_reconciliation

    _save(spark, [
        Row(material_code="M1", plant_code="C061", storage_location_code="1000",
            unrestricted_quantity=100.0, quality_inspection_quantity=0.0, blocked_quantity=0.0,
            restricted_use_quantity=0.0, in_transfer_quantity=0.0),
    ], "stock_at_location")
    # Only storage types that ARE in the config (100=LINESIDE, 801=LINESIDE)
    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100", material_code="M1", quant_number="Q1", total_quantity=100.0),
        Row(plant_code="C061", warehouse_number="208", storage_type="801", material_code="M1", quant_number="Q2", total_quantity=10.0),
    ], "storage_bin")
    _save(spark, [
        Row(material_code="M1", valuation_area="C061", standard_price=1.0, price_unit=1),
    ], "material_valuation")

    rows = {r["material_code"]: r for r in all_rows(gold_stock_reconciliation())}
    assert rows["M1"]["is_operationally_trusted"] is True


# ── Storage-type role coverage status ────────────────────────────────────────

def test_storage_type_role_coverage_validated(spark):
    """All in-use STs are config-mapped → VALIDATED."""
    from gold.warehouse_flow_gold import gold_storage_type_role_coverage_status

    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100", quant_number="Q1"),
        Row(plant_code="C061", warehouse_number="208", storage_type="801", quant_number="Q2"),
    ], "storage_bin")
    # Both STs are in setup_silver mapping (100=LINESIDE, 801=LINESIDE)

    rows = {(r["plant_code"], r["warehouse_number"]): r
            for r in all_rows(gold_storage_type_role_coverage_status())}
    r = rows[("C061", "208")]
    assert r["total_storage_types"] == 2
    assert r["mapped_storage_types"] == 2
    assert r["unmapped_storage_types"] == 0
    assert r["coverage_pct"] == 100.0
    assert r["coverage_status"] == "VALIDATED"


def test_storage_type_role_coverage_partial(spark):
    """Some STs mapped, some not → PARTIAL."""
    from gold.warehouse_flow_gold import gold_storage_type_role_coverage_status

    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100", quant_number="Q1"),
        Row(plant_code="C061", warehouse_number="208", storage_type="300", quant_number="Q2"),  # unmapped
    ], "storage_bin")

    rows = {(r["plant_code"], r["warehouse_number"]): r
            for r in all_rows(gold_storage_type_role_coverage_status())}
    r = rows[("C061", "208")]
    assert r["total_storage_types"] == 2
    assert r["mapped_storage_types"] == 1
    assert r["unmapped_storage_types"] == 1
    assert r["coverage_status"] == "PARTIAL"


def test_storage_type_role_coverage_missing(spark):
    """No config rows for this warehouse → MISSING."""
    from gold.warehouse_flow_gold import gold_storage_type_role_coverage_status

    _save(spark, [
        Row(plant_code="P749", warehouse_number="501", storage_type="100", quant_number="Q1"),
    ], "storage_bin")
    # P749/501 has no config entry (setup_silver only seeds C061/208)

    rows = {(r["plant_code"], r["warehouse_number"]): r
            for r in all_rows(gold_storage_type_role_coverage_status())}
    r = rows[("P749", "501")]
    assert r["total_storage_types"] == 1
    assert r["mapped_storage_types"] == 0
    assert r["coverage_status"] == "MISSING"


# ── Line-side stock ───────────────────────────────────────────────────────────

# ── Process order staging trust (is_operationally_trusted) ───────────────────

def test_staging_trusted_for_configured_plant(spark):
    """Plant in config with is_validated=true → is_operationally_trusted=true."""
    from gold.warehouse_flow_gold import gold_process_order_staging

    _save(spark, [
        Row(order_number="1001", plant_code="C061", material_code="M1", order_quantity=100.0,
            order_quantity_uom="KG", scheduled_start_date=None, scheduled_finish_date=None,
            is_released=True, is_closed=False),
    ], "process_order")
    _save(spark, [
        Row(warehouse_number="208", transfer_order_number="T1", item_number="1",
            source_reference_type="F", source_reference_number="1001",
            item_status="Open", created_datetime=None),
    ], "warehouse_transfer_order")

    rows = {r["order_number"]: r for r in all_rows(gold_process_order_staging())}
    assert rows["1001"]["is_operationally_trusted"] is True
    assert rows["1001"]["material_name"] == "Material One"
    assert rows["1001"]["uom"] == "KG"


def test_staging_untrusted_for_unconfigured_plant(spark):
    """Plant absent from config → is_operationally_trusted=false (no silent default to trusted)."""
    from gold.warehouse_flow_gold import gold_process_order_staging

    _save(spark, [
        Row(order_number="2001", plant_code="UNKNOWN", material_code="M1", order_quantity=50.0,
            order_quantity_uom="KG", scheduled_start_date=None, scheduled_finish_date=None,
            is_released=True, is_closed=False),
    ], "process_order")
    # warehouse_transfer_order intentionally not re-seeded: trust derives from the config table,
    # not from whether the plant has any TOs. Parquet cannot save a schema-less empty DataFrame.

    rows = {r["order_number"]: r for r in all_rows(gold_process_order_staging())}
    assert rows["2001"]["is_operationally_trusted"] is False


def test_staging_untrusted_when_config_table_absent(spark):
    """Missing bootstrap config must not fail Gold; all active plants are conservative/untrusted."""
    from gold.warehouse_flow_gold import gold_process_order_staging

    _save(spark, [
        Row(order_number="3001", plant_code="C061", material_code="M1", order_quantity=50.0,
            order_quantity_uom="KG", scheduled_start_date=None, scheduled_finish_date=None,
            is_released=True, is_closed=False),
    ], "process_order")
    _save(spark, [
        Row(warehouse_number="208", transfer_order_number="T1", item_number="1",
            source_reference_type="F", source_reference_number="3001",
            item_status="Open", created_datetime=None),
    ], "warehouse_transfer_order")

    spark.sql("DROP TABLE IF EXISTS silver.process_order_staging_reference_mapping_config")
    try:
        rows = {r["order_number"]: r for r in all_rows(gold_process_order_staging())}
        assert rows["3001"]["is_operationally_trusted"] is False
    finally:
        _save(spark, [
            Row(plant_code="C061", warehouse_number="208",
                staging_reference_strategy="BENUM_EQUALS_AUFNR", is_validated=True,
                validated_by="profiling-2026-06-02", validated_at=None, notes=None),
        ], "process_order_staging_reference_mapping_config")


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


# ── Stock reconciliation v2 ───────────────────────────────────────────────────

def test_recon_v2_matched(spark):
    """Batch-managed material with matching IM (MCHB) and WM quantities → MATCHED."""
    from gold.warehouse_flow_gold import gold_stock_reconciliation_v2

    _save(spark, [
        Row(material_code="M1", plant_code="C061", base_uom="KG",
            batch_management_required=True, material_description="Mat 1"),
    ], "material")
    _save(spark, [
        Row(material_code="M1", plant_code="C061", storage_location_code="1000",
            batch_number="B1", base_uom="KG",
            unrestricted_quantity=100.0, quality_inspection_quantity=0.0,
            blocked_quantity=0.0, restricted_use_quantity=0.0, in_transfer_quantity=0.0,
            blocked_returns_quantity=0.0),
    ], "batch_stock")
    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100",
            material_code="M1", batch_number="B1", base_uom="KG",
            stock_category_code="", total_quantity=100.0, quant_number="Q1"),
    ], "storage_bin")
    _save_empty(spark, "stock_at_location")
    _save(spark, [Row(valuation_area="C061", material_code="M1",
                      standard_price=5.0, price_unit=1)], "material_valuation")

    rows = {r["batch_number"]: r for r in all_rows(gold_stock_reconciliation_v2())}
    r = rows["B1"]
    assert r["im_quantity"] == 100.0
    assert r["wm_quantity"] == 100.0
    assert r["delta_quantity"] == 0.0
    assert r["is_reconciled"] is True
    assert r["mismatch_reason"] == "MATCHED"
    assert r["mismatch_severity"] == "INFO"
    assert r["tolerance_exceeded"] is False
    assert r["tolerance_rule_code"] == "DEFAULT_0_1_PCT_FLOOR_0_001"
    assert r["reconciliation_rule_version"] == "2.1"


def test_recon_v2_batch_missing_in_wm(spark):
    """IM has stock, WM has nothing → BATCH_MISSING_IN_WM."""
    from gold.warehouse_flow_gold import gold_stock_reconciliation_v2

    _save(spark, [
        Row(material_code="M2", plant_code="C061", base_uom="KG",
            batch_management_required=True, material_description="Mat 2"),
    ], "material")
    _save(spark, [
        Row(material_code="M2", plant_code="C061", storage_location_code="1000",
            batch_number="B2", base_uom="KG",
            unrestricted_quantity=50.0, quality_inspection_quantity=0.0,
            blocked_quantity=0.0, restricted_use_quantity=0.0, in_transfer_quantity=0.0,
            blocked_returns_quantity=0.0),
    ], "batch_stock")
    _save_empty(spark, "storage_bin")
    _save_empty(spark, "stock_at_location")
    _save(spark, [Row(valuation_area="C061", material_code="M2",
                      standard_price=2.0, price_unit=1)], "material_valuation")

    rows = {r["batch_number"]: r for r in all_rows(gold_stock_reconciliation_v2())}
    r = rows["B2"]
    assert r["im_quantity"] == 50.0
    assert r["wm_quantity"] == 0.0
    assert r["is_reconciled"] is False
    assert r["mismatch_reason"] == "BATCH_MISSING_IN_WM"
    assert r["mismatch_severity"] == "MEDIUM"
    assert r["tolerance_exceeded"] is True
    assert r["delta_percent"] == -1.0


def test_stock_value_reconciliation_rollup(spark, monkeypatch):
    import gold.warehouse_flow_gold as flow
    from gold.warehouse_flow_gold import gold_stock_value_reconciliation

    recon_df = create_df(spark, [
        Row(plant_code="C061", warehouse_number="208", mismatch_reason="MATCHED",
            mismatch_severity="INFO", tolerance_exceeded=False, delta_value=0.0,
            abs_delta_quantity=0.0),
        Row(plant_code="C061", warehouse_number="208", mismatch_reason="TRUE_VARIANCE",
            mismatch_severity="HIGH", tolerance_exceeded=True, delta_value=-25.0,
            abs_delta_quantity=5.0),
    ])
    monkeypatch.setattr(flow.dlt, "read", lambda _: recon_df)

    rows = {r["mismatch_reason"]: r for r in all_rows(gold_stock_value_reconciliation())}

    assert rows["MATCHED"]["value_reconciliation_status"] == "RECONCILED"
    assert rows["TRUE_VARIANCE"]["tolerance_exceeded_count"] == 1
    assert rows["TRUE_VARIANCE"]["abs_delta_value"] == 25.0
    assert rows["TRUE_VARIANCE"]["value_reconciliation_status"] == "ACTION_REQUIRED"


def test_movement_reconciliation_flags_im_and_wm_activity(spark):
    from gold.warehouse_flow_gold import gold_movement_reconciliation

    _save(spark, [
        Row(plant_code="C061", storage_location_code="1000", posting_date=datetime.date(2026, 6, 3),
            movement_type_code="101", material_code="M_MOVE", batch_number="B_MOVE",
            base_uom="KG", quantity=100.0, amount_local_currency=250.0),
    ], "goods_movement")
    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", confirmed_date=datetime.date(2026, 6, 3),
            material_code="M_MOVE", batch_number="B_MOVE", base_uom="KG",
            confirmed_quantity=95.0),
    ], "warehouse_transfer_order")

    rows = all_rows(gold_movement_reconciliation())
    assert len(rows) == 1
    assert rows[0]["movement_reconciliation_status"] == "MATCHED_ACTIVITY"
    assert rows[0]["delta_quantity"] == -5.0


def test_hu_reconciliation_compares_packed_to_wm_quant(spark):
    from gold.warehouse_flow_gold import gold_hu_reconciliation

    _save(spark, [
        Row(handling_unit_number="HU1", item_number="1", sscc="SSCC1",
            plant_code="C061", warehouse_number="208", material_code="M_HU",
            batch_number="B_HU", packed_quantity=10.0, packed_uom="KG"),
    ], "handling_unit")
    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100",
            material_code="M_HU", batch_number="B_HU", base_uom="KG",
            stock_category_code="", total_quantity=12.0, quant_number="Q_HU"),
    ], "storage_bin")

    rows = all_rows(gold_hu_reconciliation())
    assert len(rows) == 1
    assert rows[0]["hu_reconciliation_status"] == "QUANTITY_VARIANCE"
    assert rows[0]["delta_quantity"] == 2.0


def test_physical_inventory_recon_statuses_count_difference(spark):
    from gold.warehouse_flow_gold import gold_physical_inventory_recon

    _save(spark, [
        Row(physical_inventory_document_number="PI1", fiscal_year="2026", item_number="1",
            plant_code="C061", storage_location_code="1000", material_code="M_PI",
            batch_number="B_PI", stock_type_code="", base_uom="KG", document_date=None,
            planned_count_date=None, count_date=None, posting_date=None,
            book_quantity=100.0, counted_quantity=97.0, difference_amount_local_currency=-30.0,
            currency="GBP", is_counted=True, is_difference_posted=False, is_recount_required=False,
            has_posting_block=False, is_book_inventory_frozen=True, material_document_number=None,
            material_document_year=None, material_document_item=None, difference_reason_code="001",
            cycle_counting_indicator="A", is_deleted=False, _replicated_at=None),
    ], "physical_inventory_document")

    rows = all_rows(gold_physical_inventory_recon())
    assert len(rows) == 1
    assert rows[0]["delta_quantity"] == -3.0
    assert rows[0]["physical_inventory_status"] == "DIFFERENCE_NOT_POSTED"


def test_reconciliation_audit_log_filters_exceptions(spark, monkeypatch):
    import gold.warehouse_flow_gold as flow
    from gold.warehouse_flow_gold import gold_reconciliation_audit_log

    recon_df = create_df(spark, [
        Row(plant_code="C061", warehouse_number="208", material_code="M1", batch_number="B1",
            stock_category="UNRESTRICTED", base_uom="KG", im_quantity=100.0, wm_quantity=100.0,
            delta_quantity=0.0, abs_delta_quantity=0.0, delta_percent=0.0, tolerance_quantity=0.1, delta_value=0.0,
            tolerance_exceeded=False, mismatch_reason="MATCHED", mismatch_severity="INFO",
            tolerance_rule_code="DEFAULT_0_1_PCT_FLOOR_0_001",
            reconciliation_rule_version="2.1", is_operationally_trusted=True,
            audit_trail_json="{}", last_reconciled_at=None),
        Row(plant_code="C061", warehouse_number="208", material_code="M2", batch_number="B2",
            stock_category="UNRESTRICTED", base_uom="KG", im_quantity=50.0, wm_quantity=0.0,
            delta_quantity=-50.0, abs_delta_quantity=50.0, delta_percent=-1.0, tolerance_quantity=0.05, delta_value=-100.0,
            tolerance_exceeded=True, mismatch_reason="BATCH_MISSING_IN_WM", mismatch_severity="MEDIUM",
            tolerance_rule_code="DEFAULT_0_1_PCT_FLOOR_0_001",
            reconciliation_rule_version="2.1", is_operationally_trusted=True,
            audit_trail_json="{}", last_reconciled_at=None),
    ])
    monkeypatch.setattr(flow.dlt, "read", lambda _: recon_df)

    rows = all_rows(gold_reconciliation_audit_log())

    assert len(rows) == 1
    assert rows[0]["audit_event_key"] == "C061|208|M2|B2|UNRESTRICTED|KG|BATCH_MISSING_IN_WM"
    assert rows[0]["source_table"] == "gold_stock_reconciliation_v2"


def test_reconciliation_alerts_unions_stock_hu_and_pi(monkeypatch, spark):
    import gold.warehouse_flow_gold as flow
    from gold.warehouse_flow_gold import gold_reconciliation_alerts

    tables = {
        "gold_reconciliation_audit_log": create_df(spark, [
            Row(audit_event_key="K1", mismatch_severity="HIGH", delta_value=500.0,
                plant_code="C061", warehouse_number="208", material_code="M1", batch_number="B1",
                mismatch_reason="TRUE_VARIANCE", delta_quantity=5.0, audit_trail_json="{}"),
        ]),
        "gold_hu_reconciliation": create_df(spark, [
            Row(plant_code="C061", warehouse_number="208", material_code="M2", batch_number="B2",
                base_uom="KG", hu_reconciliation_status="HU_WITHOUT_WM_QUANT",
                delta_quantity=-10.0, handling_unit_count=1, wm_quant_count=0, sscc_count=1),
        ]),
        "gold_physical_inventory_recon": create_df(spark, [
            Row(physical_inventory_document_number="PI1", fiscal_year="2026", item_number="1",
                plant_code="C061", material_code="M3", batch_number="B3",
                physical_inventory_status="RECOUNT_REQUIRED", delta_quantity=-2.0,
                delta_value=-20.0, count_date=None, posting_date=None, difference_reason_code="001"),
        ]),
    }
    monkeypatch.setattr(flow.dlt, "read", lambda name: tables[name])

    rows = {r["alert_type"]: r for r in all_rows(gold_reconciliation_alerts())}

    assert rows["STOCK_RECONCILIATION"]["alert_priority"] == "P1"
    assert rows["HU_RECONCILIATION"]["alert_priority"] == "P3"
    assert rows["PHYSICAL_INVENTORY"]["alert_priority"] == "P2"


def test_recon_v2_no_wm_mapping(spark):
    """Non-batch material in a sloc with no T320 WM mapping → WM_MANAGED_SLOC_MAPPING_MISSING."""
    from gold.warehouse_flow_gold import gold_stock_reconciliation_v2

    _save(spark, [
        Row(material_code="M3", plant_code="C061", base_uom="KG",
            batch_management_required=False, material_description="Mat 3"),
    ], "material")
    _save(spark, [
        Row(material_code="M3", plant_code="C061", storage_location_code="9999",  # no T320 entry
            unrestricted_quantity=10.0, quality_inspection_quantity=0.0,
            blocked_quantity=0.0, restricted_use_quantity=0.0, in_transfer_quantity=0.0,
            blocked_returns_quantity=0.0),
    ], "stock_at_location")
    _save_empty(spark, "batch_stock")
    _save_empty(spark, "storage_bin")
    _save(spark, [Row(valuation_area="C061", material_code="M3",
                      standard_price=1.0, price_unit=1)], "material_valuation")

    rows = {r["material_code"]: r for r in all_rows(gold_stock_reconciliation_v2())}
    r = rows["M3"]
    assert r["warehouse_number"] == "__NO_WM_MAPPING__"
    assert r["mismatch_reason"] == "WM_MANAGED_SLOC_MAPPING_MISSING"
    assert r["mismatch_severity"] == "HIGH"


def test_recon_v2_plant_scoped_routing(spark):
    """Same material code, batch-managed at PLANT_A but not at PLANT_B, routes correctly."""
    from gold.warehouse_flow_gold import gold_stock_reconciliation_v2

    _save(spark, [
        Row(material_code="M_ROUTING", plant_code="PLANT_A", base_uom="KG",
            batch_management_required=True, material_description="Mat Routing A"),
        Row(material_code="M_ROUTING", plant_code="PLANT_B", base_uom="KG",
            batch_management_required=False, material_description="Mat Routing B"),
    ], "material")

    # PLANT_A has batch-managed stock (routes to im_batch via MCHB)
    _save(spark, [
        Row(material_code="M_ROUTING", plant_code="PLANT_A", storage_location_code="1000",
            batch_number="B_A", base_uom="KG",
            unrestricted_quantity=100.0, quality_inspection_quantity=0.0,
            blocked_quantity=0.0, restricted_use_quantity=0.0, in_transfer_quantity=0.0,
            blocked_returns_quantity=0.0),
    ], "batch_stock")

    # PLANT_B has non-batch stock (routes to im_mard via MARD/stock_at_location)
    _save(spark, [
        Row(material_code="M_ROUTING", plant_code="PLANT_B", storage_location_code="1000",
            unrestricted_quantity=200.0, quality_inspection_quantity=0.0,
            blocked_quantity=0.0, restricted_use_quantity=0.0, in_transfer_quantity=0.0,
            blocked_returns_quantity=0.0),
    ], "stock_at_location")

    _save(spark, [
        Row(plant_code="PLANT_A", storage_location_code="1000", warehouse_number="WH_A"),
        Row(plant_code="PLANT_B", storage_location_code="1000", warehouse_number="WH_B"),
    ], "warehouse_storage_location_mapping")

    # WM storage bin empty (so we expect mismatch exception)
    _save_empty(spark, "storage_bin")

    _save(spark, [
        Row(valuation_area="PLANT_A", material_code="M_ROUTING", standard_price=1.0, price_unit=1),
        Row(valuation_area="PLANT_B", material_code="M_ROUTING", standard_price=1.0, price_unit=1),
    ], "material_valuation")

    results = all_rows(gold_stock_reconciliation_v2())
    rows = {(r["plant_code"], r["batch_number"]): r for r in results}

    # Should have two entries for M_ROUTING:
    # 1. PLANT_A, batch B_A, quantity 100.0
    # 2. PLANT_B, batch __NONE__, quantity 200.0
    assert ("PLANT_A", "B_A") in rows
    assert ("PLANT_B", "__NONE__") in rows
    assert len(rows) == 2

    r_a = rows[("PLANT_A", "B_A")]
    assert r_a["im_quantity"] == 100.0
    assert r_a["mismatch_reason"] == "BATCH_MISSING_IN_WM"

    r_b = rows[("PLANT_B", "__NONE__")]
    assert r_b["im_quantity"] == 200.0
    assert r_b["mismatch_reason"] == "BATCH_MISSING_IN_WM"


def test_staging_validation_threshold_configurable(spark):
    """The validation threshold can be configured via Spark conf."""
    import importlib

    import gold._shared
    import gold.warehouse_flow_gold

    # Save 10 TO headers: 9 matching, 1 not matching. Match rate = 90%
    to_rows = []
    for i in range(1, 10):
        to_rows.append(Row(plant_code="P_CONF", warehouse_number="WH_CONF", transfer_order_number=f"T{i}",
                           source_reference_type="F", source_reference_number=f"PO_{i}", created_datetime=None))
    to_rows.append(Row(plant_code="P_CONF", warehouse_number="WH_CONF", transfer_order_number="T10",
                       source_reference_type="F", source_reference_number="UNMATCHED", created_datetime=None))

    _save(spark, to_rows, "warehouse_transfer_order")

    po_rows = [Row(order_number=f"PO_{i}") for i in range(1, 10)]
    _save(spark, po_rows, "process_order")

    # 1. Test default behavior (no override or 95%) -> NOT_VALIDATED
    spark.conf.set("staging_validation_threshold_pct", "95.0")
    importlib.reload(gold._shared)
    importlib.reload(gold.warehouse_flow_gold)
    from gold.warehouse_flow_gold import gold_process_order_staging_validation

    rows = {(r["plant_code"], r["warehouse_number"]): r
            for r in all_rows(gold_process_order_staging_validation())}
    assert rows[("P_CONF", "WH_CONF")]["validation_status"] == "NOT_VALIDATED"

    # 2. Test override to 90.0% -> VALIDATED
    spark.conf.set("staging_validation_threshold_pct", "90.0")
    importlib.reload(gold._shared)
    importlib.reload(gold.warehouse_flow_gold)
    from gold.warehouse_flow_gold import gold_process_order_staging_validation

    rows = {(r["plant_code"], r["warehouse_number"]): r
            for r in all_rows(gold_process_order_staging_validation())}
    assert rows[("P_CONF", "WH_CONF")]["validation_status"] == "VALIDATED"

    # Cleanup
    spark.conf.unset("staging_validation_threshold_pct")
    importlib.reload(gold._shared)
    importlib.reload(gold.warehouse_flow_gold)


def test_recon_v2_unmapped_sloc_double_row(spark):
    """An unmapped sloc in IM and a mapped WM entry for same material/batch creates two rows, not one."""
    from gold.warehouse_flow_gold import gold_stock_reconciliation_v2

    _save(spark, [
        Row(material_code="M_UNMAPPED", plant_code="C061", base_uom="KG",
            batch_management_required=True, material_description="Mat Unmapped"),
    ], "material")

    # IM row has sloc 9999 (which is not mapped in warehouse_storage_location_mapping)
    _save(spark, [
        Row(material_code="M_UNMAPPED", plant_code="C061", storage_location_code="9999",
            batch_number="B_UNMAPPED", base_uom="KG",
            unrestricted_quantity=100.0, quality_inspection_quantity=0.0,
            blocked_quantity=0.0, restricted_use_quantity=0.0, in_transfer_quantity=0.0,
            blocked_returns_quantity=0.0),
    ], "batch_stock")

    # WM row has warehouse 208
    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100",
            material_code="M_UNMAPPED", batch_number="B_UNMAPPED", base_uom="KG",
            stock_category_code="", total_quantity=100.0, quant_number="Q_UNMAPPED"),
    ], "storage_bin")

    _save_empty(spark, "stock_at_location")

    # We do not map 9999 to any warehouse
    _save(spark, [
        Row(plant_code="C061", storage_location_code="1000", warehouse_number="208"),
    ], "warehouse_storage_location_mapping")

    _save(spark, [
        Row(valuation_area="C061", material_code="M_UNMAPPED", standard_price=1.0, price_unit=1),
    ], "material_valuation")

    results = all_rows(gold_stock_reconciliation_v2())
    # We filter to M_UNMAPPED results
    rows = [r for r in results if r["material_code"] == "M_UNMAPPED"]

    # We expect exactly 2 rows:
    # 1. IM side exception (warehouse = __NO_WM_MAPPING__, mismatch_reason = WM_MANAGED_SLOC_MAPPING_MISSING)
    # 2. WM side exception (warehouse = 208, mismatch_reason = BATCH_MISSING_IN_IM)
    assert len(rows) == 2

    # Map by warehouse number
    rows_by_wh = {r["warehouse_number"]: r for r in rows}
    assert "__NO_WM_MAPPING__" in rows_by_wh
    assert "208" in rows_by_wh

    r_im = rows_by_wh["__NO_WM_MAPPING__"]
    assert r_im["im_quantity"] == 100.0
    assert r_im["wm_quantity"] == 0.0
    assert r_im["mismatch_reason"] == "WM_MANAGED_SLOC_MAPPING_MISSING"

    r_wm = rows_by_wh["208"]
    assert r_wm["im_quantity"] == 0.0
    assert r_wm["wm_quantity"] == 100.0
    assert r_wm["mismatch_reason"] == "BATCH_MISSING_IN_IM"


def test_stock_reconciliation_summary_alias_adds_status(spark, monkeypatch):
    import gold.warehouse_flow_gold as flow
    from gold.warehouse_flow_gold import gold_stock_reconciliation_summary

    summary_df = create_df(spark, [
        Row(plant_code="C061", warehouse_number="208", mismatch_reason="MATCHED",
            mismatch_severity="INFO", row_count=10, exception_count=0,
            tolerance_exceeded_count=0, abs_delta_quantity_total=0.0, abs_delta_value_total=0.0),
        Row(plant_code="C061", warehouse_number="208", mismatch_reason="TRUE_VARIANCE",
            mismatch_severity="HIGH", row_count=2, exception_count=2,
            tolerance_exceeded_count=2, abs_delta_quantity_total=5.0, abs_delta_value_total=50.0),
    ])
    monkeypatch.setattr(flow.dlt, "read", lambda _: summary_df)

    rows = {r["mismatch_reason"]: r for r in all_rows(gold_stock_reconciliation_summary())}

    assert rows["MATCHED"]["reconciliation_status"] == "RECONCILED"
    assert rows["TRUE_VARIANCE"]["reconciliation_status"] == "ACTION_REQUIRED"
