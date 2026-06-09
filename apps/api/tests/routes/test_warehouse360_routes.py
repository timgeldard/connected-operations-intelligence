"""Route tests for the Warehouse360 endpoints under /api/warehouse360/*."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport
from main import app

from tests.fixtures.warehouse360_contract_fixtures import warehouse360_fixture_rows

# ---------------------------------------------------------------------------
# Helpers & Headers
# ---------------------------------------------------------------------------

def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


_HEADERS_WITH_TOKEN = {
    "x-forwarded-access-token": "user-bearer-token",
    "x-forwarded-user": "user123",
    "x-forwarded-email": "user@example.com",
}

ACTIVE_GOVERNED_ROUTE_CASES = [
    (
        "/api/warehouse360/overview",
        "warehouse360.overview",
        "warehouse360.get_overview",
    ),
    (
        "/api/warehouse360/inbound",
        "warehouse360.inbound_backlog",
        "warehouse360.get_inbound",
    ),
    (
        "/api/warehouse360/outbound",
        "warehouse360.outbound_backlog",
        "warehouse360.get_outbound",
    ),
    (
        "/api/warehouse360/staging",
        "warehouse360.staging_workload",
        "warehouse360.get_staging",
    ),
    (
        "/api/warehouse360/exceptions",
        "warehouse360.im_wm_reconciliation",
        "warehouse360.get_exceptions",
    ),
]


# ---------------------------------------------------------------------------
# Databricks Environment Setup Fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def wh360_databricks_env(monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
    monkeypatch.setenv("WH360_CATALOG", "wh360_uat_catalog")
    monkeypatch.setenv("WH360_SCHEMA", "wh360_uat_schema")
    monkeypatch.setenv("WAREHOUSE360_SOURCE_MODE", "governed_contracts")


# ---------------------------------------------------------------------------
# Overview Endpoint Tests
# ---------------------------------------------------------------------------

class TestWarehouseOverviewRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/overview",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_503_when_wh360_catalog_missing(self, monkeypatch, wh360_databricks_env) -> None:
        monkeypatch.delenv("WH360_CATALOG", raising=False)
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/overview",
                params={"warehouse_id": "WH01"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503

    async def test_returns_200_with_mapped_overview(self, wh360_databricks_env) -> None:
        fake_row = {
            "orders_total": 24,
            "orders_red": 2,
            "orders_amber": 5,
            "trs_open": 9573882,
            "tos_open": 0,
            "deliveries_today": 12,
            "deliveries_at_risk": 3,
            "inbound_open": 18671,
            "bins_blocked": 16614,
            "bins_total": 352027,
            "bin_util_pct": "56.8",
        }

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[fake_row],
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/overview",
                    params={"warehouse_id": "104"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert data["warehouseId"] == "104"
        assert data["ordersTotal"] == 24
        assert data["inboundOpen"] == 18671
        assert data["binUtilPct"] == 56.8
        assert response.headers.get("x-data-source") == "databricks-api"
        assert response.headers.get("x-adapter-mode") == "databricks-api"
        assert "warehouse360.get_overview" in response.headers.get("x-query-name", "")

    async def test_returns_503_in_legacy_mode(self, monkeypatch) -> None:
        """Overview is databricks-api only — returns 503 when mode is legacy-api."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/overview",
                params={"warehouse_id": "WH01"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503

    async def test_near_expiry_count_not_in_overview_response(self, wh360_databricks_env) -> None:
        """nearExpiryCount requires a governed near-expiry rule (Gate 4) — must not
        appear as zero in the live response."""
        fake_row = {
            "orders_total": 10, "orders_red": 0, "orders_amber": 0,
            "trs_open": 0, "tos_open": 0, "deliveries_today": 0,
            "deliveries_at_risk": 0, "inbound_open": 0,
            "bins_blocked": 0, "bins_total": 0, "bin_util_pct": 0.0,
        }
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[fake_row],
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/overview",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert "nearExpiryCount" not in response.json()

    async def test_reconciliation_exception_count_not_in_overview_response(self, wh360_databricks_env) -> None:
        """reconciliationExceptionCount requires governed IM/WM reconciliation rules (Gate 5)
        — must not appear as zero in the live response."""
        fake_row = {
            "orders_total": 10, "orders_red": 0, "orders_amber": 0,
            "trs_open": 0, "tos_open": 0, "deliveries_today": 0,
            "deliveries_at_risk": 0, "inbound_open": 0,
            "bins_blocked": 0, "bins_total": 0, "bin_util_pct": 0.0,
        }
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=[fake_row],
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/overview",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert "reconciliationExceptionCount" not in response.json()


class TestWarehouse360GovernedContractRoutes:
    @pytest.mark.parametrize(
        "path,contract_id,query_name",
        ACTIVE_GOVERNED_ROUTE_CASES,
    )
    async def test_governed_contract_mode_sets_contract_id_header(
        self,
        wh360_databricks_env,
        path,
        contract_id,
        query_name,
    ) -> None:
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=warehouse360_fixture_rows(contract_id),
        ) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    path,
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        assert response.headers.get("x-contract-id") == contract_id
        assert response.headers.get("x-query-name") == query_name
        _, kwargs = mock_exec.call_args
        assert kwargs["tags"]["contract_id"] == contract_id




