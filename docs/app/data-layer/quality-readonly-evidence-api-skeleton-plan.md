# Quality Read-Only Evidence API Skeleton Plan

| Area | Current state | Target state | Files | Notes |
|---|---|---|---|---|
| Zod Schema | `QualityEvidenceResponseSchema` | Unchanged | `packages/data-contracts/src/schemas/quality-readonly-evidence.ts` | Existing schema fits the requirement perfectly. |
| Python Model | `QualityEvidenceResponse` | Unchanged | `apps/api/contracts/generated.py` | Generated directly from the Zod schema. |
| Frontend Adapter | `QualityReadOnlyEvidenceAdapter` | Target API route in `databricks-api` / `legacy-api` modes. | `domain-integrations/quality/src/adapters/quality-readonly-evidence-adapter.ts` | The adapter currently returns a hardcoded unavailable response. We will move this logic to the backend. |
| Mock/Fixture | Hardcoded unavailable response returned locally. | Keep mock mode behaviour for `mock` adapter mode. | `domain-integrations/quality/src/adapters/quality-readonly-evidence-adapter.ts` | Will ensure `mock` mode retains current immediate local return. |
| API Route Path | None | `POST /api/quality/read-only-evidence` | `apps/api/routes/quality.py` (New or updated) | Requires adding to `apps/api/main.py` or API router if `quality.py` is new. |
| Target Response State | (Frontend) `pending-source-verification` | (Backend) `pending-source-verification` | Route implementation | Explicitly unavailable. |
| Source Status | (Frontend) `not-verified` | (Backend) `not-verified` | Route implementation | |
| Evidence State | N/A (implicit via warnings) | N/A (implicit via warnings and `unavailable` list) | Route implementation | |
| Source Badge Expectation | `unavailable` / `not-verified` | `unavailable` / `not-verified` | UI handles this based on summary state | |
| Test Files | `quality-readonly-evidence-adapter.test.ts` | New API tests + updated adapter tests | `apps/api/tests/test_quality_readonly_evidence.py` / `domain-integrations/quality/src/adapters/quality-readonly-evidence-adapter.test.ts` | Ensure tests prove no live data is fetched. |
| Docs | Mentioning no backend route | Status updated | Various markdown docs | Will update in Slice 6 |

## Route Path Justification

Preferred route path: `POST /api/quality/read-only-evidence`
Request body: `QualityEvidenceRequest` (materialId, batchId, plantId, etc.)
Response: `QualityEvidenceResponse` (contract-shaped unavailable response)

This directly fulfills the requirements to provide a skeleton path that behaves exactly as the frontend adapter currently does, but hosted in the backend.
