"""Route tests for the WM Operations endpoints under /api/wm-operations/*."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport
from main import app

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

_EXECUTE_PATCH = "shared.query_service.databricks_client.StatementApiDatabricksClient.execute"

ALL_ENDPOINTS = [
    "/api/wm-operations/worklist",
    "/api/wm-operations/worklist-summary",
    "/api/wm-operations/order-readiness",
    "/api/wm-operations/bin-stock",
]


@pytest.fixture
def wm_ops_databricks_env(monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
    monkeypatch.setenv("WH360_CATALOG", "wh360_uat_catalog")
    monkeypatch.setenv("WH360_SCHEMA", "wh360_uat_schema")


# ---------------------------------------------------------------------------
# Cross-endpoint guards
# ---------------------------------------------------------------------------

class TestWmOperationsGuards:
    @pytest.mark.parametrize("endpoint", ALL_ENDPOINTS)
    async def test_returns_401_when_unauthenticated(self, wm_ops_databricks_env, endpoint) -> None:
        async with _make_client() as client:
            response = await client.get(endpoint, params={"plant_id": "C061"})
        assert response.status_code == 401

    @pytest.mark.parametrize("endpoint", ALL_ENDPOINTS)
    async def test_returns_503_in_legacy_mode(self, monkeypatch, endpoint) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(endpoint, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_catalog_missing(self, monkeypatch, wm_ops_databricks_env) -> None:
        monkeypatch.delenv("WH360_CATALOG", raising=False)
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/worklist",
                params={"plant_id": "C061"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503

    async def test_rejects_unknown_work_area(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/worklist",
                params={"work_area": "NOT_A_REAL_AREA"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422

    async def test_rejects_out_of_range_limit(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/worklist",
                params={"limit": 9999},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Worklist
# ---------------------------------------------------------------------------

class TestWorklistRoute:
    async def test_returns_mapped_worklist_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "warehouse_id": "104",
            "tr_id": "0000123456",
            "work_area": "PRODUCTION_STAGING",
            "worklist_status": "IN_PROGRESS",
            "reference_type": "P",
            "reference_id": "900001",
            "order_material_id": "FG1",
            "order_scheduled_start_date": "2026-06-11",
            "source_storage_type": None,
            "source_zone": None,
            "destination_storage_type": "100",
            "destination_zone": "PRODUCTION_SUPPLY",
            "destination_bin": "000000900001",
            "queue": "Q1",
            "campaign_id": None,
            "assigned_operator": "OPER1",
            "job_sequence": "01",
            "transfer_priority": None,
            "created_ts": "2026-06-10T06:00:00Z",
            "planned_execution_ts": "2026-06-10T08:00:00Z",
            "item_count": 3,
            "open_item_count": 2,
            "material_count": 3,
            "material_id": None,
            "material_name": None,
            "required_qty": 120.5,
            "open_qty": 60.25,
            "uom": "KG",
            "has_mixed_base_uom": False,
            "to_item_count": 2,
            "to_items_confirmed": 1,
            "to_confirmed_qty": 60.25,
            "pick_progress_fraction": 0.5,
            "age_hours": 5.5,
            "is_overdue": True,
        }

        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/worklist",
                    params={"plant_id": "C061", "warehouse_id": "104", "status": "in_progress"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["trId"] == "0000123456"
        assert row["workArea"] == "PRODUCTION_STAGING"
        assert row["worklistStatus"] == "IN_PROGRESS"
        assert row["assignedOperator"] == "OPER1"
        assert row["pickProgressFraction"] == 0.5
        assert row["isOverdue"] is True
        assert response.headers.get("x-contract-id") == "wm_operations.worklist"
        assert "wm_operations.get_worklist" in response.headers.get("x-query-name", "")

        # Status filter is normalised to upper case and bound as a parameter.
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "worklist_status = :status" in executed_sql

    async def test_excludes_complete_by_default(self, wm_ops_databricks_env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/worklist",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "worklist_status <> 'COMPLETE'" in executed_sql


# ---------------------------------------------------------------------------
# Worklist summary
# ---------------------------------------------------------------------------

class TestWorklistSummaryRoute:
    async def test_returns_mapped_summary_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "P817",
            "warehouse_id": "208",
            "work_area": "DISPENSARY_PICKING",
            "worklist_status": "PARKED",
            "tr_count": 4,
            "total_open_qty": 12.5,
            "total_required_qty": 20.0,
            "operator_count": 2,
            "earliest_planned_ts": "2026-06-09T22:00:00Z",
            "earliest_created_ts": "2026-06-09T20:00:00Z",
        }

        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/worklist-summary",
                    params={"plant_id": "P817"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        rows = response.json()
        assert rows[0]["workArea"] == "DISPENSARY_PICKING"
        assert rows[0]["trCount"] == 4
        assert response.headers.get("x-contract-id") == "wm_operations.worklist_summary"


# ---------------------------------------------------------------------------
# Order readiness
# ---------------------------------------------------------------------------

class TestOrderReadinessRoute:
    async def test_returns_mapped_readiness_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "order_id": "900001",
            "warehouse_id": "104",
            "material_id": "FG1",
            "material_name": "Finished Good One",
            "order_qty": 1000.0,
            "uom": "KG",
            "scheduled_start_date": "2026-06-11",
            "scheduled_finish_date": "2026-06-12",
            "production_supply_area": "PSA1",
            "component_count": 5,
            "wm_component_count": 4,
            "wm_component_required_qty": 400.0,
            "component_open_qty": 100.0,
            "tr_count": 2,
            "tr_required_qty": 400.0,
            "tr_open_qty": 50.0,
            "tr_coverage_status": "FULL",
            "psa_supplied_qty": 350.0,
            "supply_status": "PARTIAL",
            "readiness_status": "STAGING_PLANNED",
            "days_to_start": 1,
            "readiness_band": "amber",
        }

        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/order-readiness",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        rows = response.json()
        row = rows[0]
        assert row["orderId"] == "900001"
        assert row["trCoverageStatus"] == "FULL"
        assert row["supplyStatus"] == "PARTIAL"
        assert row["readinessBand"] == "amber"
        assert response.headers.get("x-contract-id") == "wm_operations.order_readiness"


# ---------------------------------------------------------------------------
# Bin stock
# ---------------------------------------------------------------------------

class TestBinStockRoute:
    async def test_returns_mapped_bin_stock_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "warehouse_id": "104",
            "storage_type": "800",
            "storage_zone": "DISPENSARY",
            "bin_id": "FLOOR",
            "picking_area": None,
            "quant_id": "Q123",
            "material_id": "RM1",
            "material_name": "Raw Material One",
            "batch_id": "B0001",
            "stock_category": "UNRESTRICTED",
            "total_qty": 25.0,
            "available_qty": 20.0,
            "putaway_qty": 0.0,
            "pick_qty": 5.0,
            "open_transfer_qty": 0.0,
            "uom": "KG",
            "goods_receipt_date": "2026-05-01",
            "expiry_date": "2026-08-01",
            "is_blocked_for_stock_removal": False,
            "is_blocked_for_putaway": False,
            "is_bin_blocked": False,
            "blocking_reason_code": None,
            "days_to_expiry": 52,
            "is_expired": False,
        }

        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/bin-stock",
                    params={
                        "plant_id": "C061",
                        "storage_zone": "DISPENSARY",
                        "expiring_within_days": 90,
                    },
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        rows = response.json()
        row = rows[0]
        assert row["quantId"] == "Q123"
        assert row["storageZone"] == "DISPENSARY"
        assert row["daysToExpiry"] == 52
        assert response.headers.get("x-contract-id") == "wm_operations.bin_stock"

        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "storage_zone = :storage_zone" in executed_sql
        assert "days_to_expiry <= :expiring_within_days" in executed_sql

    async def test_rejects_unknown_storage_zone(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/bin-stock",
                params={"storage_zone": "BASEMENT"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422
