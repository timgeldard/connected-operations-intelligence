"""Tests for check_warehouse360_consumption_columns (the consumption-view ↔ Gold column guard)."""

import check_warehouse360_consumption_columns as g


def test_split_top_level_respects_parens():
    items = g._split_top_level("a, CAST(x AS DECIMAL(5,2)) AS b, c")
    assert [i.strip() for i in items] == ["a", "CAST(x AS DECIMAL(5,2)) AS b", "c"]


def test_expr_of_strips_only_top_level_as():
    # inner AS (inside CAST) must be preserved; trailing alias removed
    assert g._expr_of("CAST(snapshot_date AS TIMESTAMP) AS snapshot_ts").strip() == \
        "CAST(snapshot_date AS TIMESTAMP)"
    assert g._expr_of("plant_code AS plant_id").strip() == "plant_code"
    assert g._expr_of("delivery_type").strip() == "delivery_type"


def test_source_columns_excludes_keywords_and_literals():
    assert g._source_columns("CAST(NULL AS LONG)") == set()
    assert g._source_columns("days_to_start * 1440") == {"days_to_start"}
    assert g._source_columns("CAST(bin_utilisation_pct AS DECIMAL(5,2))") == {"bin_utilisation_pct"}


def test_repo_consumption_views_resolve():
    # The committed consumption SQL + contract must be internally consistent (every source column
    # resolves against the Gold snapshot or is a documented exception).
    assert g.check() == []


def test_detects_unaccounted_column(tmp_path, monkeypatch):
    contract = tmp_path / "contract.yml"
    contract.write_text(
        "gold_source_columns:\n"
        "  gold_src_v: [plant_code, real_col]\n"
        "approved_aliases: {}\n"
        "approved_exceptions:\n"
        "  vw_consumption_warehouse360_overview: {}\n",
        encoding="utf-8",
    )
    sqlf = tmp_path / "warehouse360_consumption_views_dev.sql"
    sqlf.write_text(
        "CREATE OR REPLACE VIEW cat.sch.vw_consumption_warehouse360_overview AS\n"
        "SELECT plant_code AS plant_id, bogus_missing_col, real_col\n"
        "FROM cat.sch.gold_src_v;\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(g, "CONTRACT", str(contract))
    monkeypatch.setattr(g, "SQL_FILES", [str(sqlf)])
    errs = g.check()
    assert any("bogus_missing_col" in e for e in errs), errs
    assert not any("real_col" in e for e in errs), "real_col is present in Gold and must resolve"


def test_exception_suppresses_error(tmp_path, monkeypatch):
    contract = tmp_path / "contract.yml"
    contract.write_text(
        "gold_source_columns:\n"
        "  gold_src_v: [plant_code]\n"
        "approved_aliases: {}\n"
        "approved_exceptions:\n"
        "  vw_consumption_warehouse360_overview:\n"
        "    documented_missing: missing\n",
        encoding="utf-8",
    )
    sqlf = tmp_path / "warehouse360_consumption_views_dev.sql"
    sqlf.write_text(
        "CREATE OR REPLACE VIEW cat.sch.vw_consumption_warehouse360_overview AS\n"
        "SELECT plant_code AS plant_id, documented_missing\n"
        "FROM cat.sch.gold_src_v;\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(g, "CONTRACT", str(contract))
    monkeypatch.setattr(g, "SQL_FILES", [str(sqlf)])
    assert g.check() == []


if __name__ == "__main__":
    import sys

    import pytest
    sys.exit(pytest.main([__file__, "-q"]))
