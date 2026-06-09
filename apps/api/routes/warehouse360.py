"""Routes for the Warehouse 360 domain.

Databricks mode (``BACKEND_ADAPTER_MODE=databricks-api``): executes SQL directly
against Unity Catalog using the authenticated user's OAuth token. Requires
``DATABRICKS_HOST`` and ``SQL_WAREHOUSE_ID`` to be set. Missing OAuth → HTTP 401.
Missing config → HTTP 503. No silent fallback to legacy-api or mock.
"""
from __future__ import annotations

import os
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
    map_warehouse_exceptions_rows,
    map_warehouse_inbound_rows,
    map_warehouse_outbound_rows,
    map_warehouse_overview_rows,
    map_warehouse_staging_rows,
    map_warehouse_stock_exceptions_rows,
    map_warehouse_shortfalls_rows,
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
