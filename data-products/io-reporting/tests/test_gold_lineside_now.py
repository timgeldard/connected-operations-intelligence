"""
Tests for gold_wm_lineside_now and gold_wm_lineside_lines (wm_operations_gold.py).

Covers:
  - Running-order selection (released + not-finished + not-closed + production_line not null)
  - Exclusion of finished/closed/no-production-line orders
  - Current-phase derivation (latest confirmed operation by operation_counter)
  - pct_complete guard (clamped 0–100)
  - Line filter (only orders on the requested line appear)
  - 0, 1, N concurrent orders per line
  - Null batch handling (no batch column in silver — confirmed null propagation)
  - gold_wm_lineside_lines: active_order_count accuracy; line_label fallback

NOTE: These tests require a Spark/Java runtime and run in CI only (not locally without JDK).
Pattern: seed required silver tables in the local spark_catalog `silver` database, inject
a mock dlt.read into gold table functions, call the Gold function directly, assert on rows.
"""

import datetime

import pytest
from pyspark.sql import Row, SparkSession

from tests.conftest import all_rows, create_df  # noqa: F401

# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module", autouse=True)
def setup_lineside_silver(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver_lineside")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver_lineside")

    _save(spark, _MATERIAL_ROWS, "material")
    _save(spark, _MATERIAL_VALUATION_ROWS, "material_valuation")
    _save(spark, _PROCESS_ORDER_ROWS, "process_order")
    _save(spark, _OPERATION_ROWS, "process_order_operation")

    yield
    spark.sql("DROP DATABASE IF EXISTS silver_lineside CASCADE")


def _save(spark, rows, table):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(f"silver_lineside.{table}")


# ── Test data ─────────────────────────────────────────────────────────────────

_D = datetime.date

# Materials
_MATERIAL_ROWS = [
    Row(plant_code="C061", material_code="FG001", material_description="Widget Alpha"),
    Row(plant_code="C061", material_code="FG002", material_description="Widget Beta"),
]
_MATERIAL_VALUATION_ROWS = [
    Row(plant_code="C061", material_code="FG001", valuation_area="C061",
        standard_price=10.0, price_unit=1),
    Row(plant_code="C061", material_code="FG002", valuation_area="C061",
        standard_price=12.0, price_unit=1),
]