# ---------------------------------------------------------------------------
# Inbound Endpoint Tests
# ---------------------------------------------------------------------------

class TestWarehouseInboundRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/inbound",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_200_with_mapped_inbound_items(self, wh360_databricks_env) -> None:
        # Row shape matches actual wh360_inbound_v columns
        # (verified in docs/data-layer/warehouse360-inbound-source-verification.md).
        fake_rows = [
            {
                "po_id": "0045001234",
                "po_item": "00010",
                "doc_type": "PO",
                "doc_cat": "F",
                "vendor_id": "0008100123",
                "vendor_name": "Dairy Supplier Ltd",
                "plant_id": "IE10",
                "storage_loc": "SL01",
                "material_id": "000000000000821034",
                "material_name": "Raw Milk",
                "ordered_qty": 25000.0,
                "gr_qty": 0.0,
                "open_qty": 25000.0,
                "uom": "L",
                "delivery_date": "2026-05-18",
                "po_date": "2026-05-10",
                "delivery_complete": "N",
                "qa_lot_id": None,
                "qa_status": None,
            }
        ]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/inbound",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        assert item["documentType"] == "PO"
        assert item["purchaseOrderId"] == "0045001234"
        assert item["materialId"] == "000000000000821034"
        assert item["quantity"] == 25000.0
        assert item["unitOfMeasure"] == "L"
        # Document status derived from delivery_complete (not invented).
        assert item["status"] == "open"
        # Source-truthful absence of fields the view does not carry.
        assert item["warehouseNumber"] is None
        assert item["stockTransportOrderId"] is None
        assert item["supplyingPlantId"] is None
        assert item["exceptionReason"] is None
        assert item["batchId"] is None
        assert response.headers.get("x-query-name") == "warehouse360.get_inbound"


# ---------------------------------------------------------------------------
# Outbound Endpoint Tests
# ---------------------------------------------------------------------------

class TestWarehouseOutboundRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/outbound",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_200_with_mapped_outbound_items(self, wh360_databricks_env) -> None:
        # Row shape mirrors actual wh360_deliveries_v columns (verified
        # live 2026-05-25 — see source-verification doc §3).
        fake_rows = [
            {
                "delivery_id": "0080047212",
                "delivery_type": "LF",
                "plant_id": "IE10",
                "customer_id": "0003829100",
                "customer_name": "Acme Foods Ltd",
                "carrier": "DHL",
                "lgnum": "WH01",
                "planned_gi_date": "2026-05-18 15:00:00",
                "actual_gi_date": None,
                "loading_date": "2026-05-18 14:00:00",
                "delivery_date": "2026-05-19",
                "gross_weight": 960.0,
                "weight_uom": "KG",
                "packages": "12",
                "wm_status": "OPEN",
                "mins_to_cutoff": 90.0,
                "pick_pct": 0.85,
                "line_count": 3,
                "risk": "amber",
                "shipped": False,
            }
        ]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/outbound",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        # Header-grain identifiers preserved.
        assert item["deliveryId"] == "0080047212"
        assert item["customerId"] == "0003829100"
        assert item["plantId"] == "IE10"
        assert item["warehouseNumber"] == "WH01"
        assert item["plannedGoodsIssueDate"] == "2026-05-18T15:00:00"
        assert item["quantity"] == 960.0
        assert item["unitOfMeasure"] == "KG"
        assert item["status"] == "OPEN"
        # Line-grain fields absent from the delivery-header view stay null
        # rather than being faked.
        assert item["deliveryItemId"] is None
        assert item["salesOrderId"] is None
        assert item["materialDescription"] is None
        assert item["batchId"] is None
        assert item["storageLocation"] is None
        assert item["exceptionReason"] is None
        # Contract requires materialId: str — header-grain source has none.
        # Empty string keeps the response body shape stable; see
        # source-verification doc §5.
        assert item["materialId"] == ""
        assert response.headers.get("x-query-name") == "warehouse360.get_outbound"


# ---------------------------------------------------------------------------
# Staging Endpoint Tests
# ---------------------------------------------------------------------------

class TestWarehouseStagingRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/staging",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_200_with_mapped_staging_items(self, wh360_databricks_env) -> None:
        # Row shape matches actual wh360_process_orders_v columns
        # (verified in docs/data-layer/warehouse360-staging-source-verification.md).
        fake_rows = [
            {
                "order_id": "000700123456",
                "sap_order": "PROD-700123456",
                "reservation_no": "0000123456",
                "material_id": "000000000000840123",
                "material_name": "Starter Culture",
                "batch_id": "0000987654",
                "plant_id": "IE10",
                "uom": "KG",
                "order_qty": 2.5,
                "planned_start": "2026-05-18 08:30:00",
                "planned_finish": "2026-05-18 18:30:00",
                "sched_start": "2026-05-18 08:30:00",
                "sched_finish": "2026-05-18 18:30:00",
                "staging_pct": 0.8,
                "to_items_total": 5,
                "to_items_done": 4,
                "mins_to_start": 120,
                "risk": "low",
            }
        ]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/staging",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        # sap_order is preferred over order_id per source-verification §3.1.
        assert item["processOrderId"] == "PROD-700123456"
        assert item["reservationId"] == "0000123456"
        assert item["materialId"] == "000000000000840123"
        assert item["materialDescription"] == "Starter Culture"
        assert item["batchId"] == "0000987654"
        assert item["plantId"] == "IE10"
        assert item["unitOfMeasure"] == "KG"
        assert item["requiredQuantity"] == 2.5
        # Derived from order_qty * staging_pct: 2.5 * 0.8 = 2.0
        assert item["stagedQuantity"] == 2.0
        # Derived: 2.5 * 0.2 = 0.5
        assert item["openQuantity"] == 0.5
        # Derived from staging_pct < 1.0 -> 'open' (application-heuristic).
        assert item["stagingStatus"] == "open"
        # Source-truthful absence of fields wh360_process_orders_v doesn't carry.
        assert item["warehouseNumber"] is None
        assert item["reservationItemId"] is None
        assert item["storageLocation"] is None
        assert item["exceptionReason"] is None
        assert response.headers.get("x-query-name") == "warehouse360.get_staging"


# ---------------------------------------------------------------------------
# Exceptions Endpoint Tests
# ---------------------------------------------------------------------------

class TestWarehouseExceptionsRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/exceptions",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_200_with_mapped_exceptions(self, wh360_databricks_env) -> None:
        # Row shape matches actual imwm_exceptions_v columns
        # (verified in docs/data-layer/warehouse360-imwm-exceptions-source-verification.md).
        fake_rows = [
            {
                "exception_type": "EXPIRED_BATCH_WITH_STOCK",
                "severity": 2,  # integer per source — no governed int->enum mapping
                "sla_hours": 24,
                "material_id": "MAT01",
                "material_name": "Cheese Block",
                "plant_id": "IE10",
                "storage_loc": "SL01",
                "storage_loc_name": "Cold Store 1",
                "qty": 20.0,
                "batch_id": "B01",
                "bin_id": "BIN-A1",
                "detail_text": "Stock recorded for expired batch",
                "detected_date": "2026-05-22",
            }
        ]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/exceptions",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        # source-truthful: no governed int->enum mapping, severity is null.
        assert item["severity"] is None
        assert item["exceptionType"] == "EXPIRED_BATCH_WITH_STOCK"
        assert item["materialId"] == "MAT01"
        assert item["batchId"] == "B01"
        assert item["plantId"] == "IE10"
        assert item["storageLocation"] == "SL01"
        assert item["quantity"] == 20.0
        # Reason is the source detail_text.
        assert item["reason"] == "Stock recorded for expired batch"
        # Source-truthful absence of fields imwm_exceptions_v doesn't carry.
        assert item["warehouseNumber"] is None
        assert item["unitOfMeasure"] is None
        assert item["expiryDate"] is None
        assert item["daysToExpiry"] is None
        assert item["documentId"] is None
        assert item["processOrderId"] is None
        assert item["deliveryId"] is None
        assert item["purchaseOrderId"] is None
        # recommendedReviewAction stays null until a governed rule exists.
        assert item["recommendedReviewAction"] is None
        assert response.headers.get("x-query-name") == "warehouse360.get_exceptions"

    async def test_returns_502_on_databricks_query_error(self, wh360_databricks_env) -> None:
        from shared.query_service.errors import DatabricksQueryError

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("warehouse360.get_exceptions", "Warehouse failed"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/exceptions",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 502


class TestWarehouseStockExceptionsRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/stock-exceptions",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_200_with_mapped_stock_exceptions(self, wh360_databricks_env) -> None:
        fake_rows = [
            {
                "plant_id": "IE10",
                "material_id": "MAT01",
                "batch_id": "B01",
                "exception_type": "EXPIRED",
                "qty": 10.5,
                "minimum_days_to_expiry": -5,
                "has_minimum_shelf_life_breach": True
            }
        ]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/stock-exceptions",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        assert item["plantId"] == "IE10"
        assert item["materialId"] == "MAT01"
        assert item["batchId"] == "B01"
        assert item["exceptionType"] == "EXPIRED"
        assert item["qty"] == 10.5
        assert item["minimumDaysToExpiry"] == -5
        assert item["hasMinimumShelfLifeBreach"] is True
        assert response.headers.get("x-query-name") == "warehouse360.get_stock_exceptions"

    async def test_returns_502_on_databricks_query_error(self, wh360_databricks_env) -> None:
        from shared.query_service.errors import DatabricksQueryError

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("warehouse360.get_stock_exceptions", "Warehouse failed"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/stock-exceptions",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 502


class TestWarehouseShortfallsRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/shortfalls",
                params={"warehouse_id": "WH01"},
            )
        assert response.status_code == 401

    async def test_returns_200_with_mapped_shortfalls(self, wh360_databricks_env) -> None:
        fake_rows = [
            {
                "plant_id": "IE10",
                "material_id": "MAT01",
                "shortfall_qty": 500.0,
                "open_items_count": 5,
                "oldest_tr_date": "2026-05-10"
            }
        ]

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/shortfalls",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        assert item["plantId"] == "IE10"
        assert item["materialId"] == "MAT01"
        assert item["shortfallQty"] == 500.0
        assert item["openItemsCount"] == 5
        assert item["oldestTrDate"] == "2026-05-10"
        assert response.headers.get("x-query-name") == "warehouse360.get_shortfalls"

    async def test_returns_502_on_databricks_query_error(self, wh360_databricks_env) -> None:
        from shared.query_service.errors import DatabricksQueryError

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("warehouse360.get_shortfalls", "Warehouse failed"),
        ):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/shortfalls",
                    params={"warehouse_id": "WH01"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 502


class TestWarehouse360ParameterValidation:
    async def test_empty_warehouse_id_returns_422(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/overview",
                params={"warehouse_id": "   "},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422
        assert "warehouse_id cannot be empty" in response.json()["detail"]

    async def test_limit_out_of_bounds_low_returns_422(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/inbound",
                params={"warehouse_id": "WH01", "limit": 0},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422
        assert "limit must be between 1 and 500" in response.json()["detail"]

    async def test_limit_out_of_bounds_high_returns_422(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/outbound",
                params={"warehouse_id": "WH01", "limit": 501},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422
        assert "limit must be between 1 and 500" in response.json()["detail"]

    async def test_successful_filtering_params_forwarding(self, wh360_databricks_env) -> None:
        fake_rows = []
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            return_value=fake_rows,
        ) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/inbound",
                    params={
                        "warehouse_id": "WH01",
                        "plant_id": "PL10",
                        "date_from": "2026-05-01",
                        "date_to": "2026-05-31",
                        "limit": 150,
                    },
                    headers=_HEADERS_WITH_TOKEN,
                )
            assert response.status_code == 200
            # Verify the QuerySpec execution received the correct filtered parameters
            mock_exec.assert_called_once()
            args, kwargs = mock_exec.call_args
            kwargs.get("sql") or args[0]
            called_params = kwargs.get("params") or args[1]
            assert called_params["plant_id"] == "PL10"
            assert called_params["date_from"] == "2026-05-01"
            assert called_params["date_to"] == "2026-05-31"


class TestWarehouse360ResponseModelEnforcement:
    """Verify response_model is wired for inbound/outbound/staging/exceptions via OpenAPI schema."""

    async def _get_route_schema_ref(self, path: str) -> str | None:
        async with _make_client() as client:
            resp = await client.get("/openapi.json")
        schema = resp.json()
        path_item = schema["paths"].get(path, {})
        resp_200 = path_item.get("get", {}).get("responses", {}).get("200", {})
        items = resp_200.get("content", {}).get("application/json", {}).get("schema", {}).get("items", {})
        return items.get("$ref")

    async def test_inbound_response_model_is_wired(self) -> None:
        ref = await self._get_route_schema_ref("/api/warehouse360/inbound")
        assert ref is not None and "Warehouse360InboundItem" in ref

    async def test_outbound_response_model_is_wired(self) -> None:
        ref = await self._get_route_schema_ref("/api/warehouse360/outbound")
        assert ref is not None and "Warehouse360OutboundItem" in ref

    async def test_staging_response_model_is_wired(self) -> None:
        ref = await self._get_route_schema_ref("/api/warehouse360/staging")
        assert ref is not None and "Warehouse360StagingItem" in ref

    async def test_exceptions_response_model_is_wired(self) -> None:
        ref = await self._get_route_schema_ref("/api/warehouse360/exceptions")
        assert ref is not None and "Warehouse360ExceptionItem" in ref

    async def test_stock_exceptions_response_model_is_wired(self) -> None:
        ref = await self._get_route_schema_ref("/api/warehouse360/stock-exceptions")
        assert ref is not None and "Warehouse360StockExceptionItem" in ref

    async def test_shortfalls_response_model_is_wired(self) -> None:
        ref = await self._get_route_schema_ref("/api/warehouse360/shortfalls")
        assert ref is not None and "Warehouse360ShortfallItem" in ref

