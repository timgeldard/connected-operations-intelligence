"""Route tests for the Lineside Monitor endpoints under /api/wm-operations/lineside/*.

Covers:
  - 401 when unauthenticated (no OAuth token)
  - 503 when not in databricks-api mode
  - 422 when plant_id or line_id missing
  - 422 when limit out of range
  - 200 + mapped camelCase rows for each endpoint
  - /lines endpoint does not require line_id
  - Contract ID and query name headers are present
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

LINESIDE_NOW = "/api/wm-operations/lineside/now"
LINESIDE_NEXT = "/api/wm-operations/lineside/next"
LINESIDE_BLOCKED = "/api/wm-operations/lineside/blocked"
LINESIDE_STAGING = "/api/wm-operations/lineside/staging"
LINESIDE_PLAN_ACTUAL = "/api/wm-operations/lineside/plan-actual"
LINESIDE_LINES = "/api/wm-operations/lineside/lines"

# Endpoints that require both plant_id and line_id
PARAM_ENDPOINTS = [
    LINESIDE_NOW,
    LINESIDE_NEXT,
    LINESIDE_BLOCKED,
    LINESIDE_STAGING,
    LINESIDE_PLAN_ACTUAL,
]

ALL_LINESIDE_ENDPOINTS = PARAM_ENDPOINTS + [LINESIDE_LINES]


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


class TestLinesideGuards:
    @pytest.mark.parametrize("endpoint", ALL_LINESIDE_ENDPOINTS)
    async def test_returns_401_when_unauthenticated(self, env, endpoint) -> None:
        async with _make_client() as client:
            response = await client.get(
                endpoint, params={"plant_id": "C061", "line_id": "LINE_A"}
            )
        assert response.status_code == 401

    @pytest.mark.parametrize("endpoint", ALL_LINESIDE_ENDPOINTS)
    async def test_returns_503_in_legacy_mode(self, monkeypatch, endpoint) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.get(
                endpoint,
                params={"plant_id": "C061", "line_id": "LINE_A"},
                headers=_HEADERS,
            )
        assert response.status_code == 503

    @pytest.mark.parametrize("endpoint", PARAM_ENDPOINTS)
    async def test_returns_422_when_plant_id_missing(self, env, endpoint) -> None:
        """plant_id is required for all param-gated lineside endpoints."""
        async with _make_client() as client:
            response = await client.get(
                endpoint, params={"line_id": "LINE_A"}, headers=_HEADERS
            )
        assert response.status_code == 422

    @pytest.mark.parametrize("endpoint", PARAM_ENDPOINTS)
    async def test_returns_422_when_line_id_missing(self, env, endpoint) -> None:
        """line_id is required for all param-gated lineside endpoints."""
        async with _make_client() as client:
            response = await client.get(
                endpoint, params={"plant_id": "C061"}, headers=_HEADERS
            )
        assert response.status_code == 422

    async def test_returns_422_when_limit_too_high(self, env) -> None:
        async with _make_client() as client:
            response = await client.get(
                LINESIDE_NOW,
                params={"plant_id": "C061", "line_id": "LINE_A", "limit": 9999},
                headers=_HEADERS,
            )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Lineside Now
# ---------------------------------------------------------------------------


class TestLinesideNowRoute:
    async def test_returns_mapped_now_rows(self, env) -> None:
        fake_row = {
            "plant_id": "C061",
            "line_id": "LINE_A",
            "order_id": "ORD001",
            "material_id": "FG001",
            "material_name": "Widget Alpha",
            "planned_qty": "100.0",
            "uom": "KG",
            "pct_complete": "75.0",
            "planned_minutes": "480",
            "production_first_actual_start": "2026-06-13T06:00:00",
            "current_operation_number": "0020",
            "current_operation_description": "Filling",
            "current_activity_type": "Processing",
            "elapsed_minutes": "120",
            "projected_finish": "2026-06-13T14:00:00",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    LINESIDE_NOW,
                    params={"plant_id": "C061", "line_id": "LINE_A"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["plantId"] == "C061"
        assert row["lineId"] == "LINE_A"
        assert row["orderId"] == "ORD001"
        assert row["materialName"] == "Widget Alpha"
        assert row["plannedQty"] == pytest.approx(100.0)
        assert row["pctComplete"] == pytest.approx(75.0)
        assert row["plannedMinutes"] == 480
        assert row["elapsedMinutes"] == 120
        assert row["currentOperationNumber"] == "0020"
        assert row["currentActivityType"] == "Processing"
        # Contract header
        assert response.headers.get("x-contract-id") == "wm_operations.lineside_now"

    async def test_empty_line_returns_empty_list(self, env) -> None:
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    LINESIDE_NOW,
                    params={"plant_id": "C061", "line_id": "EMPTY_LINE"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        assert response.json() == []

    async def test_plant_and_line_bound_in_sql(self, env) -> None:
        """Both plant_id and line_id must appear as bound params in the SQL."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]) as mock_exec:
            async with _make_client() as client:
                await client.get(
                    LINESIDE_NOW,
                    params={"plant_id": "C061", "line_id": "LINE_A"},
                    headers=_HEADERS,
                )
        sql = mock_exec.call_args.kwargs.get("sql") or mock_exec.call_args.args[0]
        assert "plant_id = :plant_id" in sql
        assert "line_id = :line_id" in sql


