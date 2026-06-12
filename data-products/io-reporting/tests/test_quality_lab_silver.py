"""
Unit tests for quality_lab silver helper logic.

Tests the ENSTEHDAT dual-format pushdown predicate and the MANDANT-qualified
QAMR/QAMV join used by _gated_qals_for_lab + the quality_lab_inspection_result
and quality_lab_characteristic_spec functions.

The silver pipeline functions rely on DLT decorators and spark.read.table against
live Bronze tables, so we test the logic in isolation — extracting the filter
predicate and join structure with in-memory DataFrames rather than running the full
DLT definitions.

Root-cause probe results (2026-06-12, connected_plant_uat):
  - PRUEFLOS: 12 chars, no padding — TRIM is a no-op (no strip_zeros needed).
  - ENSTEHDAT: 100% ISO 'yyyy-MM-dd' in UAT (zero compact rows, verified).
  - Inner JOIN on PRUEFLOS+MANDANT returns 153M rows — join logic is correct.
  - 4-row silver count = QAMR replication lag for C061/P806/P817 (AEDATTM stale
    at 2026-03-25 to 2026-04-20); C351 is current. Not a code bug.

These tests guard the dual-format predicate so a future compact-format replication
config (or environment migration) does not silently drop recent lots.

Window change (feature/lab-board-filters): _gated_qals_for_lab now uses
qm_lookback_years (default 5y, add_months) instead of lab_board_lookback_days (days).
The predicate shape is identical — only the base_date calculation changes.  Tests
below use a years-based helper that mirrors the new logic.
"""

import datetime

from pyspark.sql import Row, SparkSession
from pyspark.sql import functions as F

# ── ENSTEHDAT dual-format predicate (mirrors _gated_qals_for_lab) ────────────

def _apply_enstehdat_filter_years(spark: SparkSession, rows, years: int):
    """Apply the quality_lab.py dual-format ENSTEHDAT predicate to an in-memory DataFrame.

    Mirrors the logic in _gated_qals_for_lab exactly — years-based add_months cutoff +
    length discriminator + dual-format OR predicate.
    Determinism-exempt: rolling window evaluated at call time.
    """
    df = spark.createDataFrame(rows, "ENSTEHDAT STRING")
    base_date = F.add_months(F.current_date(), -12 * years)
    cutoff_compact = F.date_format(base_date, "yyyyMMdd")
    cutoff_iso = F.date_format(base_date, "yyyy-MM-dd")
    keep = (
        F.col("ENSTEHDAT").isNull()
        | ((F.length(F.trim(F.col("ENSTEHDAT"))) == 8) & (F.col("ENSTEHDAT") >= cutoff_compact))
        | ((F.length(F.trim(F.col("ENSTEHDAT"))) == 10) & (F.col("ENSTEHDAT") >= cutoff_iso))
    )
    return df.filter(keep)


class TestEnstehdatFilter:
    """Guards the dual-format ENSTEHDAT predicate against both format variants.

    Uses a 1-year window (years=1) for most tests — recent dates are within 1 year and
    dates 3+ years ago are outside it, giving the same pass/fail semantics as the
    original 30-day tests but exercising the add_months path.
    """

    def test_iso_format_recent_row_passes(self, spark: SparkSession):
        """A lot created one month ago (ISO format) is within the 1-year window."""
        one_month_ago = (datetime.date.today() - datetime.timedelta(days=30)).strftime("%Y-%m-%d")
        rows = [Row(ENSTEHDAT=one_month_ago)]
        result = _apply_enstehdat_filter_years(spark, rows, years=1)
        assert result.count() == 1

    def test_iso_format_old_row_filtered(self, spark: SparkSession):
        """A lot created 3 years ago (ISO format) falls outside the 1-year window."""
        old = (datetime.date.today() - datetime.timedelta(days=3 * 365)).strftime("%Y-%m-%d")
        rows = [Row(ENSTEHDAT=old)]
        result = _apply_enstehdat_filter_years(spark, rows, years=1)
        assert result.count() == 0

    def test_compact_format_recent_row_passes(self, spark: SparkSession):
        """A lot created one month ago in COMPACT format (yyyyMMdd) also passes.

        This covers the replication config variant (Aecorsoft delivers both formats
        depending on the environment). The dual-format predicate must accept either.
        """
        one_month_ago = (datetime.date.today() - datetime.timedelta(days=30)).strftime("%Y%m%d")
        rows = [Row(ENSTEHDAT=one_month_ago)]
        result = _apply_enstehdat_filter_years(spark, rows, years=1)
        assert result.count() == 1

    def test_compact_format_old_row_filtered(self, spark: SparkSession):
        """A lot created 3 years ago in COMPACT format is filtered out."""
        old = (datetime.date.today() - datetime.timedelta(days=3 * 365)).strftime("%Y%m%d")
        rows = [Row(ENSTEHDAT=old)]
        result = _apply_enstehdat_filter_years(spark, rows, years=1)
        assert result.count() == 0

    def test_null_enstehdat_passes(self, spark: SparkSession):
        """NULL ENSTEHDAT rows pass — they reach the @dlt.expect_all_or_drop expectation."""
        rows = [Row(ENSTEHDAT=None)]
        result = _apply_enstehdat_filter_years(spark, rows, years=1)
        assert result.count() == 1

    def test_mixed_formats_both_filtered_correctly(self, spark: SparkSession):
        """Rows in both ISO and compact format are each handled by the correct branch."""
        one_month_ago = datetime.date.today() - datetime.timedelta(days=30)
        three_years_ago = datetime.date.today() - datetime.timedelta(days=3 * 365)
        rows = [
            Row(ENSTEHDAT=one_month_ago.strftime("%Y-%m-%d")),      # ISO, recent   → keep
            Row(ENSTEHDAT=three_years_ago.strftime("%Y-%m-%d")),     # ISO, old      → drop
            Row(ENSTEHDAT=one_month_ago.strftime("%Y%m%d")),         # compact, recent → keep
            Row(ENSTEHDAT=three_years_ago.strftime("%Y%m%d")),       # compact, old  → drop
        ]
        result = _apply_enstehdat_filter_years(spark, rows, years=1)
        assert result.count() == 2

    def test_compact_cutoff_does_not_match_iso_rows(self, spark: SparkSession):
        """Critical regression: compact cutoff must NOT filter ISO rows of the same date.

        The length discriminator separates the two predicates: length==8 applies the
        compact cutoff, length==10 applies the ISO cutoff.  Without the length guard a
        naive single-cutoff implementation would compare the compact literal against ISO
        strings, and '20250612' > '2026-06-12' lexicographically (compact has no '-'),
        silently dropping all ISO-format recent lots.
        """
        # Simulate a lot created six months ago — definitely within a 1-year window.
        six_months_ago_iso = (datetime.date.today() - datetime.timedelta(days=180)).strftime("%Y-%m-%d")
        rows = [Row(ENSTEHDAT=six_months_ago_iso)]
        result = _apply_enstehdat_filter_years(spark, rows, years=1)
        assert result.count() == 1, (
            f"ISO row '{six_months_ago_iso}' was dropped by the 1-year filter — "
            "likely the length discriminator is missing and a compact cutoff was compared "
            "against an ISO string, silently excluding all recent lots."
        )

    def test_five_year_window_default(self, spark: SparkSession):
        """Default qm_lookback_years=5: a lot from 4 years ago passes; 6 years ago is dropped."""
        four_years_ago = (datetime.date.today() - datetime.timedelta(days=4 * 365)).strftime("%Y-%m-%d")
        six_years_ago = (datetime.date.today() - datetime.timedelta(days=6 * 365)).strftime("%Y-%m-%d")
        rows = [
            Row(ENSTEHDAT=four_years_ago),
            Row(ENSTEHDAT=six_years_ago),
        ]
        result = _apply_enstehdat_filter_years(spark, rows, years=5)
        assert result.count() == 1


