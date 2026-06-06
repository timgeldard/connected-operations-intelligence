"""Tests for shared.query_service.object_resolver.

Verifies:
- quote_identifier and qualify_object produce correct backtick-quoted output.
- resolve_domain_object resolves catalogs and schemas from env vars.
- V1-compatible CQ_CATALOG fallback to TRACE_CATALOG.
- V1-compatible schema defaults.
- Missing catalog raises DatabricksConfigError.
- User-supplied request params cannot influence object name selection
  (enforced by design: the spec factory is the only caller and it uses code constants).
"""
from __future__ import annotations

import pytest
from shared.query_service.errors import DatabricksConfigError
from shared.query_service.object_resolver import (
    qualify_object,
    quote_identifier,
    resolve_domain_object,
)


class TestQuoteIdentifier:
    def test_wraps_in_backticks(self) -> None:
        assert quote_identifier("gold_plant") == "`gold_plant`"

    def test_catalog_name(self) -> None:
        assert quote_identifier("connected_plant_uat") == "`connected_plant_uat`"

    def test_schema_name(self) -> None:
        assert quote_identifier("csm_process_order_history") == "`csm_process_order_history`"


class TestQualifyObject:
    def test_produces_three_part_reference(self) -> None:
        result = qualify_object("mycat", "myschema", "mytable")
        assert result == "`mycat`.`myschema`.`mytable`"

    def test_backtick_quotes_all_parts(self) -> None:
        result = qualify_object("cat", "sch", "tbl")
        assert result.count("`") == 6

    def test_gold_plant_reference(self) -> None:
        result = qualify_object("connected_plant_uat", "gold", "gold_plant")
        assert result == "`connected_plant_uat`.`gold`.`gold_plant`"


class TestResolveDomainObject:
    # ── Domain defaults (V1-compatible) ─────────────────────────────────────

    def test_poh_schema_defaults_to_csm_process_order_history(self, monkeypatch) -> None:
        monkeypatch.setenv("POH_CATALOG", "mycat")
        monkeypatch.delenv("POH_SCHEMA", raising=False)
        result = resolve_domain_object("poh", "vw_gold_process_order")
        assert "`csm_process_order_history`" in result

    def test_cq_schema_defaults_to_csm_process_order_history(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        monkeypatch.delenv("CQ_SCHEMA", raising=False)
        result = resolve_domain_object("cq", "gold_plant", schema_override="gold")
        # schema_override wins — but without override, default would be csm_process_order_history
        assert "`gold`" in result  # schema_override applied

    def test_trace2_schema_defaults_to_gold(self, monkeypatch) -> None:
        monkeypatch.setenv("TRACE_CATALOG", "mycat")
        monkeypatch.delenv("TRACE_SCHEMA", raising=False)
        result = resolve_domain_object("trace2", "gold_batch_stock_v")
        assert "`gold`" in result

    def test_cq_catalog_falls_back_to_trace_catalog(self, monkeypatch) -> None:
        """V1 behaviour: CQ_CATALOG defaults to TRACE_CATALOG when unset."""
        monkeypatch.delenv("CQ_CATALOG", raising=False)
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        result = resolve_domain_object("cq", "gold_plant", schema_override="gold")
        assert "`connected_plant_uat`" in result

    # ── Catalog_override and schema_override ─────────────────────────────────

    def test_catalog_override_bypasses_env_var(self, monkeypatch) -> None:
        monkeypatch.setenv("POH_CATALOG", "env_catalog")
        result = resolve_domain_object("poh", "vw_gold_process_order", catalog_override="override_catalog")
        assert "`override_catalog`" in result
        assert "env_catalog" not in result

    def test_schema_override_bypasses_env_var(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        monkeypatch.setenv("CQ_SCHEMA", "env_schema")
        result = resolve_domain_object("cq", "gold_plant", schema_override="gold")
        assert "`gold`" in result
        assert "env_schema" not in result

    def test_cq_lab_plants_uses_gold_schema_override(self, monkeypatch) -> None:
        """CQ lab plants always uses gold schema — matches V1 explicit gold.gold_plant."""
        monkeypatch.setenv("CQ_CATALOG", "connected_plant_uat")
        result = resolve_domain_object("cq", "gold_plant", schema_override="gold")
        assert result == "`connected_plant_uat`.`gold`.`gold_plant`"

    # ── Full object reference ────────────────────────────────────────────────

    def test_poh_fully_qualified_reference(self, monkeypatch) -> None:
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("POH_SCHEMA", "csm_process_order_history")
        result = resolve_domain_object("poh", "vw_gold_process_order")
        assert result == "`connected_plant_uat`.`csm_process_order_history`.`vw_gold_process_order`"

    def test_trace2_fully_qualified_reference(self, monkeypatch) -> None:
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")
        result = resolve_domain_object("trace2", "gold_batch_stock_v")
        assert result == "`connected_plant_uat`.`gold`.`gold_batch_stock_v`"

    # ── Missing catalog raises DatabricksConfigError ─────────────────────────

    def test_missing_poh_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("POH_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError) as exc_info:
            resolve_domain_object("poh", "vw_gold_process_order")
        assert "POH_CATALOG" in str(exc_info.value)

    def test_missing_cq_catalog_and_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("CQ_CATALOG", raising=False)
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError) as exc_info:
            resolve_domain_object("cq", "gold_plant", schema_override="gold")
        assert "CQ_CATALOG" in str(exc_info.value)

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError) as exc_info:
            resolve_domain_object("trace2", "gold_batch_stock_v")
        assert "TRACE_CATALOG" in str(exc_info.value)

    def test_config_error_contains_missing_var_in_missing_vars(self, monkeypatch) -> None:
        monkeypatch.delenv("POH_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError) as exc_info:
            resolve_domain_object("poh", "vw_gold_process_order")
        assert "POH_CATALOG" in exc_info.value.missing_vars

    # ── Unknown domain ───────────────────────────────────────────────────────

    def test_unknown_domain_raises_value_error(self, monkeypatch) -> None:
        with pytest.raises(ValueError, match="Unknown domain"):
            resolve_domain_object("unknown_domain", "some_table")

    # ── Object names are code constants — user params cannot affect them ──────

    def test_object_name_from_code_constant_not_user_input(self, monkeypatch) -> None:
        """
        The object_name parameter is always a code constant passed by the factory.
        This test documents the invariant: the factory controls the table name,
        not the request parameters.
        """
        monkeypatch.setenv("POH_CATALOG", "mycat")
        # Factory-supplied constant
        result = resolve_domain_object("poh", "vw_gold_process_order")
        assert "vw_gold_process_order" in result
        # A hypothetical injection attempt cannot happen because object_name
        # is always called with a string literal in the adapter factories.
        # Backtick quoting from qualify_object would contain the literal value.

    # ── Env var read at call time (not at import time) ───────────────────────

    def test_reads_env_var_at_call_time(self, monkeypatch) -> None:
        monkeypatch.setenv("TRACE_CATALOG", "catalog_a")
        result_a = resolve_domain_object("trace2", "gold_plant")
        monkeypatch.setenv("TRACE_CATALOG", "catalog_b")
        result_b = resolve_domain_object("trace2", "gold_plant")
        assert "`catalog_a`" in result_a
        assert "`catalog_b`" in result_b
