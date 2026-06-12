"""Route tests for GET /api/cq/lab/fails — governed Databricks-api path.

The V1 proxy (connected_quality_lab.py) and its /api/cq/lab/plants endpoint have been
removed. Only the governed path (/api/cq/lab/fails, databricks-api mode) exists.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport
from main import app

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


_HEADERS_WITH_TOKEN = {
    "x-forwarded-access-token": "user-bearer-token",
    "x-forwarded-user": "user123",
    "x-forwarded-email": "user@example.com",
}

_EXECUTE_PATCH = "shared.query_service.databricks_client.StatementApiDatabricksClient.execute"

_FAKE_FAIL_ROW = {
    "plant_code": "C061",
    "mat_no": "100001",
    "mat": "Whey Protein Concentrate",
    "lot": "1000000001",
    "batch": "B20260601",
    "line": "LINE-01",
    "char": "MOISTURE",
    "text": "Moisture Content",
    "res": 6.5,
    "lo": 3.0,
    "hi": 5.0,
    "units": "%",
    "sev": "fail",
    "ts": "2026-06-12",
    "lot_type": "89",
}

_FAKE_WARN_ROW = {
    **_FAKE_FAIL_ROW,
    "lot": "1000000002",
    "res": 4.85,
    "sev": "warn",
}


@pytest.fixture
def quality_lab_databricks_env(monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
    monkeypatch.setenv("QUALITY_LAB_CATALOG", "connected_plant_uat")
    monkeypatch.setenv("QUALITY_LAB_SCHEMA", "gold_io_reporting")


# ---------------------------------------------------------------------------
# Mode guard: legacy-api mode must return 503
# ---------------------------------------------------------------------------

class TestLabFailsLegacyModeGuard:
    async def test_returns_503_when_legacy_api_mode(self, monkeypatch) -> None:
        """legacy-api mode must return 503 — the V1 proxy has been removed."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_mode_not_set(self, monkeypatch) -> None:
        """Default mode (no env var) is legacy-api → 503."""
        monkeypatch.delenv("BACKEND_ADAPTER_MODE", raising=False)
        async with _make_client() as client:
            response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_legacy_mode_does_not_call_databricks_client(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        called: list[bool] = []

        async def _mock_execute(*args, **kwargs):
            called.append(True)
            return []

        with patch(_EXECUTE_PATCH, _mock_execute):
            async with _make_client() as client:
                await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        assert called == []


# ---------------------------------------------------------------------------
# V1 endpoint removed: /cq/lab/plants must be 404
# ---------------------------------------------------------------------------

class TestV1PlantsEndpointRemoved:
    async def test_lab_plants_returns_404(self) -> None:
        """The V1 /cq/lab/plants endpoint has been removed; must return 404."""
        async with _make_client() as client:
            response = await client.get("/api/cq/lab/plants")
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Config guards in databricks-api mode
# ---------------------------------------------------------------------------

class TestLabFailsDatabricksConfigGuards:
    async def test_returns_503_when_databricks_host_missing(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)
        monkeypatch.setenv("QUALITY_LAB_CATALOG", "connected_plant_uat")
        async with _make_client() as client:
            response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_quality_lab_catalog_and_wh360_catalog_missing(
        self, monkeypatch
    ) -> None:
        """If neither QUALITY_LAB_CATALOG nor WH360_CATALOG is set → 503."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.delenv("QUALITY_LAB_CATALOG", raising=False)
        monkeypatch.delenv("WH360_CATALOG", raising=False)
        async with _make_client() as client:
            response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_wh360_catalog_fallback_is_accepted(self, monkeypatch) -> None:
        """WH360_CATALOG is the approved fallback when QUALITY_LAB_CATALOG absent."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.delenv("QUALITY_LAB_CATALOG", raising=False)
        monkeypatch.setenv("WH360_CATALOG", "connected_plant_uat")

        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_FAKE_FAIL_ROW]):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 200

    async def test_returns_401_when_oauth_token_missing(
        self, quality_lab_databricks_env
    ) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                # No x-forwarded-access-token
                response = await client.get("/api/cq/lab/fails")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Success responses
# ---------------------------------------------------------------------------

