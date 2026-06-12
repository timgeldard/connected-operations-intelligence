"""
Unit tests for gold_batch_event_ledger (T4 of ADR 016 — governed trace2 fan-out foundation).

Tests cover:
  1. Direction mapping per leg type:
       - PRODUCTION: parent side → OUT; child side → IN.
       - VENDOR_RECEIPT: child side only → IN (null parent; no OUT row).
       - DELIVERY: parent side only → OUT (null child; no IN row).
       - ADJUSTMENT_IN: child side → IN.
       - ADJUSTMENT_OUT: parent side → OUT.
  2. Transfer dual-row explosion — STO_TRANSFER, BATCH_TRANSFER, MATERIAL_TRANSFER each produce
     an OUT row for the parent and an IN row for the child.
  3. Counterpart columns — COUNTERPART_MATERIAL_ID/BATCH_ID/PLANT_ID carry the opposite endpoint.
  4. Reference ID propagation — SUPPLIER_ID, PROCESS_ORDER_ID, DELIVERY_ID etc. flow through.
  5. Null-batch handling — edges where PARENT_BATCH_ID or CHILD_BATCH_ID is null produce only the
     non-null side (no error; no null BATCH_ID rows in output).
  6. Empty edges input → empty output.

Pattern: mirrors test_gold_trace_anchor.py — dlt.read mock wired to silver.gold_batch_lineage,
save_table writes edges, call function directly, assert on collected rows.

Run: cd data-products/io-reporting && pytest tests/gold/test_gold_batch_event_ledger.py -v
"""
import sys
from datetime import date

import pytest
from pyspark.sql import Row

from gold.trace_gold import gold_batch_event_ledger
from tests.conftest import all_rows

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _edge_row(
    parent_material_id="MAT-A",
    parent_batch_id="BATCH-A",
    parent_plant_id="P001",
    child_material_id="MAT-B",
    child_batch_id="BATCH-B",
    child_plant_id="P001",
    link_type="PRODUCTION",
    posting_date=date(2026, 1, 1),
    process_order_id=None,
    material_document_number=None,
    material_document_year=None,
    purchase_order_id=None,
    supplier_id=None,
    customer_id=None,
    delivery_id=None,
    sales_order_id=None,
    movement_type=None,
    quantity=10.0,
    base_unit_of_measure="KG",
):
    return Row(
        PARENT_MATERIAL_ID=parent_material_id,
        PARENT_BATCH_ID=parent_batch_id,
        PARENT_PLANT_ID=parent_plant_id,
        CHILD_MATERIAL_ID=child_material_id,
        CHILD_BATCH_ID=child_batch_id,
        CHILD_PLANT_ID=child_plant_id,
        LINK_TYPE=link_type,
        POSTING_DATE=posting_date,
        PROCESS_ORDER_ID=process_order_id,
        MATERIAL_DOCUMENT_NUMBER=material_document_number,
        MATERIAL_DOCUMENT_YEAR=material_document_year,
        PURCHASE_ORDER_ID=purchase_order_id,
        SUPPLIER_ID=supplier_id,
        CUSTOMER_ID=customer_id,
        DELIVERY_ID=delivery_id,
        SALES_ORDER_ID=sales_order_id,
        MOVEMENT_TYPE=movement_type,
        QUANTITY=quantity,
        BASE_UNIT_OF_MEASURE=base_unit_of_measure,
    )


@pytest.fixture(autouse=True)
def wire_dlt_read(spark):
    """Configure dlt.read("gold_batch_lineage") to return a real Spark DataFrame.

    gold_batch_event_ledger() uses dlt.read("gold_batch_lineage") for the intra-pipeline
    dependency.  In tests, dlt is a MagicMock; we configure dlt.read so that calling it with
    "gold_batch_lineage" returns a Spark DataFrame read from the silver.gold_batch_lineage
    table that save_table writes to.
    """
    dlt = sys.modules["dlt"]
    dlt.read.side_effect = lambda table_name: spark.read.table(f"silver.{table_name}")
    yield
    dlt.read.side_effect = None


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 — PRODUCTION leg direction mapping
# ─────────────────────────────────────────────────────────────────────────────

