"""Databricks query-service error types — ADR-024 §4."""


class DatabricksAuthRequiredError(Exception):
    """Raised when a user OAuth token is required but not available.

    Per ADR-024 security rule: production Databricks reads must use the
    authenticated user's OAuth identity. Service-principal fallback is not
    permitted for user-facing reads.
    """

    def __init__(self, user_id: str) -> None:
        super().__init__(
            f"Databricks OAuth token required but not available for user {user_id!r}. "
            "Do not fall back to a service principal."
        )
        self.user_id = user_id


class QueryExecutionError(Exception):
    """Raised when a Databricks SQL query fails during execution."""


class DatabricksQueryTimeoutError(Exception):
    """Raised when a Databricks statement is cancelled due to timeout."""

    def __init__(self, query_name: str) -> None:
        super().__init__(f"Databricks query {query_name!r} timed out or was cancelled.")
        self.query_name = query_name


class DatabricksQueryError(Exception):
    """Raised when a Databricks statement execution fails (FAILED state or HTTP error)."""

    def __init__(self, query_name: str, detail: str) -> None:
        super().__init__(f"Databricks query {query_name!r} failed: {detail}")
        self.query_name = query_name
        self.detail = detail


class DatabricksConfigError(Exception):
    """Raised when required Databricks configuration environment variables are missing."""

    def __init__(self, missing_vars: list[str], detail: str = "") -> None:
        msg = detail or (
            f"Databricks configuration incomplete. Missing: {', '.join(missing_vars)}. "
            "Set the required environment variables."
        )
        super().__init__(msg)
        self.missing_vars = missing_vars


class DatabricksPermissionError(Exception):
    """Raised when the authenticated user lacks permission for the query (HTTP 403).

    Check Unity Catalog grants for the user's account. This error must not
    trigger a service-principal fallback — the user's identity must be used.
    """

    def __init__(self, query_name: str) -> None:
        super().__init__(
            f"Permission denied for query {query_name!r}. "
            "Check Unity Catalog grants for this user."
        )
        self.query_name = query_name


class DatabricksRateLimitError(Exception):
    """Raised when Databricks returns HTTP 429 Too Many Requests."""

    def __init__(self, query_name: str) -> None:
        super().__init__(
            f"Rate limit exceeded for query {query_name!r}. Retry after a short delay."
        )
        self.query_name = query_name


class DatabricksCatalogTargetError(Exception):
    """Raised when ``x-databricks-catalog`` is invalid or not allowlisted.

    The client message is fixed — user-supplied catalog values are never echoed.
    """

    def __init__(self) -> None:
        super().__init__("Unsupported Databricks catalog target")


class DatabricksWarehouseConfigError(Exception):
    """Raised when the SQL Warehouse is not found or not accessible (HTTP 404).

    Usually indicates SQL_WAREHOUSE_ID is wrong or the warehouse has been deleted.
    """

    def __init__(self, warehouse_id: str) -> None:
        super().__init__(
            f"SQL Warehouse {warehouse_id!r} not found or not accessible. "
            "Check SQL_WAREHOUSE_ID configuration."
        )
        self.warehouse_id = warehouse_id
