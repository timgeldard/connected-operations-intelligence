"""Optional auth header diagnostics endpoint — verification use only.

Enabled only when ``ENABLE_AUTH_DIAGNOSTICS=true``. Returns HTTP 404 when
disabled so the endpoint does not advertise its existence in production.

Safe fields returned (never the raw token):
- token_present: bool
- token_length_bucket: "absent" | "short" | "medium" | "long"
- user_header_present: bool
- email_header_present: bool
- path: request path string
- warning: reminder string

Use this endpoint to verify that Databricks Apps injects the expected
x-forwarded-* headers. Remove or disable after verification is complete.
See: docs/audit/databricks-apps-oauth-header-verification.md
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

router = APIRouter()


def _token_length_bucket(token: str | None) -> str:
    """Classify token length without exposing the value."""
    if token is None:
        return "absent"
    n = len(token)
    if n < 100:
        return "short"
    if n < 500:
        return "medium"
    return "long"


@router.get("/diagnostics/auth-headers")
async def auth_header_diagnostics(
    request: Request,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> JSONResponse:
    """Return safe auth header presence diagnostics — never the token value.

    Returns HTTP 404 unless ``ENABLE_AUTH_DIAGNOSTICS=true``.
    """
    if os.getenv("ENABLE_AUTH_DIAGNOSTICS", "").lower() != "true":
        return JSONResponse(status_code=404, content={"detail": "Not found"})

    return JSONResponse(
        content={
            "token_present": x_forwarded_access_token is not None,
            "token_length_bucket": _token_length_bucket(x_forwarded_access_token),
            "user_header_present": x_forwarded_user is not None,
            "email_header_present": x_forwarded_email is not None,
            "path": str(request.url.path),
            "warning": (
                "Non-production diagnostic endpoint. "
                "Disable ENABLE_AUTH_DIAGNOSTICS before production use."
            ),
        }
    )
