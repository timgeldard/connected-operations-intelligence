"""
SQL executor implementations for the Databricks Statement Execution REST API
and the Databricks SQL Connector.

Includes configurable exponential-backoff polling (from SPC reference impl).
"""

__all__ = ["run_in_sql_executor", "is_connector_available"]

import asyncio
import hashlib
import json
import logging
import os
import re
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Optional, Protocol, TypeVar

try:
    from databricks import sql as databricks_sql
except ImportError:  # pragma: no cover
    databricks_sql = None

_SQL_MAX_WORKERS        = max(1, int(os.environ.get("SQL_MAX_WORKERS", "20")))
_SQL_POLL_MAX_ATTEMPTS  = max(1, int(os.environ.get("SQL_POLL_MAX_ATTEMPTS", "60")))
_SQL_POLL_INITIAL_DELAY_S = max(1, int(os.environ.get("SQL_POLL_INITIAL_DELAY_S", "2")))
_SQL_POLL_MAX_DELAY_S   = max(
    _SQL_POLL_INITIAL_DELAY_S,
    int(os.environ.get("SQL_POLL_MAX_DELAY_S", "30")),
)

_sql_executor = ThreadPoolExecutor(max_workers=_SQL_MAX_WORKERS, thread_name_prefix="sql")
_SQL_CONNECTOR_PARAM_RE = re.compile(r":([A-Za-z_][A-Za-z0-9_]*)")

logger = logging.getLogger(__name__)


class _SqlExecutor(Protocol):
    """Protocol for synchronous SQL execution backends."""

    def execute(
        self,
        token: str,
        statement: str,
        params: Optional[list[dict]] = None,
        *,
        large_result: bool = False,
    ) -> list[dict]: ...


def _sql_stmt_hash(statement: str) -> str:
    """Return a short hex hash of a SQL statement for log correlation."""
    return hashlib.sha256(statement.encode()).hexdigest()[:16]


def _warehouse_id(warehouse_http_path: str) -> str:
    """Extract the warehouse ID from the HTTP path."""
    return warehouse_http_path.rsplit("/", 1)[-1]


def _params_to_mapping(params: Optional[list[dict]]) -> dict[str, object | None]:
    """Convert a named-param list to a name→value dict."""
    return {str(p["name"]): p.get("value") for p in (params or [])}


def _normalize_statement_for_connector(
    statement: str,
    params: Optional[list[dict]] = None,
) -> tuple[str, list[object | None]]:
    """Convert named ``:param`` placeholders to positional ``?`` for the connector.

    Args:
        statement: SQL statement with ``:name`` placeholders.
        params: Named parameter list.

    Returns:
        Tuple of (normalized_statement, ordered_positional_values).

    Raises:
        RuntimeError: When a placeholder references a parameter not in ``params``.
    """
    mapping = _params_to_mapping(params)
    positional: list[object | None] = []

    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in mapping:
            raise RuntimeError(f"Missing SQL parameter '{name}' for connector execution")
        positional.append(mapping[name])
        return "?"

    normalized = _SQL_CONNECTOR_PARAM_RE.sub(replace, statement)
    return normalized, positional


class _RestStatementExecutor:
    """Execute SQL via the Databricks Statement Execution REST API."""

    def execute(
        self,
        token: str,
        statement: str,
        params: Optional[list[dict]] = None,
        *,
        hostname: str = "",
        warehouse_http_path: str = "",
        large_result: bool = False,
    ) -> list[dict]:
        """Execute a SQL statement and return rows as dicts.

        Args:
            token: Databricks access token.
            statement: SQL query string.
            params: Named parameter list.
            hostname: Override Databricks hostname (default: env var).
            warehouse_http_path: Override warehouse HTTP path (default: env var).
            large_result: When ``True``, use EXTERNAL_LINKS disposition to bypass
                the 25 MB inline result cap.

        Returns:
            List of row dicts from the SQL result set.

        Raises:
            RuntimeError: On HTTP errors, query failure, or polling timeout.
        """
        from .core import WAREHOUSE_HTTP_PATH
        from .core import hostname as _hostname
        _host = hostname or _hostname()
        _path = warehouse_http_path or WAREHOUSE_HTTP_PATH
        url = f"https://{_host}/api/2.0/sql/statements/"

        body: dict = {
            "warehouse_id": _warehouse_id(_path),
            "statement": statement,
            "wait_timeout": "50s",
        }
        if large_result:
            body["disposition"] = "EXTERNAL_LINKS"
        if params:
            body["parameters"] = params

        stmt_hash = _sql_stmt_hash(statement)
        param_count = len(params) if params else 0
        body["query_tags"] = {"stmt_hash": stmt_hash}

        auth_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        logger.info("sql.execute executor=rest hash=%s params=%d", stmt_hash, param_count)

        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=auth_headers, method="POST")
        t0 = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                result = json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            body_str = exc.read().decode() if exc.fp else ""
            raise RuntimeError(f"SQL API {exc.code} {exc.reason}: {body_str[:2000]}") from exc

        state = result.get("status", {}).get("state", "")
        statement_id = result.get("statement_id", "")
        poll_url = f"https://{_host}/api/2.0/sql/statements/{statement_id}"

        poll_delay_s = _SQL_POLL_INITIAL_DELAY_S
        for _ in range(_SQL_POLL_MAX_ATTEMPTS):
            if state in ("SUCCEEDED", "FAILED", "CANCELED", "CLOSED"):
                break
            time.sleep(poll_delay_s)
            poll_req = urllib.request.Request(poll_url, headers=auth_headers)
            try:
                with urllib.request.urlopen(poll_req, timeout=30) as poll_resp:
                    result = json.loads(poll_resp.read().decode())
                    state = result.get("status", {}).get("state", "")
            except urllib.error.HTTPError as exc:
                body_str = exc.read().decode() if exc.fp else ""
                raise RuntimeError(f"SQL poll {exc.code}: {body_str[:1000]}") from exc
            poll_delay_s = min(_SQL_POLL_MAX_DELAY_S, poll_delay_s * 2)

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        if state != "SUCCEEDED":
            error_info = result.get("status", {}).get("error", {})
            msg = error_info.get("message", f"Query ended with state: {state}")
            logger.warning("sql.failed hash=%s state=%s duration_ms=%d", stmt_hash, state, elapsed_ms)
            raise RuntimeError(msg)

        columns = [c["name"] for c in result["manifest"]["schema"]["columns"]]
        all_rows: list[dict] = []
        chunk = result.get("result", {})
        while True:
            if large_result:
                for link_obj in chunk.get("external_links", []):
                    link_url = link_obj.get("external_link", "")
                    if not link_url:
                        continue
                    # Pre-signed URLs carry auth in query string — must NOT send Authorization header.
                    link_req = urllib.request.Request(link_url)
                    try:
                        with urllib.request.urlopen(link_req, timeout=60) as link_resp:
                            row_arrays = json.loads(link_resp.read().decode())
                    except urllib.error.HTTPError as exc:
                        body_str = exc.read().decode() if exc.fp else ""
                        raise RuntimeError(f"SQL external link fetch {exc.code}: {body_str[:1000]}") from exc
                    for row_data in row_arrays:
                        all_rows.append(dict(zip(columns, row_data)))
            else:
                for row_data in chunk.get("data_array", []):
                    all_rows.append(dict(zip(columns, row_data)))
            next_chunk_index = chunk.get("next_chunk_index")
            if next_chunk_index is None:
                break
            chunk_url = f"{poll_url}/result/chunks/{next_chunk_index}"
            chunk_req = urllib.request.Request(chunk_url, headers=auth_headers)
            try:
                with urllib.request.urlopen(chunk_req, timeout=60) as chunk_resp:
                    chunk = json.loads(chunk_resp.read().decode())
            except urllib.error.HTTPError as exc:
                body_str = exc.read().decode() if exc.fp else ""
                raise RuntimeError(f"SQL chunk fetch {exc.code}: {body_str[:1000]}") from exc

        logger.info("sql.done hash=%s rows=%d duration_ms=%d", stmt_hash, len(all_rows), elapsed_ms)
        return all_rows


