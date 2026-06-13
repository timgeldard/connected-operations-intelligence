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
    SIMPLE_DATASETS,
    WmBatchMovementsRequest,
    WmBinStockRequest,
    WmDeliveryPicksRequest,
    WmMovementsRequest,
    WmOperationsRepository,
    WmOperatorActivityRequest,
    WmOrderComponentsRequest,
    WmOrderJourneyEventsRequest,
    WmOrderOperationsRequest,
    WmOrderReadinessRequest,
    WmOutboundRequest,
    WmQueueWorkloadRequest,
    WmReconAlertsRequest,
    WmSimpleRequest,
    WmWorklistRequest,
    WmWorklistSummaryRequest,
    map_wm_batch_movements_rows,
    map_wm_bin_stock_rows,
    map_wm_delivery_picks_rows,
    map_wm_movements_rows,
    map_wm_operator_activity_rows,
    map_wm_order_components_rows,
    map_wm_order_journey_events_rows,
    map_wm_order_operations_rows,
    map_wm_order_readiness_rows,
    map_wm_outbound_rows,
    map_wm_queue_workload_rows,
    map_wm_recon_alerts_rows,
    map_wm_simple_rows,
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
    latest_to_confirmed_ts: Optional[str] = Field(None, alias='latestToConfirmedTs')
    cycle_hours: Optional[float] = Field(None, alias='cycleHours')
    age_hours: Optional[float] = Field(None, alias='ageHours')
    is_overdue: Optional[bool] = Field(None, alias='isOverdue')
    short_pick_qty: Optional[float] = Field(None, alias='shortPickQty')
    short_pick_item_count: Optional[int] = Field(None, alias='shortPickItemCount')
    order_production_line: Optional[str] = Field(None, alias='orderProductionLine')


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
    production_line: Optional[str] = Field(None, alias='productionLine')
    qty_unrestricted: Optional[float] = Field(None, alias='qtyUnrestricted')
    quality_hold_qty: Optional[float] = Field(None, alias='qualityHoldQty')
    open_lot_count: Optional[int] = Field(None, alias='openLotCount')
    quality_release_status: Optional[str] = Field(None, alias='qualityReleaseStatus')
    readiness_reason: Optional[str] = Field(None, alias='readinessReason')


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
    queue: str | None = None,
    campaign: str | None = None,
    reference: str | None = None,
    include_complete: bool = False,
    limit: int = 200,
    offset: int = 0,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmWorklistItem]:
    """Staging/picking worklist at TR (job) grain — databricks-api only."""
    _require_databricks_mode("WM Operations worklist")
    _validate_limit(limit, 500)

    # Repository construction stays OUTSIDE the 422 guard: a missing Databricks config is a
    # server-side error (500), not a client validation failure.
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    try:
        req = WmWorklistRequest(
            plant_id=plant_id.strip() if plant_id else None,
            warehouse_id=warehouse_id.strip() if warehouse_id else None,
            work_area=work_area.strip().upper() if work_area else None,
            status=status.strip().upper() if status else None,
            queue=queue.strip() if queue else None,
            campaign=campaign.strip() if campaign else None,
            reference=reference.strip() if reference else None,
            include_complete=include_complete,
            limit=limit,
            offset=max(0, offset),
        )
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

    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    try:
        req = WmWorklistSummaryRequest(
            plant_id=plant_id.strip() if plant_id else None,
            warehouse_id=warehouse_id.strip() if warehouse_id else None,
        )
        rows, spec = await run_repository_fetch(lambda: repo.fetch_worklist_summary(req))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    set_databricks_response_headers(response, spec)
    return map_wm_worklist_summary_rows(rows)


@router.get("/wm-operations/order-readiness", response_model=list[WmOrderReadinessItem])
async def wm_operations_order_readiness(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    start_from_days_ago: int | None = None,
    start_to_days_ahead: int | None = None,
    limit: int = 200,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmOrderReadinessItem]:
    """Released process orders with TR coverage + PSA supply status — databricks-api only."""
    _require_databricks_mode("WM Operations order readiness")
    _validate_limit(limit, 500)

    for bound in (start_from_days_ago, start_to_days_ahead):
        if bound is not None and (bound < 0 or bound > 3650):
            raise HTTPException(status_code=422, detail="day bounds must be between 0 and 3650")
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    try:
        req = WmOrderReadinessRequest(
            plant_id=plant_id.strip() if plant_id else None,
            warehouse_id=warehouse_id.strip() if warehouse_id else None,
            start_from_days_ago=start_from_days_ago,
            start_to_days_ahead=start_to_days_ahead,
            limit=limit,
        )
        rows, spec = await run_repository_fetch(lambda: repo.fetch_order_readiness(req))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
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

    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
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
        rows, spec = await run_repository_fetch(lambda: repo.fetch_bin_stock(req))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    set_databricks_response_headers(response, spec)
    return map_wm_bin_stock_rows(rows)


class WmOrderComponentItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    order_id: str = Field(..., alias='orderId')
    reservation_id: Optional[str] = Field(None, alias='reservationId')
    reservation_item: Optional[str] = Field(None, alias='reservationItem')
    operation_number: Optional[str] = Field(None, alias='operationNumber')
    warehouse_id: Optional[str] = Field(None, alias='warehouseId')
    material_id: Optional[str] = Field(None, alias='materialId')
    material_name: Optional[str] = Field(None, alias='materialName')
    batch_id: Optional[str] = Field(None, alias='batchId')
    required_qty: Optional[float] = Field(None, alias='requiredQty')
    open_qty: Optional[float] = Field(None, alias='openQty')
    uom: Optional[str] = None
    production_supply_area: Optional[str] = Field(None, alias='productionSupplyArea')
    requirement_date: Optional[str] = Field(None, alias='requirementDate')
    material_component_count: Optional[int] = Field(None, alias='materialComponentCount')
    tr_count: Optional[int] = Field(None, alias='trCount')
    tr_required_qty: Optional[float] = Field(None, alias='trRequiredQty')
    tr_open_qty: Optional[float] = Field(None, alias='trOpenQty')
    tr_coverage_status: Optional[str] = Field(None, alias='trCoverageStatus')
    to_item_count: Optional[int] = Field(None, alias='toItemCount')
    to_items_confirmed: Optional[int] = Field(None, alias='toItemsConfirmed')
    to_confirmed_qty: Optional[float] = Field(None, alias='toConfirmedQty')
    pick_progress_fraction: Optional[float] = Field(None, alias='pickProgressFraction')
    psa_supplied_qty: Optional[float] = Field(None, alias='psaSuppliedQty')
    is_supplied: Optional[bool] = Field(None, alias='isSupplied')


class WmOrderOperationsItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    order_number: str = Field(..., alias='orderNumber')
    routing_number: Optional[str] = Field(None, alias='routingNumber')
    operation_counter: Optional[str] = Field(None, alias='operationCounter')
    operation_number: Optional[str] = Field(None, alias='operationNumber')
    operation_description: Optional[str] = Field(None, alias='operationDescription')
    control_key: Optional[str] = Field(None, alias='controlKey')
    work_centre_code: Optional[str] = Field(None, alias='workCentreCode')
    work_centre_description: Optional[str] = Field(None, alias='workCentreDescription')
    scheduled_start_datetime: Optional[str] = Field(None, alias='scheduledStartDatetime')
    scheduled_finish_datetime: Optional[str] = Field(None, alias='scheduledFinishDatetime')
    actual_start_datetime: Optional[str] = Field(None, alias='actualStartDatetime')
    actual_finish_date: Optional[str] = Field(None, alias='actualFinishDate')
    operation_qty: Optional[float] = Field(None, alias='operationQty')
    confirmed_yield_qty: Optional[float] = Field(None, alias='confirmedYieldQty')
    confirmed_scrap_qty: Optional[float] = Field(None, alias='confirmedScrapQty')
    is_confirmed: Optional[bool] = Field(None, alias='isConfirmed')


@router.get("/wm-operations/order-operations", response_model=list[WmOrderOperationsItem])
async def wm_operations_order_operations(
    response: Response,
    plant_id: str,
    order_id: str,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmOrderOperationsItem]:
    """Operation-level routing detail for one process order — databricks-api only."""
    _require_databricks_mode("WM Operations order operations")
    req = WmOrderOperationsRequest(plant_id=plant_id.strip(), order_id=order_id.strip())
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_order_operations(req))
    set_databricks_response_headers(response, spec)
    return map_wm_order_operations_rows(rows)


class WmOrderJourneyEventItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    order_id: str = Field(..., alias='orderId')
    event_seq: Optional[int] = Field(None, alias='eventSeq')
    event_ts: Optional[str] = Field(None, alias='eventTs')
    event_type: str = Field(..., alias='eventType')
    qty: Optional[float] = None
    uom: Optional[str] = None
    reference_id: Optional[str] = Field(None, alias='referenceId')
    detail: Optional[str] = None


@router.get("/wm-operations/order-journey-events", response_model=list[WmOrderJourneyEventItem])
async def wm_operations_order_journey_events(
    response: Response,
    plant_id: str,
    order_id: str,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmOrderJourneyEventItem]:
    """Per-order event timeline for the Order Journey Timeline view — databricks-api only."""
    _require_databricks_mode("WM Operations order journey events")
    req = WmOrderJourneyEventsRequest(plant_id=plant_id.strip(), order_id=order_id.strip())
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_order_journey_events(req))
    set_databricks_response_headers(response, spec)
    return map_wm_order_journey_events_rows(rows)


class WmOperatorActivityItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    warehouse_id: str = Field(..., alias='warehouseId')
    operator: str
    activity_date: str = Field(..., alias='activityDate')
    shift: Optional[str] = None
    items_confirmed: Optional[int] = Field(None, alias='itemsConfirmed')
    transfer_orders: Optional[int] = Field(None, alias='transferOrders')
    materials: Optional[int] = None
    transfer_requirements: Optional[int] = Field(None, alias='transferRequirements')
    confirmed_qty: Optional[float] = Field(None, alias='confirmedQty')


class WmQueueWorkloadItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    warehouse_id: str = Field(..., alias='warehouseId')
    queue: str
    work_area: str = Field(..., alias='workArea')
    open_jobs: Optional[int] = Field(None, alias='openJobs')
    in_progress_jobs: Optional[int] = Field(None, alias='inProgressJobs')
    parked_jobs: Optional[int] = Field(None, alias='parkedJobs')
    no_stock_jobs: Optional[int] = Field(None, alias='noStockJobs')
    operator_count: Optional[int] = Field(None, alias='operatorCount')
    earliest_planned_ts: Optional[str] = Field(None, alias='earliestPlannedTs')
    earliest_created_ts: Optional[str] = Field(None, alias='earliestCreatedTs')


class WmOutboundItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    warehouse_id: Optional[str] = Field(None, alias='warehouseId')
    delivery_id: str = Field(..., alias='deliveryId')
    delivery_type: Optional[str] = Field(None, alias='deliveryType')
    ship_to_customer_id: Optional[str] = Field(None, alias='shipToCustomerId')
    ship_to_customer_name: Optional[str] = Field(None, alias='shipToCustomerName')
    line_count: Optional[int] = Field(None, alias='lineCount')
    delivery_qty: Optional[float] = Field(None, alias='deliveryQty')
    picked_qty: Optional[float] = Field(None, alias='pickedQty')
    pick_fraction: Optional[float] = Field(None, alias='pickFraction')
    has_mixed_base_uom: Optional[bool] = Field(None, alias='hasMixedBaseUom')
    planned_goods_issue_date: Optional[str] = Field(None, alias='plannedGoodsIssueDate')
    actual_goods_issue_date: Optional[str] = Field(None, alias='actualGoodsIssueDate')
    is_shipped: Optional[bool] = Field(None, alias='isShipped')
    days_to_goods_issue: Optional[int] = Field(None, alias='daysToGoodsIssue')
    risk_band: Optional[str] = Field(None, alias='riskBand')


class WmReconAlertItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    warehouse_id: Optional[str] = Field(None, alias='warehouseId')
    alert_key: str = Field(..., alias='alertKey')
    alert_type: str = Field(..., alias='alertType')
    alert_priority: Optional[str] = Field(None, alias='alertPriority')
    material_id: Optional[str] = Field(None, alias='materialId')
    batch_id: Optional[str] = Field(None, alias='batchId')
    reason_code: Optional[str] = Field(None, alias='reasonCode')
    delta_qty: Optional[float] = Field(None, alias='deltaQty')
    delta_value: Optional[float] = Field(None, alias='deltaValue')


