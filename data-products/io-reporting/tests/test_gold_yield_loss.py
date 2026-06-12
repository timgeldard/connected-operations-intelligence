"""
Tests for Yield & Loss Gold tables:
  - gold_wm_order_yield       (wm_operations_gold.py)
  - gold_wm_order_component_variance (wm_operations_gold.py)

Pattern follows tests/test_gold_wm_operations.py: seed required silver tables in the
local spark_catalog `silver` database, call the Gold function directly, and assert on
derived columns and edge-case handling.

NOTE: These tests require a Spark/Java runtime and run in CI only (not locally without JDK).
"""

import pytest
from pyspark.sql import Row, SparkSession

from tests.conftest import all_rows, create_df  # noqa: F401 (used via all_rows)

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module", autouse=True)
def setup_silver_yield(spark: SparkSession):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver_yield")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver_yield")

    _save(spark, [
        Row(plant_code="C061", material_code="FG1", material_description="Finished Good One"),
        Row(plant_code="C061", material_code="RM1", material_description="Raw Material One"),
        Row(plant_code="C061", material_code="RM2", material_description="Raw Material Two"),
    ], "material")

    _save(spark, [
        Row(plant_code="C061", material_code="FG1",
            valuation_area="C061", standard_price=10.0, price_unit=1),
        Row(plant_code="C061", material_code="RM1",
            valuation_area="C061", standard_price=5.0, price_unit=1),
        Row(plant_code="C061", material_code="RM2",
            valuation_area="C061", standard_price=None, price_unit=None),
    ], "material_valuation")

    yield
    spark.sql("DROP DATABASE IF EXISTS silver_yield CASCADE")


def _save(spark, rows, table):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(f"silver_yield.{table}")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _order_row(**overrides):
    import datetime
    base = dict(
        plant_code="C061",
        order_number="900001",
        material_code="FG1",
        production_line="LINE_A",
        order_quantity=100.0,
        order_quantity_uom="KG",
        confirmed_yield_quantity=None,
        scheduled_start_date=datetime.date(2026, 6, 1),
        scheduled_finish_date=datetime.date(2026, 6, 2),
        actual_finish_date=None,
        actual_release_date=datetime.date(2026, 6, 1),
        is_released=True,
        is_completed=False,
        is_closed=False,
        is_deletion_flagged=False,
    )
    base.update(overrides)
    return Row(**base)


def _goods_row(**overrides):
    import datetime
    base = dict(
        plant_code="C061",
        order_number="900001",
        material_code="FG1",
        material_document_number="4900000001",
        fiscal_year="2026",
        document_line_item="0001",
        movement_type_code="101",
        quantity=90.0,
        base_uom="KG",
        posting_date=datetime.date(2026, 6, 2),
    )
    base.update(overrides)
    return Row(**base)


def _resb_row(**overrides):
    base = dict(
        plant_code="C061",
        order_number="900001",
        reservation_number="RS0001",
        reservation_item="0001",
        material_code="RM1",
        required_quantity=50.0,
        withdrawn_quantity=0.0,
        movement_type_code="261",
        base_uom="KG",
        is_deletion_flagged=False,
        is_final_issue=False,
    )
    base.update(overrides)
    return Row(**base)


def _issue_row(**overrides):
    import datetime
    base = dict(
        plant_code="C061",
        order_number="900001",
        material_code="RM1",
        material_document_number="4900000002",
        fiscal_year="2026",
        document_line_item="0001",
        movement_type_code="261",
        quantity=55.0,
        base_uom="KG",
        posting_date=datetime.date(2026, 6, 2),
    )
    base.update(overrides)
    return Row(**base)


# ── gold_wm_order_yield ───────────────────────────────────────────────────────


