"""Routes for the Environmental Monitoring domain.

Databricks mode only (``BACKEND_ADAPTER_MODE=databricks-api``): executes
QuerySpec definitions against Unity Catalog using the authenticated user's
OAuth token.

No V1 EnvMon backend existed for these routes — 503 is returned in any other
mode. Missing OAuth → 401. Missing config → 503. No silent fallback.

Source: gold_inspection_lot + gold_inspection_point + gold_batch_quality_result_v
Catalog: TRACE_CATALOG (default connected_plant_uat), Schema: TRACE_SCHEMA (default gold)
DDL confirmed: 2026-05-17 (n.txt)
"""
from __future__ import annotations

import os

from adapters.envmon.envmon_databricks_adapter import (
    EnvMonRepository,
    SiteSummaryRequest,
    SwabResultsRequest,
    map_site_summary_rows,
    map_swab_result_rows,
)
from contracts.generated import EnvMonNativeSwabResult, EnvMonSiteSummary
from fastapi import APIRouter, Header, HTTPException, Response

from routes._databricks import (
    build_databricks_repository,
    build_user_identity,
    require_databricks_config,
    run_repository_fetch,
    set_databricks_response_headers,
)

router = APIRouter()


@router.get("/envmon/site-summary", response_model=EnvMonSiteSummary)
async def envmon_site_summary(
    plant_id: str,
    period_start: str,
    period_end: str,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> EnvMonSiteSummary:
    """Environmental monitoring site summary KPIs — databricks-api only.

    Returns aggregate inspection results for a plant over the given period.
    Returns a default zero-value shape (not 404) when no data exists for the
    plant/period combination.

    Source views (confirmed-ddl 2026-05-17):
      gold_inspection_lot, gold_inspection_point, gold_batch_quality_result_v
      INSPECTION_TYPE IN ('14','Z14') — EnvMon domain boundary filter

    Partial coverage:
      plantName: "" — requires gold_plant JOIN not yet in SQL (PLACEHOLDER)
      openCorrectiveActions: 0 — contract compatibility only; CAPA is out of scope for EnvMon V2 parity
      overdueActions: 0 — contract compatibility only; CAPA is out of scope for EnvMon V2 parity
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="EnvMon site summary requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, warehouse_id)
    envmon_repo = EnvMonRepository(repository)
    req = SiteSummaryRequest(
        plant_id=plant_id,
        period_start=period_start,
        period_end=period_end,
    )
    rows, spec = await run_repository_fetch(lambda: envmon_repo.fetch_site_summary(req))
    set_databricks_response_headers(response, spec)
    return map_site_summary_rows(rows, plant_id)


@router.get("/envmon/swab-results", response_model=list[EnvMonNativeSwabResult])
async def envmon_swab_results(
    plant_id: str,
    period_start: str,
    period_end: str,
    response: Response,
    limit: int = 100,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> list[EnvMonNativeSwabResult]:
    """Environmental monitoring swab results — databricks-api only.

    Returns individual SAP QM inspection results per MIC characteristic per sampling
    point. Status derived from INSPECTION_RESULT_VALUATION:
    NULL/empty→pending, R/REJ/REJECT→fail, W/WARN/WARNING→warning,
    other non-empty values→pass.

    Source views (Group A SAP QM, confirmed-ddl 2026-05-17):
      gold_inspection_lot, gold_inspection_point, gold_batch_quality_result_v
      INSPECTION_TYPE IN ('14','Z14') — EnvMon domain boundary filter

    limit: default 100, clamped to [1, 500]. Not a bound parameter — embedded as literal.

    No em_* spatial joins. zoneId / hygieneZone not available from SAP QM alone.
    Contract: EnvMonNativeSwabResult — source-truthful SAP QM shape (no zone fields).
    """
    backend_mode = os.getenv("BACKEND_ADAPTER_MODE", "legacy-api")
    if backend_mode != "databricks-api":
        raise HTTPException(
            status_code=503,
            detail="EnvMon swab results requires BACKEND_ADAPTER_MODE=databricks-api",
        )

    clamped_limit = max(1, min(limit, 500))
    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(x_forwarded_access_token, x_forwarded_user, x_forwarded_email)
    repository = build_databricks_repository(identity, host, warehouse_id)
    envmon_repo = EnvMonRepository(repository)
    req = SwabResultsRequest(
        plant_id=plant_id,
        period_start=period_start,
        period_end=period_end,
        limit=clamped_limit,
    )
    rows, spec = await run_repository_fetch(lambda: envmon_repo.fetch_swab_results(req))
    set_databricks_response_headers(response, spec)
    return map_swab_result_rows(rows)