# Process orders — a mix of running, finished, closed, and no-line orders
_PROCESS_ORDER_ROWS = [
    # ORDER 1: running on LINE_A (the canonical test case)
    Row(plant_code="C061", order_number="ORD001", material_code="FG001",
        production_line="LINE_A", production_line_description="Line Alpha",
        order_quantity=100.0, order_quantity_uom="KG", confirmed_yield_quantity=None,
        scheduled_start_date=_D(2026, 6, 13), scheduled_finish_date=_D(2026, 6, 13),
        scheduled_start_datetime=datetime.datetime(2026, 6, 13, 6, 0),
        scheduled_finish_datetime=datetime.datetime(2026, 6, 13, 14, 0),
        actual_start_date=_D(2026, 6, 13), actual_finish_date=None,
        actual_release_date=_D(2026, 6, 13),
        is_released=True, is_closed=False, is_completed=False, is_deletion_flagged=False),
    # ORDER 2: also running on LINE_A — tests N concurrent orders
    Row(plant_code="C061", order_number="ORD002", material_code="FG002",
        production_line="LINE_A", production_line_description="Line Alpha",
        order_quantity=50.0, order_quantity_uom="KG", confirmed_yield_quantity=None,
        scheduled_start_date=_D(2026, 6, 13), scheduled_finish_date=_D(2026, 6, 13),
        scheduled_start_datetime=datetime.datetime(2026, 6, 13, 7, 0),
        scheduled_finish_datetime=datetime.datetime(2026, 6, 13, 15, 0),
        actual_start_date=_D(2026, 6, 13), actual_finish_date=None,
        actual_release_date=_D(2026, 6, 13),
        is_released=True, is_closed=False, is_completed=False, is_deletion_flagged=False),
    # ORDER 3: finished — must be EXCLUDED
    Row(plant_code="C061", order_number="ORD003", material_code="FG001",
        production_line="LINE_A", production_line_description="Line Alpha",
        order_quantity=80.0, order_quantity_uom="KG", confirmed_yield_quantity=78.0,
        scheduled_start_date=_D(2026, 6, 12), scheduled_finish_date=_D(2026, 6, 12),
        scheduled_start_datetime=datetime.datetime(2026, 6, 12, 6, 0),
        scheduled_finish_datetime=datetime.datetime(2026, 6, 12, 14, 0),
        actual_start_date=_D(2026, 6, 12), actual_finish_date=_D(2026, 6, 12),
        actual_release_date=_D(2026, 6, 12),
        is_released=True, is_closed=False, is_completed=True, is_deletion_flagged=False),
    # ORDER 4: running but NO production_line — must be EXCLUDED
    Row(plant_code="C061", order_number="ORD004", material_code="FG001",
        production_line=None, production_line_description=None,
        order_quantity=40.0, order_quantity_uom="KG", confirmed_yield_quantity=None,
        scheduled_start_date=_D(2026, 6, 13), scheduled_finish_date=_D(2026, 6, 13),
        scheduled_start_datetime=datetime.datetime(2026, 6, 13, 8, 0),
        scheduled_finish_datetime=datetime.datetime(2026, 6, 13, 16, 0),
        actual_start_date=_D(2026, 6, 13), actual_finish_date=None,
        actual_release_date=_D(2026, 6, 13),
        is_released=True, is_closed=False, is_completed=False, is_deletion_flagged=False),
    # ORDER 5: running on LINE_B (different line)
    Row(plant_code="C061", order_number="ORD005", material_code="FG001",
        production_line="LINE_B", production_line_description="Line Beta",
        order_quantity=60.0, order_quantity_uom="KG", confirmed_yield_quantity=None,
        scheduled_start_date=_D(2026, 6, 13), scheduled_finish_date=_D(2026, 6, 13),
        scheduled_start_datetime=datetime.datetime(2026, 6, 13, 6, 0),
        scheduled_finish_datetime=datetime.datetime(2026, 6, 13, 14, 0),
        actual_start_date=_D(2026, 6, 13), actual_finish_date=None,
        actual_release_date=_D(2026, 6, 13),
        is_released=True, is_closed=False, is_completed=False, is_deletion_flagged=False),
    # ORDER 6: closed — must be EXCLUDED
    Row(plant_code="C061", order_number="ORD006", material_code="FG001",
        production_line="LINE_A", production_line_description="Line Alpha",
        order_quantity=30.0, order_quantity_uom="KG", confirmed_yield_quantity=None,
        scheduled_start_date=_D(2026, 6, 13), scheduled_finish_date=_D(2026, 6, 13),
        scheduled_start_datetime=datetime.datetime(2026, 6, 13, 6, 0),
        scheduled_finish_datetime=datetime.datetime(2026, 6, 13, 14, 0),
        actual_start_date=None, actual_finish_date=None,
        actual_release_date=_D(2026, 6, 13),
        is_released=True, is_closed=True, is_completed=False, is_deletion_flagged=False),
]