class TestLabFailsSuccessResponse:
    async def test_returns_200_with_fail_list(self, quality_lab_databricks_env) -> None:
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_FAKE_FAIL_ROW]
        ):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 200
        data = response.json()
        assert "fails" in data
        assert data["dataAvailable"] is True
        assert len(data["fails"]) == 1

    async def test_v1_field_names_preserved(self, quality_lab_databricks_env) -> None:
        """FailSpec V1 field names must be preserved verbatim in the response."""
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_FAKE_FAIL_ROW]
        ):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        fail = response.json()["fails"][0]
        assert fail["mat"] == "Whey Protein Concentrate"
        assert fail["matNo"] == "100001"
        assert fail["lot"] == "1000000001"
        assert fail["batch"] == "B20260601"
        assert fail["line"] == "LINE-01"
        assert fail["char"] == "MOISTURE"
        assert fail["text"] == "Moisture Content"
        assert fail["res"] == 6.5
        assert fail["lo"] == 3.0
        assert fail["hi"] == 5.0
        assert fail["units"] == "%"
        assert fail["sev"] == "fail"
        assert fail["ts"] == "2026-06-12"
        assert fail["lotType"] == "89"

    async def test_warn_severity_preserved(self, quality_lab_databricks_env) -> None:
        """sev='warn' from the gold layer must pass through unchanged."""
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_FAKE_WARN_ROW]
        ):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        fail = response.json()["fails"][0]
        assert fail["sev"] == "warn"

    async def test_optional_fields_absent_when_null(self, quality_lab_databricks_env) -> None:
        """batch, line, lo, hi are omitted when NULL (preserves V1 contract)."""
        row_no_optionals = {
            "plant_code": "C061",
            "mat_no": "100002",
            "mat": "Skim Milk Powder",
            "lot": "1000000010",
            "batch": None,
            "line": None,
            "char": "PROTEIN",
            "text": "Protein Content",
            "res": 34.5,
            "lo": None,
            "hi": None,
            "units": "%",
            "sev": "fail",
            "ts": "2026-06-12",
            "lot_type": "04",
        }
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[row_no_optionals]
        ):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        fail = response.json()["fails"][0]
        assert "batch" not in fail
        assert "line" not in fail
        assert "lo" not in fail
        assert "hi" not in fail

    async def test_empty_rows_returns_empty_fails_list(
        self, quality_lab_databricks_env
    ) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 200
        data = response.json()
        assert data["fails"] == []
        assert data["dataAvailable"] is True

    async def test_plant_id_query_param_echoed_in_response(
        self, quality_lab_databricks_env
    ) -> None:
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_FAKE_FAIL_ROW]
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/fails",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        data = response.json()
        assert data.get("plantId") == "C061"

    async def test_lot_type_query_param_echoed_in_response(
        self, quality_lab_databricks_env
    ) -> None:
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_FAKE_FAIL_ROW]
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/fails",
                    params={"lot_type": "89"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        data = response.json()
        assert data.get("lotType") == "89"

    async def test_plant_id_not_echoed_when_absent(
        self, quality_lab_databricks_env
    ) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        assert "plantId" not in response.json()

    async def test_lot_type_not_echoed_when_absent(
        self, quality_lab_databricks_env
    ) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        assert "lotType" not in response.json()

    async def test_whitespace_only_plant_id_not_echoed(
        self, quality_lab_databricks_env
    ) -> None:
        """Whitespace-only plant_id must be treated as absent — not echoed in response."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/fails",
                    params={"plant_id": "   "},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        assert "plantId" not in response.json()

    async def test_whitespace_only_lot_type_not_echoed(
        self, quality_lab_databricks_env
    ) -> None:
        """Whitespace-only lot_type must be treated as absent — not echoed in response."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/fails",
                    params={"lot_type": "  "},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        assert "lotType" not in response.json()

    async def test_padded_plant_id_stripped_and_echoed(
        self, quality_lab_databricks_env
    ) -> None:
        """plant_id with surrounding whitespace is stripped and echoed as the clean value."""
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_FAKE_FAIL_ROW]
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/fails",
                    params={"plant_id": "  C061  "},
                    headers=_HEADERS_WITH_TOKEN,
                )

        data = response.json()
        assert data.get("plantId") == "C061"

    async def test_padded_lot_type_stripped_and_echoed(
        self, quality_lab_databricks_env
    ) -> None:
        """lot_type with surrounding whitespace is stripped and echoed as the clean value."""
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_FAKE_FAIL_ROW]
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/fails",
                    params={"lot_type": " 89 "},
                    headers=_HEADERS_WITH_TOKEN,
                )

        data = response.json()
        assert data.get("lotType") == "89"


