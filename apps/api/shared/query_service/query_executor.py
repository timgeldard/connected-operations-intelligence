"""QueryExecutor — ADR-024 §3, ADR-025.

Executes a QuerySpec against Databricks using the authenticated user's OAuth
token. The client is injected so tests can run without a live warehouse.

Security invariant: ``execute()`` calls ``identity.require_user_oauth()``
before passing the query to the client. If the token is absent,
``DatabricksAuthRequiredError`` propagates to the caller — no service-
principal fallback, no mock fallback.
"""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from typing import Any, TypeVar

from .catalog_policy import assert_allowed_catalog_target
from .databricks_client import DatabricksQueryClient, NotImplementedDatabricksClient
from .errors import (
    DatabricksQueryTimeoutError,
    DatabricksRateLimitError,
)
from .identity import UserIdentity
from .query_spec import QuerySpec

_log = logging.getLogger(__name__)

T = TypeVar("T")

# Transient errors retried up to ``DatabricksRepository.max_attempts`` total calls.
RETRYABLE_ERRORS: tuple[type[Exception], ...] = (
    DatabricksQueryTimeoutError,
    DatabricksRateLimitError,
)


class QueryExecutor:
    """Executes a QuerySpec against Databricks using the user's OAuth token.

    Args:
        client: Databricks query client. Defaults to ``NotImplementedDatabricksClient``
            when no real client is available yet.
        warehouse_id: SQL warehouse ID forwarded to the client on every call.
    """

    def __init__(
        self,
        client: DatabricksQueryClient | None = None,
        warehouse_id: str = "",
    ) -> None:
        self._client: DatabricksQueryClient = client or NotImplementedDatabricksClient()
        self._warehouse_id = warehouse_id

    async def execute(self, spec: QuerySpec, identity: UserIdentity) -> list[dict]:
        """Execute *spec* with the user's OAuth token and return rows as list[dict].

        Steps:
        1. Demand the OAuth token — raises ``DatabricksAuthRequiredError`` if absent.
        2. Merge ``spec.max_rows`` into params so ``LIMIT :max_rows`` is bound.
        3. Build a tags dict for observability.
        4. Delegate to the injected client.

        Raises:
            DatabricksAuthRequiredError: if ``identity.raw_oauth_token`` is absent.
            DatabricksQueryTimeoutError: if the client times out.
            DatabricksQueryError: if Databricks returns a FAILED state or HTTP error.
            NotImplementedError: if the client is ``NotImplementedDatabricksClient``.
        """
        token = identity.require_user_oauth()

        params: dict[str, object] = {**spec.params, "max_rows": spec.max_rows}

        tags: dict[str, str] = {
            "query_name": spec.name,
            "module": spec.module,
            "endpoint": spec.endpoint,
            "user_id": identity.user_id,
        }
        for t in spec.tags:
            tags[t] = "true"
        # Reserved keys written after spec.tags loop so they cannot be overridden by caller tags.
        tags["cache_policy"] = spec.cache_policy.value
        tags["source_badge"] = spec.source_badge

        _log.info(
            "QueryExecutor.execute",
            extra={"query_name": spec.name, "user_id": identity.user_id},
        )

        return await self._client.execute(
            sql=spec.sql,
            params=params,
            oauth_token=token,
            warehouse_id=self._warehouse_id,
            timeout_seconds=spec.timeout_seconds,
            tags=tags,
        )


