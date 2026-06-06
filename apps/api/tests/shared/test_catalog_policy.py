"""Tests for Databricks catalog override allowlist policy."""
from __future__ import annotations

import pytest
from shared.query_service.catalog_policy import (
    ALLOWLIST_ENV_VAR,
    UNSUPPORTED_CATALOG_DETAIL,
    assert_allowed_catalog_target,
    normalize_catalog_override,
    parse_allowed_catalogs,
)
from shared.query_service.errors import DatabricksCatalogTargetError


class TestParseAllowedCatalogs:
    def test_parses_comma_separated_values(self) -> None:
        allowed = parse_allowed_catalogs("connected_plant_uat,connected_plant_prod")
        assert allowed == frozenset({"connected_plant_uat", "connected_plant_prod"})

    def test_trims_whitespace(self) -> None:
        allowed = parse_allowed_catalogs("  cat_a , cat_b  ")
        assert allowed == frozenset({"cat_a", "cat_b"})

    def test_empty_string_returns_empty_set(self) -> None:
        assert parse_allowed_catalogs("") == frozenset()
        assert parse_allowed_catalogs("   ") == frozenset()

    def test_none_returns_empty_set(self) -> None:
        assert parse_allowed_catalogs(None) == frozenset()


class TestNormalizeCatalogOverride:
    def test_none_is_absent(self) -> None:
        assert normalize_catalog_override(None) is None

    def test_blank_is_absent(self) -> None:
        assert normalize_catalog_override("") is None
        assert normalize_catalog_override("   ") is None

    def test_trims_value(self) -> None:
        assert normalize_catalog_override("  my_catalog  ") == "my_catalog"


class TestAssertAllowedCatalogTarget:
    def test_no_override_returns_none(self) -> None:
        assert assert_allowed_catalog_target(None, allowed_catalogs=frozenset({"cat_a"})) is None

    def test_blank_override_treated_as_absent(self) -> None:
        assert assert_allowed_catalog_target("  ", allowed_catalogs=frozenset({"cat_a"})) is None

    def test_allowlisted_override_accepted(self) -> None:
        allowed = frozenset({"connected_plant_uat"})
        assert (
            assert_allowed_catalog_target(
                "connected_plant_uat",
                allowed_catalogs=allowed,
            )
            == "connected_plant_uat"
        )

    def test_unknown_override_rejected(self) -> None:
        with pytest.raises(DatabricksCatalogTargetError) as exc_info:
            assert_allowed_catalog_target(
                "other_catalog",
                allowed_catalogs=frozenset({"connected_plant_uat"}),
            )
        assert str(exc_info.value) == UNSUPPORTED_CATALOG_DETAIL
        assert "other_catalog" not in str(exc_info.value)

    def test_override_rejected_when_allowlist_empty(self) -> None:
        with pytest.raises(DatabricksCatalogTargetError):
            assert_allowed_catalog_target(
                "connected_plant_uat",
                allowed_catalogs=frozenset(),
            )

    @pytest.mark.parametrize(
        "unsafe_value",
        [
            "cat;drop",
            "cat`name",
            "cat/name",
            "cat name",
            "cat--comment",
            "cat'x",
            'cat"x',
            "cat..x",
            "cat\\x",
        ],
    )
    def test_unsafe_override_rejected_without_echo(self, unsafe_value: str) -> None:
        with pytest.raises(DatabricksCatalogTargetError) as exc_info:
            assert_allowed_catalog_target(
                unsafe_value,
                allowed_catalogs=frozenset({"connected_plant_uat"}),
            )
        assert str(exc_info.value) == UNSUPPORTED_CATALOG_DETAIL
        assert unsafe_value not in str(exc_info.value)

    def test_reads_allowlist_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(ALLOWLIST_ENV_VAR, "env_catalog")
        assert assert_allowed_catalog_target("env_catalog") == "env_catalog"
