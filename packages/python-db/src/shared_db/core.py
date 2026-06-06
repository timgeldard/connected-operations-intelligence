"""
Core Databricks SQL utilities shared across all ConnectIO V2 backends.

Exports: run_sql, resolve_token, check_warehouse_config, tbl, sql_param,
         hostname, DATABRICKS_HOST, WAREHOUSE_HTTP_PATH, TRACE_CATALOG,
         TRACE_SCHEMA
"""

from __future__ import annotations

__all__ = [
    "DATABRICKS_HOST",
    "WAREHOUSE_HTTP_PATH",
    "TRACE_CATALOG",
    "TRACE_SCHEMA",
    "hostname",
    "tbl",
    "silver_tbl",
    "check_warehouse_config",
    "resolve_token",
    "sql_param",
    "build_in_params",
    "run_sql_in",
    "run_sql",
    "run_sql_async",
    "run_sql_large",
    "run_sql_large_async",
]

import asyncio
import hashlib
import json
import logging
import os
import threading
import time
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from .runtime import CacheTier

from shared_db.errors import WarehouseNotConfiguredError

try:
    from cachetools import TTLCache as _CachetoolsTTLCache  # type: ignore[import-untyped]
except ImportError:  # pragma: no cover
    class _FallbackTTLCache(dict):
        def __init__(self, maxsize: int, ttl: int):
            super().__init__()
            self.maxsize = maxsize
            self.ttl = ttl
            self._expires: dict[str, float] = {}

        def get(self, key, default=None):
            expires_at = self._expires.get(key)
            if expires_at is not None and expires_at <= time.monotonic():
                self.pop(key, None)
                self._expires.pop(key, None)
                return default
            return super().get(key, default)

        def __setitem__(self, key, value):
            if key not in self and len(self) >= self.maxsize:
                oldest_key = min(self._expires, key=self._expires.get, default=None)
                if oldest_key is not None:
                    self.pop(oldest_key, None)
                    self._expires.pop(oldest_key, None)
            super().__setitem__(key, value)
            self._expires[key] = time.monotonic() + self.ttl
    TTLCache: Any = _FallbackTTLCache
else:
    TTLCache = _CachetoolsTTLCache

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration — read once at import from environment
# ---------------------------------------------------------------------------
DATABRICKS_HOST:    str = os.environ.get("DATABRICKS_HOST", "")
WAREHOUSE_HTTP_PATH: str = os.environ.get("DATABRICKS_WAREHOUSE_HTTP_PATH", "")
TRACE_CATALOG:      str = os.environ.get("TRACE_CATALOG", "")
TRACE_SCHEMA:       str = os.environ.get("TRACE_SCHEMA", "gold")


def hostname() -> str:
    """Return the bare Databricks workspace hostname (no scheme, no trailing slash)."""
    return DATABRICKS_HOST.removeprefix("https://").removeprefix("http://").rstrip("/")


def tbl(name: str) -> str:
    """Return a fully-qualified backtick-quoted gold-layer table reference.

    Uses ``TRACE_CATALOG`` and ``TRACE_SCHEMA`` from the environment.
    This is the only sanctioned way to render a table reference in SQL strings.

    Args:
        name: Unqualified view or table name (e.g. ``"gold_material"``).

    Returns:
        Backtick-quoted three-part reference like
        `` `catalog`.`gold`.`gold_material` ``.
    """
    return f"`{TRACE_CATALOG}`.`{TRACE_SCHEMA}`.`{name}`"


def silver_tbl(name: str) -> str:
    """Return a fully-qualified backtick-quoted silver-layer table reference.

    Uses ``TRACE_CATALOG`` from the environment and the ``silver`` schema.
    Use this for silver-layer staging views in the semantic-model governance
    tests and in DALs that explicitly need silver data.

    Args:
        name: Unqualified view or table name (e.g. ``"silver_material"``).

    Returns:
        Backtick-quoted three-part reference like
        `` `catalog`.`silver`.`silver_material` ``.
    """
    return f"`{TRACE_CATALOG}`.`silver`.`{name}`"


def check_warehouse_config() -> str:
    """Raise WarehouseNotConfiguredError if DATABRICKS_WAREHOUSE_HTTP_PATH is not set."""
    if not WAREHOUSE_HTTP_PATH:
        raise WarehouseNotConfiguredError(
            "DATABRICKS_WAREHOUSE_HTTP_PATH environment variable is not set."
        )
    return WAREHOUSE_HTTP_PATH


