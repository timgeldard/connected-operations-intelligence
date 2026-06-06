"""Trace2 domain routes.

POST /trace2/batch-header — proxy to V1 (legacy-api, browser-verified).
POST /trace2/trace-graph  — native Databricks WITH RECURSIVE lineage graph.
"""
import asyncio
import dataclasses
import os
import re

import httpx
from adapters.trace2.trace2_databricks_adapter import (
    Trace2BatchHeaderRequest,
    Trace2BatchQualityPassportRequest,
    Trace2BatchSearchRequest,
    Trace2CustomerDeliveryRequest,
    Trace2CustomerExposureRequest,
    Trace2HoldsLedgerRequest,
    Trace2InvestigationTimelineRequest,
    Trace2MassBalanceLedgerRequest,
    Trace2MassBalanceRequest,
    Trace2ProductionHistoryRequest,
    Trace2RecallReadinessRequest,
    Trace2Repository,
    Trace2SupplierBatchViewRequest,
    Trace2SupplierExposureRequest,
    TraceGraphRequest,
    get_holds_ledger_spec,
    get_investigation_timeline_spec,
    get_mass_balance_ledger_spec,
    get_trace_graph_recursive_spec,
    map_holds_ledger_rows,
    map_investigation_timeline_rows,
    map_mass_balance_ledger_rows,
    map_trace_graph,
)
from contracts.generated import (
    BatchHeaderSummary,
    BatchQualityPassport,
    CustomerExposureSummary,
    HoldsLedger,
    InvestigationTimeline,
    MassBalanceLedger,
    MassBalanceSummary,
    ProductionHistorySummary,
    RecallReadiness,
    SupplierBatchView,
    SupplierExposureSummary,
    TraceGraph,
)
from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, field_validator
from shared.proxy_client import get_proxy_client

from routes._databricks import (
    build_databricks_repository,
    build_user_identity,
    require_databricks_config,
    run_query,
    run_repository_fetch,
    set_databricks_response_headers,
)

router = APIRouter()

_V1_BASE_URL = os.getenv("V1_TRACE_API_BASE_URL", "")
_VALID_DIRECTIONS = {"upstream", "downstream", "both"}


class BatchRequest(BaseModel):
    material_id: str
    batch_id: str
    plant_id: str = ""


class BatchSearchRequest(BaseModel):
    query: str
    material_id: str = ""
    batch_id: str = ""
    max_rows: int = 25

    @field_validator("query")
    @classmethod
    def _validate_query(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("query must not be blank")
        return value.strip()


class BatchSearchItem(BaseModel):
    materialId: str
    materialDescription: str
    batchId: str
    plantId: str
    plantName: str
    processOrderId: str | None = None
    latestPostingDate: str | None = None
    quantity: float | None = None
    uom: str | None = None
    matchTypes: list[str]


class BatchSearchResponse(BaseModel):
    query: str
    total: int
    truncated: bool
    wildcardApplied: bool
    items: list[BatchSearchItem]


def _parse_combined_batch_search(query: str) -> tuple[str, str] | None:
    tokens = [token.strip() for token in re.split(r"[\s/,]+", query.strip()) if token.strip()]
    if len(tokens) != 2:
        return None
    if not all(any(ch.isdigit() for ch in token) for token in tokens):
        return None
    return tokens[0], tokens[1]


async def _forward_post(v1_path: str, body: dict, token: str | None) -> dict:
    if not _V1_BASE_URL:
        raise HTTPException(status_code=503, detail="V1_TRACE_API_BASE_URL is not configured")

    headers = {"Content-Type": "application/json"}
    if token:
        headers["x-forwarded-access-token"] = token

    try:
        client = get_proxy_client()
        response = await client.post(f"{_V1_BASE_URL}{v1_path}", json=body, headers=headers)
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise HTTPException(status_code=502, detail=f"Upstream unreachable: {exc}") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Upstream returned 401 Unauthorized")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Upstream returned 404 Not Found")
    if not response.is_success:
        raise HTTPException(status_code=502, detail=f"Upstream returned {response.status_code}")

    return response.json()


