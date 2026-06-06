"""Shared helpers for databricks-api route handlers.

Extracted here to avoid duplicating config checks and response-header logic
across the POH and CQ Lab routes. Keep this module minimal — do not add
business logic or SQL here.
"""
from __future__ import annotations

import logging
import os
from collections.abc import Awaitable, Callable
from typing import TypeVar

from fastapi import HTTPException, Response
from shared.query_service.catalog_policy import assert_allowed_catalog_target
from shared.query_service.databricks_client import StatementApiDatabricksClient
from shared.query_service.errors import (
    DatabricksAuthRequiredError,
    DatabricksCatalogTargetError,
    DatabricksConfigError,
    DatabricksPermissionError,
    DatabricksQueryError,
    DatabricksQueryTimeoutError,
    DatabricksRateLimitError,
    DatabricksWarehouseConfigError,
)
from shared.query_service.identity import UserIdentity
from shared.query_service.query_executor import DatabricksRepository, QueryExecutor
from shared.query_service.query_spec import QuerySpec

_logger = logging.getLogger("connectio.databricks_routes")

T = TypeVar("T")

_MISSING_CONFIG_DETAIL = (
    "DATABRICKS_HOST and SQL_WAREHOUSE_ID must be configured "
    "for BACKEND_ADAPTER_MODE=databricks-api"
)


def require_databricks_config() -> tuple[str, str]:
    """Return ``(databricks_host, warehouse_id)`` or raise HTTP 503.

    Reads ``DATABRICKS_HOST`` and ``SQL_WAREHOUSE_ID`` at call time so
    ``monkeypatch`` works correctly in tests.
    """
    host = os.getenv("DATABRICKS_HOST", "")
    warehouse_id = os.getenv("SQL_WAREHOUSE_ID", "")
    if not host or not warehouse_id:
        raise HTTPException(status_code=503, detail=_MISSING_CONFIG_DETAIL)
    return host, warehouse_id


def set_databricks_response_headers(response: Response, spec: QuerySpec) -> None:
    """Set standard observability headers on a successful databricks-api response."""
    response.headers["X-Data-Source"] = spec.source_badge
    response.headers["X-Adapter-Mode"] = "databricks-api"
    response.headers["X-Query-Name"] = spec.name
    if spec.cache_status:
        response.headers["X-Cache-Status"] = spec.cache_status
    if spec.cache_age_seconds is not None:
        response.headers["X-Cache-Age-Seconds"] = str(spec.cache_age_seconds)
    if spec.cache_ttl_seconds is not None:
        response.headers["X-Cache-TTL-Seconds"] = str(spec.cache_ttl_seconds)
    if spec.cache_policy:
        response.headers["X-Data-Freshness-Policy"] = spec.cache_policy.value
    if spec.contract_id:
        response.headers["X-Contract-Id"] = spec.contract_id



def build_user_identity(
    token: str | None, user: str | None, email: str | None, catalog_target: str | None = None
) -> UserIdentity:
    """Construct a UserIdentity from forwarded OAuth headers."""
    try:
        validated_catalog = assert_allowed_catalog_target(catalog_target)
    except DatabricksCatalogTargetError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UserIdentity(
        user_id=user or "unknown",
        email=email,
        raw_oauth_token=token,
        catalog_target=validated_catalog,
    )


def build_databricks_repository(
    identity: UserIdentity,
    databricks_host: str,
    warehouse_id: str,
) -> DatabricksRepository:
    """Build the shared DatabricksRepository for a request-scoped identity."""
    client = StatementApiDatabricksClient(host=databricks_host)
    executor = QueryExecutor(client=client, warehouse_id=warehouse_id)
    return DatabricksRepository(executor=executor, identity=identity)


async def run_repository_fetch(
    fetcher: Callable[[], Awaitable[tuple[T, QuerySpec]]],
) -> tuple[T, QuerySpec]:
    """Run a repository fetch and translate standard Databricks errors."""
    try:
        return await fetcher()
    except DatabricksCatalogTargetError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DatabricksConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DatabricksAuthRequiredError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DatabricksPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except DatabricksWarehouseConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DatabricksRateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except DatabricksQueryTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except DatabricksQueryError as exc:
        # Log the actual SQL error server-side so operators can diagnose UAT
        # blockers (missing columns, missing views). The client response stays
        # generic to avoid leaking SQL internals.
        _logger.error(
            "Databricks query %r failed: %s",
            getattr(exc, "query_name", "?"),
            getattr(exc, "detail", str(exc)),
        )
        raise HTTPException(status_code=502, detail="Databricks query execution failed") from exc


async def run_query(
    spec_factory: Callable[[], QuerySpec],
    identity: UserIdentity,
    databricks_host: str,
    warehouse_id: str,
) -> tuple[list[dict], QuerySpec]:
    """Create a QuerySpec, execute it, and translate errors into HTTP exceptions.

    Accepts a zero-argument factory so that spec-creation errors (e.g.
    DatabricksConfigError from a missing catalog env var) are caught alongside
    execution errors and mapped to the appropriate HTTP status code.

    Returns (rows, spec) so the caller can set response headers from the spec.
    """
    repository = build_databricks_repository(identity, databricks_host, warehouse_id)

    async def fetch_rows() -> tuple[list[dict], QuerySpec]:
        # We pass a simple lambda for the mapper since legacy route handlers
        # still map the rows themselves.
        return await repository.fetch(
            spec_factory=spec_factory,
            mapper=lambda r: r
        )

    return await run_repository_fetch(fetch_rows)
