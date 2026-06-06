"""Route tests for GET /api/cq/lab/plants — legacy-api and databricks-api modes."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
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
}

_FAKE_PLANT_ROWS = [
    {"plant_id": "IE01", "plant_name": "Kerry Charleville"},
    {"plant_id": "IE02", "plant_name": "Kerry Listowel"},
]


# ---------------------------------------------------------------------------
# Legacy-api mode (default)
# ---------------------------------------------------------------------------

class TestLabPlantsLegacyMode:
    async def test_returns_503_when_v1_url_not_configured(self) -> None:
        async with _make_client() as client:
            response = await client.get("/api/cq/lab/plants")
        assert response.status_code == 503

    async def test_legacy_mode_does_not_call_databricks_client(
        self, monkeypatch
    ) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        called: list[bool] = []

        async def _mock_execute(*args, **kwargs):
            called.append(True)
            return []

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock_execute,
        ):
            async with _make_client() as client:
                await client.get("/api/cq/lab/plants")

        assert called == []


# ---------------------------------------------------------------------------
# Databricks-api mode
# ---------------------------------------------------------------------------

class TestLabPlantsDatabricksMode:
    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("CQ_CATALOG", "connected_plant_uat")

    async def test_returns_503_when_databricks_config_missing(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)

        async with _make_client() as client:
            response = await client.get(
                "/api/cq/lab/plants", headers=_HEADERS_WITH_TOKEN
            )
        assert response.status_code == 503

    async def test_returns_503_when_cq_catalog_missing(self, monkeypatch) -> None:
        """DatabricksConfigError from missing CQ_CATALOG must map to 503."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.delenv("CQ_CATALOG", raising=False)
        monkeypatch.delenv("TRACE_CATALOG", raising=False)

        async with _make_client() as client:
            response = await client.get(
                "/api/cq/lab/plants", headers=_HEADERS_WITH_TOKEN
            )
        assert response.status_code == 503

    async def test_legacy_api_mode_does_not_require_cq_catalog(self, monkeypatch) -> None:
        """legacy-api mode must not require CQ_CATALOG."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        monkeypatch.delenv("CQ_CATALOG", raising=False)
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        # No V1 URL configured — 503 from V1, not from catalog check
        async with _make_client() as client:
            response = await client.get("/api/cq/lab/plants")
        assert response.status_code == 503  # 503 = V1 URL missing, not catalog missing

    async def test_returns_401_when_oauth_token_missing(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/plants"
                    # No x-forwarded-access-token
                )
        assert response.status_code == 401

    async def test_returns_200_with_plants_list(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=_FAKE_PLANT_ROWS,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/plants", headers=_HEADERS_WITH_TOKEN
                )

        assert response.status_code == 200
        data = response.json()
        assert "plants" in data
        assert len(data["plants"]) == 2
        assert data["plants"][0]["plantId"] == "IE01"
        assert data["plants"][0]["plantName"] == "Kerry Charleville"

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=_FAKE_PLANT_ROWS,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/plants", headers=_HEADERS_WITH_TOKEN
                )

        assert response.headers.get("x-data-source") == "databricks-api"

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=_FAKE_PLANT_ROWS,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/plants", headers=_HEADERS_WITH_TOKEN
                )

        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_sets_x_query_name_header(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=_FAKE_PLANT_ROWS,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/plants", headers=_HEADERS_WITH_TOKEN
                )

        assert response.headers.get("x-query-name") is not None
        assert "lab_plants" in response.headers.get("x-query-name", "")

    async def test_empty_rows_returns_empty_plants_list(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[],
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/plants", headers=_HEADERS_WITH_TOKEN
                )

        assert response.status_code == 200
        assert response.json() == {"plants": []}

    async def test_does_not_fall_back_on_databricks_error(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryError

        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("cq.get_lab_plants", "Warehouse offline"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/cq/lab/plants", headers=_HEADERS_WITH_TOKEN
                )

        assert response.status_code == 502


# ---------------------------------------------------------------------------
# lab_fails always stays legacy-api
# ---------------------------------------------------------------------------

class TestLabFailsAlwaysLegacy:
    async def test_lab_fails_returns_503_not_404_in_databricks_mode(
        self, monkeypatch
    ) -> None:
        """Even in databricks-api mode, /cq/lab/fails must use legacy-api (blocked)."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")

        async with _make_client() as client:
            response = await client.get("/api/cq/lab/fails")

        # 503 because V1_CQ_API_BASE_URL is not set — not 404 or databricks path
        assert response.status_code == 503
