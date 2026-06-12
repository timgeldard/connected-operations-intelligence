"""WM Operations Databricks-api adapter — QuerySpec factories and row mappers.

Read-only manager tools over the SAP WM staging/dispensary process (WMA-E-19 WM Cockpit,
WMA-E-50 staging with TR split, WMA-E-28 / PEX-E-61 dispensary). All queries resolve
through the wm_operations.* contracts (vw_consumption_wm_operations_*) in the governed
gold_io_reporting serving schema — same catalog/schema env vars as Warehouse360 (wh360
domain), RLS enforced by the underlying *_secured views via the user's OAuth token.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.contract_resolver import resolve_contract_object
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec

_WORK_AREAS = {
    "PRODUCTION_STAGING",
    "DISPENSARY_REPLENISHMENT",
    "DISPENSARY_PICKING",
    "WAREHOUSE_OTHER",
}
_WORKLIST_STATUSES = {"OPEN", "IN_PROGRESS", "PARKED", "NO_STOCK", "COMPLETE"}
_STORAGE_ZONES = {"DISPENSARY", "PRODUCTION_SUPPLY", "PALLETISING", "INTERIM", "WAREHOUSE"}


@dataclass
class WmWorklistRequest:
    plant_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    work_area: Optional[str] = None
    status: Optional[str] = None
    queue: Optional[str] = None
    campaign: Optional[str] = None
    reference: Optional[str] = None
    include_complete: bool = False
    limit: int = 200
    offset: int = 0


@dataclass
class WmWorklistSummaryRequest:
    plant_id: Optional[str] = None
    warehouse_id: Optional[str] = None


@dataclass
class WmOrderReadinessRequest:
    plant_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    # Optional schedule horizon: keep orders whose scheduled start falls within
    # [today - start_from_days_ago, today + start_to_days_ahead].
    start_from_days_ago: Optional[int] = None
    start_to_days_ahead: Optional[int] = None
    limit: int = 200


@dataclass
class WmBinStockRequest:
    plant_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    storage_zone: Optional[str] = None
    storage_type: Optional[str] = None
    material_id: Optional[str] = None
    bin_id: Optional[str] = None
    expiring_within_days: Optional[int] = None
    limit: int = 500


def _safe_float(value: object) -> Optional[float]:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _safe_int(value: object) -> Optional[int]:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _opt_str(row: dict, key: str) -> Optional[str]:
    value = row.get(key)
    return str(value) if value not in (None, "") else None


def _safe_bool(value: object) -> Optional[bool]:
    """Statements-API booleans arrive as strings ("true"/"false") — bool("false") is True,
    so flags must be parsed, not cast (same coercion map_rows_generic applies)."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() == "true"


def _scope_where(request, params: dict, clauses: Optional[list[str]] = None) -> str:
    """Shared optional plant/warehouse predicate."""
    where_clauses: list[str] = list(clauses or [])
    if request.plant_id:
        where_clauses.append("plant_id = :plant_id")
        params["plant_id"] = request.plant_id
    if request.warehouse_id:
        where_clauses.append("warehouse_id = :warehouse_id")
        params["warehouse_id"] = request.warehouse_id
    return (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""


# ── Worklist ──────────────────────────────────────────────────────────────────

def get_wm_worklist_spec(request: WmWorklistRequest) -> QuerySpec:
    view = resolve_contract_object("wm_operations.worklist", "wh360")
    params: dict[str, object] = {}
    clauses: list[str] = []
    if request.work_area:
        if request.work_area not in _WORK_AREAS:
            raise ValueError(f"Unknown work_area {request.work_area!r}")
        clauses.append("work_area = :work_area")
        params["work_area"] = request.work_area
    if request.status:
        if request.status not in _WORKLIST_STATUSES:
            raise ValueError(f"Unknown worklist status {request.status!r}")
        clauses.append("worklist_status = :status")
        params["status"] = request.status
    elif not request.include_complete:
        clauses.append("worklist_status <> 'COMPLETE'")
    if request.queue:
        clauses.append("queue = :queue")
        params["queue"] = request.queue
    if request.campaign:
        clauses.append("campaign_id = :campaign")
        params["campaign"] = request.campaign
    if request.reference:
        clauses.append("reference_id = :reference")
        params["reference"] = request.reference
    where_str = _scope_where(request, params, clauses)
    sql = f"""
    SELECT
        plant_id,
        warehouse_id,
        tr_id,
        work_area,
        worklist_status,
        reference_type,
        reference_id,
        order_material_id,
        order_scheduled_start_date,
        source_storage_type,
        source_zone,
        destination_storage_type,
        destination_zone,
        destination_bin,
        queue,
        campaign_id,
        assigned_operator,
        job_sequence,
        transfer_priority,
        created_ts,
        planned_execution_ts,
        item_count,
        open_item_count,
        material_count,
        material_id,
        material_name,
        required_qty,
        open_qty,
        uom,
        has_mixed_base_uom,
        to_item_count,
        to_items_confirmed,
        to_confirmed_qty,
        pick_progress_fraction,
        latest_to_confirmed_ts,
        cycle_hours,
        age_hours,
        is_overdue,
        short_pick_qty,
        short_pick_item_count,
        order_production_line
    FROM {view}
    {where_str}
    ORDER BY planned_execution_ts ASC NULLS LAST, created_ts ASC
    LIMIT {int(request.limit)} OFFSET {int(request.offset)}
    """
    return QuerySpec(
        name="wm_operations.get_worklist",
        module="wh360",
        endpoint="/api/wm-operations/worklist",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "staging", "worklist"],
        contract_id="wm_operations.worklist",
    )


def map_wm_worklist_rows(rows: list[dict]) -> list[dict]:
    result = []
    for row in rows:
        result.append({
            "plantId": _opt_str(row, "plant_id"),
            "warehouseId": _opt_str(row, "warehouse_id"),
            "trId": _opt_str(row, "tr_id"),
            "workArea": _opt_str(row, "work_area"),
            "worklistStatus": _opt_str(row, "worklist_status"),
            "referenceType": _opt_str(row, "reference_type"),
            "referenceId": _opt_str(row, "reference_id"),
            "orderMaterialId": _opt_str(row, "order_material_id"),
            "orderScheduledStartDate": _opt_str(row, "order_scheduled_start_date"),
            "sourceStorageType": _opt_str(row, "source_storage_type"),
            "sourceZone": _opt_str(row, "source_zone"),
            "destinationStorageType": _opt_str(row, "destination_storage_type"),
            "destinationZone": _opt_str(row, "destination_zone"),
            "destinationBin": _opt_str(row, "destination_bin"),
            "queue": _opt_str(row, "queue"),
            "campaignId": _opt_str(row, "campaign_id"),
            "assignedOperator": _opt_str(row, "assigned_operator"),
            "jobSequence": _opt_str(row, "job_sequence"),
            "transferPriority": _opt_str(row, "transfer_priority"),
            "createdTs": _opt_str(row, "created_ts"),
            "plannedExecutionTs": _opt_str(row, "planned_execution_ts"),
            "itemCount": _safe_int(row.get("item_count")),
            "openItemCount": _safe_int(row.get("open_item_count")),
            "materialCount": _safe_int(row.get("material_count")),
            "materialId": _opt_str(row, "material_id"),
            "materialName": _opt_str(row, "material_name"),
            "requiredQty": _safe_float(row.get("required_qty")),
            "openQty": _safe_float(row.get("open_qty")),
            "uom": _opt_str(row, "uom"),
            "hasMixedBaseUom": _safe_bool(row.get("has_mixed_base_uom")),
            "toItemCount": _safe_int(row.get("to_item_count")),
            "toItemsConfirmed": _safe_int(row.get("to_items_confirmed")),
            "toConfirmedQty": _safe_float(row.get("to_confirmed_qty")),
            "pickProgressFraction": _safe_float(row.get("pick_progress_fraction")),
            "latestToConfirmedTs": _opt_str(row, "latest_to_confirmed_ts"),
            "cycleHours": _safe_float(row.get("cycle_hours")),
            "ageHours": _safe_float(row.get("age_hours")),
            "isOverdue": _safe_bool(row.get("is_overdue")),
            "shortPickQty": _safe_float(row.get("short_pick_qty")),
            "shortPickItemCount": _safe_int(row.get("short_pick_item_count")),
            "orderProductionLine": _opt_str(row, "order_production_line"),
        })
    return result


