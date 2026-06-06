"""
shared_db — the only sanctioned path from ConnectIO V2 Python code to Databricks SQL.

All imports in app and library code must come from this package.
Direct ``databricks`` imports are forbidden outside this package.

See docs/shared-db.md for the full API reference.
"""

from .audit import QueryAuditHook, register_audit_hook
from .authorized_scope import assert_plant_authorized, fetch_authorized_plants
from .core import (
    DATABRICKS_HOST,
    TRACE_CATALOG,
    TRACE_SCHEMA,
    WAREHOUSE_HTTP_PATH,
    build_in_params,
    check_warehouse_config,
    hostname,
    resolve_token,
    run_sql,
    run_sql_async,
    run_sql_in,
    run_sql_large,
    run_sql_large_async,
    silver_tbl,
    sql_param,
    tbl,
)
from .errors import (
    WarehouseNotConfiguredError,
    classify_sql_runtime_error,
    increment_observability_counter,
    send_operational_alert,
)
from .executors import is_connector_available, run_in_sql_executor
from .freshness import DataFreshnessRuntime
from .query_builder import QueryBuilder
from .runtime import (
    CachePolicy,
    CacheTier,
    SqlRuntime,
    SqlRuntimeConfig,
    apply_max_rows_guard,
    get_semaphore,
    is_read_only_statement,
    is_write_statement,
    sql_cache_key,
)

__all__ = [
    # §3.1 Identifiers & config
    "DATABRICKS_HOST",
    "WAREHOUSE_HTTP_PATH",
    "TRACE_CATALOG",
    "TRACE_SCHEMA",
    "hostname",
    "tbl",
    "silver_tbl",
    "check_warehouse_config",
    "resolve_token",
    # §3.2 Execution
    "sql_param",
    "build_in_params",
    "run_sql_in",
    "run_sql",
    "run_sql_async",
    "run_sql_large",
    "run_sql_large_async",
    "run_in_sql_executor",
    "is_connector_available",
    # §3.3 Advanced runtime
    "CachePolicy",
    "CacheTier",
    "SqlRuntime",
    "SqlRuntimeConfig",
    "DataFreshnessRuntime",
    "QueryBuilder",
    "get_semaphore",
    "fetch_authorized_plants",
    "assert_plant_authorized",
    # §3.4 Errors & observability
    "WarehouseNotConfiguredError",
    "classify_sql_runtime_error",
    "increment_observability_counter",
    "send_operational_alert",
    # §3.5 Audit hooks
    "QueryAuditHook",
    "register_audit_hook",
    # Kept public (used by envmon wrapper; review in next major version)
    "is_read_only_statement",
    "is_write_statement",
    "sql_cache_key",
    "apply_max_rows_guard",
]
