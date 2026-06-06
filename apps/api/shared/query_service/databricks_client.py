"""Databricks query client — ADR-025.

Implements the Statement API path chosen in ADR-025. The executing user's OAuth
token is passed explicitly; there is no service-principal fallback.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx

from .errors import (
    DatabricksAuthRequiredError,
    DatabricksPermissionError,
    DatabricksQueryError,
    DatabricksQueryTimeoutError,
    DatabricksRateLimitError,
    DatabricksWarehouseConfigError,
)

_log = logging.getLogger(__name__)


def _infer_param_type(value: object) -> str:
    """Map a Python value to a Databricks Statement API parameter type string.

    Raises ValueError for None — callers must either filter None params before
    calling execute() or provide explicit fallback values. Passing None would
    produce the string literal "None" in SQL which is never correct.
    """
    if value is None:
        raise ValueError(
            "None is not a valid Statement API parameter value. "
            "Filter or replace None before building the params dict."
        )
    if isinstance(value, bool):
        return "BOOLEAN"
    if isinstance(value, int):
        return "INT"
    if isinstance(value, float):
        return "DOUBLE"
    return "STRING"


class DatabricksQueryClient(ABC):
    """Abstract interface for executing a parameterised SQL statement on Databricks.

    All implementations must accept an explicit ``oauth_token`` — no service-
    principal token, no PAT fallback, no environment-variable fallback.
    """

    @abstractmethod
    async def execute(
        self,
        *,
        sql: str,
        params: dict[str, object],
        oauth_token: str,
        warehouse_id: str,
        timeout_seconds: int,
        tags: dict[str, str],
    ) -> list[dict[str, object]]:
        """Execute ``sql`` and return rows as a list of column-name → value dicts."""


class NotImplementedDatabricksClient(DatabricksQueryClient):
    """Placeholder used when no real client has been injected.

    Replace with ``StatementApiDatabricksClient`` — see ADR-025.
    """

    async def execute(
        self,
        *,
        sql: str,
        params: dict[str, object],
        oauth_token: str,
        warehouse_id: str,
        timeout_seconds: int,
        tags: dict[str, str],
    ) -> list[dict[str, object]]:
        raise NotImplementedError(
            "Databricks client not implemented. "
            "Use StatementApiDatabricksClient. See ADR-025."
        )


def _normalize_host(host: str) -> str:
    """Normalize a Databricks host for client-pool keys and request URLs."""
    h = host.strip()
    for scheme in ("https://", "http://"):
        if h.lower().startswith(scheme):
            h = h[len(scheme):]
    return h.rstrip("/")


class DatabricksHttpClientPool:
    """App-lifecycle-owned pool of reusable Databricks HTTP clients.

    The key is deliberately bounded to normalized Databricks host and Statement
    API timeout. OAuth tokens are passed per request, never stored in clients.
    """

    def __init__(self) -> None:
        self._clients: dict[tuple[str, int], httpx.AsyncClient] = {}

    def get_client(self, *, host: str, timeout_seconds: int) -> httpx.AsyncClient:
        key = (_normalize_host(host), timeout_seconds)
        client = self._clients.get(key)
        if client is None or getattr(client, "is_closed", False) is True:
            client = httpx.AsyncClient(timeout=timeout_seconds + 10)
            self._clients[key] = client
        return client

    async def aclose(self) -> None:
        clients = list(self._clients.values())
        self._clients.clear()
        for client in clients:
            await client.aclose()


databricks_http_client_pool = DatabricksHttpClientPool()


class StatementApiDatabricksClient(DatabricksQueryClient):
    """Executes SQL via the Databricks SQL Statement API (ADR-025).

    Uses the caller's OAuth bearer token — no service-principal fallback.

    The Statement API is called with::

        POST https://{host}/api/2.0/sql/statements
        Authorization: Bearer {oauth_token}

    ``wait_timeout`` is set to ``{timeout_seconds}s`` so Databricks waits
    synchronously for the result. If the query does not complete in time,
    Databricks cancels it and returns state ``CANCELED`` — mapped to
    ``DatabricksQueryTimeoutError``.

    Query tags are not natively supported by the Statement API; they are
    included in structured log output for observability.
    """

    def __init__(self, host: str, pool: DatabricksHttpClientPool | None = None) -> None:
        # Strip scheme (https:// or http://) if present, then whitespace and
        # trailing slashes. Prevents double-scheme URLs like
        # https://https://... when DATABRICKS_HOST includes the prefix. The URL
        # is reconstructed with explicit https:// in execute().
        self._host = _normalize_host(host)
        self._pool = pool or databricks_http_client_pool

    def _get_client(self, timeout_seconds: int) -> httpx.AsyncClient:
        return self._pool.get_client(host=self._host, timeout_seconds=timeout_seconds)

    @classmethod
    async def aclose_shared_clients(cls) -> None:
        await databricks_http_client_pool.aclose()

    async def execute(
        self,
        *,
        sql: str,
        params: dict[str, object],
        oauth_token: str,
        warehouse_id: str,
        timeout_seconds: int,
        tags: dict[str, str],
    ) -> list[dict[str, object]]:
        query_name = tags.get("query_name", "unknown")

        parameters = [
            {"name": k, "value": str(v), "type": _infer_param_type(v)}
            for k, v in params.items()
        ]

        body: dict[str, Any] = {
            "warehouse_id": warehouse_id,
            "statement": sql,
            "wait_timeout": f"{timeout_seconds}s",
            "on_wait_timeout": "CANCEL",
            "disposition": "INLINE",
            "format": "JSON_ARRAY",
        }
        if parameters:
            body["parameters"] = parameters

        headers = {
            "Authorization": f"Bearer {oauth_token}",
            "Content-Type": "application/json",
        }

        _log.info(
            "Executing Databricks statement",
            extra={"query_name": query_name, "warehouse_id": warehouse_id, "tags": tags},
        )

        url = f"https://{self._host}/api/2.0/sql/statements"

        try:
            response = await self._get_client(timeout_seconds).post(url, headers=headers, json=body)
        except httpx.TimeoutException as exc:
            raise DatabricksQueryTimeoutError(query_name) from exc
        except httpx.HTTPError as exc:
            raise DatabricksQueryError(query_name, f"HTTP transport error: {exc}") from exc

        if response.status_code == 401:
            raise DatabricksAuthRequiredError(tags.get("user_id", "unknown"))

        if response.status_code == 403:
            raise DatabricksPermissionError(query_name)

        if response.status_code == 404:
            raise DatabricksWarehouseConfigError(warehouse_id)

        if response.status_code == 429:
            raise DatabricksRateLimitError(query_name)

        if not response.is_success:
            raise DatabricksQueryError(
                query_name,
                f"Statement API returned HTTP {response.status_code}: {response.text[:200]}",
            )

        data: dict[str, Any] = response.json()
        state: str = data.get("status", {}).get("state", "")

        if state == "SUCCEEDED":
            return _parse_result(data, query_name)
        if state in ("CANCELED", "CLOSED"):
            raise DatabricksQueryTimeoutError(query_name)
        if state == "FAILED":
            error = data.get("status", {}).get("error", {})
            raise DatabricksQueryError(query_name, error.get("message", "Query failed"))
        # RUNNING/PENDING should not occur with wait_timeout set — treat as unexpected
        raise DatabricksQueryError(query_name, f"Unexpected statement state: {state!r}")


def _parse_result(data: dict[str, Any], query_name: str) -> list[dict[str, object]]:
    """Convert Statement API inline result to list[dict] keyed by column name."""
    try:
        columns: list[str] = [
            col["name"] for col in data["manifest"]["schema"]["columns"]
        ]
        rows_raw: list[list[object]] = data.get("result", {}).get("data_array") or []
        return [dict(zip(columns, row)) for row in rows_raw]
    except (KeyError, TypeError) as exc:
        raise DatabricksQueryError(query_name, f"Invalid result structure: {exc}") from exc
