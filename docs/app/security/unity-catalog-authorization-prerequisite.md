# Unity Catalog Authorization — Mandatory Go-Live Prerequisite

**Status: DEFERRED — UC roles/policies not yet configured**

**Go-live gate: BLOCKED until evidence of UC policy enforcement is provided**

---

## Summary

Application-level plant entitlement lists are intentionally not implemented.

Unity Catalog is the intended enforcement layer for plant/data authorization.

Go-live requires evidence that UC policies restrict traceability reads by user entitlement.

Until UC roles/policies are configured and validated, traceability may proceed through
technical/UAT hardening but must not be treated as production-authorized.

---

## Authorization model

V2 ConnectIO does not maintain a list of allowed plants in the application layer.
This is an intentional architectural decision.

Data-level authorization — which plants, batches, and materials a given user is
permitted to query — is delegated entirely to **Unity Catalog**:

- Row-level security via UC row filters on gold views.
- Column masks where required.
- Grants restricted to appropriate UC principals (groups or service principals
  that represent authenticated end users).

The V2 application layer is responsible for:
- Passing the authenticated user's OAuth token to every Databricks query.
- Never substituting a service principal for a user-facing read.
- Surfacing permission-denied responses as authorization errors, not as "no data".

The V2 application layer is **not** responsible for:
- Deciding which plants a user may query.
- Filtering query results by plant entitlement in Python or TypeScript.
- Maintaining an allowed-plant whitelist in configuration.

---

## ScopeContext is UX context only

The `ScopeContext` React context (used for workspace navigation and UI filtering)
is a **UX navigation hint**. It is not a security boundary.

- Do not treat `ScopeContext.plantId` as a plant entitlement check.
- A user whose `ScopeContext` contains plant "P001" is not thereby restricted
  from querying plant "P002" — that restriction is Unity Catalog's responsibility.
- Future agents: do **not** add plant entitlement validation logic to `ScopeContext`,
  `useManifestHydration`, workspace registry, or any application-layer component.

---

## OAuth identity — current status

All production Databricks reads must execute as the authenticated end user via the
OAuth token injected by the Databricks Apps proxy.

Current implementation (`apps/api/shared/query_service/identity.py`):
- Extracts the token from `x-forwarded-access-token` header.
- Raises `DatabricksAuthRequiredError` if the token is absent.
- No service-principal fallback exists for user-facing reads.

**Blocked validation (P0-5):** The OAuth header names (`x-forwarded-access-token`,
`x-forwarded-user`, `x-forwarded-email`) are assumed based on Databricks documentation
and community sources. They must be verified in a live Databricks Apps environment
before go-live. See the deployment verification procedure below.

### OAuth deployment verification procedure

In a live Databricks Apps environment, confirm the following:

1. Make an authenticated request to any API endpoint.
2. Add temporary debug logging (in a non-production environment only, never log raw
   tokens in production) to capture the headers received by FastAPI.
3. Confirm that `x-forwarded-access-token` is present and contains a valid JWT bearer
   token for the authenticated user.
4. Confirm that `x-forwarded-user` contains the user's identity string.
5. Confirm that `x-forwarded-email` contains the user's email address.
6. Remove the debug logging.
7. Update the `TODO: Verify` comments in `apps/api/shared/query_service/identity.py`
   to `Verified: <date> <environment>`.

Do not log raw tokens in production. Do not expose token values in response headers.

---

## What must happen before go-live

The following evidence must be present and documented before V2 traceability is
authorized for production use:

| Gate | Description | Owner |
|------|-------------|-------|
| UC-1 | Unity Catalog row filters or secured views restrict batch/plant reads by user entitlement | Data Engineering / UC Admin |
| UC-2 | Evidence that a test user without plant-X entitlement cannot query plant-X data | Security / QA |
| UC-3 | Evidence that permission-denied responses are surfaced as 401/403, not silent empty results | Backend / QA |
| UC-4 | OAuth header names verified in live Databricks Apps environment | Backend |
| UC-5 | No service-principal fallback exists for any user-facing Databricks read | Backend / Security |

These gates are tracked in
`domain-integrations/traceability/docs/production-readiness-checklist.md`.

---

## What must NOT be done

Future agents and developers must not:

- Add allowed-plant lists to application configuration or environment variables.
- Add temporary hardcoded plant whitelists as a "short-term" measure.
- Treat `ScopeContext` as a security enforcement mechanism.
- Substitute a service principal for a user-facing Databricks read.
- Return empty successful results when the user lacks UC access — surface the
  permission error explicitly.
- Claim "no trace data" when the real cause is a UC permission denial.

---

## Related documents

- `docs/adr/ADR-024-native-databricks-data-access-architecture.md` — OAuth and
  identity architecture decisions.
- `apps/api/shared/query_service/identity.py` — `extract_user_identity` and
  `require_user_oauth`.
- `apps/api/shared/query_service/errors.py` — `DatabricksAuthRequiredError` and
  `DatabricksPermissionError`.
- `domain-integrations/traceability/docs/production-readiness-checklist.md` —
  go-live gates including UC-1 through UC-5.
- `docs/migration/databricks-column-verification-queries.md` — column verification
  queries for gold_batch_summary_v (P0-1).
