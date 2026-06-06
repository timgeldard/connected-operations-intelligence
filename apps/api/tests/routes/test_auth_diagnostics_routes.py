"""Tests for GET /api/diagnostics/auth-headers.

The endpoint must:
- Return 404 when ENABLE_AUTH_DIAGNOSTICS is absent or not "true".
- Return 200 with safe fields when enabled.
- Never include the raw token value in the response body.
"""
from __future__ import annotations

import httpx
from httpx import ASGITransport
from main import app


def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


_DIAG_URL = "/api/diagnostics/auth-headers"


class TestAuthDiagnosticsDisabled:
    async def test_returns_404_when_env_var_absent(self) -> None:
        """Endpoint must not exist in default configuration."""
        async with _make_client() as client:
            response = await client.get(_DIAG_URL)
        assert response.status_code == 404

    async def test_returns_404_when_env_var_false(self, monkeypatch) -> None:
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "false")
        async with _make_client() as client:
            response = await client.get(_DIAG_URL)
        assert response.status_code == 404

    async def test_returns_404_when_env_var_empty(self, monkeypatch) -> None:
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "")
        async with _make_client() as client:
            response = await client.get(_DIAG_URL)
        assert response.status_code == 404



class TestAuthDiagnosticsEnabled:
    async def test_returns_200_when_enabled(self, monkeypatch) -> None:
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "true")
        async with _make_client() as client:
            response = await client.get(_DIAG_URL)
        assert response.status_code == 200

    async def test_token_present_false_when_no_token(self, monkeypatch) -> None:
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "true")
        async with _make_client() as client:
            response = await client.get(_DIAG_URL)
        data = response.json()
        assert data["token_present"] is False
        assert data["token_length_bucket"] == "absent"

    async def test_token_present_true_when_token_supplied(self, monkeypatch) -> None:
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "true")
        async with _make_client() as client:
            response = await client.get(
                _DIAG_URL,
                headers={"x-forwarded-access-token": "some-bearer-token-value"},
            )
        data = response.json()
        assert data["token_present"] is True
        assert data["token_length_bucket"] in ("short", "medium", "long")

    async def test_raw_token_never_in_response(self, monkeypatch) -> None:
        """The raw token value must not appear anywhere in the response body."""
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "true")
        secret = "super-secret-oauth-token-value-must-not-leak"
        async with _make_client() as client:
            response = await client.get(
                _DIAG_URL,
                headers={"x-forwarded-access-token": secret},
            )
        assert secret not in response.text

    async def test_user_header_present_true(self, monkeypatch) -> None:
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "true")
        async with _make_client() as client:
            response = await client.get(
                _DIAG_URL,
                headers={"x-forwarded-user": "user@example.com"},
            )
        assert response.json()["user_header_present"] is True

    async def test_email_header_present_false_when_absent(self, monkeypatch) -> None:
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "true")
        async with _make_client() as client:
            response = await client.get(_DIAG_URL)
        assert response.json()["email_header_present"] is False

    async def test_response_includes_path_field(self, monkeypatch) -> None:
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "true")
        async with _make_client() as client:
            response = await client.get(_DIAG_URL)
        data = response.json()
        assert "path" in data

    async def test_response_includes_warning_field(self, monkeypatch) -> None:
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "true")
        async with _make_client() as client:
            response = await client.get(_DIAG_URL)
        data = response.json()
        assert "warning" in data
        assert len(data["warning"]) > 0

    async def test_token_length_bucket_medium_for_300_char_token(self, monkeypatch) -> None:
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "true")
        token = "a" * 300
        async with _make_client() as client:
            response = await client.get(
                _DIAG_URL,
                headers={"x-forwarded-access-token": token},
            )
        assert response.json()["token_length_bucket"] == "medium"

    async def test_token_length_bucket_long_for_600_char_token(self, monkeypatch) -> None:
        monkeypatch.setenv("ENABLE_AUTH_DIAGNOSTICS", "true")
        token = "b" * 600
        async with _make_client() as client:
            response = await client.get(
                _DIAG_URL,
                headers={"x-forwarded-access-token": token},
            )
        assert response.json()["token_length_bucket"] == "long"