# ---------------------------------------------------------------------------
# Response headers
# ---------------------------------------------------------------------------

class TestLabFailsResponseHeaders:
    async def test_sets_x_data_source_header(self, quality_lab_databricks_env) -> None:
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_FAKE_FAIL_ROW]
        ):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        assert response.headers.get("x-data-source") == "databricks-api"

    async def test_sets_x_adapter_mode_header(self, quality_lab_databricks_env) -> None:
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_FAKE_FAIL_ROW]
        ):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_sets_x_query_name_header(self, quality_lab_databricks_env) -> None:
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_FAKE_FAIL_ROW]
        ):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        query_name = response.headers.get("x-query-name", "")
        assert "quality_lab.get_lab_fails" in query_name


# ---------------------------------------------------------------------------
# Error propagation
# ---------------------------------------------------------------------------

class TestLabFailsErrorPropagation:
    async def test_does_not_fall_back_on_databricks_error(
        self, quality_lab_databricks_env
    ) -> None:
        from shared.query_service.errors import DatabricksQueryError

        with patch(
            _EXECUTE_PATCH,
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError(
                "quality_lab.get_lab_fails", "Warehouse offline"
            ),
        ):
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 502

    async def test_plant_id_filter_binds_sql_param(self, quality_lab_databricks_env) -> None:
        """plant_id must be passed as a SQL parameter, not string-interpolated."""
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]
        ) as mock_exec:
            async with _make_client() as client:
                await client.get(
                    "/api/cq/lab/fails",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "plant_code = :plant_id" in executed_sql

    async def test_lot_type_filter_binds_sql_param(self, quality_lab_databricks_env) -> None:
        """lot_type must be passed as a SQL parameter, not string-interpolated."""
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]
        ) as mock_exec:
            async with _make_client() as client:
                await client.get(
                    "/api/cq/lab/fails",
                    params={"lot_type": "89"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "lot_type = :lot_type" in executed_sql

    async def test_days_filter_binds_sql_param(self, quality_lab_databricks_env) -> None:
        """days must be passed as a SQL parameter, not string-interpolated."""
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]
        ) as mock_exec:
            async with _make_client() as client:
                await client.get(
                    "/api/cq/lab/fails",
                    params={"days": "30"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert ":days" in executed_sql


# ---------------------------------------------------------------------------
# days param — allowed values, echo, and default ALL
# ---------------------------------------------------------------------------

class TestLabFailsDaysParam:
    async def test_days_30_echoed_in_response(self, quality_lab_databricks_env) -> None:
        """days=30 is a valid value — echoed in response."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/fails",
                    params={"days": "30"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.json().get("days") == 30

    async def test_days_180_echoed_in_response(self, quality_lab_databricks_env) -> None:
        """days=180 is a valid value — echoed in response."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/fails",
                    params={"days": "180"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.json().get("days") == 180

    async def test_days_360_echoed_in_response(self, quality_lab_databricks_env) -> None:
        """days=360 is a valid value — echoed in response."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/fails",
                    params={"days": "360"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.json().get("days") == 360

    async def test_days_absent_returns_all_no_echo(self, quality_lab_databricks_env) -> None:
        """Absent days = ALL — no days key in response, no date filter in SQL."""
        with patch(
            _EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]
        ) as mock_exec:
            async with _make_client() as client:
                response = await client.get("/api/cq/lab/fails", headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 200
        assert "days" not in response.json()
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert ":days" not in executed_sql

    async def test_days_invalid_value_returns_422(self, quality_lab_databricks_env) -> None:
        """days=90 is not in the allowed set — must return 422."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/fails",
                    params={"days": "90"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 422

    async def test_days_zero_returns_422(self, quality_lab_databricks_env) -> None:
        """days=0 is not in the allowed set — must return 422."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/fails",
                    params={"days": "0"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 422
