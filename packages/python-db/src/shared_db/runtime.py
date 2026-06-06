"""
Advanced SQL runtime with tiered caching, audit hooks, and write invalidation.
"""

from __future__ import annotations

__all__ = [
    "CacheTier",
    "CachePolicy",
    "SqlRuntimeConfig",
    "SqlRuntime",
    "statement_prefix",
    "is_read_only_statement",
    "is_write_statement",
    "sql_cache_key",
    "apply_max_rows_guard",
    "get_semaphore",
]

import asyncio
import hashlib
import inspect
import json
import logging
import os
import re
import threading
import time
from collections.abc import Awaitable
from copy import deepcopy
from dataclasses import dataclass
from typing import Callable, Optional

from shared_db.core import TTLCache
from shared_db.errors import classify_sql_runtime_error
from shared_db.executors import _sql_executor

RunSql = Callable[[str, str, Optional[list[dict]]], list[dict]]
AuditHook = Callable[..., None | Awaitable[None]]

WRITE_SQL_PREFIXES = ("INSERT", "MERGE", "UPDATE", "DELETE", "ALTER", "CREATE", "DROP", "TRUNCATE", "OPTIMIZE", "VACUUM")
READ_SQL_PREFIXES = ("SELECT", "WITH", "SHOW", "DESCRIBE")
DEFAULT_SLOW_QUERY_THRESHOLD_MS = 3000
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Concurrency semaphore registry
# ---------------------------------------------------------------------------
_SEMAPHORE_REGISTRY: dict[str, asyncio.Semaphore] = {}
_SEMAPHORE_REGISTRY_LOCK = threading.Lock()


def get_semaphore(key: str) -> asyncio.Semaphore:
    """Return a named ``asyncio.Semaphore`` for the given concurrency key.

    The semaphore limit is read from the ``SQL_CONCURRENCY_LIMIT_<KEY>``
    environment variable (upper-cased, hyphens → underscores), falling back
    to ``SQL_CONCURRENCY_LIMIT`` (default ``4``).  Semaphores are created once
    per key and reused for the lifetime of the process.

    Args:
        key: Concurrency bucket name (e.g. ``"spc"``, ``"trace2"``).

    Returns:
        An ``asyncio.Semaphore`` shared across all callers with the same key.
    """
    if key in _SEMAPHORE_REGISTRY:
        return _SEMAPHORE_REGISTRY[key]
    with _SEMAPHORE_REGISTRY_LOCK:
        if key not in _SEMAPHORE_REGISTRY:
            env_key = f"SQL_CONCURRENCY_LIMIT_{key.upper().replace('-', '_')}"
            limit = int(os.environ.get(env_key, os.environ.get("SQL_CONCURRENCY_LIMIT", "4")))
            _SEMAPHORE_REGISTRY[key] = asyncio.Semaphore(limit)
    return _SEMAPHORE_REGISTRY[key]


# ---------------------------------------------------------------------------
# SQL statement classification helpers
# ---------------------------------------------------------------------------


def _strip_leading_comments(statement: str) -> str:
    """Return the statement with leading SQL line and block comments removed."""
    stripped = statement.lstrip()
    while stripped:
        if stripped.startswith("--"):
            _, separator, rest = stripped.partition("\n")
            stripped = rest.lstrip() if separator else ""
            continue
        if stripped.startswith("/*"):
            end = stripped.find("*/")
            if end == -1:
                return ""
            stripped = stripped[end + 2 :].lstrip()
            continue
        return stripped
    return stripped


def statement_prefix(statement: str) -> str:
    """Return the first keyword of a SQL statement in upper case.

    Leading ``--`` and ``/* ... */`` comments are stripped before inspection.
    Returns an empty string for blank or comment-only input.

    Args:
        statement: SQL text to inspect.

    Returns:
        Upper-cased first word (e.g. ``"SELECT"``, ``"INSERT"``), or ``""``.
    """
    stripped = _strip_leading_comments(statement)
    return stripped.split(None, 1)[0].upper() if stripped else ""


