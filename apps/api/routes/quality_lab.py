"""Routes for the Connected Quality Lab Board — governed data path.

Databricks-api only (``BACKEND_ADAPTER_MODE=databricks-api``): executes SQL against the
governed ``vw_consumption_quality_lab_fails`` view using the authenticated user's OAuth
token (RLS via the *_secured layer). Missing OAuth → HTTP 401. Missing config → HTTP 503.
No mock or legacy fallback — this is the governed replacement for the V1 proxy.

Replaces apps/api/routes/connected_quality_lab.py (V1 proxy + legacy-api path).
Registration in main.py: include_router(quality_lab_router, prefix="/api").
The route path /cq/lab/fails is PRESERVED for frontend compatibility.
"""
from __future__ import annotations

import os
from typing import Optional

from adapters.quality_lab.quality_lab_databricks_adapter import QualityLabRepository
from fastapi import APIRouter, Header, HTTPException, Response

from routes._databricks import (
    build_databricks_repository,
    build_user_identity,
    require_databricks_config,
    run_repository_fetch,
    set_databricks_response_headers,
)

router = APIRouter()


def _require_databricks_mode() -> None:
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail=(
                "Quality Lab Board requires BACKEND_ADAPTER_MODE=databricks-api. "
                "The V1 legacy-api proxy has been removed. "
                "Set BACKEND_ADAPTER_MODE=databricks-api and configure QUALITY_LAB_CATALOG "
                "(or WH360_CATALOG) and QUALITY_LAB_SCHEMA (default: gold_io_reporting)."
            ),
        )


def _build_repository(
    x_forwarded_access_token: Optional[str],
    x_forwarded_user: Optional[str],
    x_forwarded_email: Optional[str],
) -> QualityLabRepository:
    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, warehouse_id)
    return QualityLabRepository(repository)


@router.get("/cq/lab/fails")
async def lab_fails(
    response: Response,
    plant_id: Optional[str] = None,
    lot_type: Optional[str] = None,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    x_forwarded_user: Optional[str] = Header(default=None),
    x_forwarded_email: Optional[str] = Header(default=None),
) -> dict:
    """Lab Board failed/warned inspection results — governed gold path, databricks-api only.

    Returns ConnectedQualityLabFailuresResponse with the V1 FailSpec field names preserved
    (mat, matNo, lot, batch, line, char, text, res, lo, hi, units, sev, ts, lotType).

    sev is 'fail' (outside spec) or 'warn' (within warning band) from the gold layer —
    replaces the V1 Databricks path which hardcoded sev='fail'.

    Query params:
      plant_id  — restrict to one plant (optional)
      lot_type  — '89' (FP) or '04' (RM) (optional)
    """
    _require_databricks_mode()

    repo = _build_repository(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    result, spec = await run_repository_fetch(
        lambda: repo.fetch_lab_fails(
            plant_id.strip() if plant_id else None,
            lot_type.strip() if lot_type else None,
        )
    )
    set_databricks_response_headers(response, spec)
    if plant_id:
        result["plantId"] = plant_id.strip()
    if lot_type:
        result["lotType"] = lot_type.strip()
    return result
