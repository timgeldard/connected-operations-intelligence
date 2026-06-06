"""
Error classification and operational observability stubs for Databricks backends.
"""

__all__ = [
    "WarehouseNotConfiguredError",
    "classify_sql_runtime_error",
    "increment_observability_counter",
    "send_operational_alert",
]

import json
import logging
import time
from typing import Optional

from fastapi import HTTPException


class WarehouseNotConfiguredError(RuntimeError):
    """Raised when DATABRICKS_WAREHOUSE_HTTP_PATH is not configured in the environment."""

logger = logging.getLogger(__name__)


def classify_sql_runtime_error(
    exc: Exception,
    *,
    missing_table_detail: Optional[str] = None,
) -> Optional[HTTPException]:
    """Map Databricks SQL runtime failures to client-facing HTTP errors.

    Args:
        exc: Exception raised during SQL execution.
        missing_table_detail: Custom 503 detail string when the error indicates
            a missing table or view.  When ``None``, missing-table errors are
            not mapped.

    Returns:
        An :class:`~fastapi.HTTPException` when a mapping is found, or
        ``None`` when the caller should handle the error itself.
    """
    msg = str(exc).lower()
    if "permission denied" in msg or "no access" in msg or "403" in msg:
        return HTTPException(
            status_code=403,
            detail="Access denied: insufficient Unity Catalog privileges for this operation.",
        )
    if "401" in msg or "unauthorized" in msg:
        return HTTPException(status_code=401, detail="Token rejected by Databricks.")
    if missing_table_detail and (
        "table or view not found" in msg
        or "does not exist" in msg
        or "doesn't exist" in msg
    ):
        return HTTPException(status_code=503, detail=missing_table_detail)
    return None


def increment_observability_counter(
    name: str,
    *,
    tags: Optional[dict[str, str]] = None,
) -> None:
    """Emit a structured counter event (logging stub — wire a metrics sink here).

    Args:
        name: Metric name to increment.
        tags: Optional key/value dimension tags for the metric.
    """
    event = {
        "event": "metric.increment",
        "metric_name": name,
        "value": 1,
        "tags": tags or {},
    }
    logger.info(json.dumps(event))


def send_operational_alert(
    *,
    subject: str,
    body: str,
    error_id: Optional[str] = None,
    request_path: Optional[str] = None,
) -> None:
    """Emit a structured operational alert log event.

    Args:
        subject: Short alert headline.
        body: Full alert body / description.
        error_id: Optional correlation ID for cross-service tracing.
        request_path: Optional HTTP request path that triggered the alert.
    """
    alert = {
        "event": "operational_alert",
        "severity": "critical",
        "subject": subject,
        "body": body,
        "error_id": error_id or "unknown",
        "request_path": request_path or "unknown",
        "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    logger.error(json.dumps(alert))
