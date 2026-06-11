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


# ---------------------------------------------------------------------------
# Screen 1-4 endpoints
# ---------------------------------------------------------------------------

NEW_ENDPOINTS = [
    ("/api/wm-operations/order-components", {"plant_id": "C061", "order_id": "900001"}),
    ("/api/wm-operations/order-operations", {"plant_id": "C061", "order_id": "900001"}),
    ("/api/wm-operations/operator-activity", {"plant_id": "C061"}),
    ("/api/wm-operations/queue-workload", {"plant_id": "C061"}),
    ("/api/wm-operations/outbound", {"plant_id": "C061"}),
    ("/api/wm-operations/recon-alerts", {"plant_id": "C061"}),
    ("/api/wm-operations/batch-movements", {"plant_id": "C061", "material_id": "RM1"}),
    ("/api/wm-operations/downtime-pareto", {"plant_id": "C061"}),
    ("/api/wm-operations/downtime-events", {"plant_id": "C061"}),
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