@router.post("/trace2/batch-header", response_model=BatchHeaderSummary)
async def batch_header(
    body: BatchRequest,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    if os.getenv("BACKEND_ADAPTER_MODE", "") == "databricks-api":
        host, warehouse_id = require_databricks_config()
        identity = build_user_identity(
            x_forwarded_access_token, x_forwarded_user, x_forwarded_email
        )
        request = Trace2BatchHeaderRequest(
            material_id=body.material_id,
            batch_id=body.batch_id,
            plant_id=body.plant_id,
        )
        repository = build_databricks_repository(identity, host, warehouse_id)
        trace_repo = Trace2Repository(repository)
        result, spec = await run_repository_fetch(
            lambda: trace_repo.fetch_batch_header(request)
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Batch not found")
        set_databricks_response_headers(response, spec)
        return result
    return await _forward_post(
        "/api/t2/batch-header",
        body.model_dump(exclude_none=True),
        x_forwarded_access_token,
    )


@router.post("/trace2/batch-search", response_model=BatchSearchResponse)
async def batch_search(
    body: BatchSearchRequest,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/batch-search — Databricks-backed consumer batch search.

    This is intentionally Databricks-only: no V1 proxy route exists for this
    consumer search surface. It returns complete batch context so the Trace
    Consumer workspace can launch evidence panels with material, batch, and
    plant identifiers populated.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="batch-search requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )
    max_rows = min(max(body.max_rows, 1), 50)
    material_id = body.material_id.strip()
    batch_id = body.batch_id.strip()
    if not material_id or not batch_id:
        parsed = _parse_combined_batch_search(body.query)
        if parsed is not None:
            material_id, batch_id = parsed

    request = Trace2BatchSearchRequest(
        query=body.query,
        max_rows=max_rows + 1,
        material_id=material_id,
        batch_id=batch_id,
    )
    repository = build_databricks_repository(identity, host, warehouse_id)
    trace_repo = Trace2Repository(repository)
    result, spec = await run_repository_fetch(
        lambda: trace_repo.fetch_batch_search(
            request,
            display_query=body.query,
            max_rows=max_rows,
        )
    )
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# POST /trace2/trace-graph — native Databricks multi-hop lineage graph
# ---------------------------------------------------------------------------

class TraceGraphBody(BaseModel):
    material_id: str
    batch_id: str
    plant_id: str = ""
    direction: str = "both"
    max_depth: int = 3
    max_edges: int = 1000

    @field_validator("direction")
    @classmethod
    def _validate_direction(cls, v: str) -> str:
        if v not in _VALID_DIRECTIONS:
            raise ValueError(f"direction must be one of {sorted(_VALID_DIRECTIONS)}")
        return v


@router.post("/trace2/trace-graph", response_model=TraceGraph)
async def trace_graph(
    body: TraceGraphBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/trace-graph — WITH RECURSIVE batch lineage graph.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Single SQL call against gold_batch_lineage; server-side traversal up to max_depth hops.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="trace-graph requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    # Clamp depth and edge limits to safe bounds.
    max_depth = min(max(body.max_depth, 1), 5)
    max_edges = min(max(body.max_edges, 1), 5000)

    request = TraceGraphRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        plant_id=body.plant_id,
        direction=body.direction,
        max_depth=max_depth,
        max_edges=max_edges,
    )

    # direction="both" is split into two parallel single-direction queries.
    # Databricks stops WITH RECURSIVE early only when LIMIT is directly on the
    # recursive CTE reference (FROM ds LIMIT n). In a UNION ALL that placement
    # is a parse error, so a combined "both" query cannot carry per-arm LIMITs
    # and will hit the 1M intermediate-row system cap on dense graphs.
    #
    # Edge budget is split evenly (max_edges // 2 per direction) so that a
    # dense downstream result cannot starve upstream rows before the Python
    # truncation loop applies its max_edges cap on the combined set.
    if request.direction == "both":
        per_direction_edges = max(1, max_edges // 2)
        ds_req = dataclasses.replace(request, direction="downstream", max_edges=per_direction_edges)
        us_req = dataclasses.replace(request, direction="upstream", max_edges=per_direction_edges)
        (ds_rows, spec), (us_rows, _) = await asyncio.gather(
            run_query(lambda: get_trace_graph_recursive_spec(ds_req), identity, host, warehouse_id),
            run_query(lambda: get_trace_graph_recursive_spec(us_req), identity, host, warehouse_id),
        )
        rows = ds_rows + us_rows
    else:
        rows, spec = await run_query(
            lambda: get_trace_graph_recursive_spec(request),
            identity, host, warehouse_id,
        )

    tagged_rows: list[tuple[dict, int, str]] = []
    seen_edge_keys: set[str] = set()
    depth_reached = 0
    truncated = False

    for row in rows:
        if len(seen_edge_keys) >= max_edges:
            truncated = True
            break
        hop = int(row.get("hop_depth") or 1)
        traversal_dir = str(row.get("traversal_dir") or "downstream")
        link_type = row.get("link_type") or ""
        doc_num = row.get("material_document_number") or ""
        parent_key = f"{row['parent_material_id']}:{row['parent_batch_id']}:{row.get('parent_plant_id') or ''}"
        child_key = f"{row.get('child_material_id') or ''}:{row.get('child_batch_id') or ''}:{row.get('child_plant_id') or ''}"
        edge_key = f"{parent_key}|{child_key}|{link_type}|{doc_num}|{hop}"
        if edge_key not in seen_edge_keys:
            seen_edge_keys.add(edge_key)
            tagged_rows.append((row, hop - 1, traversal_dir))
            if hop > depth_reached:
                depth_reached = hop

    graph = map_trace_graph(tagged_rows, request, depth_reached, truncated)
    set_databricks_response_headers(response, spec)
    return graph


# ---------------------------------------------------------------------------
# POST /trace2/customer-exposure — lineage-backed customer exposure first slice
# ---------------------------------------------------------------------------

class CustomerExposureBody(BaseModel):
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_depth: int = 5
    max_rows: int = 5000


@router.post("/trace2/customer-exposure", response_model=CustomerExposureSummary)
async def customer_exposure(
    body: CustomerExposureBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/customer-exposure — lineage-only customer exposure first slice.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Source: gold_batch_lineage downstream WITH RECURSIVE, LINK_TYPE='DELIVERY' edges.

    Zero rows → HTTP 404. Zero rows must NOT be interpreted as zero exposure.
    Countries and blockedDeliveries are not populated in this slice (no gold_batch_delivery_v).
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="customer-exposure requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    max_depth = min(max(body.max_depth, 1), 10)
    max_rows = min(max(body.max_rows, 1), 10000)

    request = Trace2CustomerExposureRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        plant_id=body.plant_id,
        max_depth=max_depth,
        max_rows=max_rows,
    )

    repository = build_databricks_repository(identity, host, warehouse_id)
    trace_repo = Trace2Repository(repository)
    result, spec = await run_repository_fetch(
        lambda: trace_repo.fetch_customer_exposure(request)
    )
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No customer delivery records returned from current source — "
                "do not interpret as zero exposure until source coverage is validated."
            ),
        )
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# POST /trace2/customer-deliveries — V1-parity delivery view slice
# ---------------------------------------------------------------------------

class CustomerDeliveryBody(BaseModel):
    material_id: str
    batch_id: str
    max_rows: int = 5000


@router.post("/trace2/customer-deliveries", response_model=CustomerExposureSummary)
async def customer_deliveries(
    body: CustomerDeliveryBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/customer-deliveries — V1-parity direct delivery records.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Source: gold_batch_delivery_v keyed on MATERIAL_ID + BATCH_ID (no plant filter).

    No plant filter: a recall must surface all plants a batch was shipped from.
    User confirmed 2026-05-20: "plant filtering is not relevant, a user needs to know
    wherever a material went to a customer regardless for the recall/trace to be effective."

    PENDING: MATERIAL_ID/BATCH_ID WHERE key column names need DESCRIBE TABLE confirmation.
    See customer-delivery-movement-type-validation.md §1.

    Zero rows → HTTP 404. Zero rows must NOT be interpreted as zero exposure.
    deliveryEvidenceSource = 'inventory-movements' in all successful responses.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="customer-deliveries requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    max_rows = min(max(body.max_rows, 1), 10000)

    request = Trace2CustomerDeliveryRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        max_rows=max_rows,
    )

    repository = build_databricks_repository(identity, host, warehouse_id)
    trace_repo = Trace2Repository(repository)
    result, spec = await run_repository_fetch(
        lambda: trace_repo.fetch_customer_delivery(request)
    )
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No customer delivery records returned from current source — "
                "do not interpret as zero exposure until source coverage is validated."
            ),
        )
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# POST /trace2/supplier-exposure — upstream VENDOR_RECEIPT supplier slice
# ---------------------------------------------------------------------------

