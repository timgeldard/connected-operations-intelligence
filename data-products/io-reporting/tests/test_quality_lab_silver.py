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
"""

import datetime

from pyspark.sql import Row, SparkSession
from pyspark.sql import functions as F

# ── ENSTEHDAT dual-format predicate (mirrors _gated_qals_for_lab) ────────────

def _apply_enstehdat_filter(spark: SparkSession, rows, days: int):
    """Apply the quality_lab.py dual-format ENSTEHDAT predicate to an in-memory DataFrame.

    Mirrors the logic in _gated_qals_for_lab exactly — length discriminator +
    dual-format OR predicate.  Determinism-exempt: rolling window evaluated at call time.
    """
    df = spark.createDataFrame(rows, "ENSTEHDAT STRING")
    base_date = F.date_sub(F.current_date(), days)
    cutoff_compact = F.date_format(base_date, "yyyyMMdd")
    cutoff_iso = F.date_format(base_date, "yyyy-MM-dd")
    keep = (
        F.col("ENSTEHDAT").isNull()
        | ((F.length(F.trim(F.col("ENSTEHDAT"))) == 8) & (F.col("ENSTEHDAT") >= cutoff_compact))
        | ((F.length(F.trim(F.col("ENSTEHDAT"))) == 10) & (F.col("ENSTEHDAT") >= cutoff_iso))
    )
    return df.filter(keep)


class TestEnstehdatFilter:
    """Guards the dual-format ENSTEHDAT predicate against both format variants."""

    def test_iso_format_recent_row_passes(self, spark: SparkSession):
        """A lot created yesterday (ISO format) is within the 30-day window."""
        yesterday = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        rows = [Row(ENSTEHDAT=yesterday)]
        result = _apply_enstehdat_filter(spark, rows, days=30)
        assert result.count() == 1

    def test_iso_format_old_row_filtered(self, spark: SparkSession):
        """A lot created 60 days ago (ISO format) falls outside the 30-day window."""
        old = (datetime.date.today() - datetime.timedelta(days=60)).strftime("%Y-%m-%d")
        rows = [Row(ENSTEHDAT=old)]
        result = _apply_enstehdat_filter(spark, rows, days=30)
        assert result.count() == 0

    def test_compact_format_recent_row_passes(self, spark: SparkSession):
        """A lot created yesterday in COMPACT format (yyyyMMdd) also passes.

        This covers the replication config variant (Aecorsoft delivers both formats
        depending on the environment). The dual-format predicate must accept either.
        """
        yesterday = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y%m%d")
        rows = [Row(ENSTEHDAT=yesterday)]
        result = _apply_enstehdat_filter(spark, rows, days=30)
        assert result.count() == 1

    def test_compact_format_old_row_filtered(self, spark: SparkSession):
        """A lot created 60 days ago in COMPACT format is filtered out."""
        old = (datetime.date.today() - datetime.timedelta(days=60)).strftime("%Y%m%d")
        rows = [Row(ENSTEHDAT=old)]
        result = _apply_enstehdat_filter(spark, rows, days=30)
        assert result.count() == 0

    def test_null_enstehdat_passes(self, spark: SparkSession):
        """NULL ENSTEHDAT rows pass — they reach the @dlt.expect_all_or_drop expectation."""
        rows = [Row(ENSTEHDAT=None)]
        result = _apply_enstehdat_filter(spark, rows, days=30)
        assert result.count() == 1

    def test_mixed_formats_both_filtered_correctly(self, spark: SparkSession):
        """Rows in both ISO and compact format are each handled by the correct branch."""
        yesterday = datetime.date.today() - datetime.timedelta(days=1)
        old = datetime.date.today() - datetime.timedelta(days=60)
        rows = [
            Row(ENSTEHDAT=yesterday.strftime("%Y-%m-%d")),   # ISO, recent   → keep
            Row(ENSTEHDAT=old.strftime("%Y-%m-%d")),          # ISO, old      → drop
            Row(ENSTEHDAT=yesterday.strftime("%Y%m%d")),      # compact, recent → keep
            Row(ENSTEHDAT=old.strftime("%Y%m%d")),            # compact, old  → drop
        ]
        result = _apply_enstehdat_filter(spark, rows, days=30)
        assert result.count() == 2

    def test_compact_cutoff_does_not_match_iso_rows(self, spark: SparkSession):
        """Critical regression: compact cutoff '20260512' must NOT filter ISO rows '2026-06-12'.

        The length discriminator separates the two predicates: length==8 applies the
        compact cutoff, length==10 applies the ISO cutoff.  Without the length guard a
        naive single-cutoff implementation would use the compact literal against ISO
        strings, and '20260512' > '2026-06-12' lexicographically, silently dropping all
        ISO-format recent lots.
        """
        # Simulate a row created one week ago — definitely in a 30-day window.
        one_week_ago_iso = (datetime.date.today() - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
        rows = [Row(ENSTEHDAT=one_week_ago_iso)]
        # 30-day window: this row should pass.
        result = _apply_enstehdat_filter(spark, rows, days=30)
        assert result.count() == 1, (
            f"ISO row '{one_week_ago_iso}' was dropped by the 30-day filter — "
            "likely the length discriminator is missing and a compact cutoff was compared "
            "against an ISO string, silently excluding all recent lots."
        )


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