def test_production_edge_produces_out_and_in_rows(spark, save_table):
    """PRODUCTION edge → OUT row for parent batch + IN row for child batch."""
    save_table([
        _edge_row(
            parent_material_id="MAT-A", parent_batch_id="BATCH-A", parent_plant_id="P001",
            child_material_id="MAT-B", child_batch_id="BATCH-B", child_plant_id="P001",
            link_type="PRODUCTION",
            process_order_id="ORDER-1",
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())
    assert len(rows) == 2

    out_row = next(r for r in rows if r["direction"] == "OUT")
    in_row = next(r for r in rows if r["direction"] == "IN")

    # OUT: parent batch was consumed
    assert out_row["BATCH_ID"] == "BATCH-A"
    assert out_row["MATERIAL_ID"] == "MAT-A"
    assert out_row["PLANT_ID"] == "P001"
    assert out_row["plant_code"] == "P001"
    assert out_row["LINK_TYPE"] == "PRODUCTION"
    assert out_row["PROCESS_ORDER_ID"] == "ORDER-1"
    # counterpart: the child
    assert out_row["COUNTERPART_BATCH_ID"] == "BATCH-B"
    assert out_row["COUNTERPART_MATERIAL_ID"] == "MAT-B"
    assert out_row["COUNTERPART_PLANT_ID"] == "P001"

    # IN: child batch was produced
    assert in_row["BATCH_ID"] == "BATCH-B"
    assert in_row["MATERIAL_ID"] == "MAT-B"
    assert in_row["LINK_TYPE"] == "PRODUCTION"
    assert in_row["PROCESS_ORDER_ID"] == "ORDER-1"
    # counterpart: the parent
    assert in_row["COUNTERPART_BATCH_ID"] == "BATCH-A"
    assert in_row["COUNTERPART_MATERIAL_ID"] == "MAT-A"


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 — VENDOR_RECEIPT: IN only (parent NULL)
# ─────────────────────────────────────────────────────────────────────────────

def test_vendor_receipt_produces_in_row_only(spark, save_table):
    """VENDOR_RECEIPT has NULL PARENT → child IN row only; no OUT row."""
    save_table([
        _edge_row(
            parent_material_id=None, parent_batch_id=None, parent_plant_id=None,
            child_material_id="MAT-C", child_batch_id="BATCH-C", child_plant_id="P002",
            link_type="VENDOR_RECEIPT",
            supplier_id="SUPP-001",
            purchase_order_id="PO-100",
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())

    assert len(rows) == 1, "VENDOR_RECEIPT must produce only one row (IN)"
    r = rows[0]
    assert r["direction"] == "IN"
    assert r["BATCH_ID"] == "BATCH-C"
    assert r["MATERIAL_ID"] == "MAT-C"
    assert r["PLANT_ID"] == "P002"
    assert r["SUPPLIER_ID"] == "SUPP-001"
    assert r["PURCHASE_ORDER_ID"] == "PO-100"
    # counterpart: the (null) parent
    assert r["COUNTERPART_BATCH_ID"] is None
    assert r["COUNTERPART_PLANT_ID"] is None


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 — DELIVERY: OUT only (child NULL)
# ─────────────────────────────────────────────────────────────────────────────

def test_delivery_produces_out_row_only(spark, save_table):
    """DELIVERY has NULL CHILD → parent OUT row only; no IN row."""
    save_table([
        _edge_row(
            parent_material_id="MAT-D", parent_batch_id="BATCH-D", parent_plant_id="P003",
            child_material_id=None, child_batch_id=None, child_plant_id=None,
            link_type="DELIVERY",
            delivery_id="DEL-500",
            sales_order_id="SO-500",
            customer_id="CUST-001",
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())

    assert len(rows) == 1, "DELIVERY must produce only one row (OUT)"
    r = rows[0]
    assert r["direction"] == "OUT"
    assert r["BATCH_ID"] == "BATCH-D"
    assert r["DELIVERY_ID"] == "DEL-500"
    assert r["SALES_ORDER_ID"] == "SO-500"
    assert r["CUSTOMER_ID"] == "CUST-001"
    # counterpart: the (null) child
    assert r["COUNTERPART_BATCH_ID"] is None


# ─────────────────────────────────────────────────────────────────────────────
# Test 4 — ADJUSTMENT_IN: child IN only
# ─────────────────────────────────────────────────────────────────────────────

def test_adjustment_in_produces_in_row_only(spark, save_table):
    """ADJUSTMENT_IN has NULL PARENT → child IN row only."""
    save_table([
        _edge_row(
            parent_material_id=None, parent_batch_id=None, parent_plant_id=None,
            child_material_id="MAT-E", child_batch_id="BATCH-E", child_plant_id="P001",
            link_type="ADJUSTMENT_IN",
            quantity=50.0,
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())
    assert len(rows) == 1
    r = rows[0]
    assert r["direction"] == "IN"
    assert r["BATCH_ID"] == "BATCH-E"
    assert r["LINK_TYPE"] == "ADJUSTMENT_IN"


# ─────────────────────────────────────────────────────────────────────────────
# Test 5 — ADJUSTMENT_OUT: parent OUT only
# ─────────────────────────────────────────────────────────────────────────────

def test_adjustment_out_produces_out_row_only(spark, save_table):
    """ADJUSTMENT_OUT has NULL CHILD → parent OUT row only."""
    save_table([
        _edge_row(
            parent_material_id="MAT-F", parent_batch_id="BATCH-F", parent_plant_id="P001",
            child_material_id=None, child_batch_id=None, child_plant_id=None,
            link_type="ADJUSTMENT_OUT",
            quantity=25.0,
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())
    assert len(rows) == 1
    r = rows[0]
    assert r["direction"] == "OUT"
    assert r["BATCH_ID"] == "BATCH-F"
    assert r["LINK_TYPE"] == "ADJUSTMENT_OUT"


# ─────────────────────────────────────────────────────────────────────────────
# Test 6 — Transfer dual-row explosion
# ─────────────────────────────────────────────────────────────────────────────

def test_sto_transfer_produces_out_and_in_rows(spark, save_table):
    """STO_TRANSFER: OUT at sender plant, IN at receiver plant."""
    save_table([
        _edge_row(
            parent_material_id="MAT-G", parent_batch_id="BATCH-G", parent_plant_id="SEND",
            child_material_id="MAT-G", child_batch_id="BATCH-G", child_plant_id="RECV",
            link_type="STO_TRANSFER",
            purchase_order_id="PO-STO",
            quantity=75.0,
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())
    assert len(rows) == 2

    out_row = next(r for r in rows if r["direction"] == "OUT")
    in_row = next(r for r in rows if r["direction"] == "IN")

    assert out_row["PLANT_ID"] == "SEND"
    assert out_row["plant_code"] == "SEND"
    assert out_row["COUNTERPART_PLANT_ID"] == "RECV"

    assert in_row["PLANT_ID"] == "RECV"
    assert in_row["plant_code"] == "RECV"
    assert in_row["COUNTERPART_PLANT_ID"] == "SEND"


def test_batch_transfer_produces_out_and_in_rows(spark, save_table):
    """BATCH_TRANSFER within same plant: OUT + IN rows both have same PLANT_ID."""
    save_table([
        _edge_row(
            parent_material_id="MAT-H", parent_batch_id="BATCH-OLD", parent_plant_id="P001",
            child_material_id="MAT-H", child_batch_id="BATCH-NEW", child_plant_id="P001",
            link_type="BATCH_TRANSFER",
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())
    assert len(rows) == 2

    out_row = next(r for r in rows if r["direction"] == "OUT")
    in_row = next(r for r in rows if r["direction"] == "IN")

    assert out_row["BATCH_ID"] == "BATCH-OLD"
    assert in_row["BATCH_ID"] == "BATCH-NEW"
    # same plant on both sides
    assert out_row["PLANT_ID"] == "P001"
    assert in_row["PLANT_ID"] == "P001"


# ─────────────────────────────────────────────────────────────────────────────
# Test 7 — null BATCH_ID handling
# ─────────────────────────────────────────────────────────────────────────────

def test_null_parent_batch_id_no_out_row(spark, save_table):
    """If PARENT_BATCH_ID is null, no OUT row is emitted for that side."""
    save_table([
        _edge_row(
            parent_batch_id=None, parent_plant_id=None,
            child_material_id="MAT-I", child_batch_id="BATCH-I", child_plant_id="P001",
            link_type="VENDOR_RECEIPT",
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())
    # Only the child IN row
    for r in rows:
        assert r["BATCH_ID"] is not None, "Null BATCH_ID must not appear in output"
    assert len(rows) == 1


def test_null_child_batch_id_no_in_row(spark, save_table):
    """If CHILD_BATCH_ID is null, no IN row is emitted for that side."""
    save_table([
        _edge_row(
            parent_material_id="MAT-J", parent_batch_id="BATCH-J", parent_plant_id="P001",
            child_batch_id=None, child_plant_id=None,
            link_type="DELIVERY",
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())
    # Only the parent OUT row
    for r in rows:
        assert r["BATCH_ID"] is not None
    assert len(rows) == 1


# ─────────────────────────────────────────────────────────────────────────────
# Test 8 — empty input
# ─────────────────────────────────────────────────────────────────────────────

def test_empty_lineage_returns_empty(spark, save_table):
    """Empty gold_batch_lineage → empty gold_batch_event_ledger."""
    save_table([], "gold_batch_lineage")
    rows = all_rows(gold_batch_event_ledger())
    assert rows == []


# ─────────────────────────────────────────────────────────────────────────────
# Test 9 — reference ID propagation
# ─────────────────────────────────────────────────────────────────────────────

def test_reference_ids_propagated(spark, save_table):
    """All reference ID columns flow through on both sides of a production edge."""
    save_table([
        _edge_row(
            parent_batch_id="BATCH-REF", parent_plant_id="P001",
            child_batch_id="BATCH-OUT", child_plant_id="P001",
            link_type="PRODUCTION",
            process_order_id="ORD-REF",
            material_document_number="MDOC-REF",
            quantity=100.0,
            base_unit_of_measure="KG",
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())
    assert len(rows) == 2
    for r in rows:
        assert r["PROCESS_ORDER_ID"] == "ORD-REF"
        assert r["MATERIAL_DOCUMENT_NUMBER"] == "MDOC-REF"
        assert r["QUANTITY"] == 100.0
        assert r["BASE_UNIT_OF_MEASURE"] == "KG"


def test_vendor_receipt_supplier_and_po_propagated(spark, save_table):
    """SUPPLIER_ID and PURCHASE_ORDER_ID are propagated on the VENDOR_RECEIPT IN row."""
    save_table([
        _edge_row(
            parent_batch_id=None, parent_plant_id=None,
            child_batch_id="BATCH-VR", child_plant_id="P005",
            link_type="VENDOR_RECEIPT",
            supplier_id="SUP-XYZ",
            purchase_order_id="PO-XYZ",
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())
    assert len(rows) == 1
    assert rows[0]["SUPPLIER_ID"] == "SUP-XYZ"
    assert rows[0]["PURCHASE_ORDER_ID"] == "PO-XYZ"


# ─────────────────────────────────────────────────────────────────────────────
# Test 10 — posting date and UOM preserved
# ─────────────────────────────────────────────────────────────────────────────

def test_posting_date_and_uom_preserved(spark, save_table):
    """POSTING_DATE and BASE_UNIT_OF_MEASURE are preserved on both sides."""
    test_date = date(2026, 3, 15)
    save_table([
        _edge_row(
            parent_batch_id="BP", parent_plant_id="P001",
            child_batch_id="BC", child_plant_id="P001",
            link_type="PRODUCTION",
            posting_date=test_date,
            base_unit_of_measure="L",
        ),
    ], "gold_batch_lineage")

    rows = all_rows(gold_batch_event_ledger())
    assert len(rows) == 2
    for r in rows:
        assert r["POSTING_DATE"] == test_date
        assert r["BASE_UNIT_OF_MEASURE"] == "L"
