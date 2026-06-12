"""
Unit tests for gold_trace_anchor (T3 of ADR 016 — anchor tier search MV).

Tests cover:
  1. Endpoint union + aggregation correctness — parent/child sides are unioned;
     first/last posting dates and directional edge counts are correct.
  2. ACTIVE-only gating — CLOSED plants and plants absent from site_lifecycle are
     excluded from the anchor output.
  3. Null / blank batch exclusion — rows with null or blank BATCH_ID are dropped
     (anchors are batch-level entry points; one-sided edges have null endpoints).

Pattern: mirrors the existing gold test modules — save_table fixture populates
silver tables, call the function directly, assert on collected rows.

DLT mock note: conftest.py installs a MagicMock for the `dlt` module at import
time.  gold_trace_anchor() calls dlt.read("gold_batch_lineage") to read the edge
MV as an intra-pipeline dependency.  Each test configures dlt.read.return_value
to point at a Spark DataFrame read from the silver.gold_batch_lineage table that
save_table writes to, mirroring the same pattern used across the gold test suite.

NOTE: pytest cannot run locally without a JVM (PySpark).  Tests are written for CI.
Run: cd data-products/io-reporting && pytest tests/gold/test_gold_trace_anchor.py -v
"""
import sys
from datetime import date

import pytest
from pyspark.sql import Row

from gold.trace_gold import gold_trace_anchor
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
    quantity=None,
    base_unit_of_measure=None,
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


def _lifecycle_row(plant_code, effective_lifecycle):
    return Row(plant_code=plant_code, effective_lifecycle=effective_lifecycle)


@pytest.fixture(autouse=True)
def wire_dlt_read(spark):
    """Configure dlt.read("gold_batch_lineage") to return a real Spark DataFrame.

    gold_trace_anchor() uses dlt.read("gold_batch_lineage") for the intra-pipeline
    dependency (an MV cannot reliably read another MV in the same pipeline via
    spark.read.table).  In tests, dlt is a MagicMock; we configure dlt.read so that
    calling it with "gold_batch_lineage" returns a Spark DataFrame read from the
    silver.gold_batch_lineage table that save_table writes to.
    """
    dlt = sys.modules["dlt"]
    dlt.read.side_effect = lambda table_name: spark.read.table(f"silver.{table_name}")
    yield
    dlt.read.side_effect = None


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 — endpoint union + aggregation correctness
# ─────────────────────────────────────────────────────────────────────────────

def test_anchor_aggregation_both_endpoints_and_date_range(spark, save_table):
    """Two edges involving the same batch on both sides; aggregation is correct.

    Edge 1: BATCH-A (P001) → BATCH-B (P001)  [BATCH-A is parent, BATCH-B is child]
    Edge 2: BATCH-C (P001) → BATCH-A (P001)  [BATCH-A is child, BATCH-C is parent]

    Expected for BATCH-A:
      - edge_count_as_parent = 1  (appears as parent in edge 1)
      - edge_count_as_child  = 1  (appears as child in edge 2)
      - first_posting_date   = 2026-01-01
      - last_posting_date    = 2026-01-15
    """
    save_table([
        _edge_row(
            parent_batch_id="BATCH-A", child_batch_id="BATCH-B",
            posting_date=date(2026, 1, 1),
        ),
        _edge_row(
            parent_material_id="MAT-C", parent_batch_id="BATCH-C",
            child_material_id="MAT-A", child_batch_id="BATCH-A",
            posting_date=date(2026, 1, 15),
        ),
    ], "gold_batch_lineage")
    save_table([
        _lifecycle_row("P001", "ACTIVE"),
    ], "site_lifecycle")

    rows = all_rows(gold_trace_anchor())

    batch_a = next(r for r in rows if r["BATCH_ID"] == "BATCH-A")
    assert batch_a["MATERIAL_ID"] == "MAT-A"
    assert batch_a["PLANT_ID"] == "P001"
    assert batch_a["plant_code"] == "P001"
    assert batch_a["first_posting_date"] == date(2026, 1, 1)
    assert batch_a["last_posting_date"] == date(2026, 1, 15)
    assert batch_a["edge_count_as_parent"] == 1
    assert batch_a["edge_count_as_child"] == 1


def test_anchor_parent_only_and_child_only_batches(spark, save_table):
    """A batch that only appears on the parent side, and one only on the child side."""
    save_table([
        _edge_row(
            parent_batch_id="BATCH-SRC", child_batch_id="BATCH-DST",
            posting_date=date(2026, 3, 10),
        ),
    ], "gold_batch_lineage")
    save_table([_lifecycle_row("P001", "ACTIVE")], "site_lifecycle")

    rows = all_rows(gold_trace_anchor())

    src = next(r for r in rows if r["BATCH_ID"] == "BATCH-SRC")
    assert src["edge_count_as_parent"] == 1
    assert src["edge_count_as_child"] == 0

    dst = next(r for r in rows if r["BATCH_ID"] == "BATCH-DST")
    assert dst["edge_count_as_parent"] == 0
    assert dst["edge_count_as_child"] == 1


