"""Minimum-viable route tests for the Trace App endpoints.

These tests cover the safety contract the review feedback asked for:
  - non-databricks mode returns 503
  - blank material_id / batch_id are rejected with 422 before any Databricks
    call is attempted
  - successful responses validate against the response_model
  - mappers emit the source-truthful field values (no overclaimed delivery
    status, no `recallRecommended: false`, no "KG" UOM default, etc.)
  - mappers' classification helpers behave correctly for the documented
    movement-code buckets

We deliberately mock the Databricks client at the lowest call site so the
route + mapper pipeline is exercised end-to-end without touching UAT.
"""
from __future__ import annotations

from unittest.mock import patch

import httpx
import pytest
from adapters.trace2.trace2_databricks_adapter import (
    _bucket_movement_type,
    build_batch_quality_passport,
    map_holds_ledger_rows,
    map_mass_balance_ledger_rows,
    map_recall_readiness_rows,
    map_supplier_batch_view,
)
from httpx import ASGITransport
from main import app


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


_HEADERS = {
    "x-forwarded-access-token": "user-bearer-token",
    "x-forwarded-user": "user123",
    "x-forwarded-email": "user@example.com",
}


def _databricks_env(monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
    monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
    monkeypatch.setenv("TRACE_SCHEMA", "gold")


_TRACE_APP_ENDPOINTS = [
    "/api/trace2/recall-readiness",
    "/api/trace2/supplier-batches",
    "/api/trace2/batch-quality-passport",
    "/api/trace2/mass-balance-ledger",
    "/api/trace2/investigation-timeline",
    "/api/trace2/holds-ledger",
]


@pytest.mark.parametrize("path", _TRACE_APP_ENDPOINTS)
async def test_non_databricks_mode_returns_503(path: str, monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
    async with _client() as c:
        response = await c.post(path, json={"material_id": "M1", "batch_id": "B1"}, headers=_HEADERS)
    assert response.status_code == 503


@pytest.mark.parametrize("path", _TRACE_APP_ENDPOINTS)
async def test_blank_material_id_returns_422(path: str, monkeypatch) -> None:
    _databricks_env(monkeypatch)
    async with _client() as c:
        response = await c.post(path, json={"material_id": "", "batch_id": "B1"}, headers=_HEADERS)
    assert response.status_code == 422


@pytest.mark.parametrize("path", _TRACE_APP_ENDPOINTS)
async def test_blank_batch_id_returns_422(path: str, monkeypatch) -> None:
    _databricks_env(monkeypatch)
    async with _client() as c:
        response = await c.post(path, json={"material_id": "M1", "batch_id": "   "}, headers=_HEADERS)
    assert response.status_code == 422


@pytest.mark.parametrize("path", _TRACE_APP_ENDPOINTS)
async def test_blank_inputs_do_not_call_databricks(path: str, monkeypatch) -> None:
    _databricks_env(monkeypatch)
    called: list[bool] = []

    async def _mock(*args, **kwargs):
        called.append(True)
        return []

    with patch(
        "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
        _mock,
    ):
        async with _client() as c:
            await c.post(path, json={"material_id": "", "batch_id": ""}, headers=_HEADERS)
    assert called == []


# ---------------------------------------------------------------------------
# Mapper / classifier tests — source-truthfulness checks
# ---------------------------------------------------------------------------

class TestMovementTypeBucketing:
    """Documented codes per panel: {101, 261, 601, 701, Z01}.

    Bucket reversals together with their primary code so the net is correct.
    Anything unknown falls into Z01 (and the UI must surface that bucket).
    """

    @pytest.mark.parametrize("code", ["101", "102", "131"])
    def test_production_bucket(self, code: str) -> None:
        assert _bucket_movement_type(code) == "101"

    @pytest.mark.parametrize("code", ["261", "262"])
    def test_consumption_bucket(self, code: str) -> None:
        assert _bucket_movement_type(code) == "261"

    @pytest.mark.parametrize("code", ["601", "602"])
    def test_dispatch_bucket(self, code: str) -> None:
        assert _bucket_movement_type(code) == "601"

    @pytest.mark.parametrize("code", ["701", "702", "711", "712"])
    def test_adjustment_bucket(self, code: str) -> None:
        assert _bucket_movement_type(code) == "701"

    @pytest.mark.parametrize("code", ["999", "ZZZ", "", None])
    def test_unknown_codes_fall_to_z01(self, code) -> None:
        assert _bucket_movement_type(code) == "Z01"


class TestMassBalanceLedgerMapping:
    def test_empty_rows_returns_none(self) -> None:
        assert map_mass_balance_ledger_rows([]) is None

    def test_signed_quantities_preserved(self) -> None:
        rows = [
            {"posting_date": "2024-03-08", "movement_type": "101", "quantity": 4000, "balance_qty": 4000, "uom": "KG"},
            {"posting_date": "2024-03-09", "movement_type": "261", "quantity": -120, "balance_qty": 3880, "uom": "KG"},
            {"posting_date": "2024-03-10", "movement_type": "601", "quantity": -500, "balance_qty": 3380, "uom": "KG"},
        ]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["kpi"]["produced"] == 4000
        assert result["kpi"]["consumed"] == -120
        assert result["kpi"]["shipped"] == -500

    def test_reconciliation_source_is_application_heuristic(self) -> None:
        rows = [
            {"posting_date": "2024-03-08", "movement_type": "101", "quantity": 100, "balance_qty": 100, "uom": "KG"},
        ]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["reconciliationSource"] == "application-heuristic"

    def test_reversals_do_not_disappear(self) -> None:
        rows = [
            {"posting_date": "2024-03-08", "movement_type": "101", "quantity": 4000, "balance_qty": 4000, "uom": "KG"},
            {"posting_date": "2024-03-09", "movement_type": "102", "quantity": -4000, "balance_qty": 0, "uom": "KG"},
        ]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        # Both rows are in the production bucket; they net to zero but both events remain.
        assert len(result["events"]) == 2
        assert result["kpi"]["postings"]["production"] == 2


class TestRecallReadinessMapping:
    def test_empty_rows_returns_none(self) -> None:
        assert map_recall_readiness_rows([]) is None

    def test_does_not_hardcode_recommendation(self) -> None:
        rows = [
            {
                "delivery": "8030000001",
                "customer_id": "C1",
                "customer_name": "Müller",
                "country_id": "DE",
                "country_name": "Germany",
                "abs_quantity": 100,
                "uom": "KG",
                "posting_date": "2024-03-14",
                "sales_order_id": "INV-1",
            },
        ]
        result = map_recall_readiness_rows(rows)
        assert result is not None
        # The mapper must NOT emit a boolean recall decision — that's governance.
        assert "recallRecommended" not in result
        # The replacement field must be the not-evaluated sentinel.
        assert result["recommendationStatus"] == "not-evaluated"

    def test_delivery_status_is_delivery_evidence_not_delivered(self) -> None:
        rows = [
            {
                "delivery": "8030000001",
                "customer_id": "C1",
                "customer_name": "Müller",
                "country_id": "DE",
                "country_name": "Germany",
                "abs_quantity": 100,
                "uom": "KG",
                "posting_date": "2024-03-14",
                "sales_order_id": "INV-1",
            },
        ]
        result = map_recall_readiness_rows(rows)
        assert result is not None
        delivery = result["deliveries"][0]
        # Source-truthfulness — we have a delivery RECORD, not a governed
        # operational status. Must NOT emit "delivered".
        assert delivery["status"] == "delivery-evidence"
        assert delivery["statusSource"] == "delivery-record-present"

    def test_country_aggregation(self) -> None:
        rows = [
            {"delivery": "1", "customer_id": "A", "customer_name": "A", "country_id": "DE",
             "country_name": "Germany", "abs_quantity": 100, "uom": "KG", "posting_date": "2024-03-14"},
            {"delivery": "2", "customer_id": "B", "customer_name": "B", "country_id": "DE",
             "country_name": "Germany", "abs_quantity": 50, "uom": "KG", "posting_date": "2024-03-15"},
            {"delivery": "3", "customer_id": "C", "customer_name": "C", "country_id": "FR",
             "country_name": "France", "abs_quantity": 25, "uom": "KG", "posting_date": "2024-03-16"},
        ]
        result = map_recall_readiness_rows(rows)
        assert result is not None
        assert result["totals"]["customers"] == 3
        assert result["totals"]["countries"] == 2
        assert result["totals"]["deliveries"] == 3
        de = next(c for c in result["countries"] if c["code"] == "DE")
        assert de["qty"] == 150


class TestSupplierBatchViewMapping:
    def test_empty_consumed_returns_valid_empty(self) -> None:
        result = map_supplier_batch_view([], [])
        assert result == {"consumedLots": [], "siblingBatches": []}

    def test_consumed_lots_use_abs_quantity(self) -> None:
        consumed = [
            {
                "supplier_id": "SUP1",
                "vendor_batch": "VB-001",
                "parent_material_id": "MAT-A",
                "quantity": -8800,
                "uom": "KG",
                "posting_date": "2024-02-28",
            },
        ]
        result = map_supplier_batch_view(consumed, [])
        assert result["consumedLots"][0]["consumed"] == 8800

    def test_risk_is_never_overclaimed_high(self) -> None:
        consumed = [
            {
                "supplier_id": "SUP1",
                "vendor_batch": "VB-001",
                "parent_material_id": "MAT-A",
                "quantity": -100,
                "uom": "KG",
                "posting_date": "2024-02-28",
            },
        ]
        result = map_supplier_batch_view(consumed, [])
        # No supplier-risk source exists yet; mapper should default to a safe
        # value, NOT 'high'.
        assert result["consumedLots"][0]["risk"] == "unknown"


class TestHoldsLedgerMapping:
    def test_uom_is_never_invented_as_kg(self) -> None:
        rows = [
            {
                "blocked": 100,
                "quality_inspection": 50,
                "restricted": 25,
                "inspection_lot_id": "LOT-1",
                "inspection_type": "QM",
                "inspection_short_text": "Routine",
                "usage_decision": None,
                "created_date": "2024-03-09",
                "inspection_end_date": None,
                "created_by": "QA-1",
            },
        ]
        result = map_holds_ledger_rows(rows)
        assert result is not None
        for bucket in result["qtyByReason"]:
            # Source-truthfulness — we have NO uom column on stock_v in this
            # join. The contract is nullable; the mapper MUST emit None, not
            # the (incorrect) "KG" default.
            assert bucket["uom"] is None
        for entry in result["activeHolds"] + result["resolvedHolds"]:
            assert entry["uom"] is None

    def test_active_vs_resolved_classification(self) -> None:
        rows = [
            {
                "blocked": 0, "quality_inspection": 100, "restricted": 0,
                "inspection_lot_id": "L1", "inspection_type": "QM",
                "inspection_short_text": "Pending", "usage_decision": None,
                "created_date": "2024-03-09", "inspection_end_date": None,
                "created_by": "QA-1",
            },
            {
                "blocked": 0, "quality_inspection": 100, "restricted": 0,
                "inspection_lot_id": "L2", "inspection_type": "QM",
                "inspection_short_text": "Pass", "usage_decision": "Accepted",
                "created_date": "2024-03-10", "inspection_end_date": "2024-03-12",
                "created_by": "QA-2",
            },
        ]
        result = map_holds_ledger_rows(rows)
        assert result is not None
        assert len(result["activeHolds"]) == 1
        assert len(result["resolvedHolds"]) == 1
        assert result["activeHolds"][0]["id"] == "L1"
        assert result["resolvedHolds"][0]["id"] == "L2"
        assert result["resolvedHolds"][0]["status"] == "released"


class TestBatchQualityPassportMapping:
    def test_uses_heuristic_status_and_no_placeholders(self) -> None:
        identity_rows = [{"batch_id": "B1", "material_id": "M1"}]
        coa_rows = []
        lots_rows = [{"inspection_lot_id": "L1", "usage_decision": "Accepted"}]
        summary_rows = []
        balance_rows = []

        result = build_batch_quality_passport(identity_rows, coa_rows, lots_rows, summary_rows, balance_rows)
        assert result is not None
        # Heuristic quality assertion
        assert "heuristicQualityConfidence" in result["quality"]
        assert "heuristicQualityStatus" in result["quality"]
        assert "overallStatus" not in result["quality"]

        # Usage decisions should only include actual lots, no "Release decision" / "Group QA" placeholders
        for ud in result["usageDecisionEvidence"]:
            assert ud.get("role") != "Group QA"
            assert ud.get("decisionType") != "Release decision"


class TestBatchQualityPassportRouteHappyPath:
    """End-to-end runtime check for the post-audit (2026-05-25) passport fix.

    The route fans out five sequential Databricks queries; before the fix
    the first query (partial spec) failed with UNRESOLVED_COLUMN because it
    referenced columns absent from the live gold_batch_summary_v and
    gold_batch_production_history_v views. This test mocks each sequential
    call's row payload using row shapes that match the post-audit SQL.
    """

    async def test_route_passes_partial_query_with_live_row_shape(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)

        identity_rows = [
            {
                "material_id": "20582002",
                "batch_id": "0008898869",
                "plant_id": "C351",
                "material_name": "Emmental cheese block",
                "plant_name": "Charleville",
                "manufacture_date": "2026-05-01",
                "expiry_date": "2026-11-01",
                "uom": "KG",
                "unrestricted": 100.0,
                "blocked": 0.0,
                "quality_inspection": 0.0,
                "restricted": 0.0,
                "transit": 0.0,
                # Post-audit production-history projection only.
                "process_order_id": "1000123456",
                "production_started_at": "2026-05-10",
                "production_actual_qty": 1200.5,
                "production_uom": "KG",
            }
        ]
        # CoA / lots / summary / balance rows can be empty — the route
        # builds a valid passport with empty evidence sections.
        side_effect_calls = [identity_rows, [], [], [], []]

        async def _mock_execute(*args, **kwargs):
            return side_effect_calls.pop(0)

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock_execute,
        ):
            async with _client() as c:
                response = await c.post(
                    "/api/trace2/batch-quality-passport",
                    json={"material_id": "20582002", "batch_id": "0008898869", "plant_id": ""},
                    headers=_HEADERS,
                )

        assert response.status_code == 200, response.text
        body = response.json()
        # Response body shape unchanged — every top-level section present.
        for section in ("identity", "quality", "stock", "production",
                         "lotHistory", "massBalance", "usageDecisionEvidence"):
            assert section in body, f"missing section {section!r}"
        # Live-sourced production fields surfaced.
        assert body["identity"]["processOrderId"] == "1000123456"
        assert body["production"]["orderId"] == "1000123456"
        assert body["production"]["startedAt"] == "2026-05-10"
        assert body["production"]["actualQty"] == 1200.5
        # Source-truthful null for fields with no live source — the Zod
        # schema was relaxed to nullable+optional in this PR so missing
        # production evidence is no longer faked with empty strings or 0.0.
        assert body["production"]["line"] is None
        assert body["production"]["operator"] is None
        assert body["production"]["confirmedAt"] is None
        assert body["production"]["plannedQty"] is None
        assert body["production"]["yield"] is None
        assert body["production"]["originatingCustomer"] is None
        assert body["production"]["notes"] is None
        # Standard Databricks observability headers still set.
        assert response.headers.get("x-adapter-mode") == "databricks-api"
        assert "trace2.get_batch_quality_passport_partial" in response.headers.get(
            "x-query-name", ""
        )


# ---------------------------------------------------------------------------
# OpenAPI registration
# ---------------------------------------------------------------------------

async def test_all_trace_app_routes_registered_in_openapi() -> None:
    async with _client() as c:
        response = await c.get("/openapi.json")
    schema = response.json()
    paths = set(schema["paths"].keys())
    for path in _TRACE_APP_ENDPOINTS:
        assert path in paths, f"Route {path} not present in OpenAPI"
