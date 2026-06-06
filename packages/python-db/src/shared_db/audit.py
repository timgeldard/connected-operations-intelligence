"""Global SQL query audit hook registry.

Apps that need to record SQL activity (e.g. into a query-audit table)
register a hook at startup via :func:`register_audit_hook`. The hook
is then called after every ``run_sql_async`` invocation that opts in with
``audit=True``.
"""

from __future__ import annotations

__all__ = ["QueryAuditHook", "register_audit_hook"]

import hashlib
import inspect
import logging
from typing import Protocol, runtime_checkable

logger = logging.getLogger(__name__)

_audit_hooks: list = []


@runtime_checkable
class QueryAuditHook(Protocol):
    """Protocol for SQL query audit hooks.

    Implementations record information about completed SQL calls for
    observability, compliance, or debugging purposes. Register via
    :func:`register_audit_hook` at app startup.
    """

    async def record(
        self,
        *,
        endpoint_hint: str,
        statement: str,
        params: list[dict] | None,
        user_token_hash: str,
        elapsed_ms: int,
        rows: list[dict] | None,
        error: Exception | None,
    ) -> None:
        """Record a completed SQL query.

        Args:
            endpoint_hint: Logical endpoint label supplied by the caller.
            statement: SQL statement that was executed.
            params: Bound parameter list, or ``None``.
            user_token_hash: First 16 hex chars of SHA-256 of the caller's
                token — safe to log without exposing credentials.
            elapsed_ms: Wall-clock duration in milliseconds.
            rows: Result rows on success, or ``None`` on error.
            error: Exception on failure, or ``None`` on success.
        """
        ...


def register_audit_hook(hook: QueryAuditHook) -> None:
    """Register a global hook fired after every audited SQL call.

    Hooks are invoked in registration order. A hook that raises is logged
    as a warning; it does not affect the SQL result or subsequent hooks.
    Call at app startup (e.g. inside a FastAPI lifespan handler).

    Args:
        hook: Object implementing the :class:`QueryAuditHook` protocol.
    """
    _audit_hooks.append(hook)


def _token_hash(token: str) -> str:
    """Return a short non-reversible hash of a token for safe logging."""
    return hashlib.sha256(token.encode()).hexdigest()[:16]


async def _fire_global_audit_hooks(
    *,
    token: str,
    statement: str,
    params: list[dict] | None,
    endpoint_hint: str,
    elapsed_ms: int,
    rows: list[dict] | None,
    error: Exception | None,
) -> None:
    """Invoke all registered global audit hooks.

    Individual hook failures are swallowed after logging so they never
    propagate to the caller or affect other hooks.
    """
    if not _audit_hooks:
        return
    user_token_hash = _token_hash(token)
    for hook in list(_audit_hooks):
        try:
            result = hook.record(
                endpoint_hint=endpoint_hint,
                statement=statement,
                params=params,
                user_token_hash=user_token_hash,
                elapsed_ms=elapsed_ms,
                rows=rows,
                error=error,
            )
            if inspect.isawaitable(result):
                await result
        except Exception:
            logger.warning(
                "sql.global_audit_hook_failed endpoint=%s hook=%s",
                endpoint_hint,
                type(hook).__name__,
                exc_info=True,
            )
