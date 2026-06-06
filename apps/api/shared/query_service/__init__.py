"""QuerySpec/QueryExecutor infrastructure — ADR-024 §3, ADR-025."""
from .cache_policy import CacheTier
from .databricks_client import (
    DatabricksQueryClient,
    NotImplementedDatabricksClient,
    StatementApiDatabricksClient,
)
from .errors import (
    DatabricksAuthRequiredError,
    DatabricksConfigError,
    DatabricksPermissionError,
    DatabricksQueryError,
    DatabricksQueryTimeoutError,
    DatabricksRateLimitError,
    DatabricksWarehouseConfigError,
    QueryExecutionError,
)
from .identity import UserIdentity, extract_user_identity
from .object_resolver import qualify_object, quote_identifier, resolve_domain_object
from .query_executor import QueryExecutor
from .query_spec import QuerySpec

__all__ = [
    "CacheTier",
    "DatabricksAuthRequiredError",
    "DatabricksConfigError",
    "DatabricksPermissionError",
    "DatabricksQueryClient",
    "DatabricksQueryError",
    "DatabricksQueryTimeoutError",
    "DatabricksRateLimitError",
    "DatabricksWarehouseConfigError",
    "NotImplementedDatabricksClient",
    "QueryExecutionError",
    "QueryExecutor",
    "QuerySpec",
    "StatementApiDatabricksClient",
    "UserIdentity",
    "extract_user_identity",
    "qualify_object",
    "quote_identifier",
    "resolve_domain_object",
]