def is_read_only_statement(statement: str) -> bool:
    """Return ``True`` when the statement starts with a read-only SQL keyword.

    Recognised prefixes: SELECT, WITH, SHOW, DESCRIBE.

    Args:
        statement: SQL text to classify.
    """
    return statement_prefix(statement) in READ_SQL_PREFIXES


def is_write_statement(statement: str) -> bool:
    """Return ``True`` when the statement starts with a mutating SQL keyword.

    Recognised prefixes: INSERT, MERGE, UPDATE, DELETE, ALTER, CREATE, DROP,
    TRUNCATE, OPTIMIZE, VACUUM.

    Args:
        statement: SQL text to classify.
    """
    return statement_prefix(statement) in WRITE_SQL_PREFIXES


def sql_cache_key(token: str, statement: str, params: Optional[list[dict]] = None) -> str:
    """Build a data-cache key for a statement and parameters.

    Args:
        token: Deprecated compatibility parameter. Tokens are validated and
            audited separately, but intentionally excluded from the data key so
            common manufacturing dashboard reads share cache entries.
        statement: SQL statement text.
        params: Optional Databricks SQL named parameters.

    Returns:
        Stable ``statement_hash:params_hash`` cache key.
    """
    payload = json.dumps(params or [], sort_keys=True, default=str, separators=(",", ":"))
    return ":".join(
        [
            hashlib.sha256(statement.encode()).hexdigest(),
            hashlib.sha256(payload.encode()).hexdigest(),
        ]
    )


def statement_has_limit(statement: str) -> bool:
    """Return ``True`` when a read statement already contains a LIMIT clause.

    Args:
        statement: SQL text to inspect.
    """
    stripped = _strip_leading_comments(statement)
    return bool(re.search(r"\blimit\b", stripped, flags=re.IGNORECASE))


def apply_max_rows_guard(statement: str, max_rows: int | None) -> str:
    """Append a conservative LIMIT for read statements that do not have one.

    Args:
        statement: SQL statement to guard.
        max_rows: Maximum rows to request, or ``None`` to leave unchanged.

    Returns:
        Statement with a trailing ``LIMIT`` when safe and requested.
    """
    if max_rows is None or max_rows <= 0:
        return statement
    if not is_read_only_statement(statement) or statement_has_limit(statement):
        return statement
    return f"{statement.rstrip()}\nLIMIT {int(max_rows)}"


@dataclass(frozen=True)
class CacheTier:
    """A process-local read cache tier with explicit retention limits.

    The SQL runtime cache is intentionally in-memory only. Cached rows may hold
    confidential manufacturing data, so tiers must use short TTLs and bounded
    sizes. Use ``bypass_cache=True`` for user-specific or restricted data.
    """

    name: str
    maxsize: int = 100
    ttl_seconds: int = 300
    row_limit: int = 1000
    prefixes: tuple[str, ...] = READ_SQL_PREFIXES
    patterns: tuple[str, ...] = ()

    def matches(self, statement: str) -> bool:
        """Return whether this tier applies to the given SQL statement.

        Args:
            statement: SQL text to test against this tier's prefix and pattern rules.
        """
        if statement_prefix(statement) not in self.prefixes:
            return False
        if not self.patterns:
            return True
        lowered = statement.lower()
        return any(pattern.lower() in lowered for pattern in self.patterns)


