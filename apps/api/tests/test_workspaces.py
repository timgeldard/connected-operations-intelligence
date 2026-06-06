"""Tests for the workspace manifest endpoint."""
from fastapi.testclient import TestClient


def test_manifest_returns_200(client: TestClient) -> None:
    """Manifest endpoint must return 200."""
    response = client.get("/api/workspaces/manifest")
    assert response.status_code == 200


def test_manifest_has_workspaces_key(client: TestClient) -> None:
    """Manifest response must have a workspaces list."""
    response = client.get("/api/workspaces/manifest")
    body = response.json()
    assert "workspaces" in body
    assert isinstance(body["workspaces"], list)


def test_manifest_has_at_least_one_workspace(client: TestClient) -> None:
    """Manifest must contain at least one workspace entry."""
    response = client.get("/api/workspaces/manifest")
    body = response.json()
    assert len(body["workspaces"]) >= 1


def test_manifest_workspace_has_required_fields(client: TestClient) -> None:
    """Each workspace entry must have id, label, lifecycle, and tabs."""
    response = client.get("/api/workspaces/manifest")
    for workspace in response.json()["workspaces"]:
        assert "id" in workspace
        assert "label" in workspace
        assert "lifecycle" in workspace
        assert "tabs" in workspace
