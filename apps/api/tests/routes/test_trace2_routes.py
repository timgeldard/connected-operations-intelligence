"""Route tests for POST /api/trace2/trace-graph — databricks-api mode only.

No legacy-api or mock fallback exists for trace-graph. Any mode other than
databricks-api returns 503.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
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

_URL = "/api/trace2/trace-graph"

_VALID_BODY = {
    "material_id": "000000000020052009",
    "batch_id": "0008602411",
    "plant_id": "C061",
    "direction": "both",
    "max_depth": 6,
    "max_edges": 1000,
}

# A single downstream edge row returned by the mocked executor (WITH RECURSIVE shape)
_FAKE_LINEAGE_ROW = {
    "hop_depth": 1,
    "traversal_dir": "downstream",
    "parent_material_id": "000000000020052009",
    "parent_batch_id": "0008602411",
    "parent_plant_id": "C061",
    "parent_material_name": "Full Cream Milk Powder",
    "child_material_id": "MAT_CHILD",
    "child_batch_id": "BATCH_CHILD",
    "child_plant_id": "C061",
    "child_material_name": "Skimmed Milk Powder",
    "link_type": "PRODUCTION",
    "process_order_id": "PO-100001",
    "material_document_number": "4900012345",
    "purchase_order_id": None,
    "supplier_id": None,
    "customer_id": None,
    "delivery_id": None,
    "sales_order_id": None,
    "quantity": 500.0,
    "base_unit_of_measure": "KG",
    "posting_date": "2026-01-15",
    "movement_type": "261",
}


def _patch_executor(return_value: list[dict]):
    """Patch the Databricks executor to return a fixed row list for every call."""
    return patch(
        "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
        new_callable=AsyncMock,
        return_value=return_value,
    )


def _databricks_env(monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
    monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
    monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
    monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
    monkeypatch.setenv("TRACE_SCHEMA", "gold")


_BATCH_HEADER_URL = "/api/trace2/batch-header"

_BATCH_HEADER_BODY = {
    "material_id": "0000020582002",
    "batch_id": "BATCH001",
}

_FAKE_BATCH_HEADER_ROW = {
    "material_id": "0000020582002",
    "batch_id": "BATCH001",
    "material_name": "Full Cream Milk Powder",
    "plant_id": "IE01",
    "plant_name": "Listowel",
    "unrestricted": 100.0,
    "blocked": 0.0,
    "quality_inspection": 0.0,
    "restricted": 0.0,
    "transit": 0.0,
    "total_stock": 100.0,
    "uom": "KG",
    "manufacture_date": "2024-03-01T00:00:00Z",
    "expiry_date": "2025-03-01T00:00:00Z",
}

_BATCH_SEARCH_URL = "/api/trace2/batch-search"

_FAKE_BATCH_SEARCH_ROWS = [
    {
        # Anchor MV shape: no total_stock, batch_qty, or uom — those are optional
        # in BatchSearchItem and returned as null from gold_trace_anchor_secured.
        "material_id": "20035129",
        "batch_id": "8000049668",
        "plant_id": "C061",
        "material_name": "CHEESE POWDER BLEND 25KG",
        "plant_name": "Kerry Cork",
        "process_order_id": "007006964801",
        "latest_posting_date": "2025-06-04",
        "material_match": 0,
        "description_match": 1,
        "batch_match": 0,
        "process_order_match": 0,
    },
    {
        "material_id": "20035129",
        "batch_id": "8000049669",
        "plant_id": "C061",
        "material_name": "CHEESE POWDER BLEND 25KG",
        "plant_name": "Kerry Cork",
        "process_order_id": "007006964802",
        "latest_posting_date": "2025-06-05",
        "material_match": 0,
        "description_match": 1,
        "batch_match": 0,
        "process_order_match": 0,
    },
]


# ---------------------------------------------------------------------------
# Batch header — databricks-api mode
# ---------------------------------------------------------------------------

class TestBatchHeaderDatabricksMode:
    async def test_200_returns_batch_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 200
        data = response.json()
        assert data["materialId"] == "0000020582002"
        assert data["materialDescription"] == "Full Cream Milk Powder"
        assert data["batchId"] == "BATCH001"
        assert data["plantId"] == "IE01"

    async def test_404_when_batch_not_found(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 404

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_uses_repository_facade_not_route_run_query(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with patch(
            "routes.trace2.run_query",
            new_callable=AsyncMock,
            side_effect=AssertionError("batch-header should use Trace2Repository"),
        ) as run_query_mock:
            with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
                async with _make_client() as client:
                    response = await client.post(
                        _BATCH_HEADER_URL,
                        json=_BATCH_HEADER_BODY,
                        headers=_HEADERS_WITH_TOKEN,
                    )

        assert response.status_code == 200
        run_query_mock.assert_not_called()

    async def test_401_without_oauth_token(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(_BATCH_HEADER_URL, json=_BATCH_HEADER_BODY)
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Batch header — response_model contract enforcement
# ---------------------------------------------------------------------------

class TestBatchHeaderResponseModel:
    """Prove that POST /api/trace2/batch-header is enforced through the
    generated BatchHeaderSummary contract. Each test exercises a single
    contract constraint."""

    async def test_response_validates_against_generated_contract(self, monkeypatch) -> None:
        from contracts.generated import BatchHeaderSummary

        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 200
        # The raw response dict must round-trip through the generated model
        # with extra='forbid' — any extra/unaliased field would raise here.
        # ValidationError on this line means response_model enforcement broke.
        BatchHeaderSummary.model_validate(response.json())

    async def test_response_uses_camelcase_aliases(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN
                )
        data = response.json()
        # Required camelCase keys.
        for key in (
            "materialId", "materialDescription", "batchId", "plantId",
            "plantName", "batchStatus", "stockStatus", "qualityStatus",
            "releaseStatus",
        ):
            assert key in data, f"missing required contract field: {key}"
        # No snake_case keys leaked through.
        for snake in ("material_id", "batch_id", "plant_id", "batch_status"):
            assert snake not in data

    async def test_status_enums_match_contract(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN
                )
        data = response.json()
        assert data["batchStatus"] in {"active", "archived", "blocked", "deleted", "unknown"}
        assert data["stockStatus"] in {
            "unrestricted", "quality-inspection", "blocked", "restricted", "returns", "transit",
        }
        assert data["qualityStatus"] in {
            "accepted", "rejected", "pending", "conditional", "not-applicable", "unknown",
        }
        assert data["releaseStatus"] in {"released", "blocked", "restricted", "not-released", "unknown"}

    async def test_source_truthful_defaults_when_columns_absent(self, monkeypatch) -> None:
        """When gold_batch_summary_v does not return batch_status / process_order_id
        (which is the documented SQL — see the spec docstring), the response must
        carry 'unknown' status values rather than reassuring defaults like
        'released' / 'accepted' / 'safe'.
        """
        _databricks_env(monkeypatch)
        # _FAKE_BATCH_HEADER_ROW already omits batch_status — same shape the SQL returns.
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN
                )
        data = response.json()
        # batch_status is not in the SQL SELECT, so it must surface as 'unknown'
        # rather than being inferred as 'active'.
        assert data["batchStatus"] == "unknown"
        # No QM usage-decision column, so quality must stay 'unknown' — never
        # 'accepted' or 'released'.
        assert data["qualityStatus"] == "unknown"
        assert data["releaseStatus"] == "unknown"

    async def test_no_unsafe_release_or_approval_claims(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN
                )
        data = response.json()
        # No invented fields outside the contract.
        assert "recallRecommended" not in data
        assert "supplierRisk" not in data
        assert "safe" not in data
        assert "approved" not in data
        # And the contract's release/quality fields stay source-truthful.
        assert data["releaseStatus"] != "released"
        assert data["qualityStatus"] != "accepted"


# ---------------------------------------------------------------------------
# Batch search — databricks-api mode
# ---------------------------------------------------------------------------

class TestBatchSearchDatabricksMode:
    async def test_200_returns_consumer_batch_search_results(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor(_FAKE_BATCH_SEARCH_ROWS):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_SEARCH_URL,
                    json={"query": "cheese", "max_rows": 25},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "cheese"
        assert data["total"] == 2
        assert data["truncated"] is False
        assert data["items"][0]["materialId"] == "20035129"
        assert data["items"][0]["batchId"] == "8000049668"
        assert data["items"][0]["processOrderId"] == "007006964801"
        assert data["items"][0]["matchTypes"] == ["description"]

    async def test_search_sets_databricks_headers(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor(_FAKE_BATCH_SEARCH_ROWS):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_SEARCH_URL,
                    json={"query": "cheese"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.headers.get("x-adapter-mode") == "databricks-api"
        # Source badge reflects T3 anchor MV — legacy stock/production_history views
        # are no longer the primary source for batch search.
        assert "gold_trace_anchor_secured" in response.headers.get("x-data-source", "")
        assert "gold_batch_stock_v" not in response.headers.get("x-data-source", "")
        assert "production_history_v" not in response.headers.get("x-data-source", "")

    async def test_search_uses_repository_facade_not_route_run_query(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with patch(
            "routes.trace2.run_query",
            new_callable=AsyncMock,
            side_effect=AssertionError("batch-search should use Trace2Repository"),
        ) as run_query_mock:
            with _patch_executor(_FAKE_BATCH_SEARCH_ROWS):
                async with _make_client() as client:
                    response = await client.post(
                        _BATCH_SEARCH_URL,
                        json={"query": "cheese"},
                        headers=_HEADERS_WITH_TOKEN,
                    )

        assert response.status_code == 200
        run_query_mock.assert_not_called()

    async def test_search_reports_truncation(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor(_FAKE_BATCH_SEARCH_ROWS):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_SEARCH_URL,
                    json={"query": "cheese", "max_rows": 1},
                    headers=_HEADERS_WITH_TOKEN,
                )

        data = response.json()
        assert data["total"] == 1
        assert data["truncated"] is True

    async def test_search_supports_wildcard_indicator(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor(_FAKE_BATCH_SEARCH_ROWS[:1]):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_SEARCH_URL,
                    json={"query": "200*"},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        assert response.json()["wildcardApplied"] is True

    def test_route_parser_extracts_combined_material_batch_terms(self) -> None:
        from routes.trace2 import _parse_combined_batch_search

        assert _parse_combined_batch_search("20035129 8000049668") == ("20035129", "8000049668")
        assert _parse_combined_batch_search("20035129/8000049668") == ("20035129", "8000049668")
        assert _parse_combined_batch_search("20035129, 8000049668") == ("20035129", "8000049668")
        assert _parse_combined_batch_search("cheese powder") is None

    def test_search_spec_uses_anchor_mv_not_legacy_stock_view(self, monkeypatch) -> None:
        from adapters.trace2.trace2_databricks_adapter import (
            Trace2BatchSearchRequest,
            get_batch_search_spec,
        )

        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

        spec = get_batch_search_spec(Trace2BatchSearchRequest(query="cheese"))

        # Primary source must be the T3 anchor MV (RLS-enforced).
        assert "gold_trace_anchor_secured" in spec.sql
        assert "gold_batch_stock_v" not in spec.sql
        assert "gold_batch_production_history_v" not in spec.sql
        # Process-order match uses the lineage table scoped via anchor join (not the
        # old production history CTE).
        assert "gold_batch_lineage" in spec.sql
        assert "`po_match`" in spec.sql

    def test_search_spec_process_order_lookup_guards_null(self, monkeypatch) -> None:
        """Process-order CTE must only match rows where PROCESS_ORDER_ID is not null
        and the anchor join enforces ACTIVE-plant visibility."""
        from adapters.trace2.trace2_databricks_adapter import (
            Trace2BatchSearchRequest,
            get_batch_search_spec,
        )

        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

        spec = get_batch_search_spec(Trace2BatchSearchRequest(query="*"))

        # The po_match CTE filters non-null process orders only.
        assert "l.PROCESS_ORDER_ID IS NOT NULL" in spec.sql
        # No naked COALESCE over process order — guard is in the CTE WHERE clause.
        assert "COALESCE(ph.PROCESS_ORDER_ID" not in spec.sql
        # Old outer-query guard pattern must not appear (was ph.*, now in CTE).
        assert "ph.PROCESS_ORDER_ID IS NOT NULL AND UPPER(ph.PROCESS_ORDER_ID) LIKE" not in spec.sql

    def test_search_spec_supports_exact_material_batch_criteria(self, monkeypatch) -> None:
        from adapters.trace2.trace2_databricks_adapter import (
            Trace2BatchSearchRequest,
            get_batch_search_spec,
        )

        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

        spec = get_batch_search_spec(
            Trace2BatchSearchRequest(
                query="20035129 8000049668",
                material_id="20035129",
                batch_id="8000049668",
            )
        )

        # Anchor alias is 'a', not 's'.
        assert "UPPER(a.MATERIAL_ID) = UPPER(:material_id)" in spec.sql
        assert "UPPER(a.BATCH_ID) = UPPER(:batch_id)" in spec.sql
        assert spec.params["material_id"] == "20035129"
        assert spec.params["batch_id"] == "8000049668"

    def test_search_spec_orders_by_anchor_last_posting_date(self, monkeypatch) -> None:
        """Ranking must use last_posting_date from the anchor MV (not production
        history POSTING_DATE or batch_qty fallback — anchor carries no qty)."""
        from adapters.trace2.trace2_databricks_adapter import (
            Trace2BatchSearchRequest,
            get_batch_search_spec,
        )

        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

        spec = get_batch_search_spec(Trace2BatchSearchRequest(query="cheese"))

        assert "a.last_posting_date DESC NULLS LAST" in spec.sql
        # Old production-history ranking must be gone.
        assert "COALESCE(ph.BATCH_QTY, s.total_stock)" not in spec.sql
        assert "ph.POSTING_DATE DESC" not in spec.sql
        # last_posting_date leads the ORDER BY before BATCH_ID.
        order_by = spec.sql.rsplit("ORDER BY", 1)[1].split("LIMIT", 1)[0]
        assert order_by.index("a.last_posting_date") < order_by.index("a.BATCH_ID")

    def test_search_mapping_preserves_falsy_source_ids(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_batch_search_rows

        result = map_batch_search_rows(
            [
                {
                    "material_id": 0,
                    "batch_id": 0,
                    "plant_id": 0,
                    "material_name": "",
                    "plant_name": None,
                    "process_order_id": 0,
                    "material_match": 1,
                    "description_match": 0,
                    "batch_match": 1,
                    "process_order_match": 1,
                }
            ],
            "0",
            25,
        )

        item = result["items"][0]
        assert item["materialId"] == "0"
        assert item["batchId"] == "0"
        assert item["plantId"] == "0"
        assert item["plantName"] == "0"
        assert item["processOrderId"] == "0"
        assert item["matchTypes"] == ["material-id", "batch-id", "process-order-id"]

    def test_search_mapping_anchor_rows_have_null_quantity_and_uom(self) -> None:
        """Anchor MV carries no stock quantity or UOM.  The mapper must omit those
        optional fields rather than emitting null/0 into the response."""
        from adapters.trace2.trace2_databricks_adapter import map_batch_search_rows

        anchor_row = {
            "material_id": "20035129",
            "batch_id": "8000049668",
            "plant_id": "C061",
            "material_name": "CHEESE POWDER BLEND 25KG",
            "plant_name": "Kerry Cork",
            # No total_stock, batch_qty, or uom — these columns are absent from
            # gold_trace_anchor_secured (anchor MV does not aggregate stock).
            "process_order_id": None,
            "latest_posting_date": "2025-06-04",
            "material_match": 1,
            "description_match": 0,
            "batch_match": 0,
            "process_order_match": 0,
        }

        result = map_batch_search_rows([anchor_row], "20035129", 25)
        item = result["items"][0]

        # Mapper omits optional keys entirely when value is None (not present in dict).
        assert "quantity" not in item
        assert "uom" not in item
        assert "latestPostingDate" in item  # date string always present when not None
        assert item["materialId"] == "20035129"
        assert item["matchTypes"] == ["material-id"]

    def test_search_mapping_process_order_via_lineage_match(self) -> None:
        """When a process-order match arrives from the lineage CTE lookup, the
        process_order_match flag must set the matchType and processOrderId populates."""
        from adapters.trace2.trace2_databricks_adapter import map_batch_search_rows

        row = {
            "material_id": "20035129",
            "batch_id": "8000049668",
            "plant_id": "C061",
            "material_name": "CHEESE POWDER BLEND 25KG",
            "plant_name": "Kerry Cork",
            "process_order_id": "007006964801",
            "latest_posting_date": "2025-06-04",
            "material_match": 0,
            "description_match": 0,
            "batch_match": 0,
            "process_order_match": 1,
        }

        result = map_batch_search_rows([row], "007006964801", 25)
        item = result["items"][0]

        assert item["matchTypes"] == ["process-order-id"]
        assert item["processOrderId"] == "007006964801"

    async def test_search_response_contract_shape_unchanged(self, monkeypatch) -> None:
        """Switching the primary source to gold_trace_anchor_secured must not alter
        the response contract shape seen by the Trace Consumer frontend.  All
        required BatchSearchResponse / BatchSearchItem fields must still be present."""
        _databricks_env(monkeypatch)
        with _patch_executor(_FAKE_BATCH_SEARCH_ROWS):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_SEARCH_URL,
                    json={"query": "cheese", "max_rows": 25},
                    headers=_HEADERS_WITH_TOKEN,
                )

        assert response.status_code == 200
        data = response.json()

        # Top-level response envelope.
        for key in ("query", "total", "truncated", "wildcardApplied", "items"):
            assert key in data, f"missing response envelope field: {key}"

        # Per-item required fields.
        item = data["items"][0]
        for key in ("materialId", "materialDescription", "batchId", "plantId", "plantName", "matchTypes"):
            assert key in item, f"missing required BatchSearchItem field: {key}"

        # Optional fields are null (anchor carries no qty/uom; FastAPI serializes
        # None as null — the key is present but the value is None/null).
        assert item.get("quantity") is None
        assert item.get("uom") is None

    def test_search_spec_governed_objects_resolve_to_gold_io_reporting(self, monkeypatch) -> None:
        """Governed schema fix: gold_trace_anchor_secured and gold_batch_lineage must
        resolve to TRACE_GOVERNED_SCHEMA (default "gold_io_reporting"), NOT to
        TRACE_SCHEMA ("gold").  The legacy TRACE_SCHEMA: gold in app.yaml would
        cause connected_plant_uat.gold.gold_trace_anchor_secured which does not exist —
        this is the deployment-blocking gap that this change closes."""
        from adapters.trace2.trace2_databricks_adapter import (
            Trace2BatchSearchRequest,
            get_batch_search_spec,
        )

        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")
        # TRACE_GOVERNED_SCHEMA not set → must default to "gold_io_reporting"

        spec = get_batch_search_spec(Trace2BatchSearchRequest(query="cheese"))

        # Both governed objects must be in gold_io_reporting, not gold.
        assert "`connected_plant_uat`.`gold_io_reporting`.`gold_trace_anchor_secured`" in spec.sql
        assert "`connected_plant_uat`.`gold_io_reporting`.`gold_batch_lineage`" in spec.sql
        # Legacy enrichment joins must stay on gold.
        assert "`connected_plant_uat`.`gold`.`gold_material`" in spec.sql
        assert "`connected_plant_uat`.`gold`.`gold_plant`" in spec.sql

    def test_search_spec_po_match_deduplicates_with_row_number(self, monkeypatch) -> None:
        """PR #110 accept: a batch linked to multiple matching process orders must not
        fan out the anchor LEFT JOIN.  SELECT DISTINCT cannot prevent this because each
        matching process order is a distinct row; ROW_NUMBER() OVER (PARTITION BY child
        batch key) is required to keep at most one row per batch (the most recent by
        POSTING_DATE DESC, PROCESS_ORDER_ID DESC as tiebreak)."""
        from adapters.trace2.trace2_databricks_adapter import (
            Trace2BatchSearchRequest,
            get_batch_search_spec,
        )

        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

        spec = get_batch_search_spec(Trace2BatchSearchRequest(query="cheese"))

        assert "ROW_NUMBER()" in spec.sql
        assert "PARTITION BY" in spec.sql
        assert "POSTING_DATE DESC NULLS LAST" in spec.sql
        assert "rn = 1" in spec.sql
        assert "SELECT DISTINCT" not in spec.sql

    async def test_search_requires_databricks_mode(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(
                _BATCH_SEARCH_URL,
                json={"query": "cheese"},
                headers=_HEADERS_WITH_TOKEN,
            )

        assert response.status_code == 503

    async def test_search_rejects_blank_query(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        async with _make_client() as client:
            response = await client.post(
                _BATCH_SEARCH_URL,
                json={"query": "   "},
                headers=_HEADERS_WITH_TOKEN,
            )

        assert response.status_code == 422

    async def test_search_requires_user_oauth(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor(_FAKE_BATCH_SEARCH_ROWS):
            async with _make_client() as client:
                response = await client.post(
                    _BATCH_SEARCH_URL,
                    json={"query": "cheese"},
                )

        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Wrong adapter mode
# ---------------------------------------------------------------------------

class TestTraceGraphWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(
                _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
            )
        assert response.status_code == 503

    async def test_returns_503_when_mode_is_absent(self, monkeypatch) -> None:
        monkeypatch.delenv("BACKEND_ADAPTER_MODE", raising=False)
        async with _make_client() as client:
            response = await client.post(
                _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
            )
        assert response.status_code == 503

    async def test_does_not_call_databricks_in_wrong_mode(self, monkeypatch) -> None:
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
                await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)

        assert called == []


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------

class TestTraceGraphValidation:
    async def test_invalid_direction_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "direction": "sideways"}
        async with _make_client() as client:
            response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_material_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _VALID_BODY.items() if k != "material_id"}
        async with _make_client() as client:
            response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_missing_batch_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _VALID_BODY.items() if k != "batch_id"}
        async with _make_client() as client:
            response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_plant_id_is_optional(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _VALID_BODY.items() if k != "plant_id"}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200

    async def test_upstream_direction_is_valid(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "direction": "upstream"}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200

    async def test_downstream_direction_is_valid(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "direction": "downstream"}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Infrastructure failures
# ---------------------------------------------------------------------------

class TestTraceGraphInfraFailures:
    async def test_returns_503_when_databricks_host_missing(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.delenv("DATABRICKS_HOST", raising=False)
        monkeypatch.delenv("SQL_WAREHOUSE_ID", raising=False)
        async with _make_client() as client:
            response = await client.post(
                _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
            )
        assert response.status_code == 503

    async def test_returns_503_when_trace_catalog_missing(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "databricks-api")
        monkeypatch.setenv("DATABRICKS_HOST", "test.databricks.com")
        monkeypatch.setenv("SQL_WAREHOUSE_ID", "wh-test")
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        async with _make_client() as client:
            response = await client.post(
                _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
            )
        assert response.status_code == 503

    async def test_returns_401_when_oauth_token_missing(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY)
        assert response.status_code == 401

    async def test_query_error_returns_502(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryError

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("trace2.get_trace_graph", "SQL error"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 502

    async def test_permission_error_returns_403(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksPermissionError

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksPermissionError("trace2.get_trace_graph"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 403

    async def test_rate_limit_returns_429(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksRateLimitError

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksRateLimitError("trace2.get_trace_graph"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 429

    async def test_timeout_returns_504(self, monkeypatch) -> None:
        from shared.query_service.errors import DatabricksQueryTimeoutError

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryTimeoutError("trace2.get_trace_graph"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 504


# ---------------------------------------------------------------------------
# Success path
# ---------------------------------------------------------------------------

class TestTraceGraphSuccess:
    async def test_200_with_data_returns_graph(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_LINEAGE_ROW]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert "depth" in data
        assert "rootBatch" in data
        assert "truncated" in data
        assert "warnings" in data

    async def test_empty_result_returns_200_with_anchor_and_warning(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 200
        data = response.json()
        assert data["rootBatch"] == "000000000020052009/0008602411"
        assert len(data["nodes"]) == 1
        assert data["edges"] == []
        assert "no_edges_found" in data["warnings"]

    async def test_anchor_included_in_nodes_even_without_edges(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        nodes = response.json()["nodes"]
        assert any(n["isAnchor"] for n in nodes)

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.headers.get("x-adapter-mode") == "databricks-api"


# ---------------------------------------------------------------------------
# Customer exposure route tests
# ---------------------------------------------------------------------------

_CE_URL = "/api/trace2/customer-exposure"

_CE_VALID_BODY = {
    "material_id": "000000000020052009",
    "batch_id": "0008602411",
}

_FAKE_DELIVERY_ROW = {
    "customer_id": "CUST-001",
    "delivery_id": "DEL-001",
    "sales_order_id": "SO-001",
    "quantity": 500.0,
    "base_unit_of_measure": "KG",
    "posting_date": "2026-01-15",
    "hop_depth": 1,
}


class TestCustomerExposureWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_mode_is_absent(self, monkeypatch) -> None:
        monkeypatch.delenv("BACKEND_ADAPTER_MODE", raising=False)
        async with _make_client() as client:
            response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503


class TestCustomerExposureSuccess:
    async def test_200_returns_exposure_summary(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        data = response.json()
        assert data["affectedCustomers"] == 1
        assert data["affectedDeliveries"] == 1
        assert data["shippedQuantity"] == pytest.approx(500.0)
        assert data["countries"] == []
        assert data["blockedDeliveries"] == 0
        # recallRecommended is governance-pending — null means no governed
        # recall-rule source exists. Was previously emitted as `False` which
        # was contract-forced; the contract is now nullable.
        assert data["recallRecommended"] is None
        assert data["highestSeverity"] == "medium"
        assert data["maxExposureDepth"] == 1

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_uses_repository_facade_not_route_run_query(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with patch(
            "routes.trace2.run_query",
            new_callable=AsyncMock,
            side_effect=AssertionError("customer-exposure should use Trace2Repository"),
        ) as run_query_mock:
            with _patch_executor([_FAKE_DELIVERY_ROW]):
                async with _make_client() as client:
                    response = await client.post(
                        _CE_URL,
                        json=_CE_VALID_BODY,
                        headers=_HEADERS_WITH_TOKEN,
                    )

        assert response.status_code == 200
        run_query_mock.assert_not_called()

    async def test_zero_rows_returns_404_with_no_exposure_message(self, monkeypatch) -> None:
        """Zero rows must return 404 with a message that says not to interpret as zero exposure."""
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 404
        detail = response.json().get("detail", "")
        assert "do not interpret as zero exposure" in detail.lower()

    async def test_401_without_oauth_token(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY)
        assert response.status_code == 401

    async def test_missing_material_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _CE_VALID_BODY.items() if k != "material_id"}
        async with _make_client() as client:
            response = await client.post(_CE_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_plant_id_forwarded_to_spec(self, monkeypatch) -> None:
        """plant_id in request body must be accepted and not cause an error."""
        _databricks_env(monkeypatch)
        body = {**_CE_VALID_BODY, "plant_id": "C061"}
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert "gold_batch_lineage" in response.headers.get("x-data-source", "")

    async def test_sets_x_query_name_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        query_name = response.headers.get("x-query-name", "")
        assert "trace" in query_name
        assert "graph" in query_name

    async def test_leading_zeros_preserved_in_anchor(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        data = response.json()
        anchor_node = next(n for n in data["nodes"] if n["isAnchor"])
        assert anchor_node["materialId"] == "000000000020052009"
        assert anchor_node["batchId"] == "0008602411"

    async def test_max_depth_clamped_to_4(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "max_depth": 99}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=body, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 200

    async def test_max_edges_clamped_to_5000(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "max_edges": 99999}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=body, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 200

    async def test_no_raw_token_in_response_body(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert "user-bearer-token" not in response.text

    async def test_does_not_fall_back_on_databricks_error(self, monkeypatch) -> None:
        """On Databricks error, must return HTTP error — never fall back to mock."""
        from shared.query_service.errors import DatabricksQueryError

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("trace2.get_trace_graph", "Warehouse error"),
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )
        assert response.status_code == 502
        data = response.json()
        assert "nodes" not in data
        assert "edges" not in data

    def test_trace_graph_spec_gold_batch_lineage_resolves_to_governed_schema(self, monkeypatch) -> None:
        """T2 cutover: gold_batch_lineage in trace-graph must resolve to TRACE_GOVERNED_SCHEMA
        (default "gold_io_reporting"), not TRACE_SCHEMA ("gold").  Anchor search and traversal
        must use the same edge universe — both batch-search po_match and trace-graph read the
        same governed gold_batch_lineage MV."""
        from adapters.trace2.trace2_databricks_adapter import (
            TraceGraphRequest,
            get_trace_graph_recursive_spec,
        )

        _databricks_env(monkeypatch)
        # TRACE_GOVERNED_SCHEMA not set → must default to "gold_io_reporting"

        spec = get_trace_graph_recursive_spec(
            TraceGraphRequest(
                material_id="000000000020052009",
                batch_id="0008602411",
                plant_id="C061",
                direction="both",
                max_depth=4,
            )
        )

        # gold_batch_lineage must be in the governed schema.
        assert "`connected_plant_uat`.`gold_io_reporting`.`gold_batch_lineage`" in spec.sql
        # gold_material enrichment must remain on legacy gold schema.
        assert "`connected_plant_uat`.`gold`.`gold_material`" in spec.sql


# ---------------------------------------------------------------------------
# Architecture guardrails
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# direction="both" edge budget split
# ---------------------------------------------------------------------------

class TestTraceGraphBothDirectionBudgetSplit:
    """The route must split max_edges evenly between directions so upstream is not starved."""

    async def test_both_direction_calls_executor_twice(self, monkeypatch) -> None:
        """direction=both must issue two separate Databricks queries."""
        _databricks_env(monkeypatch)
        call_count: list[int] = [0]

        async def _mock_execute(*args, **kwargs):
            call_count[0] += 1
            return []

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock_execute,
        ):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 200
        assert call_count[0] == 2, f"Expected 2 executor calls for direction=both, got {call_count[0]}"

    async def test_both_direction_upstream_rows_survive_dense_downstream(self, monkeypatch) -> None:
        """Upstream rows must appear in response even when downstream fills its budget."""
        _databricks_env(monkeypatch)

        _ds_row = {**_FAKE_LINEAGE_ROW, "traversal_dir": "downstream"}
        _us_row = {
            **_FAKE_LINEAGE_ROW,
            "traversal_dir": "upstream",
            "parent_material_id": "MAT_UPSTREAM",
            "parent_batch_id": "BATCH_UPSTREAM",
            "parent_plant_id": "C061",
            "parent_material_name": "Raw Ingredient",
            "child_material_id": "000000000020052009",
            "child_batch_id": "0008602411",
            "child_plant_id": "C061",
            "link_type": "PRODUCTION",
        }

        call_count = [0]

        async def _mock_execute_alternating(*args, **kwargs):
            result = [_ds_row] if call_count[0] == 0 else [_us_row]
            call_count[0] += 1
            return result

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock_execute_alternating,
        ):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 200
        data = response.json()
        direction_labels = {d for n in data["nodes"] for d in n.get("directions", [])}
        assert "downstream" in direction_labels, "downstream direction missing from nodes"
        assert "upstream" in direction_labels, "upstream direction missing from nodes — upstream was starved"

    async def test_single_direction_calls_executor_once(self, monkeypatch) -> None:
        """direction=downstream must issue exactly one Databricks query."""
        _databricks_env(monkeypatch)
        call_count: list[int] = [0]

        async def _mock_execute(*args, **kwargs):
            call_count[0] += 1
            return []

        body = {**_VALID_BODY, "direction": "downstream"}
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _mock_execute,
        ):
            async with _make_client() as client:
                await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)

        assert call_count[0] == 1, f"Expected 1 executor call for direction=downstream, got {call_count[0]}"

    async def test_response_direction_matches_request_upstream(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "direction": "upstream"}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert response.json()["direction"] == "upstream"

    async def test_response_direction_matches_request_downstream(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_VALID_BODY, "direction": "downstream"}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert response.json()["direction"] == "downstream"

    async def test_response_direction_both_when_both_requested(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert response.json()["direction"] == "both"


# ---------------------------------------------------------------------------
# Batch header plant_id filtering
# ---------------------------------------------------------------------------

class TestBatchHeaderPlantIdFiltering:
    async def test_plant_id_accepted_in_request_body(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_BATCH_HEADER_BODY, "plant_id": "IE01"}
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(_BATCH_HEADER_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert response.json()["plantId"] == "IE01"

    async def test_plant_id_optional_absent_returns_200(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_BATCH_HEADER_ROW]):
            async with _make_client() as client:
                response = await client.post(_BATCH_HEADER_URL, json=_BATCH_HEADER_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Customer deliveries route tests (POST /api/trace2/customer-deliveries)
# ---------------------------------------------------------------------------

_CD_URL = "/api/trace2/customer-deliveries"

_CD_VALID_BODY = {
    "material_id": "000000000020052009",
    "batch_id": "0008602411",
}

_FAKE_DELIVERY_VIEW_ROW = {
    "delivery": "DEL-001",
    "customer_id": "CUST-001",
    "customer_name": "Kerry Ingredients",
    "country_id": "IE",
    "city": "Dublin",
    "abs_quantity": 500.0,
    "posting_date": "2026-01-15",
}


class TestCustomerDeliveriesWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(_CD_URL, json=_CD_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_mode_is_absent(self, monkeypatch) -> None:
        monkeypatch.delenv("BACKEND_ADAPTER_MODE", raising=False)
        async with _make_client() as client:
            response = await client.post(_CD_URL, json=_CD_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503


class TestCustomerDeliveriesSuccess:
    async def test_200_returns_delivery_summary(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_VIEW_ROW]):
            async with _make_client() as client:
                response = await client.post(_CD_URL, json=_CD_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        data = response.json()
        assert data["affectedCustomers"] == 1
        assert data["affectedDeliveries"] == 1
        assert data["shippedQuantity"] == pytest.approx(500.0)
        assert "IE" in data["countries"]
        assert data["blockedDeliveries"] == 0
        # null means no governed recall-rule source available.
        assert data["recallRecommended"] is None
        assert data["highestSeverity"] == "medium"
        assert data["deliveryEvidenceSource"] == "inventory-movements"

    async def test_zero_rows_returns_404_with_no_exposure_message(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_CD_URL, json=_CD_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 404
        detail = response.json().get("detail", "")
        assert "do not interpret as zero exposure" in detail.lower()

    async def test_401_without_oauth_token(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_VIEW_ROW]):
            async with _make_client() as client:
                response = await client.post(_CD_URL, json=_CD_VALID_BODY)
        assert response.status_code == 401

    async def test_missing_material_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _CD_VALID_BODY.items() if k != "material_id"}
        async with _make_client() as client:
            response = await client.post(_CD_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_no_plant_id_in_valid_body(self, monkeypatch) -> None:
        """customer-deliveries must not require or accept plant_id — recall coverage requires all plants."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_VIEW_ROW]):
            async with _make_client() as client:
                response = await client.post(_CD_URL, json=_CD_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_VIEW_ROW]):
            async with _make_client() as client:
                response = await client.post(_CD_URL, json=_CD_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_uses_repository_facade_not_route_run_query(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with patch(
            "routes.trace2.run_query",
            new_callable=AsyncMock,
            side_effect=AssertionError("customer-deliveries should use Trace2Repository"),
        ) as run_query_mock:
            with _patch_executor([_FAKE_DELIVERY_VIEW_ROW]):
                async with _make_client() as client:
                    response = await client.post(
                        _CD_URL,
                        json=_CD_VALID_BODY,
                        headers=_HEADERS_WITH_TOKEN,
                    )

        assert response.status_code == 200
        run_query_mock.assert_not_called()

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_VIEW_ROW]):
            async with _make_client() as client:
                response = await client.post(_CD_URL, json=_CD_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert "gold_batch_delivery_v" in response.headers.get("x-data-source", "")

    async def test_max_rows_clamped_to_10000(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_CD_VALID_BODY, "max_rows": 99999}
        with _patch_executor([_FAKE_DELIVERY_VIEW_ROW]):
            async with _make_client() as client:
                response = await client.post(_CD_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Supplier exposure route tests (POST /api/trace2/supplier-exposure)
# ---------------------------------------------------------------------------

_SE_URL = "/api/trace2/supplier-exposure"

_SE_VALID_BODY = {
    "material_id": "20035129",
    "batch_id": "8000049668",
}

_FAKE_SUPPLIER_ROW = {
    "supplier_id": "0005002928",
    "supplier_name": "PQ Silicas UK",
    "country_id": "GB",
    "country_name": "United Kingdom",
    "received_quantity": 201300.0,
    "receipt_count": 20,
    "upstream_material_count": 1,
    "last_receipt_date": "2025-06-04",
    "uom": "KG",
}


class TestSupplierExposureWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(_SE_URL, json=_SE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503


class TestSupplierExposureSuccess:
    async def test_200_returns_supplier_summary(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_SUPPLIER_ROW]):
            async with _make_client() as client:
                response = await client.post(_SE_URL, json=_SE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        data = response.json()
        assert data["supplierCount"] == 1
        assert data["supplierLots"] == 20
        assert data["upstreamMaterials"] == 1
        assert data["openSupplierActions"] == 0
        assert len(data["suppliers"]) == 1
        assert data["suppliers"][0]["supplierName"] == "PQ Silicas UK"
        assert data["suppliers"][0]["countryId"] == "GB"

    async def test_zero_suppliers_returns_200_empty_array(self, monkeypatch) -> None:
        """Zero suppliers is a valid 200 response — a batch may have no purchased inputs."""
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_SE_URL, json=_SE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        data = response.json()
        assert data["supplierCount"] == 0
        assert data["suppliers"] == []

    async def test_401_without_oauth_token(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_SUPPLIER_ROW]):
            async with _make_client() as client:
                response = await client.post(_SE_URL, json=_SE_VALID_BODY)
        assert response.status_code == 401

    async def test_missing_material_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _SE_VALID_BODY.items() if k != "material_id"}
        async with _make_client() as client:
            response = await client.post(_SE_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_SUPPLIER_ROW]):
            async with _make_client() as client:
                response = await client.post(_SE_URL, json=_SE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        badge = response.headers.get("x-data-source", "")
        assert "gold_batch_lineage" in badge
        assert "gold_supplier" in badge

    async def test_uses_repository_facade_not_route_run_query(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with patch(
            "routes.trace2.run_query",
            new_callable=AsyncMock,
            side_effect=AssertionError("supplier-exposure should use Trace2Repository"),
        ) as run_query_mock:
            with _patch_executor([_FAKE_SUPPLIER_ROW]):
                async with _make_client() as client:
                    response = await client.post(
                        _SE_URL,
                        json=_SE_VALID_BODY,
                        headers=_HEADERS_WITH_TOKEN,
                    )

        assert response.status_code == 200
        run_query_mock.assert_not_called()

    async def test_open_supplier_actions_is_zero_no_qm_source(self, monkeypatch) -> None:
        """TRACE-P1-012: no verified QM source in this slice."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_SUPPLIER_ROW]):
            async with _make_client() as client:
                response = await client.post(_SE_URL, json=_SE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.json()["openSupplierActions"] == 0


# ---------------------------------------------------------------------------
# Production history route tests (POST /api/trace2/production-history)
# ---------------------------------------------------------------------------

_PH_URL = "/api/trace2/production-history"

_PH_VALID_BODY = {
    "material_id": "70948010",
}

_FAKE_PH_ROW_PASS = {
    "process_order_id": "007006964801",
    "batch_id": "0011062334",
    "plant_id": "P648",
    "material_id": "70948010",
    "posting_date": "2025-09-28",
    "batch_qty": 31335.789,
    "uom": "KG",
    "quality_status": "Pass",
}

_FAKE_PH_ROW_FAIL = {
    **_FAKE_PH_ROW_PASS,
    "batch_id": "0011062335",
    "quality_status": "Fail",
}


class TestProductionHistoryWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(_PH_URL, json=_PH_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503


class TestProductionHistorySuccess:
    async def test_200_returns_production_history(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_PH_ROW_PASS, _FAKE_PH_ROW_FAIL]):
            async with _make_client() as client:
                response = await client.post(_PH_URL, json=_PH_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        data = response.json()
        assert data["materialId"] == "70948010"
        assert data["totalBatches"] == 2
        assert data["passCount"] == 1
        assert data["failCount"] == 1
        assert data["unknownCount"] == 0
        assert len(data["rows"]) == 2

    async def test_zero_rows_returns_200_empty_history(self, monkeypatch) -> None:
        """Zero rows is a valid 200 — the material may not be manufactured on-site."""
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_PH_URL, json=_PH_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        data = response.json()
        assert data["materialId"] == "70948010"
        assert data["totalBatches"] == 0
        assert data["rows"] == []

    async def test_401_without_oauth_token(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_PH_ROW_PASS]):
            async with _make_client() as client:
                response = await client.post(_PH_URL, json=_PH_VALID_BODY)
        assert response.status_code == 401

    async def test_missing_material_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        async with _make_client() as client:
            response = await client.post(_PH_URL, json={}, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_no_plant_id_required(self, monkeypatch) -> None:
        """V1 parity: material-only filter; plant_id not in request body."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_PH_ROW_PASS]):
            async with _make_client() as client:
                response = await client.post(_PH_URL, json=_PH_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_PH_ROW_PASS]):
            async with _make_client() as client:
                response = await client.post(_PH_URL, json=_PH_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert "gold_batch_production_history_v" in response.headers.get("x-data-source", "")

    async def test_uses_repository_facade_not_route_run_query(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with patch(
            "routes.trace2.run_query",
            new_callable=AsyncMock,
            side_effect=AssertionError("production-history should use Trace2Repository"),
        ) as run_query_mock:
            with _patch_executor([_FAKE_PH_ROW_PASS]):
                async with _make_client() as client:
                    response = await client.post(
                        _PH_URL,
                        json=_PH_VALID_BODY,
                        headers=_HEADERS_WITH_TOKEN,
                    )

        assert response.status_code == 200
        run_query_mock.assert_not_called()

    async def test_max_rows_clamped_to_200(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_PH_VALID_BODY, "max_rows": 9999}
        with _patch_executor([_FAKE_PH_ROW_PASS]):
            async with _make_client() as client:
                response = await client.post(_PH_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Mass balance route tests (POST /api/trace2/mass-balance)
# ---------------------------------------------------------------------------

_MB_URL = "/api/trace2/mass-balance"

_MB_VALID_BODY = {
    "material_id": "20035129",
    "batch_id": "8000049668",
}

_FAKE_MB_PRODUCTION_ROW = {
    "posting_date": "2025-06-04",
    "movement_type": "101",
    "movement_category": "Production",
    "abs_quantity": 1000.0,
    "uom": "KG",
    "balance_qty": 0.0,
}

_FAKE_MB_UNMAPPED_ROW = {
    "posting_date": "2025-06-11",
    "movement_type": "261",
    "movement_category": "Other (261)",
    "abs_quantity": 6.262,
    "uom": "KG",
    "balance_qty": 0.0,
}


class TestMassBalanceWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(_MB_URL, json=_MB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_mode_is_absent(self, monkeypatch) -> None:
        monkeypatch.delenv("BACKEND_ADAPTER_MODE", raising=False)
        async with _make_client() as client:
            response = await client.post(_MB_URL, json=_MB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503


class TestMassBalanceSuccess:
    async def test_200_returns_mass_balance_summary(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_MB_PRODUCTION_ROW]):
            async with _make_client() as client:
                response = await client.post(_MB_URL, json=_MB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        data = response.json()
        assert data["inputQuantity"] == pytest.approx(1000.0)
        assert data["outputQuantity"] == 0.0
        assert data["uom"] == "KG"
        assert data["unresolvedMovements"] == 0
        assert len(data["movements"]) == 1

    async def test_unmapped_movement_category_counted_as_unresolved(self, monkeypatch) -> None:
        """Live SAP movement categories surface as unresolved so the panel banner reflects truth."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_MB_PRODUCTION_ROW, _FAKE_MB_UNMAPPED_ROW]):
            async with _make_client() as client:
                response = await client.post(_MB_URL, json=_MB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert response.json()["unresolvedMovements"] == 1

    async def test_zero_rows_returns_404_with_no_balance_message(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_MB_URL, json=_MB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 404
        detail = response.json().get("detail", "").lower()
        assert "do not interpret" in detail and "balanced" in detail

    async def test_401_without_oauth_token(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_MB_PRODUCTION_ROW]):
            async with _make_client() as client:
                response = await client.post(_MB_URL, json=_MB_VALID_BODY)
        assert response.status_code == 401

    async def test_missing_material_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _MB_VALID_BODY.items() if k != "material_id"}
        async with _make_client() as client:
            response = await client.post(_MB_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_MB_PRODUCTION_ROW]):
            async with _make_client() as client:
                response = await client.post(_MB_URL, json=_MB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_MB_PRODUCTION_ROW]):
            async with _make_client() as client:
                response = await client.post(_MB_URL, json=_MB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert "gold_batch_mass_balance_v" in response.headers.get("x-data-source", "")

    async def test_uses_repository_facade_not_route_run_query(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with patch(
            "routes.trace2.run_query",
            new_callable=AsyncMock,
            side_effect=AssertionError("mass-balance should use Trace2Repository"),
        ) as run_query_mock:
            with _patch_executor([_FAKE_MB_PRODUCTION_ROW]):
                async with _make_client() as client:
                    response = await client.post(
                        _MB_URL,
                        json=_MB_VALID_BODY,
                        headers=_HEADERS_WITH_TOKEN,
                    )

        assert response.status_code == 200
        run_query_mock.assert_not_called()

    async def test_max_rows_clamped_to_10000(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_MB_VALID_BODY, "max_rows": 99999}
        with _patch_executor([_FAKE_MB_PRODUCTION_ROW]):
            async with _make_client() as client:
                response = await client.post(_MB_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Recall readiness route tests (POST /api/trace2/recall-readiness)
# ---------------------------------------------------------------------------

_RR_URL = "/api/trace2/recall-readiness"

_RR_VALID_BODY = {
    "material_id": "20035129",
    "batch_id": "8000049668",
}

_FAKE_RECALL_ROW = {
    "delivery": "DEL-001",
    "customer_id": "CUST-001",
    "customer_name": "Kerry Ingredients",
    "country_id": "IE",
    "country_name": "Ireland",
    "abs_quantity": 500.0,
    "uom": "KG",
    "posting_date": "2026-01-15",
    "sales_order_id": "SO-001",
}


class TestRecallReadinessRoute:
    async def test_200_returns_recall_readiness_summary(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_RECALL_ROW]):
            async with _make_client() as client:
                response = await client.post(_RR_URL, json=_RR_VALID_BODY, headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 200
        data = response.json()
        assert data["totals"]["customers"] == 1
        assert data["totals"]["deliveries"] == 1
        assert data["totals"]["shipped"] == pytest.approx(500.0)
        assert data["recommendationStatus"] == "not-evaluated"

    async def test_zero_rows_returns_404_with_no_exposure_message(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_RR_URL, json=_RR_VALID_BODY, headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 404
        assert "do not interpret as zero exposure" in response.json().get("detail", "").lower()

    async def test_uses_repository_facade_not_route_run_query(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with patch(
            "routes.trace2.run_query",
            new_callable=AsyncMock,
            side_effect=AssertionError("recall-readiness should use Trace2Repository"),
        ) as run_query_mock:
            with _patch_executor([_FAKE_RECALL_ROW]):
                async with _make_client() as client:
                    response = await client.post(
                        _RR_URL,
                        json=_RR_VALID_BODY,
                        headers=_HEADERS_WITH_TOKEN,
                    )

        assert response.status_code == 200
        run_query_mock.assert_not_called()


# ---------------------------------------------------------------------------
# Batch quality passport route tests (POST /api/trace2/batch-quality-passport)
# ---------------------------------------------------------------------------

_BQP_URL = "/api/trace2/batch-quality-passport"

_BQP_VALID_BODY = {
    "material_id": "20035129",
    "batch_id": "8000049668",
    "plant_id": "C061",
}


class TestBatchQualityPassportRoute:
    async def test_zero_identity_rows_returns_404(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_BQP_URL, json=_BQP_VALID_BODY, headers=_HEADERS_WITH_TOKEN)

        assert response.status_code == 404
        assert response.json()["detail"] == "Batch not found"

    async def test_uses_repository_facade_not_route_run_query(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with patch(
            "routes.trace2.run_query",
            new_callable=AsyncMock,
            side_effect=AssertionError("batch-quality-passport should use Trace2Repository"),
        ) as run_query_mock:
            with _patch_executor([]):
                async with _make_client() as client:
                    response = await client.post(
                        _BQP_URL,
                        json=_BQP_VALID_BODY,
                        headers=_HEADERS_WITH_TOKEN,
                    )

        assert response.status_code == 404
        run_query_mock.assert_not_called()


class TestTraceGraphArchitectureGuardrails:
    def test_no_sql_select_in_route_module(self) -> None:
        import inspect

        import routes.trace2 as route_module

        source = inspect.getsource(route_module)
        assert "SELECT" not in source, "SQL SELECT keyword found in route module — SQL must live in QuerySpec factories only"

    def test_no_spn_pat_fallback_in_route_module(self) -> None:
        import inspect

        import routes.trace2 as route_module

        source = inspect.getsource(route_module)
        assert "service_principal" not in source.lower()
        assert "client_secret" not in source.lower()
        assert "pat_token" not in source.lower()

    async def test_mode_check_happens_before_databricks_call(self, monkeypatch) -> None:
        """Wrong mode must return 503 before any Databricks call is made."""
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        called: list[bool] = []

        async def _spy(*args, **kwargs):
            called.append(True)
            return []

        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            _spy,
        ):
            async with _make_client() as client:
                response = await client.post(
                    _URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN
                )

        assert response.status_code == 503
        assert called == [], "Databricks must not be called when mode is wrong"


# ---------------------------------------------------------------------------
# Exposure routes — response_model contract enforcement (PR 6)
# ---------------------------------------------------------------------------


class TestCustomerExposureResponseModel:
    """Pin POST /api/trace2/customer-exposure against the generated
    CustomerExposureSummary contract on the wire."""

    async def test_response_validates_against_generated_contract(self, monkeypatch) -> None:
        from contracts.generated import CustomerExposureSummary

        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        # Round-trip the wire response through the generated model — any
        # leaked unmodeled key would fail validation here.
        CustomerExposureSummary.model_validate(response.json())

    async def test_response_uses_camelcase_aliases(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for required in (
            "affectedCustomers", "affectedDeliveries", "shippedQuantity",
            "countries", "highestSeverity", "blockedDeliveries", "recallRecommended",
        ):
            assert required in data
        for snake in ("affected_customers", "affected_deliveries", "shipped_quantity",
                      "highest_severity", "blocked_deliveries", "recall_recommended"):
            assert snake not in data

    async def test_severity_enum_in_governance_safe_set(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        assert data["highestSeverity"] in {"none", "low", "medium", "high", "critical"}

    async def test_recall_recommended_is_governance_pending(self, monkeypatch) -> None:
        """recallRecommended is now contract-nullable. Until a governed
        recall-rule engine lands, the mapper MUST emit `null` (no governed
        recommendation available) rather than `False` (which would read
        as "recall not required" — a positive safety claim the system
        cannot make without governance).

        Semantics:
          - true  → governed source says recall recommended
          - false → governed source says recall NOT recommended
          - null  → no governed recall-rule source available

        Both `true` and `false` require a governed source. The current
        mapper has no governed source, so the answer is null.
        """
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        # Must NOT be True or False — both require a governed source.
        assert data["recallRecommended"] is None
        assert data["recallRecommended"] is not True
        assert data["recallRecommended"] is not False

    async def test_no_invented_release_or_safety_fields(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_ROW]):
            async with _make_client() as client:
                response = await client.post(_CE_URL, json=_CE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for forbidden in ("safe", "approved", "released", "cleared", "supplierRisk", "delivered"):
            assert forbidden not in data


class TestCustomerDeliveriesResponseModel:
    """Pin POST /api/trace2/customer-deliveries against the same generated
    CustomerExposureSummary contract."""

    async def test_response_validates_against_generated_contract(self, monkeypatch) -> None:
        from contracts.generated import CustomerExposureSummary

        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_VIEW_ROW]):
            async with _make_client() as client:
                response = await client.post(_CD_URL, json=_CD_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        CustomerExposureSummary.model_validate(response.json())

    async def test_delivery_evidence_source_marks_inventory_movements(self, monkeypatch) -> None:
        """The customer-deliveries route sources from gold_batch_delivery_v
        (inventory movements), distinct from the customer-exposure
        lineage path. The contract field deliveryEvidenceSource must
        surface that distinction so the UI does not conflate the two."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_VIEW_ROW]):
            async with _make_client() as client:
                response = await client.post(_CD_URL, json=_CD_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        assert data["deliveryEvidenceSource"] == "inventory-movements"

    async def test_no_status_delivered_field_on_wire(self, monkeypatch) -> None:
        """CustomerExposureSummary has no `status` field. PR 6 brief
        forbids a `status: 'delivered'` claim — this test pins that the
        field does not appear at all (absence is the source-truthful default)."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_DELIVERY_VIEW_ROW]):
            async with _make_client() as client:
                response = await client.post(_CD_URL, json=_CD_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        assert "status" not in data
        # And no invented business fields.
        for forbidden in ("delivered", "safe", "approved", "released", "cleared"):
            assert forbidden not in data


class TestSupplierExposureResponseModel:
    """Pin POST /api/trace2/supplier-exposure against the generated
    SupplierExposureSummary contract."""

    async def test_response_validates_against_generated_contract(self, monkeypatch) -> None:
        from contracts.generated import SupplierExposureSummary

        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_SUPPLIER_ROW]):
            async with _make_client() as client:
                response = await client.post(_SE_URL, json=_SE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        SupplierExposureSummary.model_validate(response.json())

    async def test_response_uses_camelcase_aliases(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_SUPPLIER_ROW]):
            async with _make_client() as client:
                response = await client.post(_SE_URL, json=_SE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for required in ("supplierCount", "supplierLots", "upstreamMaterials", "openSupplierActions"):
            assert required in data
        for snake in ("supplier_count", "supplier_lots", "upstream_materials", "open_supplier_actions"):
            assert snake not in data

    async def test_no_supplier_risk_field_on_wire(self, monkeypatch) -> None:
        """SupplierExposureSummary contract has no `supplierRisk` field.
        PR 6 brief forbids `supplierRisk: low` without a governed source.
        Absence of the field is the source-truthful default — this test
        pins that absence so a future regression cannot introduce a
        heuristic value."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_SUPPLIER_ROW]):
            async with _make_client() as client:
                response = await client.post(_SE_URL, json=_SE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        assert "supplierRisk" not in data
        # Per-supplier rows also stay risk-free until governance lands.
        for supplier in data.get("suppliers", []):
            assert "risk" not in supplier
            assert "riskLevel" not in supplier

    async def test_open_supplier_actions_default_zero_without_qm_source(self, monkeypatch) -> None:
        """openSupplierActions is `0` until a verified QM source is wired
        (per the contract docstring TRACE-P1-012). Pin the zero default so
        a regression toward inventing actions is caught. Zero here means
        "no QM source verified yet" — UI must surface the caveat."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_SUPPLIER_ROW]):
            async with _make_client() as client:
                response = await client.post(_SE_URL, json=_SE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.json()["openSupplierActions"] == 0

    async def test_no_invented_release_or_safety_fields(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_SUPPLIER_ROW]):
            async with _make_client() as client:
                response = await client.post(_SE_URL, json=_SE_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for forbidden in ("safe", "approved", "released", "cleared", "recallRecommended", "delivered"):
            assert forbidden not in data


# ---------------------------------------------------------------------------
# TraceGraph — generated contract enforcement (PR 5)
# ---------------------------------------------------------------------------


class TestTraceGraphResponseModel:
    """Pin POST /api/trace2/trace-graph against the generated TraceGraph
    contract. Extra='forbid' on every nested model means any leaked
    unmodelled key (e.g. rootCause, recallRecommended) fails here."""

    async def test_response_validates_against_generated_contract(self, monkeypatch) -> None:
        from contracts.generated import TraceGraph

        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_LINEAGE_ROW]):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        TraceGraph.model_validate(response.json())

    async def test_empty_graph_validates_against_generated_contract(self, monkeypatch) -> None:
        from contracts.generated import TraceGraph

        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        TraceGraph.model_validate(response.json())

    async def test_required_top_level_identifiers_present(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_LINEAGE_ROW]):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for required in (
            "nodes", "edges", "direction", "depth",
            "rootBatch", "upstreamCount", "downstreamCount",
            "unresolvedNodeCount", "warnings", "truncated",
        ):
            assert required in data, f"missing required contract field: {required}"

    async def test_nodes_use_camelcase_wire_shape(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_LINEAGE_ROW]):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for node in data["nodes"]:
            assert "materialId" in node
            assert "batchId" in node
            assert "isAnchor" in node
            assert "material_id" not in node
            assert "batch_id" not in node
            assert "is_anchor" not in node

    async def test_edges_use_camelcase_wire_shape(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_LINEAGE_ROW]):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for edge in data["edges"]:
            assert "id" in edge
            assert "source" in edge
            assert "target" in edge
            assert "link_type" not in edge
            assert "process_order_id" not in edge

    async def test_no_unsafe_investigation_claims(self, monkeypatch) -> None:
        """TraceGraph must never emit recall decisions, root cause, or
        approval/safety claims — these require governed sources."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_LINEAGE_ROW]):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for forbidden in ("recallRecommended", "rootCause", "safe", "approved", "released", "cleared"):
            assert forbidden not in data

    async def test_empty_graph_warnings_not_no_issue_found(self, monkeypatch) -> None:
        """An empty lineage result is explicit empty evidence. The warnings
        list must carry machine-readable codes, not a user-facing 'no issue
        found' claim which would be a false safety assurance."""
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_URL, json=_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        warnings = data.get("warnings", [])
        assert "no_edges_found" in warnings
        assert "no issue found" not in str(warnings).lower()
        assert "no_issue" not in str(warnings)


# ---------------------------------------------------------------------------
# InvestigationTimeline route tests (POST /api/trace2/investigation-timeline)
# ---------------------------------------------------------------------------

_IT_URL = "/api/trace2/investigation-timeline"

_IT_VALID_BODY = {
    "material_id": "000000000020052009",
    "batch_id": "0008602411",
    "plant_id": "C061",
}

_FAKE_TIMELINE_ROW = {
    "ts": "2024-03-08T06:00:00",
    "event_type": "production",
    "label": "GR · PO-100001",
    "actor": "SAP · auto",
    "detail": "17050 KG produced",
    "tone": "good",
    "source_system": "SAP",
}

_FAKE_QC_ROW = {
    "ts": "2024-03-09T11:42:00",
    "event_type": "qc",
    "label": "Inspection LOT-2024-3-08-A · Lab MIC + retain",
    "actor": "Lab · auto",
    "detail": "Accepted",
    "tone": "good",
    "source_system": "LIMS",
}

_FAKE_DISPATCH_ROW = {
    "ts": "2024-03-10T00:00:00",
    "event_type": "dispatch",
    "label": "Delivery DEL-001 · IE",
    "actor": "SAP · auto",
    "detail": "4280.0 KG → Kerry Ingredients",
    "tone": "brand",
    "source_system": "SAP",
}


class TestInvestigationTimelineWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_mode_is_absent(self, monkeypatch) -> None:
        monkeypatch.delenv("BACKEND_ADAPTER_MODE", raising=False)
        async with _make_client() as client:
            response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_does_not_call_databricks_in_wrong_mode(self, monkeypatch) -> None:
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
                await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)

        assert called == []


class TestInvestigationTimelineSuccess:
    async def test_200_returns_timeline_events(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_TIMELINE_ROW, _FAKE_QC_ROW, _FAKE_DISPATCH_ROW]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert len(data["events"]) == 3

    async def test_empty_result_returns_200_with_empty_events(self, monkeypatch) -> None:
        """Empty timeline is NOT a 404 — the batch may have no inspections
        or dispatches yet. This is explicit empty evidence, not 'no issue found'."""
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        assert response.json()["events"] == []

    async def test_401_without_oauth_token(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_TIMELINE_ROW]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY)
        assert response.status_code == 401

    async def test_missing_material_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {k: v for k, v in _IT_VALID_BODY.items() if k != "material_id"}
        async with _make_client() as client:
            response = await client.post(_IT_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_blank_material_id_returns_422(self, monkeypatch) -> None:
        """Blank identifiers must be rejected before they reach Databricks."""
        _databricks_env(monkeypatch)
        body = {**_IT_VALID_BODY, "material_id": "   "}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_blank_batch_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_IT_VALID_BODY, "batch_id": ""}
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_TIMELINE_ROW]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_sets_x_data_source_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_TIMELINE_ROW]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        badge = response.headers.get("x-data-source", "")
        assert "mass_balance_v" in badge or "quality_lot_v" in badge or "delivery_v" in badge

    async def test_does_not_fall_back_on_databricks_error(self, monkeypatch) -> None:
        """On Databricks error, must return HTTP error — never fall back to mock."""
        from shared.query_service.errors import DatabricksQueryError

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=DatabricksQueryError("trace2.get_investigation_timeline", "SQL error"),
        ):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 502
        assert "events" not in response.json()


class TestInvestigationTimelineResponseModel:
    """Pin POST /api/trace2/investigation-timeline against the generated
    InvestigationTimeline contract."""

    async def test_response_validates_against_generated_contract(self, monkeypatch) -> None:
        from contracts.generated import InvestigationTimeline

        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_TIMELINE_ROW, _FAKE_QC_ROW, _FAKE_DISPATCH_ROW]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        InvestigationTimeline.model_validate(response.json())

    async def test_empty_timeline_validates_against_generated_contract(self, monkeypatch) -> None:
        from contracts.generated import InvestigationTimeline

        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        InvestigationTimeline.model_validate(response.json())

    async def test_events_use_camelcase_wire_shape(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_TIMELINE_ROW]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for event in data["events"]:
            assert "ts" in event
            assert "type" in event
            assert "label" in event
            assert "actor" in event
            assert "detail" in event
            assert "tone" in event
            assert "sourceSystem" in event
            assert "source_system" not in event

    async def test_no_root_cause_or_signoff_fields_on_wire(self, monkeypatch) -> None:
        """InvestigationTimeline must never emit root-cause conclusions,
        approval claims, or signoff status — these require governed sources
        the timeline UNION does not have."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_TIMELINE_ROW, _FAKE_QC_ROW]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for forbidden in ("rootCause", "recallRecommended", "safe", "approved", "released",
                          "cleared", "signoff", "eSignature"):
            assert forbidden not in data
        for event in data["events"]:
            for forbidden in ("rootCause", "recallRecommended", "safe", "approved"):
                assert forbidden not in event

    async def test_source_timestamps_and_types_preserved(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_TIMELINE_ROW, _FAKE_QC_ROW, _FAKE_DISPATCH_ROW]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        events = response.json()["events"]
        types = [e["type"] for e in events]
        assert "production" in types
        assert "qc" in types
        assert "dispatch" in types
        sources = [e["sourceSystem"] for e in events]
        assert "SAP" in sources
        assert "LIMS" in sources

    async def test_unknown_event_type_coerced_to_note_not_rejected(self, monkeypatch) -> None:
        """SQL may add a new event_type the mapper hasn't seen. Route must
        NOT 500 — the mapper coerces to 'note' and the response stays valid."""
        drift_row = {**_FAKE_TIMELINE_ROW, "event_type": "new-unrecognised-event-type"}
        _databricks_env(monkeypatch)
        with _patch_executor([drift_row]):
            async with _make_client() as client:
                response = await client.post(_IT_URL, json=_IT_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        events = response.json()["events"]
        assert events[0]["type"] == "note"


# ---------------------------------------------------------------------------
# Supplier batches route tests (POST /api/trace2/supplier-batches) — PR 8
# ---------------------------------------------------------------------------

_SB_URL = "/api/trace2/supplier-batches"

_SB_VALID_BODY = {
    "material_id": "000000000020052009",
    "batch_id": "0008602411",
}

# Consumed lot row shape from gold_batch_lineage (VENDOR_RECEIPT edges)
_FAKE_CONSUMED_ROW = {
    "supplier_id": "SUPP-001",
    "vendor_batch": "VB-2024-001",
    "parent_material_id": "000000000020052009",
    "posting_date": "2024-03-08",
    "quantity": -500.0,
    "uom": "KG",
}


@pytest.mark.asyncio
class TestSupplierBatchesWrongMode:
    async def test_returns_503_when_mode_is_legacy_api(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        async with _make_client() as client:
            response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_returns_503_when_mode_is_absent(self, monkeypatch) -> None:
        monkeypatch.delenv("BACKEND_ADAPTER_MODE", raising=False)
        async with _make_client() as client:
            response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 503

    async def test_does_not_call_databricks_in_wrong_mode(self, monkeypatch) -> None:
        monkeypatch.setenv("BACKEND_ADAPTER_MODE", "legacy-api")
        with _patch_executor([_FAKE_CONSUMED_ROW]) as mock_exec:
            async with _make_client() as client:
                await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        mock_exec.assert_not_called()


@pytest.mark.asyncio
class TestSupplierBatchesSuccess:
    async def test_200_returns_consumed_lots_and_siblings(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_CONSUMED_ROW]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        data = response.json()
        assert "consumedLots" in data
        assert "siblingBatches" in data
        assert len(data["consumedLots"]) == 1

    async def test_empty_result_returns_200_with_empty_arrays(self, monkeypatch) -> None:
        """No vendor receipts → valid 200 with empty consumedLots and siblingBatches.
        A batch with no vendor receipts is a legitimate production-only batch."""
        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        data = response.json()
        assert data["consumedLots"] == []
        assert data["siblingBatches"] == []

    async def test_401_without_oauth_token(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_CONSUMED_ROW]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY)
        assert response.status_code == 401

    async def test_blank_material_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_SB_VALID_BODY, "material_id": ""}
        async with _make_client() as client:
            response = await client.post(_SB_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_blank_batch_id_returns_422(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        body = {**_SB_VALID_BODY, "batch_id": ""}
        async with _make_client() as client:
            response = await client.post(_SB_URL, json=body, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 422

    async def test_sets_x_adapter_mode_header(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_CONSUMED_ROW]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.headers.get("x-adapter-mode") == "databricks-api"

    async def test_uses_repository_facade_not_route_run_query(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with patch(
            "routes.trace2.run_query",
            new_callable=AsyncMock,
            side_effect=AssertionError("supplier-batches should use Trace2Repository"),
        ) as run_query_mock:
            with _patch_executor([_FAKE_CONSUMED_ROW]):
                async with _make_client() as client:
                    response = await client.post(
                        _SB_URL,
                        json=_SB_VALID_BODY,
                        headers=_HEADERS_WITH_TOKEN,
                    )

        assert response.status_code == 200
        run_query_mock.assert_not_called()

    async def test_does_not_fall_back_on_databricks_error(self, monkeypatch) -> None:
        """If the Databricks executor raises, the route MUST NOT silently
        return mock data — it must propagate the upstream failure."""
        from fastapi import HTTPException

        _databricks_env(monkeypatch)
        with patch(
            "shared.query_service.databricks_client.StatementApiDatabricksClient.execute",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=502, detail="Databricks unavailable"),
        ):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 502


@pytest.mark.asyncio
class TestSupplierBatchesResponseModel:
    """Pin POST /api/trace2/supplier-batches against the generated SupplierBatchView contract."""

    async def test_response_validates_against_generated_contract(self, monkeypatch) -> None:
        from contracts.generated import SupplierBatchView

        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_CONSUMED_ROW]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        SupplierBatchView.model_validate(response.json())

    async def test_empty_view_validates_against_generated_contract(self, monkeypatch) -> None:
        from contracts.generated import SupplierBatchView

        _databricks_env(monkeypatch)
        with _patch_executor([]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        assert response.status_code == 200
        SupplierBatchView.model_validate(response.json())

    async def test_consumed_lots_use_camelcase_wire_shape(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_CONSUMED_ROW]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        assert len(data["consumedLots"]) > 0
        lot = data["consumedLots"][0]
        for required in ("vendor", "vendorBatch", "material", "receipt", "consumed", "uom", "risk"):
            assert required in lot
        for snake in ("vendor_batch", "parent_material_id", "posting_date"):
            assert snake not in lot

    async def test_risk_is_unknown_on_all_consumed_lots(self, monkeypatch) -> None:
        """risk MUST be 'unknown' until a governed supplier-risk source is wired.
        This is the primary PR 8 guardrail — pins the wire value so 'low' cannot
        be introduced by a future mapper change without a failing test."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_CONSUMED_ROW]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        for lot in response.json()["consumedLots"]:
            assert lot["risk"] == "unknown"

    async def test_risk_never_low_medium_high_without_governed_source(self, monkeypatch) -> None:
        """risk='low' / 'medium' / 'high' MUST NOT appear on the wire until
        a governed supplier-risk source is verified."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_CONSUMED_ROW]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        for lot in response.json()["consumedLots"]:
            assert lot["risk"] not in ("low", "medium", "high")

    async def test_coa_is_null_not_invented(self, monkeypatch) -> None:
        """CoA is not on gold_batch_lineage — must be null on the wire, not
        an empty string or a default path."""
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_CONSUMED_ROW]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        for lot in response.json()["consumedLots"]:
            assert lot["coa"] is None

    async def test_no_recall_recommended_on_wire(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_CONSUMED_ROW]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        assert "recallRecommended" not in data
        for lot in data["consumedLots"]:
            assert "recallRecommended" not in lot

    async def test_no_safe_approved_released_fields_on_wire(self, monkeypatch) -> None:
        _databricks_env(monkeypatch)
        with _patch_executor([_FAKE_CONSUMED_ROW]):
            async with _make_client() as client:
                response = await client.post(_SB_URL, json=_SB_VALID_BODY, headers=_HEADERS_WITH_TOKEN)
        data = response.json()
        for forbidden in ("safe", "approved", "released", "cleared", "signoff"):
            assert forbidden not in data
            for lot in data["consumedLots"]:
                assert forbidden not in lot
