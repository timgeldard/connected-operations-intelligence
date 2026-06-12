"""
Tests for WM Operations Gold tables (gold/wm_operations_gold.py).

Pattern follows tests/test_gold_warehouse_flow.py: seed the required silver tables in
the local spark_catalog `silver` database, call the Gold function directly, assert
on the derived statuses and aggregations.
"""

import datetime

import pytest
from pyspark.sql import Row, SparkSession

from tests.conftest import all_rows, create_df

_TS = datetime.datetime(2026, 6, 1, 8, 0, 0)


@pytest.fixture(scope="module", autouse=True)
def setup_silver(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")

    # Storage-type role mapping with description-derived zones (C061/104 seed shape).
    _save(spark, [
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="104",
            storage_type="100", storage_type_description="Production Supply", role="LINESIDE"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="104",
            storage_type="800", storage_type_description="Powder Dispensary", role="LINESIDE"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="104",
            storage_type="801", storage_type_description="Palletising (for Prodc.)", role="LINESIDE"),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="104",
            storage_type="300", storage_type_description="Bulk Storage", role=None),
        Row(plant_code="C061", plant_name="Portbury [MFG]", warehouse_number="104",
            storage_type="917", storage_type_description="Quality Assurance", role="INTERIM"),
    ], "storage_type_role_mapping")

    _save(spark, [
        Row(plant_code="C061", material_code="FG1", material_description="Finished Good One"),
        Row(plant_code="C061", material_code="RM1", material_description="Raw Material One"),
        Row(plant_code="C061", material_code="RM2", material_description="Raw Material Two"),
    ], "material")

    _save(spark, [
        Row(movement_type_code="261", is_production_consumption=True),
        Row(movement_type_code="101", is_production_consumption=False),
    ], "movement_type_classification")

    yield
    spark.sql("DROP DATABASE IF EXISTS silver CASCADE")


def _save(spark, rows, table):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(f"silver.{table}")


def _tr_row(**overrides):
    base = dict(
        plant_code="C061", warehouse_number="104", transfer_requirement_number="0000000111",
        item_number="0001", material_code="RM1", base_uom="KG",
        required_quantity=100.0, open_quantity=100.0,
        source_storage_type=None, destination_storage_type="100", destination_bin="000000900001",
        header_status_code=None, is_processing_complete=False,
        created_datetime=_TS, planned_execution_datetime=_TS,
        source_reference_type="P", source_reference_number="900001",
        queue="Q1", campaign_reference=None,
        manual_pick_status=None, direct_pick_status=None,
        assigned_operator_manual=None, assigned_operator_direct=None,
        job_sequence_manual=None, job_sequence_direct=None,
        created_by_user="SUPERVISOR", transfer_priority=None,
    )
    base.update(overrides)
    return Row(**base)


def _seed_worklist_inputs(spark, tr_rows, to_rows=None):
    _save(spark, tr_rows, "warehouse_transfer_requirement")
    _save(spark, to_rows or [
        Row(plant_code="C061", warehouse_number="104", transfer_order_number="500",
            item_number="0001", transfer_requirement_number="__NONE__",
            item_status="Open", requested_quantity=0.0, confirmed_quantity=0.0,
            confirmed_date=None, confirmed_datetime=None, difference_quantity=0.0),
    ], "warehouse_transfer_order")
    _save(spark, [
        Row(order_number="900001", plant_code="C061", material_code="FG1",
            order_quantity=1000.0, order_quantity_uom="KG",
            scheduled_start_date=datetime.date(2026, 6, 2),
            scheduled_start_datetime=datetime.datetime(2026, 6, 2, 6, 30, 0),
            scheduled_finish_date=datetime.date(2026, 6, 3),
            is_released=True, is_closed=False,
            production_line=None, production_line_description=None),
    ], "process_order")


# ── Staging worklist ──────────────────────────────────────────────────────────