class SupplierExposureBody(BaseModel):
    material_id: str
    batch_id: str
    max_rows: int = 1000


@router.post("/trace2/supplier-exposure", response_model=SupplierExposureSummary)
async def supplier_exposure(
    body: SupplierExposureBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/supplier-exposure — direct VENDOR_RECEIPT suppliers.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Source: gold_batch_lineage (LINK_TYPE='VENDOR_RECEIPT') joined to gold_supplier.
    Single-hop only (direct parents); multi-hop recursive walk is out of scope.

    Empty SUPPLIER_ID values are filtered at SQL — those represent unattributed
    inputs and are not real third-party suppliers.

    Zero suppliers → HTTP 200 with empty suppliers[] (not 404). A batch may
    legitimately have no purchased inputs (production-only batch). The panel
    surfaces zero-supplier state distinctly from an error.

    openSupplierActions and highestRiskSupplier are NOT populated by this slice
    — a verified QM source is required. See TRACE-P1-012.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="supplier-exposure requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    max_rows = min(max(body.max_rows, 1), 5000)

    request = Trace2SupplierExposureRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        max_rows=max_rows,
    )

    repository = build_databricks_repository(identity, host, warehouse_id)
    trace_repo = Trace2Repository(repository)
    result, spec = await run_repository_fetch(
        lambda: trace_repo.fetch_supplier_exposure(request)
    )
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# POST /trace2/production-history — recent batches for a material
# ---------------------------------------------------------------------------

