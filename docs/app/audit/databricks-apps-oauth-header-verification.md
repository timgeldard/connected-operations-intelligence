# Databricks Apps OAuth Header Verification

**Date:** 2026-05-17
**Status:** Headers assumed — not yet verified in live Databricks Apps environment
**Reference:** ADR-025, `apps/api/shared/query_service/identity.py`

---

## 1. Current assumed headers

The `extract_user_identity()` dependency in `identity.py` reads three headers injected by Databricks Apps:

| Header | What it contains | How it is used |
|--------|-----------------|----------------|
| `x-forwarded-access-token` | End-user OAuth bearer token | Forwarded as `Authorization: Bearer <token>` to the Databricks Statement API |
| `x-forwarded-user` | User identifier (typically email or sub claim) | Logged as `user_id` in query tags; never used in SQL parameters |
| `x-forwarded-email` | User email address | Stored in `UserIdentity.email`; not currently used in SQL |

These header names are documented in Databricks' public Apps platform documentation and align with naming conventions used by other Databricks-hosted applications. They have not been confirmed against a live Databricks Apps deployment of ConnectIO V2.

---

## 2. Why these headers are assumed

Databricks Apps is designed to forward the authenticated user's OAuth2 identity to the hosted application. The header names (`x-forwarded-access-token`, `x-forwarded-user`, `x-forwarded-email`) follow Databricks' documented pattern for OAuth token forwarding in the Apps runtime. They mirror conventions used in Databricks notebook proxies and the broader OAuth 2.0 proxy pattern.

The assumption is reasonable but must be verified before treating live production data queries as correctly scoped to the requesting user.

**Risk if wrong:** If the access token header name differs, `UserIdentity.raw_oauth_token` will be `None`, and `require_user_oauth()` will raise `DatabricksAuthRequiredError`, returning HTTP 401 to the user. The query will not execute. This is the correct safe failure mode — the app will not silently use a service-principal or fall back to mock.

---

## 3. How to verify safely in Databricks Apps

### Step 1 — Enable the diagnostic endpoint

Set `ENABLE_AUTH_DIAGNOSTICS=true` in the Databricks App environment (via `app.yaml` or Databricks App settings). This activates `GET /api/diagnostics/auth-headers`.

```bash
# Option A: set via Databricks CLI secret
databricks secrets put-secret connectio-v2 enable-auth-diagnostics \
  --string-value "true"

# Then reference it in app.yaml (use the scope/key string form — nested YAML not supported):
# - name: ENABLE_AUTH_DIAGNOSTICS
#   valueFrom: connectio-v2/enable-auth-diagnostics
```

### Step 2 — Authenticate and call the endpoint

Open a browser and navigate to the deployed app. Then make an authenticated request:

```
GET https://<app-url>/api/diagnostics/auth-headers
```

The response will be:

```json
{
  "token_present": true,
  "token_length_bucket": "long",
  "user_header_present": true,
  "email_header_present": true,
  "path": "/api/diagnostics/auth-headers",
  "warning": "Non-production diagnostic endpoint. Disable ENABLE_AUTH_DIAGNOSTICS before production use."
}
```

### Step 3 — Interpret the results

| Result | Meaning | Action |
|--------|---------|--------|
| `token_present: true` | `x-forwarded-access-token` header is being injected | OAuth token is available for Databricks queries |
| `token_present: false` | Header is absent or has a different name | Update `identity.py` with the correct header name |
| `user_header_present: false` | `x-forwarded-user` absent | Check Databricks Apps documentation for actual user header name |
| `email_header_present: false` | `x-forwarded-email` absent | Optional — check if Databricks Apps injects this |
| `token_length_bucket: "long"` | Token is ≥ 500 chars — typical for OAuth2 JWTs | Expected |
| `token_length_bucket: "short"` | Token < 100 chars — unlikely for a real JWT | Inspect further |

### Step 4 — Confirm end-to-end query execution

