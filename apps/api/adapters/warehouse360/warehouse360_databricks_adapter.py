"""Warehouse360 Databricks-api adapter — QuerySpec factories and row mappers.

Provides high-performance, parameterised SQL queries and defensive row mappers
for Warehouse360 cockpit, inbound, outbound, staging, and exception monitoring.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.contract_resolver import resolve_contract_object
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec


@dataclass
class WarehouseOverviewRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseInboundRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseOutboundRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseStagingRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseExceptionRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseStockExceptionsRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    bucket: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseShortfallsRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseStockZonesRequest:
    warehouse_id: str
    plant_id: Optional[str] = None
    limit: int = 100


@dataclass
class WarehouseBatchHoldStatusRequest:
    batch_id: str
    plant_id: Optional[str] = None


@dataclass
class WarehouseStagingReadinessRequest:
    plant_id: str
    plan_date: str


# ---------------------------------------------------------------------------
# Utility Mapping & Formatting Helpers
# ---------------------------------------------------------------------------

def _safe_float(value: object) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def _safe_int(value: object) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0


def _format_datetime(value: object) -> str:
    """Normalise a Databricks date/datetime value to an ISO 8601 string."""
    if value is None:
        return ""
    s = str(value).strip()
    if not s or s == "None":
        return ""
    if " " in s:
        s = s.replace(" ", "T", 1)
    if "T" not in s:
        s = f"{s}T00:00:00"
    return s


# ---------------------------------------------------------------------------
# QuerySpec Factories & Row Mappers
# ---------------------------------------------------------------------------

def get_warehouse_overview_spec(request: WarehouseOverviewRequest) -> QuerySpec:
    """Return QuerySpec for Warehouse KPI Snapshot.

    Source view: vw_consumption_warehouse360_overview.
    No warehouse_id filter: the view pre-aggregates across all warehouses.
    """
    view = resolve_contract_object("warehouse360.overview", "wh360")
    contract_id = "warehouse360.overview"

    sql = f"""
    SELECT
        orders_total,
        orders_red,
        orders_amber,
        trs_open,
        tos_open,
        deliveries_today,
        deliveries_at_risk,
        inbound_open,
        bins_blocked,
        bins_total,
        bin_util_pct
    FROM {view}
    LIMIT 1
    """
    return QuerySpec(
        name="warehouse360.get_overview",
        module="wh360",
        endpoint="/api/warehouse360/overview",
        sql=sql,
        params={},
        cache_policy=CacheTier.GLOBAL_300S,
        tags=["wh360", "cockpit", "overview"],
        contract_id=contract_id,
    )


def map_warehouse_overview_rows(rows: list[dict], request: WarehouseOverviewRequest) -> dict:
    """Map raw overview rows to Warehouse360Overview schema.

    wh360_kpi_snapshot_v is a global single-row summary with no warehouse_id
    column. warehouseId in the response is populated from the request for
    API consistency.
    """
    if not rows:
        return {
            "warehouseId": request.warehouse_id,
            "ordersTotal": 0,
            "ordersRed": 0,
            "ordersAmber": 0,
            "trsOpen": 0,
            "tosOpen": 0,
            "deliveriesToday": 0,
            "deliveriesAtRisk": 0,
            "inboundOpen": 0,
            "binsBlocked": 0,
            "binsTotal": 0,
            "binUtilPct": 0.0,
        }

    row = rows[0]
    return {
        "warehouseId": request.warehouse_id,
        "ordersTotal": _safe_int(row.get("orders_total")),
        "ordersRed": _safe_int(row.get("orders_red")),
        "ordersAmber": _safe_int(row.get("orders_amber")),
        "trsOpen": _safe_int(row.get("trs_open")),
        "tosOpen": _safe_int(row.get("tos_open")),
        "deliveriesToday": _safe_int(row.get("deliveries_today")),
        "deliveriesAtRisk": _safe_int(row.get("deliveries_at_risk")),
        "inboundOpen": _safe_int(row.get("inbound_open")),
        "binsBlocked": _safe_int(row.get("bins_blocked")),
        "binsTotal": _safe_int(row.get("bins_total")),
        "binUtilPct": _safe_float(row.get("bin_util_pct")),
    }


def get_warehouse_inbound_spec(request: WarehouseInboundRequest) -> QuerySpec:
    """Return QuerySpec for Inbound POs & STOs.

    Source view: vw_consumption_warehouse360_inbound_backlog.

    The request still carries warehouse_id for backwards-compatibility, but
    the SQL does NOT filter on it (the view does not expose LGNUM).
    """
    view = resolve_contract_object("warehouse360.inbound_backlog", "wh360")
    contract_id = "warehouse360.inbound_backlog"

    where_clauses: list[str] = []
    params: dict[str, object] = {}

    if request.plant_id:
        where_clauses.append("plant_id = :plant_id")
        params["plant_id"] = request.plant_id
    if request.date_from:
        where_clauses.append("po_date >= :date_from")
        params["date_from"] = request.date_from
    if request.date_to:
        where_clauses.append("po_date <= :date_to")
        params["date_to"] = request.date_to

    where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    # First-wave PO-line CORE fields (ADR-0004 D1). vendor_name / gr_qty / open_qty / delivery_date /
    # qa_status are deferred future enrichment and are not selected (mapper emits None for them).
    sql = f"""
    SELECT
        po_id,
        po_item,
        doc_type,
        vendor_id,
        plant_id,
        storage_loc,
        material_id,
        material_name,
        ordered_qty,
        uom,
        po_date,
        oldest_po_age_days,
        inbound_backlog_risk_band
    FROM {view}
    {where_str}
    LIMIT {request.limit}
    """

    return QuerySpec(
        name="warehouse360.get_inbound",
        module="wh360",
        endpoint="/api/warehouse360/inbound",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "inbound", "receipts"],
        contract_id=contract_id,
    )


def _derive_inbound_document_type(doc_type: object) -> str:
    """Normalise wh360_inbound_v.doc_type to the contract enum.

    The source value is a free-text SAP code; we map known PO/STO patterns
    and default everything else to 'unknown' rather than guessing.
    """
    raw = str(doc_type or "").upper().strip()
    if not raw:
        return "unknown"
    if "STO" in raw or "TRANS" in raw:
        return "STO"
    if "PO" in raw or "PURCHASE" in raw or raw.startswith("Z"):
        return "PO"
    return "unknown"


def _derive_inbound_document_status(row: dict) -> Optional[str]:
    """Derive a coarse document status from delivery_complete + open_qty.

    [classification: application-heuristic]

    The view has no dedicated document-status column. We expose:
      - 'received' when delivery_complete == 'Y'
      - 'open'     when delivery_complete != 'Y' and open_qty > 0
      - None       otherwise (e.g. delivery_complete='Y' AND open_qty=0
                   are both consistent with 'received'; we already covered)

    `qa_status` carries QA lot disposition and is NOT a document status —
    it is exposed in the dedicated `status` field only as derived inbound
    state. A future contract split may add a `qaStatus` field; until then
    qa_status is intentionally not surfaced here to avoid relabelling QA
    decisions as document state.
    """
    complete = str(row.get("delivery_complete") or "").strip().upper()
    if complete == "Y":
        return "received"
    open_qty = _safe_float(row.get("open_qty"))
    if open_qty > 0:
        return "open"
    return None


def map_warehouse_inbound_rows(rows: list[dict]) -> list[dict]:
    """Map raw inbound rows to Warehouse360InboundItem schema.

    Source columns documented in
    docs/data-layer/warehouse360-inbound-source-verification.md §3.

    Source-truthful guardrails:
      - warehouseNumber, stockTransportOrderId, supplyingPlantId,
        exceptionReason are absent from wh360_inbound_v; the mapper emits
        null rather than empty strings or invented values.
      - unitOfMeasure echoes uom verbatim (no KG default).
      - quantity maps to open_qty (still-due quantity) — the contract has
        only one quantity field today.
      - status is a coarse heuristic; classified as application-heuristic.
      - receivedDate is delivery_date only when delivery_complete='Y'.
    """
    result = []
    for row in rows:
        document_status = _derive_inbound_document_status(row)
        is_complete = str(row.get("delivery_complete") or "").strip().upper() == "Y"

        result.append({
            "documentType": _derive_inbound_document_type(row.get("doc_type")),
            "purchaseOrderId": str(row["po_id"]) if row.get("po_id") else None,
            # STO identifier is absent in wh360_inbound_v — see source-verification doc §3.
            "stockTransportOrderId": None,
            "itemId": str(row["po_item"]) if row.get("po_item") is not None else None,
            "vendorId": str(row["vendor_id"]) if row.get("vendor_id") else None,
            # Supplying plant for STOs is absent in this view.
            "supplyingPlantId": None,
            "materialId": str(row.get("material_id") or ""),
            "materialDescription": str(row["material_name"]) if row.get("material_name") else None,
            # Inbound PO lines have no GR-batch until receipt happens; null is source-truthful.
            "batchId": None,
            "plantId": str(row["plant_id"]) if row.get("plant_id") else None,
            "storageLocation": str(row["storage_loc"]) if row.get("storage_loc") else None,
            # LGNUM/warehouse number is absent in wh360_inbound_v.
            "warehouseNumber": None,
            "expectedDate": _format_datetime(row.get("delivery_date")) or None,
            # receivedDate is the delivery_date only when the line is complete.
            "receivedDate": (
                _format_datetime(row.get("delivery_date")) or None if is_complete else None
            ),
            "quantity": _safe_float(row.get("open_qty")) if row.get("open_qty") is not None else None,
            "unitOfMeasure": str(row["uom"]) if row.get("uom") else None,
            "status": document_status,
            # No exception_reason column in the source view.
            "exceptionReason": None,
        })
    return result


def get_warehouse_outbound_spec(request: WarehouseOutboundRequest) -> QuerySpec:
    """Return QuerySpec for Outbound Deliveries.

    Source view: vw_consumption_warehouse360_outbound_backlog.
    """
    view = resolve_contract_object("warehouse360.outbound_backlog", "wh360")
    contract_id = "warehouse360.outbound_backlog"

    where_clauses: list[str] = []
    params: dict[str, object] = {}

    if request.plant_id:
        where_clauses.append("plant_id = :plant_id")
        params["plant_id"] = request.plant_id
    if request.date_from:
        where_clauses.append("planned_gi_date >= :date_from")
        params["date_from"] = request.date_from
    if request.date_to:
        where_clauses.append("planned_gi_date <= :date_to")
        params["date_to"] = request.date_to

    where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = f"""
    SELECT
        delivery_id,
        delivery_type,
        plant_id,
        customer_id,
        customer_name,
        planned_gi_date,
        actual_gi_date,
        delivery_date,
        gross_weight,
        pick_pct,
        line_count,
        risk,
        shipped
    FROM {view}
    {where_str}
    LIMIT {request.limit}
    """

    return QuerySpec(
        name="warehouse360.get_outbound",
        module="wh360",
        endpoint="/api/warehouse360/outbound",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "outbound", "deliveries"],
        contract_id=contract_id,
    )


def map_warehouse_outbound_rows(rows: list[dict]) -> list[dict]:
    """Map raw wh360_deliveries_v rows to Warehouse360OutboundItem.

    Source columns verified live 2026-05-25 — see
    docs/data-layer/warehouse360-outbound-source-verification.md §3.

    Source-truthful guardrails:
      - deliveryItemId, salesOrderId, materialDescription, batchId,
        storageLocation, exceptionReason are absent from the
        delivery-header view; the mapper emits ``None`` rather than
        empty strings or invented values.
      - materialId remains empty string (``""``) because the generated
        ``Warehouse360OutboundItem`` contract requires ``materialId: str``.
        The header-grain view has no material identifier at all; relaxing
        the contract is tracked as a future follow-up so the response
        body shape stays stable for the existing frontend. See
        source-verification doc §5.
      - quantity maps to ``gross_weight`` (a header-level weight, not a
        line quantity) with ``unitOfMeasure`` mirroring ``weight_uom`` so
        the unit is explicit. Documented as ``application-derived`` in
        the source-verification doc §4.
      - status maps to ``wm_status`` verbatim — the WM-status string is
        source-truthful and not coerced into a governed enum.
      - warehouseNumber maps to ``lgnum``.
    """
    result = []
    for row in rows:
        gross_weight = row.get("gross_weight")
        quantity = float(gross_weight) if gross_weight is not None else None

        result.append({
            "deliveryId": str(row["delivery_id"]) if row.get("delivery_id") else None,
            # Line-grain — absent in wh360_deliveries_v (delivery-header view).
            "deliveryItemId": None,
            "customerId": str(row["customer_id"]) if row.get("customer_id") else None,
            # Sales order is not exposed on the delivery-header view.
            "salesOrderId": None,
            # The header-grain view has no material identifier. Contract
            # requires materialId: str — empty string keeps the response
            # body shape stable; relaxing the contract is a follow-up.
            "materialId": "",
            "materialDescription": None,
            "batchId": None,
            "plantId": str(row["plant_id"]) if row.get("plant_id") else None,
            "storageLocation": None,
            "warehouseNumber": str(row["lgnum"]) if row.get("lgnum") else None,
            "plannedGoodsIssueDate": _format_datetime(row.get("planned_gi_date")) or None,
            "actualGoodsIssueDate": _format_datetime(row.get("actual_gi_date")) or None,
            "quantity": quantity,
            "unitOfMeasure": str(row["weight_uom"]) if row.get("weight_uom") else None,
            "status": str(row["wm_status"]) if row.get("wm_status") else None,
            # No exception_reason column in wh360_deliveries_v — exceptions
            # live in imwm_exceptions_v.
            "exceptionReason": None,
        })
    return result


def get_warehouse_staging_spec(request: WarehouseStagingRequest) -> QuerySpec:
    """Return QuerySpec for Production Staging Demands.

    Source view: vw_consumption_warehouse360_staging_workload.
    """
    view = resolve_contract_object("warehouse360.staging_workload", "wh360")
    contract_id = "warehouse360.staging_workload"

    where_clauses: list[str] = []
    params: dict[str, object] = {}

    if request.plant_id:
        where_clauses.append("plant_id = :plant_id")
        params["plant_id"] = request.plant_id
    if request.date_from:
        where_clauses.append("sched_start >= :date_from")
        params["date_from"] = request.date_from
    if request.date_to:
        where_clauses.append("sched_start <= :date_to")
        params["date_to"] = request.date_to

    where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = f"""
    SELECT
        order_id,
        material_id,
        material_name,
        plant_id,
        uom,
        order_qty,
        sched_start,
        sched_finish,
        staging_pct,
        to_items_total,
        to_items_done,
        mins_to_start,
        risk
    FROM {view}
    {where_str}
    LIMIT {request.limit}
    """

    return QuerySpec(
        name="warehouse360.get_staging",
        module="wh360",
        endpoint="/api/warehouse360/staging",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "production", "staging"],
        contract_id=contract_id,
    )


def _derive_staging_status(staging_pct: object) -> Optional[str]:
    """Derive a coarse staging status from ``wh360_process_orders_v.staging_pct``.

    [classification: application-heuristic]

    The source view has no governed staging-status column. We expose:
      - 'staged'  when staging_pct >= 1.0
      - 'open'    when 0 <= staging_pct < 1.0
      - None      when staging_pct is null / unknown

    The governed taxonomy (and whether ``risk`` should be split into a
    separate field) is unresolved — see source-verification doc §6.
    """
    if staging_pct is None:
        return None
    try:
        pct = float(staging_pct)
    except (TypeError, ValueError):
        return None
    if pct >= 1.0:
        return "staged"
    if pct >= 0.0:
        return "open"
    return None


def _staging_quantity_pair(order_qty: object, staging_pct: object) -> tuple[Optional[float], Optional[float]]:
    """Derive ``(stagedQuantity, openQuantity)`` from ``order_qty * staging_pct``.

    [classification: application-derived]

    The source has no per-row stagedQuantity / openQuantity columns. We
    derive them from ``order_qty`` and the ``staging_pct`` fraction. When
    either input is null, both outputs are null — we do NOT default to 0.
    """
    if order_qty is None or staging_pct is None:
        return None, None
    try:
        qty = float(order_qty)
        pct = float(staging_pct)
    except (TypeError, ValueError):
        return None, None
    pct = max(0.0, min(1.0, pct))
    return round(qty * pct, 6), round(qty * (1.0 - pct), 6)


def map_warehouse_staging_rows(rows: list[dict]) -> list[dict]:
    """Map raw staging rows from wh360_process_orders_v to Warehouse360StagingItem.

    Source columns documented in
    docs/data-layer/warehouse360-staging-source-verification.md §3.

    Source-truthful guardrails:
      - warehouseNumber, reservationItemId, storageLocation, exceptionReason
        are absent from wh360_process_orders_v; the mapper emits null
        rather than empty strings or invented values.
      - processOrderId prefers ``sap_order`` over ``order_id`` (per
        verification §3.1, ``sap_order`` is the SAP-facing identifier).
      - requirementDate uses ``sched_start`` — the documented staging-by
        anchor — not ``planned_start``.
      - requiredQuantity maps to ``order_qty``; ``stagedQuantity`` and
        ``openQuantity`` are derived from ``order_qty * staging_pct`` and
        classified as application-derived.
      - stagingStatus is derived from ``staging_pct`` and classified as
        application-heuristic; ``risk`` is preserved as a separate
        source-field value in the response when contract permits, but the
        current contract does not surface ``risk`` so we drop it (a future
        contract may add it).
      - unitOfMeasure echoes ``uom`` verbatim (no KG default).
    """
    result = []
    for row in rows:
        staging_pct = row.get("staging_pct")
        order_qty = row.get("order_qty")
        staged_qty, open_qty = _staging_quantity_pair(order_qty, staging_pct)
        process_order = row.get("sap_order") or row.get("order_id")

        result.append({
            "processOrderId": str(process_order) if process_order else None,
            "reservationId": str(row["reservation_no"]) if row.get("reservation_no") else None,
            # Reservation-line granularity is absent in wh360_process_orders_v —
            # see source-verification doc §3 (unresolved-pending-source).
            "reservationItemId": None,
            "materialId": str(row.get("material_id") or ""),
            "materialDescription": str(row["material_name"]) if row.get("material_name") else None,
            "batchId": str(row["batch_id"]) if row.get("batch_id") else None,
            "plantId": str(row["plant_id"]) if row.get("plant_id") else None,
            # Per-row storage location is absent in this view — null is
            # source-truthful (unresolved-pending-source).
            "storageLocation": None,
            # LGNUM/warehouse number is absent in wh360_process_orders_v.
            "warehouseNumber": None,
            "requirementDate": _format_datetime(row.get("sched_start")) or None,
            "requiredQuantity": float(order_qty) if order_qty is not None else None,
            "stagedQuantity": staged_qty,
            "openQuantity": open_qty,
            "unitOfMeasure": str(row["uom"]) if row.get("uom") else None,
            "stagingStatus": _derive_staging_status(staging_pct),
            # Exceptions belong to imwm_exceptions_v, not here.
            "exceptionReason": None,
        })
    return result


def get_warehouse_exceptions_spec(request: WarehouseExceptionRequest) -> QuerySpec:
    """Return QuerySpec for IM/WM exceptions.

    Source view: vw_consumption_warehouse360_im_wm_reconciliation.
    """
    view = resolve_contract_object("warehouse360.im_wm_reconciliation", "wh360")
    contract_id = "warehouse360.im_wm_reconciliation"

    where_clauses: list[str] = []
    params: dict[str, object] = {}

    if request.plant_id:
        where_clauses.append("plant_id = :plant_id")
        params["plant_id"] = request.plant_id
    if request.date_from:
        where_clauses.append("latest_detected_date >= :date_from")
        params["date_from"] = request.date_from
    if request.date_to:
        where_clauses.append("latest_detected_date <= :date_to")
        params["date_to"] = request.date_to

    where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = f"""
    SELECT
        exception_type,
        severity,
        material_id,
        plant_id,
        qty,
        batch_id,
        detail_text
    FROM {view}
    {where_str}
    LIMIT {request.limit}
    """

    return QuerySpec(
        name="warehouse360.get_exceptions",
        module="wh360",
        endpoint="/api/warehouse360/exceptions",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "reconciliation", "exceptions"],
        contract_id=contract_id,
    )


def _map_exception_severity_v2(severity_raw: object) -> Optional[str]:
    """Map ``imwm_exceptions_v.severity`` (int) to the contract enum.

    [classification: application-heuristic — governance-pending]

    The source severity is an integer; the contract enum is
    {'critical','high','medium','low'} but is ``nullable().optional()``.
    No governed int→enum mapping exists today (see source-verification
    doc §6, severity int→enum mapping unresolved). To stay source-truthful
    we return ``None`` for ANY integer value rather than invent a mapping
    (e.g. 1=critical) without Inventory-team authority.

    The pre-existing ``_map_exception_severity`` helper defaulted to
    'low' as a final fallback; that default is forbidden by the
    PR brief and is replaced here with explicit null.
    """
    if severity_raw is None:
        return None
    # Accept already-governed string values (e.g. set by a future migration).
    if isinstance(severity_raw, str):
        s = severity_raw.lower().strip()
        if s in {"critical", "high", "medium", "low"}:
            return s
    # Numeric severity has no governed mapping — return null.
    return None


def map_warehouse_exceptions_rows(rows: list[dict]) -> list[dict]:
    """Map raw imwm_exceptions_v rows to Warehouse360ExceptionItem.

    Source columns documented in
    docs/data-layer/warehouse360-imwm-exceptions-source-verification.md §3.

    Source-truthful guardrails:
      - warehouseNumber, expiryDate, daysToExpiry, documentId,
        processOrderId, deliveryId, purchaseOrderId, unitOfMeasure are
        absent from imwm_exceptions_v; the mapper emits null rather than
        empty strings or invented values.
      - severity maps to null when the source carries an int (no
        governed int→enum mapping) — see _map_exception_severity_v2.
      - reason maps to detail_text (free-text reason).
      - recommendedReviewAction stays null until a governed rule engine
        exists (the schema classifies it as application-heuristic).
    """
    result = []
    for row in rows:
        result.append({
            "exceptionType": str(row["exception_type"]) if row.get("exception_type") else None,
            "severity": _map_exception_severity_v2(row.get("severity")),
            "materialId": str(row.get("material_id") or ""),
            "batchId": str(row["batch_id"]) if row.get("batch_id") else None,
            "plantId": str(row["plant_id"]) if row.get("plant_id") else None,
            "storageLocation": str(row["storage_loc"]) if row.get("storage_loc") else None,
            # LGNUM/warehouse number is absent in imwm_exceptions_v.
            "warehouseNumber": None,
            "quantity": float(row["qty"]) if row.get("qty") is not None else None,
            # No UOM column on imwm_exceptions_v — sibling imwm_stock_comparison_v
            # carries it (out of scope for this slice).
            "unitOfMeasure": None,
            # detected_date is when the exception was detected, NOT the batch
            # expiry date. Returning null for expiryDate / daysToExpiry is
            # source-truthful — see source-verification doc §3.
            "expiryDate": None,
            "daysToExpiry": None,
            # No document linkage in imwm_exceptions_v.
            "documentId": None,
            "processOrderId": None,
            "deliveryId": None,
            "purchaseOrderId": None,
            "reason": str(row["detail_text"]) if row.get("detail_text") else None,
            # application-heuristic — leave null until a governed rule
            # engine exists. The pre-existing mapper emitted a string;
            # null is the safe default per spec §8.
            "recommendedReviewAction": None,
        })
    return result


def get_warehouse_stock_exceptions_spec(request: WarehouseStockExceptionsRequest) -> QuerySpec:
    """Return QuerySpec for stock exceptions.

    Source view: vw_consumption_warehouse360_stock_exceptions.
    """
    view = resolve_contract_object("warehouse360.stock_exceptions", "wh360")
    contract_id = "warehouse360.stock_exceptions"

    where_clauses: list[str] = []
    params: dict[str, object] = {}

    if request.plant_id:
        where_clauses.append("plant_id = :plant_id")
        params["plant_id"] = request.plant_id
    if request.bucket:
        where_clauses.append("exception_type = :bucket")
        params["bucket"] = request.bucket

    where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = f"""
    SELECT
        plant_id,
        material_id,
        batch_id,
        exception_type,
        qty,
        minimum_days_to_expiry,
        has_minimum_shelf_life_breach
    FROM {view}
    {where_str}
    LIMIT {request.limit}
    """

    return QuerySpec(
        name="warehouse360.get_stock_exceptions",
        module="wh360",
        endpoint="/api/warehouse360/stock-exceptions",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "stock", "exceptions"],
        contract_id=contract_id,
    )


def get_warehouse_shortfalls_spec(request: WarehouseShortfallsRequest) -> QuerySpec:
    """Return QuerySpec for material shortfalls.

    Source view: vw_consumption_warehouse360_shortfalls.
    """
    view = resolve_contract_object("warehouse360.shortfalls", "wh360")
    contract_id = "warehouse360.shortfalls"

    where_clauses: list[str] = []
    params: dict[str, object] = {}

    if request.plant_id:
        where_clauses.append("plant_id = :plant_id")
        params["plant_id"] = request.plant_id

    where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = f"""
    SELECT
        plant_id,
        material_id,
        shortfall_qty,
        open_items_count,
        oldest_tr_date
    FROM {view}
    {where_str}
    LIMIT {request.limit}
    """

    return QuerySpec(
        name="warehouse360.get_shortfalls",
        module="wh360",
        endpoint="/api/warehouse360/shortfalls",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "production", "shortfalls"],
        contract_id=contract_id,
    )


def get_warehouse_stock_zones_spec(request: WarehouseStockZonesRequest) -> QuerySpec:
    view = resolve_contract_object("warehouse360.stock_zones", "wh360")
    contract_id = "warehouse360.stock_zones"
    params = {}
    where_clauses = ["warehouse_number = :warehouse_id"]
    params["warehouse_id"] = request.warehouse_id
    if request.plant_id:
        where_clauses.append("plant_id = :plant_id")
        params["plant_id"] = request.plant_id
    where_str = " WHERE " + " AND ".join(where_clauses)
    sql = f"""
    SELECT
        plant_id,
        warehouse_number,
        storage_type,
        bin_type,
        bin_record_count,
        occupied_bin_count,
        empty_bin_count,
        blocked_bin_count,
        occupancy_rate
    FROM {view}
    {where_str}
    LIMIT {request.limit}
    """
    return QuerySpec(
        name="warehouse360.get_stock_zones",
        module="wh360",
        endpoint="/api/warehouse360/stock-zones",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "stock", "zones"],
        contract_id=contract_id,
    )


def get_warehouse_batch_hold_status_spec(request: WarehouseBatchHoldStatusRequest) -> QuerySpec:
    view = resolve_contract_object("warehouse360.batch_hold_status", "wh360")
    contract_id = "warehouse360.batch_hold_status"
    params = {"batch_id": request.batch_id}
    where_clauses = ["batch_id = :batch_id"]
    if request.plant_id:
        where_clauses.append("plant_id = :plant_id")
        params["plant_id"] = request.plant_id
    where_str = " WHERE " + " AND ".join(where_clauses)
    sql = f"""
    SELECT
        plant_id,
        storage_location_id,
        material_id,
        batch_id,
        uom,
        unrestricted_quantity,
        blocked_quantity,
        restricted_quantity,
        total_quantity,
        stock_type,
        has_blocking_hold,
        last_updated_at
    FROM {view}
    {where_str}
    LIMIT 1
    """
    return QuerySpec(
        name="warehouse360.get_batch_hold_status",
        module="wh360",
        endpoint="/api/warehouse360/batch/{{batchId}}/hold-status",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "batch", "hold_status"],
        contract_id=contract_id,
    )


def get_warehouse_staging_readiness_spec(request: WarehouseStagingReadinessRequest) -> QuerySpec:
    view = resolve_contract_object("warehouse360.staging_readiness", "wh360")
    contract_id = "warehouse360.staging_readiness"
    params = {"plant_id": request.plant_id, "plan_date": request.plan_date}
    sql = f"""
    SELECT
        plant_id,
        plan_date,
        total_orders,
        fully_staged,
        partially_staged,
        not_staged,
        blocked
    FROM {view}
    WHERE plant_id = :plant_id AND plan_date = CAST(:plan_date AS DATE)
    LIMIT 1
    """
    return QuerySpec(
        name="warehouse360.get_staging_readiness",
        module="wh360",
        endpoint="/api/warehouse360/staging-readiness",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wh360", "staging", "readiness"],
        contract_id=contract_id,
    )


def map_warehouse_stock_exceptions_rows(rows: list[dict]) -> list[dict]:
    """Map raw stock exceptions rows to Warehouse360StockExceptionItem."""
    result = []
    for row in rows:
        result.append({
            "plantId": str(row["plant_id"]) if row.get("plant_id") else None,
            "materialId": str(row["material_id"]) if row.get("material_id") else None,
            "batchId": str(row["batch_id"]) if row.get("batch_id") else None,
            "exceptionType": str(row["exception_type"]) if row.get("exception_type") else None,
            "qty": _safe_float(row.get("qty")) if row.get("qty") is not None else None,
            "minimumDaysToExpiry": _safe_int(row.get("minimum_days_to_expiry")) if row.get("minimum_days_to_expiry") is not None else None,
            "hasMinimumShelfLifeBreach": bool(row["has_minimum_shelf_life_breach"]) if row.get("has_minimum_shelf_life_breach") is not None else None,
        })
    return result


def map_warehouse_shortfalls_rows(rows: list[dict]) -> list[dict]:
    """Map raw shortfalls rows to Warehouse360ShortfallItem."""
    result = []
    for row in rows:
        result.append({
            "plantId": str(row["plant_id"]) if row.get("plant_id") else None,
            "materialId": str(row["material_id"]) if row.get("material_id") else None,
            "shortfallQty": _safe_float(row.get("shortfall_qty")) if row.get("shortfall_qty") is not None else None,
            "openItemsCount": _safe_int(row.get("open_items_count")) if row.get("open_items_count") is not None else None,
            "oldestTrDate": str(row["oldest_tr_date"]) if row.get("oldest_tr_date") else None,
        })
    return result


def map_warehouse_stock_zones_rows(rows: list[dict]) -> list[dict]:
    """Map raw stock zones rows."""
    result = []
    for row in rows:
        result.append({
            "plantId": str(row["plant_id"]) if row.get("plant_id") else None,
            "warehouseNumber": str(row["warehouse_number"]) if row.get("warehouse_number") else None,
            "storageType": str(row["storage_type"]) if row.get("storage_type") else None,
            "binType": str(row["bin_type"]) if row.get("bin_type") else None,
            "binRecordCount": _safe_int(row.get("bin_record_count")),
            "occupiedBinCount": _safe_int(row.get("occupied_bin_count")),
            "emptyBinCount": _safe_int(row.get("empty_bin_count")),
            "blockedBinCount": _safe_int(row.get("blocked_bin_count")),
            "occupancyRate": _safe_float(row.get("occupancy_rate")),
        })
    return result


def map_warehouse_batch_hold_status_rows(rows: list[dict]) -> list[dict]:
    """Map raw batch hold status rows."""
    result = []
    for row in rows:
        result.append({
            "plantId": str(row["plant_id"]) if row.get("plant_id") else None,
            "storageLocationId": str(row["storage_location_id"]) if row.get("storage_location_id") else None,
            "materialId": str(row["material_id"]) if row.get("material_id") else None,
            "batchId": str(row["batch_id"]) if row.get("batch_id") else None,
            "uom": str(row["uom"]) if row.get("uom") else None,
            "unrestrictedQuantity": _safe_float(row.get("unrestricted_quantity")),
            "blockedQuantity": _safe_float(row.get("blocked_quantity")),
            "restrictedQuantity": _safe_float(row.get("restricted_quantity")),
            "totalQuantity": _safe_float(row.get("total_quantity")),
            "stockType": str(row["stock_type"]) if row.get("stock_type") else None,
            "hasBlockingHold": bool(row.get("has_blocking_hold")),
            "lastUpdatedAt": _format_datetime(row.get("last_updated_at")),
        })
    return result


def map_warehouse_staging_readiness_rows(rows: list[dict]) -> list[dict]:
    """Map raw staging readiness rows."""
    result = []
    for row in rows:
        result.append({
            "plantId": str(row["plant_id"]) if row.get("plant_id") else None,
            "planDate": str(row["plan_date"]) if row.get("plan_date") else None,
            "totalOrders": _safe_int(row.get("total_orders")),
            "fullyStaged": _safe_int(row.get("fully_staged")),
            "partiallyStaged": _safe_int(row.get("partially_staged")),
            "notStaged": _safe_int(row.get("not_staged")),
            "blocked": _safe_int(row.get("blocked")),
        })
    return result


class Warehouse360Repository:
    """Repository for Warehouse 360 data."""

    def __init__(self, repository: DatabricksRepository) -> None:
        self._repository = repository

    async def fetch_warehouse_overview(self, request: WarehouseOverviewRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_warehouse_overview_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_warehouse_inbound(self, request: WarehouseInboundRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_warehouse_inbound_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_warehouse_outbound(self, request: WarehouseOutboundRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_warehouse_outbound_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_warehouse_staging(self, request: WarehouseStagingRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_warehouse_staging_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_warehouse_exceptions(self, request: WarehouseExceptionRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_warehouse_exceptions_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_warehouse_stock_exceptions(self, request: WarehouseStockExceptionsRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_warehouse_stock_exceptions_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_warehouse_shortfalls(self, request: WarehouseShortfallsRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_warehouse_shortfalls_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_warehouse_stock_zones(self, request: WarehouseStockZonesRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_warehouse_stock_zones_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_warehouse_batch_hold_status(self, request: WarehouseBatchHoldStatusRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_warehouse_batch_hold_status_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_warehouse_staging_readiness(self, request: WarehouseStagingReadinessRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_warehouse_staging_readiness_spec(request),
            mapper=lambda rows: rows,
        )