def resolve_token(
    x_forwarded_access_token: Optional[str],
    authorization: Optional[str],
) -> str:
    """Resolve the Databricks access token from request headers.

    Priority order: ``x-forwarded-access-token`` (Databricks Apps proxy),
    then ``Authorization: Bearer <token>``.

    Service-principal PAT fallback via environment variable is intentionally
    absent. User-facing reads must always use the end-user OAuth identity.

    Args:
        x_forwarded_access_token: Value of the ``x-forwarded-access-token``
            header injected by the Databricks Apps reverse proxy.
        authorization: Value of the ``Authorization`` header (``Bearer <token>``
            format).

    Returns:
        Resolved access token string.

    Raises:
        ValueError: When no token can be found from any source.
    """
    if x_forwarded_access_token:
        return x_forwarded_access_token
    if authorization:
        if authorization.startswith("Bearer "):
            return authorization[len("Bearer "):]
        return authorization
    raise ValueError(
        "No Databricks access token found. "
        "Expected x-forwarded-access-token header or Authorization: Bearer <token> header."
    )


def sql_param(name: str, value: Optional[object]) -> dict:
    """Build a typed named parameter dict for the Databricks SQL Statement API.

    Type is inferred from the Python type: bool→BOOLEAN, int→INT, float→DOUBLE,
    everything else→STRING. The API always expects ``value`` as a string.

    Args:
        name: Parameter name (without the leading colon).
        value: Parameter value, or ``None`` for a NULL bind.

    Returns:
        Dict with ``name``, ``value``, and ``type`` keys.
    """
    if value is None:
        return {"name": name, "value": None, "type": "STRING"}
    if isinstance(value, bool):
        db_type = "BOOLEAN"
    elif isinstance(value, int):
        db_type = "INT"
    elif isinstance(value, float):
        db_type = "DOUBLE"
    else:
        db_type = "STRING"
    return {"name": name, "value": str(value), "type": db_type}


def build_in_params(
    values: list[object],
    *,
    prefix: str = "p",
) -> tuple[str, list[dict]]:
    """Build a typed parameter list for a SQL ``IN`` predicate.

    This is the low-level primitive used by :func:`run_sql_in`. Call it
    directly when you need the placeholders string and params separately
    (e.g. to embed them inside a more complex query).

    Args:
        values: Typed values to bind into the predicate.
        prefix: Parameter name prefix. Parameters are emitted as
            ``:<prefix>0, :<prefix>1, ...``.

    Returns:
        A tuple of ``(placeholders_sql, params_list)``. Empty values return
        ``("NULL", [])`` so callers can safely write ``IN ({placeholders})``
        and match no rows without producing invalid SQL.
    """
    if not values:
        return "NULL", []
    placeholders = ", ".join(f":{prefix}{idx}" for idx in range(len(values)))
    params = [sql_param(f"{prefix}{idx}", value) for idx, value in enumerate(values)]
    return placeholders, params


async def run_sql_in(
    token: str,
    statement_template: str,
    *,
    in_param: str,
    values: list[object],
    endpoint_hint: str | None = None,
    max_rows: int | None = None,
    cache_tier: CacheTier | None = None,
    concurrency_key: str | None = None,
    **table_refs: str,
) -> list[dict]:
    """Execute a SQL query that uses an ``IN`` predicate over a value list.

    Renders ``{placeholders}`` in the statement template with auto-generated
    named parameters, then delegates to :func:`run_sql_async`.  Any additional
    keyword arguments are rendered into the template as table references (e.g.
    ``plant_table=tbl("gold_plant")`` fills ``{plant_table}``).

    Args:
        token: Databricks access token.
        statement_template: SQL template string.  Must contain
            ``{placeholders}`` where the ``IN (...)`` arguments should appear.
            May also contain ``{key}`` slots for ``**table_refs``.
        in_param: Base name for the generated parameters (e.g. ``"plant_id"``
            produces ``:plant_id0``, ``:plant_id1``, …).
        values: Values to bind.  Must contain 1–1000 items; scalars only.
        endpoint_hint: Optional label for slow-query logs.
        max_rows: Append ``LIMIT n`` when the statement lacks one.
        cache_tier: Optional :class:`~shared_db.runtime.CacheTier` for
            per-call TTL caching.
        concurrency_key: Named semaphore key (see :func:`run_sql_async`).
        **table_refs: Additional ``{key}`` replacements for table names.
            Values should come from :func:`tbl` or :func:`silver_tbl`.

    Returns:
        List of row dicts from the SQL result set.

    Raises:
        ValueError: If ``values`` is empty or contains more than 1 000 items.
    """
    if not values:
        raise ValueError("run_sql_in: values must not be empty")
    if len(values) > 1000:
        raise ValueError(
            f"run_sql_in: values list too long ({len(values)}); maximum is 1000"
        )
    placeholders, in_params = build_in_params(values, prefix=in_param)
    statement = statement_template.format(placeholders=placeholders, **table_refs)
    return await run_sql_async(
        token,
        statement,
        in_params,
        endpoint_hint=endpoint_hint,
        max_rows=max_rows,
        cache_tier=cache_tier,
        concurrency_key=concurrency_key,
    )