class _ConnectorStatementExecutor:
    """Execute SQL via the Databricks SQL Connector (ODBC-style)."""

    def execute(
        self,
        token: str,
        statement: str,
        params: Optional[list[dict]] = None,
        *,
        hostname: str = "",
        warehouse_http_path: str = "",
        large_result: bool = False,
    ) -> list[dict]:
        """Execute a SQL statement via the connector and return rows as dicts.

        Args:
            token: Databricks access token.
            statement: SQL query string with ``:name`` placeholders.
            params: Named parameter list.
            hostname: Override Databricks hostname (default: env var).
            warehouse_http_path: Override warehouse HTTP path (default: env var).
            large_result: Ignored for the connector executor (included for API
                compatibility with :class:`_RestStatementExecutor`).

        Returns:
            List of row dicts from the SQL result set.

        Raises:
            RuntimeError: When the connector is not installed or query fails.
        """
        if databricks_sql is None:
            raise RuntimeError("databricks-sql-connector is not installed")

        from .core import WAREHOUSE_HTTP_PATH
        from .core import hostname as _hostname
        _host = hostname or _hostname()
        _path = warehouse_http_path or WAREHOUSE_HTTP_PATH

        normalized_statement, positional_params = _normalize_statement_for_connector(statement, params)
        stmt_hash = _sql_stmt_hash(statement)
        logger.info("sql.execute executor=connector hash=%s params=%d", stmt_hash, len(positional_params))
        t0 = time.monotonic()

        try:
            with databricks_sql.connect(
                server_hostname=_host,
                http_path=_path,
                access_token=token,
            ) as connection:
                with connection.cursor() as cursor:
                    if positional_params:
                        cursor.execute(normalized_statement, positional_params)
                    else:
                        cursor.execute(normalized_statement)
                    description = cursor.description or []
                    columns = [col[0] for col in description]
                    raw_rows = cursor.fetchall() or []
        except Exception as exc:
            raise RuntimeError(str(exc)) from exc

        rows = [
            dict(r) if isinstance(r, dict) else dict(zip(columns, list(r)))
            for r in raw_rows
        ]
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        logger.info("sql.done executor=connector hash=%s rows=%d duration_ms=%d", stmt_hash, len(rows), elapsed_ms)
        return rows


_REST_EXECUTOR: _SqlExecutor = _RestStatementExecutor()
_CONNECTOR_EXECUTOR: _SqlExecutor = _ConnectorStatementExecutor()

_T = TypeVar("_T")


def is_connector_available() -> bool:
    """Return True if the Databricks SQL Connector package is installed.

    Use this instead of importing ``databricks`` directly when you need to
    decide at runtime whether to prefer the connector executor over the REST
    executor.  Apps that check this function never need a direct ``databricks``
    import, keeping the importlinter contract satisfied.
    """
    return databricks_sql is not None


async def run_in_sql_executor(fn: Callable[[], _T]) -> _T:
    """Run a zero-argument blocking callable on the shared SQL thread pool.

    Use this instead of importing the private ``_sql_executor`` directly.
    Callers should wrap arguments in a lambda or ``functools.partial``::

        result = await run_in_sql_executor(lambda: some_blocking_func(arg1, arg2))

    Args:
        fn: A zero-argument callable that performs blocking I/O.

    Returns:
        The return value of ``fn``.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_sql_executor, fn)