# ── Worklist summary ──────────────────────────────────────────────────────────

def get_wm_worklist_summary_spec(request: WmWorklistSummaryRequest) -> QuerySpec:
    view = resolve_contract_object("wm_operations.worklist_summary", "wh360")
    params: dict[str, object] = {}
    where_str = _scope_where(request, params)
    sql = f"""
    SELECT
        plant_id,
        warehouse_id,
        work_area,
        worklist_status,
        tr_count,
        total_open_qty,
        total_required_qty,
        operator_count,
        earliest_planned_ts,
        earliest_created_ts
    FROM {view}
    {where_str}
    ORDER BY plant_id, warehouse_id, work_area, worklist_status
    LIMIT 500
    """
    return QuerySpec(
        name="wm_operations.get_worklist_summary",
        module="wh360",
        endpoint="/api/wm-operations/worklist-summary",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "staging", "summary"],
        contract_id="wm_operations.worklist_summary",
    )


def map_wm_worklist_summary_rows(rows: list[dict]) -> list[dict]:
    result = []
    for row in rows:
        result.append({
            "plantId": _opt_str(row, "plant_id"),
            "warehouseId": _opt_str(row, "warehouse_id"),
            "workArea": _opt_str(row, "work_area"),
            "worklistStatus": _opt_str(row, "worklist_status"),
            "trCount": _safe_int(row.get("tr_count")),
            "totalOpenQty": _safe_float(row.get("total_open_qty")),
            "totalRequiredQty": _safe_float(row.get("total_required_qty")),
            "operatorCount": _safe_int(row.get("operator_count")),
            "earliestPlannedTs": _opt_str(row, "earliest_planned_ts"),
            "earliestCreatedTs": _opt_str(row, "earliest_created_ts"),
        })
    return result


# ── Order readiness ───────────────────────────────────────────────────────────

def get_wm_order_readiness_spec(request: WmOrderReadinessRequest) -> QuerySpec:
    view = resolve_contract_object("wm_operations.order_readiness", "wh360")
    params: dict[str, object] = {}
    clauses: list[str] = []
    if request.start_from_days_ago is not None:
        clauses.append(
            "scheduled_start_date >= date_sub(current_date(), :start_from_days_ago)"
        )
        params["start_from_days_ago"] = int(request.start_from_days_ago)
    if request.start_to_days_ahead is not None:
        clauses.append(
            "scheduled_start_date <= date_add(current_date(), :start_to_days_ahead)"
        )
        params["start_to_days_ahead"] = int(request.start_to_days_ahead)
    where_str = _scope_where(request, params, clauses)
    sql = f"""
    SELECT
        plant_id,
        order_id,
        warehouse_id,
        material_id,
        material_name,
        order_qty,
        uom,
        scheduled_start_date,
        scheduled_finish_date,
        production_supply_area,
        component_count,
        wm_component_count,
        wm_component_required_qty,
        component_open_qty,
        tr_count,
        tr_required_qty,
        tr_open_qty,
        tr_coverage_status,
        psa_supplied_qty,
        supply_status,
        readiness_status,
        days_to_start,
        readiness_band,
        production_line
    FROM {view}
    {where_str}
    ORDER BY scheduled_start_date ASC NULLS LAST, order_id ASC
    LIMIT {int(request.limit)}
    """
    return QuerySpec(
        name="wm_operations.get_order_readiness",
        module="wh360",
        endpoint="/api/wm-operations/order-readiness",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "staging", "readiness"],
        contract_id="wm_operations.order_readiness",
    )


def map_wm_order_readiness_rows(rows: list[dict]) -> list[dict]:
    result = []
    for row in rows:
        result.append({
            "plantId": _opt_str(row, "plant_id"),
            "orderId": _opt_str(row, "order_id"),
            "warehouseId": _opt_str(row, "warehouse_id"),
            "materialId": _opt_str(row, "material_id"),
            "materialName": _opt_str(row, "material_name"),
            "orderQty": _safe_float(row.get("order_qty")),
            "uom": _opt_str(row, "uom"),
            "scheduledStartDate": _opt_str(row, "scheduled_start_date"),
            "scheduledFinishDate": _opt_str(row, "scheduled_finish_date"),
            "productionSupplyArea": _opt_str(row, "production_supply_area"),
            "componentCount": _safe_int(row.get("component_count")),
            "wmComponentCount": _safe_int(row.get("wm_component_count")),
            "wmComponentRequiredQty": _safe_float(row.get("wm_component_required_qty")),
            "componentOpenQty": _safe_float(row.get("component_open_qty")),
            "trCount": _safe_int(row.get("tr_count")),
            "trRequiredQty": _safe_float(row.get("tr_required_qty")),
            "trOpenQty": _safe_float(row.get("tr_open_qty")),
            "trCoverageStatus": _opt_str(row, "tr_coverage_status"),
            "psaSuppliedQty": _safe_float(row.get("psa_supplied_qty")),
            "supplyStatus": _opt_str(row, "supply_status"),
            "readinessStatus": _opt_str(row, "readiness_status"),
            "daysToStart": _safe_int(row.get("days_to_start")),
            "readinessBand": _opt_str(row, "readiness_band"),
            "productionLine": _opt_str(row, "production_line"),
        })
    return result


# ── Bin / stock explorer ──────────────────────────────────────────────────────

def get_wm_bin_stock_spec(request: WmBinStockRequest) -> QuerySpec:
    view = resolve_contract_object("wm_operations.bin_stock", "wh360")
    params: dict[str, object] = {}
    clauses: list[str] = []
    if request.storage_zone:
        if request.storage_zone not in _STORAGE_ZONES:
            raise ValueError(f"Unknown storage_zone {request.storage_zone!r}")
        clauses.append("storage_zone = :storage_zone")
        params["storage_zone"] = request.storage_zone
    if request.storage_type:
        clauses.append("storage_type = :storage_type")
        params["storage_type"] = request.storage_type
    if request.material_id:
        clauses.append("material_id = :material_id")
        params["material_id"] = request.material_id
    if request.bin_id:
        clauses.append("bin_id = :bin_id")
        params["bin_id"] = request.bin_id
    if request.expiring_within_days is not None:
        clauses.append("days_to_expiry IS NOT NULL AND days_to_expiry <= :expiring_within_days")
        params["expiring_within_days"] = request.expiring_within_days
    where_str = _scope_where(request, params, clauses)
    sql = f"""
    SELECT
        plant_id,
        warehouse_id,
        storage_type,
        storage_zone,
        bin_id,
        picking_area,
        quant_id,
        material_id,
        material_name,
        batch_id,
        stock_category,
        total_qty,
        available_qty,
        putaway_qty,
        pick_qty,
        open_transfer_qty,
        uom,
        goods_receipt_date,
        expiry_date,
        is_blocked_for_stock_removal,
        is_blocked_for_putaway,
        is_bin_blocked,
        blocking_reason_code,
        days_to_expiry,
        is_expired
    FROM {view}
    {where_str}
    ORDER BY storage_type ASC, bin_id ASC, quant_id ASC
    LIMIT {int(request.limit)}
    """
    return QuerySpec(
        name="wm_operations.get_bin_stock",
        module="wh360",
        endpoint="/api/wm-operations/bin-stock",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "stock", "bins"],
        contract_id="wm_operations.bin_stock",
    )


