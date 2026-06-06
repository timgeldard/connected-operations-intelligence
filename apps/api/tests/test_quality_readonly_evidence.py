from contracts.generated import QualityEvidenceResponse
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_only_evidence_route_exists():
    response = client.post(
        "/api/quality/read-only-evidence",
        json={"materialId": "123", "batchId": "456", "plantId": "1000"}
    )
    assert response.status_code == 200

def test_read_only_evidence_returns_unavailable_state():
    response = client.post(
        "/api/quality/read-only-evidence",
        json={"materialId": "123", "batchId": "456", "plantId": "1000"}
    )
    assert response.status_code == 200
    data = response.json()

    # Verify contract
    parsed = QualityEvidenceResponse.model_validate(data)

    assert parsed.summary.status == 'pending-source-verification'
    assert parsed.summary.source == 'databricks-api'
    assert 'inspection-lots' in parsed.summary.unavailable_evidence

    warnings = parsed.summary.warnings
    assert any("not be interpreted as accepted or released" in w for w in warnings)

    assert parsed.usage_decision is None
    assert len(parsed.inspection_lots) == 0

def test_read_only_evidence_does_not_contain_decision_authority():
    response = client.post(
        "/api/quality/read-only-evidence",
        json={"materialId": "123", "batchId": "456", "plantId": "1000"}
    )
    assert response.status_code == 200
    text = response.text

    # Must not contain release authority fields
    assert "canRelease" not in text
    assert "releaseApproved" not in text
    assert "sapPosting" not in text
    assert "eSignature" not in text

def test_read_only_evidence_requires_body():
    response = client.post("/api/quality/read-only-evidence")
    # FastAPI validation error for missing body
    assert response.status_code == 422
