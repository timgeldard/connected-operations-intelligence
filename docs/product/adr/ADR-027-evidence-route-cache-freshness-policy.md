# ADR-027 — Evidence Route Cache and Freshness Policy

## Status

Proposed (Updated with review revisions)

## Context

ConnectIO V2 surfaces Databricks-backed manufacturing evidence with source badges, freshness indicators, and safety guardrails. Serving cached evidence improves response times and reduces Databricks query costs but risks misleading users with stale decision-sensitive data. This ADR defines our server-side cache and freshness policies.

Since ConnectIO V2 is strictly a **read-only** application, we do not support any write-back mechanisms, status changes, or automated actions. Consequently, caching must be handled defensively and default to no-caching for operational evidence to respect UX truthfulness.

---

## Decision

We will implement a lightweight, opt-in caching layer on top of `DatabricksRepository.fetch` with the following design rules:

### 1. Cache Tiers (Mapped to CacheTier)

- **`NONE` / `NO_CACHE`**: For safety-critical or volatile evidence. Bypasses the cache. **This is the default.**
- **`PER_USER_60S`**: For user-scoped operational data.
- **`GLOBAL_300S`**: For slow-moving global reference/dimension data.
- **Future Tiers**: `PER_USER_30S`, `PER_USER_300S`, and `SHARED_REFERENCE_1H`.

### 2. Cache Key Strategy & Context Scoping

To isolate user permissions, environment contexts, and cross-domain parameters, cache keys must be built by hashing a combination of:

- `query_name` and `route_name`
- **Cross-Domain Context**: Normalized active bounds (e.g., `batchId`, `materialId`, `plantId`, `processOrderId`).
- User identity (for `PER_USER` tiers) and the active `catalog_target` (to prevent override leakage).
- Catalog and Schema overrides (`catalog_override`, `schema_override`).
- SQL string / query spec fingerprint (to prevent stale cache reuse after query changes).
- Normalized request bind parameters.

_Example cache key serialization format:_

```python
key = sha256(f"{query_name}:{route_endpoint}:{catalog_target}:{catalog_override}:{schema_override}:{sql_fingerprint}:{sorted_context}:{user_id}")
```

### 3. Route Decorators (Python API Polish)

Routes or repositories configure cache tiers using decorators to express policy concisely:

```python
@evidence_route(freshness=FreshnessPolicy(ttl=300, critical=True))
async def get_chart_data(request: Request):
    # Route logic automatically propagates cache behavior
```

### 4. Cache Invalidation Strategy

For critical workspaces (like Trace and Warehouse 360), passive TTL expiration is supplemented with data-layer freshness checks:

- **Data Refresh Tracking**: When change data capture pipelines or workflow updates commit new data to Unity Catalog, the caching layer respects the TTL to fetch fresh data.
- **No Action-Triggered Write-Backs**: Since V2 is read-only and does not perform manual usage-decision status writes or SAP updates, there is no action-triggered invalidation. Invalidation relies purely on defensive, short-duration TTL boundaries.

### 5. Single-Process In-Memory Store

The current `InMemoryCacheStore` is a single-process, local cache designed to support local development and controlled UAT verification. It is not a production-grade distributed cache.

### 6. Response Headers & Observability

- `X-Cache-Status`: `HIT` | `MISS` | `BYPASS` | `STALE` | `DISABLED`
- `X-Cache-Age-Seconds`: Seconds elapsed since the item was cached.
- `X-Cache-TTL-Seconds`: Configured TTL for the cache entry.
- `X-Data-Freshness-Policy`: Caching policy tier in use.

### 7. Freshness, Errors, and Empty State Handling

- **Stale-While-Error**: If Databricks is offline, stale cache is returned only if the route permits, flagged as `X-Cache-Status: STALE` with a visible warning in the UI.
- **No Silent Masking**: Authentication, permission, or configuration failures must propagate immediately; they cannot be satisfied by cache lookup.
- **Empty Result vs Error**: A cached empty result is stored as empty, not as a source error.

---

## Consequences

- **Positive**: Caching defaults to `NONE`, ensuring no stale caching of operational evidence routes by default. Headers allow trace validation during browser UAT.
- **Negative**: Additional serialization/hashing logic required for cache keys containing cross-domain context, overrides, and SQL fingerprints.
