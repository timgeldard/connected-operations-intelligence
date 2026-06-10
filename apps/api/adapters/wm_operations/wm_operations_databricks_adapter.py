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
    include_complete: bool = False
    limit: int = 200


@dataclass
class WmWorklistSummaryRequest:
    plant_id: Optional[str] = None
    warehouse_id: Optional[str] = None


@dataclass
class WmOrderReadinessRequest:
    plant_id: Optional[str] = None
    warehouse_id: Optional[str] = None
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
        age_hours,
        is_overdue
    FROM {view}
    {where_str}
    ORDER BY planned_execution_ts ASC NULLS LAST, created_ts ASC
    LIMIT {request.limit}
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
            "hasMixedBaseUom": bool(row.get("has_mixed_base_uom"))
            if row.get("has_mixed_base_uom") is not None else None,
            "toItemCount": _safe_int(row.get("to_item_count")),
            "toItemsConfirmed": _safe_int(row.get("to_items_confirmed")),
            "toConfirmedQty": _safe_float(row.get("to_confirmed_qty")),
            "pickProgressFraction": _safe_float(row.get("pick_progress_fraction")),
            "ageHours": _safe_float(row.get("age_hours")),
            "isOverdue": bool(row.get("is_overdue")) if row.get("is_overdue") is not None else None,
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
    where_str = _scope_where(request, params)
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
        readiness_band
    FROM {view}
    {where_str}
    ORDER BY scheduled_start_date ASC NULLS LAST, order_id ASC
    LIMIT {request.limit}
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
    LIMIT {request.limit}
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
            "isBlockedForStockRemoval": bool(row.get("is_blocked_for_stock_removal"))
            if row.get("is_blocked_for_stock_removal") is not None else None,
            "isBlockedForPutaway": bool(row.get("is_blocked_for_putaway"))
            if row.get("is_blocked_for_putaway") is not None else None,
            "isBinBlocked": bool(row.get("is_bin_blocked"))
            if row.get("is_bin_blocked") is not None else None,
            "blockingReasonCode": _opt_str(row, "blocking_reason_code"),
            "daysToExpiry": _safe_int(row.get("days_to_expiry")),
            "isExpired": bool(row.get("is_expired")) if row.get("is_expired") is not None else None,
        })
    return result


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