@dataclass(frozen=True)
class CachePolicy:
    """Named cache tiers for read-only SQL results.

    Retention is enforced by ``cachetools.TTLCache`` per process. Entries are
    additionally purged by LRU eviction, write invalidation, explicit
    ``SqlRuntime.clear_cache()``, and process restarts.
    """

    tiers: tuple[CacheTier, ...]

    @classmethod
    def single(cls, *, maxsize: int = 100, ttl_seconds: int = 300, row_limit: int = 1000) -> "CachePolicy":
        """Return a single-tier policy with the given limits."""
        return cls((CacheTier("default", maxsize=maxsize, ttl_seconds=ttl_seconds, row_limit=row_limit),))

    @classmethod
    def tiered(cls, *tiers: CacheTier) -> "CachePolicy":
        """Return a multi-tier policy from the given tiers (at least one required).

        Args:
            *tiers: One or more :class:`CacheTier` instances.

        Raises:
            ValueError: When no tiers are provided.
        """
        if not tiers:
            raise ValueError("CachePolicy.tiered requires at least one cache tier")
        return cls(tuple(tiers))

    @classmethod
    def manufacturing(cls, *, row_limit: int = 1000) -> "CachePolicy":
        """Return the standard tiered policy for manufacturing cockpits.

        Retention limits are intentionally short because cached rows can include
        quality, inventory, and traceability data:
        metadata 15m, scorecards 5m, charts 3m.

        Args:
            row_limit: Maximum row count to store per cache entry across all tiers.
        """
        return cls.tiered(
            CacheTier(
                "metadata",
                maxsize=500,
                ttl_seconds=900,
                row_limit=row_limit,
                patterns=(
                    "information_schema.",
                    "_dim_mv",
                    "gold_material",
                    "gold_plant",
                    "gold_functional_location",
                ),
            ),
            CacheTier(
                "scorecard",
                maxsize=200,
                ttl_seconds=300,
                row_limit=row_limit,
                patterns=("_metrics", "_summary", "kpi_"),
            ),
            CacheTier(
                "chart",
                maxsize=300,
                ttl_seconds=180,
                row_limit=row_limit,
            ),
        )


@dataclass(frozen=True)
class SqlRuntimeConfig:
    """Immutable configuration snapshot for building a :class:`SqlRuntime`.

    All fields mirror the :class:`SqlRuntime` constructor arguments and share
    the same defaults.  Use :meth:`build` to materialise a runtime instance.
    """

    run_sql: RunSql
    cache_maxsize: int = 100
    cache_ttl_seconds: int = 300
    cache_row_limit: int = 1000
    cache_policy: CachePolicy | None = None
    audit_hook: AuditHook | None = None
    audit_in_background: bool = False
    allow_mutable_cache: bool = False
    slow_query_threshold_ms: int = DEFAULT_SLOW_QUERY_THRESHOLD_MS

    def build(self) -> "SqlRuntime":
        """Instantiate a :class:`SqlRuntime` from this configuration."""
        return SqlRuntime(
            run_sql=self.run_sql,
            cache_maxsize=self.cache_maxsize,
            cache_ttl_seconds=self.cache_ttl_seconds,
            cache_row_limit=self.cache_row_limit,
            cache_policy=self.cache_policy,
            audit_hook=self.audit_hook,
            audit_in_background=self.audit_in_background,
            allow_mutable_cache=self.allow_mutable_cache,
            slow_query_threshold_ms=self.slow_query_threshold_ms,
        )


