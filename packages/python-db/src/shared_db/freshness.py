"""Data freshness metadata for Databricks gold-layer views.

Use :class:`DataFreshnessRuntime` to attach ``data_freshness`` metadata to
API response payloads.  For simple async attachment with graceful 503
downgrade, see :func:`~shared_db.utils.attach_payload_freshness`.
"""

from __future__ import annotations

__all__ = ["DataFreshnessRuntime"]

import re
import threading
import time
from copy import deepcopy
from typing import Callable

from shared_db.core import TTLCache, sql_param

RunSql = Callable[[str, str, list[dict] | None], list[dict]]
StringGetter = Callable[[], str]

VIEW_NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")


class DataFreshnessRuntime:
    """Attaches data-staleness metadata to API response payloads.

    Queries ``system.information_schema.tables`` for the ``last_altered``
    timestamp of each requested view, cached per catalog/schema/view
    combination for up to ``cache_ttl_seconds`` (default 5 minutes).
    """

    def __init__(
        self,
        *,
        run_sql: RunSql,
        catalog: StringGetter,
        schema: StringGetter,
        cache_maxsize: int = 50,
        cache_ttl_seconds: int = 300,
    ) -> None:
        """Initialise a freshness runtime.

        Args:
            run_sql: Synchronous callable with signature
                ``(token, statement, params) -> list[dict]``.
            catalog: Zero-argument callable returning the Unity Catalog name.
            schema: Zero-argument callable returning the schema name.
            cache_maxsize: Maximum number of cached freshness entries.
            cache_ttl_seconds: TTL for each cached entry in seconds.
        """
        self._run_sql = run_sql
        self._catalog = catalog
        self._schema = schema
        self.cache: TTLCache = TTLCache(maxsize=cache_maxsize, ttl=cache_ttl_seconds)
        self.cache_lock = threading.Lock()

    def get_data_freshness(self, token: str, source_views: list[str]) -> dict:
        """Return freshness metadata for the given views.

        Args:
            token: Databricks access token (used for cache-miss queries).
            source_views: Unqualified view names to include.  Names that
                contain characters outside ``[A-Za-z0-9_]`` are silently
                dropped to prevent SQL injection.

        Returns:
            Dict with ``generated_at_utc``, ``catalog``, ``schema``, and
            ``sources`` (list of ``{source_view, last_altered_utc}`` rows).
        """
        safe_views = sorted({view for view in source_views if VIEW_NAME_RE.match(view)})
        if not safe_views:
            return {"generated_at_utc": int(time.time()), "sources": []}

        catalog = self._catalog()
        schema = self._schema()
        cache_key = (catalog, schema, tuple(safe_views))
        with self.cache_lock:
            cached = self.cache.get(cache_key)
        if cached is not None:
            return deepcopy(cached)

        params = [
            sql_param("catalog_name", catalog),
            sql_param("schema_name", schema),
        ]
        view_clauses: list[str] = []
        for idx, view in enumerate(safe_views):
            param_name = f"view_{idx}"
            view_clauses.append(f"table_name = :{param_name}")
            params.append(sql_param(param_name, view))

        # noqa: S608 — view_clauses contain only server-generated param names; all values are bound SQL params.
        query = f"""
            SELECT
                table_name AS source_view,
                CAST(last_altered AS STRING) AS last_altered_utc
            FROM system.information_schema.tables
            WHERE table_catalog = :catalog_name
              AND table_schema = :schema_name
              AND ({' OR '.join(view_clauses)})
            ORDER BY table_name
        """
        rows = self._run_sql(token, query, params)
        result = {
            "generated_at_utc": int(time.time()),
            "catalog": catalog,
            "schema": schema,
            "sources": rows,
        }
        with self.cache_lock:
            self.cache[cache_key] = deepcopy(result)
        return result

    async def attach(
        self,
        payload: dict,
        source_views: list[str],
        token: str,
    ) -> dict:
        """Attach freshness metadata to a response payload.

        Convenience wrapper that runs :meth:`get_data_freshness` on the shared
        SQL thread pool and stores the result as ``payload["data_freshness"]``.
        For graceful 503-downgrade behaviour wrap this call with
        :func:`~shared_db.utils.attach_payload_freshness`.

        Args:
            payload: Response dict to enrich in-place.
            source_views: Unqualified view names whose freshness to include.
            token: Databricks access token.

        Returns:
            The same ``payload`` dict with ``data_freshness`` added.
        """
        from .executors import run_in_sql_executor
        payload["data_freshness"] = await run_in_sql_executor(
            lambda: self.get_data_freshness(token, source_views)
        )
        return payload
