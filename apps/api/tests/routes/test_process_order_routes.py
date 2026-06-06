"""Route tests for POST /api/por/order-header — legacy-api and databricks-api modes."""
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
    "x-forwarded-email": "user@example.com",
}

_FAKE_ROW = {
    "process_order_id": "000000100001",
    "order_type": "PI01",
    "material_id": "000000000000001234",
    "material_description": "Test Product",
    "plant_id": "IE01",
    "planned_quantity": 100.0,
    "confirmed_quantity": 0.0,
    "uom": "KG",
    "planned_start": "2024-01-15T06:00:00",
    "planned_finish": "2024-01-15T18:00:00",
    "order_status_raw": "REL",
}


# ---------------------------------------------------------------------------
# Legacy-api mode (default)
# ---------------------------------------------------------------------------

class TestOrderHeaderLegacyMode:
    async def test_returns_503_when_v1_url_not_configured(self) -> None:
        """V1_POH_API_BASE_URL is not set in test env — must return 503."""
        async with _make_client() as client:
            response = await client.post(
                "/api/por/order-header",
                json={"process_order_id": "100001"},
            )
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
                # Will 503 because V1 URL not set — but databricks client must not be called
                await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "100001"},
                )

        assert called == []


# ---------------------------------------------------------------------------
# Databricks-api mode
# ---------------------------------------------------------------------------

