"""Routes for the Connected Quality Lab domain.

Default mode (``BACKEND_ADAPTER_MODE=legacy-api``): forwards requests to the
V1 CQ backend.

Databricks mode (``BACKEND_ADAPTER_MODE=databricks-api``): both endpoints
execute SQL directly against Unity Catalog using the user's OAuth token.
Missing OAuth in databricks-api mode → HTTP 401. Missing config → HTTP 503.
No silent fallback.

Known limitations of the Databricks path for /cq/lab/fails:
  - sev is always 'fail' (warn not yet distinguishable from available views)
  - line, batch, lo, hi may be absent (source columns are nullable)
"""
from __future__ import annotations

import os

import httpx
from adapters.cq.cq_databricks_adapter import CqLabRepository
from fastapi import APIRouter, Header, HTTPException, Response
from shared.proxy_client import get_proxy_client

from routes._databricks import (
    build_databricks_repository,
    build_user_identity,
    require_databricks_config,
    run_repository_fetch,
    set_databricks_response_headers,
)

router = APIRouter()

_V1_CQ_BASE_URL = os.getenv("V1_CQ_API_BASE_URL", "")


async def _forward_get(v1_path: str, params: dict, token: str | None) -> dict:
    if not _V1_CQ_BASE_URL:
        raise HTTPException(status_code=503, detail="V1_CQ_API_BASE_URL is not configured")

    headers: dict[str, str] = {}
    if token:
        headers["x-forwarded-access-token"] = token

    try:
        client = get_proxy_client()
        response = await client.get(
            f"{_V1_CQ_BASE_URL}{v1_path}", params=params, headers=headers
        )
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise HTTPException(status_code=502, detail=f"Upstream unreachable: {exc}") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Upstream returned 401 Unauthorized")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Upstream returned 404 Not Found")
    if not response.is_success:
        raise HTTPException(status_code=502, detail=f"Upstream returned {response.status_code}")

    return response.json()


@router.get("/cq/lab/fails")
async def lab_fails(
    response: Response,
    plant_id: str | None = None,
    lot_type: str | None = None,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """Lab fails — supports legacy-api and databricks-api modes."""
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")

    if backend_mode == "databricks-api":
        return await _lab_fails_databricks(
            response, plant_id, lot_type,
            x_forwarded_access_token, x_forwarded_user, x_forwarded_email,
        )

    params: dict[str, str] = {}
    if plant_id:
        params["plant_id"] = plant_id
    if lot_type:
        params["lot_type"] = lot_type
    return await _forward_get("/api/cq/lab/fails", params, x_forwarded_access_token)


async def _lab_fails_databricks(
    response: Response,
    plant_id: str | None,
    lot_type: str | None,
    token: str | None,
    user: str | None,
    email: str | None,
) -> dict:
    databricks_host, warehouse_id = require_databricks_config()
    identity = build_user_identity(token, user, email)
    repository = build_databricks_repository(identity, databricks_host, warehouse_id)
    cq_repo = CqLabRepository(repository)
    result, spec = await run_repository_fetch(
        lambda: cq_repo.fetch_lab_fails(plant_id, lot_type)
    )
    set_databricks_response_headers(response, spec)
    if plant_id:
        result["plantId"] = plant_id
    if lot_type:
        result["lotType"] = lot_type
    return result


@router.get("/cq/lab/plants")
async def lab_plants(
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
):
    """Lab plants list — supports legacy-api and databricks-api modes.

    ``BACKEND_ADAPTER_MODE=databricks-api`` queries gold_plant directly.
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")

    if backend_mode == "databricks-api":
        return await _lab_plants_databricks(
            response, x_forwarded_access_token, x_forwarded_user, x_forwarded_email
        )

    return await _forward_get("/api/cq/lab/plants", {}, x_forwarded_access_token)


async def _lab_plants_databricks(
    response: Response,
    token: str | None,
    user: str | None,
    email: str | None,
) -> dict:
    databricks_host, warehouse_id = require_databricks_config()
    identity = build_user_identity(token, user, email)
    repository = build_databricks_repository(identity, databricks_host, warehouse_id)
    cq_repo = CqLabRepository(repository)
    result, spec = await run_repository_fetch(cq_repo.fetch_lab_plants)
    set_databricks_response_headers(response, spec)
    return result