def test_worklist_aggregates_and_classifies_staging(spark):
    from gold.wm_operations_gold import gold_wm_staging_worklist

    _seed_worklist_inputs(
        spark,
        tr_rows=[
            _tr_row(item_number="0001", material_code="RM1",
                    required_quantity=60.0, open_quantity=10.0,
                    manual_pick_status="A", assigned_operator_manual="OPER1"),
            _tr_row(item_number="0002", material_code="RM2",
                    required_quantity=40.0, open_quantity=40.0,
                    manual_pick_status="A", assigned_operator_manual="OPER1"),
        ],
        to_rows=[
            Row(plant_code="C061", warehouse_number="104", transfer_order_number="500",
                item_number="0001", transfer_requirement_number="0000000111",
                item_status="Fully Confirmed", requested_quantity=50.0, confirmed_quantity=50.0,
                confirmed_date=datetime.date(2026, 6, 1), confirmed_datetime=datetime.datetime(2026, 6, 1, 8, 0, 0),
                difference_quantity=0.0),
        ],
    )

    rows = all_rows(gold_wm_staging_worklist())
    assert len(rows) == 1
    r = rows[0]
    assert r["work_area"] == "PRODUCTION_STAGING"
    assert r["destination_zone"] == "PRODUCTION_SUPPLY"
    assert r["worklist_status"] == "IN_PROGRESS"
    assert r["assigned_operator"] == "OPER1"
    assert r["item_count"] == 2
    assert r["open_item_count"] == 2
    assert r["required_qty"] == 100.0
    assert r["open_qty"] == 50.0
    assert r["material_count"] == 2
    assert r["single_material_code"] is None
    assert r["to_item_count"] == 1
    assert r["to_confirmed_qty"] == 50.0
    assert r["pick_progress_fraction"] == 0.5
    # Order enrichment via BETYP='P' reference
    assert r["order_material_code"] == "FG1"
    assert r["demand_due_ts"] == datetime.datetime(2026, 6, 2, 6, 30, 0)
    assert r["priority_intervention_bump"] == 0


def test_worklist_demand_due_falls_back_and_intervention_bump_is_static(spark):
    from gold.wm_operations_gold import gold_wm_staging_worklist

    _seed_worklist_inputs(
        spark,
        tr_rows=[
            _tr_row(
                transfer_requirement_number="0000000555",
                source_reference_type=None,
                source_reference_number=None,
                planned_execution_datetime=datetime.datetime(2026, 6, 1, 9, 15, 0),
                manual_pick_status="N",
            ),
            _tr_row(
                transfer_requirement_number="0000000666",
                source_reference_type=None,
                source_reference_number=None,
                planned_execution_datetime=None,
                manual_pick_status=None,
            ),
        ],
    )

    rows = {r["transfer_requirement_number"]: r for r in all_rows(gold_wm_staging_worklist())}

    fallback = rows["0000000555"]
    assert fallback["demand_due_ts"] == datetime.datetime(2026, 6, 1, 9, 15, 0)
    assert fallback["worklist_status"] == "NO_STOCK"
    assert fallback["priority_intervention_bump"] == 10

    unscheduled = rows["0000000666"]
    assert unscheduled["demand_due_ts"] is None
    assert unscheduled["worklist_status"] == "OPEN"
    assert unscheduled["priority_intervention_bump"] == 0


def test_worklist_dispensary_pick_uses_direct_status_and_strips_park_prefix(spark):
    from gold.wm_operations_gold import gold_wm_staging_worklist

    _seed_worklist_inputs(
        spark,
        tr_rows=[
            # Dispensary picking: source ST is a dispensary, governed by direct (D) fields.
            _tr_row(transfer_requirement_number="0000000222",
                    source_storage_type="800", destination_storage_type="100",
                    direct_pick_status="P", assigned_operator_direct="~DISPUSER",
                    manual_pick_status="A", assigned_operator_manual="IGNORED"),
            # Dispensary replenishment: destination ST is a dispensary.
            _tr_row(transfer_requirement_number="0000000333",
                    source_storage_type=None, destination_storage_type="800",
                    manual_pick_status="N"),
            # Complete via header status E.
            _tr_row(transfer_requirement_number="0000000444",
                    header_status_code="E", is_processing_complete=True, open_quantity=0.0),
        ],
    )

    rows = {r["transfer_requirement_number"]: r for r in all_rows(gold_wm_staging_worklist())}

    disp_pick = rows["0000000222"]
    assert disp_pick["work_area"] == "DISPENSARY_PICKING"
    assert disp_pick["worklist_status"] == "PARKED"
    assert disp_pick["assigned_operator"] == "DISPUSER"  # '~' park prefix stripped

    replen = rows["0000000333"]
    assert replen["work_area"] == "DISPENSARY_REPLENISHMENT"
    assert replen["worklist_status"] == "NO_STOCK"

    done = rows["0000000444"]
    assert done["worklist_status"] == "COMPLETE"


# ── Worklist summary ──────────────────────────────────────────────────────────