# ---------------------------------------------------------------------------
# run_sql — synchronous, used in readiness probes and simple one-off queries
# ---------------------------------------------------------------------------
_sql_cache = TTLCache(maxsize=100, ttl=300)
_sql_cache_lock = threading.Lock()
_SQL_CACHE_ROW_LIMIT = 1000
_SQL_SLOW_QUERY_THRESHOLD_MS = int(os.environ.get("SQL_SLOW_QUERY_THRESHOLD_MS", "3000"))

# Per-tier cache registry used by run_sql_async(cache_tier=...)
_tier_cache_registry: dict[str, tuple[Any, threading.Lock]] = {}
_tier_cache_registry_lock = threading.Lock()


def _get_tier_cache(tier: CacheTier) -> tuple[Any, threading.Lock]:
    """Return the (TTLCache, Lock) pair for a given CacheTier, creating it if needed."""
    if tier.name in _tier_cache_registry:
        return _tier_cache_registry[tier.name]
    with _tier_cache_registry_lock:
        if tier.name not in _tier_cache_registry:
            cache = TTLCache(maxsize=tier.maxsize, ttl=tier.ttl_seconds)
            lock = threading.Lock()
            _tier_cache_registry[tier.name] = (cache, lock)
    return _tier_cache_registry[tier.name]


def _core_sql_cache_key(statement: str, params: Optional[list[dict]] = None) -> str:
    """Build a token-independent data cache key for the base SQL runtime."""
    payload = json.dumps(params or [], sort_keys=True, default=str, separators=(",", ":"))
    return ":".join(
        [
            hashlib.sha256(statement.encode()).hexdigest(),
            hashlib.sha256(payload.encode()).hexdigest(),
        ]
    )


def _log_slow_query(*, duration_ms: int, endpoint_hint: str | None) -> None:
    """Log slow SQL calls for N+1 and warehouse latency detection."""
    if duration_ms > _SQL_SLOW_QUERY_THRESHOLD_MS:
        logger.warning(
            "sql.slow_query duration_ms=%d endpoint=%s",
            duration_ms,
            endpoint_hint or "unknown",
        )


def run_sql(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: Optional[str] = None,
) -> list[dict]:
    """Execute a SQL statement synchronously via the REST executor.

    Args:
        token: Databricks access token.
        statement: The SQL query to execute.
        params: Optional list of parameter dicts for the query.
        endpoint_hint: Optional logic name of the calling endpoint for logging.

    Returns:
        List of dictionaries representing the query result rows.
    """
    from .executors import _REST_EXECUTOR
    if endpoint_hint:
        logger.info("sql.execute hint=%s", endpoint_hint)

    app_name = os.environ.get("APP_NAME", "unknown")
    tagged_statement = f"/* App={app_name}, Module={endpoint_hint or 'unknown'} */\n{statement}"
    return _REST_EXECUTOR.execute(token, tagged_statement, params)


async def run_sql_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: Optional[str] = None,
    max_rows: int | None = None,
    cache_tier: CacheTier | None = None,
    concurrency_key: str | None = None,
    audit: bool = False,
) -> list[dict]:
    """Execute a SQL statement asynchronously.

    The base implementation uses a single process-local TTL cache.  Opt into
    richer features with the keyword arguments below — all default to the
    existing no-op behaviour so existing callers are unaffected.

    For full tiered-cache, per-instance audit hook, and write-invalidation
    behaviour, construct a :class:`~shared_db.runtime.SqlRuntime` directly.

    Args:
        token: Databricks access token.
        statement: SQL query string with ``:param`` placeholders.
        params: Named parameter list built with :func:`sql_param`.
        endpoint_hint: Label for slow-query logs and audit events.
        max_rows: Append ``LIMIT n`` to read statements that lack one.
        cache_tier: When provided, use this tier's TTL/maxsize for a
            per-tier process-local cache keyed on statement + params.
            When ``None`` (default) the base 5-minute cache is used for
            reads up to 1000 rows.
        concurrency_key: When set, gate execution through the named
            process-level semaphore (see
            :func:`~shared_db.runtime.get_semaphore`).
        audit: When ``True``, fire all globally registered audit hooks
            (see :func:`~shared_db.audit.register_audit_hook`).

    Returns:
        List of row dicts from the SQL result set.
    """
    if concurrency_key is not None:
        from .runtime import get_semaphore
        semaphore = get_semaphore(concurrency_key)
        async with semaphore:
            return await _run_sql_async_impl(
                token, statement, params,
                endpoint_hint=endpoint_hint,
                max_rows=max_rows,
                cache_tier=cache_tier,
                audit=audit,
            )
    return await _run_sql_async_impl(
        token, statement, params,
        endpoint_hint=endpoint_hint,
        max_rows=max_rows,
        cache_tier=cache_tier,
        audit=audit,
    )


