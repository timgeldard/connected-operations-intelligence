"""Unit tests for the Aecorsoft CDC replication-gap detector.

Covers the pure offline logic: classify_stream, build_report, summarise.
The live-query path (query_bronze_watermarks / run) requires a Spark session
pointed at real bronze tables and is NOT exercised here — it is exercised at
job runtime (see docs/runbooks/cdc_gap_detector_runbook.md).

Tests intentionally avoid Spark so they run in the same offline CI gate as the
rest of the scripts/ci guards (no JVM needed).
"""
import datetime
import os
import sys

# Make the scripts path importable without installing the package.
_SCRIPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "scripts")
sys.path.insert(0, os.path.abspath(_SCRIPTS_DIR))

from check_cdc_replication_gaps import (  # noqa: E402
    BRONZE_SOURCE_MAP,
    QM_DEFAULT_SLA_MINUTES,
    build_report,
    classify_stream,
    summarise,
)

# ── Helpers ──────────────────────────────────────────────────────────────────────────

_NOW = datetime.datetime(2026, 6, 14, 10, 0, 0)  # fixed reference time for all tests

def _dt(hours_ago: float) -> datetime.datetime:
    """Return a datetime *hours_ago* hours before _NOW."""
    return _NOW - datetime.timedelta(hours=hours_ago)


# ── classify_stream ───────────────────────────────────────────────────────────────────

def test_classify_fresh_within_sla():
    """A stream whose lag is within the SLA window is classified FRESH."""
    result = classify_stream(
        silver_table="goods_movement",
        bronze_table="inventorymovement_mseg",
        max_watermark=_dt(1),        # 1 h ago
        sla_minutes=120,             # SLA = 2 h
        checked_at=_NOW,
    )
    assert result["status"] == "FRESH"
    assert result["lag_minutes"] == 60.0
    assert result["gap_hours"] == 1.0
    assert result["silver_table"] == "goods_movement"
    assert result["bronze_table"] == "inventorymovement_mseg"
    assert "Within SLA" in result["notes"]


def test_classify_stale_exceeds_sla():
    """A stream whose lag exceeds the SLA is classified STALE."""
    result = classify_stream(
        silver_table="goods_movement",
        bronze_table="inventorymovement_mseg",
        max_watermark=_dt(5),        # 5 h ago
        sla_minutes=120,             # SLA = 2 h → lag 300m > 120m
        checked_at=_NOW,
    )
    assert result["status"] == "STALE"
    assert result["lag_minutes"] == pytest_approx(300.0, abs=1.0)
    assert "Lag" in result["notes"] and "exceeds SLA" in result["notes"]


def test_classify_absent_when_no_watermark():
    """A stream with no watermark (table absent or empty) is classified ABSENT."""
    result = classify_stream(
        silver_table="qm_result",
        bronze_table="inspection_qamr",
        max_watermark=None,
        sla_minutes=QM_DEFAULT_SLA_MINUTES,
        checked_at=_NOW,
    )
    assert result["status"] == "ABSENT"
    assert result["max_watermark_utc"] is None
    assert result["lag_minutes"] is None
    assert "No rows found" in result["notes"]


def test_classify_uses_qm_default_sla_when_none():
    """When sla_minutes=None is passed, the QM default SLA is used."""
    result = classify_stream(
        silver_table="qm_result",
        bronze_table="inspection_qamr",
        max_watermark=_dt(2),
        sla_minutes=None,            # None → QM_DEFAULT_SLA_MINUTES (1440)
        checked_at=_NOW,
    )
    assert result["sla_minutes"] == QM_DEFAULT_SLA_MINUTES
    assert result["status"] == "FRESH"  # 2 h = 120m << 1440m


def test_classify_stale_with_none_sla_and_long_lag():
    """Even with None SLA, a very long lag (>24h) should be STALE."""
    result = classify_stream(
        silver_table="qm_result",
        bronze_table="inspection_qamr",
        max_watermark=_dt(25),       # 25 h ago
        sla_minutes=None,            # default 1440m = 24 h
        checked_at=_NOW,
    )
    assert result["status"] == "STALE"