def map_wm_bin_stock_rows(rows: list[dict]) -> list[dict]:
    result = []
    for row in rows:
        result.append({
            "plantId": _opt_str(row, "plant_id"),
            "warehouseId": _opt_str(row, "warehouse_id"),
            "storageType": _opt_str(row, "storage_type"),
            "storageZone": _opt_str(row, "storage_zone"),
            "binId": _opt_str(row, "bin_id"),
            "pickingArea": _opt_str(row, "picking_area"),
            "quantId": _opt_str(row, "quant_id"),
            "materialId": _opt_str(row, "material_id"),
            "materialName": _opt_str(row, "material_name"),
            "batchId": _opt_str(row, "batch_id"),
            "stockCategory": _opt_str(row, "stock_category"),
            "totalQty": _safe_float(row.get("total_qty")),
            "availableQty": _safe_float(row.get("available_qty")),
            "putawayQty": _safe_float(row.get("putaway_qty")),
            "pickQty": _safe_float(row.get("pick_qty")),
            "openTransferQty": _safe_float(row.get("open_transfer_qty")),
            "uom": _opt_str(row, "uom"),
            "goodsReceiptDate": _opt_str(row, "goods_receipt_date"),
            "expiryDate": _opt_str(row, "expiry_date"),
            "isBlockedForStockRemoval": _safe_bool(row.get("is_blocked_for_stock_removal")),
            "isBlockedForPutaway": _safe_bool(row.get("is_blocked_for_putaway")),
            "isBinBlocked": _safe_bool(row.get("is_bin_blocked")),
            "blockingReasonCode": _opt_str(row, "blocking_reason_code"),
            "daysToExpiry": _safe_int(row.get("days_to_expiry")),
            "isExpired": _safe_bool(row.get("is_expired")),
        })
    return result


# ── Order component detail (drill-through) ───────────────────────────────────

@dataclass
class WmOrderComponentsRequest:
    plant_id: str
    order_id: str


def get_wm_order_components_spec(request: WmOrderComponentsRequest) -> QuerySpec:
    view = resolve_contract_object("wm_operations.order_components", "wh360")
    sql = f"""
    SELECT
        plant_id, order_id, reservation_id, reservation_item, operation_number, warehouse_id,
        material_id, material_name, batch_id, required_qty, open_qty, uom,
        production_supply_area, requirement_date, material_component_count,
        tr_count, tr_required_qty, tr_open_qty, tr_coverage_status,
        to_item_count, to_items_confirmed, to_confirmed_qty,
        pick_progress_fraction, psa_supplied_qty, is_supplied
    FROM {view}
    WHERE plant_id = :plant_id AND order_id = :order_id
    ORDER BY reservation_item ASC
    LIMIT 500
    """
    return QuerySpec(
        name="wm_operations.get_order_components",
        module="wh360",
        endpoint="/api/wm-operations/order-components",
        sql=sql,
        params={"plant_id": request.plant_id, "order_id": request.order_id},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "staging", "order_detail"],
        contract_id="wm_operations.order_components",
    )


def map_wm_order_components_rows(rows: list[dict]) -> list[dict]:
    return [{
        "plantId": _opt_str(r, "plant_id"),
        "orderId": _opt_str(r, "order_id"),
        "reservationId": _opt_str(r, "reservation_id"),
        "reservationItem": _opt_str(r, "reservation_item"),
        "operationNumber": _opt_str(r, "operation_number"),
        "warehouseId": _opt_str(r, "warehouse_id"),
        "materialId": _opt_str(r, "material_id"),
        "materialName": _opt_str(r, "material_name"),
        "batchId": _opt_str(r, "batch_id"),
        "requiredQty": _safe_float(r.get("required_qty")),
        "openQty": _safe_float(r.get("open_qty")),
        "uom": _opt_str(r, "uom"),
        "productionSupplyArea": _opt_str(r, "production_supply_area"),
        "requirementDate": _opt_str(r, "requirement_date"),
        "materialComponentCount": _safe_int(r.get("material_component_count")),
        "trCount": _safe_int(r.get("tr_count")),
        "trRequiredQty": _safe_float(r.get("tr_required_qty")),
        "trOpenQty": _safe_float(r.get("tr_open_qty")),
        "trCoverageStatus": _opt_str(r, "tr_coverage_status"),
        "toItemCount": _safe_int(r.get("to_item_count")),
        "toItemsConfirmed": _safe_int(r.get("to_items_confirmed")),
        "toConfirmedQty": _safe_float(r.get("to_confirmed_qty")),
        "pickProgressFraction": _safe_float(r.get("pick_progress_fraction")),
        "psaSuppliedQty": _safe_float(r.get("psa_supplied_qty")),
        "isSupplied": _safe_bool(r.get("is_supplied")),
    } for r in rows]


# ── Order operations drill (plant_id + order_id required) ────────────────────

@dataclass
class WmOrderOperationsRequest:
    plant_id: str
    order_id: str


def get_wm_order_operations_spec(request: WmOrderOperationsRequest) -> QuerySpec:
    view = resolve_contract_object("wm_operations.order_operations", "wh360")
    sql = f"""
    SELECT
        plant_id, order_number, routing_number, operation_counter, operation_number,
        operation_description, control_key, work_centre_code, work_centre_description,
        scheduled_start_datetime, scheduled_finish_datetime, actual_start_datetime,
        actual_finish_date, operation_quantity, confirmed_yield_quantity,
        confirmed_scrap_quantity, is_confirmed
    FROM {view}
    WHERE plant_id = :plant_id AND order_number = :order_id
    ORDER BY operation_number ASC
    LIMIT 100
    """
    return QuerySpec(
        name="wm_operations.get_order_operations",
        module="wh360",
        endpoint="/api/wm-operations/order-operations",
        sql=sql,
        params={"plant_id": request.plant_id, "order_id": request.order_id},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "staging", "order_detail"],
        contract_id="wm_operations.order_operations",
    )


def map_wm_order_operations_rows(rows: list[dict]) -> list[dict]:
    return [{
        "plantId": _opt_str(r, "plant_id"),
        "orderNumber": _opt_str(r, "order_number"),
        "routingNumber": _opt_str(r, "routing_number"),
        "operationCounter": _opt_str(r, "operation_counter"),
        "operationNumber": _opt_str(r, "operation_number"),
        "operationDescription": _opt_str(r, "operation_description"),
        "controlKey": _opt_str(r, "control_key"),
        "workCentreCode": _opt_str(r, "work_centre_code"),
        "workCentreDescription": _opt_str(r, "work_centre_description"),
        "scheduledStartDatetime": _opt_str(r, "scheduled_start_datetime"),
        "scheduledFinishDatetime": _opt_str(r, "scheduled_finish_datetime"),
        "actualStartDatetime": _opt_str(r, "actual_start_datetime"),
        "actualFinishDate": _opt_str(r, "actual_finish_date"),
        "operationQty": _safe_float(r.get("operation_quantity")),
        "confirmedYieldQty": _safe_float(r.get("confirmed_yield_quantity")),
        "confirmedScrapQty": _safe_float(r.get("confirmed_scrap_quantity")),
        "isConfirmed": _safe_bool(r.get("is_confirmed")),
    } for r in rows]


# ── Order Journey Events (dedicated drill) ────────────────────────────────────

@dataclass
class WmOrderJourneyEventsRequest:
    plant_id: str
    order_id: str


def get_wm_order_journey_events_spec(request: WmOrderJourneyEventsRequest) -> QuerySpec:
    view = resolve_contract_object("wm_operations.order_journey_events", "wh360")
    sql = f"""
    SELECT
        plant_id, order_id, event_seq, event_ts, event_type,
        qty, uom, reference_id, detail
    FROM {view}
    WHERE plant_id = :plant_id AND order_id = :order_id
    ORDER BY event_seq ASC
    LIMIT 500
    """
    return QuerySpec(
        name="wm_operations.get_order_journey_events",
        module="wh360",
        endpoint="/api/wm-operations/order-journey-events",
        sql=sql,
        params={"plant_id": request.plant_id, "order_id": request.order_id},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "order_journey", "events"],
        contract_id="wm_operations.order_journey_events",
    )


