"""Tests for the auth session endpoint."""
from fastapi.testclient import TestClient


def test_session_without_token_returns_dev_user(client: TestClient) -> None:
    """Without a token header, return dev identity."""
    response = client.get("/api/auth/session")
    assert response.status_code == 200
    body = response.json()
    assert "email" in body
    assert "displayName" in body


def test_session_with_mock_token(client: TestClient) -> None:
    """With a mock token header, return user identity JSON."""
    response = client.get(
        "/api/auth/session",
        headers={"x-forwarded-access-token": "mock-token-abc"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "user@kerry.com"
