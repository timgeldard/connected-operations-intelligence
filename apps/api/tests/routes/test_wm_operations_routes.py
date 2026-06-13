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
            "demand_due_ts": "2026-06-10T07:30:00Z",
            "priority_score": 90,
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
        assert row["demandDueTs"] == "2026-06-10T07:30:00Z"
        assert row["priorityScore"] == 90
        assert row["pickProgressFraction"] == 0.5
        assert row["isOverdue"] is True
        assert response.headers.get("x-contract-id") == "wm_operations.worklist"
        assert "wm_operations.get_worklist" in response.headers.get("x-query-name", "")

        # Status filter is normalised to upper case and bound as a parameter.
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "worklist_status = :status" in executed_sql
        assert "ORDER BY priority_score DESC NULLS LAST, demand_due_ts ASC NULLS LAST" in executed_sql

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


# ---------------------------------------------------------------------------
# Screen 1-4 endpoints
# ---------------------------------------------------------------------------

NEW_ENDPOINTS = [
    ("/api/wm-operations/order-components", {"plant_id": "C061", "order_id": "900001"}),
    ("/api/wm-operations/order-operations", {"plant_id": "C061", "order_id": "900001"}),
    ("/api/wm-operations/operator-activity", {"plant_id": "C061"}),
    ("/api/wm-operations/queue-workload", {"plant_id": "C061"}),
    ("/api/wm-operations/outbound", {"plant_id": "C061"}),
    ("/api/wm-operations/inbound-deliveries", {"plant_id": "C061"}),
    ("/api/wm-operations/recon-alerts", {"plant_id": "C061"}),
    ("/api/wm-operations/batch-movements", {"plant_id": "C061", "material_id": "RM1"}),
    ("/api/wm-operations/downtime-pareto", {"plant_id": "C061"}),
    ("/api/wm-operations/downtime-events", {"plant_id": "C061"}),
    ("/api/wm-operations/qm-lot-status", {"plant_id": "C061"}),
    ("/api/wm-operations/qm-disposition-queue", {"plant_id": "C061"}),
]


