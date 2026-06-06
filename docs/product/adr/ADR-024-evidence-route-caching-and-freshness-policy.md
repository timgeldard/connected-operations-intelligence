# ADR-024 — Evidence Route Caching and Freshness Policy

**Status:** Accepted  
**Date:** 2026-05-24  
**Deciders:** ConnectIO V2 team  
**Supersedes:** None

---

## Context

ConnectIO V2 reads from Databricks gold views on every route call. As more workspaces enter controlled UAT, query latency and Databricks cost become visible concerns. There is an existing `FreshnessIndicator` component and a `freshnessPolicy` field on every `EvidencePanelRegistration`. No caching has been implemented yet.

Before any caching is introduced, a policy must exist that:

1. Prevents evidence panels from silently serving stale data as live data.
2. Defines which data products may be cached and which must never be.
3. Requires freshness to be visible to the user when cached data is served.
4. Avoids misleading users during browser UAT evidence capture.

This ADR records the agreed policy. Implementation of caching is a separate PR gated on this ADR being accepted.

---

## Decision

### 1. No caching before first browser UAT evidence capture

Evidence panels must fetch live data during browser UAT evidence capture sessions. If a route returns cached data and freshness is not shown, the evidence pack is invalid.

**Rule:** During evidence capture, caching must be disabled or freshness must be prominently labelled with the cache age. Evidence screenshots must note whether data was live or cached.

### 2. Cacheable vs non-cacheable data products

| Data product | Cacheable | Default TTL | Rationale |
|---|---|---|---|
| Warehouse inbound receipts | Yes | 120 s | Read-only WMS summary; staleness unlikely to matter within 2 min |
| Warehouse staging status | Yes | 60 s | Updated frequently but not second-level |
| Warehouse exceptions | Yes | 60 s | As above |
| Warehouse overview (nearExpiryCount, reconciliationExceptionCount) | **No** | — | Contains unverified derived metrics; Gates 4 and 5 not governed |
| Trace batch header | **No** | — | Investigation-critical; recall-recommendation field is governance-pending |
| Trace customer/supplier exposure | **No** | — | Recall scope; must be live during active investigations |
| Quality usage-decision evidence | **No** | — | Lot-level inspection result; any staleness risks acting on superseded data |
| SPC chart subgroups | Yes | 300 s | Historical process data; stable within the cache window |
| SPC limit provenance | **No** | — | Governance-pending; must not show stale limits as current |
| POH process-order header | Yes | 90 s | Order status can change; short TTL acceptable |
| POH confirmations | Yes | 60 s | Frequently updated during production run |

### 3. Required response headers

Any route that is cached must return:

| Header | Value | Example |
|---|---|---|
| `x-cache-status` | `hit` or `miss` | `hit` |
| `x-cache-ttl` | TTL in seconds | `120` |
| `x-cache-age` | Seconds since cached | `47` |
| `x-data-freshness` | ISO 8601 timestamp of source data | `2026-05-24T09:12:00Z` |
| `x-source-system` | Source system identifier | `databricks` |

Routes that are never cached must still return `x-data-freshness` and `x-source-system`.

### 4. UI freshness display requirements

- Every evidence panel that serves potentially cached data must render the `FreshnessIndicator` component with the timestamp from `x-data-freshness`.
- The indicator must be visible without scrolling in the panel header or strip.
- If `x-cache-status: hit`, the panel must show "Cached — fetched N seconds ago" rather than implying live data.
- Panels that are never cached should show "Live" or the fetch timestamp.

### 5. Behaviour when cache is stale

- If the TTL has expired and the Databricks query is in-flight, serve the stale cached response with `x-cache-status: stale` header.
- The UI must render `EvidenceStatusBadge` with status `partial` or a `CaveatBadge` labelled "Stale" rather than showing stale data as current.
- The panel must not show a red error state for stale-but-available data.

### 6. Behaviour when Databricks query fails and cache exists

- If the Databricks query fails and a cached response exists (even expired), serve the cached response.
- Set `x-cache-status: fallback`.
- The UI must render `EvidenceStatusBadge` with status `partial` and display the staleness age prominently.
- Do not render a fully loaded state when serving fallback cache.

### 7. Cache implementation sequence

Do not implement Redis or any distributed cache before:

1. This ADR is accepted.
2. Response headers from §3 are implemented.
3. Freshness display from §4 is implemented in the UI.
4. At least one round of browser UAT evidence capture has run against live (uncached) data.

The recommended proof-of-concept is an in-memory LRU cache in the FastAPI layer, keyed by `(route, request_params)`. Evaluate cost/latency impact before adding Redis.

### 8. Cache is never allowed to satisfy evidence that a field value is safe

A cached response must never be the sole basis for displaying a governed value (e.g. usageDecision, recallRecommended, qualityStatus) without a visible freshness label. If the freshness label cannot be rendered, the panel must show `EvidenceStatusBadge` with status `pending-validation`.

---

## Consequences

**Positive:**
- Caching cannot accidentally undermine trust in evidence panels.
- UAT evidence packs are unambiguous about whether data is live or cached.
- Performance improvements are possible for safe data products without compromising governance.

**Negative:**
- Caching is blocked until response headers and freshness labels are implemented.
- Warehouse overview KPIs remain uncacheable until Gates 4 and 5 are governed.

**Neutral:**
- Existing `freshnessPolicy` values on `EvidencePanelRegistration` remain the source of truth for TTL decisions — `defaultTtlSeconds` in the registration can drive the backend cache TTL once caching is added.

---

## Rejected alternatives

**Cache everything with a global 5-minute TTL** — rejected because decision-sensitive evidence (recall, quality lot, limit provenance) would silently become stale without user awareness.

**No caching at all** — rejected because warehouse and SPC journeys with high query cost should have a safe caching option once freshness is visible.

**Redis first** — rejected because distributed cache adds operational complexity. In-memory proof-of-concept first, Redis only if scale requires it.