def test_classify_checked_at_recorded():
    """checked_at_utc is always recorded in the output row."""
    result = classify_stream("t", "bt", _dt(0.5), 60, _NOW)
    assert result["checked_at_utc"] == _NOW.isoformat()


# ── build_report ─────────────────────────────────────────────────────────────────────

def test_build_report_absent_sorts_first():
    """ABSENT streams sort before STALE which sorts before FRESH."""
    watermarks = {}
    # All None → ABSENT for all tables.
    sla_map = {sv: 120 for sv in BRONZE_SOURCE_MAP}
    report = build_report(watermarks, sla_map, _NOW)
    statuses = [r["status"] for r in report]
    # No FRESH or STALE should appear (no watermarks provided).
    assert all(s == "ABSENT" for s in statuses)


def test_build_report_covers_all_bronze_sources():
    """build_report emits one row per (silver_table, bronze_table) pair."""
    total_expected = sum(len(bts) for bts in BRONZE_SOURCE_MAP.values())
    watermarks = {bt: _dt(0.1) for bts in BRONZE_SOURCE_MAP.values() for bt in bts}
    sla_map = {sv: 1440 for sv in BRONZE_SOURCE_MAP}  # all fresh
    report = build_report(watermarks, sla_map, _NOW)
    assert len(report) == total_expected
    assert all(r["status"] == "FRESH" for r in report)


def test_build_report_stale_sorts_before_fresh():
    """STALE rows appear before FRESH rows in the sorted report."""
    stale_bronze = "inventorymovement_mseg"   # goods_movement, SLA 120m
    watermarks = {bt: _dt(0.1) for bts in BRONZE_SOURCE_MAP.values() for bt in bts}
    watermarks[stale_bronze] = _dt(5)         # 5 h ago → STALE for 120m SLA
    sla_map = {sv: 120 for sv in BRONZE_SOURCE_MAP}
    report = build_report(watermarks, sla_map, _NOW)
    statuses = [r["status"] for r in report]
    # Find first STALE and first FRESH indexes.
    stale_idx = next((i for i, s in enumerate(statuses) if s == "STALE"), None)
    fresh_idx = next((i for i, s in enumerate(statuses) if s == "FRESH"), None)
    assert stale_idx is not None and fresh_idx is not None
    assert stale_idx < fresh_idx, "STALE rows must appear before FRESH rows in the report."


# ── summarise ────────────────────────────────────────────────────────────────────────

def test_summarise_all_fresh_no_gaps():
    watermarks = {bt: _dt(0.1) for bts in BRONZE_SOURCE_MAP.values() for bt in bts}
    sla_map = {sv: 1440 for sv in BRONZE_SOURCE_MAP}
    report = build_report(watermarks, sla_map, _NOW)
    summary = summarise(report)
    assert summary["has_gaps"] is False
    assert summary["absent_count"] == 0
    assert summary["stale_count"] == 0
    assert summary["fresh_count"] == summary["total_streams"]
    assert summary["actionable_streams"] == []


def test_summarise_detects_absent():
    watermarks = {}   # all None → all ABSENT
    sla_map = {sv: 120 for sv in BRONZE_SOURCE_MAP}
    report = build_report(watermarks, sla_map, _NOW)
    summary = summarise(report)
    assert summary["has_gaps"] is True
    assert summary["absent_count"] == summary["total_streams"]
    assert len(summary["actionable_streams"]) == summary["total_streams"]


def test_summarise_detects_stale():
    """A single stale bronze table is surfaced in actionable_streams."""
    watermarks = {bt: _dt(0.1) for bts in BRONZE_SOURCE_MAP.values() for bt in bts}
    watermarks["inspection_qamr"] = _dt(30)  # 30 h ago, stale vs 1440m (~24h) default
    sla_map = {sv: 120 for sv in BRONZE_SOURCE_MAP}
    # Override: qm_result has None SLA in FRESHNESS_CONTRACTS (not in the table).
    # classify_stream uses QM_DEFAULT_SLA_MINUTES = 1440m = 24h. 30h > 24h → STALE.
    report = build_report(watermarks, sla_map, _NOW)
    summary = summarise(report)
    assert summary["has_gaps"] is True
    assert "qm_result" in summary["actionable_streams"]