# Operations — for testing current-phase derivation
_OPERATION_ROWS = [
    # ORD001: two confirmed operations; operation_counter 2 is latest
    Row(plant_code="C061", order_number="ORD001", routing_number="R001",
        operation_counter="0001", operation_number="0010",
        operation_description="Mixing", control_key="PP01",
        is_confirmed=True,
        actual_start_datetime=datetime.datetime(2026, 6, 13, 6, 10),
        actual_finish_date=None,
        scheduled_start_datetime=datetime.datetime(2026, 6, 13, 6, 0),
        scheduled_finish_datetime=datetime.datetime(2026, 6, 13, 8, 0),
        confirmed_yield_quantity=50.0, confirmed_scrap_quantity=0.0,
        actual_processing_start_datetime=None, actual_processing_finish_date=None,
        operation_quantity=100.0, planned_work=2.0, planned_work_unit="H",
        confirmed_activity_1=None, actual_work=None, standard_duration=None,
        standard_duration_unit=None, confirmation_number="CONF01",
        work_centre_internal_id="WC01", number_of_employees=2,
        setup_group_category=None, setup_group_key=None,
        _replicated_at=datetime.datetime(2026, 6, 13, 6, 30)),
    Row(plant_code="C061", order_number="ORD001", routing_number="R001",
        operation_counter="0002", operation_number="0020",
        operation_description="Filling", control_key="PP01",
        is_confirmed=True,
        actual_start_datetime=datetime.datetime(2026, 6, 13, 8, 30),
        actual_finish_date=None,
        scheduled_start_datetime=datetime.datetime(2026, 6, 13, 8, 0),
        scheduled_finish_datetime=datetime.datetime(2026, 6, 13, 12, 0),
        confirmed_yield_quantity=None, confirmed_scrap_quantity=None,
        actual_processing_start_datetime=None, actual_processing_finish_date=None,
        operation_quantity=100.0, planned_work=4.0, planned_work_unit="H",
        confirmed_activity_1=None, actual_work=None, standard_duration=None,
        standard_duration_unit=None, confirmation_number="CONF02",
        work_centre_internal_id="WC02", number_of_employees=2,
        setup_group_category=None, setup_group_key=None,
        _replicated_at=datetime.datetime(2026, 6, 13, 8, 45)),
    # ORD001: unconfirmed op — must NOT become current phase
    Row(plant_code="C061", order_number="ORD001", routing_number="R001",
        operation_counter="0003", operation_number="0030",
        operation_description="Packing", control_key="PP01",
        is_confirmed=False,
        actual_start_datetime=None,
        actual_finish_date=None,
        scheduled_start_datetime=datetime.datetime(2026, 6, 13, 12, 0),
        scheduled_finish_datetime=datetime.datetime(2026, 6, 13, 14, 0),
        confirmed_yield_quantity=None, confirmed_scrap_quantity=None,
        actual_processing_start_datetime=None, actual_processing_finish_date=None,
        operation_quantity=100.0, planned_work=2.0, planned_work_unit="H",
        confirmed_activity_1=None, actual_work=None, standard_duration=None,
        standard_duration_unit=None, confirmation_number=None,
        work_centre_internal_id="WC03", number_of_employees=1,
        setup_group_category=None, setup_group_key=None,
        _replicated_at=datetime.datetime(2026, 6, 13, 6, 0)),
    # ORD002: no confirmed operations (tests null current-phase)
    # ORD005: one confirmed op — setup (PP02 prefix)
    Row(plant_code="C061", order_number="ORD005", routing_number="R005",
        operation_counter="0001", operation_number="0010",
        operation_description="Line Setup", control_key="PP02",
        is_confirmed=True,
        actual_start_datetime=datetime.datetime(2026, 6, 13, 6, 5),
        actual_finish_date=None,
        scheduled_start_datetime=datetime.datetime(2026, 6, 13, 6, 0),
        scheduled_finish_datetime=datetime.datetime(2026, 6, 13, 7, 0),
        confirmed_yield_quantity=None, confirmed_scrap_quantity=None,
        actual_processing_start_datetime=None, actual_processing_finish_date=None,
        operation_quantity=60.0, planned_work=1.0, planned_work_unit="H",
        confirmed_activity_1=None, actual_work=None, standard_duration=None,
        standard_duration_unit=None, confirmation_number="CONF05",
        work_centre_internal_id="WC05", number_of_employees=1,
        setup_group_category=None, setup_group_key=None,
        _replicated_at=datetime.datetime(2026, 6, 13, 6, 10)),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _run_gold_lineside_now(spark: SparkSession, yield_rows: list[Row]) -> list[Row]:
    """Call gold_wm_lineside_now with a mocked dlt.read that returns yield_rows."""
    import sys
    # dlt is already mocked by conftest; we need to set dlt.read to return yield_df
    yield_df = create_df(spark, yield_rows) if yield_rows else spark.createDataFrame([], "order_number STRING, yield_pct DOUBLE")
    dlt_mock = sys.modules["dlt"]
    original_read = dlt_mock.read

    def mock_read(name):
        if name == "gold_wm_order_yield":
            return yield_df
        return original_read(name)

    dlt_mock.read = mock_read
    try:
        from gold.wm_operations_gold import gold_wm_lineside_now
        result_df = gold_wm_lineside_now()
    finally:
        dlt_mock.read = original_read

    return result_df.collect()


def _run_gold_lineside_lines(spark: SparkSession) -> list[Row]:
    """Call gold_wm_lineside_lines directly."""
    from gold.wm_operations_gold import gold_wm_lineside_lines
    return gold_wm_lineside_lines().collect()


def _yield_row(order_number: str, yield_pct: float) -> Row:
    return Row(order_number=order_number, plant_code="C061", yield_pct=yield_pct)


# ── Tests: running-order selection ────────────────────────────────────────────

class TestRunningOrderSelection:
    def test_finished_order_excluded(self, spark: SparkSession):
        rows = _run_gold_lineside_now(spark, [])
        order_ids = [r.order_number for r in rows]
        assert "ORD003" not in order_ids, "Finished order (actual_finish_date set) must be excluded"

    def test_closed_order_excluded(self, spark: SparkSession):
        rows = _run_gold_lineside_now(spark, [])
        order_ids = [r.order_number for r in rows]
        assert "ORD006" not in order_ids, "Closed order (is_closed=True) must be excluded"

    def test_no_production_line_excluded(self, spark: SparkSession):
        rows = _run_gold_lineside_now(spark, [])
        order_ids = [r.order_number for r in rows]
        assert "ORD004" not in order_ids, "Order with null production_line must be excluded"

    def test_running_orders_included(self, spark: SparkSession):
        rows = _run_gold_lineside_now(spark, [])
        order_ids = [r.order_number for r in rows]
        # ORD001, ORD002, ORD005 are running
        assert "ORD001" in order_ids
        assert "ORD002" in order_ids
        assert "ORD005" in order_ids

    def test_line_filter_isolation(self, spark: SparkSession):
        """LINE_A and LINE_B orders are separate rows in the output — grain is correct."""
        rows = _run_gold_lineside_now(spark, [])
        line_a_orders = [r.order_number for r in rows if r.production_line == "LINE_A"]
        line_b_orders = [r.order_number for r in rows if r.production_line == "LINE_B"]
        assert set(line_a_orders) == {"ORD001", "ORD002"}
        assert set(line_b_orders) == {"ORD005"}

    def test_zero_concurrent_orders_per_line(self, spark: SparkSession):
        """LINE_C (no orders) should produce zero rows — confirms the grain is correct."""
        rows = _run_gold_lineside_now(spark, [])
        line_c_orders = [r for r in rows if r.production_line == "LINE_C"]
        assert len(line_c_orders) == 0

    def test_n_concurrent_orders(self, spark: SparkSession):
        """LINE_A has exactly 2 running orders (ORD001, ORD002) — N > 1 case."""
        rows = _run_gold_lineside_now(spark, [])
        line_a = [r for r in rows if r.production_line == "LINE_A"]
        assert len(line_a) == 2


# ── Tests: current-phase derivation ──────────────────────────────────────────

class TestCurrentPhaseDerivation:
    def test_latest_confirmed_op_selected(self, spark: SparkSession):
        """ORD001 has operations 0001 (counter) and 0002 — latest should be 0002 (Filling)."""
        rows = _run_gold_lineside_now(spark, [])
        ord001 = next(r for r in rows if r.order_number == "ORD001")
        assert ord001.current_operation_number == "0020", (
            f"Expected operation 0020 (Filling, highest counter), got {ord001.current_operation_number}"
        )
        assert ord001.current_operation_description == "Filling"

    def test_unconfirmed_op_not_selected(self, spark: SparkSession):
        """ORD001 op 0030 (Packing) is unconfirmed — must not become current phase."""
        rows = _run_gold_lineside_now(spark, [])
        ord001 = next(r for r in rows if r.order_number == "ORD001")
        assert ord001.current_operation_description != "Packing"

    def test_null_current_phase_when_no_confirmed_ops(self, spark: SparkSession):
        """ORD002 has no confirmed operations — current_operation_number must be null."""
        rows = _run_gold_lineside_now(spark, [])
        ord002 = next(r for r in rows if r.order_number == "ORD002")
        assert ord002.current_operation_number is None
        assert ord002.current_operation_description is None
        assert ord002.current_activity_type is None

    def test_setup_activity_type_derived_from_control_key(self, spark: SparkSession):
        """ORD005 op has control_key PP02 — current_activity_type must be 'Setup'."""
        rows = _run_gold_lineside_now(spark, [])
        ord005 = next(r for r in rows if r.order_number == "ORD005")
        assert ord005.current_activity_type == "Setup", (
            f"Expected 'Setup' for PP02 control_key, got {ord005.current_activity_type!r}"
        )

    def test_processing_activity_type_for_pp01(self, spark: SparkSession):
        """ORD001 op 0020 has PP01 — activity type must be 'Processing'."""
        rows = _run_gold_lineside_now(spark, [])
        ord001 = next(r for r in rows if r.order_number == "ORD001")
        assert ord001.current_activity_type == "Processing"


# ── Tests: pct_complete guard ─────────────────────────────────────────────────

class TestPctCompleteGuard:
    def test_pct_complete_clamped_at_100(self, spark: SparkSession):
        """yield_pct > 1.0 (e.g. 1.05 = 105%) must clamp to 100.0."""
        yield_rows = [_yield_row("ORD001", 1.05)]
        rows = _run_gold_lineside_now(spark, yield_rows)
        ord001 = next(r for r in rows if r.order_number == "ORD001")
        assert ord001.pct_complete is not None
        assert ord001.pct_complete <= 100.0, (
            f"pct_complete must be clamped at 100.0, got {ord001.pct_complete}"
        )

    def test_pct_complete_clamped_at_zero(self, spark: SparkSession):
        """Negative yield_pct must not produce negative pct_complete."""
        yield_rows = [_yield_row("ORD001", -0.1)]
        rows = _run_gold_lineside_now(spark, yield_rows)
        ord001 = next(r for r in rows if r.order_number == "ORD001")
        # negative yields are filtered out in get_wm_lineside_now_spec; the MV sees None
        # because the filter is yield_pct IS NOT NULL. In the gold MV itself, pct_complete
        # is greatest(0.0, ...) so it cannot be negative.
        if ord001.pct_complete is not None:
            assert ord001.pct_complete >= 0.0

    def test_pct_complete_null_when_no_yield(self, spark: SparkSession):
        """No GR evidence → pct_complete should be null."""
        rows = _run_gold_lineside_now(spark, [])  # no yield rows
        ord001 = next(r for r in rows if r.order_number == "ORD001")
        assert ord001.pct_complete is None, (
            "pct_complete must be null when no goods receipt evidence"
        )

    def test_pct_complete_normal_case(self, spark: SparkSession):
        """yield_pct = 0.75 → pct_complete = 75.0."""
        yield_rows = [_yield_row("ORD001", 0.75)]
        rows = _run_gold_lineside_now(spark, yield_rows)
        ord001 = next(r for r in rows if r.order_number == "ORD001")
        assert ord001.pct_complete == pytest.approx(75.0, abs=0.01)


# ── Tests: planned_minutes ────────────────────────────────────────────────────

class TestPlannedMinutes:
    def test_planned_minutes_computed_from_schedule(self, spark: SparkSession):
        """ORD001: 06:00 to 14:00 = 480 minutes."""
        rows = _run_gold_lineside_now(spark, [])
        ord001 = next(r for r in rows if r.order_number == "ORD001")
        assert ord001.planned_minutes == 480, (
            f"Expected 480 planned_minutes (8 hours), got {ord001.planned_minutes}"
        )


# ── Tests: null batch handling ────────────────────────────────────────────────

class TestNullBatch:
    def test_no_batch_column_does_not_fail(self, spark: SparkSession):
        """gold_wm_lineside_now has no batch column (null batch design). Output is clean."""
        rows = _run_gold_lineside_now(spark, [])
        # Simply assert the function runs and returns rows with expected schema columns
        assert len(rows) > 0
        # batch is NOT a column in gold_wm_lineside_now — the MV does not expose it.
        col_names = rows[0].__fields__
        assert "batch" not in col_names, (
            "gold_wm_lineside_now must NOT expose a batch column (null-batch design)"
        )


# ── Tests: gold_wm_lineside_lines ─────────────────────────────────────────────

class TestLinesideLines:
    def test_active_order_count_correct(self, spark: SparkSession):
        """LINE_A has 2 running orders (ORD001, ORD002); LINE_B has 1 (ORD005)."""
        rows = _run_gold_lineside_lines(spark)
        line_a = next(r for r in rows if r.production_line == "LINE_A")
        line_b = next(r for r in rows if r.production_line == "LINE_B")
        assert line_a.active_order_count == 2, (
            f"Expected 2 active orders on LINE_A, got {line_a.active_order_count}"
        )
        assert line_b.active_order_count == 1

    def test_line_label_from_description(self, spark: SparkSession):
        """LINE_A has description 'Line Alpha' — line_label should use it."""
        rows = _run_gold_lineside_lines(spark)
        line_a = next(r for r in rows if r.production_line == "LINE_A")
        assert line_a.line_label == "Line Alpha", (
            f"line_label should be 'Line Alpha', got {line_a.line_label!r}"
        )

    def test_finished_orders_not_counted_in_active(self, spark: SparkSession):
        """ORD003 (finished on LINE_A) must not inflate active_order_count."""
        rows = _run_gold_lineside_lines(spark)
        line_a = next(r for r in rows if r.production_line == "LINE_A")
        # If ORD003 were counted, count would be 3; correct is 2
        assert line_a.active_order_count == 2

    def test_active_order_count_type_is_long(self, spark: SparkSession):
        """active_order_count must be bigint (long) per contract convention."""
        from gold.wm_operations_gold import gold_wm_lineside_lines
        df = gold_wm_lineside_lines()
        field = next(f for f in df.schema.fields if f.name == "active_order_count")
        from pyspark.sql.types import LongType
        assert isinstance(field.dataType, LongType), (
            f"active_order_count must be LongType (bigint), got {field.dataType}"
        )
