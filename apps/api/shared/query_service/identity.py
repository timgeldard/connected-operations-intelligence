"""User identity dataclass and FastAPI dependency — ADR-024 §4."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Header

from .catalog_policy import assert_allowed_catalog_target
from .errors import DatabricksAuthRequiredError


@dataclass
class UserIdentity:
    """Authenticated user context forwarded from the Databricks Apps OAuth proxy.

    The ``raw_oauth_token`` is the bearer token from the
    ``x-forwarded-access-token`` header injected by Databricks Apps. It must be
    present for any ``databricks-api`` query. If absent, call ``require_user_oauth()``
    to surface a ``DatabricksAuthRequiredError`` — do NOT substitute a service
    principal.
    """

    user_id: str
    email: Optional[str] = None
    raw_oauth_token: Optional[str] = None
    catalog_target: Optional[str] = None

    def require_user_oauth(self) -> str:
        """Return the OAuth token or raise ``DatabricksAuthRequiredError``.

        Never falls back to a service principal. Callers that receive
        ``DatabricksAuthRequiredError`` must surface an auth-required error
        to the frontend (HTTP 401) rather than silently degrading to mock data.
        """
        if not self.raw_oauth_token:
            raise DatabricksAuthRequiredError(self.user_id)
        return self.raw_oauth_token


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

# TODO: Verify these header names in a live Databricks Apps environment.
# Databricks Apps injects OAuth proxy headers into every request. Based on
# Databricks documentation and community reports the expected header names are:
#   x-forwarded-access-token — end-user OAuth2 bearer token  (UNVERIFIED — must be confirmed in live Databricks Apps environment before production)
#   x-forwarded-user         — user identifier / subject      (UNVERIFIED — must be confirmed in live Databricks Apps environment before production)
#   x-forwarded-email        — user email address             (UNVERIFIED — must be confirmed in live Databricks Apps environment before production)
# Verification steps: deploy with ENABLE_AUTH_DIAGNOSTICS=true, hit /api/diagnostics/auth-headers,
# confirm the three header names match, then remove the UNVERIFIED markers and the startup warning in main.py.


def extract_user_identity(
    x_forwarded_access_token: Optional[str] = Header(default=None),
    x_forwarded_user: Optional[str] = Header(default=None),
    x_forwarded_email: Optional[str] = Header(default=None),
    x_databricks_catalog: Optional[str] = Header(default=None),
) -> "UserIdentity":
    """FastAPI ``Depends()`` function — extract ``UserIdentity`` from Databricks Apps headers.

    A missing OAuth token does *not* raise here. Callers must invoke
    ``identity.require_user_oauth()`` to enforce the constraint before any
    Databricks query is executed.
    """
    return UserIdentity(
        user_id=x_forwarded_user or "unknown",
        email=x_forwarded_email,
        raw_oauth_token=x_forwarded_access_token,
        catalog_target=assert_allowed_catalog_target(x_databricks_catalog),
    )
