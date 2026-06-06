"""Auth session endpoint."""
from fastapi import APIRouter, Header
from pydantic import BaseModel

router = APIRouter()


class UserIdentity(BaseModel):
    """Authenticated user identity."""

    email: str
    displayName: str
    plant: str | None = None
    # TODO(Fix 4): populate from JWT groups claim once x-forwarded-* header names
    # are verified against a live Databricks Apps environment.
    groups: list[str] = []


@router.get("/auth/session", response_model=UserIdentity)
async def get_session(
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
) -> UserIdentity:
    """Return authenticated user identity from Databricks Apps proxy headers."""
    if x_forwarded_access_token is None:
        return UserIdentity(email="dev@kerry.com", displayName="Dev User")

    return UserIdentity(
        email=x_forwarded_email or "user@kerry.com",
        displayName=x_forwarded_user or x_forwarded_email or "Kerry User",
        groups=[],
    )