def map_wm_order_journey_events_rows(rows: list[dict]) -> list[dict]:
    return [{
        "plantId": _opt_str(r, "plant_id"),
        "orderId": _opt_str(r, "order_id"),
        "eventSeq": _safe_int(r.get("event_seq")),
        "eventTs": _opt_str(r, "event_ts"),
        "eventType": _opt_str(r, "event_type"),
        "qty": _safe_float(r.get("qty")),
        "uom": _opt_str(r, "uom"),
        "referenceId": _opt_str(r, "reference_id"),
        "detail": _opt_str(r, "detail"),
    } for r in rows]


# ── Operator activity ─────────────────────────────────────────────────────────

@dataclass
class WmOperatorActivityRequest:
    plant_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    operator: Optional[str] = None
    days: int = 14


def get_wm_operator_activity_spec(request: WmOperatorActivityRequest) -> QuerySpec:
    view = resolve_contract_object("wm_operations.operator_activity", "wh360")
    params: dict[str, object] = {"days": int(request.days)}
    clauses = ["activity_date >= date_sub(current_date(), :days)"]
    if request.operator:
        clauses.append("operator = :operator")
        params["operator"] = request.operator
    where_str = _scope_where(request, params, clauses)
    sql = f"""
    SELECT
        plant_id, warehouse_id, operator, activity_date, shift,
        items_confirmed, transfer_orders, materials, transfer_requirements, confirmed_qty
    FROM {view}
    {where_str}
    ORDER BY activity_date DESC, items_confirmed DESC
    LIMIT 1000
    """
    return QuerySpec(
        name="wm_operations.get_operator_activity",
        module="wh360",
        endpoint="/api/wm-operations/operator-activity",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "operators"],
        contract_id="wm_operations.operator_activity",
    )


def map_wm_operator_activity_rows(rows: list[dict]) -> list[dict]:
    return [{
        "plantId": _opt_str(r, "plant_id"),
        "warehouseId": _opt_str(r, "warehouse_id"),
        "operator": _opt_str(r, "operator"),
        "activityDate": _opt_str(r, "activity_date"),
        "shift": _opt_str(r, "shift"),
        "itemsConfirmed": _safe_int(r.get("items_confirmed")),
        "transferOrders": _safe_int(r.get("transfer_orders")),
        "materials": _safe_int(r.get("materials")),
        "transferRequirements": _safe_int(r.get("transfer_requirements")),
        "confirmedQty": _safe_float(r.get("confirmed_qty")),
    } for r in rows]


# ── Queue workload ────────────────────────────────────────────────────────────

@dataclass
class WmQueueWorkloadRequest:
    plant_id: Optional[str] = None
    warehouse_id: Optional[str] = None


def get_wm_queue_workload_spec(request: WmQueueWorkloadRequest) -> QuerySpec:
    view = resolve_contract_object("wm_operations.queue_workload", "wh360")
    params: dict[str, object] = {}
    where_str = _scope_where(request, params)
    sql = f"""
    SELECT
        plant_id, warehouse_id, queue, work_area, open_jobs, in_progress_jobs,
        parked_jobs, no_stock_jobs, operator_count, earliest_planned_ts, earliest_created_ts
    FROM {view}
    {where_str}
    ORDER BY open_jobs DESC
    LIMIT 500
    """
    return QuerySpec(
        name="wm_operations.get_queue_workload",
        module="wh360",
        endpoint="/api/wm-operations/queue-workload",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "operators", "queues"],
        contract_id="wm_operations.queue_workload",
    )


def map_wm_queue_workload_rows(rows: list[dict]) -> list[dict]:
    return [{
        "plantId": _opt_str(r, "plant_id"),
        "warehouseId": _opt_str(r, "warehouse_id"),
        "queue": r.get("queue") if r.get("queue") is not None else "",
        "workArea": _opt_str(r, "work_area"),
        "openJobs": _safe_int(r.get("open_jobs")),
        "inProgressJobs": _safe_int(r.get("in_progress_jobs")),
        "parkedJobs": _safe_int(r.get("parked_jobs")),
        "noStockJobs": _safe_int(r.get("no_stock_jobs")),
        "operatorCount": _safe_int(r.get("operator_count")),
        "earliestPlannedTs": _opt_str(r, "earliest_planned_ts"),
        "earliestCreatedTs": _opt_str(r, "earliest_created_ts"),
    } for r in rows]


# ── Outbound picking board ────────────────────────────────────────────────────

@dataclass
class WmOutboundRequest:
    plant_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    include_shipped: bool = False
    limit: int = 200


def get_wm_outbound_spec(request: WmOutboundRequest) -> QuerySpec:
    view = resolve_contract_object("wm_operations.outbound", "wh360")
    params: dict[str, object] = {}
    clauses: list[str] = []
    if not request.include_shipped:
        clauses.append("NOT coalesce(is_shipped, false)")
    where_str = _scope_where(request, params, clauses)
    sql = f"""
    SELECT
        plant_id, warehouse_id, delivery_id, delivery_type, ship_to_customer_id,
        ship_to_customer_name, line_count, delivery_qty, picked_qty, pick_fraction,
        has_mixed_base_uom, planned_goods_issue_date, actual_goods_issue_date,
        is_shipped, days_to_goods_issue, risk_band
    FROM {view}
    {where_str}
    ORDER BY planned_goods_issue_date ASC NULLS LAST, delivery_id ASC
    LIMIT {int(request.limit)}
    """
    return QuerySpec(
        name="wm_operations.get_outbound",
        module="wh360",
        endpoint="/api/wm-operations/outbound",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "outbound"],
        contract_id="wm_operations.outbound",
    )


def map_wm_outbound_rows(rows: list[dict]) -> list[dict]:
    return [{
        "plantId": _opt_str(r, "plant_id"),
        "warehouseId": _opt_str(r, "warehouse_id"),
        "deliveryId": _opt_str(r, "delivery_id"),
        "deliveryType": _opt_str(r, "delivery_type"),
        "shipToCustomerId": _opt_str(r, "ship_to_customer_id"),
        "shipToCustomerName": _opt_str(r, "ship_to_customer_name"),
        "lineCount": _safe_int(r.get("line_count")),
        "deliveryQty": _safe_float(r.get("delivery_qty")),
        "pickedQty": _safe_float(r.get("picked_qty")),
        "pickFraction": _safe_float(r.get("pick_fraction")),
        "hasMixedBaseUom": _safe_bool(r.get("has_mixed_base_uom")),
        "plannedGoodsIssueDate": _opt_str(r, "planned_goods_issue_date"),
        "actualGoodsIssueDate": _opt_str(r, "actual_goods_issue_date"),
        "isShipped": _safe_bool(r.get("is_shipped")),
        "daysToGoodsIssue": _safe_int(r.get("days_to_goods_issue")),
        "riskBand": _opt_str(r, "risk_band"),
    } for r in rows]


# ── Reconciliation alerts (handover digest) ───────────────────────────────────

@dataclass
class WmReconAlertsRequest:
    plant_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    limit: int = 200


def get_wm_recon_alerts_spec(request: WmReconAlertsRequest) -> QuerySpec:
    view = resolve_contract_object("wm_operations.recon_alerts", "wh360")
    params: dict[str, object] = {}
    where_str = _scope_where(request, params)
    sql = f"""
    SELECT
        plant_id, warehouse_id, alert_key, alert_type, alert_priority,
        material_id, batch_id, reason_code, delta_qty, delta_value
    FROM {view}
    {where_str}
    ORDER BY alert_priority ASC, delta_value DESC NULLS LAST
    LIMIT {int(request.limit)}
    """
    return QuerySpec(
        name="wm_operations.get_recon_alerts",
        module="wh360",
        endpoint="/api/wm-operations/recon-alerts",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "reconciliation"],
        contract_id="wm_operations.recon_alerts",
    )