class ProductionHistoryBody(BaseModel):
    material_id: str
    max_rows: int = 24


@router.post("/trace2/production-history", response_model=ProductionHistorySummary)
async def production_history(
    body: ProductionHistoryBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/production-history — recent production batches for a material.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Source: gold_batch_production_history_v keyed on MATERIAL_ID only (no plant
    filter — V1 showed batches across all plants to support isolated-vs-systemic
    assessment). Default 24 most-recent batches (V1 parity).

    Zero rows → HTTP 200 with totalBatches=0 and empty rows[]. A material may
    legitimately have no recent production history (e.g., raw-input material,
    not manufactured on-site). That state is informative, not an error.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="production-history requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    max_rows = min(max(body.max_rows, 1), 200)

    request = Trace2ProductionHistoryRequest(
        material_id=body.material_id,
        max_rows=max_rows,
    )

    repository = build_databricks_repository(identity, host, warehouse_id)
    trace_repo = Trace2Repository(repository)
    result, spec = await run_repository_fetch(
        lambda: trace_repo.fetch_production_history(
            request,
            material_id=body.material_id,
        )
    )
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# POST /trace2/mass-balance — live Databricks mass balance slice
# ---------------------------------------------------------------------------

class MassBalanceBody(BaseModel):
    material_id: str
    batch_id: str
    max_rows: int = 5000


@router.post("/trace2/mass-balance", response_model=MassBalanceSummary)
async def mass_balance(
    body: MassBalanceBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/mass-balance — live mass balance summary + movements.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Source: gold_batch_mass_balance_v keyed on MATERIAL_ID + BATCH_ID.
    11 columns verified live 2026-05-20 via DESCRIBE TABLE on connected_plant_uat.

    Zero rows → HTTP 404 with "do not interpret as balanced" message. Zero rows
    must NOT be treated as zero variance or as a clean mass balance result.

    Known correctness gaps (returned data may be partial — see TRACE-P1-010/011):
      - MOVEMENT_CATEGORY mapping is incomplete; un-mapped rows are counted as
        unresolvedMovements so the panel's amber banner reflects truth.
      - BALANCE_QTY appears not to be a per-batch running balance in live data;
        runningBalance values are passed through as observed.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="mass-balance requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    max_rows = min(max(body.max_rows, 1), 10000)

    request = Trace2MassBalanceRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        max_rows=max_rows,
    )

    repository = build_databricks_repository(identity, host, warehouse_id)
    trace_repo = Trace2Repository(repository)
    result, spec = await run_repository_fetch(
        lambda: trace_repo.fetch_mass_balance(request)
    )
    if not result["movements"]:
        raise HTTPException(
            status_code=404,
            detail=(
                "No mass balance movements returned for this material + batch — "
                "do not interpret as a balanced mass balance until source coverage is validated."
            ),
        )
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# Trace App slice — POST /trace2/recall-readiness
# ---------------------------------------------------------------------------

def _reject_blank(field: str, value: str) -> None:
    """Reject blank required identifiers BEFORE they reach Databricks.

    Returns nothing on success; raises HTTPException(422) otherwise.
    Centralised so every Trace App route enforces the same rule.
    """
    if not value or not value.strip():
        raise HTTPException(
            status_code=422,
            detail=f"{field} must not be blank.",
        )


class RecallReadinessBody(BaseModel):
    material_id: str
    batch_id: str
    max_rows: int = 10000


@router.post("/trace2/recall-readiness", response_model=RecallReadiness)
async def recall_readiness(
    body: RecallReadinessBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/recall-readiness — cross-plant exposure aggregation.

    Only available in databricks-api mode. No legacy-api fallback. No mock fallback.
    Source: gold_batch_delivery_v aggregated by country with per-delivery detail.
    No plant filter — recall coverage must span all plants.

    Zero rows → HTTP 404. Zero rows must NOT be interpreted as zero exposure.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="recall-readiness requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    _reject_blank("material_id", body.material_id)
    _reject_blank("batch_id", body.batch_id)

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    max_rows = min(max(body.max_rows, 1), 50000)
    request = Trace2RecallReadinessRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        max_rows=max_rows,
    )

    repository = build_databricks_repository(identity, host, warehouse_id)
    trace_repo = Trace2Repository(repository)
    result, spec = await run_repository_fetch(
        lambda: trace_repo.fetch_recall_readiness(request)
    )
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No customer delivery records returned from current source — "
                "do not interpret as zero exposure until source coverage is validated."
            ),
        )
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# Trace App slice — POST /trace2/supplier-batches
# ---------------------------------------------------------------------------

