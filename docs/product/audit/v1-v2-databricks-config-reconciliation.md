# V1 / V2 Databricks Configuration Reconciliation

**Date:** 2026-05-17
**Tranche:** m.txt — V1/V2 Databricks Config Reconciliation
**References:** ADR-024, ADR-025, `apps/api/shared/query_service/object_resolver.py`

Confirms that V2 native Databricks execution uses the same essential deployment and configuration principles as V1.

---

## Configuration Comparison

| Principle | V1 | V2 | Status |
|-----------|----|----|--------|
| User OAuth token forwarding | `Authorization: Bearer {token}` from request context | `StatementApiDatabricksClient.execute()` receives `oauth_token` from `identity.require_user_oauth()` | **ALIGNED** |
| Catalog/schema env var naming | `CQ_CATALOG`, `POH_CATALOG`, `TRACE_CATALOG` | Same env var names in `object_resolver.py` | **ALIGNED** |
| CQ_CATALOG fallback | `os.environ.get("CQ_CATALOG", os.environ.get("TRACE_CATALOG", ""))` | `resolve_domain_object("cq", ...)` falls back to TRACE_CATALOG when CQ_CATALOG unset | **ALIGNED** |
| Schema defaults | POH: `csm_process_order_history`; Trace: `gold` | Same defaults in `_SCHEMA_ENV` dict in `object_resolver.py` | **ALIGNED** |
| CQ lab plants schema | Always uses `gold` schema — `` `{CQ_CATALOG}`.`gold`.`gold_plant` `` | `resolve_domain_object("cq", "gold_plant", schema_override="gold")` | **ALIGNED** |
| Three-part object qualification | `` `{catalog}`.`{schema}`.`{object}` `` backtick-quoted | `qualify_object()` produces the same format | **ALIGNED** |
| CQ lab plants column names | `PLANT_ID AS plant_id, PLANT_NAME AS plant_name` | Same in `get_lab_plants_spec()` | **ALIGNED — confirmed-v1** |
| Warehouse identifier | `DATABRICKS_WAREHOUSE_HTTP_PATH` (DBAPI2) | `SQL_WAREHOUSE_ID` (Statement API) | **DIFFERENT — acceptable** |
| Execution client | DBAPI2/Connector | Statement API (httpx, async) | **DIFFERENT — by design** |
| Service-principal fallback | Uses per-user OAuth only | No SPN credentials read — user OAuth required or 401 | **ALIGNED (V2 stricter)** |

### Warehouse identifier difference

V1 uses `DATABRICKS_WAREHOUSE_HTTP_PATH` (the HTTP path for DBAPI2, e.g. `/sql/1.0/warehouses/<id>`).
V2 uses `SQL_WAREHOUSE_ID` (the raw ID for the Statement API, e.g. `0123456789abcdef`).

Different env var names for the same underlying warehouse, used by different client libraries. Does not conflict — both point to the same resource.

---

## Object Resolver Security Properties

`apps/api/shared/query_service/object_resolver.py` — properties confirmed by `tests/shared/test_object_resolver.py`:

| Property | Enforcement |
|----------|-------------|
| Object names are code constants only | `object_name` parameter is always a string literal in the adapter factory — never derived from request parameters |
| Env vars read at call time | `resolve_domain_object()` reads `os.environ` in the function body, not at import time — env var changes are reflected immediately |
| Missing catalog raises `DatabricksConfigError` | All three domains (poh, cq, trace2) raise on missing catalog; caught in route handlers → HTTP 503 |
| Unknown domain raises `ValueError` | Prevents accidental calls with unregistered domain identifiers |
| All identifiers backtick-quoted | `qualify_object()` wraps catalog, schema, and object in backticks — prevents identifier injection |

---

## Domain Namespace Configuration

### Required env vars per domain

