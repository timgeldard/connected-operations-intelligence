"""Route tests for the Production Planning Board endpoints under /api/wm-operations/plan-board/*.

Covers:
  - 401 when unauthenticated
  - 503 when not in databricks-api mode
  - 422 when plant_id missing
  - 422 when date params malformed
  - 200 + mapped camelCase rows for /plan-board and /plan-board/kpis
  - /plan-board/backlog and /plan-board/wm-overlay return correct shapes
  - No write/mutation endpoints exist (read-only proof)
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport
from main import app

# ---------------------------------------------------------------------------
# Helpers & constants
# ---------------------------------------------------------------------------


def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


_HEADERS = {
    "x-forwarded-access-token": "user-bearer-token",
    "x-forwarded-user": "user123",
    "x-forwarded-email": "user@example.com",
}

_EXECUTE_PATCH = "shared.query_service.databricks_client.StatementApiDatabricksClient.execute"

PLAN_BOARD = "/api/wm-operations/plan-board"
PLAN_BOARD_KPIS = "/api/wm-operations/plan-board/kpis"
PLAN_BOARD_BACKLOG = "/api/wm-operations/plan-board/backlog"
PLAN_BOARD_WM_OVERLAY = "/api/wm-operations/plan-board/wm-overlay"

ALL_PLAN_BOARD_ENDPOINTS = [PLAN_BOARD, PLAN_BOARD_KPIS, PLAN_BOARD_BACKLOG, PLAN_BOARD_WM_OVERLAY]


@pytest.fixture()
def env(monkeypatch):
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
    monkeypatch.setenv("WH360_CATALOG", "connected_plant_uat")
    monkeypatch.setenv("WH360_SCHEMA", "gold_io_reporting")


# ---------------------------------------------------------------------------
# Guards — all endpoints
# ---------------------------------------------------------------------------


class TestPlanBoardGuards:
    @pytest.mark.parametrize("endpoint", ALL_PLAN_BOARD_ENDPOINTS)
    async def test_returns_401_when_unauthenticated(self, env, endpoint) -> None:
        async with _make_client() as client:
            response = await client.get(endpoint, params={"plant_id": "C061"})
        assert response.status_code == 401

    @pytest.mark.parametrize("endpoint", ALL_PLAN_BOARD_ENDPOINTS)
    async def test_returns_503_in_legacy_mode(self, monkeypatch, endpoint) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(endpoint, params={"plant_id": "C061"}, headers=_HEADERS)
        assert response.status_code == 503

    @pytest.mark.parametrize("endpoint", ALL_PLAN_BOARD_ENDPOINTS)
    async def test_returns_422_when_plant_id_missing(self, env, endpoint) -> None:
        async with _make_client() as client:
            response = await client.get(endpoint, headers=_HEADERS)
        assert response.status_code == 422

    @pytest.mark.parametrize("endpoint", [PLAN_BOARD, PLAN_BOARD_KPIS, PLAN_BOARD_WM_OVERLAY])
    async def test_returns_422_on_bad_from_date(self, env, endpoint) -> None:
        async with _make_client() as client:
            response = await client.get(
                endpoint,
                params={"plant_id": "C061", "from_date": "not-a-date"},
                headers=_HEADERS,
            )
        assert response.status_code == 422

    @pytest.mark.parametrize("endpoint", [PLAN_BOARD, PLAN_BOARD_KPIS, PLAN_BOARD_WM_OVERLAY])
    async def test_returns_422_on_bad_to_date(self, env, endpoint) -> None:
        async with _make_client() as client:
            response = await client.get(
                endpoint,
                params={"plant_id": "C061", "to_date": "2026/06/13"},
                headers=_HEADERS,
            )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Plan Board blocks
# ---------------------------------------------------------------------------


class TestPlanBoardRoute:
    async def test_returns_mapped_board_rows(self, env) -> None:
        fake_row = {
            "plant_id": "C061",
            "order_id": "ORD001",
            "line_id": "LINE_A",
            "material_id": "FG001",
            "material_name": "Widget Alpha",
            "planned_qty": "1000.0",
            "uom": "KG",
            "scheduled_start_date": "2026-06-13",
            "scheduled_finish_date": "2026-06-13",
            "actual_start": "2026-06-13T06:00:00",
            "actual_finish": None,
            "delivered_qty": "750.0",
            "pct_complete": "75.0",
            "planned_minutes": "480",
            "elapsed_minutes": "360",
            "projected_finish": "2026-06-13T14:00:00",
            "status": "running",
            "staging_status": "FULL",
            "supply_status": "SUPPLIED",
            "is_backlog": False,
            "is_overdue": False,
            "has_shortage": False,
            "is_released": True,
            "is_completed": False,
            "is_closed": False,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    PLAN_BOARD,
                    params={"plant_id": "C061", "from_date": "2026-06-13", "to_date": "2026-06-13"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["orderId"] == "ORD001"
        assert row["lineId"] == "LINE_A"
        assert row["status"] == "running"
        assert row["plannedQty"] == pytest.approx(1000.0)
        assert row["pctComplete"] == pytest.approx(75.0)
        assert row["plannedMinutes"] == 480
        assert row["elapsedMinutes"] == 360
        assert row["isBacklog"] is False
        assert row["isOverdue"] is False
        assert row["hasShortage"] is False
        assert response.headers.get("x-contract-id") == "wm_operations.plan_board"

    async def test_empty_window_returns_empty_list(self, env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    PLAN_BOARD,
                    params={"plant_id": "C061", "from_date": "2020-01-01", "to_date": "2020-01-01"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        assert response.json() == []

    async def test_date_window_bound_in_sql(self, env) -> None:
        """from_date and to_date must appear as bound params in the SQL."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]) as mock_exec:
            async with _make_client() as client:
                await client.get(
                    PLAN_BOARD,
                    params={"plant_id": "C061", "from_date": "2026-06-13", "to_date": "2026-06-20"},
                    headers=_HEADERS,
                )
        call_args = mock_exec.call_args
        params = call_args.kwargs.get("params") or (call_args.args[1] if len(call_args.args) > 1 else {})
        assert params.get("from_date") == "2026-06-13"
        assert params.get("to_date") == "2026-06-20"