class TestOrderHeaderDatabricksMode:
    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")

    async def test_returns_503_when_databricks_host_missing(
        self, monkeypatch
    ) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)

        async with _make_client() as client:
            response = await client.post(
                "/api/por/order-header",
                json={"process_order_id": "100001"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503
        assert "DATABRICKS_HOST" in response.json()["detail"]

    async def test_returns_503_when_warehouse_id_missing(
        self, monkeypatch
    ) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)

        async with _make_client() as client:
            response = await client.post(
                "/api/por/order-header",
                json={"process_order_id": "100001"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503

    async def test_returns_503_when_poh_catalog_missing(self, monkeypatch) -> None:
        """DatabricksConfigError from missing POH_CATALOG must map to 503."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.delenv("POH_CATALOG", raising=False)

        async with _make_client() as client:
            response = await client.post(
                "/api/por/order-header",
                json={"process_order_id": "100001"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503

    async def test_legacy_api_mode_does_not_require_poh_catalog(self, monkeypatch) -> None:
        """legacy-api mode must not require POH_CATALOG."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        monkeypatch.delenv("POH_CATALOG", raising=False)
        # No V1 URL configured — 503 from V1, not from catalog check
        async with _make_client() as client:
            response = await client.post(
                "/api/por/order-header",
                json={"process_order_id": "100001"},
            )
        assert response.status_code == 503  # 503 = V1 URL missing, not catalog missing

    async def test_returns_401_when_oauth_token_missing(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "100001"},
                    # No x-forwarded-access-token header
                )
        assert response.status_code == 401

    async def test_returns_404_when_no_rows(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "NOTEXIST"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 404

    async def test_returns_200_with_mapped_data(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_ROW],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert data["processOrderId"] == "000000100001"
        assert data["materialId"] == "000000000000001234"
        assert data["plantId"] == "IE01"
        assert data["orderStatus"] == "released"

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_ROW],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.headers.get("x-data-source") == "databricks-api"

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_ROW],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_sets_x_query_name_header(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_ROW],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.headers.get("x-query-name") is not None
        assert "process_order_header" in response.headers.get("x-query-name", "")

    async def test_source_is_databricks_api(self, monkeypatch) -> None:
        """Source badge on the POH spec must be 'databricks-api'."""
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")
        from adapters.poh.poh_databricks_adapter import (
            ProcessOrderHeaderRequest,
            get_process_order_header_spec,
        )
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.source_badge == "databricks-api"

    async def test_uses_process_order_id_from_request(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)

        captured_sql_params: list[dict] = []

        async def capture_execute(self_inner, *, sql, params, oauth_token, **kwargs):
            captured_sql_params.append(params)
            return [_FAKE_ROW]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            capture_execute,
        ):
            async with _make_client() as client:
                await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "999888"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert captured_sql_params[0]["process_order_id"] == "999888"

    async def test_does_not_fall_back_to_legacy_on_query_error(
        self, monkeypatch
    ) -> None:
        from shared.query_service.errors import DatabricksQueryError

        self._databricks_env(monkeypatch)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("test.query", "Warehouse down"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        # Must return 502 — not fall back to 503 (legacy) or 200 (mock)
        assert response.status_code == 502


# ---------------------------------------------------------------------------
# POST /api/por/order-header — response_model contract enforcement
# ---------------------------------------------------------------------------

class TestOrderHeaderResponseModel:
    """Prove that POST /api/por/order-header is enforced through the
    generated ProcessOrderHeader contract."""

    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")

    async def test_response_validates_against_generated_contract(self, monkeypatch) -> None:
        from contracts.generated import ProcessOrderHeader

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_ROW],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        # Round-trip through the generated model with extra='forbid' — a
        # non-contract field leaking into the response would raise here.
        ProcessOrderHeader.model_validate(response.json())

    async def test_response_uses_camelcase_aliases(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_ROW],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        data = response.json()
        for key in (
            "processOrderId", "orderType", "materialId", "materialDescription",
            "plantId", "plannedQuantity", "confirmedQuantity", "uom", "orderStatus",
        ):
            assert key in data, f"missing required contract field: {key}"
        # No snake_case leakage from the SQL column names.
        for snake in ("process_order_id", "material_id", "plant_id", "order_status", "inspection_lot_id"):
            assert snake not in data
        # inspectionLotId is not part of the ProcessOrderHeader contract.
        assert "inspectionLotId" not in data

    async def test_status_enums_match_contract(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[_FAKE_ROW],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        data = response.json()
        assert data["orderType"] in {
            "process-order", "production-order", "maintenance-order", "planned-order",
        }
        assert data["orderStatus"] in {
            "created", "released", "in-process", "confirmed",
            "partially-confirmed", "closed", "cancelled", "unknown",
        }

    async def test_no_unsafe_release_or_completion_claims(self, monkeypatch) -> None:
        """The view does not return planned/confirmed quantities or dates;
        the mapper defaults them to zero/None. The response must never carry
        invented business decisions like 'safe', 'approved', or 'complete'."""
        self._databricks_env(monkeypatch)
        # Row that mimics a real SAP STATUS that does NOT include any
        # completion-related token — exercise the conservative branch.
        row_unknown_status = {**_FAKE_ROW, "order_status_raw": ""}
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[row_unknown_status],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        data = response.json()
        # No invented fields outside the contract.
        for forbidden in ("safe", "approved", "released", "complete", "onTime", "onTrack", "recallRecommended"):
            assert forbidden not in data
        # Empty STATUS must not auto-promote to 'confirmed' / 'closed' /
        # 'created' (the old reassuring default). Source-truthful: 'unknown'.
        assert data["orderStatus"] == "unknown"
        assert data["orderStatus"] not in {"confirmed", "partially-confirmed", "closed", "created"}

    async def test_inspection_lot_id_is_stripped_from_response(self, monkeypatch) -> None:
        """The SQL fetches INSPECTION_LOT_ID but ProcessOrderHeader does not
        model it (it belongs to OrderQualityContext). The mapper drops it so
        response_model serialization does not 500 on extra='forbid'."""
        self._databricks_env(monkeypatch)
        row_with_lot = {**_FAKE_ROW, "inspection_lot_id": "LOT001"}
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[row_with_lot],
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-header",
                    json={"process_order_id": "000000100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert "inspectionLotId" not in response.json()


# ---------------------------------------------------------------------------
# GET /api/por/order-operations — databricks-api only
# ---------------------------------------------------------------------------

_FAKE_OPS_ROWS = [
    {
        "operation_id": "PHASE-001",
        "operation_number": "0010",
        "operation_text": "Milk Standardisation",
        "operation_detail": "Standardise milk fat content",
        "planned_quantity": 1000.0,
        "uom": "L",
        "sort_number": 10,
        "start_user": "USER01",
        "end_user": "USER01",
    },
]


class TestOrderOperationsDatabricksMode:
    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")

    async def test_returns_503_in_legacy_mode(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/por/order-operations",
                params={"process_order_id": "100001"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503
        assert "databricks-api" in response.json()["detail"]

    async def test_returns_503_when_databricks_host_missing(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)
        async with _make_client() as client:
            response = await client.get(
                "/api/por/order-operations",
                params={"process_order_id": "100001"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503

    async def test_returns_401_when_oauth_token_missing(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-operations",
                    params={"process_order_id": "100001"},
                    # No x-forwarded-access-token
                )
        assert response.status_code == 401

    async def test_returns_empty_list_when_no_rows(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[],
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-operations",
                    params={"process_order_id": "NOTEXIST"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.json() == []

    async def test_returns_200_with_mapped_operations(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=_FAKE_OPS_ROWS,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-operations",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["operationId"] == "PHASE-001"
        assert data[0]["operationNumber"] == "0010"
        assert data[0]["operationText"] == "Milk Standardisation"
        assert data[0]["status"] == "confirmed"
        assert data[0]["confirmed"] is True

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=_FAKE_OPS_ROWS,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-operations",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.headers.get("x-data-source") == "databricks-api"
        assert response.headers.get("x-adapter-mode") == "databricks-api"
        assert response.headers.get("x-query-name") == "poh.get_order_operations"

    async def test_does_not_fall_back_on_query_error(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("test.query", "Warehouse down"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-operations",
                    params={"process_order_id": "100001"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        # Must return 502 — not fall back to legacy or mock
        assert response.status_code == 502

    async def test_uses_process_order_id_from_query_param(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        captured: list[dict] = []

        async def capture_execute(self_inner, *, sql, params, oauth_token, **kwargs):
            captured.append(params)
            return []

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            capture_execute,
        ):
            async with _make_client() as client:
                await client.get(
                    "/api/por/order-operations",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert captured[0]["process_order_id"] == "7006965038"


# ---------------------------------------------------------------------------
# GET /api/por/order-confirmations — databricks-api only
# ---------------------------------------------------------------------------

_FAKE_CONF_ROWS = [
    {
        "confirmation_id": "CONF-001",
        "operation_id": "PHASE-001",
        "confirmed_yield": 950.0,
        "uom": "KG",
        "confirmed_at": "2024-03-08T08:00:00Z",
        "setup_duration_s": 900,       # 15 minutes x 60
        "machine_duration_s": 7200,    # 120 minutes x 60
        "cleaning_duration_s": None,
    },
]


class TestOrderConfirmationsDatabricksMode:
    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")

    async def test_returns_503_in_legacy_mode(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/por/order-confirmations",
                params={"process_order_id": "7006965038"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503
        assert "databricks-api" in response.json()["detail"]

    async def test_returns_503_when_databricks_host_missing(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)
        async with _make_client() as client:
            response = await client.get(
                "/api/por/order-confirmations",
                params={"process_order_id": "7006965038"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503

    async def test_returns_401_when_oauth_token_missing(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-confirmations",
                    params={"process_order_id": "7006965038"},
                    # No x-forwarded-access-token
                )
        assert response.status_code == 401

    async def test_returns_empty_list_when_no_rows(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[],
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-confirmations",
                    params={"process_order_id": "NOTEXIST"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.json() == []

    async def test_returns_200_with_mapped_confirmations(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=_FAKE_CONF_ROWS,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-confirmations",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["confirmationId"] == "CONF-001"
        assert data[0]["operationId"] == "PHASE-001"
        assert data[0]["confirmedYield"] == 950.0
        assert data[0]["uom"] == "KG"
        assert data[0]["setupDurationMinutes"] == 15.0
        assert data[0].get("cleaningDurationMinutes") is None

    async def test_sets_databricks_response_headers(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=_FAKE_CONF_ROWS,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-confirmations",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.headers.get("x-data-source") == "databricks-api"
        assert response.headers.get("x-adapter-mode") == "databricks-api"
        assert response.headers.get("x-query-name") == "poh.get_order_confirmations"

    async def test_does_not_fall_back_on_query_error(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("poh.get_order_confirmations", "Warehouse down"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-confirmations",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 502

    async def test_returns_403_on_permission_error(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksPermissionError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksPermissionError("poh.get_order_confirmations"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-confirmations",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 403

    async def test_returns_429_on_rate_limit(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksRateLimitError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksRateLimitError("poh.get_order_confirmations"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-confirmations",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 429

    async def test_returns_504_on_timeout(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryTimeoutError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryTimeoutError("poh.get_order_confirmations"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-confirmations",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 504

    async def test_token_not_in_error_response(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("poh.get_order_confirmations", "some error"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-confirmations",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert "user-bearer-token" not in response.text


# ---------------------------------------------------------------------------
# GET /api/por/order-goods-movements — databricks-api only
# ---------------------------------------------------------------------------

_FAKE_MOVEMENT_ROWS = [
    {
        "movement_id": "GM-001",
        "movement_type": "261",
        "material_id": "000000000020052009",
        "quantity": 500.0,
        "uom": "KG",
        "posted_at": "2024-03-08T06:30:00Z",
        "batch_id": "0008602411",
        "posted_by": "user@kerry.com",
        "reference_document": "MAT-DOC-001",
        "storage_location": "SL-001",
    },
    {
        "movement_id": "GM-002",
        "movement_type": "711",
        "material_id": "000000000020052009",
        "quantity": 10.0,
        "uom": "KG",
        "posted_at": "2024-03-08T09:00:00Z",
        "batch_id": None,
        "posted_by": None,
        "reference_document": None,
        "storage_location": None,
    },
]


class TestOrderGoodsMovementsDatabricksMode:
    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")

    async def test_returns_503_in_legacy_mode(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/por/order-goods-movements",
                params={"process_order_id": "7006965038"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503
        assert "databricks-api" in response.json()["detail"]

    async def test_returns_503_when_databricks_host_missing(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)
        async with _make_client() as client:
            response = await client.get(
                "/api/por/order-goods-movements",
                params={"process_order_id": "7006965038"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503

    async def test_returns_401_when_oauth_token_missing(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-goods-movements",
                    params={"process_order_id": "7006965038"},
                    # No x-forwarded-access-token
                )
        assert response.status_code == 401

    async def test_returns_empty_list_when_no_rows(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[],
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-goods-movements",
                    params={"process_order_id": "NOTEXIST"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.json() == []

    async def test_returns_200_with_mapped_movements(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=_FAKE_MOVEMENT_ROWS,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-goods-movements",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        assert data[0]["movementId"] == "GM-001"
        assert data[0]["direction"] == "input"
        assert data[0]["materialId"] == "000000000020052009"

    async def test_unknown_movement_type_returns_unknown_direction(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=_FAKE_MOVEMENT_ROWS,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-goods-movements",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        data = response.json()
        assert data[1]["direction"] == "unknown"

    async def test_sets_databricks_response_headers(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=_FAKE_MOVEMENT_ROWS,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-goods-movements",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.headers.get("x-data-source") == "databricks-api"
        assert response.headers.get("x-adapter-mode") == "databricks-api"
        assert response.headers.get("x-query-name") == "poh.get_order_goods_movements"

    async def test_does_not_fall_back_on_query_error(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("poh.get_order_goods_movements", "Warehouse down"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-goods-movements",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 502

    async def test_returns_403_on_permission_error(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksPermissionError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksPermissionError("poh.get_order_goods_movements"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-goods-movements",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 403

    async def test_returns_429_on_rate_limit(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksRateLimitError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksRateLimitError("poh.get_order_goods_movements"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-goods-movements",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 429

    async def test_returns_504_on_timeout(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryTimeoutError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryTimeoutError("poh.get_order_goods_movements"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-goods-movements",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 504

    async def test_token_not_in_error_response(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryError

        self._databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("poh.get_order_goods_movements", "some error"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/por/order-goods-movements",
                    params={"process_order_id": "7006965038"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert "user-bearer-token" not in response.text


# ---------------------------------------------------------------------------
# POST /api/por/order-search — databricks-api only
# ---------------------------------------------------------------------------

class TestProcessOrderSearch:
    def _databricks_env(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "https://mock.cloud.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "mock-warehouse-id")
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")

    async def test_returns_503_in_legacy_api_mode(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(
                "/api/por/order-search",
                json={"query": "block"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503
        assert "Process order search requires BACKEND_ADAPTER_MODE=databricks-api" in response.json()["detail"]

    async def test_returns_401_on_missing_auth(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        async with _make_client() as client:
            response = await client.post(
                "/api/por/order-search",
                json={"query": "block"},
            )
        assert response.status_code == 401

    async def test_returns_mapped_search_items_on_success(self, monkeypatch) -> None:
        self._databricks_env(monkeypatch)
        fake_rows = [
            {
                "process_order_id": "PO-1000",
                "order_status_raw": "RELEASED",
                "material_id": "MAT-01",
                "material_description": "Mock Material 1",
                "plant_id": "C113",
                "inspection_lot_id": "LOT-01",
                "order_id_match": 0,
                "material_id_match": 0,
                "description_match": 1,
            }
        ]
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ):
            async with _make_client() as client:
                response = await client.post(
                    "/api/por/order-search",
                    json={"query": "Mock"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) == 1
        item = data["items"][0]
        assert item["processOrderId"] == "PO-1000"
        assert item["materialId"] == "MAT-01"
        assert item["plantId"] == "C113"
        assert item["orderStatus"] == "released"
        assert "description" in item["matchTypes"]

