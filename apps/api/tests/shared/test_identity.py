"""Tests for UserIdentity OAuth enforcement — P0-5 (ADR-024 §4).

Validates that require_user_oauth() raises DatabricksAuthRequiredError when
no OAuth token is present and never falls back to a service principal.

Deployment note: OAuth header names (x-forwarded-access-token, x-forwarded-user,
x-forwarded-email) in extract_user_identity are marked ASSUMED in identity.py.
These header names MUST be verified in a live Databricks Apps environment before
go-live. See docs/security/unity-catalog-authorization-prerequisite.md §OAuth
for the exact verification procedure.
"""
import pytest
from shared.query_service.errors import DatabricksAuthRequiredError
from shared.query_service.identity import UserIdentity, extract_user_identity


class TestRequireUserOauth:
    def test_raises_when_raw_oauth_token_is_none(self) -> None:
        """Missing token must raise, not fall back to a service principal."""
        identity = UserIdentity(user_id="test-user", raw_oauth_token=None)
        with pytest.raises(DatabricksAuthRequiredError):
            identity.require_user_oauth()

    def test_raises_when_raw_oauth_token_is_empty_string(self) -> None:
        identity = UserIdentity(user_id="test-user", raw_oauth_token="")
        with pytest.raises(DatabricksAuthRequiredError):
            identity.require_user_oauth()

    def test_returns_token_when_present(self) -> None:
        identity = UserIdentity(user_id="test-user", raw_oauth_token="eyJhbGciOiJSUzI1NiJ9.test")
        token = identity.require_user_oauth()
        assert token == "eyJhbGciOiJSUzI1NiJ9.test"

    def test_error_message_contains_user_id(self) -> None:
        identity = UserIdentity(user_id="alice@example.com", raw_oauth_token=None)
        with pytest.raises(DatabricksAuthRequiredError) as exc_info:
            identity.require_user_oauth()
        assert "alice@example.com" in str(exc_info.value)

    def test_error_type_is_databricks_auth_required(self) -> None:
        identity = UserIdentity(user_id="test-user", raw_oauth_token=None)
        with pytest.raises(DatabricksAuthRequiredError) as exc_info:
            identity.require_user_oauth()
        assert exc_info.value.user_id == "test-user"

    def test_no_service_principal_fallback_in_error_message(self) -> None:
        """Error message must reference the no-SP-fallback policy."""
        identity = UserIdentity(user_id="test-user", raw_oauth_token=None)
        with pytest.raises(DatabricksAuthRequiredError) as exc_info:
            identity.require_user_oauth()
        assert "service principal" in str(exc_info.value).lower()


class TestExtractUserIdentity:
    def test_all_headers_present(self) -> None:
        identity = extract_user_identity(
            x_forwarded_access_token="token-abc",
            x_forwarded_user="user-123",
            x_forwarded_email="user@example.com",
        )
        assert identity.raw_oauth_token == "token-abc"
        assert identity.user_id == "user-123"
        assert identity.email == "user@example.com"

    def test_missing_token_gives_none_raw_oauth(self) -> None:
        identity = extract_user_identity(
            x_forwarded_access_token=None,
            x_forwarded_user="user-123",
            x_forwarded_email=None,
        )
        assert identity.raw_oauth_token is None

    def test_missing_user_header_gives_unknown_user_id(self) -> None:
        identity = extract_user_identity(
            x_forwarded_access_token=None,
            x_forwarded_user=None,
            x_forwarded_email=None,
        )
        assert identity.user_id == "unknown"

    def test_missing_token_then_require_raises(self) -> None:
        """Full path: missing header → extract → require → raises (no SP fallback)."""
        identity = extract_user_identity(
            x_forwarded_access_token=None,
            x_forwarded_user="alice",
            x_forwarded_email=None,
        )
        with pytest.raises(DatabricksAuthRequiredError):
            identity.require_user_oauth()
