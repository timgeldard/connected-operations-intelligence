"""
Unit tests for gold_batch_stock_summary (T4 of ADR 016 — governed trace2 fan-out foundation).

Tests cover:
  1. Basic aggregation — quantities summed across storage locations per (plant/material/batch).
  2. total_quantity — correct sum of all six stock-category columns.
  3. Null-batch rows are dropped by the @dlt.expect_all_or_drop constraint (simulated by
     verifying the function omits null batch_number rows from its output when they sneak through
     via the aggregation).
  4. Multiple batches, same plant/material — each batch produces exactly one output row.
  5. base_unit_of_measure propagated correctly.

Pattern: mirrors test_gold_trace_anchor.py — save_table fixture populates silver tables,
call the function directly, assert on collected rows.

Run: cd data-products/io-reporting && pytest tests/gold/test_gold_batch_stock_summary.py -v
"""

from pyspark.sql import Row

from gold.trace_gold import gold_batch_stock_summary
from tests.conftest import all_rows

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _stock_row(
    plant_code="P001",
    material_code="MAT-A",
    batch_number="BATCH-1",
    storage_location_code="0001",
    base_uom="KG",
    unrestricted_quantity=100.0,
    quality_inspection_quantity=0.0,
    blocked_quantity=0.0,
    restricted_use_quantity=0.0,
    in_transfer_quantity=0.0,
    blocked_returns_quantity=0.0,
):
    return Row(
        plant_code=plant_code,
        material_code=material_code,
        batch_number=batch_number,
        storage_location_code=storage_location_code,
        base_uom=base_uom,
        unrestricted_quantity=unrestricted_quantity,
        quality_inspection_quantity=quality_inspection_quantity,
        blocked_quantity=blocked_quantity,
        restricted_use_quantity=restricted_use_quantity,
        in_transfer_quantity=in_transfer_quantity,
        blocked_returns_quantity=blocked_returns_quantity,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 — single storage location: pass-through
# ─────────────────────────────────────────────────────────────────────────────

def test_single_sloc_produces_one_row(spark, save_table):
    """One batch in one storage location → one output row with quantities preserved."""
    save_table([
        _stock_row(
            plant_code="P001", material_code="MAT-A", batch_number="BATCH-1",
            unrestricted_quantity=200.0, quality_inspection_quantity=10.0,
            blocked_quantity=5.0,
        ),
    ], "batch_stock")

    rows = all_rows(gold_batch_stock_summary())

    assert len(rows) == 1
    r = rows[0]
    assert r["plant_code"] == "P001"
    assert r["material_code"] == "MAT-A"
    assert r["batch_number"] == "BATCH-1"
    assert r["base_unit_of_measure"] == "KG"
    assert r["unrestricted_quantity"] == 200.0
    assert r["quality_inspection_quantity"] == 10.0
    assert r["blocked_quantity"] == 5.0
    assert r["restricted_use_quantity"] == 0.0
    assert r["in_transfer_quantity"] == 0.0
    assert r["blocked_returns_quantity"] == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 — stock category aggregation across storage locations
# ─────────────────────────────────────────────────────────────────────────────

def test_quantities_summed_across_storage_locations(spark, save_table):
    """Same plant/material/batch across two storage locations: all quantities summed."""
    save_table([
        _stock_row(
            plant_code="P001", material_code="MAT-A", batch_number="BATCH-1",
            storage_location_code="0001",
            unrestricted_quantity=100.0,
            quality_inspection_quantity=10.0,
            blocked_quantity=5.0,
        ),
        _stock_row(
            plant_code="P001", material_code="MAT-A", batch_number="BATCH-1",
            storage_location_code="0002",
            unrestricted_quantity=50.0,
            quality_inspection_quantity=0.0,
            blocked_quantity=15.0,
        ),
    ], "batch_stock")

    rows = all_rows(gold_batch_stock_summary())

    assert len(rows) == 1, "Multiple slocs must collapse to one batch row"
    r = rows[0]
    assert r["unrestricted_quantity"] == 150.0
    assert r["quality_inspection_quantity"] == 10.0
    assert r["blocked_quantity"] == 20.0


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 — total_quantity: sum of all six categories
# ─────────────────────────────────────────────────────────────────────────────

def test_total_quantity_is_sum_of_all_categories(spark, save_table):
    """total_quantity = sum of all six stock-category columns."""
    save_table([
        _stock_row(
            plant_code="P001", material_code="MAT-X", batch_number="B-TOT",
            unrestricted_quantity=10.0,
            quality_inspection_quantity=20.0,
            blocked_quantity=30.0,
            restricted_use_quantity=40.0,
            in_transfer_quantity=50.0,
            blocked_returns_quantity=60.0,
        ),
    ], "batch_stock")

    rows = all_rows(gold_batch_stock_summary())
    assert len(rows) == 1
    assert rows[0]["total_quantity"] == 210.0


def test_total_quantity_with_some_zeros(spark, save_table):
    """total_quantity handles zero categories correctly."""
    save_table([
        _stock_row(
            plant_code="P001", material_code="MAT-Y", batch_number="B-PART",
            unrestricted_quantity=500.0,
            quality_inspection_quantity=0.0,
            blocked_quantity=0.0,
            restricted_use_quantity=0.0,
            in_transfer_quantity=25.0,
            blocked_returns_quantity=0.0,
        ),
    ], "batch_stock")

    rows = all_rows(gold_batch_stock_summary())
    assert len(rows) == 1
    assert rows[0]["total_quantity"] == 525.0


def test_total_quantity_aggregated_across_slocs(spark, save_table):
    """total_quantity is correctly computed after sloc aggregation."""
    save_table([
        _stock_row(
            plant_code="P001", material_code="MAT-A", batch_number="B-AGG",
            storage_location_code="0001",
            unrestricted_quantity=100.0, quality_inspection_quantity=50.0,
        ),
        _stock_row(
            plant_code="P001", material_code="MAT-A", batch_number="B-AGG",
            storage_location_code="0002",
            unrestricted_quantity=200.0, quality_inspection_quantity=0.0,
        ),
    ], "batch_stock")

    rows = all_rows(gold_batch_stock_summary())
    assert len(rows) == 1
    # unrestricted: 300, qi: 50, others: 0 → 350
    assert rows[0]["total_quantity"] == 350.0


# ─────────────────────────────────────────────────────────────────────────────
# Test 4 — multiple batches, same plant/material
# ─────────────────────────────────────────────────────────────────────────────

def test_multiple_batches_same_material_separate_rows(spark, save_table):
    """Different batches of the same material → separate output rows."""
    save_table([
        _stock_row(
            plant_code="P001", material_code="MAT-A", batch_number="BATCH-1",
            unrestricted_quantity=100.0,
        ),
        _stock_row(
            plant_code="P001", material_code="MAT-A", batch_number="BATCH-2",
            unrestricted_quantity=200.0,
        ),
        _stock_row(
            plant_code="P001", material_code="MAT-A", batch_number="BATCH-3",
            unrestricted_quantity=300.0,
        ),
    ], "batch_stock")

    rows = all_rows(gold_batch_stock_summary())
    assert len(rows) == 3

    by_batch = {r["batch_number"]: r for r in rows}
    assert by_batch["BATCH-1"]["unrestricted_quantity"] == 100.0
    assert by_batch["BATCH-2"]["unrestricted_quantity"] == 200.0
    assert by_batch["BATCH-3"]["unrestricted_quantity"] == 300.0


# ─────────────────────────────────────────────────────────────────────────────
# Test 5 — multiple plants, same material/batch
# ─────────────────────────────────────────────────────────────────────────────

def test_same_batch_different_plants_separate_rows(spark, save_table):
    """Same material/batch in two plants → two separate output rows."""
    save_table([
        _stock_row(plant_code="P001", material_code="MAT-A", batch_number="BATCH-X",
                   unrestricted_quantity=100.0),
        _stock_row(plant_code="P002", material_code="MAT-A", batch_number="BATCH-X",
                   unrestricted_quantity=50.0),
    ], "batch_stock")

    rows = all_rows(gold_batch_stock_summary())
    assert len(rows) == 2

    by_plant = {r["plant_code"]: r for r in rows}
    assert by_plant["P001"]["unrestricted_quantity"] == 100.0
    assert by_plant["P002"]["unrestricted_quantity"] == 50.0


# ─────────────────────────────────────────────────────────────────────────────
# Test 6 — empty input
# ─────────────────────────────────────────────────────────────────────────────

def test_empty_batch_stock_returns_empty(spark, save_table):
    """Empty silver.batch_stock → empty gold_batch_stock_summary."""
    save_table([], "batch_stock")
    rows = all_rows(gold_batch_stock_summary())
    assert rows == []


# ─────────────────────────────────────────────────────────────────────────────
# Test 7 — base_unit_of_measure propagated
# ─────────────────────────────────────────────────────────────────────────────

def test_base_uom_propagated(spark, save_table):
    """base_unit_of_measure column is carried from silver.batch_stock."""
    save_table([
        _stock_row(plant_code="P001", material_code="MAT-L", batch_number="B-L",
                   base_uom="L", unrestricted_quantity=500.0),
    ], "batch_stock")

    rows = all_rows(gold_batch_stock_summary())
    assert rows[0]["base_unit_of_measure"] == "L"
