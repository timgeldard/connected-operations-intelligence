"""Authorized plant scope — shared cross-app plant discovery via Unity Catalog.

The current implementation queries ``gold_plant`` with the calling user's token.
Unity Catalog's token-passthrough model means the SQL warehouse executes the query
as that user; if row-level security is applied to ``gold_plant`` the result is
already scoped to what that user can see.

TODO: Request a dedicated ``authorized_scope_v`` view from UC Admin.
      That view should use ``is_account_group_member(CONCAT('plant-', LOWER(plant_id),
      '-read'))`` so authorization is enforced by Databricks account group membership
      (synced from Azure AD) rather than inferred from data visibility in gold_plant.
      Once the view exists, replace the query below with:
          SELECT plant_id FROM {catalog}.{schema}.authorized_scope_v
      and remove the gold_plant dependency.
"""
from __future__ import annotations

__all__ = ["fetch_authorized_plants", "assert_plant_authorized"]

import logging
import re

from fastapi import HTTPException

from shared_db.core import TRACE_CATALOG, TRACE_SCHEMA, run_sql_async

_IDENTIFIER_RE = re.compile(r"^[A-Za-z0-9_\-]+$")

logger = logging.getLogger(__name__)


async def fetch_authorized_plants(
    token: str,
    *,
    catalog: str | None = None,
    schema: str | None = None,
) -> list[str]:
    """Return plant IDs the current user is authorized to see.

    Executes ``SELECT DISTINCT PLANT_ID FROM gold_plant`` using the caller's
    token so Unity Catalog enforces access.  An empty list means the user has
    no visible plants; callers should surface this as an appropriate UX state
    (e.g. empty plant picker) rather than raising an error.

    Args:
        token: Databricks access token forwarded from the Databricks Apps proxy.
        catalog: Unity Catalog catalog name. Defaults to ``TRACE_CATALOG`` env var.
        schema: Unity Catalog schema name. Defaults to ``TRACE_SCHEMA`` env var.

    Returns:
        Sorted list of PLANT_ID strings the calling user can access.
    """
    cat = catalog or TRACE_CATALOG
    sch = schema or TRACE_SCHEMA
    if not _IDENTIFIER_RE.match(cat):
        raise ValueError(f"Invalid catalog identifier: {cat!r}")
    if not _IDENTIFIER_RE.match(sch):
        raise ValueError(f"Invalid schema identifier: {sch!r}")
    sql = f"SELECT DISTINCT PLANT_ID FROM `{cat}`.`{sch}`.`gold_plant` ORDER BY PLANT_ID"
    rows = await run_sql_async(token, sql, endpoint_hint="shared.authorized_scope")
    plants = sorted(str(r["PLANT_ID"]) for r in rows if r.get("PLANT_ID"))
    logger.debug("authorized_scope: user has %d plant(s)", len(plants))
    return plants


async def assert_plant_authorized(token: str, plant_id: str | None) -> None:
    """Raise HTTP 403 if plant_id is not in the caller's authorized scope.

    No-op when plant_id is None (global scope — results are already filtered
    by the SQL WHERE clause in each DAL query).

    Args:
        token: Databricks access token.
        plant_id: Plant identifier to check, or ``None`` for global scope.

    Raises:
        :class:`~fastapi.HTTPException`: HTTP 403 when the plant is not accessible.
    """
    if plant_id is None:
        return
    authorized = await fetch_authorized_plants(token)
    if plant_id not in authorized:
        raise HTTPException(
            status_code=403,
            detail=f"Plant '{plant_id}' is not in your authorized scope.",
        )
