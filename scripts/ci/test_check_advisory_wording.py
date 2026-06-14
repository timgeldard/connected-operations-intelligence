"""Unit tests for check_advisory_wording.py."""
from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from scripts.ci.check_advisory_wording import (
    PROHIBITED_PATTERNS,
    find_consumption_sql_files,
    run,
    scan_file,
)


def _write_sql(tmp_path: Path, name: str, content: str) -> Path:
    p = tmp_path / name
    p.write_text(textwrap.dedent(content), encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# Pattern-level tests
# ---------------------------------------------------------------------------

def test_release_word_flagged(tmp_path):
    f = _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        CREATE OR REPLACE VIEW v AS
        SELECT 'Release the hold' AS action FROM src;
    """)
    findings = scan_file(f)
    assert any("Release" in w for w in findings)


def test_release_column_name_allowed(tmp_path):
    f = _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        CREATE OR REPLACE VIEW v AS
        SELECT release_date, quality_release_status FROM src;
    """)
    findings = scan_file(f)
    assert not any("Release" in w for w in findings)


def test_approve_flagged(tmp_path):
    f = _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        SELECT 'Approve' AS action FROM src;
    """)
    findings = scan_file(f)
    assert any("Approve" in w for w in findings)


def test_confirm_to_flagged(tmp_path):
    f = _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        SELECT 'Confirm TO 123' AS notes FROM src;
    """)
    findings = scan_file(f)
    assert any("Confirm TO" in w for w in findings)


def test_confirm_batch_flagged(tmp_path):
    f = _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        SELECT 'Confirm batch B001' AS label FROM src;
    """)
    findings = scan_file(f)
    assert any("Confirm batch" in w for w in findings)


def test_reschedule_flagged(tmp_path):
    f = _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        SELECT 'Reschedule order' AS suggestion FROM src;
    """)
    findings = scan_file(f)
    assert any("Reschedule" in w for w in findings)


def test_cleared_flagged(tmp_path):
    f = _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        SELECT 'Cleared' AS status FROM src;
    """)
    findings = scan_file(f)
    assert any("Cleared" in w for w in findings)


def test_safe_to_ship_flagged(tmp_path):
    f = _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        SELECT 'Safe to ship' AS advisory FROM src;
    """)
    findings = scan_file(f)
    assert any("Safe to ship" in w for w in findings)


def test_comment_line_skipped(tmp_path):
    f = _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        -- This view does NOT Release or Approve anything.
        SELECT order_id FROM src;
    """)
    findings = scan_file(f)
    assert len(findings) == 0


def test_clean_file_no_findings(tmp_path):
    f = _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        CREATE OR REPLACE VIEW v AS
        SELECT plant_code, risk_domain, base_severity,
               quality_release_status, has_usage_decision
        FROM gold_operational_risk_item;
    """)
    findings = scan_file(f)
    assert findings == []


# ---------------------------------------------------------------------------
# File discovery tests
# ---------------------------------------------------------------------------

def test_find_consumption_sql_files(tmp_path):
    (tmp_path / "op_risk_consumption_dev.sql").write_text("SELECT 1", encoding="utf-8")
    (tmp_path / "gold_security_dev.sql").write_text("SELECT 2", encoding="utf-8")
    (tmp_path / "some_other.sql").write_text("SELECT 3", encoding="utf-8")
    result = find_consumption_sql_files(tmp_path)
    names = [f.name for f in result]
    assert "op_risk_consumption_dev.sql" in names
    assert "gold_security_dev.sql" not in names
    assert "some_other.sql" not in names


def test_find_consumption_sql_files_empty_dir(tmp_path):
    result = find_consumption_sql_files(tmp_path)
    assert result == []


def test_find_consumption_sql_files_nonexistent(tmp_path):
    result = find_consumption_sql_files(tmp_path / "nonexistent")
    assert result == []


# ---------------------------------------------------------------------------
# run() integration tests
# ---------------------------------------------------------------------------

def test_run_clean_exit_0(tmp_path):
    _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        SELECT plant_code, base_severity FROM src;
    """)
    assert run(strict=False, sql_dir=tmp_path) == 0


def test_run_findings_report_only_exit_0(tmp_path):
    _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        SELECT 'Release hold' AS action FROM src;
    """)
    assert run(strict=False, sql_dir=tmp_path) == 0


def test_run_findings_strict_exit_1(tmp_path):
    _write_sql(tmp_path, "op_risk_consumption_dev.sql", """\
        SELECT 'Release hold' AS action FROM src;
    """)
    assert run(strict=True, sql_dir=tmp_path) == 1


def test_run_no_files_exit_0(tmp_path):
    assert run(strict=True, sql_dir=tmp_path) == 0
