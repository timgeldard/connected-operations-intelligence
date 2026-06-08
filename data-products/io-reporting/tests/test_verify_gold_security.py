"""Unit tests for the Gold RLS verification core (gold/security/verify_gold_security.py).

Covers the pure ``find_rls_violations`` logic — no Spark required. The Spark glue (SHOW GRANTS /
SHOW VIEWS) is intentionally thin and exercised only at job runtime.
"""
from gold.security.verify_gold_security import find_rls_violations


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