def test_anchor_multiple_edges_same_batch_as_parent(spark, save_table):
    """A batch appearing as parent in multiple edges: edge_count_as_parent = N."""
    save_table([
        _edge_row(parent_batch_id="BATCH-IN", child_batch_id="CHILD-1",
                  posting_date=date(2026, 2, 1)),
        _edge_row(parent_batch_id="BATCH-IN", child_batch_id="CHILD-2",
                  posting_date=date(2026, 2, 5)),
        _edge_row(parent_batch_id="BATCH-IN", child_batch_id="CHILD-3",
                  posting_date=date(2026, 2, 10)),
    ], "gold_batch_lineage")
    save_table([_lifecycle_row("P001", "ACTIVE")], "site_lifecycle")

    rows = all_rows(gold_trace_anchor())

    batch_in = next(r for r in rows if r["BATCH_ID"] == "BATCH-IN")
    assert batch_in["edge_count_as_parent"] == 3
    assert batch_in["edge_count_as_child"] == 0
    assert batch_in["first_posting_date"] == date(2026, 2, 1)
    assert batch_in["last_posting_date"] == date(2026, 2, 10)


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 — ACTIVE-only anchorability gate
# ─────────────────────────────────────────────────────────────────────────────

def test_anchor_closed_plant_excluded(spark, save_table):
    """Batches at CLOSED plants must not appear in the anchor output."""
    save_table([
        _edge_row(parent_plant_id="P001", child_plant_id="P002",
                  parent_batch_id="BATCH-ACTIVE", child_batch_id="BATCH-CLOSED",
                  posting_date=date(2026, 1, 1)),
    ], "gold_batch_lineage")
    save_table([
        _lifecycle_row("P001", "ACTIVE"),
        _lifecycle_row("P002", "CLOSED"),
    ], "site_lifecycle")

    rows = all_rows(gold_trace_anchor())

    batch_ids = {r["BATCH_ID"] for r in rows}
    assert "BATCH-ACTIVE" in batch_ids, "ACTIVE-plant batch must be included"
    assert "BATCH-CLOSED" not in batch_ids, "CLOSED-plant batch must be excluded"


def test_anchor_unknown_plant_excluded(spark, save_table):
    """Batches at plants absent from site_lifecycle must not appear as anchors.

    This is the OPPOSITE of the edge MV's keep-unknowns default (ADR 016 §3):
    the anchor requires explicit ACTIVE confirmation.
    """
    save_table([
        _edge_row(parent_plant_id="P001", child_plant_id="P999",
                  parent_batch_id="BATCH-KNOWN", child_batch_id="BATCH-UNKNOWN-PLANT",
                  posting_date=date(2026, 1, 1)),
    ], "gold_batch_lineage")
    save_table([
        _lifecycle_row("P001", "ACTIVE"),
        # P999 deliberately absent from site_lifecycle
    ], "site_lifecycle")

    rows = all_rows(gold_trace_anchor())

    batch_ids = {r["BATCH_ID"] for r in rows}
    assert "BATCH-KNOWN" in batch_ids
    assert "BATCH-UNKNOWN-PLANT" not in batch_ids, (
        "Plant absent from site_lifecycle must not be anchorable "
        "(inner-join semantics — opposite of edge MV keep-unknowns)"
    )


def test_anchor_sold_and_divested_plants_excluded(spark, save_table):
    """SOLD and DIVESTED_ON_SAP plants are excluded from anchors."""
    save_table([
        _edge_row(parent_plant_id="P001", child_plant_id="P-SOLD",
                  parent_batch_id="BATCH-OK", child_batch_id="BATCH-SOLD",
                  posting_date=date(2026, 1, 1)),
        _edge_row(parent_plant_id="P001", child_plant_id="P-DIV",
                  parent_batch_id="BATCH-OK-2", child_batch_id="BATCH-DIV",
                  posting_date=date(2026, 1, 2)),
    ], "gold_batch_lineage")
    save_table([
        _lifecycle_row("P001", "ACTIVE"),
        _lifecycle_row("P-SOLD", "SOLD"),
        _lifecycle_row("P-DIV", "DIVESTED_ON_SAP"),
    ], "site_lifecycle")

    rows = all_rows(gold_trace_anchor())

    batch_ids = {r["BATCH_ID"] for r in rows}
    assert "BATCH-OK" in batch_ids
    assert "BATCH-OK-2" in batch_ids
    assert "BATCH-SOLD" not in batch_ids
    assert "BATCH-DIV" not in batch_ids


