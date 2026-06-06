from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport
from main import app
from shared.query_service.errors import (
    DatabricksPermissionError,
    DatabricksQueryError,
    DatabricksQueryTimeoutError,
    DatabricksRateLimitError,
    DatabricksWarehouseConfigError,
)


def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

_HEADERS_WITH_TOKEN = {
    "x-forwarded-access-token": "user-bearer-token",
    "x-forwarded-user": "user123",
    "x-forwarded-email": "user@example.com",
}

def _valid_payload(overrides=None):
    base = {
        "materialId": "20642328",
        "plantId": "P523",
        "micId": "0010",
        "operationId": "00000004",
        "dateFrom": "2025-01-01",
        "dateTo": "2025-12-31"
    }
    if overrides:
        base.update(overrides)
    return base

def _databricks_env(monkeypatch):
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
    monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
    monkeypatch.setenv("TRACE_SCHEMA", "gold")
    monkeypatch.setenv("SPC_CATALOG", "connected_plant_uat")
    monkeypatch.setenv("SPC_SCHEMA", "gold")
    monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog,connected_plant_uat")

class TestSpcChartDataValidation:
    async def test_missing_operation_id_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"operationId": ""})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_date_from_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"dateFrom": ""})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_date_to_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"dateTo": ""})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_blank_material_id_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"materialId": ""})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_date_from_after_date_to_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"dateFrom": "2025-12-31", "dateTo": "2025-01-01"})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_date_window_exceeds_730_days_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"dateFrom": "2020-01-01", "dateTo": "2026-12-31"})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_p999_returns_422(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"plantId": "P999"})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_max_rows_over_200_fails_validation(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload({"maxRows": 201})
        async with _make_client() as client:
            response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

class TestSpcChartDataQuerySafety:
    async def test_query_spec_params(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload()

        async def _mock(self_obj, spec, identity):
            # Assert query safety fields are present in the spec params
            assert "material_id" in spec.params
            assert "plant_id" in spec.params
            assert "mic_id" in spec.params
            assert "operation_id" in spec.params
            return []

        with patch("shared.query_service.query_executor.QueryExecutor.execute", _mock):
            async with _make_client() as client:
                response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)

        # Since rows returned are empty, response is generated safely
        assert response.status_code == 200

class TestSpcChartDataLockedLimitsSemantics:
    async def test_locked_limits_warning_and_approval(self, monkeypatch):
        # The route only fetches spc_locked_limits when chart_type is set
        # (the WHERE clause binds :resolved_chart_type). Supply it explicitly
        # so the locked-limits branch in map_spc_chart_response is exercised.
        _databricks_env(monkeypatch)
        payload = _valid_payload({"chartType": "xbar-r"})

        async def _mock(self_obj, spec, identity):
            if "locked_limits" in spec.name:
                return [{
                    "cl": 10.0, "ucl": 12.0, "lcl": 8.0,
                    "ucl_r": None, "lcl_r": None, "sigma_within": None,
                    "locked_by": "user1", "locked_at": "2025-01-01T00:00:00Z",
                    "baseline_from": "2024-01-01", "baseline_to": "2024-12-31",
                    "locking_note": "governance approval pending"
                }]
            return []

        with patch("shared.query_service.query_executor.QueryExecutor.execute", _mock):
            async with _make_client() as client:
                response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 200
        data = response.json()
        assert data["controlLimits"]["lockedLimits"] is True
        assert data["controlLimits"]["lockedBy"] == "user1"
        # locked_by is exposed but MUST NOT be treated as governed approval.
        assert data["controlLimits"]["approvalState"] != "approved"
        assert data["controlLimits"]["approvalState"] == "pending-validation"
        # Provenance must not be calculated-from-sample when values come from
        # spc_locked_limits — nothing was calculated from a sample.
        assert data["controlLimits"]["limitProvenance"] != "calculated-from-sample"
        assert data["controlLimits"]["limitProvenance"] == "unknown"
        assert len(data["warnings"]) == 1
        assert "locked_by is not treated as approval" in data["warnings"][0]

class TestSpcChartDataRepositoryRoute:
    async def test_response_headers_from_subgroups_spec(self, monkeypatch):
        _databricks_env(monkeypatch)

        async def _mock(self_obj, spec, identity):
            return []

        with patch("shared.query_service.query_executor.QueryExecutor.execute", _mock):
            async with _make_client() as client:
                response = await client.post(
                    "/api/spc/chart-data",
                    json=_valid_payload(),
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        assert response.headers["X-Data-Source"] == "view:spc_quality_metric_subgroup_mv"
        assert response.headers["X-Adapter-Mode"] == "databricks-api"
        assert response.headers["X-Query-Name"] == "spc.get_chart_data"

    async def test_missing_databricks_config_returns_503(self, monkeypatch):
        _databricks_env(monkeypatch)
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)

        async with _make_client() as client:
            response = await client.post(
                "/api/spc/chart-data",
                json=_valid_payload(),
                headers=_HEADERS_WITH_TOKEN,
            )

        assert response.status_code == 503
        assert "DATABRICKS_HOST and SQL_WAREHOUSE_ID" in response.json()["detail"]

    async def test_missing_catalog_returns_503(self, monkeypatch):
        _databricks_env(monkeypatch)
        monkeypatch.delenv("SPC_CATALOG", raising=False)
        monkeypatch.delenv("TRACE_CATALOG", raising=False)

        async with _make_client() as client:
            response = await client.post(
                "/api/spc/chart-data",
                json=_valid_payload(),
                headers=_HEADERS_WITH_TOKEN,
            )

        assert response.status_code == 503
        assert "Missing Unity Catalog identifier" in response.json()["detail"]

    async def test_missing_oauth_returns_401(self, monkeypatch):
        _databricks_env(monkeypatch)

        async with _make_client() as client:
            response = await client.post(
                "/api/spc/chart-data",
                json=_valid_payload(),
            )

        assert response.status_code == 401
        assert "OAuth token required" in response.json()["detail"]

    async def test_unknown_catalog_override_returns_400_without_execute(self, monkeypatch):
        _databricks_env(monkeypatch)

        with patch(
            "shared.query_service.query_executor.QueryExecutor.execute",
            new_callable=AsyncMock,
        ) as execute:
            async with _make_client() as client:
                response = await client.post(
                    "/api/spc/chart-data",
                    json=_valid_payload(),
                    headers={
                        **_HEADERS_WITH_TOKEN,
                        "x-databricks-catalog": "bad_catalog",
                    },
                )

        assert response.status_code == 400
        assert response.json()["detail"] == "Unsupported Databricks catalog target"
        execute.assert_not_awaited()

    async def test_blank_catalog_header_treated_as_no_override(self, monkeypatch):
        _databricks_env(monkeypatch)

        async def _mock(self_obj, spec, identity):
            return []

        with patch("shared.query_service.query_executor.QueryExecutor.execute", _mock):
            async with _make_client() as client:
                response = await client.post(
                    "/api/spc/chart-data",
                    json=_valid_payload(),
                    headers={
                        **_HEADERS_WITH_TOKEN,
                        "x-databricks-catalog": "   ",
                    },
                )

        assert response.status_code == 200

    async def test_allowlisted_catalog_override_applied_to_sql(self, monkeypatch):
        _databricks_env(monkeypatch)
        monkeypatch.setenv("DATABRICKS_ALLOWED_CATALOGS", "allowed_catalog")

        captured_sql: list[str] = []

        async def capture_execute(spec, identity):
            captured_sql.append(spec.sql)
            return []

        with patch(
            "shared.query_service.query_executor.QueryExecutor.execute",
            side_effect=capture_execute,
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/spc/chart-data",
                    json=_valid_payload(),
                    headers={
                        **_HEADERS_WITH_TOKEN,
                        "x-databricks-catalog": "allowed_catalog",
                    },
                )

        assert response.status_code == 200
        assert "`allowed_catalog`." in captured_sql[0]

    async def test_no_chart_type_skips_locked_limits_execute(self, monkeypatch):
        _databricks_env(monkeypatch)

        execute_calls: list[str] = []

        async def capture_execute(spec, identity):
            execute_calls.append(spec.name)
            return []

        with patch(
            "shared.query_service.query_executor.QueryExecutor.execute",
            side_effect=capture_execute,
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/spc/chart-data",
                    json=_valid_payload(),
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        assert execute_calls == ["spc.get_chart_data"]

    @pytest.mark.parametrize(
        "error,expected_status,expected_detail",
        [
            (DatabricksPermissionError("spc.get_chart_data"), 403, "Permission denied"),
            (DatabricksWarehouseConfigError("wh-missing"), 503, "SQL Warehouse"),
            (DatabricksQueryError("spc.get_chart_data", "bad sql"), 502, "query execution failed"),
        ],
    )
    async def test_maps_repository_errors(
        self, monkeypatch, error, expected_status, expected_detail
    ):
        _databricks_env(monkeypatch)

        with patch(
            "shared.query_service.query_executor.QueryExecutor.execute",
            new_callable=AsyncMock,
        ) as execute:
            execute.side_effect = error
            async with _make_client() as client:
                response = await client.post(
                    "/api/spc/chart-data",
                    json=_valid_payload(),
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == expected_status
        assert expected_detail in response.json()["detail"]

    @pytest.mark.parametrize(
        "error,expected_status",
        [
            (DatabricksQueryTimeoutError("spc.get_chart_data"), 504),
            (DatabricksRateLimitError("spc.get_chart_data"), 429),
        ],
    )
    async def test_maps_retryable_errors_with_three_total_attempts(
        self, monkeypatch, error, expected_status
    ):
        _databricks_env(monkeypatch)

        with (
            patch(
                "shared.query_service.query_executor.QueryExecutor.execute",
                new_callable=AsyncMock,
            ) as execute,
            patch("shared.query_service.query_executor.asyncio.sleep", new_callable=AsyncMock),
        ):
            execute.side_effect = error
            async with _make_client() as client:
                response = await client.post(
                    "/api/spc/chart-data",
                    json=_valid_payload(),
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == expected_status
        assert execute.await_count == 3

    async def test_legacy_mode_still_requires_v1_proxy(self, monkeypatch):
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        monkeypatch.delenv("V1_SPC_API_BASE_URL", raising=False)

        async with _make_client() as client:
            response = await client.post(
                "/api/spc/chart-data",
                json=_valid_payload(),
                headers=_HEADERS_WITH_TOKEN,
            )

        assert response.status_code == 503
        assert "V1_SPC_API_BASE_URL" in response.json()["detail"]


class TestSpcChartDataGuardrails:
    async def test_capability_and_signals_guardrails(self, monkeypatch):
        _databricks_env(monkeypatch)
        payload = _valid_payload()

        async def _mock(self_obj, spec, identity):
            return []

        with patch("shared.query_service.query_executor.QueryExecutor.execute", _mock):
            async with _make_client() as client:
                response = await client.post("/api/spc/chart-data", json=payload, headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 200
        data = response.json()

        # Capability guardrails
        assert data["capabilitySource"] == "unavailable"
        assert "cp" not in data
        assert "cpk" not in data

        # Signals guardrails
        assert data["signalsSource"] == "calculated-frontend"
        assert "status" not in data
        # No backend in-control decisions
        for pt in data["chartSeries"]:
            assert "status" not in pt
