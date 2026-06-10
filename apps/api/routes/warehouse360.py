"""Routes for the Warehouse 360 domain.

Databricks mode (``BACKEND_ADAPTER_MODE=databricks-api``): executes SQL directly
against Unity Catalog using the authenticated user's OAuth token. Requires
``DATABRICKS_HOST`` and ``SQL_WAREHOUSE_ID`` to be set. Missing OAuth → HTTP 401.
Missing config → HTTP 503. No silent fallback to legacy-api or mock.
"""
from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Optional

from adapters.warehouse360.warehouse360_databricks_adapter import (
    Warehouse360Repository,
    WarehouseExceptionRequest,
    WarehouseInboundRequest,
    WarehouseOutboundRequest,
    WarehouseOverviewRequest,
    WarehouseStagingRequest,
    WarehouseStockExceptionsRequest,
    WarehouseShortfallsRequest,
    WarehouseStockZonesRequest,
    WarehouseBatchHoldStatusRequest,
    WarehouseStagingReadinessRequest,
    WarehouseOpenHoldsRequest,
    WarehousePickTasksRequest,
    WarehouseMoveRequestsRequest,
    WarehouseGoodsMovementsRequest,
    GOODS_MOVEMENTS_MAX_WINDOW_DAYS,
    map_warehouse_exceptions_rows,
    map_warehouse_inbound_rows,
    map_warehouse_outbound_rows,
    map_warehouse_overview_rows,
    map_warehouse_staging_rows,
    map_warehouse_stock_exceptions_rows,
    map_warehouse_shortfalls_rows,
    map_warehouse_stock_zones_rows,
    map_warehouse_open_holds_rows,
    map_warehouse_pick_tasks_rows,
    map_warehouse_move_requests_rows,
    map_warehouse_goods_movements_rows,
    map_warehouse_batch_hold_status_rows,
    map_warehouse_staging_readiness_rows,
)
from contracts.generated import (
    Warehouse360ExceptionItem,
    Warehouse360InboundItem,
    Warehouse360OutboundItem,
    Warehouse360StagingItem,
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


# TODO: Move to generated.py once code generator pipeline supports stock_exceptions and shortfalls contracts.
class Warehouse360StockExceptionItem(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    plant_id: str = Field(..., alias='plantId')
    material_id: str = Field(..., alias='materialId')
    batch_id: str = Field(..., alias='batchId')
    exception_type: str = Field(..., alias='exceptionType')
    qty: Optional[float] = None
    minimum_days_to_expiry: Optional[int] = Field(None, alias='minimumDaysToExpiry')
    has_minimum_shelf_life_breach: Optional[bool] = Field(None, alias='hasMinimumShelfLifeBreach')


# TODO: Move to generated.py once code generator pipeline supports stock_exceptions and shortfalls contracts.
class Warehouse360ShortfallItem(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    plant_id: str = Field(..., alias='plantId')
    material_id: str = Field(..., alias='materialId')
    shortfall_qty: Optional[float] = Field(None, alias='shortfallQty')
    open_items_count: Optional[int] = Field(None, alias='openItemsCount')
    oldest_tr_date: Optional[str] = Field(None, alias='oldestTrDate')


class Warehouse360StockZoneItem(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    plant_id: str = Field(..., alias='plantId')
    warehouse_number: str = Field(..., alias='warehouseNumber')
    storage_type: str = Field(..., alias='storageType')
    bin_type: str = Field(..., alias='binType')
    bin_record_count: int = Field(..., alias='binRecordCount')
    occupied_bin_count: int = Field(..., alias='occupiedBinCount')
    empty_bin_count: int = Field(..., alias='emptyBinCount')
    blocked_bin_count: int = Field(..., alias='blockedBinCount')
    occupancy_rate: float = Field(..., alias='occupancyRate')


class Warehouse360BatchHoldStatus(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    plant_id: str = Field(..., alias='plantId')
    storage_location_id: Optional[str] = Field(None, alias='storageLocationId')
    material_id: str = Field(..., alias='materialId')
    batch_id: str = Field(..., alias='batchId')
    uom: str
    unrestricted_quantity: float = Field(..., alias='unrestrictedQuantity')
    blocked_quantity: float = Field(..., alias='blockedQuantity')
    restricted_quantity: float = Field(..., alias='restrictedQuantity')
    total_quantity: float = Field(..., alias='totalQuantity')
    stock_type: str = Field(..., alias='stockType')
    has_blocking_hold: bool = Field(..., alias='hasBlockingHold')
    last_updated_at: str = Field(..., alias='lastUpdatedAt')


class Warehouse360StagingReadiness(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    plant_id: str = Field(..., alias='plantId')
    plan_date: str = Field(..., alias='planDate')
    total_orders: int = Field(..., alias='totalOrders')
    fully_staged: int = Field(..., alias='fullyStaged')
    partially_staged: int = Field(..., alias='partiallyStaged')
    not_staged: int = Field(..., alias='notStaged')
    blocked: int = Field(..., alias='blocked')


class Warehouse360OpenHoldItem(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    plant_id: str = Field(..., alias='plantId')
    warehouse_number: str = Field(..., alias='warehouseNumber')
    storage_type: Optional[str] = Field(None, alias='storageType')
    storage_bin: Optional[str] = Field(None, alias='storageBin')
    quant_number: str = Field(..., alias='quantNumber')
    material_id: str = Field(..., alias='materialId')
    batch_id: Optional[str] = Field(None, alias='batchId')
    hold_type: str = Field(..., alias='holdType')
    quantity: Optional[float] = None
    uom: Optional[str] = None
    goods_receipt_date: Optional[str] = Field(None, alias='goodsReceiptDate')
    age_hours: Optional[float] = Field(None, alias='ageHours')
    # Hold provenance is a documented data gap (no QM hold log replicated) — always null.
    raised_by: Optional[str] = Field(None, alias='raisedBy')


class Warehouse360PickTaskItem(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    plant_id: str = Field(..., alias='plantId')
    warehouse_number: str = Field(..., alias='warehouseNumber')
    task_id: str = Field(..., alias='taskId')
    item_number: str = Field(..., alias='itemNumber')
    material_id: Optional[str] = Field(None, alias='materialId')
    batch_id: Optional[str] = Field(None, alias='batchId')
    source_storage_type: Optional[str] = Field(None, alias='sourceStorageType')
    source_storage_bin: Optional[str] = Field(None, alias='sourceStorageBin')
    destination_storage_type: Optional[str] = Field(None, alias='destinationStorageType')
    destination_storage_bin: Optional[str] = Field(None, alias='destinationStorageBin')
    requested_quantity: Optional[float] = Field(None, alias='requestedQuantity')
    confirmed_quantity: Optional[float] = Field(None, alias='confirmedQuantity')
    item_status: str = Field(..., alias='itemStatus')
    created_datetime: Optional[str] = Field(None, alias='createdDatetime')
    order_reference_type: Optional[str] = Field(None, alias='orderReferenceType')
    order_reference_number: Optional[str] = Field(None, alias='orderReferenceNumber')
    transfer_priority: Optional[str] = Field(None, alias='transferPriority')
    delivery_number: Optional[str] = Field(None, alias='deliveryNumber')
    created_by_user: Optional[str] = Field(None, alias='createdByUser')
    assignee: Optional[str] = None
    age_hours: Optional[float] = Field(None, alias='ageHours')


class Warehouse360MoveRequestItem(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    plant_id: str = Field(..., alias='plantId')
    warehouse_number: str = Field(..., alias='warehouseNumber')
    request_id: str = Field(..., alias='requestId')
    item_number: str = Field(..., alias='itemNumber')
    material_id: Optional[str] = Field(None, alias='materialId')
    batch_id: Optional[str] = Field(None, alias='batchId')
    source_storage_type: Optional[str] = Field(None, alias='sourceStorageType')
    source_storage_bin: Optional[str] = Field(None, alias='sourceStorageBin')
    destination_storage_type: Optional[str] = Field(None, alias='destinationStorageType')
    destination_storage_bin: Optional[str] = Field(None, alias='destinationStorageBin')
    required_quantity: Optional[float] = Field(None, alias='requiredQuantity')
    open_quantity: Optional[float] = Field(None, alias='openQuantity')
    created_datetime: Optional[str] = Field(None, alias='createdDatetime')
    planned_execution_datetime: Optional[str] = Field(None, alias='plannedExecutionDatetime')
    queue: Optional[str] = None
    transfer_priority: Optional[str] = Field(None, alias='transferPriority')
    order_reference_type: Optional[str] = Field(None, alias='orderReferenceType')
    order_reference_number: Optional[str] = Field(None, alias='orderReferenceNumber')
    # Assignee is a documented data gap (LTBK carries none) — always null.
    assigned_to: Optional[str] = Field(None, alias='assignedTo')
    age_hours: Optional[float] = Field(None, alias='ageHours')


class Warehouse360GoodsMovementItem(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
        populate_by_name=True,
    )
    plant_id: str = Field(..., alias='plantId')
    storage_location_id: Optional[str] = Field(None, alias='storageLocationId')
    document_number: str = Field(..., alias='documentNumber')
    fiscal_year: str = Field(..., alias='fiscalYear')
    line_item: str = Field(..., alias='lineItem')
    material_id: Optional[str] = Field(None, alias='materialId')
    batch_id: Optional[str] = Field(None, alias='batchId')
    movement_type_code: str = Field(..., alias='movementTypeCode')
    movement_label: Optional[str] = Field(None, alias='movementLabel')
    event_category: Optional[str] = Field(None, alias='eventCategory')
    is_goods_receipt: bool = Field(..., alias='isGoodsReceipt')
    is_goods_issue: bool = Field(..., alias='isGoodsIssue')
    is_transfer: bool = Field(..., alias='isTransfer')
    is_reversal: bool = Field(..., alias='isReversal')
    debit_credit_indicator: Optional[str] = Field(None, alias='debitCreditIndicator')
    quantity: Optional[float] = None
    uom: Optional[str] = None
    amount_local_currency: Optional[float] = Field(None, alias='amountLocalCurrency')
    currency: Optional[str] = None
    posting_date: Optional[str] = Field(None, alias='postingDate')
    document_date: Optional[str] = Field(None, alias='documentDate')
    order_number: Optional[str] = Field(None, alias='orderNumber')
    purchase_order_number: Optional[str] = Field(None, alias='purchaseOrderNumber')
    delivery_number: Optional[str] = Field(None, alias='deliveryNumber')
    sales_order_number: Optional[str] = Field(None, alias='salesOrderNumber')
    posted_by: Optional[str] = Field(None, alias='postedBy')
    transaction_code: Optional[str] = Field(None, alias='transactionCode')


@router.get("/warehouse360/overview")
async def warehouse_overview(
    warehouse_id: str,
    response: Response,
    plant_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 100,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> dict:
    """Get high-level warehouse cockpit summary metrics — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse overview requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    w_id = warehouse_id.strip() if warehouse_id else ""
    if not w_id:
        raise HTTPException(status_code=422, detail="warehouse_id cannot be empty")

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    p_id = plant_id.strip() if plant_id else None
    d_from = date_from.strip() if date_from else None
    d_to = date_to.strip() if date_to else None

    req = WarehouseOverviewRequest(
        warehouse_id=w_id,
        plant_id=p_id,
        date_from=d_from,
        date_to=d_to,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_overview(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_overview_rows(rows, req)


@router.get("/warehouse360/inbound", response_model=list[Warehouse360InboundItem])
async def warehouse_inbound(
    warehouse_id: str,
    response: Response,
    plant_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 100,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[Warehouse360InboundItem]:
    """Get inbound PO/STO details — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse inbound list requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    w_id = warehouse_id.strip() if warehouse_id else ""
    if not w_id:
        raise HTTPException(status_code=422, detail="warehouse_id cannot be empty")

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    p_id = plant_id.strip() if plant_id else None
    d_from = date_from.strip() if date_from else None
    d_to = date_to.strip() if date_to else None

    req = WarehouseInboundRequest(
        warehouse_id=w_id,
        plant_id=p_id,
        date_from=d_from,
        date_to=d_to,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_inbound(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_inbound_rows(rows)


@router.get("/warehouse360/outbound", response_model=list[Warehouse360OutboundItem])
async def warehouse_outbound(
    warehouse_id: str,
    response: Response,
    plant_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 100,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[Warehouse360OutboundItem]:
    """Get outbound delivery details — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse outbound list requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    w_id = warehouse_id.strip() if warehouse_id else ""
    if not w_id:
        raise HTTPException(status_code=422, detail="warehouse_id cannot be empty")

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    p_id = plant_id.strip() if plant_id else None
    d_from = date_from.strip() if date_from else None
    d_to = date_to.strip() if date_to else None

    req = WarehouseOutboundRequest(
        warehouse_id=w_id,
        plant_id=p_id,
        date_from=d_from,
        date_to=d_to,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_outbound(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_outbound_rows(rows)


@router.get("/warehouse360/staging", response_model=list[Warehouse360StagingItem])
async def warehouse_staging(
    warehouse_id: str,
    response: Response,
    plant_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 100,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[Warehouse360StagingItem]:
    """Get production staging details — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse staging list requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    w_id = warehouse_id.strip() if warehouse_id else ""
    if not w_id:
        raise HTTPException(status_code=422, detail="warehouse_id cannot be empty")

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    p_id = plant_id.strip() if plant_id else None
    d_from = date_from.strip() if date_from else None
    d_to = date_to.strip() if date_to else None

    req = WarehouseStagingRequest(
        warehouse_id=w_id,
        plant_id=p_id,
        date_from=d_from,
        date_to=d_to,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_staging(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_staging_rows(rows)


@router.get("/warehouse360/exceptions", response_model=list[Warehouse360ExceptionItem])
async def warehouse_exceptions(
    warehouse_id: str,
    response: Response,
    plant_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 100,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[Warehouse360ExceptionItem]:
    """Get IM/WM reconciliation exceptions — databricks-api only.

    No V1 endpoint exists for this data. Returns 503 if BACKEND_ADAPTER_MODE
    is not databricks-api. Missing OAuth → 401. Missing config → 503.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse exceptions requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    w_id = warehouse_id.strip() if warehouse_id else ""
    if not w_id:
        raise HTTPException(status_code=422, detail="warehouse_id cannot be empty")

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    p_id = plant_id.strip() if plant_id else None
    d_from = date_from.strip() if date_from else None
    d_to = date_to.strip() if date_to else None

    req = WarehouseExceptionRequest(
        warehouse_id=w_id,
        plant_id=p_id,
        date_from=d_from,
        date_to=d_to,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_exceptions(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_exceptions_rows(rows)


@router.get("/warehouse360/stock-exceptions", response_model=list[Warehouse360StockExceptionItem])
async def warehouse_stock_exceptions(
    warehouse_id: str,
    response: Response,
    plant_id: str | None = None,
    bucket: str | None = None,
    limit: int = 100,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[Warehouse360StockExceptionItem]:
    """Get stock exceptions (expiry, shelf life breach) — databricks-api only."""
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse stock exceptions requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    w_id = warehouse_id.strip() if warehouse_id else ""
    if not w_id:
        raise HTTPException(status_code=422, detail="warehouse_id cannot be empty")

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    p_id = plant_id.strip() if plant_id else None
    b_val = bucket.strip() if bucket else None

    req = WarehouseStockExceptionsRequest(
        warehouse_id=w_id,
        plant_id=p_id,
        bucket=b_val,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_stock_exceptions(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_stock_exceptions_rows(rows)


@router.get("/warehouse360/shortfalls", response_model=list[Warehouse360ShortfallItem])
async def warehouse_shortfalls(
    warehouse_id: str,
    response: Response,
    plant_id: str | None = None,
    limit: int = 100,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[Warehouse360ShortfallItem]:
    """Get material staging shortfalls — databricks-api only."""
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse shortfalls requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    w_id = warehouse_id.strip() if warehouse_id else ""
    if not w_id:
        raise HTTPException(status_code=422, detail="warehouse_id cannot be empty")

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    p_id = plant_id.strip() if plant_id else None

    req = WarehouseShortfallsRequest(
        warehouse_id=w_id,
        plant_id=p_id,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_shortfalls(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_shortfalls_rows(rows)


@router.get("/warehouse360/stock-zones", response_model=list[Warehouse360StockZoneItem])
async def warehouse_stock_zones(
    warehouse_id: str,
    response: Response,
    plant_id: str | None = None,
    limit: int = 100,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[Warehouse360StockZoneItem]:
    """Get stock zone metrics — databricks-api only."""
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse stock zones requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    w_id = warehouse_id.strip() if warehouse_id else ""
    if not w_id:
        raise HTTPException(status_code=422, detail="warehouse_id cannot be empty")

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    p_id = plant_id.strip() if plant_id else None

    req = WarehouseStockZonesRequest(
        warehouse_id=w_id,
        plant_id=p_id,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_stock_zones(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_stock_zones_rows(rows)


@router.get("/warehouse360/open-holds", response_model=list[Warehouse360OpenHoldItem])
async def warehouse_open_holds(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    limit: int = 200,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[Warehouse360OpenHoldItem]:
    """Get open stock holds (quality / blocked / restricted quants) — databricks-api only."""
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse open holds requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    req = WarehouseOpenHoldsRequest(
        plant_id=plant_id.strip() if plant_id else None,
        warehouse_id=warehouse_id.strip() if warehouse_id else None,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_open_holds(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_open_holds_rows(rows)


@router.get("/warehouse360/pick-tasks", response_model=list[Warehouse360PickTaskItem])
async def warehouse_pick_tasks(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    limit: int = 200,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[Warehouse360PickTaskItem]:
    """Get open staging pick tasks (open transfer-order items) — databricks-api only."""
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse pick tasks requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    req = WarehousePickTasksRequest(
        plant_id=plant_id.strip() if plant_id else None,
        warehouse_id=warehouse_id.strip() if warehouse_id else None,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_pick_tasks(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_pick_tasks_rows(rows)


@router.get("/warehouse360/move-requests", response_model=list[Warehouse360MoveRequestItem])
async def warehouse_move_requests(
    response: Response,
    plant_id: str | None = None,
    warehouse_id: str | None = None,
    limit: int = 200,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[Warehouse360MoveRequestItem]:
    """Get open warehouse move requests (open transfer-requirement items) — databricks-api only."""
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse move requests requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    req = WarehouseMoveRequestsRequest(
        plant_id=plant_id.strip() if plant_id else None,
        warehouse_id=warehouse_id.strip() if warehouse_id else None,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_move_requests(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_move_requests_rows(rows)


@router.get("/warehouse360/goods-movements", response_model=list[Warehouse360GoodsMovementItem])
async def warehouse_goods_movements(
    response: Response,
    plant_id: str | None = None,
    material_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 200,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[Warehouse360GoodsMovementItem]:
    """Goods-movement activity feed — databricks-api only.

    Mandatory cost controls (high-volume MSEG-grain source): the posting_date window
    defaults to yesterday..today, may never exceed GOODS_MOVEMENTS_MAX_WINDOW_DAYS,
    and limit is capped at 500. Unbounded queries are impossible by construction.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse goods movements requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")

    today = date.today()
    try:
        d_to = date.fromisoformat(date_to) if date_to else today
        d_from = date.fromisoformat(date_from) if date_from else d_to - timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="date_from/date_to must be ISO dates (YYYY-MM-DD)")

    if d_to < d_from:
        raise HTTPException(status_code=400, detail="date_to must not be before date_from")
    if (d_to - d_from).days > GOODS_MOVEMENTS_MAX_WINDOW_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"posting_date window must not exceed {GOODS_MOVEMENTS_MAX_WINDOW_DAYS} days",
        )

    req = WarehouseGoodsMovementsRequest(
        date_from=d_from.isoformat(),
        date_to=d_to.isoformat(),
        plant_id=plant_id.strip() if plant_id else None,
        material_id=material_id.strip() if material_id else None,
        limit=limit,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_goods_movements(req)
    )
    set_databricks_response_headers(response, spec)
    return map_warehouse_goods_movements_rows(rows)


@router.get("/warehouse360/batch/{batchId}/hold-status", response_model=Warehouse360BatchHoldStatus)
async def warehouse_batch_hold_status(
    batchId: str,
    response: Response,
    plant_id: str | None = None,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> Warehouse360BatchHoldStatus:
    """Get batch hold status — databricks-api only."""
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse batch hold status requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    b_id = batchId.strip() if batchId else ""
    if not b_id:
        raise HTTPException(status_code=422, detail="batchId cannot be empty")

    p_id = plant_id.strip() if plant_id else None

    req = WarehouseBatchHoldStatusRequest(
        batch_id=b_id,
        plant_id=p_id,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_batch_hold_status(req)
    )
    set_databricks_response_headers(response, spec)
    mapped = map_warehouse_batch_hold_status_rows(rows)
    if not mapped:
        raise HTTPException(status_code=404, detail=f"Batch {b_id} not found")
    return mapped[0]


@router.get("/warehouse360/staging-readiness", response_model=Warehouse360StagingReadiness)
async def warehouse_staging_readiness(
    plant_id: str,
    plan_date: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> Warehouse360StagingReadiness:
    """Get staging readiness summary — databricks-api only."""
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="Warehouse staging readiness requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    p_id = plant_id.strip() if plant_id else ""
    if not p_id:
        raise HTTPException(status_code=422, detail="plant_id cannot be empty")

    p_date = plan_date.strip() if plan_date else ""
    if not p_date:
        raise HTTPException(status_code=422, detail="plan_date cannot be empty")

    req = WarehouseStagingReadinessRequest(
        plant_id=p_id,
        plan_date=p_date,
    )

    host, db_warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, db_warehouse_id)
    wh_repo = Warehouse360Repository(repository)
    rows, spec = await run_repository_fetch(
        lambda: wh_repo.fetch_warehouse_staging_readiness(req)
    )
    set_databricks_response_headers(response, spec)
    mapped = map_warehouse_staging_readiness_rows(rows)
    if not mapped:
        return Warehouse360StagingReadiness(
            plantId=p_id,
            planDate=p_date,
            totalOrders=0,
            fullyStaged=0,
            partiallyStaged=0,
            notStaged=0,
            blocked=0
        )
    return mapped[0]