def test_anchor_only_active_plants_with_mixed_lifecycle(spark, save_table):
    """Mixed lifecycle dimension: only ACTIVE anchors survive."""
    save_table([
        _edge_row(parent_plant_id="ACT", child_plant_id="ACT",
                  parent_batch_id="B1", child_batch_id="B2",
                  posting_date=date(2026, 4, 1)),
        _edge_row(parent_plant_id="CLO", child_plant_id="CLO",
                  parent_batch_id="B3", child_batch_id="B4",
                  posting_date=date(2026, 4, 2)),
        _edge_row(parent_plant_id="DIV", child_plant_id="DIV",
                  parent_batch_id="B5", child_batch_id="B6",
                  posting_date=date(2026, 4, 3)),
    ], "gold_batch_lineage")
    save_table([
        _lifecycle_row("ACT", "ACTIVE"),
        _lifecycle_row("CLO", "CLOSED"),
        _lifecycle_row("DIV", "DIVESTED_ON_SAP"),
    ], "site_lifecycle")

    rows = all_rows(gold_trace_anchor())

    plant_ids = {r["PLANT_ID"] for r in rows}
    assert plant_ids == {"ACT"}, (
        f"Only ACTIVE plant anchors expected; got {plant_ids}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 — null / blank BATCH_ID exclusion
# ─────────────────────────────────────────────────────────────────────────────

def test_anchor_null_batch_id_excluded(spark, save_table):
    """One-sided edges with null BATCH_ID (e.g. VENDOR_RECEIPT null parent) must be dropped."""
    save_table([
        # VENDOR_RECEIPT shape: PARENT_BATCH_ID is null, CHILD_BATCH_ID is real
        _edge_row(parent_batch_id=None, parent_plant_id=None,
                  child_batch_id="BATCH-REAL", child_plant_id="P001",
                  link_type="VENDOR_RECEIPT", posting_date=date(2026, 5, 1)),
        # Normal edge: both sides valid
        _edge_row(parent_batch_id="BATCH-A", child_batch_id="BATCH-B",
                  posting_date=date(2026, 5, 2)),
    ], "gold_batch_lineage")
    save_table([_lifecycle_row("P001", "ACTIVE")], "site_lifecycle")

    rows = all_rows(gold_trace_anchor())

    batch_ids = {r["BATCH_ID"] for r in rows}
    assert None not in batch_ids, "Null BATCH_ID must not appear in anchor output"
    assert "BATCH-REAL" in batch_ids
    assert "BATCH-A" in batch_ids
    assert "BATCH-B" in batch_ids


def test_anchor_blank_batch_id_excluded(spark, save_table):
    """Blank (whitespace-only) BATCH_ID rows are excluded."""
    save_table([
        _edge_row(parent_batch_id="   ", parent_plant_id="P001",
                  child_batch_id="BATCH-OK", child_plant_id="P001",
                  posting_date=date(2026, 5, 10)),
    ], "gold_batch_lineage")
    save_table([_lifecycle_row("P001", "ACTIVE")], "site_lifecycle")

    rows = all_rows(gold_trace_anchor())

    batch_ids = {r["BATCH_ID"] for r in rows}
    assert "   " not in batch_ids, "Blank BATCH_ID must not appear in anchor output"
    assert "BATCH-OK" in batch_ids


def test_anchor_null_plant_id_excluded(spark, save_table):
    """Rows with null PLANT_ID (one-sided edge endpoint) must be dropped.

    The RLS predicate cannot apply to a null plant; such rows must not be served
    as anchors regardless of batch identity.
    """
    save_table([
        # DELIVERY shape: CHILD_PLANT_ID is null (batch exits the estate)
        _edge_row(parent_batch_id="BATCH-OUT", parent_plant_id="P001",
                  child_batch_id=None, child_plant_id=None,
                  link_type="DELIVERY", posting_date=date(2026, 6, 1)),
    ], "gold_batch_lineage")
    save_table([_lifecycle_row("P001", "ACTIVE")], "site_lifecycle")

    rows = all_rows(gold_trace_anchor())

    for r in rows:
        assert r["PLANT_ID"] is not None, "Null PLANT_ID must not appear in anchor output"

    # The parent batch with a valid ACTIVE plant should still appear
    assert any(r["BATCH_ID"] == "BATCH-OUT" for r in rows)


def test_anchor_empty_edges_returns_empty(spark, save_table):
    """If the edge table is empty, the anchor table is empty."""
    save_table([], "gold_batch_lineage")
    save_table([_lifecycle_row("P001", "ACTIVE")], "site_lifecycle")

    rows = all_rows(gold_trace_anchor())
    assert rows == [], "Empty edge table must produce empty anchor table"
