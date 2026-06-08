"""Unit tests for check_gold_serving_sql_ownership.py."""

import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from check_gold_serving_sql_ownership import check_secured_view_statement, run_checks


def test_check_secured_view_statement_simple_passthrough():
    stmt = "CREATE OR REPLACE VIEW catalog.schema.my_view_secured AS SELECT * FROM catalog.schema.my_view;"
    assert check_secured_view_statement(stmt) is None


def test_check_secured_view_statement_with_where_exists():
    stmt = """
    CREATE VIEW my_view_secured AS
      SELECT * FROM my_view
      WHERE EXISTS (
        SELECT 1 FROM security_table
        WHERE current_user() = email
      );
    """
    assert check_secured_view_statement(stmt) is None


def test_check_secured_view_statement_curated_list_fails():
    stmt = "CREATE VIEW my_view_secured AS SELECT col1, col2 FROM my_view;"
    err = check_secured_view_statement(stmt)
    assert err is not None
    assert "not a pass-through SELECT *" in err


def test_check_secured_view_statement_invalid_logic_fails():
    stmt = "CREATE VIEW my_view_secured AS SELECT * FROM my_view JOIN other_table ON a = b;"
    err = check_secured_view_statement(stmt)
    assert err is not None
    assert "has invalid logic/remainder" in err


def test_run_checks_secured_with_current_date_fails(tmp_path):
    from unittest.mock import patch

    # Create mock sql dir
    sql_dir = tmp_path / "sql"
    sql_dir.mkdir()

    # Create mock secured views file with current_date
    sec_file = sql_dir / "gold_security_dev.sql"
    sec_file.write_text("""
    CREATE OR REPLACE VIEW my_view_secured AS
      SELECT * FROM my_view WHERE date_col > current_date();
    """, encoding="utf-8")

    with patch("check_gold_serving_sql_ownership.SQL_DIR", str(sql_dir)):
        errors = run_checks()
        assert any("Violation: Contains forbidden pattern 'current_date'" in e for e in errors)


def test_run_checks_commented_forbidden_pattern_passes(tmp_path):
    from unittest.mock import patch

    sql_dir = tmp_path / "sql"
    sql_dir.mkdir()

    # Create mock secured views file with forbidden word and semicolons in comments only
    sec_file = sql_dir / "gold_security_dev.sql"
    sec_file.write_text("""
    -- This view does not use current_date() or datediff;
    /*
    Some explanation;
    CREATE VIEW my_view AS SELECT a;
    min_days_to_expiry is also not used here
    */
    CREATE OR REPLACE VIEW my_view_secured AS
      SELECT * FROM my_view;
    """, encoding="utf-8")

    with patch("check_gold_serving_sql_ownership.SQL_DIR", str(sql_dir)):
        errors = run_checks()
        assert len(errors) == 0


def test_run_checks_ignores_other_secured_files(tmp_path):
    from unittest.mock import patch

    sql_dir = tmp_path / "sql"
    sql_dir.mkdir()

    # File not in the whitelist should be ignored even if it violates rules
    sec_file = sql_dir / "gold_security_other.sql"
    sec_file.write_text("""
    CREATE OR REPLACE VIEW my_view_secured AS
      SELECT * FROM my_view WHERE date_col > current_date();
    """, encoding="utf-8")

    with patch("check_gold_serving_sql_ownership.SQL_DIR", str(sql_dir)):
        errors = run_checks()
        assert len(errors) == 0


def test_run_checks_consumption_with_current_date_fails(tmp_path):
    from unittest.mock import patch

    sql_dir = tmp_path / "sql"
    sql_dir.mkdir()

    # Create mock consumption views file with current_date
    con_file = sql_dir / "warehouse360_consumption_views_dev.sql"
    con_file.write_text("""
    CREATE OR REPLACE VIEW my_view AS
      SELECT plant_id, datediff(current_date(), some_date) AS days FROM base;
    """, encoding="utf-8")

    with patch("check_gold_serving_sql_ownership.SQL_DIR", str(sql_dir)):
        errors = run_checks()
        assert any("Violation: Re-calculates date-relative fields using 'current_date()'" in e for e in errors)


def test_run_checks_consumption_selecting_existing_passes(tmp_path):
    from unittest.mock import patch

    sql_dir = tmp_path / "sql"
    sql_dir.mkdir()

    # Consumption view selecting a column containing date logic from a live view
    con_file = sql_dir / "warehouse360_consumption_views_dev.sql"
    con_file.write_text("""
    CREATE OR REPLACE VIEW my_view AS
      SELECT plant_id, risk_band AS risk FROM base_live;
    """, encoding="utf-8")

    # Secure view that is pass-through
    sec_file = sql_dir / "gold_security_dev.sql"
    sec_file.write_text("""
    CREATE OR REPLACE VIEW my_view_secured AS
      SELECT * FROM base;
    """, encoding="utf-8")

    with patch("check_gold_serving_sql_ownership.SQL_DIR", str(sql_dir)):
        errors = run_checks()
        assert len(errors) == 0