# ---------------------------------------------------------------------------
# Lineside Next
# ---------------------------------------------------------------------------


class TestLinesideNextRoute:
    async def test_returns_mapped_next_rows(self, env) -> None:
        fake_row = {
            "plant_id": "C061",
            "line_id": "LINE_A",
            "order_id": "ORD010",
            "material_id": "FG002",
            "material_name": "Widget Beta",
            "order_qty": "50.0",
            "uom": "KG",
            "scheduled_start_date": "2026-06-14",
            "scheduled_finish_date": "2026-06-14",
            "tr_coverage_status": "PARTIAL",
            "supply_status": "NOT_SUPPLIED",
            "readiness_status": "PARTIALLY_PLANNED",
            "readiness_band": "THIS_WEEK",
            "days_to_start": "1",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    LINESIDE_NEXT,
                    params={"plant_id": "C061", "line_id": "LINE_A"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["orderId"] == "ORD010"
        assert row["trCoverageStatus"] == "PARTIAL"
        assert row["daysToStart"] == 1
        assert response.headers.get("x-contract-id") == "wm_operations.order_readiness"


# ---------------------------------------------------------------------------
# Lineside Blocked
# ---------------------------------------------------------------------------


class TestLinesideBlockedRoute:
    async def test_returns_mapped_blocked_rows(self, env) -> None:
        fake_row = {
            "plant_id": "C061",
            "line_id": "LINE_A",
            "order_id": "ORD020",
            "material_id": "FG001",
            "material_name": "Widget Alpha",
            "order_qty": "80.0",
            "uom": "KG",
            "scheduled_start_date": "2026-06-13",
            "scheduled_finish_date": "2026-06-13",
            "root_cause_class": "MATERIAL_SHORT",
            "is_late_release": "false",
            "has_material_short": "true",
            "shortfall_component_count": "2",
            "is_finish_late": "false",
            "is_open_late": "true",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    LINESIDE_BLOCKED,
                    params={"plant_id": "C061", "line_id": "LINE_A"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["orderId"] == "ORD020"
        assert row["rootCauseClass"] == "MATERIAL_SHORT"
        assert row["hasMaterialShort"] is True
        assert row["isOpenLate"] is True
        assert row["shortfallComponentCount"] == 2
        assert response.headers.get("x-contract-id") == "wm_operations.adherence_root_cause"


# ---------------------------------------------------------------------------
# Lineside Staging
# ---------------------------------------------------------------------------


class TestLinesideStagingRoute:
    async def test_returns_mapped_staging_rows(self, env) -> None:
        fake_row = {
            "plant_id": "C061",
            "line_id": "LINE_A",
            "order_id": "ORD030",
            "material_id": "FG001",
            "material_name": "Widget Alpha",
            "order_qty": "60.0",
            "uom": "KG",
            "scheduled_start_date": "2026-06-14",
            "tr_coverage_status": "FULL",
            "supply_status": "SUPPLIED",
            "readiness_status": "FULLY_STAGED",
            "component_count": "5",
            "wm_component_count": "4",
            "tr_count": "2",
            "staging_status": "FULL",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    LINESIDE_STAGING,
                    params={"plant_id": "C061", "line_id": "LINE_A"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["orderId"] == "ORD030"
        assert row["trCoverageStatus"] == "FULL"
        assert row["componentCount"] == 5
        assert row["trCount"] == 2
        assert response.headers.get("x-contract-id") == "wm_operations.order_readiness"


# ---------------------------------------------------------------------------
# Lineside Plan vs Actual
# ---------------------------------------------------------------------------


class TestLinesidePlanActualRoute:
    async def test_returns_mapped_plan_actual_rows(self, env) -> None:
        fake_row = {
            "plant_id": "C061",
            "line_id": "LINE_A",
            "order_id": "ORD040",
            "material_id": "FG001",
            "material_name": "Widget Alpha",
            "planned_qty": "100.0",
            "delivered_qty": "95.5",
            "uom": "KG",
            "yield_pct": "0.955",
            "has_goods_receipt": "true",
            "is_complete": "true",
            "scheduled_start_date": "2026-06-12",
            "scheduled_finish_date": "2026-06-12",
            "actual_finish_date": "2026-06-12",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    LINESIDE_PLAN_ACTUAL,
                    params={"plant_id": "C061", "line_id": "LINE_A"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["orderId"] == "ORD040"
        assert row["plannedQty"] == pytest.approx(100.0)
        assert row["deliveredQty"] == pytest.approx(95.5)
        assert row["yieldPct"] == pytest.approx(0.955)
        assert row["hasGoodsReceipt"] is True
        assert row["isComplete"] is True
        assert response.headers.get("x-contract-id") == "wm_operations.order_yield"


# ---------------------------------------------------------------------------
# Lineside Lines (picker — plant_id optional)
# ---------------------------------------------------------------------------


class TestLinesideLinesRoute:
    async def test_returns_mapped_lines(self, env) -> None:
        fake_row = {
            "plant_id": "C061",
            "line_id": "LINE_A",
            "line_label": "Line Alpha",
            "active_order_count": "2",
        }
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[fake_row]):
            async with _make_client() as client:
                response = await client.get(
                    LINESIDE_LINES,
                    params={"plant_id": "C061"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200
        row = response.json()[0]
        assert row["plantId"] == "C061"
        assert row["lineId"] == "LINE_A"
        assert row["lineLabel"] == "Line Alpha"
        assert row["activeOrderCount"] == 2
        assert response.headers.get("x-contract-id") == "wm_operations.lineside_lines"

    async def test_lines_does_not_require_line_id(self, env) -> None:
        """The lines endpoint must succeed with only plant_id (no line_id)."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    LINESIDE_LINES,
                    params={"plant_id": "C061"},
                    headers=_HEADERS,
                )
        assert response.status_code == 200

    async def test_lines_works_without_plant_id(self, env) -> None:
        """The lines endpoint works without plant_id (returns all accessible lines)."""
        with patch(_EXECUTE_PATCH, new_callable=AsyncMock, return_value=[]):
            async with _make_client() as client:
                response = await client.get(
                    LINESIDE_LINES,
                    headers=_HEADERS,
                )
        assert response.status_code == 200