class SupplierBatchesBody(BaseModel):
    material_id: str
    batch_id: str
    max_rows: int = 5000


@router.post("/trace2/supplier-batches", response_model=SupplierBatchView)
async def supplier_batches(
    body: SupplierBatchesBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/supplier-batches — consumed vendor lots + cross-plant siblings.

    Two-query slice:
      1) consumed_lots — VENDOR_RECEIPT edges where CHILD is the active batch
      2) sibling_batches — other batches that consumed any of the same vendor lots

    Plant is intentionally NOT filtered on the siblings query — cross-plant
    ripple risk is the whole point.

    No fallback. Empty result is a valid 200 response (an empty consumedLots
    list means the batch has no vendor receipts in the lineage view).
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="supplier-batches requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    _reject_blank("material_id", body.material_id)
    _reject_blank("batch_id", body.batch_id)

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    max_rows = min(max(body.max_rows, 1), 10000)
    request = Trace2SupplierBatchViewRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        max_rows=max_rows,
    )

    repository = build_databricks_repository(identity, host, warehouse_id)
    trace_repo = Trace2Repository(repository)
    result, consumed_spec = await run_repository_fetch(
        lambda: trace_repo.fetch_supplier_batches(request)
    )
    # Use the consumed-lots spec for response headers (it carries the primary
    # source-badge `view:gold_batch_lineage`).
    set_databricks_response_headers(response, consumed_spec)
    return result


# ---------------------------------------------------------------------------
# Trace App slice — POST /trace2/batch-quality-passport (PARTIAL)
# ---------------------------------------------------------------------------

class BatchQualityPassportBody(BaseModel):
    material_id: str
    batch_id: str
    plant_id: str = ""


