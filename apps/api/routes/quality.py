import os
from datetime import datetime, timezone

from adapters.quality.quality_databricks_adapter import (
    QualityUsageDecisionRepository,
)
from contracts.generated import (
    QualityEvidenceRequest,
    QualityEvidenceResponse,
    QualityEvidenceSummary,
)
from fastapi import APIRouter, Header, HTTPException, Response

from routes._databricks import (
    build_databricks_repository,
    build_user_identity,
    require_databricks_config,
    run_repository_fetch,
    set_databricks_response_headers,
)

router = APIRouter(prefix="/quality", tags=["quality"])

@router.post("/read-only-evidence", response_model=QualityEvidenceResponse)
async def get_read_only_evidence(
    request: QualityEvidenceRequest,
    response: Response,
    x_forwarded_access_token: str | None = Header(default=None),
    x_forwarded_user: str | None = Header(default=None),
    x_forwarded_email: str | None = Header(default=None),
    x_databricks_catalog: str | None = Header(default=None),
) -> QualityEvidenceResponse:
    """
    Read-only Quality evidence route.

    Fetches raw source evidence directly from Databricks (gold_inspection_usage_decision).
    This evidence is strictly read-only and governed under Option A (Strict Lot-Level Evidence).
    It must not be used to synthesise a batch-level release decision.
    """
    queried_at = datetime.now(timezone.utc).isoformat()
    adapter_mode = os.getenv("BACKEND_ADAPTER_MODE", "")

    if adapter_mode != "databricks-api":
        # Return the unavailable skeleton if not configured for native Databricks.
        # `QualityEvidenceResponse.request` / `.summary` are generated as
        # anonymous nested Pydantic classes (`Request`, `Summary`) — not
        # `QualityEvidenceRequest` / `QualityEvidenceSummary`. We dump to dict
        # so Pydantic's response validation re-coerces the structurally
        # identical payload into the expected nested types.
        # Source verification is not yet complete in this deployment. The
        # route intentionally reports `source: 'databricks-api'` (the
        # intended source) and `status: 'pending-source-verification'`
        # — not `'unavailable'` — to make the readiness gate explicit and
        # to surface the no-decision-authority caveat in `warnings`.
        unavailable_summary = QualityEvidenceSummary(
            source='databricks-api',
            status='pending-source-verification',
            inspectionLotCount=0,
            micResultCount=0,
            usageDecisionStatus='source-unverified',
            coaResultCount=0,
            unavailableEvidence=[
                'inspection-lots',
                'mic-results',
                'usage-decision',
                'coa-results',
                'deviations'
            ],
            warnings=[
                'Quality evidence is pending source verification — '
                'must not be interpreted as accepted or released.',
                'Set BACKEND_ADAPTER_MODE=databricks-api once UAT source '
                'verification completes.',
            ],
            queriedAt=queried_at,
            sourceFreshnessStatus='not-verified'
        )
        return QualityEvidenceResponse(
            request=request.model_dump(by_alias=True),
            summary=unavailable_summary.model_dump(by_alias=True),
            inspectionLots=[],
            micResults=[],
            usageDecision=None,
            coaResults=[]
        )

    # We need batch_id and material_id to query usage decisions reliably at the batch level.
    if not request.batch_id or not request.material_id:
        raise HTTPException(status_code=422, detail="batchId and materialId are required for quality evidence")

    host, warehouse_id = require_databricks_config()
    identity = build_user_identity(
        x_forwarded_access_token, x_forwarded_user, x_forwarded_email, x_databricks_catalog
    )

    repository = QualityUsageDecisionRepository(
        build_databricks_repository(identity, host, warehouse_id)
    )
    evidence, spec = await run_repository_fetch(
        lambda: repository.fetch_usage_decision_evidence(
            material_id=request.material_id,
            batch_id=request.batch_id,
            plant_id=request.plant_id,
            queried_at=queried_at,
        )
    )
    set_databricks_response_headers(response, spec)

    # See unavailable-skeleton note above: dump-then-coerce is required because
    # `QualityEvidenceResponse.request` / `.summary` / `.inspection_lots` are
    # anonymous nested Pydantic types in the generated model, not the
    # top-level QualityEvidence* classes.
    return QualityEvidenceResponse(
        request=request.model_dump(by_alias=True),
        summary=evidence.summary.model_dump(by_alias=True),
        inspectionLots=[lot.model_dump(by_alias=True) for lot in evidence.inspection_lots],
        micResults=[],
        usageDecision=None,
        coaResults=[]
    )