class WmBatchMovementItem(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    plant_id: str = Field(..., alias='plantId')
    document_id: Optional[str] = Field(None, alias='documentId')
    document_year: Optional[str] = Field(None, alias='documentYear')
    document_item: Optional[str] = Field(None, alias='documentItem')
    material_id: Optional[str] = Field(None, alias='materialId')
    batch_id: Optional[str] = Field(None, alias='batchId')
    movement_type: Optional[str] = Field(None, alias='movementType')
    movement_label: Optional[str] = Field(None, alias='movementLabel')
    event_category: Optional[str] = Field(None, alias='eventCategory')
    quantity: Optional[float] = None
    uom: Optional[str] = None
    posting_date: Optional[str] = Field(None, alias='postingDate')
    order_id: Optional[str] = Field(None, alias='orderId')
    delivery_id: Optional[str] = Field(None, alias='deliveryId')
    posted_by: Optional[str] = Field(None, alias='postedBy')


@router.get("/wm-operations/order-components", response_model=list[WmOrderComponentItem])
async def wm_operations_order_components(
    response: Response,
    plant_id: str,
    order_id: str,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmOrderComponentItem]:
    """Component-level staging detail for one process order — databricks-api only."""
    _require_databricks_mode("WM Operations order components")
    req = WmOrderComponentsRequest(plant_id=plant_id.strip(), order_id=order_id.strip())
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_order_components(req))
    set_databricks_response_headers(response, spec)
    return map_wm_order_components_rows(rows)


@router.get("/wm-operations/operator-activity", response_model=list[WmOperatorActivityItem])
async def wm_operations_operator_activity(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    operator: str | None = None,
    days: int = 14,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmOperatorActivityItem]:
    """RF operator pick activity per day — databricks-api only."""
    _require_databricks_mode("WM Operations operator activity")
    if days < 1 or days > 92:
        raise HTTPException(status_code=422, detail="days must be between 1 and 92")
    req = WmOperatorActivityRequest(
        plant_id=plant_id.strip() if plant_id else None,
        warehouse_id=warehouse_id.strip() if warehouse_id else None,
        operator=operator.strip() if operator else None,
        days=days,
    )
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_operator_activity(req))
    set_databricks_response_headers(response, spec)
    return map_wm_operator_activity_rows(rows)


@router.get("/wm-operations/queue-workload", response_model=list[WmQueueWorkloadItem])
async def wm_operations_queue_workload(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmQueueWorkloadItem]:
    """Current open workload by queue and work area — databricks-api only."""
    _require_databricks_mode("WM Operations queue workload")
    req = WmQueueWorkloadRequest(
        plant_id=plant_id.strip() if plant_id else None,
        warehouse_id=warehouse_id.strip() if warehouse_id else None,
    )
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_queue_workload(req))
    set_databricks_response_headers(response, spec)
    return map_wm_queue_workload_rows(rows)


@router.get("/wm-operations/outbound", response_model=list[WmOutboundItem])
async def wm_operations_outbound(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    include_shipped: bool = False,
    limit: int = 200,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmOutboundItem]:
    """Outbound delivery picking board — databricks-api only."""
    _require_databricks_mode("WM Operations outbound")
    _validate_limit(limit, 500)
    req = WmOutboundRequest(
        plant_id=plant_id.strip() if plant_id else None,
        warehouse_id=warehouse_id.strip() if warehouse_id else None,
        include_shipped=include_shipped,
        limit=limit,
    )
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_outbound(req))
    set_databricks_response_headers(response, spec)
    return map_wm_outbound_rows(rows)


@router.get("/wm-operations/recon-alerts", response_model=list[WmReconAlertItem])
async def wm_operations_recon_alerts(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    limit: int = 200,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmReconAlertItem]:
    """Severe reconciliation alerts for the shift-handover digest — databricks-api only."""
    _require_databricks_mode("WM Operations recon alerts")
    _validate_limit(limit, 500)
    req = WmReconAlertsRequest(
        plant_id=plant_id.strip() if plant_id else None,
        warehouse_id=warehouse_id.strip() if warehouse_id else None,
        limit=limit,
    )
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_recon_alerts(req))
    set_databricks_response_headers(response, spec)
    return map_wm_recon_alerts_rows(rows)