# ── MANDANT-qualified QAMR join (mirrors quality_lab_inspection_result logic) ─

class TestMandantQualifiedJoin:
    """Guards the client-qualified join pattern (PRUEFLOS + MANDANT) used in quality_lab.py.

    QAMR carries one result row per lot × operation × MIC. In a multi-client Bronze
    (or one that could become multi-client in a future env), PRUEFLOS values can repeat
    across clients. The join must qualify on MANDANT to avoid cross-client row fan-out.
    """

    def _run_join(self, spark, qamr_rows, lot_key_rows):
        """Simulate the inner join from quality_lab_inspection_result."""
        qamr = spark.createDataFrame(
            qamr_rows, "PRUEFLOS STRING, MANDANT STRING, MITTELWERT DOUBLE"
        )
        lot_keys = spark.createDataFrame(
            lot_key_rows,
            "_lot_prueflos STRING, _lot_client STRING, _lot_plant STRING",
        )
        return qamr.join(
            lot_keys,
            (qamr["PRUEFLOS"] == F.col("_lot_prueflos"))
            & (qamr["MANDANT"] == F.col("_lot_client")),
            "inner",
        )

    def test_matching_mandant_keeps_row(self, spark: SparkSession):
        """PRUEFLOS + MANDANT both match → row is kept."""
        qamr_rows = [Row(PRUEFLOS="000001000001", MANDANT="900", MITTELWERT=1.0)]
        lot_keys = [Row(_lot_prueflos="000001000001", _lot_client="900", _lot_plant="C061")]
        result = self._run_join(spark, qamr_rows, lot_keys)
        assert result.count() == 1

    def test_mandant_mismatch_drops_row(self, spark: SparkSession):
        """Same PRUEFLOS, different MANDANT → row is dropped (multi-client safety)."""
        qamr_rows = [Row(PRUEFLOS="000001000001", MANDANT="800", MITTELWERT=1.0)]
        lot_keys = [Row(_lot_prueflos="000001000001", _lot_client="900", _lot_plant="C061")]
        result = self._run_join(spark, qamr_rows, lot_keys)
        assert result.count() == 0

    def test_prueflos_mismatch_drops_row(self, spark: SparkSession):
        """PRUEFLOS does not match → row is dropped."""
        qamr_rows = [Row(PRUEFLOS="000001000002", MANDANT="900", MITTELWERT=1.0)]
        lot_keys = [Row(_lot_prueflos="000001000001", _lot_client="900", _lot_plant="C061")]
        result = self._run_join(spark, qamr_rows, lot_keys)
        assert result.count() == 0

    def test_multiple_mic_rows_per_lot_all_kept(self, spark: SparkSession):
        """Multiple QAMR rows for the same lot (different MITTELWERT / MIC) all join cleanly."""
        qamr_rows = [
            Row(PRUEFLOS="000001000001", MANDANT="900", MITTELWERT=1.0),
            Row(PRUEFLOS="000001000001", MANDANT="900", MITTELWERT=2.0),
            Row(PRUEFLOS="000001000001", MANDANT="900", MITTELWERT=3.0),
        ]
        lot_keys = [Row(_lot_prueflos="000001000001", _lot_client="900", _lot_plant="C061")]
        result = self._run_join(spark, qamr_rows, lot_keys)
        # All 3 result rows match the single lot key — no fan-out because lot_keys is distinct.
        assert result.count() == 3