def test_worklist_summary_rollup(spark, monkeypatch):
    import dlt

    from gold.wm_operations_gold import gold_wm_worklist_summary

    worklist = create_df(spark, [
        Row(plant_code="C061", warehouse_number="104", work_area="PRODUCTION_STAGING",
            worklist_status="OPEN", open_qty=10.0, required_qty=20.0,
            assigned_operator=None, planned_execution_datetime=_TS, created_datetime=_TS),
        Row(plant_code="C061", warehouse_number="104", work_area="PRODUCTION_STAGING",
            worklist_status="OPEN", open_qty=5.0, required_qty=5.0,
            assigned_operator="OPER1", planned_execution_datetime=_TS, created_datetime=_TS),
        Row(plant_code="C061", warehouse_number="104", work_area="DISPENSARY_PICKING",
            worklist_status="PARKED", open_qty=1.0, required_qty=1.0,
            assigned_operator="OPER2", planned_execution_datetime=_TS, created_datetime=_TS),
    ])
    monkeypatch.setattr(dlt, "read", lambda name: worklist)

    rows = all_rows(gold_wm_worklist_summary())
    staging_open = next(
        r for r in rows
        if r["work_area"] == "PRODUCTION_STAGING" and r["worklist_status"] == "OPEN"
    )
    assert staging_open["tr_count"] == 2
    assert staging_open["total_open_qty"] == 15.0
    assert staging_open["operator_count"] == 1  # nulls excluded from count_distinct


# ── Order readiness ───────────────────────────────────────────────────────────

def test_order_readiness_tr_coverage_and_psa_supply(spark):
    from gold.wm_operations_gold import gold_wm_order_readiness

    _save(spark, [
        # Released via the PHAS1 flag
        Row(order_number="900001", plant_code="C061", material_code="FG1",
            order_quantity=1000.0, order_quantity_uom="KG",
            scheduled_start_date=datetime.date(2026, 6, 2),
            scheduled_finish_date=datetime.date(2026, 6, 3),
            is_released=True, is_closed=False,
            actual_release_date=None, actual_finish_date=None,
            production_line=None, production_line_description=None),
        # Released via FTRMI date evidence only (blank PHAS flags — UAT replication shape)
        Row(order_number="900002", plant_code="C061", material_code="FG1",
            order_quantity=500.0, order_quantity_uom="KG",
            scheduled_start_date=datetime.date(2026, 6, 4),
            scheduled_finish_date=datetime.date(2026, 6, 5),
            is_released=False, is_closed=False,
            actual_release_date=datetime.date(2026, 6, 3), actual_finish_date=None,
            production_line=None, production_line_description=None),
        # Excluded: no release evidence at all
        Row(order_number="900003", plant_code="C061", material_code="FG1",
            order_quantity=500.0, order_quantity_uom="KG",
            scheduled_start_date=None, scheduled_finish_date=None,
            is_released=False, is_closed=False,
            actual_release_date=None, actual_finish_date=None,
            production_line=None, production_line_description=None),
        # Excluded: released but production finished (GLTRI set)
        Row(order_number="900004", plant_code="C061", material_code="FG1",
            order_quantity=500.0, order_quantity_uom="KG",
            scheduled_start_date=datetime.date(2026, 5, 1),
            scheduled_finish_date=datetime.date(2026, 5, 2),
            is_released=True, is_closed=False,
            actual_release_date=datetime.date(2026, 4, 30),
            actual_finish_date=datetime.date(2026, 5, 2),
            production_line=None, production_line_description=None),
    ], "process_order")

    _save(spark, [
        # 900001: two WM components, 100 KG total demand
        Row(order_number="900001", plant_code="C061", warehouse_number="104",
            production_supply_area="PSA1", movement_type_code="261",
            required_quantity=60.0, open_quantity=60.0,
            requirement_date=datetime.date(2026, 6, 2), is_deletion_flagged=False),
        Row(order_number="900001", plant_code="C061", warehouse_number="104",
            production_supply_area="PSA1", movement_type_code="261",
            required_quantity=40.0, open_quantity=40.0,
            requirement_date=datetime.date(2026, 6, 2), is_deletion_flagged=False),
        # 900002: one WM component, 50 KG
        Row(order_number="900002", plant_code="C061", warehouse_number="104",
            production_supply_area="PSA2", movement_type_code="261",
            required_quantity=50.0, open_quantity=50.0,
            requirement_date=datetime.date(2026, 6, 4), is_deletion_flagged=False),
    ], "reservation_requirement")

    _save(spark, [
        # 900001 fully covered by TRs
        _tr_row(transfer_requirement_number="0000000111", item_number="0001",
                source_reference_number="900001", required_quantity=100.0, open_quantity=0.0),
        # 900002 partially covered
        _tr_row(transfer_requirement_number="0000000222", item_number="0001",
                source_reference_number="900002", required_quantity=20.0, open_quantity=20.0),
    ], "warehouse_transfer_requirement")

    _save(spark, [
        # PSA supply for 900001: order-keyed dynamic bin in Production Supply (zero-padded)
        Row(plant_code="C061", warehouse_number="104", storage_type="100",
            bin_code="000000900001", picking_area=None, quant_number="Q1",
            material_code="RM1", batch_number="B1", stock_category_code="",
            total_quantity=100.0, available_quantity=100.0, putaway_quantity=0.0,
            pick_quantity=0.0, open_transfer_quantity=0.0, base_uom="KG",
            goods_receipt_date=None, expiry_date=None, last_movement_datetime=None,
            is_blocked_for_stock_removal=False, is_blocked_for_putaway=False,
            is_blocked=False, blocking_reason_code=None),
    ], "storage_bin")

    rows = {r["order_number"]: r for r in all_rows(gold_wm_order_readiness())}
    assert set(rows) == {"900001", "900002"}

    full = rows["900001"]
    assert full["tr_coverage_status"] == "FULL"
    assert full["supply_status"] == "SUPPLIED"
    assert full["readiness_status"] == "SUPPLIED"
    assert full["psa_supplied_qty"] == 100.0
    assert full["wm_component_count"] == 2

    partial = rows["900002"]
    assert partial["tr_coverage_status"] == "PARTIAL"
    assert partial["supply_status"] == "NOT_SUPPLIED"
    assert partial["readiness_status"] == "PARTIALLY_PLANNED"