class TestGoldWmOrderYield:
    def _run(self, spark: SparkSession, orders, movements):
        _save(spark, orders, "process_order")
        _save(spark, movements, "goods_movement")
        from gold.wm_operations_gold import gold_wm_order_yield
        return all_rows(gold_wm_order_yield())

    def test_basic_yield(self, spark: SparkSession):
        """90 KG delivered against 100 KG planned → yield_pct = 0.9."""
        rows = self._run(spark, [_order_row()], [_goods_row(quantity=90.0)])
        assert len(rows) == 1
        r = rows[0]
        assert r.order_number == "900001"
        assert abs(r.delivered_qty - 90.0) < 0.001
        assert abs(r.yield_pct - 0.9) < 0.001
        assert r.has_goods_receipt is True

    def test_101_minus_102_net(self, spark: SparkSession):
        """GR reversal (102) reduces delivered_qty: 90 - 10 = 80 KG."""
        rows = self._run(spark, [_order_row()], [
            _goods_row(movement_type_code="101", quantity=90.0,
                       material_document_number="4900000001", document_line_item="0001"),
            _goods_row(movement_type_code="102", quantity=10.0,
                       material_document_number="4900000002", document_line_item="0001"),
        ])
        assert len(rows) == 1
        r = rows[0]
        assert abs(r.delivered_qty - 80.0) < 0.001

    def test_no_gr_yields_zero_delivered(self, spark: SparkSession):
        """Order with no GR → delivered_qty = 0, has_goods_receipt = False, yield_pct = None."""
        rows = self._run(spark, [_order_row()], [])
        assert len(rows) == 1
        r = rows[0]
        assert r.delivered_qty == 0.0
        assert r.has_goods_receipt is False
        assert r.yield_pct is None

    def test_zero_planned_qty_yields_null_pct(self, spark: SparkSession):
        """Order with planned_qty = 0 → yield_pct is None (division guard)."""
        rows = self._run(
            spark,
            [_order_row(order_quantity=0.0)],
            [_goods_row(quantity=5.0)],
        )
        assert len(rows) == 1
        assert rows[0].yield_pct is None

    def test_is_complete_flag(self, spark: SparkSession):
        """actual_finish_date set → is_complete = True."""
        import datetime
        rows = self._run(
            spark,
            [_order_row(actual_finish_date=datetime.date(2026, 6, 2))],
            [],
        )
        assert rows[0].is_complete is True

    def test_multiple_orders(self, spark: SparkSession):
        """Two orders produce two rows each with correct yield."""
        rows = self._run(spark, [
            _order_row(order_number="900001", order_quantity=100.0),
            _order_row(order_number="900002", order_quantity=200.0),
        ], [
            _goods_row(order_number="900001", quantity=95.0),
            _goods_row(order_number="900002", quantity=200.0,
                       material_document_number="4900000099", document_line_item="0001"),
        ])
        assert len(rows) == 2
        by_order = {r.order_number: r for r in rows}
        assert abs(by_order["900001"].yield_pct - 0.95) < 0.001
        assert abs(by_order["900002"].yield_pct - 1.0) < 0.001


# ── gold_wm_order_component_variance ─────────────────────────────────────────