class SqlRuntime:
    """Advanced SQL runtime with tiered caching, audit hooks, and concurrency control."""

    def __init__(
        self,
        *,
        run_sql: RunSql,
        cache_maxsize: int = 100,
        cache_ttl_seconds: int = 300,
        cache_row_limit: int = 1000,
        cache_policy: CachePolicy | None = None,
        audit_hook: AuditHook | None = None,
        audit_in_background: bool = False,
        allow_mutable_cache: bool = False,
        slow_query_threshold_ms: int = DEFAULT_SLOW_QUERY_THRESHOLD_MS,
    ) -> None:
        """Initialise the runtime.

        Args:
            run_sql: Synchronous callable ``(token, statement, params) -> rows``.
            cache_maxsize: Default tier maxsize when no ``cache_policy`` is given.
            cache_ttl_seconds: Default tier TTL in seconds.
            cache_row_limit: Default per-entry row limit for caching.
            cache_policy: Explicit :class:`CachePolicy`; overrides the simple
                size/TTL fields when provided.
            audit_hook: Optional callable invoked after each SQL execution.
            audit_in_background: When ``True``, audit hook is scheduled as a
                background task instead of awaited inline.
            allow_mutable_cache: Skip deepcopy on cache reads.  Only safe if
                callers treat result sets as immutable.
            slow_query_threshold_ms: Threshold in ms for slow-query warnings.
        """
        self._run_sql = run_sql
        self.cache_policy = cache_policy or CachePolicy.single(
            maxsize=cache_maxsize,
            ttl_seconds=cache_ttl_seconds,
            row_limit=cache_row_limit,
        )
        self._audit_hook = audit_hook
        self._tier_caches = {
            tier.name: TTLCache(maxsize=tier.maxsize, ttl=tier.ttl_seconds) for tier in self.cache_policy.tiers
        }
        self.cache: TTLCache = self._tier_caches[self.cache_policy.tiers[0].name]
        self.cache_lock = threading.Lock()
        self.cache_row_limit = self.cache_policy.tiers[0].row_limit
        self.audit_in_background = audit_in_background
        self.allow_mutable_cache = allow_mutable_cache
        self.slow_query_threshold_ms = slow_query_threshold_ms

    def clear_cache(self) -> None:
        """Purge every configured in-memory cache tier for this process."""
        with self.cache_lock:
            for cache in self._tier_caches.values():
                cache.clear()
                expires = getattr(cache, "_expires", None)
                if isinstance(expires, dict):
                    expires.clear()

    def _cache_tier_for(self, statement: str) -> CacheTier | None:
        """Return the first matching :class:`CacheTier` for a statement, or ``None``."""
        if not is_read_only_statement(statement):
            return None
        for tier in self.cache_policy.tiers:
            if tier.matches(statement):
                return tier
        return None

    async def _audit(
        self,
        *,
        token: str,
        statement: str,
        params: Optional[list[dict]],
        endpoint_hint: str,
        rows: list[dict] | None = None,
        error: Exception | None = None,
        duration_ms: int | None = None,
    ) -> None:
        """Invoke the instance-level audit hook, swallowing hook failures."""
        if self._audit_hook is None:
            return
        try:
            result = self._audit_hook(
                token=token,
                statement=statement,
                params=params,
                endpoint_hint=endpoint_hint,
                rows=rows,
                error=error,
                duration_ms=duration_ms,
            )
            if inspect.isawaitable(result):
                await result
        except Exception:
            logger.warning("sql.audit_hook_failed endpoint=%s", endpoint_hint, exc_info=True)

    async def _emit_audit(
        self,
        *,
        token: str,
        statement: str,
        params: Optional[list[dict]],
        endpoint_hint: str,
        rows: list[dict] | None = None,
        error: Exception | None = None,
        duration_ms: int | None = None,
    ) -> None:
        """Schedule or await the audit hook based on ``audit_in_background``."""
        if self.audit_in_background:
            loop = asyncio.get_running_loop()
            loop.create_task(
                self._audit(
                    token=token,
                    statement=statement,
                    params=params,
                    endpoint_hint=endpoint_hint,
                    rows=rows,
                    error=error,
                    duration_ms=duration_ms,
                )
            )
            return
        await self._audit(
            token=token,
            statement=statement,
            params=params,
            endpoint_hint=endpoint_hint,
            rows=rows,
            error=error,
            duration_ms=duration_ms,
        )

    async def run_sql_async(
        self,
        token: str,
        statement: str,
        params: Optional[list[dict]] = None,
        *,
        endpoint_hint: str = "unknown",
        audit: bool = True,
        invalidate_cache: bool = True,
        bypass_cache: bool = False,
        max_rows: int | None = None,
        concurrency_key: str | None = None,
    ) -> list[dict]:
        """Execute a SQL statement with tiered caching, audit hooks, and concurrency control.

        Args:
            token: Databricks access token.
            statement: SQL query string with ``:param`` placeholders.
            params: Named parameter list built with :func:`~shared_db.sql_param`.
            endpoint_hint: Label for slow-query logs and audit events.
            audit: Whether to fire the instance-level audit hook.
            invalidate_cache: When ``True`` (default), mutating statements purge
                all tier caches so subsequent reads are fresh.
            bypass_cache: Skip cache lookup and store for this call.
            max_rows: Append ``LIMIT n`` to read statements that lack one.
            concurrency_key: When set, gate execution through the named
                process-level semaphore (see :func:`~shared_db.runtime.get_semaphore`).

        Returns:
            List of row dicts from the SQL result set.
        """
        if concurrency_key is not None:
            semaphore = get_semaphore(concurrency_key)
            async with semaphore:
                return await self._run_sql_async_inner(
                    token, statement, params,
                    endpoint_hint=endpoint_hint,
                    audit=audit,
                    invalidate_cache=invalidate_cache,
                    bypass_cache=bypass_cache,
                    max_rows=max_rows,
                )
        return await self._run_sql_async_inner(
            token, statement, params,
            endpoint_hint=endpoint_hint,
            audit=audit,
            invalidate_cache=invalidate_cache,
            bypass_cache=bypass_cache,
            max_rows=max_rows,
        )

    async def _run_sql_async_inner(
        self,
        token: str,
        statement: str,
        params: Optional[list[dict]] = None,
        *,
        endpoint_hint: str = "unknown",
        audit: bool = True,
        invalidate_cache: bool = True,
        bypass_cache: bool = False,
        max_rows: int | None = None,
    ) -> list[dict]:
        """Inner execution path (no semaphore wrapping)."""
        try:
            statement_to_execute = apply_max_rows_guard(statement, max_rows)
            tier = self._cache_tier_for(statement_to_execute)
            if tier is None or bypass_cache:
                loop = asyncio.get_running_loop()
                started_at = time.monotonic()
                rows = await loop.run_in_executor(_sql_executor, lambda: self._run_sql(token, statement_to_execute, params))
                duration_ms = int((time.monotonic() - started_at) * 1000)
                self._log_slow_query(duration_ms=duration_ms, endpoint_hint=endpoint_hint)
                if invalidate_cache and is_write_statement(statement_to_execute):
                    self.clear_cache()
                if audit:
                    await self._emit_audit(
                        token=token,
                        statement=statement_to_execute,
                        params=params,
                        endpoint_hint=endpoint_hint,
                        rows=rows,
                        duration_ms=duration_ms,
                    )
                return rows

            cache_key = f"{tier.name}:{sql_cache_key(token, statement_to_execute, params)}"
            cache = self._tier_caches[tier.name]
            with self.cache_lock:
                cached_rows = cache.get(cache_key)
            if cached_rows is not None:
                return deepcopy(cached_rows) if not self.allow_mutable_cache else cached_rows

            loop = asyncio.get_running_loop()
            started_at = time.monotonic()
            rows = await loop.run_in_executor(_sql_executor, lambda: self._run_sql(token, statement_to_execute, params))
            duration_ms = int((time.monotonic() - started_at) * 1000)
            self._log_slow_query(duration_ms=duration_ms, endpoint_hint=endpoint_hint)
            if len(rows) <= tier.row_limit:
                with self.cache_lock:
                    cache[cache_key] = deepcopy(rows)
            if audit:
                await self._emit_audit(
                    token=token,
                    statement=statement_to_execute,
                    params=params,
                    endpoint_hint=endpoint_hint,
                    rows=rows,
                    duration_ms=duration_ms,
                )
            return rows
        except Exception as exc:
            if audit:
                await self._emit_audit(
                    token=token,
                    statement=statement,
                    params=params,
                    endpoint_hint=endpoint_hint,
                    error=exc,
                )
            mapped_error = classify_sql_runtime_error(exc)
            if mapped_error:
                raise mapped_error from exc
            raise

    def _log_slow_query(self, *, duration_ms: int, endpoint_hint: str) -> None:
        """Emit a warning for SQL calls that exceed the configured threshold."""
        if duration_ms > self.slow_query_threshold_ms:
            logger.warning(
                "sql.slow_query duration_ms=%d endpoint=%s",
                duration_ms,
                endpoint_hint,
            )
