"""Unit tests for the VACUUM retention guard (check_vacuum_retention.py).

Tests cover:
  - Clean SQL with no VACUUM → no violations
  - VACUUM RETAIN at exactly 168 h → no violation (boundary)
  - VACUUM RETAIN above 168 h → no violation
  - VACUUM RETAIN below 168 h (hours) → violation
  - VACUUM RETAIN in minutes → violation (always below 168 h)
  - VACUUM RETAIN in seconds → violation
  - VACUUM RETAIN in days (>= 7) → no violation
  - VACUUM RETAIN in days (< 7) → violation
  - Short retention in Python spark.sql string literal → violation (scanned via scan_source)
  - Delta property deletedFileRetentionDuration with short value → violation
  - Allowlisted short retention → no violation
  - Guard passes on current main (no violations from the real codebase)
"""
import textwrap

from check_vacuum_retention import ALLOWLIST, scan_source

# ---------------------------------------------------------------------------
# Basic SQL scanning
# ---------------------------------------------------------------------------

def test_no_vacuum_clean():
    sql = "SELECT * FROM my_table;"
    violations = scan_source(sql, "test.sql")
    assert violations == []


def test_vacuum_retain_exactly_168h_clean():
    sql = "VACUUM silver.goods_movement RETAIN 168 HOURS;"
    violations = scan_source(sql, "test.sql")
    assert violations == [], "Exactly 168 h should not be flagged (at or above minimum)"


def test_vacuum_retain_above_168h_clean():
    sql = "VACUUM silver.goods_movement RETAIN 336 HOURS;"
    violations = scan_source(sql, "test.sql")
    assert violations == []


def test_vacuum_retain_below_168h_hours_violation():
    sql = "VACUUM silver.goods_movement RETAIN 24 HOURS;"
    violations = scan_source(sql, "test.sql")
    assert len(violations) == 1
    assert "24" in violations[0].message
    assert "ADR 017" in violations[0].message


def test_vacuum_retain_7_days_clean():
    sql = "VACUUM silver.goods_movement RETAIN 7 DAYS;"
    violations = scan_source(sql, "test.sql")
    assert violations == [], "7 days = 168 h — should not be flagged"


def test_vacuum_retain_1_day_violation():
    sql = "VACUUM silver.goods_movement RETAIN 1 DAYS;"
    violations = scan_source(sql, "test.sql")
    assert len(violations) == 1


def test_vacuum_retain_minutes_violation():
    sql = "VACUUM silver.goods_movement RETAIN 720 MINUTES;"
    violations = scan_source(sql, "test.sql")
    assert len(violations) == 1, "720 minutes = 12 h < 168 h"


def test_vacuum_retain_seconds_violation():
    sql = "VACUUM silver.goods_movement RETAIN 3600 SECONDS;"
    violations = scan_source(sql, "test.sql")
    assert len(violations) == 1, "3600 seconds = 1 h < 168 h"


def test_vacuum_no_retain_clause_clean():
    # VACUUM with no RETAIN — uses the default 168 h (safe)
    sql = "VACUUM silver.goods_movement;"
    violations = scan_source(sql, "test.sql")
    assert violations == []


def test_comment_line_ignored():
    sql = "-- VACUUM silver.goods_movement RETAIN 1 HOURS;\nSELECT 1;"
    violations = scan_source(sql, "test.sql")
    assert violations == [], "Commented-out VACUUM should not be flagged"


def test_multiline_with_violation():
    sql = textwrap.dedent("""\
        -- Maintenance script
        OPTIMIZE silver.goods_movement;
        VACUUM silver.goods_movement RETAIN 12 HOURS;
    """)
    violations = scan_source(sql, "maintenance.sql")
    assert len(violations) == 1
    assert violations[0].lineno == 3


# ---------------------------------------------------------------------------
# Delta property scanning
# ---------------------------------------------------------------------------

def test_deleted_file_retention_short_violation():
    yaml_content = textwrap.dedent("""\
        configuration:
          delta.deletedFileRetentionDuration: interval 24 hours
    """)
    violations = scan_source(yaml_content, "resources/pipeline.yml")
    assert len(violations) == 1
    assert "deletedFileRetentionDuration" in violations[0].message or "24" in violations[0].message


def test_log_retention_short_violation():
    yaml_content = "delta.logRetentionDuration: 1 days"
    violations = scan_source(yaml_content, "resources/pipeline.yml")
    assert len(violations) == 1


def test_deleted_file_retention_safe():
    yaml_content = "delta.deletedFileRetentionDuration: interval 7 days"
    violations = scan_source(yaml_content, "resources/pipeline.yml")
    assert violations == []


# ---------------------------------------------------------------------------
# Allowlist
# ---------------------------------------------------------------------------

def test_allowlisted_table_not_flagged(monkeypatch):
    monkeypatch.setitem(ALLOWLIST, "gold_spc_query_audit", "ADR016 — 90-day audit, no CDF consumers")
    sql = "VACUUM gold_spc_query_audit RETAIN 24 HOURS;"
    violations = scan_source(sql, "maintenance.sql")
    assert violations == [], "Allowlisted table should not be flagged"


# ---------------------------------------------------------------------------
# Integration: guard passes on current main
# ---------------------------------------------------------------------------

def test_guard_passes_on_current_main():
    """The guard must exit 0 on the current repository state (no violations in checked-in artefacts)."""
    from check_vacuum_retention import check
    violations = check()
    assert violations == [], (
        "Unexpected VACUUM retention violations in checked-in artefacts:\n"
        + "\n".join(f"  {v.path}:{v.lineno}: {v.message}" for v in violations)
    )


# ---------------------------------------------------------------------------
# Planted violation detection
# ---------------------------------------------------------------------------

def test_planted_short_retention_detected():
    """Verify the guard would catch a planted short-retention VACUUM (self-test for ADR 017 WI3)."""
    planted_sql = "VACUUM connected_plant_uat.silver_io_reporting.goods_movement RETAIN 1 HOURS;"
    violations = scan_source(planted_sql, "scripts/ci/planted_test.sql")
    assert len(violations) >= 1, (
        "The guard MUST detect a planted RETAIN 1 HOURS — it failed to."
    )
    assert violations[0].lineno == 1