async def _run_sql_async_impl(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: Optional[str] = None,
    max_rows: int | None = None,
    cache_tier: CacheTier | None = None,
    audit: bool = False,
) -> list[dict]:
    """Inner async execution path (no semaphore wrapping)."""
    from .executors import _REST_EXECUTOR, _sql_executor
    from .runtime import apply_max_rows_guard
    from .runtime import sql_cache_key as _runtime_cache_key

    statement_to_execute = apply_max_rows_guard(statement, max_rows)

    # Determine which cache to use: tier-specific or the module-level fallback
    if cache_tier is not None:
        cache, lock = _get_tier_cache(cache_tier)
        ck = _runtime_cache_key(token, statement_to_execute, params)
        with lock:
            cached = cache.get(ck)
        if cached is not None:
            return cached
    else:
        cache = None
        lock = None
        cache_key = _core_sql_cache_key(statement_to_execute, params)
        with _sql_cache_lock:
            cached = _sql_cache.get(cache_key)
        if cached is not None:
            return cached

    if endpoint_hint:
        logger.info("sql.execute_async hint=%s", endpoint_hint)

    app_name = os.environ.get("APP_NAME", "unknown")
    tagged_statement = f"/* App={app_name}, Module={endpoint_hint or 'unknown'} */\n{statement_to_execute}"

    started_at = time.monotonic()
    rows = await asyncio.get_running_loop().run_in_executor(
        _sql_executor,
        lambda: _REST_EXECUTOR.execute(token, tagged_statement, params),
    )
    duration_ms = int((time.monotonic() - started_at) * 1000)
    _log_slow_query(duration_ms=duration_ms, endpoint_hint=endpoint_hint)

    if cache_tier is not None and cache is not None and lock is not None:
        if len(rows) <= cache_tier.row_limit:
            with lock:
                cache[_runtime_cache_key(token, statement_to_execute, params)] = rows
    else:
        if len(rows) <= _SQL_CACHE_ROW_LIMIT:
            with _sql_cache_lock:
                _sql_cache[cache_key] = rows

    if audit:
        from .audit import _fire_global_audit_hooks
        await _fire_global_audit_hooks(
            token=token,
            statement=statement_to_execute,
            params=params,
            endpoint_hint=endpoint_hint or "unknown",
            elapsed_ms=duration_ms,
            rows=rows,
            error=None,
        )

    return rows


def run_sql_large(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: Optional[str] = None,
) -> list[dict]:
    """Execute a SQL statement synchronously using EXTERNAL_LINKS disposition.

    Stores results in cloud storage (pre-signed URLs) rather than inline,
    bypassing the 25 MB inline result cap. Results are never cached.

    Args:
        token: Databricks access token.
        statement: The SQL query to execute.
        params: Optional list of parameter dicts for the query.
        endpoint_hint: Optional logic name of the calling endpoint for logging.

    Returns:
        List of dictionaries representing the query result rows.
    """
    from .executors import _REST_EXECUTOR
    if endpoint_hint:
        logger.info("sql.execute_large hint=%s", endpoint_hint)

    app_name = os.environ.get("APP_NAME", "unknown")
    tagged_statement = f"/* App={app_name}, Module={endpoint_hint or 'unknown'} */\n{statement}"
    return _REST_EXECUTOR.execute(token, tagged_statement, params, large_result=True)


async def run_sql_large_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: Optional[str] = None,
) -> list[dict]:
    """Execute a SQL statement asynchronously using EXTERNAL_LINKS disposition.

    Stores results in cloud storage (pre-signed URLs) rather than inline,
    bypassing the 25 MB inline result cap. Results are never cached.

    Args:
        token: Databricks access token.
        statement: The SQL query to execute.
        params: Optional list of parameter dicts for the query.
        endpoint_hint: Optional logic name of the calling endpoint for logging.

    Returns:
        List of dictionaries representing the query result rows.
    """
    from .executors import _REST_EXECUTOR, _sql_executor
    if endpoint_hint:
        logger.info("sql.execute_large_async hint=%s", endpoint_hint)

    app_name = os.environ.get("APP_NAME", "unknown")
    tagged_statement = f"/* App={app_name}, Module={endpoint_hint or 'unknown'} */\n{statement}"

    return await asyncio.get_running_loop().run_in_executor(
        _sql_executor,
        lambda: _REST_EXECUTOR.execute(token, tagged_statement, params, large_result=True),
    )
