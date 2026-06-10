"""Routes for the WM Operations workspace (read-only warehouse/plant manager tools).

Databricks mode only (``BACKEND_ADAPTER_MODE=databricks-api``): executes SQL against the
governed ``vw_consumption_wm_operations_*`` views using the authenticated user's OAuth
token (RLS via the *_secured layer). Missing OAuth → HTTP 401. Missing config → HTTP 503.
No mock or legacy fallback.
"""
from __future__ import annotations

import os
from typing import Optional

from adapters.wm_operations.wm_operations_databricks_adapter import (
    WmBinStockRequest,
    WmOperationsRepository,
    WmOrderReadinessRequest,
    WmWorklistRequest,
    WmWorklistSummaryRequest,
    map_wm_bin_stock_rows,
    map_wm_order_readiness_rows,
    map_wm_worklist_rows,
    map_wm_worklist_summary_rows,
)
from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field

from routes._databricks import (
    build_databricks_repository,
    build_user_identity,
    require_databricks_config,
    run_repository_fetch,
    set_databricks_response_headers,
)

router = APIRouter()


# TODO: Move to generated.py once the code generator pipeline picks up the wm_operations contracts.
class WmWorklistItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    warehouse_id: str = Field(..., alias='warehouseId')
    tr_id: str = Field(..., alias='trId')
    work_area: str = Field(..., alias='workArea')
    worklist_status: str = Field(..., alias='worklistStatus')
    reference_type: Optional[str] = Field(None, alias='referenceType')
    reference_id: Optional[str] = Field(None, alias='referenceId')
    order_material_id: Optional[str] = Field(None, alias='orderMaterialId')
    order_scheduled_start_date: Optional[str] = Field(None, alias='orderScheduledStartDate')
    source_storage_type: Optional[str] = Field(None, alias='sourceStorageType')
    source_zone: Optional[str] = Field(None, alias='sourceZone')
    destination_storage_type: Optional[str] = Field(None, alias='destinationStorageType')
    destination_zone: Optional[str] = Field(None, alias='destinationZone')
    destination_bin: Optional[str] = Field(None, alias='destinationBin')
    queue: Optional[str] = None
    campaign_id: Optional[str] = Field(None, alias='campaignId')
    assigned_operator: Optional[str] = Field(None, alias='assignedOperator')
    job_sequence: Optional[str] = Field(None, alias='jobSequence')
    transfer_priority: Optional[str] = Field(None, alias='transferPriority')
    created_ts: Optional[str] = Field(None, alias='createdTs')
    planned_execution_ts: Optional[str] = Field(None, alias='plannedExecutionTs')
    item_count: Optional[int] = Field(None, alias='itemCount')
    open_item_count: Optional[int] = Field(None, alias='openItemCount')
    material_count: Optional[int] = Field(None, alias='materialCount')
    material_id: Optional[str] = Field(None, alias='materialId')
    material_name: Optional[str] = Field(None, alias='materialName')
    required_qty: Optional[float] = Field(None, alias='requiredQty')
    open_qty: Optional[float] = Field(None, alias='openQty')
    uom: Optional[str] = None
    has_mixed_base_uom: Optional[bool] = Field(None, alias='hasMixedBaseUom')
    to_item_count: Optional[int] = Field(None, alias='toItemCount')
    to_items_confirmed: Optional[int] = Field(None, alias='toItemsConfirmed')
    to_confirmed_qty: Optional[float] = Field(None, alias='toConfirmedQty')
    pick_progress_fraction: Optional[float] = Field(None, alias='pickProgressFraction')
    age_hours: Optional[float] = Field(None, alias='ageHours')
    is_overdue: Optional[bool] = Field(None, alias='isOverdue')


class WmWorklistSummaryItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    warehouse_id: str = Field(..., alias='warehouseId')
    work_area: str = Field(..., alias='workArea')
    worklist_status: str = Field(..., alias='worklistStatus')
    tr_count: Optional[int] = Field(None, alias='trCount')
    total_open_qty: Optional[float] = Field(None, alias='totalOpenQty')
    total_required_qty: Optional[float] = Field(None, alias='totalRequiredQty')
    operator_count: Optional[int] = Field(None, alias='operatorCount')
    earliest_planned_ts: Optional[str] = Field(None, alias='earliestPlannedTs')
    earliest_created_ts: Optional[str] = Field(None, alias='earliestCreatedTs')


class WmOrderReadinessItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    order_id: str = Field(..., alias='orderId')
    warehouse_id: Optional[str] = Field(None, alias='warehouseId')
    material_id: Optional[str] = Field(None, alias='materialId')
    material_name: Optional[str] = Field(None, alias='materialName')
    order_qty: Optional[float] = Field(None, alias='orderQty')
    uom: Optional[str] = None
    scheduled_start_date: Optional[str] = Field(None, alias='scheduledStartDate')
    scheduled_finish_date: Optional[str] = Field(None, alias='scheduledFinishDate')
    production_supply_area: Optional[str] = Field(None, alias='productionSupplyArea')
    component_count: Optional[int] = Field(None, alias='componentCount')
    wm_component_count: Optional[int] = Field(None, alias='wmComponentCount')
    wm_component_required_qty: Optional[float] = Field(None, alias='wmComponentRequiredQty')
    component_open_qty: Optional[float] = Field(None, alias='componentOpenQty')
    tr_count: Optional[int] = Field(None, alias='trCount')
    tr_required_qty: Optional[float] = Field(None, alias='trRequiredQty')
    tr_open_qty: Optional[float] = Field(None, alias='trOpenQty')
    tr_coverage_status: str = Field(..., alias='trCoverageStatus')
    psa_supplied_qty: Optional[float] = Field(None, alias='psaSuppliedQty')
    supply_status: str = Field(..., alias='supplyStatus')
    readiness_status: str = Field(..., alias='readinessStatus')
    days_to_start: Optional[int] = Field(None, alias='daysToStart')
    readiness_band: Optional[str] = Field(None, alias='readinessBand')


class WmBinStockItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    warehouse_id: str = Field(..., alias='warehouseId')
    storage_type: Optional[str] = Field(None, alias='storageType')
    storage_zone: Optional[str] = Field(None, alias='storageZone')
    bin_id: Optional[str] = Field(None, alias='binId')
    picking_area: Optional[str] = Field(None, alias='pickingArea')
    quant_id: str = Field(..., alias='quantId')
    material_id: Optional[str] = Field(None, alias='materialId')
    material_name: Optional[str] = Field(None, alias='materialName')
    batch_id: Optional[str] = Field(None, alias='batchId')
    stock_category: Optional[str] = Field(None, alias='stockCategory')
    total_qty: Optional[float] = Field(None, alias='totalQty')
    available_qty: Optional[float] = Field(None, alias='availableQty')
    putaway_qty: Optional[float] = Field(None, alias='putawayQty')
    pick_qty: Optional[float] = Field(None, alias='pickQty')
    open_transfer_qty: Optional[float] = Field(None, alias='openTransferQty')
    uom: Optional[str] = None
    goods_receipt_date: Optional[str] = Field(None, alias='goodsReceiptDate')
    expiry_date: Optional[str] = Field(None, alias='expiryDate')
    is_blocked_for_stock_removal: Optional[bool] = Field(None, alias='isBlockedForStockRemoval')
    is_blocked_for_putaway: Optional[bool] = Field(None, alias='isBlockedForPutaway')
    is_bin_blocked: Optional[bool] = Field(None, alias='isBinBlocked')
    blocking_reason_code: Optional[str] = Field(None, alias='blockingReasonCode')
    days_to_expiry: Optional[int] = Field(None, alias='daysToExpiry')
    is_expired: Optional[bool] = Field(None, alias='isExpired')


def _require_databricks_mode(feature: str) -> None:
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail=f"{feature} requires BACKEND_ADAPTER_MODE=databricks-api",
        )