class TestGoldWmOrderComponentVariance:
    def _run(self, spark: SparkSession, orders, reservations, movements):
        _save(spark, orders, "process_order")
        _save(spark, reservations, "reservation_requirement")
        _save(spark, movements, "goods_movement")
        from gold.wm_operations_gold import gold_wm_order_component_variance
        return all_rows(gold_wm_order_component_variance())

    def test_over_issue_positive_variance(self, spark: SparkSession):
        """Issued 55 against required 50 → variance_qty = 5, variance_pct ≈ 0.1."""
        rows = self._run(
            spark,
            [_order_row()],
            [_resb_row(required_quantity=50.0)],
            [_issue_row(quantity=55.0)],
        )
        assert len(rows) == 1
        r = rows[0]
        assert abs(r.variance_qty - 5.0) < 0.001
        assert abs(r.variance_pct - 0.1) < 0.001

    def test_under_issue_negative_variance(self, spark: SparkSession):
        """Issued 40 against required 50 → variance_qty = -10."""
        rows = self._run(
            spark,
            [_order_row()],
            [_resb_row(required_quantity=50.0)],
            [_issue_row(quantity=40.0)],
        )
        assert len(rows) == 1
        assert abs(rows[0].variance_qty - (-10.0)) < 0.001

    def test_261_minus_262_net(self, spark: SparkSession):
        """Issue reversal (262) reduces issued_qty: 55 - 5 = 50 → variance = 0."""
        rows = self._run(
            spark,
            [_order_row()],
            [_resb_row(required_quantity=50.0)],
            [
                _issue_row(movement_type_code="261", quantity=55.0,
                           material_document_number="4900000002", document_line_item="0001"),
                _issue_row(movement_type_code="262", quantity=5.0,
                           material_document_number="4900000003", document_line_item="0001"),
            ],
        )
        assert len(rows) == 1
        assert abs(rows[0].variance_qty) < 0.001

    def test_est_loss_value_with_price(self, spark: SparkSession):
        """Over-issued 5 KG of RM1 (price 5.0/KG) → est_loss_value = 25.0."""
        rows = self._run(
            spark,
            [_order_row()],
            [_resb_row(required_quantity=50.0)],
            [_issue_row(quantity=55.0)],
        )
        assert len(rows) == 1
        assert rows[0].est_loss_value is not None
        assert abs(rows[0].est_loss_value - 25.0) < 0.001

    def test_no_price_gives_null_loss_value(self, spark: SparkSession):
        """RM2 has no standard_price → est_loss_value = None."""
        rows = self._run(
            spark,
            [_order_row(material_code="FG1")],
            [_resb_row(material_code="RM2", required_quantity=50.0)],
            [_issue_row(material_code="RM2", quantity=55.0)],
        )
        assert len(rows) == 1
        assert rows[0].est_loss_value is None

    def test_deletion_flagged_excluded(self, spark: SparkSession):
        """Deletion-flagged reservation is excluded from output."""
        rows = self._run(
            spark,
            [_order_row()],
            [_resb_row(is_deletion_flagged=True)],
            [_issue_row(quantity=55.0)],
        )
        assert len(rows) == 0

    def test_zero_required_excluded(self, spark: SparkSession):
        """Zero-required-qty reservation is excluded."""
        rows = self._run(
            spark,
            [_order_row()],
            [_resb_row(required_quantity=0.0)],
            [_issue_row(quantity=5.0)],
        )
        assert len(rows) == 0

    def test_under_issue_no_loss_value(self, spark: SparkSession):
        """Under-issued (negative variance) → est_loss_value is None (not a loss)."""
        rows = self._run(
            spark,
            [_order_row()],
            [_resb_row(required_quantity=50.0)],
            [_issue_row(quantity=40.0)],
        )
        assert len(rows) == 1
        assert rows[0].est_loss_value is None

    def test_multiple_resb_rows_same_material_no_double_count(self, spark: SparkSession):
        """Two RESB rows for the same order+material must aggregate to one output row.

        Regression guard for the double-count bug: at reservation grain, issued_qty (55)
        would be joined to each of the two RESB rows, yielding issued_qty = 55 per row
        and total variance = 2×(55-25) = 60.  At order+material grain the RESB rows are
        aggregated first (required = 25+25 = 50) and issued_qty is joined once (55), so
        variance_qty = 55 - 50 = 5.
        """
        rows = self._run(
            spark,
            [_order_row()],
            [
                _resb_row(reservation_item="0001", required_quantity=25.0),
                _resb_row(reservation_item="0002", required_quantity=25.0),
            ],
            [_issue_row(quantity=55.0)],
        )
        # Must be exactly one row (order+material grain, not reservation grain)
        assert len(rows) == 1
        r = rows[0]
        assert r.order_number == "900001"
        assert r.material_code == "RM1"
        # required_qty should be the SUM of both RESB rows
        assert abs(r.required_qty - 50.0) < 0.001
        # issued_qty should be counted once (not multiplied per RESB row)
        assert abs(r.issued_qty - 55.0) < 0.001
        assert abs(r.variance_qty - 5.0) < 0.001