class TestNewEndpointGuards:
    @pytest.mark.parametrize("endpoint,params", NEW_ENDPOINTS)
    async def test_returns_401_when_unauthenticated(self, wm_ops_databricks_env, endpoint, params) -> None:
        async with _make_client() as client:
            response = await client.get(endpoint, params=params)
        assert response.status_code == 401

    @pytest.mark.parametrize("endpoint,params", NEW_ENDPOINTS)
    async def test_returns_503_in_legacy_mode(self, monkeypatch, endpoint, params) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(endpoint, params=params, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_batch_movements_caps_window(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/batch-movements",
                params={"plant_id": "C061", "material_id": "RM1", "days": 90},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422


class TestOrderComponentsRoute:
    async def test_returns_mapped_components(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061", "order_id": "900001", "reservation_id": "555",
            "reservation_item": "0001", "warehouse_id": "104", "material_id": "RM1",
            "material_name": "Raw Material One", "batch_id": None, "required_qty": 60.0,
            "open_qty": 60.0, "uom": "KG", "production_supply_area": "PSA1",
            "requirement_date": "2026-06-11", "material_component_count": 1,
            "tr_count": 1, "tr_required_qty": 60.0, "tr_open_qty": 0.0,
            "tr_coverage_status": "FULL", "to_item_count": 2, "to_items_confirmed": 2,
            "to_confirmed_qty": 60.0, "pick_progress_fraction": 1.0,
            "psa_supplied_qty": 60.0, "is_supplied": True,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/order-components",
                    params={"plant_id": "C061", "order_id": "900001"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["trCoverageStatus"] == "FULL"
        assert row["isSupplied"] is True
        assert response.headers.get("x-contract-id") == "wm_operations.order_components"
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "order_id = :order_id" in executed_sql


class TestOperatorAndQueueRoutes:
    async def test_operator_activity_mapped(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "P817", "warehouse_id": "208", "operator": "OPC81700238",
            "activity_date": "2026-06-09", "items_confirmed": 42, "transfer_orders": 12,
            "materials": 9, "transfer_requirements": 8, "confirmed_qty": 1234.5,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/operator-activity",
                    params={"plant_id": "P817", "days": 7},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.json()[0]["itemsConfirmed"] == 42
        assert response.headers.get("x-contract-id") == "wm_operations.operator_activity"

    async def test_queue_workload_mapped(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "P817", "warehouse_id": "208", "queue": "PKD800",
            "work_area": "DISPENSARY_PICKING", "open_jobs": 5, "in_progress_jobs": 1,
            "parked_jobs": 2, "no_stock_jobs": 0, "operator_count": 2,
            "earliest_planned_ts": "2026-06-09T22:00:00Z", "earliest_created_ts": None,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/queue-workload",
                    params={"plant_id": "P817"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.json()[0]["queue"] == "PKD800"
        assert response.headers.get("x-contract-id") == "wm_operations.queue_workload"


class TestOutboundAndAlertsRoutes:
    async def test_outbound_excludes_shipped_by_default(self, wm_ops_databricks_env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/outbound",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "NOT coalesce(is_shipped, false)" in executed_sql
        assert response.headers.get("x-contract-id") == "wm_operations.outbound"

    async def test_inbound_deliveries_mapped(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061", "warehouse_id": "104", "delivery_id": "0180000001",
            "delivery_type": "EL", "shipping_point": "C061",
            "line_count": 3, "delivery_qty": 150.0, "received_qty": 0.0,
            "receipt_fraction": None, "has_mixed_base_uom": False,
            "wm_status_code": "A", "expected_receipt_date": "2026-06-15",
            "actual_receipt_date": None, "is_received": False,
            "days_until_expected_receipt": 4, "receipt_band": "green",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/inbound-deliveries",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["deliveryId"] == "0180000001"
        assert row["deliveryType"] == "EL"
        assert row["lineCount"] == 3
        assert row["daysUntilExpectedReceipt"] == 4
        assert row["receiptBand"] == "green"
        assert row["hasMixedBaseUom"] is False
        assert response.headers.get("x-contract-id") == "wm_operations.inbound_deliveries"

    async def test_recon_alerts_mapped(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061", "warehouse_id": "104", "alert_key": "STOCK|abc",
            "alert_type": "STOCK_RECONCILIATION", "alert_priority": "P1",
            "material_id": "RM1", "batch_id": "B1", "reason_code": "TRUE_VARIANCE",
            "delta_qty": -10.0, "delta_value": -1234.0,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/recon-alerts",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.json()[0]["alertPriority"] == "P1"
        assert response.headers.get("x-contract-id") == "wm_operations.recon_alerts"


class TestExtendedFilters:
    async def test_worklist_queue_filter_binds_param(self, wm_ops_databricks_env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/worklist",
                    params={"plant_id": "C061", "queue": "PKD800"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "queue = :queue" in executed_sql

    async def test_readiness_horizon_params(self, wm_ops_databricks_env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/order-readiness",
                    params={"plant_id": "C061", "start_from_days_ago": 2, "start_to_days_ahead": 7},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "date_sub(current_date(), :start_from_days_ago)" in executed_sql
        assert "date_add(current_date(), :start_to_days_ahead)" in executed_sql

    async def test_batch_movements_mapped(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061", "document_number": "490001", "fiscal_year": "2026",
            "line_item": "1", "material_id": "RM1", "batch_id": "B1",
            "movement_type_code": "261", "movement_label": "GI to order",
            "event_category": "consumption", "quantity": -25.0, "uom": "KG",
            "posting_date": "2026-06-09", "order_number": "900001",
            "delivery_number": None, "posted_by": "OPC06100034",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/batch-movements",
                    params={"plant_id": "C061", "material_id": "RM1", "batch_id": "B1"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["movementType"] == "261"
        assert row["orderId"] == "900001"
        assert response.headers.get("x-contract-id") == "warehouse360.goods_movements"


class TestOrderOperationsRoute:
    async def test_returns_mapped_operations(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061", "order_number": "900001", "routing_number": "1",
            "operation_counter": "0010", "operation_number": "0010",
            "operation_description": "Mixing", "control_key": "PP01",
            "work_centre_code": "MIX01", "work_centre_description": "Mixing Line 1",
            "scheduled_start_datetime": "2026-06-10T06:00:00",
            "scheduled_finish_datetime": "2026-06-10T14:00:00",
            "actual_start_datetime": "2026-06-10T06:15:00",
            "actual_finish_date": None,
            "operation_quantity": 500.0, "confirmed_yield_quantity": 490.0,
            "confirmed_scrap_quantity": 10.0, "is_confirmed": False,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/order-operations",
                    params={"plant_id": "C061", "order_id": "900001"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["workCentreCode"] == "MIX01"
        assert row["isConfirmed"] is False
        assert row["confirmedYieldQty"] == 490.0
        assert response.headers.get("x-contract-id") == "wm_operations.order_operations"
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "order_number = :order_id" in executed_sql


class TestDowntimeRoutes:
    async def test_downtime_pareto_mapped(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061", "week_start": "2026-06-02",
            "downtime_reason_code": "MECH", "sub_reason_code": "BEARING",
            "work_centre_code": "LINE01", "downtime_reason_description": "Mechanical",
            "sub_reason_description": "Bearing failure", "production_line_description": "Line 1",
            "event_count": 3, "total_duration_minutes": 125.5,
            "avg_duration_minutes": 41.83, "distinct_order_count": 2,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/downtime-pareto",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["downtimeReasonCode"] == "MECH"
        assert row["totalDurationMinutes"] == 125.5
        assert row["eventCount"] == 3
        assert response.headers.get("x-contract-id") == "wm_operations.downtime_pareto"

    async def test_downtime_events_mapped(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061", "work_centre_code": "LINE01", "machine_code": "M01",
            "machine_description": "Filler A", "production_line_description": "Line 1",
            "order_number": "900001", "material_code": "FG001", "operation_number": "0010",
            "item_number": "1", "downtime_reason_code": "MECH",
            "downtime_reason_description": "Mechanical", "sub_reason_code": "BEARING",
            "sub_reason_description": "Bearing failure",
            "start_datetime": "2026-06-10T08:00:00", "end_datetime": "2026-06-10T09:30:00",
            "duration_minutes": 90.0, "reported_by_user": "OPC06100034", "comment": None,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/downtime-events",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["downtimeReasonCode"] == "MECH"
        assert row["durationMinutes"] == 90.0
        assert row["orderNumber"] == "900001"
        assert response.headers.get("x-contract-id") == "wm_operations.downtime_events"


class TestPlantsRoute:
    async def test_plants_returns_mapped_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "warehouse_id": "104",
            "worklist_tr_count": 42,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/plants",
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["warehouseId"] == "104"
        assert row["worklistTrCount"] == 42
        assert response.headers.get("x-contract-id") == "wm_operations.plants"

    async def test_plants_accepts_plant_id_filter(self, wm_ops_databricks_env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/plants",
                    params={"plant_id": "P817"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "plant_id = :plant_id" in executed_sql

    async def test_plants_returns_401_when_unauthenticated(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get("/api/wm-operations/plants")
        assert response.status_code == 401

    async def test_plants_returns_503_in_legacy_mode(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get("/api/wm-operations/plants", headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503


# ---------------------------------------------------------------------------
# QM lot status
# ---------------------------------------------------------------------------

class TestQmLotStatusRoute:
    async def test_returns_mapped_lot_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "lot_id": "000010001234",
            "inspection_lot_origin_code": "04",
            "inspection_type": "04",
            "material_id": "FG001",
            "material_name": "Finished Good One",
            "batch_id": "B0001",
            "order_id": "900001",
            "lot_created_date": "2026-06-01",
            "inspection_start_date": "2026-06-01",
            "inspection_end_date": "2026-06-08",
            "lot_qty": 500.0,
            "lot_uom": "KG",
            "has_usage_decision": False,
            "last_usage_decision": None,
            "last_usage_decision_date": None,
            "last_usage_decision_by": None,
            "quality_score": None,
            "lot_age_days": 10,
            "ud_lead_time_days": None,
            "is_overdue": True,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/qm-lot-status",
                    params={"plant_id": "C061", "open_only": "true", "limit": 500},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["lotId"] == "000010001234"
        assert row["hasUsageDecision"] is False
        assert row["isOverdue"] is True
        assert row["lotAgeDays"] == 10
        assert row["lotQty"] == 500.0
        assert response.headers.get("x-contract-id") == "wm_operations.qm_lot_status"
        # open_only clause applied
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "NOT coalesce(has_usage_decision, false)" in executed_sql

    async def test_open_only_false_omits_clause(self, wm_ops_databricks_env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/qm-lot-status",
                    params={"plant_id": "C061", "open_only": "false"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "NOT coalesce(has_usage_decision, false)" not in executed_sql

    async def test_origin_filter_binds_param(self, wm_ops_databricks_env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/qm-lot-status",
                    params={"plant_id": "C061", "origin": "04"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "inspection_lot_origin_code = :origin" in executed_sql


# ---------------------------------------------------------------------------
# QM disposition queue
# ---------------------------------------------------------------------------

class TestQmDispositionQueueRoute:
    async def test_returns_mapped_queue_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "lot_id": "000010009999",
            "inspection_lot_origin_code": "01",
            "inspection_type": "01",
            "material_id": "RM001",
            "material_name": "Raw Material One",
            "batch_id": "B9001",
            "order_id": None,
            "lot_created_date": "2026-05-20",
            "inspection_start_date": "2026-05-20",
            "inspection_end_date": "2026-05-27",
            "lot_qty": 1000.0,
            "lot_uom": "KG",
            "blocked_qty": 900.0,
            "blocked_uom": "KG",
            "est_blocked_value": 45000.0,
            "lot_age_days": 22,
            "is_overdue": True,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/qm-disposition-queue",
                    params={"plant_id": "C061", "limit": 200},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["lotId"] == "000010009999"
        assert row["blockedQty"] == 900.0
        assert row["estBlockedValue"] == 45000.0
        assert row["lotAgeDays"] == 22
        assert row["isOverdue"] is True
        assert response.headers.get("x-contract-id") == "wm_operations.qm_disposition_queue"
        # ordered by est_blocked_value DESC NULLS LAST
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "est_blocked_value DESC NULLS LAST" in executed_sql

    async def test_plant_id_filter_binds_param(self, wm_ops_databricks_env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/qm-disposition-queue",
                    params={"plant_id": "P817"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "plant_id = :plant_id" in executed_sql


# ---------------------------------------------------------------------------
# Order Journey summary (SIMPLE_DATASETS entry)
# ---------------------------------------------------------------------------

class TestOrderJourneyRoute:
    async def test_returns_mapped_summary_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "order_id": "900001",
            "material_code": "FG001",
            "material_name": "Finished Good One",
            "order_qty": 500.0,
            "uom": "KG",
            "production_line": "LINE01",
            "order_created_ts": "2026-06-01T08:00:00",
            "release_date": "2026-06-02",
            "scheduled_start_date": "2026-06-03",
            "scheduled_finish_date": "2026-06-04",
            "first_tr_created_ts": "2026-06-02T10:00:00",
            "staging_tr_count": 2,
            "staging_first_confirmed_ts": "2026-06-02T12:00:00",
            "staging_last_confirmed_ts": "2026-06-02T14:00:00",
            "staged_item_count": 4,
            "staged_item_total": 4,
            "production_first_actual_start": "2026-06-03T06:00:00",
            "production_last_actual_finish": "2026-06-03T14:00:00",
            "confirmed_yield_qty": 490.0,
            "confirmed_scrap_qty": 10.0,
            "pi_first_start": None,
            "pi_last_end": None,
            "first_gr_posting_date": "2026-06-04",
            "last_gr_posting_date": "2026-06-04",
            "gr_qty": 490.0,
            "issue_qty": 500.0,
            "delivery_count": 1,
            "qm_lot_count": 1,
            "qm_open_lot_count": 0,
            "release_to_first_tr_hours": 2.0,
            "tr_to_staged_hours": 4.0,
            "staged_to_production_hours": 16.0,
            "production_to_gr_hours": 16.0,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/order-journey",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["orderId"] == "900001"
        assert row["materialCode"] == "FG001"
        assert row["orderQty"] == 500.0
        assert row["stagedItemCount"] == 4
        assert row["confirmedYieldQty"] == 490.0
        assert row["trToStagedHours"] == 4.0
        assert response.headers.get("x-contract-id") == "wm_operations.order_journey"
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "plant_id = :plant_id" in executed_sql

    async def test_order_journey_limit_applies(self, wm_ops_databricks_env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/order-journey",
                    params={"plant_id": "C061", "limit": 50},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "LIMIT 50" in executed_sql

    async def test_order_journey_returns_401_unauthenticated(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/order-journey", params={"plant_id": "C061"}
            )
        assert response.status_code == 401

    async def test_order_journey_returns_503_legacy(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/order-journey",
                params={"plant_id": "C061"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503


# ---------------------------------------------------------------------------
# Order Journey events (dedicated drill endpoint)
# ---------------------------------------------------------------------------

class TestOrderJourneyEventsRoute:
    async def test_returns_mapped_events(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "order_id": "900001",
            "event_seq": 1,
            "event_ts": "2026-06-01T08:00:00",
            "event_type": "ORDER_CREATED",
            "qty": None,
            "uom": None,
            "reference_id": None,
            "detail": "Order created",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/order-journey-events",
                    params={"plant_id": "C061", "order_id": "900001"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["orderId"] == "900001"
        assert row["eventSeq"] == 1
        assert row["eventType"] == "ORDER_CREATED"
        assert row["detail"] == "Order created"
        assert response.headers.get("x-contract-id") == "wm_operations.order_journey_events"
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "plant_id = :plant_id" in executed_sql
        assert "order_id = :order_id" in executed_sql

    async def test_multiple_event_types_mapped(self, wm_ops_databricks_env) -> None:
        rows_data = [
            {"plant_id": "C061", "order_id": "900001", "event_seq": 1,
             "event_ts": "2026-06-01T08:00:00", "event_type": "ORDER_CREATED",
             "qty": None, "uom": None, "reference_id": None, "detail": "Order created"},
            {"plant_id": "C061", "order_id": "900001", "event_seq": 2,
             "event_ts": "2026-06-02T10:00:00", "event_type": "TR_CREATED",
             "qty": 500.0, "uom": "KG", "reference_id": "TR001", "detail": "TR TR001"},
            {"plant_id": "C061", "order_id": "900001", "event_seq": 3,
             "event_ts": "2026-06-03T14:00:00", "event_type": "GR_POSTED",
             "qty": 490.0, "uom": "KG", "reference_id": "MAT001", "detail": "Goods receipt (101)"},
        ]
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=rows_data):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/order-journey-events",
                    params={"plant_id": "C061", "order_id": "900001"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 3
        assert rows[1]["eventType"] == "TR_CREATED"
        assert rows[1]["qty"] == 500.0
        assert rows[2]["eventType"] == "GR_POSTED"

    async def test_returns_401_when_unauthenticated(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/order-journey-events",
                params={"plant_id": "C061", "order_id": "900001"},
            )
        assert response.status_code == 401

    async def test_returns_503_in_legacy_mode(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/order-journey-events",
                params={"plant_id": "C061", "order_id": "900001"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503

    async def test_requires_order_id_param(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/order-journey-events",
                params={"plant_id": "C061"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# WIP Stages (Production Progress — WIP funnel)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
class TestWipStagesRoute:
    async def test_returns_mapped_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "order_id": "900001",
            "material_code": "FG001",
            "material_name": "Finished Good A",
            "order_qty": 500.0,
            "uom": "KG",
            "scheduled_start_date": "2026-06-01",
            "scheduled_finish_date": "2026-06-03",
            "stage": "IN_PRODUCTION",
            "first_tr_created_ts": "2026-06-01T08:00:00",
            "staging_last_confirmed_ts": "2026-06-02T10:00:00",
            "production_first_actual_start": "2026-06-02T12:00:00",
            "first_gr_posting_date": None,
            "gr_qty": 0.0,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/wip-stages",
                    params={"plant_id": "C061", "limit": 500},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["orderId"] == "900001"
        assert row["stage"] == "IN_PRODUCTION"
        assert row["orderQty"] == 500.0
        assert response.headers.get("x-contract-id") == "wm_operations.wip_stages"
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "plant_id = :plant_id" in executed_sql
        assert "LIMIT 500" in executed_sql

    async def test_returns_401_unauthenticated(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/wip-stages", params={"plant_id": "C061"}
            )
        assert response.status_code == 401

    async def test_returns_503_legacy(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/wip-stages",
                params={"plant_id": "C061"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503


# ---------------------------------------------------------------------------
# Schedule Adherence Daily (Production Progress — S-curve)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
class TestScheduleAdherenceDailyRoute:
    async def test_returns_mapped_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "scheduled_date": "2026-06-01",
            "planned_count": 10,
            "completed_count": 8,
            "on_time_count": 7,
            "max_actual_date": "2026-06-03",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/schedule-adherence-daily",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["scheduledDate"] == "2026-06-01"
        assert row["plannedCount"] == 10
        assert row["completedCount"] == 8
        assert row["onTimeCount"] == 7
        assert response.headers.get("x-contract-id") == "wm_operations.schedule_adherence_daily"
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "plant_id = :plant_id" in executed_sql

    async def test_returns_401_unauthenticated(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/schedule-adherence-daily", params={"plant_id": "C061"}
            )
        assert response.status_code == 401

    async def test_returns_503_legacy(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/schedule-adherence-daily",
                params={"plant_id": "C061"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503


# ---------------------------------------------------------------------------
# Adherence Root Cause (Production Progress — miss classification)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
class TestAdherenceRootCauseRoute:
    async def test_returns_mapped_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "order_id": "900001",
            "material_id": "FG1",
            "material_name": "Finished Good",
            "order_qty": 100.0,
            "uom": "KG",
            "production_line": "LINE_A",
            "scheduled_start_date": "2026-06-01",
            "scheduled_finish_date": "2026-06-10",
            "actual_release_date": "2026-06-03",
            "actual_finish_date": "2026-06-12",
            "root_cause_class": "LATE_RELEASE",
            "is_late_release": True,
            "has_material_short": False,
            "shortfall_component_count": 0,
            "min_variance_qty": None,
            "release_to_production_hours": 48.0,
            "production_first_actual_start": "2026-06-05T08:00:00",
            "is_finish_late": True,
            "is_open_late": False,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/adherence-root-cause",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["orderId"] == "900001"
        assert row["rootCauseClass"] == "LATE_RELEASE"
        assert row["isLateRelease"] is True
        assert response.headers.get("x-contract-id") == "wm_operations.adherence_root_cause"
        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "plant_id = :plant_id" in executed_sql

    async def test_returns_401_unauthenticated(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/adherence-root-cause", params={"plant_id": "C061"}
            )
        assert response.status_code == 401

    async def test_returns_503_legacy(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/adherence-root-cause",
                params={"plant_id": "C061"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503


# ---------------------------------------------------------------------------
# QM characteristic / UD Pareto (Command Centre drill)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
class TestQmParetoRoutes:
    async def test_qm_characteristic_pareto(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "material_id": "RM1",
            "characteristic_id": "MIC1",
            "characteristic_text": "Moisture",
            "unit": "%",
            "result_count": 100,
            "fail_count": 12,
            "warn_count": 3,
            "fail_rate": 0.12,
            "last_result_date": "2026-03-25",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/qm-characteristic-pareto",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.headers.get("x-contract-id") == "wm_operations.qm_characteristic_pareto"

    async def test_qm_ud_code_pareto(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "usage_decision_code": "A1",
            "usage_decision": "Accepted",
            "usage_decision_valuation": "A",
            "lot_count": 42,
            "last_decision_date": "2026-04-01",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/qm-ud-code-pareto",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.headers.get("x-contract-id") == "wm_operations.qm_ud_code_pareto"


# ---------------------------------------------------------------------------
# Order Yield (SIMPLE_DATASETS declarative route)
# ---------------------------------------------------------------------------

class TestOrderYieldRoute:
    async def test_returns_mapped_order_yield_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "order_id": "900001",
            "material_id": "FG1",
            "material_name": "Finished Good One",
            "production_line": "LINE_A",
            "planned_qty": 100.0,
            "delivered_qty": 90.0,
            "uom": "KG",
            "yield_pct": 0.9,
            "has_goods_receipt": True,
            "is_complete": False,
            "is_released": True,
            "is_completed": False,
            "is_closed": False,
            "scheduled_start_date": "2026-06-01",
            "scheduled_finish_date": "2026-06-02",
            "actual_finish_date": None,
            "first_gr_date": "2026-06-02",
            "last_gr_date": "2026-06-02",
        }

        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/order-yield",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["orderId"] == "900001"
        assert row["yieldPct"] == 0.9
        assert row["hasGoodsReceipt"] is True
        assert response.headers.get("x-contract-id") == "wm_operations.order_yield"

    async def test_returns_401_unauthenticated(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/order-yield", params={"plant_id": "C061"}
            )
        assert response.status_code == 401

    async def test_returns_503_legacy(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/order-yield",
                params={"plant_id": "C061"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503


# ---------------------------------------------------------------------------
# Expiry Risk (SIMPLE_DATASETS declarative route)
# ---------------------------------------------------------------------------

class TestExpiryRiskRoute:
    async def test_returns_mapped_expiry_risk_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "material_id": "RM1",
            "material_name": "Raw Material One",
            "batch_id": "B0001",
            "uom": "KG",
            "unrestricted_qty": 10.0,
            "quality_inspection_qty": 2.0,
            "blocked_qty": 1.0,
            "restricted_use_qty": 0.0,
            "in_transfer_qty": 0.0,
            "blocked_returns_qty": 0.0,
            "total_stock_qty": 13.0,
            "expiry_date": "2026-07-01",
            "days_to_expiry": 18,
            "expiry_band": "LT_30_DAYS",
            "manufacture_date": "2026-01-01",
            "vendor_batch_number": "SUP-B1",
            "shelf_life_days": 180,
            "minimum_remaining_shelf_life_days": 30,
            "standard_price": 2.5,
            "price_unit": 1.0,
            "est_stock_value": 32.5,
            "fefo_risk_flag": True,
            "earlier_expiring_batch": "B0000",
            "latest_issue_date": "2026-06-10",
        }

        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]) as mock_exec:
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/expiry-risk",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        row = response.json()[0]
        assert row["plantId"] == "C061"
        assert row["materialId"] == "RM1"
        assert row["expiryDate"] == "2026-07-01"
        assert row["daysToExpiry"] == 18
        assert row["expiryBand"] == "LT_30_DAYS"
        assert row["estStockValue"] == 32.5
        assert row["fefoRiskFlag"] is True
        assert row["earlierExpiringBatch"] == "B0000"
        assert response.headers.get("x-contract-id") == "wm_operations.expiry_risk"

        executed_sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "plant_id = :plant_id" in executed_sql
        assert "days_to_expiry ASC NULLS LAST" in executed_sql


# ---------------------------------------------------------------------------
# Recipe Benchmark (SIMPLE_DATASETS declarative route)
# ---------------------------------------------------------------------------

class TestRecipeBenchmarkRoute:
    async def test_returns_mapped_recipe_benchmark_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "material_id": "FG1",
            "production_line": "LINE_A",
            "run_count": 4,
            "median_yield_pct": 0.94,
            "p10_yield_pct": 0.88,
            "p90_yield_pct": 0.99,
            "median_duration_hours": 24.0,
            "p10_duration_hours": 12.0,
            "p90_duration_hours": 36.0,
            "last_run_finish_date": "2026-06-05",
        }

        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/recipe-benchmark",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["materialId"] == "FG1"
        assert row["productionLine"] == "LINE_A"
        assert row["runCount"] == 4
        assert row["medianYieldPct"] == 0.94
        assert row["medianDurationHours"] == 24.0
        assert response.headers.get("x-contract-id") == "wm_operations.recipe_benchmark"

    async def test_returns_401_unauthenticated(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/recipe-benchmark", params={"plant_id": "C061"}
            )
        assert response.status_code == 401

    async def test_returns_503_legacy(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/recipe-benchmark",
                params={"plant_id": "C061"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503


# ---------------------------------------------------------------------------
# Component Variance (SIMPLE_DATASETS declarative route)
# ---------------------------------------------------------------------------

class TestComponentVarianceRoute:
    async def test_returns_mapped_component_variance_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "order_id": "900001",
            "reservation_id": "RS0001",
            "reservation_item": "0001",
            "material_id": "RM1",
            "material_name": "Raw Material One",
            "uom": "KG",
            "movement_type_code": "261",
            "required_qty": 50.0,
            "withdrawn_qty": 0.0,
            "issued_qty": 55.0,
            "variance_qty": 5.0,
            "variance_pct": 0.1,
            "est_loss_value": 25.0,
            "standard_price": 5.0,
            "is_final_issue": False,
        }

        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/component-variance",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["orderId"] == "900001"
        assert row["varianceQty"] == 5.0
        assert row["estLossValue"] == 25.0
        assert response.headers.get("x-contract-id") == "wm_operations.component_variance"

    async def test_returns_401_unauthenticated(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/component-variance", params={"plant_id": "C061"}
            )
        assert response.status_code == 401

    async def test_returns_503_legacy(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/component-variance",
                params={"plant_id": "C061"},
                headers=_HEADERS_WITH_TOKEN,
            )
        assert response.status_code == 503


# ---------------------------------------------------------------------------
# Shortage Projection (supply/demand ledger + at-risk components)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
class TestShortageProjectionRoutes:
    async def test_shortage_projection_returns_mapped_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "order_id": "900001",
            "material_id": "RM1",
            "material_name": "Raw Material",
            "open_qty": 50.0,
            "uom": "KG",
            "requirement_date": "2026-06-10",
            "reservation_ref": "100-1",
            "projected_balance_at_demand": 10.0,
            "is_projected_short": True,
            "first_short_date": "2026-06-08",
            "scheduled_start_date": "2026-06-10",
            "scheduled_finish_date": "2026-06-12",
            "production_line": "LINE_A",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/shortage-projection",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["orderId"] == "900001"
        assert row["isProjectedShort"] is True
        assert response.headers.get("x-contract-id") == "wm_operations.shortage_projection"

    async def test_supply_demand_ledger_returns_mapped_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061",
            "material_id": "RM1",
            "material_name": "Raw Material",
            "event_type": "SUPPLY",
            "event_subtype": "ON_HAND",
            "event_date": None,
            "quantity": 100.0,
            "signed_qty": 100.0,
            "balance_before": 0.0,
            "running_balance": 100.0,
            "source_document_id": "ON_HAND",
            "order_id": None,
            "sort_seq": 1,
            "uom": "KG",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/supply-demand-ledger",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        assert response.headers.get("x-contract-id") == "wm_operations.supply_demand_ledger"


class TestDailyActivityBaselineRoute:
    async def test_returns_200_with_baseline_rows(self, wm_ops_databricks_env) -> None:
        fake_row = {
            "plant_id": "C061", "metric_name": "to_items_confirmed", "day_of_week": 2,
            "median_value": 150.0, "p10_value": 80.0, "p90_value": 220.0, "sample_days": 12,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock) as mock_exec:
            mock_exec.return_value = [fake_row]
            async with _make_client() as client:
                response = await client.get(
                    "/api/wm-operations/daily-activity-baseline",
                    params={"plant_id": "C061"},
                    headers=_HEADERS_WITH_TOKEN,
                )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert data[0]["metricName"] == "to_items_confirmed"
        assert data[0]["dayOfWeek"] == 2
        assert data[0]["medianValue"] == 150.0

    async def test_baseline_returns_401_unauthenticated(self, wm_ops_databricks_env) -> None:
        async with _make_client() as client:
            response = await client.get(
                "/api/wm-operations/daily-activity-baseline",
                params={"plant_id": "C061"},
            )
        assert response.status_code == 401