| Domain | Catalog var | Schema var | Schema default |
|--------|------------|-----------|----------------|
| POH | `POH_CATALOG` | `POH_SCHEMA` | `csm_process_order_history` |
| CQ | `CQ_CATALOG` (fallback: `TRACE_CATALOG`) | `CQ_SCHEMA` | `csm_process_order_history` |
| Trace2 | `TRACE_CATALOG` | `TRACE_SCHEMA` | `gold` |

**CQ_CATALOG fallback:** V1 allowed `CQ_CATALOG` to default to `TRACE_CATALOG` when unset. V2 preserves this for backward compatibility. Prefer setting `CQ_CATALOG` explicitly in new deployments.

**CQ lab plants uses gold schema always:** `` `{CQ_CATALOG}`.`gold`.`gold_plant` `` regardless of `CQ_SCHEMA`. This matches V1 and is enforced via `schema_override="gold"` in `get_lab_plants_spec()`.

---

## Deployment Checklist (databricks-api mode)

Required secrets in Databricks Apps secret scope:

```bash
# Core Databricks execution
databricks secrets put-secret connectio-v2 databricks-host \
  --string-value "<workspace>.azuredatabricks.net"
databricks secrets put-secret connectio-v2 sql-warehouse-id \
  --string-value "<warehouse-id>"

# Domain catalogs
databricks secrets put-secret connectio-v2 poh-catalog \
  --string-value "connected_plant_uat"
databricks secrets put-secret connectio-v2 cq-catalog \
  --string-value "connected_plant_uat"
databricks secrets put-secret connectio-v2 trace-catalog \
  --string-value "connected_plant_uat"
```

In `app.yaml` (already present as commented-out blocks — uncomment to activate).

> **IMPORTANT:** Databricks Apps requires `valueFrom` to be a plain `scope/key` string.
> Nested YAML dicts (`valueFrom: {secretScope: ..., secretKey: ...}`) are **not supported**
> and cause a startup error ("error reading app.yaml file").

```yaml
env:
  - name: BACKEND_ADAPTER_MODE
    value: databricks-api
  - name: DATABRICKS_HOST
    valueFrom: connectio-v2/databricks-host
  - name: SQL_WAREHOUSE_ID
    valueFrom: connectio-v2/sql-warehouse-id
  - name: POH_CATALOG
    valueFrom: connectio-v2/poh-catalog
  - name: CQ_CATALOG
    valueFrom: connectio-v2/cq-catalog
  - name: TRACE_CATALOG
    valueFrom: connectio-v2/trace-catalog
  # Schema vars — omit to use defaults unless the workspace uses non-standard schema names
  # - name: POH_SCHEMA
  #   value: csm_process_order_history
  # - name: TRACE_SCHEMA
  #   value: gold
```

---

## V1 Source Confirmations

Confirmed from V1 source code during m.txt reconciliation:

| Item | V1 source value | V2 uses |
|------|----------------|---------|
| CQ lab plants table | `` `{CQ_CATALOG}`.`gold`.`gold_plant` `` | Same |
| CQ lab plants plant ID column | `PLANT_ID` | `PLANT_ID AS plant_id` |
| CQ lab plants plant name column | `PLANT_NAME` | `PLANT_NAME AS plant_name` |
| CQ lab plants filter | `WHERE PLANT_ID IS NOT NULL` | Same |
| CQ lab plants order | `ORDER BY PLANT_ID` | Same |
| POH status column | `po.STATUS` text values: `'IN PROGRESS'`, `'COMPLETED'`, `'CLOSED'`, `'NOT STARTED'` | V2 uses `objnr` — **KNOWN BLOCKER: must verify with live DDL** |

### POH status column discrepancy (known blocker)

V1 POH adapter uses a text `STATUS` column. V2 currently maps `objnr` → status via `_ORDER_STATUS_MAP` (SAP standard codes: REL, CRTD, CNF, CLSD, etc.).

This cannot be resolved without live DDL verification. V2 code contains `# TODO` markers at the affected column and mapping. Tracked in `docs/audit/native-databricks-column-verification-checklist.md`.
