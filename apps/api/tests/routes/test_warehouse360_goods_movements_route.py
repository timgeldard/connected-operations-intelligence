"""Route tests for /api/warehouse360/goods-movements — mandatory cost controls.

The movements feed reads the MSEG-grain gold_goods_movement_activity table; the plan
(section 5) requires that no unbounded query path exists: queries without a date window
default to the previous day, windows > 31 days are rejected with 400, and limit <= 500.
"""
from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport
from main import app


def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


_HEADERS_WITH_TOKEN = {
    "x-forwarded-access-token": "user-bearer-token",
    "x-forwarded-user": "user123",
    "x-forwarded-email": "user@example.com",
}

_ROW = {
    "plant_id": "IE10",
    "storage_location_id": "0001",
    "document_number": "5000000001",
    "fiscal_year": "2026",
    "line_item": "1",
    "material_id": "M1",
    "batch_id": "B1",
    "movement_type_code": "101",
    "movement_label": "GR_PO",
    "event_category": "RECEIPT",
    "is_goods_receipt": True,
    "is_goods_issue": False,
    "is_transfer": False,
    "is_reversal": False,
    "debit_credit_indicator": "S",
    "quantity": 10.0,
    "uom": "KG",
    "amount_local_currency": 100.0,
    "currency": "EUR",
    "posting_date": "2026-06-09",
    "document_date": "2026-06-09",
    "order_number": None,
    "purchase_order_number": "PO01",
    "delivery_number": None,
    "sales_order_number": None,
    "posted_by": "USER1",
    "transaction_code": "MIGO",
}

_EXECUTE_PATCH = "shared.query_service.databricks_client.StatementApiDatabricksClient.execute"


@pytest.fixture
def wh360_databricks_env(monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
    monkeypatch.setenv("WH360_CATALOG", "wh360_uat_catalog")
    monkeypatch.setenv("WH360_SCHEMA", "wh360_uat_schema")
    monkeypatch.setenv("WAREHOUSE360_SOURCE_MODE", "governed_contracts")


class TestGoodsMovementsRoute:
    async def test_returns_401_when_unauthenticated(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get("/api/warehouse360/goods-movements")
        assert response.status_code == 401

    async def test_returns_503_in_legacy_mode(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/goods-movements", headers=_HEADERS_WITH_TOKEN
            )
        assert response.status_code == 503

    async def test_defaults_to_previous_day_window(self, wh360_databricks_env) -> None:
        """Queries without a date window default to yesterday..today — never unbounded."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_ROW]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/goods-movements",
                    params={"plant_id": "IE10"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        sql = mock_exec.call_args.args[0] if mock_exec.call_args.args else mock_exec.call_args.kwargs.get("sql", "")
        params = (
            mock_exec.call_args.args[1]
            if len(mock_exec.call_args.args) > 1
            else mock_exec.call_args.kwargs.get("params", {})
        )
        assert "posting_date >= CAST(:date_from AS DATE)" in sql
        assert "posting_date <= CAST(:date_to AS DATE)" in sql
        today = date.today()
        assert params["date_to"] == today.isoformat()
        assert params["date_from"] == (today - timedelta(days=1)).isoformat()

    async def test_rejects_window_over_31_days_with_400(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/goods-movements",
                params={"date_from": "2026-01-01", "date_to": "2026-03-01"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 400
        assert "31 days" in response.json()["detail"]

    async def test_accepts_exactly_31_day_window(self, wh360_databricks_env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/goods-movements",
                    params={"date_from": "2026-05-10", "date_to": "2026-06-10"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200

    async def test_rejects_inverted_window_with_400(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/goods-movements",
                params={"date_from": "2026-06-10", "date_to": "2026-06-09"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 400

    async def test_rejects_malformed_dates_with_400(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/goods-movements",
                params={"date_from": "last-tuesday"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 400

    async def test_rejects_limit_over_500(self, wh360_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/warehouse360/goods-movements",
                params={"limit": 501},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422

    async def test_returns_200_with_mapped_rows(self, wh360_databricks_env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[_ROW]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/warehouse360/goods-movements",
                    params={"plant_id": "IE10", "date_from": "2026-06-09", "date_to": "2026-06-10"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        item = data[0]
        assert item["documentNumber"] == "5000000001"
        assert item["movementTypeCode"] == "101"
        assert item["isGoodsReceipt"] is True
        assert item["eventCategory"] == "RECEIPT"
        assert item["quantity"] == 10.0
        assert response.headers.get("x-data-source") == "databricks-api"
        assert "warehouse360.get_goods_movements" in response.headers.get("x-query-name", "")


class TestGoodsMovementsSpecGuards:
    """The spec factory itself also refuses unbounded/oversized windows (defence in depth)."""

    def test_spec_rejects_oversized_window(self, monkeypatch) -> None:
        monkeypatch.setenv("WAREHOUSE360_SOURCE_MODE", "governed_contracts")
        monkeypatch.setenv("WH360_CATALOG", "c")
        monkeypatch.setenv("WH360_SCHEMA", "s")
        from adapters.warehouse360.warehouse360_databricks_adapter import (
            WarehouseGoodsMovementsRequest,
            get_warehouse_goods_movements_spec,
        )

        with pytest.raises(ValueError, match="31 days"):
            get_warehouse_goods_movements_spec(
                WarehouseGoodsMovementsRequest(date_from="2026-01-01", date_to="2026-03-01")
            )

    def test_spec_always_binds_both_date_params(self, monkeypatch) -> None:
        monkeypatch.setenv("WAREHOUSE360_SOURCE_MODE", "governed_contracts")
        monkeypatch.setenv("WH360_CATALOG", "c")
        monkeypatch.setenv("WH360_SCHEMA", "s")
        from adapters.warehouse360.warehouse360_databricks_adapter import (
            WarehouseGoodsMovementsRequest,
            get_warehouse_goods_movements_spec,
        )

        spec = get_warehouse_goods_movements_spec(
            WarehouseGoodsMovementsRequest(date_from="2026-06-09", date_to="2026-06-10")
        )
        assert spec.params["date_from"] == "2026-06-09"
        assert spec.params["date_to"] == "2026-06-10"
        assert "posting_date >= CAST(:date_from AS DATE)" in spec.sql
        assert "posting_date <= CAST(:date_to AS DATE)" in spec.sql
        assert spec.contract_id == "warehouse360.goods_movements"
        assert "LIMIT 200" in spec.sql
