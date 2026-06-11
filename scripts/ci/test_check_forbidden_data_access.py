"""Tests for the repository boundary scanner.

Proves the scanner catches forbidden hard-coded data access and leaves the sanctioned
resolver path, approved consumption views, documentation prose, and test files alone.
Snippets are fed directly to ``scan_text`` — the tests do not walk the repo.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from check_forbidden_data_access import (  # noqa: E402
    MIGRATION_PENDING_DOMAINS,
    classify_resolver_calls,
    is_test_path,
    scan_resolver_calls,
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


# --- Migration-progress gate (resolver pass) ----------------------------------

def test_allowlisted_domain_direct_gold_is_pending_not_violation():
    # trace2 is mid-migration: a direct gold object is informational, not a failure.
    src = 'v = resolve_domain_object("trace2", "gold_batch_lineage")'
    pending, violations = classify_resolver_calls(src)
    assert violations == []
    assert pending == [("trace2", "gold_batch_lineage", 1)]


def test_non_allowlisted_domain_direct_gold_is_violation():
    # A domain NOT in the allowlist resolving to a non-consumption object must fail.
    src = 'v = resolve_domain_object("warehouse360", "gold_warehouse_exceptions")'
    pending, violations = classify_resolver_calls(src)
    assert pending == []
    assert violations == [("warehouse360", "gold_warehouse_exceptions", 1)]


def test_consumption_view_target_is_never_flagged():
    # vw_consumption_* / vw_genie_* targets are migrated — neither pending nor violation,
    # even for a non-allowlisted domain.
    for obj in ("vw_consumption_warehouse360_overview", "vw_genie_stock_health"):
        src = f'v = resolve_domain_object("warehouse360", "{obj}")'
        pending, violations = classify_resolver_calls(src)
        assert pending == [] and violations == []


def test_module_level_constant_object_arg_is_resolved():
    # _SPC_MV = "..." then resolve_domain_object("spc", _SPC_MV) must classify by the constant value.
    src = (
        '_SPC_MV = "spc_quality_metric_subgroup_mv"\n'
        'mv = resolve_domain_object("spc", _SPC_MV)\n'
    )
    pending, violations = classify_resolver_calls(src)
    assert violations == []
    assert pending == [("spc", "spc_quality_metric_subgroup_mv", 2)]


def test_dynamic_domain_is_not_a_violation():
    # The resolver wrapper passes a variable domain; it cannot be classified and must not fail.
    src = "def wrap(domain, obj):\n    return resolve_domain_object(domain, obj)\n"
    pending, violations = classify_resolver_calls(src)
    assert pending == [] and violations == []


def test_allowlist_cannot_lie_removing_pending_domain_fails():
    # If trace2 were removed from the allowlist while it still resolves to gold, its access fails CI.
    src = 'v = resolve_domain_object("trace2", "gold_batch_lineage")'
    finding = scan_resolver_calls(src)
    assert finding == [("trace2", "gold_batch_lineage", True, 1)]
    assert "trace2" in MIGRATION_PENDING_DOMAINS  # currently allowlisted -> pending; remove -> violation


# --- YAML description-block suppression -------------------------------------------

def test_yaml_block_scalar_description_is_not_scanned():
    # The contract manifest legitimately mentions gold/silver in prose; these must not flag.
    yaml = (
        "contracts:\n"
        "  - id: foo\n"
        "    description: >\n"
        "      sourced from gold_inbound_po_line_backlog / silver.purchase_order\n"
        "      Candidate contract pending DEV profiling.\n"
        "    source_view: vw_consumption_foo\n"
    )
    assert scan_text(yaml, is_yaml=True) == []


def test_yaml_block_scalar_pipe_description_is_not_scanned():
    yaml = (
        "fields:\n"
        "  - name: x\n"
        "    description: |\n"
        "      FROM gold_batch_lineage (sourced from connected_plant_uat.gold.foo)\n"
        "    type: string\n"
    )
    assert scan_text(yaml, is_yaml=True) == []


def test_yaml_inline_description_is_not_scanned():
    # Inline `description: ...` values on the same line must also be suppressed.
    yaml = "    description: Purchase order creation date (cast to DATE in silver)\n"
    assert scan_text(yaml, is_yaml=True) == []


def test_yaml_non_description_key_is_still_scanned():
    # source_view and other keys must NOT be suppressed — only `description:`.
    yaml = "    source_view: FROM gold_batch_lineage\n"
    assert scan_text(yaml, is_yaml=True)  # must still flag


def test_yaml_description_suppression_does_not_affect_surrounding_keys():
    # Keys above and below the description block are still scanned.
    yaml = (
        "    source_view: vw_consumption_ok\n"
        "    description: >\n"
        "      sourced from gold_foo\n"
        "    grain: one row per plant (FROM gold_actual_violation)\n"
    )
    violations = scan_text(yaml, is_yaml=True)
    # The grain line must still be flagged.
    assert any("grain" in v[1] or "FROM gold_actual_violation" in v[1] for v in violations)
    # The description prose must not be flagged.
    assert not any("gold_foo" in v[1] for v in violations)


def test_non_yaml_description_line_is_scanned_without_is_yaml():
    # Without is_yaml=True the description line is scanned normally.
    src = "description: sourced from gold_x"
    assert scan_text(src) != []  # must flag
    assert scan_text(src, is_yaml=True) == []  # must NOT flag with YAML mode
