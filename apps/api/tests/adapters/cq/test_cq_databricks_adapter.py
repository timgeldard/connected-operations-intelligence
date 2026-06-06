"""Tests for the CQ Lab Databricks adapter — QuerySpec factory and row mapper."""
import pytest
from adapters.cq.cq_databricks_adapter import get_lab_plants_spec, map_lab_plants_rows
from shared.query_service.cache_policy import CacheTier
from shared.query_service.errors import DatabricksConfigError


class TestGetLabPlantsSpec:
    def test_name(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert spec.name == "cq.get_lab_plants"

    def test_module(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert spec.module == "cq"

    def test_endpoint(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert spec.endpoint == "/api/cq/lab/plants"

    def test_cache_policy_is_global(self, monkeypatch) -> None:
        """Lab plants is a slow-moving dimension — must use GLOBAL_300S."""
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert spec.cache_policy == CacheTier.GLOBAL_300S

    def test_source_badge(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert spec.source_badge == "databricks-api"

    def test_tags(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert "cq" in spec.tags
        assert "lab" in spec.tags
        assert "plants" in spec.tags

    def test_params_is_empty(self, monkeypatch) -> None:
        """getLabPlants takes no input parameters."""
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert spec.params == {}

    def test_sql_references_gold_plant(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert "gold_plant" in spec.sql

    def test_sql_uses_cq_catalog(self, monkeypatch) -> None:
        """SQL must include the catalog from CQ_CATALOG env var."""
        monkeypatch.setenv("CQ_CATALOG", "connected_plant_uat")
        spec = get_lab_plants_spec()
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_uses_gold_schema(self, monkeypatch) -> None:
        """CQ lab plants always uses gold schema (V1: `{CQ_CATALOG}`.`gold`.`gold_plant`)."""
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert "`gold`" in spec.sql

    def test_sql_uses_cq_catalog_fallback_to_trace_catalog(self, monkeypatch) -> None:
        """CQ_CATALOG falls back to TRACE_CATALOG (V1-compatible)."""
        monkeypatch.delenv("CQ_CATALOG", raising=False)
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        spec = get_lab_plants_spec()
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_aliases_plant_id_from_v1_column(self, monkeypatch) -> None:
        """Uses PLANT_ID column (confirmed from V1: gold.gold_plant.PLANT_ID)."""
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert "PLANT_ID" in spec.sql
        assert "plant_id" in spec.sql

    def test_sql_aliases_plant_name_from_v1_column(self, monkeypatch) -> None:
        """Uses PLANT_NAME column (confirmed from V1: gold.gold_plant.PLANT_NAME)."""
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert "PLANT_NAME" in spec.sql
        assert "plant_name" in spec.sql

    def test_sql_orders_by_plant_id(self, monkeypatch) -> None:
        """Matches V1 ORDER BY PLANT_ID."""
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert "ORDER BY PLANT_ID" in spec.sql

    def test_sql_filters_null_plant_ids(self, monkeypatch) -> None:
        """Matches V1 WHERE PLANT_ID IS NOT NULL."""
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert "PLANT_ID IS NOT NULL" in spec.sql

    def test_sql_has_limit(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert "LIMIT :max_rows" in spec.sql

    def test_sql_selects_plant_id_alias(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert "plant_id" in spec.sql

    def test_sql_selects_plant_name_alias(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec = get_lab_plants_spec()
        assert "plant_name" in spec.sql

    def test_missing_catalog_raises_config_error(self, monkeypatch) -> None:
        """Missing CQ_CATALOG (and TRACE_CATALOG fallback) raises DatabricksConfigError."""
        monkeypatch.delenv("CQ_CATALOG", raising=False)
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_lab_plants_spec()

    def test_multiple_calls_return_equal_specs(self, monkeypatch) -> None:
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec1 = get_lab_plants_spec()
        spec2 = get_lab_plants_spec()
        assert spec1.name == spec2.name
        assert spec1.sql == spec2.sql
        assert spec1.params == spec2.params

    def test_params_not_shared_between_calls(self, monkeypatch) -> None:
        """Mutable default guard: params dicts must not be the same object."""
        monkeypatch.setenv("CQ_CATALOG", "mycat")
        spec1 = get_lab_plants_spec()
        spec2 = get_lab_plants_spec()
        spec1.params["injected"] = "value"
        assert "injected" not in spec2.params


# ---------------------------------------------------------------------------
# map_lab_plants_rows
# ---------------------------------------------------------------------------

class TestMapLabPlantsRows:
    def test_returns_plants_key(self) -> None:
        result = map_lab_plants_rows([])
        assert "plants" in result

    def test_empty_rows_returns_empty_list(self) -> None:
        result = map_lab_plants_rows([])
        assert result == {"plants": []}

    def test_maps_plant_id_and_plant_name(self) -> None:
        rows = [{"plant_id": "IE01", "plant_name": "Kerry Charleville"}]
        result = map_lab_plants_rows(rows)
        assert result["plants"] == [{"plantId": "IE01", "plantName": "Kerry Charleville"}]

    def test_multiple_plants_preserved(self) -> None:
        rows = [
            {"plant_id": "IE01", "plant_name": "Charleville"},
            {"plant_id": "IE02", "plant_name": "Listowel"},
        ]
        result = map_lab_plants_rows(rows)
        assert len(result["plants"]) == 2
        assert result["plants"][0]["plantId"] == "IE01"
        assert result["plants"][1]["plantId"] == "IE02"

    def test_rows_without_plant_id_are_excluded(self) -> None:
        rows = [
            {"plant_id": "IE01", "plant_name": "Charleville"},
            {"plant_id": None, "plant_name": "Unknown"},
            {"plant_name": "No ID row"},
        ]
        result = map_lab_plants_rows(rows)
        assert len(result["plants"]) == 1
        assert result["plants"][0]["plantId"] == "IE01"

    def test_plant_name_none_becomes_empty_string(self) -> None:
        rows = [{"plant_id": "IE01", "plant_name": None}]
        result = map_lab_plants_rows(rows)
        assert result["plants"][0]["plantName"] == "None"

    def test_plant_id_is_string(self) -> None:
        rows = [{"plant_id": "IE01", "plant_name": "Test"}]
        result = map_lab_plants_rows(rows)
        assert isinstance(result["plants"][0]["plantId"], str)

    def test_integer_plant_id_converted_to_string(self) -> None:
        rows = [{"plant_id": 1001, "plant_name": "Test"}]
        result = map_lab_plants_rows(rows)
        assert result["plants"][0]["plantId"] == "1001"