# ── Bin / stock detail ────────────────────────────────────────────────────────

def test_bin_stock_detail_zones_and_categories(spark):
    from gold.wm_operations_gold import gold_wm_bin_stock_detail

    _save(spark, [
        # Dispensary quant, quality stock
        Row(plant_code="C061", warehouse_number="104", storage_type="800",
            bin_code="FLOOR", picking_area=None, quant_number="Q10",
            material_code="RM1", batch_number="B1", stock_category_code="Q",
            total_quantity=25.0, available_quantity=25.0, putaway_quantity=0.0,
            pick_quantity=0.0, open_transfer_quantity=0.0, base_uom="KG",
            goods_receipt_date=datetime.date(2026, 5, 1),
            expiry_date=datetime.date(2026, 7, 1), last_movement_datetime=_TS,
            is_blocked_for_stock_removal=None, is_blocked_for_putaway=False,
            is_blocked=False, blocking_reason_code=None),
        # Unmapped 9xx storage type -> INTERIM fallback, unrestricted
        Row(plant_code="C061", warehouse_number="104", storage_type="999",
            bin_code="DIFF", picking_area=None, quant_number="Q11",
            material_code="RM2", batch_number=None, stock_category_code="",
            total_quantity=5.0, available_quantity=5.0, putaway_quantity=0.0,
            pick_quantity=0.0, open_transfer_quantity=0.0, base_uom="KG",
            goods_receipt_date=None, expiry_date=None, last_movement_datetime=None,
            is_blocked_for_stock_removal=False, is_blocked_for_putaway=False,
            is_blocked=True, blocking_reason_code="X"),
        # Empty bin (no quant) excluded
        Row(plant_code="C061", warehouse_number="104", storage_type="300",
            bin_code="A-01-01", picking_area="P1", quant_number=None,
            material_code=None, batch_number=None, stock_category_code=None,
            total_quantity=None, available_quantity=None, putaway_quantity=None,
            pick_quantity=None, open_transfer_quantity=None, base_uom=None,
            goods_receipt_date=None, expiry_date=None, last_movement_datetime=None,
            is_blocked_for_stock_removal=None, is_blocked_for_putaway=None,
            is_blocked=None, blocking_reason_code=None),
    ], "storage_bin")

    rows = {r["quant_number"]: r for r in all_rows(gold_wm_bin_stock_detail())}
    assert set(rows) == {"Q10", "Q11"}

    disp = rows["Q10"]
    assert disp["storage_zone"] == "DISPENSARY"
    assert disp["stock_category"] == "QUALITY"
    assert disp["material_description"] == "Raw Material One"
    assert disp["is_blocked_for_stock_removal"] is False  # null coalesced

    interim = rows["Q11"]
    assert interim["storage_zone"] == "INTERIM"
    assert interim["stock_category"] == "UNRESTRICTED"
    assert interim["is_bin_blocked"] is True
