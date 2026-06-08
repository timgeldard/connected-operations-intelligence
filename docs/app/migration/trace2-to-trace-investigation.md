# Migration Guide: Trace2 → Trace Investigation Workspace

## Overview

This document describes how the legacy **Trace2** application's capabilities map into the **Trace Investigation** workspace in ConnectIO-RAD V2.

Trace2 will remain the system of record for batch lineage data throughout migration. ConnectIO-RAD V2 surfaces Trace2 data through the `Trace2Adapter` without replicating backend logic.

---

## Capability Mapping

| Trace2 Feature | V2 Destination | Notes |
|---|---|---|
| Forward/reverse trace tree | `trace-tree` view → `TraceGraphPanel` | Phase 1: structured list; React Flow in Phase 2 |
| Batch header / batch status | `BatchHeaderPanel` | Stock status, quality status, release status |
| Mass balance reconciliation | `mass-balance` view → inline `MassBalancePanel` | Variance % + confidence |
| Customer delivery exposure | `CustomerImpactPanel` | Includes recall recommendation flag |
| Supplier lot exposure | `MaterialSupplierExposurePanel` | Open supplier actions count |
| Event audit trail | `EventTimelinePanel` | Ordered by timestamp, source-attributed |
| CoA / release decision | `CoAReleaseStatusPanel` | Owned by quality domain |
| Risk signals | `RiskSignalsPanel` | Sourced from Trace2 + EnvMon signals |
| Related investigations | `RelatedInvestigationsPanel` | Linked by batch/material/supplier/customer |
| Investigation management | Action flows panel (New/Add/Escalate/Resolve) | Phase 1: mock submit |

---

## What Is Reused from Trace2

- **Batch lineage data** — all graph nodes and edges come from Trace2's lineage API.
- **Event history** — Trace2 event log is the authoritative source for the timeline.
- **Mass balance figures** — Trace2 calculates input/output quantities; V2 displays them.
- **Risk signal scoring** — Trace2 risk engine (batch exposure model) feeds `RiskSignalsPanel`.

---

## What Remains Source-Owned in Trace2

- Batch lineage calculation algorithm
- Mass balance business rules
- Risk exposure scoring model
- Customer/supplier lot resolution logic

These are intentionally NOT replicated in V2. The `Trace2Adapter` maps Trace2 API responses to typed data-contract shapes — it does not re-implement domain logic.

---

## What Is Mocked in Phase 1

All adapter methods return mock data from `trace2-mock-data.ts`:

| Data | Mock File | Realistic? |
|---|---|---|
| Investigation context | `mockInvestigationContext` | Yes — Kerry Listowel Emmental batch |
| Batch header | `mockBatchHeader` | Yes — blocked batch, quality inspection |
| Trace graph | `mockTraceGraph` | Yes — 7 nodes, 6 edges, 2 unresolved |
| Mass balance | `mockMassBalance` | Yes — 10% variance, 1 unresolved movement |
| Customer exposure | `mockCustomerExposure` | Yes — 3 customers, recall recommended |
| Supplier exposure | `mockSupplierExposure` | Yes — Golden Vale Dairy Co-op |
| Event timeline | `mockTraceEvents` | Yes — 5 events with realistic timestamps |
| CoA release status | `mockCoAReleaseStatus` | Yes — blocked, usage decision: reject |
| Risk signals | `mockRiskSignals` | Yes — Lm environmental signal + 2 others |
| Related investigations | `mockRelatedInvestigations` | Yes — 2 linked investigations |

---

## Future Backend / API Integration (Phase 2)

Phase 2 will wire the `Trace2Adapter` to real Trace2 API endpoints:

```
GET /api/trace2/investigations/{investigationId}
GET /api/trace2/batch/{batchId}/header
GET /api/trace2/batch/{batchId}/graph?direction=both
GET /api/trace2/batch/{batchId}/mass-balance
GET /api/trace2/batch/{batchId}/customer-exposure
GET /api/trace2/batch/{batchId}/supplier-exposure
GET /api/trace2/investigations/{investigationId}/events
GET /api/trace2/batch/{batchId}/coa-status
GET /api/trace2/investigations/{investigationId}/risk-signals
GET /api/trace2/investigations/{investigationId}/related
```

The adapter interface is already typed. Swapping mock data for real API calls requires only:

1. Replacing the `ok(mockData)` returns in each adapter method with `fetchJson(url)` calls.
2. Adding response mapping from the raw Trace2 API schema to the data-contract types.
3. Wiring the FastAPI backend `apps/api/routes/trace2.py` (Phase 2).

No changes to panels, views, or the workspace component are required.

---

## Design Boundary Preserved

The Trace Investigation workspace does NOT import:
- `@radix-ui/*` — all UI through `@connectio/design-system`
- `shadcn/ui` directly — same
- Trace2 business logic — adapter only maps; never calculates
- Any other workspace's adapter or panels

The `coa-release-status` panel is explicitly owned by the `quality` domain (SAP QM source) even though it is consumed by the traceability workspace. This cross-domain panel pattern is intentional and governed by `allowedConsumerWorkspaces`.
