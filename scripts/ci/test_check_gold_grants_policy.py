"""Tests for the Gold grants policy guard.

Proves the guard flags base-Gold grants to `users` and passes governed-view grants. Snippets are fed
to parse_grants / classification helpers; the repo-wide check() is exercised once for smoke.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from check_gold_grants_policy import (  # noqa: E402
    check,
    is_governed_target,
    parse_grants,
)


def test_parses_grant_object_and_principal():
    sql = "GRANT SELECT ON TABLE connected_plant_prod.gold.gold_plant_readiness_status TO `users`;"
    assert parse_grants(sql) == [
        ("connected_plant_prod.gold.gold_plant_readiness_status", "gold_plant_readiness_status", "users")
    ]


def test_base_table_target_is_not_governed():
    assert is_governed_target("gold_plant_readiness_status") is False
    assert is_governed_target("gold_validation_failure_detail") is False


def test_secured_view_target_is_governed():
    assert is_governed_target("gold_warehouse_kpi_snapshot_secured") is True


def test_consumption_and_genie_views_are_governed():
    assert is_governed_target("vw_consumption_warehouse360_overview") is True
    assert is_governed_target("vw_genie_stock_health") is True


def test_backtick_quoted_three_part_name_is_parsed():
    sql = "GRANT SELECT ON VIEW `c`.`gold_io_reporting`.`gold_x_secured` TO `users`;"
    fqn, name, principal = parse_grants(sql)[0]
    assert name == "gold_x_secured" and principal == "users"
    assert is_governed_target(name) is True


def test_comments_are_ignored():
    sql = "-- GRANT SELECT ON TABLE connected_plant_prod.gold.gold_x TO `users`;\nSELECT 1;"
    assert parse_grants(sql) == []


def test_multiple_comma_separated_principals_are_all_parsed():
    # A violation must not be able to hide behind another grantee in the same GRANT statement.
    sql = "GRANT SELECT ON TABLE connected_plant_prod.gold.gold_x TO admin, `users`;"
    parsed = parse_grants(sql)
    principals = {p for _, _, p in parsed}
    assert principals == {"admin", "users"}
    assert all(name == "gold_x" for _, name, _ in parsed)


def test_with_grant_option_clause_is_stripped():
    sql = "GRANT SELECT ON VIEW c.gold_io_reporting.gold_x_secured TO `users` WITH GRANT OPTION;"
    fqn, name, principal = parse_grants(sql)[0]
    assert principal == "users" and name == "gold_x_secured"


def test_base_grant_to_users_as_second_principal_still_caught():
    # `users` listed second on a base table must still parse as a (base, users) pair the guard flags.
    sql = "GRANT SELECT ON TABLE connected_plant_prod.gold.gold_x TO admin, `users`;"
    assert ("connected_plant_prod.gold.gold_x", "gold_x", "users") in parse_grants(sql)
    assert is_governed_target("gold_x") is False  # -> a real violation for the consumer group


def test_repo_grants_are_policy_compliant():
    # Smoke: with the dead readiness grants removed, the repo's grant files must pass the guard.
    errors, n_files = check()
    assert n_files > 0
    assert errors == [], "Unexpected base-Gold grants to `users`:\n" + "\n".join(errors)
