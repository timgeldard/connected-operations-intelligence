"""Pytest fixtures for apps/api tests."""
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture()
def client() -> TestClient:
    """Return a test client for the FastAPI app."""
    return TestClient(app)