@router.post("/trace2/batch-quality-passport", response_model=BatchQualityPassport)
async def batch_quality_passport(
    body: BatchQualityPassportBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/batch-quality-passport — full real-data passport.

    Fans out across 5 source queries (identity JOIN, CoA results, lot history,
    quality summary KPIs, mass-balance variance) and assembles a complete
    BatchQualityPassport response. Identity 404s if the batch is not found in
    primary sources (same semantics as batch-header).

    The 7 response sections are populated as follows:
      - identity / stock / production → gold_batch_stock_v + summary_v +
        material + plant + production_history_v
      - quality.coa                   → gold_batch_quality_result_v
      - quality.confidence / notes    → derived from failed_mic_count + warns
      - lotHistory                    → gold_batch_quality_lot_v
      - massBalance.variance / note   → gold_batch_mass_balance_v aggregates
      - signoff                       → derived from latest accepted lot's CREATED_BY
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="batch-quality-passport requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    _reject_blank("material_id", body.material_id)
    _reject_blank("batch_id", body.batch_id)

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )

    request = Trace2BatchQualityPassportRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        plant_id=body.plant_id,
    )

    repository = build_databricks_repository(identity, host, warehouse_id)
    trace_repo = Trace2Repository(repository)
    result, spec = await run_repository_fetch(
        lambda: trace_repo.fetch_batch_quality_passport(request)
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# Trace App slice — POST /trace2/mass-balance-ledger
# ---------------------------------------------------------------------------

class MassBalanceLedgerBody(BaseModel):
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_rows: int = 5000


@router.post("/trace2/mass-balance-ledger", response_model=MassBalanceLedger)
async def mass_balance_ledger(
    body: MassBalanceLedgerBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/mass-balance-ledger — MSEG-style movement ledger.

    Source: gold_batch_mass_balance_v ordered by POSTING_DATE. KPIs computed
    by bucketing MOVEMENT_TYPE into {101, 261, 601, 701}. Zero rows → 404.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="mass-balance-ledger requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    _reject_blank("material_id", body.material_id)
    _reject_blank("batch_id", body.batch_id)

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )
    max_rows = min(max(body.max_rows, 1), 20000)
    request = Trace2MassBalanceLedgerRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        plant_id=body.plant_id,
        max_rows=max_rows,
    )
    rows, spec = await run_query(
        lambda: get_mass_balance_ledger_spec(request),
        identity, host, warehouse_id,
    )
    result = map_mass_balance_ledger_rows(rows)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="No movement records found for this batch.",
        )
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# Trace App slice — POST /trace2/investigation-timeline
# ---------------------------------------------------------------------------

class InvestigationTimelineBody(BaseModel):
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_rows: int = 1000


@router.post("/trace2/investigation-timeline", response_model=InvestigationTimeline)
async def investigation_timeline(
    body: InvestigationTimelineBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/investigation-timeline — UNION timeline.

    Sources: gold_batch_mass_balance_v + gold_batch_quality_lot_v +
    gold_batch_delivery_v. Returns a single chronological event list. Empty
    is valid (the batch may have no inspections or dispatches yet).
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="investigation-timeline requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    _reject_blank("material_id", body.material_id)
    _reject_blank("batch_id", body.batch_id)

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )
    max_rows = min(max(body.max_rows, 1), 5000)
    request = Trace2InvestigationTimelineRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        plant_id=body.plant_id,
        max_rows=max_rows,
    )
    rows, spec = await run_query(
        lambda: get_investigation_timeline_spec(request),
        identity, host, warehouse_id,
    )
    result = map_investigation_timeline_rows(rows)
    set_databricks_response_headers(response, spec)
    return result


# ---------------------------------------------------------------------------
# Trace App slice — POST /trace2/holds-ledger
# ---------------------------------------------------------------------------

class HoldsLedgerBody(BaseModel):
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_rows: int = 500


@router.post("/trace2/holds-ledger", response_model=HoldsLedger)
async def holds_ledger(
    body: HoldsLedgerBody,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """POST /api/trace2/holds-ledger — synthesised holds view.

    Sources: gold_batch_stock_v (current qty-by-reason rollup) + LEFT JOIN
    gold_batch_quality_lot_v (active = no usage decision; resolved = decision
    present). Zero rows → 404. Empty active/resolved lists are valid.
    """
    if os.getenv("BACKEND_ADAPTER_MODE", "") != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="holds-ledger requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    _reject_blank("material_id", body.material_id)
    _reject_blank("batch_id", body.batch_id)

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email
    )
    max_rows = min(max(body.max_rows, 1), 2000)
    request = Trace2HoldsLedgerRequest(
        material_id=body.material_id,
        batch_id=body.batch_id,
        plant_id=body.plant_id,
        max_rows=max_rows,
    )
    rows, spec = await run_query(
        lambda: get_holds_ledger_spec(request),
        identity, host, warehouse_id,
    )
    result = map_holds_ledger_rows(rows)
    if result is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    set_databricks_response_headers(response, spec)
    return result
