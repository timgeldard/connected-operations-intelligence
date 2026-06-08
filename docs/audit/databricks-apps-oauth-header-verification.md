# Databricks Apps OAuth Header Verification

**Status: PENDING — names NOT yet verified against a live Databricks Apps deployment.**

Every plant-level RLS guarantee — for *all* domains — depends on resolving the correct end user
into Unity Catalog's `current_user()` predicate. That resolution reads the OAuth-proxy headers the
Databricks Apps runtime injects, mapped in
`apps/api/shared/query_service/identity.py::extract_user_identity`. Until the header names are
confirmed in a live environment, those names carry `UNVERIFIED` markers and `main.py` emits a
startup warning. **Do not remove the markers or the warning until this doc records a successful
live verification.**

## Assumed header → identity mapping (UNVERIFIED)

| HTTP header (assumed)        | `UserIdentity` field   | Notes |
|------------------------------|------------------------|-------|
| `x-forwarded-access-token`   | `raw_oauth_token`      | End-user OAuth2 bearer; required for any `databricks-api` query (no SP fallback). |
| `x-forwarded-user`           | `user_id`              | Falls back to `"unknown"` when absent. |
| `x-forwarded-email`          | `email`                | Optional. |
| `x-databricks-catalog`       | `catalog_target`       | App-supplied catalog override (validated by `assert_allowed_catalog_target`). Not an OAuth-proxy header. |

These names are pinned by `apps/api/tests/shared/test_identity_headers.py` (`EXPECTED_HEADER_NAMES`),
so a code-side rename fails CI. The test does **not** prove the names match what Databricks Apps
actually injects — that is what the live verification below establishes.

## Verification procedure (to be run by a maintainer with DEV Apps access)

1. Deploy a build to the DEV Databricks Apps workspace with `ENABLE_AUTH_DIAGNOSTICS=true`.
2. Authenticated as a real user, call `GET /api/diagnostics/auth-headers`
   (`apps/api/routes/auth_diagnostics.py` — returns presence/length-bucket only, never the token).
3. Confirm `token_present`, `user_header_present`, `email_header_present` are all `true`. If any is
   false, inspect the inbound request headers in the Apps proxy and record the **actual** names.
4. If the actual names differ from the assumed ones, update `extract_user_identity` (and
   `EXPECTED_HEADER_NAMES` in the pinning test) to the confirmed names.
5. Record the result in the table below, then **remove the `UNVERIFIED` markers in `identity.py`
   and the `APP_ENV != production` startup-warning block in `main.py`**, and disable
   `ENABLE_AUTH_DIAGNOSTICS`.

## Verification results

| Date | Workspace | Observed header names | token_present | Confirmed by | Outcome |
|------|-----------|-----------------------|---------------|--------------|---------|
| _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _not yet run_ |

## Status of this work

- ✅ Header names pinned by a CI test (`test_identity_headers.py`) — a code-side rename now fails CI.
- ✅ Diagnostics endpoint confirmed hardened (gated by `ENABLE_AUTH_DIAGNOSTICS`, 404 when disabled,
  never returns the raw token, length-bucketed).
- ⏳ **Live verification not yet performed** — requires a DEV Databricks Apps deployment. The
  `UNVERIFIED` markers and the startup warning remain in place until step 5 above is complete.