def map_wm_recon_alerts_rows(rows: list[dict]) -> list[dict]:
    return [{
        "plantId": _opt_str(r, "plant_id"),
        "warehouseId": _opt_str(r, "warehouse_id"),
        "alertKey": _opt_str(r, "alert_key"),
        "alertType": _opt_str(r, "alert_type"),
        "alertPriority": _opt_str(r, "alert_priority"),
        "materialId": _opt_str(r, "material_id"),
        "batchId": _opt_str(r, "batch_id"),
        "reasonCode": _opt_str(r, "reason_code"),
        "deltaQty": _safe_float(r.get("delta_qty")),
        "deltaValue": _safe_float(r.get("delta_value")),
    } for r in rows]


# ── Batch movement history (stock-explorer drill; reuses the wh360 contract) ──

@dataclass
class WmBatchMovementsRequest:
    plant_id: str
    material_id: str
    batch_id: Optional[str] = None
    days: int = 31
    limit: int = 200


def get_wm_batch_movements_spec(request: WmBatchMovementsRequest) -> QuerySpec:
    # Reuses the contracted warehouse360.goods_movements consumption view (MSEG line
    # grain) with a bounded posting-date window — same cost control as the wh360 route.
    view = resolve_contract_object("warehouse360.goods_movements", "wh360")
    params: dict[str, object] = {
        "plant_id": request.plant_id,
        "material_id": request.material_id,
        "days": int(request.days),
    }
    batch_clause = ""
    if request.batch_id:
        batch_clause = "AND batch_id = :batch_id"
        params["batch_id"] = request.batch_id
    sql = f"""
    SELECT
        plant_id, document_number, fiscal_year, line_item, material_id, batch_id,
        movement_type_code, movement_label, event_category, quantity, uom,
        posting_date, order_number, delivery_number, posted_by
    FROM {view}
    WHERE plant_id = :plant_id
      AND material_id = :material_id
      AND posting_date >= date_sub(current_date(), :days)
      {batch_clause}
    ORDER BY posting_date DESC
    LIMIT {int(request.limit)}
    """
    return QuerySpec(
        name="wm_operations.get_batch_movements",
        module="wh360",
        endpoint="/api/wm-operations/batch-movements",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "stock", "movements"],
        contract_id="warehouse360.goods_movements",
    )


def map_wm_batch_movements_rows(rows: list[dict]) -> list[dict]:
    return [{
        "plantId": _opt_str(r, "plant_id"),
        "documentId": _opt_str(r, "document_number"),
        "documentYear": _opt_str(r, "fiscal_year"),
        "documentItem": _opt_str(r, "line_item"),
        "materialId": _opt_str(r, "material_id"),
        "batchId": _opt_str(r, "batch_id"),
        "movementType": _opt_str(r, "movement_type_code"),
        "movementLabel": _opt_str(r, "movement_label"),
        "eventCategory": _opt_str(r, "event_category"),
        "quantity": _safe_float(r.get("quantity")),
        "uom": _opt_str(r, "uom"),
        "postingDate": _opt_str(r, "posting_date"),
        "orderId": _opt_str(r, "order_number"),
        "deliveryId": _opt_str(r, "delivery_number"),
        "postedBy": _opt_str(r, "posted_by"),
    } for r in rows]


@dataclass
class WmDeliveryPicksRequest:
    plant_id: str
    delivery_id: str


def get_wm_delivery_picks_spec(request: WmDeliveryPicksRequest) -> QuerySpec:
    # Open pick tasks for one delivery (reuses the contracted wh360 pick-tasks view;
    # confirmed/closed TOs are not in the open-items gold, so shipped deliveries show none).
    view = resolve_contract_object("warehouse360.pick_tasks", "wh360")
    sql = f"""
    SELECT plant_id, warehouse_number, task_id, item_number, material_id, batch_id,
        source_storage_type, source_storage_bin, destination_storage_type,
        destination_storage_bin, requested_quantity, confirmed_quantity, item_status,
        created_datetime, delivery_number, created_by_user
    FROM {view}
    WHERE plant_id = :plant_id AND delivery_number = :delivery_id
    ORDER BY task_id, item_number
    LIMIT 500
    """
    return QuerySpec(
        name="wm_operations.get_delivery_picks",
        module="wh360",
        endpoint="/api/wm-operations/delivery-picks",
        sql=sql,
        params={"plant_id": request.plant_id, "delivery_id": request.delivery_id},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "outbound"],
        contract_id="warehouse360.pick_tasks",
    )


def map_wm_delivery_picks_rows(rows: list[dict]) -> list[dict]:
    return map_rows_generic(
        rows, numeric=("requested_quantity", "confirmed_quantity"), integer=(), boolean=()
    )


@dataclass
class WmMovementsRequest:
    plant_id: str
    days: int = 7
    event_category: Optional[str] = None
    movement_type: Optional[str] = None
    posted_by: Optional[str] = None
    order_id: Optional[str] = None
    delivery_id: Optional[str] = None
    limit: int = 200


def get_wm_movements_spec(request: WmMovementsRequest) -> QuerySpec:
    # General movement-activity feed on the contracted wh360 goods-movements view,
    # with the same bounded posting-date window as the wh360 route (cost control).
    view = resolve_contract_object("warehouse360.goods_movements", "wh360")
    params: dict[str, object] = {"plant_id": request.plant_id, "days": int(request.days)}
    clauses = [
        "plant_id = :plant_id",
        "posting_date >= date_sub(current_date(), :days)",
    ]
    for field, col in (
        ("event_category", "event_category"),
        ("movement_type", "movement_type_code"),
        ("posted_by", "posted_by"),
        ("order_id", "order_number"),
        ("delivery_id", "delivery_number"),
    ):
        value = getattr(request, field)
        if value:
            clauses.append(f"{col} = :{field}")
            params[field] = value
    sql = f"""
    SELECT plant_id, document_number, fiscal_year, line_item, material_id, batch_id,
        movement_type_code, movement_label, event_category, is_goods_receipt, is_goods_issue,
        is_transfer, is_reversal, quantity, uom, posting_date, order_number, delivery_number,
        posted_by, transaction_code
    FROM {view}
    WHERE {" AND ".join(clauses)}
    ORDER BY posting_date DESC, document_number DESC
    LIMIT {int(request.limit)}
    """
    return QuerySpec(
        name="wm_operations.get_movements",
        module="wh360",
        endpoint="/api/wm-operations/movements",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", "movements"],
        contract_id="warehouse360.goods_movements",
    )


def map_wm_movements_rows(rows: list[dict]) -> list[dict]:
    return map_rows_generic(
        rows, numeric=("quantity",), integer=(),
        boolean=("is_goods_receipt", "is_goods_issue", "is_transfer", "is_reversal"),
    )


