"""Tests for the repository boundary scanner.

Proves the scanner catches forbidden hard-coded data access and leaves the sanctioned
resolver path, approved consumption views, documentation prose, and test files alone.
Snippets are fed directly to ``scan_text`` — the tests do not walk the repo.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from check_forbidden_data_access import (  # noqa: E402
    is_test_path,
    scan_text,
    should_ignore,
)

# --- Known-bad: must be caught -------------------------------------------------

def test_catches_schema_qualified_gold():
    assert scan_text("sql = 'SELECT * FROM connected_plant_uat.gold.foo'")


def test_catches_schema_qualified_bronze_and_silver():
    assert scan_text("a = 'x.bronze.t'")
    assert scan_text("b = 'y.silver.t'")


def test_catches_schema_qualified_sap():
    assert scan_text("s = 'x.sap.mara'")


def test_catches_from_gold_prefix():
    assert scan_text("q = 'FROM gold_batch_lineage l'")


def test_catches_named_sap_table_in_from_clause():
    assert scan_text("SELECT * FROM MSEG")
    assert scan_text("inner join AFKO on x = y")  # JOIN keyword case-insensitive


def test_catches_hardcoded_gold_even_inside_python_assignment():
    # Hard-coded SQL is an assignment, not a docstring — must survive prose stripping.
    src = 'def q():\n    sql = "SELECT * FROM connected_plant_uat.gold.foo"\n    return sql\n'
    assert scan_text(src, is_python=True)


# --- Known-good: must stay clean ----------------------------------------------

def test_allows_resolver_path():
    src = 'view = resolve_domain_object("trace2", "gold_batch_lineage")'
    assert scan_text(src, is_python=True) == []


def test_allows_approved_consumption_view():
    assert scan_text("view = 'vw_consumption_warehouse360_overview'") == []
    assert scan_text("view = 'vw_genie_stock_health'") == []


def test_ignores_python_docstring_prose():
    src = (
        '"""Counts come from gold_batch_lineage; verified connected_plant_uat.gold.x."""\n'
        "value = 1\n"
    )
    assert scan_text(src, is_python=True) == []


def test_ignores_bare_string_expression_prose():
    src = 'def f():\n    "Sourced from gold_batch_stock_v and connected_plant_uat.gold.y"\n    return 1\n'
    assert scan_text(src, is_python=True) == []


def test_sap_table_match_is_case_sensitive():
    # Lowercase 'jest'/'mara' in prose-like text must not trigger the SAP rule.
    assert scan_text("we run this in jest") == []
    assert scan_text("query = 'select * from mara_local_helper'") == []


def test_named_sap_table_not_triggered_as_substring():
    # MARA must not match inside a longer identifier.
    assert scan_text("SELECT * FROM MARABOU_STORE") == []


# --- File-level exclusions -----------------------------------------------------

def test_markdown_is_ignored():
    assert should_ignore("domain-integrations/spc/docs/spc-v2-contract-mapping.md")


def test_test_files_are_ignored():
    assert is_test_path("apps/api/tests/adapters/trace2/test_trace2_databricks_adapter.py")
    assert is_test_path("apps\\api\\tests\\routes\\test_trace2_routes.py")
    assert should_ignore("apps/api/tests/adapters/envmon/test_envmon_databricks_adapter.py")


def test_generated_folder_is_ignored():
    assert should_ignore("packages/data-contracts/src/generated/contracts.ts")


def test_regular_source_file_is_not_ignored():
    assert not should_ignore("apps/api/adapters/trace2/customer_adapter.py")