# ---------------------------------------------------------------------------
# KPIs
# ---------------------------------------------------------------------------


class TestPlanBoardKpisRoute:
    async def test_returns_kpi_row(self, env) -> None:
        fake_kpi = {
            "plant_id": "C061",
            "lines_running": "3",
            "today_qty_delivered": "2500.0",
            "at_risk_count": "1",
            "shortage_count": "0",
            "backlog_count": "2",
            "on_time_pct": "85.0",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_kpi]):
            async with _make_client() as client:
                response = await client.get(
                    PLAN_BOARD_KPIS,
                    params={"plant_id": "C061"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        kpi = rows[0]
        assert kpi["plantId"] == "C061"
        assert kpi["linesRunning"] == 3
        assert kpi["atRiskCount"] == 1
        assert kpi["backlogCount"] == 2
        assert kpi["onTimePct"] == pytest.approx(85.0)


# ---------------------------------------------------------------------------
# Backlog
# ---------------------------------------------------------------------------


class TestPlanBoardBacklogRoute:
    async def test_returns_backlog_rows(self, env) -> None:
        fake_row = {
            "plant_id": "C061",
            "order_id": "ORD002",
            "line_id": "LINE_A",
            "material_id": "FG002",
            "material_name": "Blend Beta",
            "planned_qty": "500.0",
            "uom": "KG",
            "scheduled_start_date": None,
            "scheduled_finish_date": "2026-06-10",
            "status": "open",
            "is_overdue": True,
            "has_shortage": False,
            "staging_status": "NONE",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    PLAN_BOARD_BACKLOG,
                    params={"plant_id": "C061"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["orderId"] == "ORD002"
        assert row["isOverdue"] is True
        assert row["hasShortage"] is False

    async def test_backlog_read_only_no_post(self, env) -> None:
        """Confirm no POST endpoint exists on /plan-board/backlog."""
        async with _make_client() as client:
            response = await client.post(PLAN_BOARD_BACKLOG, json={}, headers=_HEADERS)
        assert response.status_code == 405


# ---------------------------------------------------------------------------
# WM Overlay
# ---------------------------------------------------------------------------


class TestPlanBoardWmOverlayRoute:
    async def test_returns_overlay_rows(self, env) -> None:
        fake_row = {
            "plant_id": "C061",
            "order_id": "ORD001",
            "line_id": "LINE_A",
            "scheduled_start_date": "2026-06-13",
            "staging_status": "PARTIAL",
            "supply_status": "PARTIAL",
            "has_shortage": False,
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    PLAN_BOARD_WM_OVERLAY,
                    params={"plant_id": "C061", "from_date": "2026-06-13", "to_date": "2026-06-13"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["stagingStatus"] == "PARTIAL"
        assert row["supplyStatus"] == "PARTIAL"
        assert row["hasShortage"] is False
