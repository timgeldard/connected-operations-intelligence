"""Tests for the SPC Databricks adapter — QuerySpec factory and row mapper.

Column names confirmed-ddl (DESCRIBE TABLE run in connected_plant_uat, 2026-05-22):
  spc_quality_metric_subgroup_mv: material_id, plant_id, mic_id, mic_name,
  operation_id, batch_id, batch_date, sum_value, batch_n, batch_range,
  lsl_spec, usl_spec.

UAT candidates (spc-databricks-verification-results-summary.md, 2026-05-22):
  20642328 / P523 / 0010 / op 00000004 / pH — spec limits 7.2 / 7.8
  20047111 / C037 / 0060 / op 00000001 / Salt — lsl/usl 0.0 sentinel
"""
import pytest
from adapters.spc.spc_databricks_adapter import (
    MAX_SUBGROUPS,
    SpcSubgroupsRepository,
    SubgroupsRequest,
    get_spc_subgroups_spec,
    map_spc_subgroup_rows,
)
from shared.query_service.cache_policy import CacheTier
from shared.query_service.errors import DatabricksConfigError
from shared.query_service.identity import UserIdentity
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_executor import DatabricksRepository


def _request(**kwargs) -> SubgroupsRequest:
    defaults = {
        "material_id": "20642328",
        "plant_id": "P523",
        "mic_id": "0010",
        "operation_id": "00000004",
        "date_from": "2024-01-01",
        "date_to": "2026-05-22",
        "limit": 100,
    }
    defaults.update(kwargs)
    return SubgroupsRequest(**defaults)


# ---------------------------------------------------------------------------
# get_spc_subgroups_spec — QuerySpec factories
# ---------------------------------------------------------------------------

class TestGetSpcSubgroupsSpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def test_name(self) -> None:
        assert get_spc_subgroups_spec(_request()).name == "spc.get_subgroups"

    def test_module(self) -> None:
        assert get_spc_subgroups_spec(_request()).module == "spc"

    def test_endpoint(self) -> None:
        assert get_spc_subgroups_spec(_request()).endpoint == "/api/spc/subgroups"

    def test_cache_policy(self) -> None:
        assert get_spc_subgroups_spec(_request()).cache_policy == CacheTier.PER_USER_60S

    def test_tags(self) -> None:
        spec = get_spc_subgroups_spec(_request())
        assert "spc" in spec.tags
        assert "subgroups" in spec.tags

    def test_all_five_filters_in_params(self) -> None:
        spec = get_spc_subgroups_spec(_request())
        assert spec.params["material_id"] == "20642328"
        assert spec.params["plant_id"] == "P523"
        assert spec.params["mic_id"] == "0010"
        assert spec.params["operation_id"] == "00000004"
        assert spec.params["date_from"] == "2024-01-01"
        assert spec.params["date_to"] == "2026-05-22"

    def test_limit_embedded_as_integer_literal(self) -> None:
        """LIMIT must be embedded as literal, not a bound parameter."""
        spec = get_spc_subgroups_spec(_request(limit=50))
        assert "LIMIT 50" in spec.sql
        assert "LIMIT :limit" not in spec.sql
        assert "limit" not in spec.params

    def test_sql_references_mv(self) -> None:
        spec = get_spc_subgroups_spec(_request())
        assert "spc_quality_metric_subgroup_mv" in spec.sql

    def test_sql_uses_catalog_from_trace_catalog_fallback(self) -> None:
        spec = get_spc_subgroups_spec(_request())
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_uses_gold_schema(self) -> None:
        spec = get_spc_subgroups_spec(_request())
        assert "`gold`" in spec.sql

    def test_sql_mv_is_fully_qualified(self) -> None:
        spec = get_spc_subgroups_spec(_request())
        assert "FROM spc_quality_metric_subgroup_mv" not in spec.sql

    def test_sql_has_all_five_param_bindings(self) -> None:
        spec = get_spc_subgroups_spec(_request())
        assert ":material_id" in spec.sql
        assert ":plant_id" in spec.sql
        assert ":mic_id" in spec.sql
        assert ":operation_id" in spec.sql
        assert ":date_from" in spec.sql
        assert ":date_to" in spec.sql

    def test_sql_has_group_by_batch_id_and_date(self) -> None:
        """One row per subgroup requires GROUP BY (batch_id, batch_date)."""
        spec = get_spc_subgroups_spec(_request())
        assert "GROUP BY" in spec.sql
        assert "batch_id" in spec.sql
        assert "batch_date" in spec.sql

    def test_sql_computes_subgroup_mean(self) -> None:
        spec = get_spc_subgroups_spec(_request())
        assert "sum_value" in spec.sql
        assert "batch_n" in spec.sql
        assert "NULLIF" in spec.sql

    def test_sql_computes_subgroup_range(self) -> None:
        spec = get_spc_subgroups_spec(_request())
        assert "batch_range" in spec.sql

    def test_sql_selects_spec_limits(self) -> None:
        spec = get_spc_subgroups_spec(_request())
        assert "lsl_spec" in spec.sql
        assert "usl_spec" in spec.sql

    def test_missing_spc_catalog_and_trace_catalog_raises(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        monkeypatch.delenv("SPC_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_spc_subgroups_spec(_request())

    def test_spc_catalog_env_takes_precedence_over_trace(self, monkeypatch) -> None:
        monkeypatch.setenv("SPC_CATALOG", "my_spc_catalog")
        spec = get_spc_subgroups_spec(_request())
        assert "`my_spc_catalog`" in spec.sql
        assert "`connected_plant_uat`" not in spec.sql

    def test_two_requests_produce_independent_params(self) -> None:
        spec1 = get_spc_subgroups_spec(_request(material_id="20642328", plant_id="P523"))
        spec2 = get_spc_subgroups_spec(_request(material_id="20047111", plant_id="C037"))
        assert spec1.params["material_id"] != spec2.params["material_id"]
        assert spec1.params["plant_id"] != spec2.params["plant_id"]


# ---------------------------------------------------------------------------
# map_spc_subgroup_rows — row mapper
# ---------------------------------------------------------------------------

def _ph_row(**kwargs) -> dict:
    """Representative pH row (material 20642328 / P523 / 0010 — UAT confirmed)."""
    base = {
        "batch_id": "B0001",
        "batch_date": "2025-03-15",
        "subgroup_mean": 7.5,
        "subgroup_range": 0.3,
        "sample_count": 5,
        "lsl_spec": 7.2,
        "usl_spec": 7.8,
        "mic_name": "pH",
    }
    base.update(kwargs)
    return base


def _salt_row(**kwargs) -> dict:
    """Representative Salt row with 0.0 sentinel spec limits (UAT confirmed)."""
    base = {
        "batch_id": "B0002",
        "batch_date": "2025-03-16",
        "subgroup_mean": 0.9,
        "subgroup_range": 0.05,
        "sample_count": 3,
        "lsl_spec": 0.0,
        "usl_spec": 0.0,
        "mic_name": "Salt",
    }
    base.update(kwargs)
    return base


class TestMapSpcSubgroupRows:
    def test_empty_rows_returns_empty_points(self) -> None:
        result = map_spc_subgroup_rows([], _request())
        assert result["points"] == []

    def test_echoes_material_id(self) -> None:
        result = map_spc_subgroup_rows([_ph_row()], _request(material_id="20642328"))
        assert result["materialId"] == "20642328"

    def test_echoes_plant_id(self) -> None:
        result = map_spc_subgroup_rows([_ph_row()], _request(plant_id="P523"))
        assert result["plantId"] == "P523"

    def test_echoes_mic_id(self) -> None:
        result = map_spc_subgroup_rows([_ph_row()], _request(mic_id="0010"))
        assert result["micId"] == "0010"

    def test_echoes_operation_id(self) -> None:
        result = map_spc_subgroup_rows([_ph_row()], _request(operation_id="00000004"))
        assert result["operationId"] == "00000004"

    def test_mic_name_from_first_row(self) -> None:
        result = map_spc_subgroup_rows([_ph_row()], _request())
        assert result["micName"] == "pH"

    def test_mic_name_null_when_missing(self) -> None:
        result = map_spc_subgroup_rows([_ph_row(mic_name=None)], _request())
        assert result["micName"] is None

    def test_locked_limits_always_null(self) -> None:
        """Slice 1: spc_locked_limits not confirmed; lockedLimits must always be None."""
        result = map_spc_subgroup_rows([_ph_row()], _request())
        assert result["lockedLimits"] is None

    def test_capability_available_is_false(self) -> None:
        """Cp/Cpk/Pp/Ppk not in source MV — must always be False."""
        result = map_spc_subgroup_rows([_ph_row()], _request())
        assert result["capabilityAvailable"] is False

    def test_nelson_stored_flags_available_is_false(self) -> None:
        """spc_nelson_rule_flags_mv absent in UAT — must always be False."""
        result = map_spc_subgroup_rows([_ph_row()], _request())
        assert result["nelsonStoredFlagsAvailable"] is False

    def test_signals_client_side_only_is_true(self) -> None:
        result = map_spc_subgroup_rows([_ph_row()], _request())
        assert result["signalsClientSideOnly"] is True

    def test_point_batch_id(self) -> None:
        result = map_spc_subgroup_rows([_ph_row(batch_id="B0001")], _request())
        assert result["points"][0]["batchId"] == "B0001"

    def test_point_batch_date(self) -> None:
        result = map_spc_subgroup_rows([_ph_row(batch_date="2025-03-15")], _request())
        assert result["points"][0]["batchDate"] == "2025-03-15"

    def test_point_subgroup_mean(self) -> None:
        result = map_spc_subgroup_rows([_ph_row(subgroup_mean=7.5)], _request())
        assert result["points"][0]["subgroupMean"] == pytest.approx(7.5)

    def test_point_subgroup_range(self) -> None:
        result = map_spc_subgroup_rows([_ph_row(subgroup_range=0.3)], _request())
        assert result["points"][0]["subgroupRange"] == pytest.approx(0.3)

    def test_point_subgroup_range_null_when_none(self) -> None:
        result = map_spc_subgroup_rows([_ph_row(subgroup_range=None)], _request())
        assert result["points"][0]["subgroupRange"] is None

    def test_point_sample_count(self) -> None:
        result = map_spc_subgroup_rows([_ph_row(sample_count=5)], _request())
        assert result["points"][0]["sampleCount"] == 5

    def test_point_spec_limits_populated(self) -> None:
        """pH candidate has real spec limits — must pass through as floats."""
        result = map_spc_subgroup_rows([_ph_row(lsl_spec=7.2, usl_spec=7.8)], _request())
        p = result["points"][0]
        assert p["lslSpec"] == pytest.approx(7.2)
        assert p["uslSpec"] == pytest.approx(7.8)

    def test_spec_limit_sentinel_both_zero_maps_to_null(self) -> None:
        """Salt UAT: lsl_spec=0.0 AND usl_spec=0.0 is a sentinel — both must be None."""
        result = map_spc_subgroup_rows([_salt_row()], _request())
        p = result["points"][0]
        assert p["lslSpec"] is None
        assert p["uslSpec"] is None

    def test_spec_limit_lsl_only_zero_not_sentinel(self) -> None:
        """Only lsl=0.0 while usl>0 is a legitimate one-sided spec — not null."""
        result = map_spc_subgroup_rows([_ph_row(lsl_spec=0.0, usl_spec=5.0)], _request())
        p = result["points"][0]
        assert p["lslSpec"] == pytest.approx(0.0)
        assert p["uslSpec"] == pytest.approx(5.0)

    def test_multiple_rows_produce_multiple_points(self) -> None:
        rows = [_ph_row(batch_id="B1"), _ph_row(batch_id="B2"), _ph_row(batch_id="B3")]
        result = map_spc_subgroup_rows(rows, _request())
        assert len(result["points"]) == 3

    def test_no_invented_capability_fields(self) -> None:
        """Response must not carry cp/cpk/pp/ppk — not in source MV."""
        result = map_spc_subgroup_rows([_ph_row()], _request())
        for key in ("cp", "cpk", "pp", "ppk"):
            assert key not in result

    def test_no_nelson_signal_fields(self) -> None:
        """Response must not carry stored Nelson rule flag fields."""
        result = map_spc_subgroup_rows([_ph_row()], _request())
        for key in ("nelsonSignals", "signals", "rulesViolated"):
            assert key not in result

    def test_operation_id_not_work_centre_id(self) -> None:
        """operationId in response — never workCentreId (different concept)."""
        result = map_spc_subgroup_rows([_ph_row()], _request(operation_id="00000001"))
        assert "workCentreId" not in result
        assert result["operationId"] == "00000001"

    def test_no_in_control_assertion(self) -> None:
        """No 'status' or 'inControl' field — signals are client-side only."""
        result = map_spc_subgroup_rows([_ph_row()], _request())
        assert "status" not in result
        for p in result["points"]:
            assert "status" not in p
            assert "inControl" not in p


# ---------------------------------------------------------------------------
# SpcSubgroupsRepository
# ---------------------------------------------------------------------------


class _FakeExecutor:
    def __init__(self, rows: list[dict] | None = None, error: Exception | None = None) -> None:
        self.rows = rows or []
        self.error = error
        self.sql_seen: str | None = None

    async def execute(self, spec, identity):
        self.sql_seen = spec.sql
        if self.error:
            raise self.error
        return self.rows


@pytest.fixture(autouse=True)
def _catalog_allowlist(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABRICKS_ALLOWED_CATALOGS",
        "override_catalog,connected_plant_uat,allowed_catalog",
    )


class TestSpcSubgroupsRepository:
    async def test_fetch_subgroups_executes_spec(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("SPC_CATALOG", "repo_catalog")
        monkeypatch.setenv("SPC_SCHEMA", "gold")
        executor = _FakeExecutor(rows=[_ph_row()])
        repository = SpcSubgroupsRepository(
            DatabricksRepository(
                executor=executor,  # type: ignore[arg-type]
                identity=UserIdentity(user_id="u001", raw_oauth_token="tok"),
            )
        )
        rows, spec = await repository.fetch_subgroups(_request())
        assert len(rows) == 1
        assert spec.name == "spc.get_subgroups"
        assert "`repo_catalog`.`gold`.`spc_quality_metric_subgroup_mv`" in executor.sql_seen

    async def test_catalog_override_applied_without_leaking(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("SPC_CATALOG", "env_catalog")
        monkeypatch.setenv("SPC_SCHEMA", "gold")
        executor = _FakeExecutor(rows=[])
        repository = SpcSubgroupsRepository(
            DatabricksRepository(
                executor=executor,  # type: ignore[arg-type]
                identity=UserIdentity(
                    user_id="u001",
                    raw_oauth_token="tok",
                    catalog_target="override_catalog",
                ),
            )
        )
        await repository.fetch_subgroups(_request())
        assert "`override_catalog`.`gold`.`spc_quality_metric_subgroup_mv`" in executor.sql_seen
        assert "`env_catalog`.`gold`.`spc_quality_metric_subgroup_mv`" in resolve_domain_object(
            "spc",
            "spc_quality_metric_subgroup_mv",
        )

    async def test_catalog_override_resets_after_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("SPC_CATALOG", "env_catalog")
        monkeypatch.setenv("SPC_SCHEMA", "gold")
        executor = _FakeExecutor(error=RuntimeError("query failed"))
        repository = SpcSubgroupsRepository(
            DatabricksRepository(
                executor=executor,  # type: ignore[arg-type]
                identity=UserIdentity(
                    user_id="u001",
                    raw_oauth_token="tok",
                    catalog_target="override_catalog",
                ),
            )
        )
        with pytest.raises(RuntimeError, match="query failed"):
            await repository.fetch_subgroups(_request())
        assert "`env_catalog`.`gold`.`spc_quality_metric_subgroup_mv`" in resolve_domain_object(
            "spc",
            "spc_quality_metric_subgroup_mv",
        )


# ---------------------------------------------------------------------------
# MAX_SUBGROUPS constant
# ---------------------------------------------------------------------------

class TestMaxSubgroups:
    def test_max_subgroups_is_positive_and_bounded(self) -> None:
        assert 1 <= MAX_SUBGROUPS <= 500

    def test_max_subgroups_prevents_broad_scan(self) -> None:
        """The constant must exist and be ≤ 500 to guard against 73M-row MV scans."""
        assert MAX_SUBGROUPS <= 500
