"""QuerySpec dataclass — ADR-024 §3."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .cache_policy import CacheTier


@dataclass
class QuerySpec:
    """Describes a single Databricks SQL query and its execution policy.

    All column references in ``sql`` must be marked with ``# TODO: verify``
    until confirmed against the live Unity Catalog view. Do not remove TODOs
    without inspecting the view DDL and running a test query.

    Attributes:
        name: Dot-qualified identifier, e.g. ``"poh.get_process_order_header"``.
        module: Domain module name, e.g. ``"poh"`` or ``"cq"``.
        endpoint: The FastAPI route this spec backs, e.g. ``"/api/por/order-header"``.
        sql: Parameterised SQL string using ``:param`` placeholder syntax.
        params: Bind parameters keyed by placeholder name.
        cache_policy: Caching tier — see ``CacheTier``.
        source_badge: Source badge value written into ``AdapterResult.source``
            for downstream UI rendering. Defaults to ``"databricks-api"``.
        catalog_override: Override Unity Catalog name (used by wh360 which lives
            in a separate catalog).
        schema_override: Override schema name within the catalog.
        max_rows: Safety limit applied via ``LIMIT :max_rows`` in the query.
        timeout_seconds: Statement-level timeout forwarded to the Databricks client.
        tags: Arbitrary string tags for observability / query-tagging.
    """

    name: str
    module: str
    endpoint: str
    sql: str
    params: dict = field(default_factory=dict)
    cache_policy: CacheTier = CacheTier.NONE
    source_badge: str = "databricks-api"
    catalog_override: Optional[str] = None
    schema_override: Optional[str] = None
    max_rows: int = 10_000
    timeout_seconds: int = 30
    tags: list[str] = field(default_factory=list)

    # Cache execution metadata (populated at runtime by the repository/executor)
    cache_status: Optional[str] = None
    cache_age_seconds: Optional[int] = None
    cache_ttl_seconds: Optional[int] = None