def _build_repository(
    x_forwarded_access_token: Optional[str],
    x_forwarded_user: Optional[str],
    x_forwarded_email: Optional[str],
) -> WmOperationsRepository:
    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    return WmOperationsRepository(repository)


def _validate_limit(limit: int, maximum: int) -> None:
    if limit < 1 or limit > maximum:
        raise HTTPException(status_code=422, detail=f"limit must be between 1 and {maximum}")


@router.get("/wm-operations/worklist", response_model=list[WmWorklistItem])
async def wm_operations_worklist(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    work_area: str | None = None,
    status: str | None = None,
    include_complete: bool = False,
    limit: int = 200,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmWorklistItem]:
    """Staging/picking worklist at TR (job) grain — databricks-api only."""
    _require_databricks_mode("WM Operations worklist")
    _validate_limit(limit, 500)

    try:
        req = WmWorklistRequest(
            plant_id=plant_id.strip() if plant_id else None,
            warehouse_id=warehouse_id.strip() if warehouse_id else None,
            work_area=work_area.strip().upper() if work_area else None,
            status=status.strip().upper() if status else None,
            include_complete=include_complete,
            limit=limit,
        )
        repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
        rows, spec = await run_repository_fetch(lambda: repo.fetch_worklist(req))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    set_databricks_response_headers(response, spec)
    return map_wm_worklist_rows(rows)


@router.get("/wm-operations/worklist-summary", response_model=list[WmWorklistSummaryItem])
async def wm_operations_worklist_summary(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmWorklistSummaryItem]:
    """Worklist KPI strip (counts by work area and status) — databricks-api only."""
    _require_databricks_mode("WM Operations worklist summary")

    req = WmWorklistSummaryRequest(
        plant_id=plant_id.strip() if plant_id else None,
        warehouse_id=warehouse_id.strip() if warehouse_id else None,
    )
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_worklist_summary(req))
    set_databricks_response_headers(response, spec)
    return map_wm_worklist_summary_rows(rows)


@router.get("/wm-operations/order-readiness", response_model=list[WmOrderReadinessItem])
async def wm_operations_order_readiness(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    limit: int = 200,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmOrderReadinessItem]:
    """Released process orders with TR coverage + PSA supply status — databricks-api only."""
    _require_databricks_mode("WM Operations order readiness")
    _validate_limit(limit, 500)

    req = WmOrderReadinessRequest(
        plant_id=plant_id.strip() if plant_id else None,
        warehouse_id=warehouse_id.strip() if warehouse_id else None,
        limit=limit,
    )
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_order_readiness(req))
    set_databricks_response_headers(response, spec)
    return map_wm_order_readiness_rows(rows)


@router.get("/wm-operations/bin-stock", response_model=list[WmBinStockItem])
async def wm_operations_bin_stock(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    storage_zone: str | None = None,
    storage_type: str | None = None,
    material_id: str | None = None,
    bin_id: str | None = None,
    expiring_within_days: int | None = None,
    limit: int = 500,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmBinStockItem]:
    """Quant-grain stock & bin explorer (dispensary view = storage_zone=DISPENSARY) — databricks-api only."""
    _require_databricks_mode("WM Operations bin stock")
    _validate_limit(limit, 1000)

    try:
        req = WmBinStockRequest(
            plant_id=plant_id.strip() if plant_id else None,
            warehouse_id=warehouse_id.strip() if warehouse_id else None,
            storage_zone=storage_zone.strip().upper() if storage_zone else None,
            storage_type=storage_type.strip() if storage_type else None,
            material_id=material_id.strip() if material_id else None,
            bin_id=bin_id.strip() if bin_id else None,
            expiring_within_days=expiring_within_days,
            limit=limit,
        )
        repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
        rows, spec = await run_repository_fetch(lambda: repo.fetch_bin_stock(req))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    set_databricks_response_headers(response, spec)
    return map_wm_bin_stock_rows(rows)