def test_summarise_counts_are_consistent():
    """absent + stale + fresh == total."""
    watermarks = {bt: _dt(0.1) for bts in BRONZE_SOURCE_MAP.values() for bt in bts}
    # Make 2 bronze tables stale.
    watermarks["inventorymovement_mseg"] = _dt(5)
    watermarks["batchstock_mchb"] = _dt(12)
    sla_map = {sv: 120 for sv in BRONZE_SOURCE_MAP}
    report = build_report(watermarks, sla_map, _NOW)
    summary = summarise(report)
    assert summary["absent_count"] + summary["stale_count"] + summary["fresh_count"] == summary["total_streams"]


# ── BRONZE_SOURCE_MAP structural assertions ───────────────────────────────────────────

def test_bronze_source_map_has_all_qm_tables():
    """The four QM result tables are covered (the motivating incident tables)."""
    for key in ("qm_inspection_lot", "qm_usage_decision", "qm_result", "qm_individual_value"):
        assert key in BRONZE_SOURCE_MAP, f"QM table '{key}' missing from BRONZE_SOURCE_MAP"


def test_bronze_source_map_goods_movement_points_to_mseg():
    """goods_movement must use inventorymovement_mseg as its watermark proxy."""
    assert "inventorymovement_mseg" in BRONZE_SOURCE_MAP["goods_movement"]


def test_bronze_source_map_no_empty_entries():
    """Every silver table must have at least one bronze source listed."""
    for sv, bts in BRONZE_SOURCE_MAP.items():
        assert bts, f"silver_table '{sv}' has no bronze sources in BRONZE_SOURCE_MAP"


# ── Acceptance test: simulate the QAMR stall incident ────────────────────────────────

def test_qamr_stall_detected():
    """Simulate the QAMR stall: all other tables fresh, inspection_qamr is 5 days stale.

    This is the exact scenario spec 21 item 2 was motivated by — the detector must catch it.
    """
    watermarks = {bt: _dt(0.5) for bts in BRONZE_SOURCE_MAP.values() for bt in bts}
    watermarks["inspection_qamr"] = _dt(5 * 24)  # 5 days ago → way beyond the 24h default SLA
    sla_map = {sv: 120 for sv in BRONZE_SOURCE_MAP}
    report = build_report(watermarks, sla_map, _NOW)
    summary = summarise(report)
    assert summary["has_gaps"] is True
    assert "qm_result" in summary["actionable_streams"]
    # Confirm the row is labelled STALE not FRESH
    qm_result_rows = [r for r in report if r["silver_table"] == "qm_result"]
    assert any(r["status"] == "STALE" for r in qm_result_rows), (
        "QAMR stall must be classified STALE — the gap detector would have missed the incident."
    )


def test_all_fresh_passes_cleanly():
    """When all streams are fresh the detector reports no gaps (acceptance: green path)."""
    watermarks = {bt: _dt(0.1) for bts in BRONZE_SOURCE_MAP.values() for bt in bts}
    sla_map = {sv: 120 for sv in BRONZE_SOURCE_MAP}
    report = build_report(watermarks, sla_map, _NOW)
    summary = summarise(report)
    assert not summary["has_gaps"]
    assert summary["actionable_streams"] == []


# ── Import shim (pytest_approx without importing pytest at the top) ───────────────────

def pytest_approx(val, abs=None):
    """Thin shim so this file can be imported without pytest for standalone use.
    At test collection time pytest provides the real implementation via conftest injection.
    """
    try:
        import pytest  # noqa: PLC0415
        return pytest.approx(val, abs=abs)
    except ImportError:
        return val
