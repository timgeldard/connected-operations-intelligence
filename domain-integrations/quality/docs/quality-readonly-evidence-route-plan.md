# Quality Read-Only Evidence Route Plan

**Status:** skeleton-ready, no live route implemented.
**Created:** 2026-05-21.

## Purpose

Define the intended native route shape for future read-only Quality evidence without enabling live Databricks reads before source verification is complete.

## Current Implementation State

- `QualityReadOnlyEvidenceAdapter` exists in `domain-integrations/quality/src/adapters/quality-readonly-evidence-adapter.ts`.
- The adapter exposes `getQualityEvidence(request)`.
- The adapter does not fetch Databricks and does not call a backend route.
- The adapter returns `pending-source-verification` with empty evidence arrays and explicit warnings.
- The adapter source is `databricks-api`; it does not fall back to mock evidence.
- No native FastAPI Quality evidence route exists yet.

## Proposed Future Route

```http
POST /api/quality/evidence
```

Request contract:

- `QualityEvidenceRequest`

Response contract:

- `QualityEvidenceResponse`

Future route query name:

- `quality.get_evidence`

Future response headers, only after Databricks execution is real:

- `X-Data-Source: databricks-api`
- `X-Adapter-Mode: databricks-api`
- `X-Query-Name: quality.get_evidence`

## Source Verification Gates

Do not implement the live route until `quality-databricks-source-verification.md` has captured evidence for:

- object existence
- required columns
- row grain and duplicate behaviour
- inspection lot, material, batch, plant, and process-order keys
- MIC/result/specification fields
- usage-decision source semantics
- CoA-like result source boundaries
- deviation/notification availability or absence of source
- at least one candidate query path suitable for UAT validation

## Required Guardrails

- No SAP QM write-back.
- No release/reject/conditional action.
- No service-principal fallback.
- No app-side plant authorization shortcut.
- No silent fallback from Databricks to mock, legacy API, or static data.
- Missing usage-decision evidence must not be treated as accepted or released.
- No-record sections must not be treated as proof of absence.
- CoA-like result rows must not be treated as official CoA document approval.
- SPC advisory signals must remain separate from Quality release decisions.

## Future Tests

When the route is implemented, add tests for:

- source-not-verified unavailable response, if still gated
- Databricks mode only
- missing OAuth returns explicit authorization failure
- missing Databricks config returns unavailable/service error
- permission errors are not converted to mock data
- query errors and timeouts are explicit
- no raw tokens in responses
- generated contract validation
- response headers and query name
- no release approval or can-release fields