class WmOperationsRepository:
    """Repository for the WM Operations read-only manager tools."""

    def __init__(self, repository: DatabricksRepository) -> None:
        self._repository = repository

    async def fetch_worklist(self, request: WmWorklistRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_worklist_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_worklist_summary(
        self, request: WmWorklistSummaryRequest
    ) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_worklist_summary_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_order_readiness(
        self, request: WmOrderReadinessRequest
    ) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_order_readiness_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_bin_stock(self, request: WmBinStockRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_bin_stock_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_order_components(
        self, request: WmOrderComponentsRequest
    ) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_order_components_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_order_operations(
        self, request: WmOrderOperationsRequest
    ) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_order_operations_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_order_journey_events(
        self, request: WmOrderJourneyEventsRequest
    ) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_order_journey_events_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_operator_activity(
        self, request: WmOperatorActivityRequest
    ) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_operator_activity_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_queue_workload(
        self, request: WmQueueWorkloadRequest
    ) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_queue_workload_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_outbound(self, request: WmOutboundRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_outbound_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_recon_alerts(
        self, request: WmReconAlertsRequest
    ) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_recon_alerts_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_delivery_picks(self, request: WmDeliveryPicksRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_delivery_picks_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_movements(self, request: WmMovementsRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_movements_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_simple(self, dataset: str, request: WmSimpleRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_simple_spec(dataset, request),
            mapper=lambda rows: rows,
        )

    async def fetch_batch_movements(
        self, request: WmBatchMovementsRequest
    ) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_wm_batch_movements_spec(request),
            mapper=lambda rows: rows,
        )


# ── Generic simple-list datasets (screens 5-9 of the second wave) ─────────────
# One declarative entry per dataset; specs/mappers are generated. Numeric/integer/
# boolean sets drive JSON type coercion (the statements API returns strings).

def _camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


def map_rows_generic(rows: list[dict], numeric=(), integer=(), boolean=()) -> list[dict]:
    out = []
    for r in rows:
        m = {}
        for k, v in r.items():
            ck = _camel(k)
            if k in numeric:
                m[ck] = _safe_float(v) if v is not None else None
            elif k in integer:
                m[ck] = _safe_int(v) if v is not None else None
            elif k in boolean:
                m[ck] = (str(v).lower() == "true") if v is not None else None
            else:
                m[ck] = _opt_str(r, k)
        out.append(m)
    return out


@dataclass
class WmSimpleRequest:
    plant_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    severity: Optional[str] = None
    days: Optional[int] = None
    open_only: bool = True
    origin: Optional[str] = None
    limit: int = 200


# name -> (contract_id, endpoint, columns, order_by, numeric, integer, boolean, has_warehouse)
SIMPLE_DATASETS: dict[str, dict] = {
    "inbound": dict(
        contract="warehouse360.inbound_backlog", endpoint="/api/wm-operations/inbound",
        columns="plant_id, po_id, po_item, doc_type, vendor_id, storage_loc, material_id, "
                "material_name, ordered_qty, uom, po_date, oldest_po_age_days, inbound_backlog_risk_band",
        order_by="po_date ASC NULLS LAST", numeric=("ordered_qty",),
        integer=("oldest_po_age_days",), boolean=(), has_warehouse=False,
    ),
    "handling_units": dict(
        contract="wm_operations.handling_units", endpoint="/api/wm-operations/handling-units",
        columns="plant_id, warehouse_id, handling_unit_status, reference_document_category, "
                "hu_item_count, distinct_sscc_count, distinct_hu_count, linked_delivery_count, "
                "distinct_material_count, total_gross_weight",
        order_by="hu_item_count DESC", numeric=("total_gross_weight",),
        integer=("hu_item_count", "distinct_sscc_count", "distinct_hu_count",
                 "linked_delivery_count", "distinct_material_count"), boolean=(), has_warehouse=True,
    ),
    "expiry_risk": dict(
        contract="wm_operations.expiry_risk", endpoint="/api/wm-operations/expiry-risk",
        columns="plant_id, material_id, material_name, batch_id, uom, minimum_expiry_date, "
                "shelf_life_days, minimum_remaining_shelf_life_days, total_stock_qty, "
                "minimum_days_to_expiry, expired_qty, highest_expiry_risk_bucket, "
                "has_minimum_shelf_life_breach",
        order_by="minimum_days_to_expiry ASC NULLS LAST",
        numeric=("total_stock_qty", "expired_qty"),
        integer=("shelf_life_days", "minimum_remaining_shelf_life_days", "minimum_days_to_expiry"),
        boolean=("has_minimum_shelf_life_breach",), has_warehouse=False,
    ),
    "stock_holds": dict(
        contract="wm_operations.stock_holds", endpoint="/api/wm-operations/stock-holds",
        columns="plant_id, warehouse_id, storage_type, bin_id, quant_id, material_id, batch_id, "
                "hold_type, qty, uom, goods_receipt_date, age_hours",
        order_by="age_hours DESC NULLS LAST", numeric=("qty", "age_hours"), integer=(), boolean=(),
        has_warehouse=True,
    ),
    "exceptions": dict(
        contract="wm_operations.exceptions", endpoint="/api/wm-operations/exceptions",
        columns="plant_id, warehouse_id, exception_type, severity, sla_hours, material_id, "
                "batch_id, reference_id, qty, aging_reference_date, age_days, detail",
        order_by="age_days DESC NULLS LAST", numeric=("qty",), integer=("sla_hours", "age_days"),
        boolean=(), has_warehouse=True,
    ),
    "recon_exceptions": dict(
        contract="wm_operations.recon_exceptions", endpoint="/api/wm-operations/recon-exceptions",
        columns="plant_id, warehouse_id, material_id, material_name, batch_id, stock_category, "
                "uom, im_qty, wm_qty, delta_qty, delta_percent, delta_value, mismatch_reason, "
                "mismatch_severity, is_trusted",
        order_by="abs(coalesce(delta_value, 0)) DESC",
        numeric=("im_qty", "wm_qty", "delta_qty", "delta_percent", "delta_value"),
        integer=(), boolean=("is_trusted",), has_warehouse=True, severity_col="mismatch_severity",
    ),
    "recon_value_summary": dict(
        contract="wm_operations.recon_value_summary", endpoint="/api/wm-operations/recon-summary",
        columns="plant_id, warehouse_id, mismatch_reason, mismatch_severity, row_count, "
                "tolerance_exceeded_count, net_delta_value, abs_delta_value, abs_delta_quantity, "
                "value_reconciliation_status",
        order_by="abs_delta_value DESC",
        numeric=("net_delta_value", "abs_delta_value", "abs_delta_quantity"),
        integer=("row_count", "tolerance_exceeded_count"), boolean=(), has_warehouse=True,
    ),
    "campaigns": dict(
        contract="wm_operations.campaigns", endpoint="/api/wm-operations/campaigns",
        columns="plant_id, warehouse_id, campaign_id, tr_count, complete_trs, in_progress_trs, "
                "parked_trs, no_stock_trs, order_count, operator_count, work_area, required_qty, "
                "open_qty, earliest_planned_ts, earliest_created_ts",
        order_by="open_qty DESC",
        numeric=("required_qty", "open_qty"),
        integer=("tr_count", "complete_trs", "in_progress_trs", "parked_trs", "no_stock_trs",
                 "order_count", "operator_count"), boolean=(), has_warehouse=True,
    ),
    "daily_activity": dict(
        contract="wm_operations.daily_activity", endpoint="/api/wm-operations/daily-activity",
        columns="plant_id, activity_date, to_items_confirmed, active_operators, trs_created, "
                "goods_receipt_lines, goods_issue_lines",
        order_by="activity_date ASC", numeric=(),
        integer=("to_items_confirmed", "active_operators", "trs_created",
                 "goods_receipt_lines", "goods_issue_lines"), boolean=(), has_warehouse=False,
        days_col="activity_date",
    ),
    "physical_inventory": dict(
        contract="wm_operations.physical_inventory", endpoint="/api/wm-operations/physical-inventory",
        columns="plant_id, pi_document_id, fiscal_year, item_number, storage_location_id, "
                "material_id, batch_id, planned_count_date, count_date, book_qty, counted_qty, "
                "delta_qty, delta_value, is_counted, is_recount_required, is_difference_posted, "
                "physical_inventory_status",
        order_by="planned_count_date ASC NULLS LAST",
        numeric=("book_qty", "counted_qty", "delta_qty", "delta_value"),
        integer=(), boolean=("is_counted", "is_recount_required", "is_difference_posted"),
        has_warehouse=False,
        open_only_clause="physical_inventory_status IN ('NOT_COUNTED', 'RECOUNT_REQUIRED', 'DIFFERENCE_NOT_POSTED')",
    ),
    "bin_occupancy": dict(
        contract="wm_operations.bin_occupancy", endpoint="/api/wm-operations/bin-occupancy",
        columns="plant_id, warehouse_id, storage_type, bin_type, bin_record_count, "
                "occupied_bin_count, empty_bin_count, blocked_bin_count, "
                "stock_removal_blocked_bin_count, putaway_blocked_bin_count, occupancy_rate, "
                "total_stock_qty, available_stock_qty, open_transfer_stock_qty, "
                "total_max_quant_count, total_maximum_weight, quant_utilisation_fraction",
        order_by="occupancy_rate DESC",
        numeric=("occupancy_rate", "total_stock_qty", "available_stock_qty", "open_transfer_stock_qty",
                 "total_maximum_weight", "quant_utilisation_fraction"),
        integer=("bin_record_count", "occupied_bin_count", "empty_bin_count", "blocked_bin_count",
                 "stock_removal_blocked_bin_count", "putaway_blocked_bin_count", "total_max_quant_count"),
        boolean=(), has_warehouse=True,
    ),
    "slow_movers": dict(
        contract="wm_operations.slow_movers", endpoint="/api/wm-operations/slow-movers",
        columns="plant_id, warehouse_id, material_id, material_name, batch_id, uom, quant_count, "
                "total_qty, stock_value, standard_price, last_movement_ts, "
                "earliest_goods_receipt_date, earliest_expiry_date, days_since_last_movement, age_bucket",
        order_by="stock_value DESC NULLS LAST",
        numeric=("total_qty", "stock_value", "standard_price"),
        integer=("quant_count", "days_since_last_movement"), boolean=(), has_warehouse=True,
        severity_col="age_bucket",
    ),
    "movement_control": dict(
        contract="wm_operations.movement_control", endpoint="/api/wm-operations/movement-control",
        columns="plant_id, warehouse_id, posting_date, material_id, batch_id, uom, "
                "movement_type_code, im_document_line_count, im_qty, im_value, wm_to_line_count, "
                "wm_qty, delta_qty, abs_delta_qty, movement_reconciliation_status",
        order_by="abs_delta_qty DESC",
        numeric=("im_qty", "im_value", "wm_qty", "delta_qty", "abs_delta_qty"),
        integer=("im_document_line_count", "wm_to_line_count"), boolean=(), has_warehouse=True,
        days_col="posting_date", severity_col="movement_reconciliation_status",
    ),
    "staging_pace": dict(
        contract="wm_operations.staging_pace", endpoint="/api/wm-operations/staging-pace",
        columns="plant_id, warehouse_id, destination_zone, activity_hour, items_staged, "
                "qty_staged, operators",
        order_by="activity_hour ASC",
        numeric=("qty_staged",), integer=("items_staged", "operators"), boolean=(),
        has_warehouse=True, days_col="activity_hour",
    ),
    "staging_demand": dict(
        contract="wm_operations.staging_demand", endpoint="/api/wm-operations/staging-demand",
        columns="plant_id, warehouse_id, work_area, production_supply_area, demand_hour, open_trs, open_qty",
        order_by="demand_hour ASC",
        numeric=("open_qty",), integer=("open_trs",), boolean=(), has_warehouse=True,
    ),
    "buffer_flow": dict(
        contract="wm_operations.buffer_flow", endpoint="/api/wm-operations/buffer-flow",
        columns="plant_id, warehouse_id, activity_hour, items_in, qty_in, items_out, qty_out, net_qty",
        order_by="activity_hour ASC",
        numeric=("qty_in", "qty_out", "net_qty"), integer=("items_in", "items_out"), boolean=(),
        has_warehouse=True, days_col="activity_hour",
    ),
    "qm_lots": dict(
        contract="wm_operations.qm_lots", endpoint="/api/wm-operations/qm-lots",
        columns="plant_id, material_id, batch_id, lot_count, open_lot_count, latest_lot_number, "
                "lot_origin_code, oldest_open_start_date, last_usage_decision, last_usage_decision_date",
        order_by="open_lot_count DESC",
        numeric=(), integer=("lot_count", "open_lot_count"), boolean=(), has_warehouse=False,
    ),
    "qm_lot_status": dict(
        contract="wm_operations.qm_lot_status", endpoint="/api/wm-operations/qm-lot-status",
        columns="plant_id, lot_id, inspection_lot_origin_code, inspection_type, material_id, "
                "material_name, batch_id, order_id, lot_created_date, inspection_start_date, "
                "inspection_end_date, lot_qty, lot_uom, has_usage_decision, last_usage_decision, "
                "last_usage_decision_date, last_usage_decision_by, quality_score, "
                "lot_age_days, ud_lead_time_days, is_overdue",
        order_by="lot_created_date DESC",
        numeric=("lot_qty",), integer=("lot_age_days", "ud_lead_time_days"),
        boolean=("has_usage_decision", "is_overdue"), has_warehouse=False,
        open_only_clause="NOT coalesce(has_usage_decision, false)",
        origin_col="inspection_lot_origin_code",
    ),
    "qm_disposition_queue": dict(
        contract="wm_operations.qm_disposition_queue", endpoint="/api/wm-operations/qm-disposition-queue",
        columns="plant_id, lot_id, inspection_lot_origin_code, inspection_type, material_id, "
                "material_name, batch_id, order_id, lot_created_date, inspection_start_date, "
                "inspection_end_date, lot_qty, lot_uom, blocked_qty, blocked_uom, "
                "est_blocked_value, lot_age_days, is_overdue",
        order_by="est_blocked_value DESC NULLS LAST",
        numeric=("lot_qty", "blocked_qty", "est_blocked_value"),
        integer=("lot_age_days",),
        boolean=("is_overdue",), has_warehouse=False,
        origin_col="inspection_lot_origin_code",
    ),
    "qm_characteristic_pareto": dict(
        contract="wm_operations.qm_characteristic_pareto",
        endpoint="/api/wm-operations/qm-characteristic-pareto",
        columns=(
            "plant_id, material_id, characteristic_id, characteristic_text, unit, "
            "result_count, fail_count, warn_count, fail_rate, last_result_date"
        ),
        order_by="fail_count DESC, result_count DESC",
        numeric=("fail_rate",),
        integer=("result_count", "fail_count", "warn_count"),
        boolean=(), has_warehouse=False,
    ),
    "qm_ud_code_pareto": dict(
        contract="wm_operations.qm_ud_code_pareto",
        endpoint="/api/wm-operations/qm-ud-code-pareto",
        columns=(
            "plant_id, usage_decision_code, usage_decision, usage_decision_valuation, "
            "lot_count, last_decision_date"
        ),
        order_by="lot_count DESC",
        numeric=(),
        integer=("lot_count",),
        boolean=(), has_warehouse=False,
    ),
    "downtime_pareto": dict(
        contract="wm_operations.downtime_pareto", endpoint="/api/wm-operations/downtime-pareto",
        columns="plant_id, week_start, downtime_reason_code, sub_reason_code, work_centre_code, "
                "downtime_reason_description, sub_reason_description, production_line_description, "
                "event_count, total_duration_minutes, avg_duration_minutes, distinct_order_count",
        order_by="total_duration_minutes DESC",
        numeric=("total_duration_minutes", "avg_duration_minutes"),
        integer=("event_count", "distinct_order_count"), boolean=(), has_warehouse=False,
    ),
    "downtime_events": dict(
        contract="wm_operations.downtime_events", endpoint="/api/wm-operations/downtime-events",
        columns="plant_id, work_centre_code, machine_code, machine_description, "
                "production_line_description, order_number, material_code, operation_number, "
                "item_number, downtime_reason_code, downtime_reason_description, sub_reason_code, "
                "sub_reason_description, start_datetime, end_datetime, duration_minutes, "
                "reported_by_user, comment",
        order_by="start_datetime DESC",
        numeric=("duration_minutes",), integer=(), boolean=(), has_warehouse=False,
        days_col="start_datetime",
    ),
    # Note: "inbound" (above) is the PO backlog (warehouse360.inbound_backlog).
    # "inbound_deliveries" is the SAP EL/ELST inbound delivery board (wm_operations.inbound_deliveries).
    "inbound_deliveries": dict(
        contract="wm_operations.inbound_deliveries", endpoint="/api/wm-operations/inbound-deliveries",
        columns="plant_id, warehouse_id, delivery_id, delivery_type, shipping_point, "
                "line_count, delivery_qty, received_qty, receipt_fraction, "
                "has_mixed_base_uom, wm_status_code, expected_receipt_date, "
                "actual_receipt_date, is_received, days_until_expected_receipt, receipt_band",
        order_by="expected_receipt_date ASC NULLS LAST",
        numeric=("delivery_qty", "received_qty", "receipt_fraction"),
        integer=("line_count", "days_until_expected_receipt"),
        boolean=("has_mixed_base_uom", "is_received"), has_warehouse=True,
    ),
    "plants": dict(
        contract="wm_operations.plants", endpoint="/api/wm-operations/plants",
        columns="plant_id, warehouse_id, worklist_tr_count",
        order_by="plant_id ASC, warehouse_id ASC",
        numeric=(), integer=("worklist_tr_count",), boolean=(), has_warehouse=False,
    ),
    "wip_stages": dict(
        contract="wm_operations.wip_stages", endpoint="/api/wm-operations/wip-stages",
        columns=(
            "plant_id, order_id, material_code, material_name, order_qty, uom, "
            "scheduled_start_date, scheduled_finish_date, stage, "
            "first_tr_created_ts, staging_last_confirmed_ts, "
            "production_first_actual_start, first_gr_posting_date, gr_qty"
        ),
        order_by="scheduled_start_date ASC NULLS LAST",
        numeric=("order_qty", "gr_qty"),
        integer=(),
        boolean=(), has_warehouse=False,
    ),
    "schedule_adherence_daily": dict(
        contract="wm_operations.schedule_adherence_daily",
        endpoint="/api/wm-operations/schedule-adherence-daily",
        columns=(
            "plant_id, scheduled_date, planned_count, completed_count, "
            "on_time_count, max_actual_date"
        ),
        order_by="scheduled_date ASC",
        numeric=(),
        integer=("planned_count", "completed_count", "on_time_count"),
        boolean=(), has_warehouse=False,
    ),
    "order_journey": dict(
        contract="wm_operations.order_journey", endpoint="/api/wm-operations/order-journey",
        columns=(
            "plant_id, order_id, material_code, material_name, order_qty, uom, production_line, "
            "order_created_ts, release_date, scheduled_start_date, scheduled_finish_date, "
            "first_tr_created_ts, staging_tr_count, staging_first_confirmed_ts, "
            "staging_last_confirmed_ts, staged_item_count, staged_item_total, "
            "production_first_actual_start, production_last_actual_finish, "
            "confirmed_yield_qty, confirmed_scrap_qty, "
            "pi_first_start, pi_last_end, "
            "first_gr_posting_date, last_gr_posting_date, gr_qty, issue_qty, delivery_count, "
            "qm_lot_count, qm_open_lot_count, "
            "release_to_first_tr_hours, tr_to_staged_hours, "
            "staged_to_production_hours, production_to_gr_hours"
        ),
        order_by="scheduled_start_date DESC NULLS LAST",
        numeric=(
            "order_qty", "confirmed_yield_qty", "confirmed_scrap_qty", "gr_qty", "issue_qty",
            "release_to_first_tr_hours", "tr_to_staged_hours",
            "staged_to_production_hours", "production_to_gr_hours",
        ),
        integer=(
            "staging_tr_count", "staged_item_count", "staged_item_total",
            "delivery_count", "qm_lot_count", "qm_open_lot_count",
        ),
        boolean=(), has_warehouse=False,
    ),
    "order_yield": dict(
        contract="wm_operations.order_yield", endpoint="/api/wm-operations/order-yield",
        columns=(
            "plant_id, order_id, material_id, material_name, production_line, "
            "planned_qty, delivered_qty, uom, yield_pct, has_goods_receipt, "
            "is_complete, is_released, is_completed, is_closed, "
            "scheduled_start_date, scheduled_finish_date, actual_finish_date, "
            "first_gr_date, last_gr_date"
        ),
        order_by="scheduled_finish_date DESC NULLS LAST",
        numeric=("planned_qty", "delivered_qty", "yield_pct"),
        integer=(),
        boolean=("has_goods_receipt", "is_complete", "is_released", "is_completed", "is_closed"),
        has_warehouse=False,
        open_only_clause="has_goods_receipt OR is_complete",
    ),
    "recipe_benchmark": dict(
        contract="wm_operations.recipe_benchmark",
        endpoint="/api/wm-operations/recipe-benchmark",
        columns=(
            "plant_id, material_id, production_line, run_count, "
            "median_yield_pct, p10_yield_pct, p90_yield_pct, "
            "median_duration_hours, p10_duration_hours, p90_duration_hours, "
            "last_run_finish_date"
        ),
        order_by="plant_id ASC, material_id ASC, production_line ASC",
        numeric=(
            "median_yield_pct", "p10_yield_pct", "p90_yield_pct",
            "median_duration_hours", "p10_duration_hours", "p90_duration_hours",
        ),
        integer=("run_count",),
        boolean=(),
        has_warehouse=False,
    ),
    "component_variance": dict(
        contract="wm_operations.component_variance",
        endpoint="/api/wm-operations/component-variance",
        columns=(
            "plant_id, order_id, "
            "material_id, material_name, uom, movement_type_code, "
            "required_qty, withdrawn_qty, issued_qty, "
            "variance_qty, variance_pct, est_loss_value, standard_price, is_final_issue"
        ),
        order_by="abs(coalesce(variance_qty, 0)) DESC",
        numeric=("required_qty", "withdrawn_qty", "issued_qty",
                 "variance_qty", "variance_pct", "est_loss_value", "standard_price"),
        integer=(),
        boolean=("is_final_issue",),
        has_warehouse=False,
    ),
}


def get_wm_simple_spec(dataset: str, request: WmSimpleRequest) -> QuerySpec:
    cfg = SIMPLE_DATASETS[dataset]
    view = resolve_contract_object(cfg["contract"], "wh360")
    params: dict[str, object] = {}
    clauses: list[str] = []
    if request.plant_id:
        clauses.append("plant_id = :plant_id")
        params["plant_id"] = request.plant_id
    if cfg.get("has_warehouse") and request.warehouse_id:
        clauses.append("warehouse_id = :warehouse_id")
        params["warehouse_id"] = request.warehouse_id
    if cfg.get("severity_col") and request.severity:
        clauses.append(f"{cfg['severity_col']} = :severity")
        params["severity"] = request.severity
    if cfg.get("days_col") and request.days:
        clauses.append(f"{cfg['days_col']} >= date_sub(current_date(), :days)")
        params["days"] = int(request.days)
    if cfg.get("open_only_clause") and request.open_only:
        clauses.append(cfg["open_only_clause"])
    if cfg.get("origin_col") and request.origin:
        clauses.append(f"{cfg['origin_col']} = :origin")
        params["origin"] = request.origin
    where_str = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = (
        f"\n    SELECT {cfg['columns']}\n    FROM {view}\n    {where_str}\n"
        f"    ORDER BY {cfg['order_by']}\n    LIMIT {int(request.limit)}\n    "
    )
    return QuerySpec(
        name=f"wm_operations.get_{dataset}",
        module="wh360",
        endpoint=cfg["endpoint"],
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["wm_operations", dataset],
        contract_id=cfg["contract"],
    )


def map_wm_simple_rows(dataset: str, rows: list[dict]) -> list[dict]:
    cfg = SIMPLE_DATASETS[dataset]
    return map_rows_generic(rows, numeric=cfg["numeric"], integer=cfg["integer"], boolean=cfg["boolean"])