Once headers are confirmed present, switch `BACKEND_ADAPTER_MODE=databricks-api` and invoke one of the wired endpoints:

```bash
curl -s -X POST https://<app-url>/api/por/order-header \
  -H "Content-Type: application/json" \
  -d '{"process_order_id": "<known-order-id>"}' | jq .
```

Expected headers in response:
```
X-Data-Source: databricks-api
X-Adapter-Mode: databricks-api
X-Query-Name: poh.get_process_order_header
```

If the response is `401`, the token is absent or invalid. If `502`, the SQL failed (check column name TODOs). If `200`, the Databricks path is working.

---

## 4. Temporary diagnostic endpoint plan

The `GET /api/diagnostics/auth-headers` endpoint is implemented in `apps/api/routes/auth_diagnostics.py`.

**Activation:** Only active when `ENABLE_AUTH_DIAGNOSTICS=true`. Returns HTTP 404 otherwise.
**Location:** `/api/diagnostics/auth-headers`
**Protection:** The 404 response when disabled does not reveal that the endpoint exists.
**Tests:** Covered in `apps/api/tests/routes/test_auth_diagnostics_routes.py`.

---

## 5. What must not be logged or returned

These rules are enforced in code and must not be relaxed:

- **Never log the raw token.** `identity.py`, `databricks_client.py`, and all route handlers log only `user_id` and query metadata — never `raw_oauth_token`.
- **Never echo the raw token to the frontend.** No route returns the token in the response body.
- **Never store the token.** `UserIdentity` is request-scoped; no token persists beyond the request lifecycle.
- **Never include the token in error messages.** `DatabricksAuthRequiredError` and all derived errors include only the `user_id`, not the token.

---

## 6. Safe diagnostic output fields

The diagnostic endpoint returns exactly these fields — nothing more:

| Field | Type | Description |
|-------|------|-------------|
| `token_present` | bool | Whether `x-forwarded-access-token` was received |
| `token_length_bucket` | string | `"absent"` / `"short"` / `"medium"` / `"long"` — never the token value |
| `user_header_present` | bool | Whether `x-forwarded-user` was received |
| `email_header_present` | bool | Whether `x-forwarded-email` was received |
| `path` | string | Request path (not query string — no user data) |
| `warning` | string | Reminder that this endpoint is non-production |

---

## 7. Removal or protection plan for diagnostics

After verification is complete:

1. **Remove or disable** the `ENABLE_AUTH_DIAGNOSTICS` secret from the target workspace.
2. **Redeploy** the app so the env var is absent (endpoint returns 404).
3. **Optionally remove** `routes/auth_diagnostics.py` and its import in `main.py` once the header names are confirmed and documented here.
4. **Update this document** to mark header names as confirmed (change TODO status to verified date).

The endpoint is safe to leave in the codebase with `ENABLE_AUTH_DIAGNOSTICS` absent — it returns 404 and does not advertise itself.

---

## 8. Header name status

| Header | Status | Source | Verified date |
|--------|--------|--------|--------------|
| `x-forwarded-access-token` | **ASSUMED** | Databricks Apps documentation | Not yet verified |
| `x-forwarded-user` | **ASSUMED** | Databricks Apps documentation | Not yet verified |
| `x-forwarded-email` | **ASSUMED** | Databricks Apps documentation | Not yet verified |

Update this table after running the diagnostic endpoint in a live Databricks Apps deployment.

---

## 9. If header names differ

If `token_present: false` in the diagnostic output, identify the correct header name by inspecting all received headers. Databricks Apps may use a different naming convention. To investigate:

1. Add a temporary debug log in `extract_user_identity()` that logs all header names (not values) present in the request.
2. Identify the header carrying the OAuth token.
3. Update `identity.py` to read the correct header name.
4. Remove the debug log.
5. Update this document with the confirmed header names.

File to update: `apps/api/shared/query_service/identity.py`, function `extract_user_identity()`.
