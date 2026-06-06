# Data Freshness — Implementation Plan

**Domain:** `domain-integrations/traceability`  
**Created:** 2026-05-19  
**Status:** Plan only — freshness metadata not yet available  
**Readiness row:** 2.4

> **Current state:** The batch header panel and all other traceability panels display data
> with a "data freshness not available" note. The EvidencePanel runtime tracks query-fetch
> time (i.e. when the HTTP request completed), but this is not the same as when the
> underlying Databricks gold views were last refreshed. No `dataAsOf` field is currently
> populated by any adapter.

---

## Problem

Production readiness row 2.4 states: "Data freshness / staleness surfaced to user — ❌ TRACE-P2-002 open."

The reference engine attached `data_freshness_seconds` to response objects. V2 has no
equivalent. The risk is that an investigator sees batch header or exposure data without
knowing whether it reflects the last few minutes or several hours of Databricks pipeline
activity.

This is particularly important for:
- `gold_batch_stock_v` (stock quantities and status can change during a production shift)
- `gold_batch_delivery_v` (delivery confirmation status may lag shipment by hours)
- `gold_batch_lineage` (new lineage edges created as batches are split or transferred)

---

## Current Freshness Hooks

The following freshness mechanisms already exist but do not surface `dataAsOf`:

### EvidencePanel runtime (query-fetch staleness)

`BatchHeaderPanel` passes `lastRefreshedAt = result?.fetchedAt` to `useEvidencePanel`.
`fetchedAt` is set by the adapter at query time — it records when the HTTP response was
received, not when the underlying data was updated in Databricks.

```typescript
// batch-header-panel.tsx — current
const lastRefreshedAt = result?.ok ? result.fetchedAt : null
const { displayState } = useEvidencePanel({
  panelId: registration.panelId,
  staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,  // 300s
  lastRefreshedAt,
})
```

The EvidencePanel runtime uses this to show a staleness indicator after 300 seconds
(`staleAfterSeconds: 300`). This correctly tracks "how long since the last query" but
not "how current is the underlying data."

### `SourceFreshness` interface (exists, not wired)

`packages/source-adapters/src/types.ts` exports:

```typescript
export interface SourceFreshness {
  fetchedAt: string
  dataAsOf: string | null   // ISO timestamp of underlying data update, or null if unknown
  isStale: boolean
}
```

This interface is not currently wired to `AdapterResult`. Wiring it is the correct long-term
approach but is out of scope for this tranche (cross-cutting change requiring all adapter
implementations to populate `dataAsOf`).

---

## Recommended Implementation Path

### Phase 1 (this tranche — already done)

Add a one-line disclaimer in the batch header panel UI: "Data freshness not available —
shown as of query time only." This prevents a user from assuming the displayed data is
up-to-the-minute without any freshness signal.

### Phase 2 (future tranche)

**Approach A — Databricks `_updated_at` column (preferred)**

Many gold views include a row-level `_updated_at` or `last_updated_timestamp` column that
reflects when the row was last written by the pipeline. If `gold_batch_summary_v` exposes
such a column:

1. Add `data_as_of` to the QuerySpec response alongside the existing rows.
2. In the adapter `map_batch_header_rows`, extract the max `_updated_at` value across
   returned rows and include it in the response payload.
3. Add `dataAsOf: z.string().datetime().optional()` to `BatchHeaderSummarySchema` (or a
   wrapper type).
4. Pass `dataAsOf` through `AdapterResult` using the existing `SourceFreshness` interface.
5. Render it in `BatchHeaderPanel` next to the "Data freshness" placeholder.

**Column name to verify:** The `_updated_at` or equivalent column in `gold_batch_summary_v`
must be confirmed during the column verification step (Query 1/2 in
`docs/migration/databricks-column-verification-queries.md`).

**Approach B — Pipeline run timestamp (fallback)**

If no per-row timestamp is available, query the Databricks job run history for the pipeline
that populates the gold views and expose the most recent successful run timestamp. This
requires a separate service call and is higher complexity — prefer Approach A.

**Approach C — TanStack Query cache timestamp only (minimal)**

If Approach A is not feasible, the panel can display the query-fetch time with an explicit
label: "Queried at: HH:MM" and a note that this reflects query time, not data update time.
This is already functionally implemented via `fetchedAt`; it only requires a UI label change.

---

## What NOT to do

- Do not invent a `dataAsOf` value by copying `fetchedAt`. They are different concepts.
- Do not add `dataAsOf` to `AdapterResult<T>` as a required field — it would require all
  existing adapters (mock, legacy-api, databricks) to be updated simultaneously.
- Do not display a staleness indicator unless a real `dataAsOf` value is available.
- Do not remove the "Data freshness not available" note without a verified freshness source.

---

## Tests Required (Phase 2)

When `dataAsOf` is wired:

1. `test_map_batch_header_rows_includes_data_as_of_when_present` — row with `_updated_at`
   column → `dataAsOf` in response
2. `test_batch_header_panel_shows_data_as_of_when_available` — adapter result with
   `dataAsOf` → timestamp rendered in panel
3. `test_batch_header_panel_shows_freshness_unavailable_when_data_as_of_absent` — adapter
   result without `dataAsOf` → "Data freshness not available" note shown

---

## Readiness Checklist Link

- Row 2.4: `Data freshness / staleness surfaced to user` — ❌ TRACE-P2-002 open
- Current state: Phase 1 disclaimer added to BatchHeaderPanel. Full freshness wiring
  requires Phase 2 (column verification + `dataAsOf` field implementation).
