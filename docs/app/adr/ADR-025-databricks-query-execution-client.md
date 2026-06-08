# ADR-025 — Databricks Query Execution Client

**Date:** 2026-05-16
**Status:** Accepted
**Reference:** ADR-024 (Native Databricks Data-Access Architecture), k.txt (Executable Native Databricks Read Path)

---

## Context

ADR-024 established the QuerySpec/QueryExecutor pattern and left open question #1:

> Should the first executable Databricks read path use the Databricks SQL Statement API or the Databricks SQL Connector for Python?

This ADR resolves that question for the first executable slices (POH `getProcessOrderHeader` and CQ Lab `getLabPlants`). It does not generalise to all future slices.

---

## Decision

**Use the Databricks SQL Statement API via `httpx`.**

---

## Rationale

| Criterion | Statement API | SQL Connector for Python |
|---|---|---|
| Works inside Databricks Apps | Yes — HTTP call | Yes — DBAPI2 driver |
| User OAuth token forwarding | Yes — `Authorization: Bearer {token}` | Requires session credential injection; not standard in DBAPI2 |
| Async compatibility with FastAPI | Yes — `httpx.AsyncClient` | No — sync DBAPI2; needs `run_in_executor` workaround |
| Parameter binding | Yes — typed parameter list | Yes — DBAPI2 `?` placeholders |
| Result size handling | `LIMIT :max_rows` bound parameter | Cursor `fetchmany()` |
| Error classification | HTTP status + JSON state field | Exception subclasses |
| Dependency footprint | `httpx` (already in requirements.txt) | `databricks-sql-connector` (binary wheel, not in requirements.txt) |
| Testability | Mock `httpx.AsyncClient` | Mock DBAPI2 cursor |

The Statement API wins on three critical criteria:

1. **OAuth token forwarding**: The Statement API accepts any Bearer token in the `Authorization` header. The SQL Connector's credential model is designed around service principals and PATs — forwarding a user's short-lived OAuth token requires undocumented workarounds that may break across connector versions.

2. **Async-native**: FastAPI route handlers are async. The SQL Connector is synchronous. Using it would require `asyncio.get_event_loop().run_in_executor()`, adding concurrency complexity and obscuring the identity flow.

3. **Zero new dependencies**: `httpx>=0.27` is already in `requirements.txt` and used by V1 proxy routes. The SQL Connector adds a binary wheel that complicates Databricks Apps deployment.

---

## Implementation

### Client interface

```python
class DatabricksQueryClient(ABC):
    async def execute(
        self,
        *,
        sql: str,
        params: dict[str, object],
        oauth_token: str,
        warehouse_id: str,
        timeout_seconds: int,
        tags: dict[str, str],
    ) -> list[dict[str, object]]: ...
```

### StatementApiDatabricksClient

- `POST https://{DATABRICKS_HOST}/api/2.0/sql/statements`
- `Authorization: Bearer {oauth_token}` — user's token forwarded verbatim
- Parameters serialised as `[{"name": ..., "value": ..., "type": "STRING|INT|DOUBLE|BOOLEAN"}]`
- `wait_timeout: "{timeout_seconds}s"`, `on_wait_timeout: "CANCEL"` — synchronous result or cancel
- `disposition: "INLINE"`, `format: "JSON_ARRAY"` — result in response body
- Result parsed from `manifest.schema.columns` + `result.data_array`

### Query tags

The Databricks Statement API does not have a native query-tag field. Tags (query name, module, endpoint, user ID) are included in structured log output. This limitation is documented.

### Host normalisation

`StatementApiDatabricksClient.__init__()` strips any `https://` or `http://` scheme prefix, leading/trailing whitespace, and trailing slashes from `DATABRICKS_HOST`. This prevents double-scheme URLs (`https://https://...`) if the env var is set with a scheme prefix. The URL is always reconstructed with `https://` in `execute()`.

### Error mapping

| Condition | Error raised | HTTP response |
|---|---|---|
| Missing OAuth token | `DatabricksAuthRequiredError` (before client call) | 401 |
| Statement API returns 401 | `DatabricksAuthRequiredError` (token expired/revoked) | 401 |
| Statement API returns 403 | `DatabricksPermissionError` | 403 |
| Statement API returns 404 | `DatabricksWarehouseConfigError` | 503 |
| Statement API returns 429 | `DatabricksRateLimitError` | 429 |
| Statement API HTTP 5xx | `DatabricksQueryError` | 502 |
| State = CANCELED / CLOSED | `DatabricksQueryTimeoutError` | 504 |
| State = FAILED | `DatabricksQueryError` with Databricks error message | 502 |
| Unexpected state | `DatabricksQueryError` | 502 |
| httpx transport error | `DatabricksQueryError` | 502 |
| httpx timeout | `DatabricksQueryTimeoutError` | 504 |

---

## Security invariants

- `oauth_token` is passed explicitly to every `execute()` call.
- There is no `DATABRICKS_TOKEN`, `DATABRICKS_CLIENT_ID`, or `DATABRICKS_CLIENT_SECRET` read by the client.
- The `QueryExecutor` calls `identity.require_user_oauth()` before passing any token to the client, ensuring the user token is present.
- Route handlers raise HTTP 401 on `DatabricksAuthRequiredError` — no fallback to mock or legacy-api.
- `None` is rejected by `_infer_param_type()` with a `ValueError` — prevents the literal string `"None"` reaching SQL.
- OAuth tokens are never included in log output; only `user_id`, `query_name`, `warehouse_id`, and tags are logged.

---

## Environment variables required

| Variable | Description |
|---|---|
| `BACKEND_ADAPTER_MODE` | `legacy-api` (default) or `databricks-api` |
| `DATABRICKS_HOST` | Databricks workspace hostname (no `https://` prefix) |
| `SQL_WAREHOUSE_ID` | SQL Warehouse ID to execute statements against |

Missing `DATABRICKS_HOST` or `SQL_WAREHOUSE_ID` in `databricks-api` mode returns HTTP 503 immediately — not a silent fallback.

---

## Consequences

- A real, executable Databricks read path is now in place for POH and CQ Lab.
- All Databricks queries go through `QueryExecutor → StatementApiDatabricksClient`.
- SQL Connector for Python is not introduced — no binary wheel dependency.
- Query tags via Statement API are not native; tags are logged instead.
- ADR-024 open question #1 is resolved.
- ADR-024 open question #7 (cache backend) is deferred — no in-process cache or Redis in this tranche.

---

## What this ADR does not cover

- Caching strategy (ADR-024 open question #7 — still open)
- Recursive Trace graph traversal (deferred)
- Domain-wide migration (deferred per k.txt)
- Service-principal token path (explicitly excluded — not in scope for user-facing reads)