class DatabricksRepository:
    """Executes QuerySpecs with optional retry for transient Databricks errors.

    ``max_attempts`` is the total number of ``QueryExecutor.execute`` calls for
    one ``fetch()`` — not "retries after the first attempt". The default of 3
    means one initial attempt plus up to two retries on timeout or rate limit.
    """

    def __init__(
        self,
        executor: QueryExecutor,
        identity: UserIdentity,
        *,
        max_attempts: int = 3,
        base_backoff: float = 1.0,
    ) -> None:
        if max_attempts < 1:
            raise ValueError("max_attempts must be at least 1")
        self.executor = executor
        self.identity = identity
        self.max_attempts = max_attempts
        self.base_backoff = base_backoff

    def _build_cache_key(self, spec: QuerySpec) -> str:
        import hashlib
        import json

        from .cache_policy import CacheTier

        # Normalize params
        normalized_params = sorted(spec.params.items())
        params_str = json.dumps(normalized_params, default=str)

        # Scoping context components — every field that could change the
        # rows returned for the same query name MUST be included so cache
        # entries cannot be shared across boundaries (catalog overrides,
        # schema overrides, SQL changes, adapter mode, identity for
        # PER_USER tiers).
        sql_fingerprint = hashlib.sha256(
            (spec.sql or "").encode("utf-8")
        ).hexdigest()
        components = [
            spec.name,
            spec.endpoint,
            params_str,
            self.identity.catalog_target or "default",
            spec.catalog_override or "none",
            spec.schema_override or "none",
            # Adapter mode — pinning this in the cache key prevents an
            # ill-defined "mock" / "legacy-api" entry from being served
            # under a "databricks-api" request.
            "databricks-api",
            sql_fingerprint,
        ]

        if spec.cache_policy == CacheTier.PER_USER_60S:
            components.append(self.identity.user_id)

        key_material = ":".join(components)
        return hashlib.sha256(key_material.encode("utf-8")).hexdigest()

    def _get_ttl_for_policy(self, policy: Any) -> int:
        from .cache_policy import CacheTier
        if policy == CacheTier.GLOBAL_300S:
            return 300
        if policy == CacheTier.PER_USER_60S:
            return 60
        return 0

    async def fetch(
        self,
        spec_factory: Callable[[], QuerySpec],
        mapper: Callable[[list[dict[str, Any]]], T],
    ) -> tuple[T, QuerySpec]:
        """Execute a QuerySpec and return mapped results, applying retry logic and caching.

        Retries only ``DatabricksQueryTimeoutError`` and ``DatabricksRateLimitError``
        until ``max_attempts`` is exhausted. All other errors propagate immediately.

        Args:
            spec_factory: Zero-argument function returning a QuerySpec (evaluated per attempt).
            mapper: Converts raw Databricks rows into the target domain model.

        Returns:
            A tuple of (mapped_result, query_spec) so callers can set HTTP headers.
        """
        import os
        import time

        from .cache import get_cache_store
        from .cache_policy import CacheTier

        spec = spec_factory()
        # Catalog override allow-list is enforced BEFORE any cache lookup
        # so a previously-cached entry cannot satisfy a request that the
        # current configuration policy would now reject. ADR-027 §7
        # ("No Silent Masking") requires that auth / permission /
        # configuration failures propagate immediately and cannot be
        # answered from cache.
        assert_allowed_catalog_target(self.identity.catalog_target)

        cache_store = get_cache_store()
        ttl = self._get_ttl_for_policy(spec.cache_policy)
        cache_enabled = os.getenv("ENABLE_QUERY_CACHE", "false").lower() == "true"

        entry = None
        if not cache_enabled:
            spec.cache_status = "DISABLED"
        elif spec.cache_policy == CacheTier.NONE or ttl <= 0:
            spec.cache_status = "BYPASS"
        else:
            cache_key = self._build_cache_key(spec)
            try:
                entry = await cache_store.get(cache_key)
            except Exception:
                _log.exception("Cache store get error (graceful degradation applied)")
                spec.cache_status = "BYPASS"

            if entry is not None:
                spec.cache_status = "HIT"
                # entry.cached_at is a monotonic timestamp (see InMemoryCacheStore).
                spec.cache_age_seconds = int(time.monotonic() - entry.cached_at)
                spec.cache_ttl_seconds = entry.ttl
                return mapper(entry.data), spec
            elif spec.cache_status != "BYPASS":
                spec.cache_status = "MISS"

        last_retryable_error: Exception | None = None

        from shared.query_service.object_resolver import catalog_context

        token = catalog_context.set(self.identity.catalog_target)
        try:
            for attempt_number in range(1, self.max_attempts + 1):
                try:
                    # Evaluate spec per attempt in case dynamic values are needed
                    current_spec = spec_factory()
                    rows = await self.executor.execute(current_spec, self.identity)

                    # Update the metadata on the returned spec
                    current_spec.cache_status = spec.cache_status
                    current_spec.cache_age_seconds = spec.cache_age_seconds
                    current_spec.cache_ttl_seconds = spec.cache_ttl_seconds

                    # Cache the raw rows on a successful MISS
                    if cache_enabled and spec.cache_status == "MISS":
                        cache_key = self._build_cache_key(current_spec)
                        try:
                            await cache_store.set(cache_key, rows, ttl)
                            current_spec.cache_age_seconds = 0
                            current_spec.cache_ttl_seconds = ttl
                        except Exception:
                            _log.exception("Cache store set error (graceful degradation applied)")
                            current_spec.cache_status = "BYPASS"
                            current_spec.cache_age_seconds = None
                            current_spec.cache_ttl_seconds = None

                    return mapper(rows), current_spec
                except RETRYABLE_ERRORS as exc:
                    last_retryable_error = exc
                    if attempt_number >= self.max_attempts:
                        raise
                    sleep_time = self.base_backoff * (2 ** (attempt_number - 1))
                    _log.warning(
                        "Transient Databricks error on attempt %d/%d: %s. "
                        "Retrying in %.1fs...",
                        attempt_number,
                        self.max_attempts,
                        exc,
                        sleep_time,
                    )
                    await asyncio.sleep(sleep_time)

            if last_retryable_error:
                raise last_retryable_error

            raise RuntimeError(
                "Exhausted fetch attempts without a result or retryable error."
            )
        finally:
            catalog_context.reset(token)

