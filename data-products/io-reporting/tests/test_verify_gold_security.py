"""Unit tests for the Gold RLS verification core (gold/security/verify_gold_security.py).

Covers the pure logic — ``find_rls_violations`` plus the ``fq`` identifier builder and the
``view_name_of`` DBR-casing helper — no Spark required. The remaining Spark glue (SHOW GRANTS /
SHOW VIEWS calls) is intentionally thin and exercised only at job runtime.
"""
from gold.security.verify_gold_security import find_rls_violations, fq, view_name_of


def test_clean_setup_has_no_violations():
    secured = ["gold_warehouse_kpi_snapshot_secured", "gold_delivery_pick_status_secured"]
    grantees = {
        "gold_warehouse_kpi_snapshot_secured": {"users"},
        "gold_delivery_pick_status_secured": {"users"},
        "gold_warehouse_kpi_snapshot": {"data_engineers"},
        "gold_delivery_pick_status": {"data_engineers"},
    }
    assert find_rls_violations(secured, grantees) == []


def test_base_table_directly_granted_is_a_violation():
    secured = ["gold_x_secured"]
    grantees = {"gold_x_secured": {"users"}, "gold_x": {"users"}}  # base leaked to users
    violations = find_rls_violations(secured, grantees)
    assert len(violations) == 1
    assert "gold_x" in violations[0] and "must be revoked" in violations[0]


def test_secured_view_not_granted_is_a_violation():
    secured = ["gold_x_secured"]
    grantees = {"gold_x_secured": set(), "gold_x": set()}  # view exists but not granted to users
    violations = find_rls_violations(secured, grantees)
    assert len(violations) == 1
    assert "not granted SELECT" in violations[0]


def test_both_problems_reported_together():
    secured = ["gold_x_secured"]
    grantees = {"gold_x_secured": set(), "gold_x": {"users"}}
    violations = find_rls_violations(secured, grantees)
    assert len(violations) == 2


def test_missing_grant_entry_treated_as_no_select():
    # A secured view with no grant entry at all -> not granted -> violation; base absent -> fine.
    secured = ["gold_x_secured"]
    violations = find_rls_violations(secured, {})
    assert any("not granted SELECT" in v for v in violations)
    assert not any("must be revoked" in v for v in violations)


def test_non_secured_names_are_ignored():
    assert find_rls_violations(["gold_x", "vw_consumption_y"], {"gold_x": {"users"}}) == []


def test_custom_consumer_group():
    secured = ["gold_x_secured"]
    grantees = {"gold_x_secured": {"app_readers"}, "gold_x": {"app_readers"}}
    violations = find_rls_violations(secured, grantees, consumer_group="app_readers")
    assert len(violations) == 1 and "app_readers" in violations[0]


def test_fq_quotes_each_part_separately():
    # Each of catalog/schema/object must be quoted on its own — not catalog.schema as one token.
    assert fq("connected_plant_prod", "gold_io_reporting", "gold_x_secured") == (
        "`connected_plant_prod`.`gold_io_reporting`.`gold_x_secured`"
    )


def test_view_name_of_handles_dbr_casing_variants():
    assert view_name_of({"viewName": "gold_x_secured"}) == "gold_x_secured"      # camelCase
    assert view_name_of({"view_name": "gold_x_secured"}) == "gold_x_secured"     # snake_case
    assert view_name_of({"tableName": "gold_x_secured"}) == "gold_x_secured"     # SHOW VIEWS alt
    assert view_name_of({"table_name": "gold_x_secured"}) == "gold_x_secured"
    assert view_name_of({"namespace": "gold_io_reporting"}) is None              # no name key