@router.get("/wm-operations/batch-movements", response_model=list[WmBatchMovementItem])
async def wm_operations_batch_movements(
    response: Response,
    plant_id: str,
    material_id: str,
    batch_id: str | None = None,
    days: int = 31,
    limit: int = 200,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[WmBatchMovementItem]:
    """Goods-movement history for a material/batch (bounded window) — databricks-api only."""
    _require_databricks_mode("WM Operations batch movements")
    _validate_limit(limit, 500)
    if days < 1 or days > 31:
        raise HTTPException(status_code=422, detail="days must be between 1 and 31")
    req = WmBatchMovementsRequest(
        plant_id=plant_id.strip(),
        material_id=material_id.strip(),
        batch_id=batch_id.strip() if batch_id else None,
        days=days,
        limit=limit,
    )
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_batch_movements(req))
    set_databricks_response_headers(response, spec)
    return map_wm_batch_movements_rows(rows)


# ── Generic simple-list endpoints (second wave). Response models intentionally
# omitted (house precedent: warehouse360 overview) — mappers emit typed camelCase.

def _make_simple_route(dataset: str, cfg: dict):
    async def handler(
        response: Response,
        plant_id: str | None = None,
        warehouse_id: str | None = None,
        severity: str | None = None,
        days: int | None = None,
        open_only: bool = True,
        origin: str | None = None,
        limit: int = 200,
        x_forwarded_access_token: str | None = Header(default=None),
        x_forwarded_user: str | None = Header(default=None),
        x_forwarded_email: str | None = Header(default=None),
    ) -> list[dict]:
        _require_databricks_mode(f"WM Operations {dataset}")
        _validate_limit(limit, 1000)
        if days is not None and (days < 1 or days > 366):
            raise HTTPException(status_code=422, detail="days must be between 1 and 366")
        req = WmSimpleRequest(
            plant_id=plant_id.strip() if plant_id else None,
            warehouse_id=warehouse_id.strip() if warehouse_id else None,
            severity=severity.strip().upper() if severity else None,
            days=days,
            open_only=open_only,
            origin=origin.strip() if origin else None,
            limit=limit,
        )
        repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
        rows, spec = await run_repository_fetch(lambda: repo.fetch_simple(dataset, req))
        set_databricks_response_headers(response, spec)
        return map_wm_simple_rows(dataset, rows)

    handler.__name__ = f"wm_operations_{dataset}"
    handler.__doc__ = f"WM Operations {dataset.replace('_', ' ')} — databricks-api only."
    route_path = cfg["endpoint"].removeprefix("/api")
    router.get(route_path)(handler)
    return handler


for _dataset, _cfg in SIMPLE_DATASETS.items():
    _make_simple_route(_dataset, _cfg)


@router.get("/wm-operations/delivery-picks")
async def wm_operations_delivery_picks(
    response: Response,
    plant_id: str,
    delivery_id: str,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[dict]:
    """Open pick tasks for one delivery — databricks-api only."""
    _require_databricks_mode("WM Operations delivery picks")
    req = WmDeliveryPicksRequest(plant_id=plant_id.strip(), delivery_id=delivery_id.strip())
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_delivery_picks(req))
    set_databricks_response_headers(response, spec)
    return map_wm_delivery_picks_rows(rows)


@router.get("/wm-operations/movements")
async def wm_operations_movements(
    response: Response,
    plant_id: str,
    days: int = 7,
    event_category: str | None = None,
    movement_type: str | None = None,
    posted_by: str | None = None,
    order_id: str | None = None,
    delivery_id: str | None = None,
    limit: int = 200,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[dict]:
    """Goods-movement activity feed (bounded window) — databricks-api only."""
    _require_databricks_mode("WM Operations movements")
    _validate_limit(limit, 500)
    if days < 1 or days > 31:
        raise HTTPException(status_code=422, detail="days must be between 1 and 31")
    req = WmMovementsRequest(
        plant_id=plant_id.strip(),
        days=days,
        event_category=event_category.strip() if event_category else None,
        movement_type=movement_type.strip() if movement_type else None,
        posted_by=posted_by.strip() if posted_by else None,
        order_id=order_id.strip() if order_id else None,
        delivery_id=delivery_id.strip() if delivery_id else None,
        limit=limit,
    )
    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    rows, spec = await run_repository_fetch(lambda: repo.fetch_movements(req))
    set_databricks_response_headers(response, spec)
    return map_wm_movements_rows(rows)
